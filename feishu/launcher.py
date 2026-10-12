#!/usr/bin/env python3
"""macOS 登录后台与 Edge 启动入口 / login service and browser launcher."""
import argparse
import errno
import json
import os
import plistlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from feishu.storage import PROJECT, atomic_write

LABEL = 'com.sophistudio.feishu'
ROOT = PROJECT / 'feishu'
AGENT = Path.home() / 'Library/LaunchAgents' / (LABEL + '.plist')
TARGET = f'gui/{os.getuid()}/{LABEL}'
URL = 'http://127.0.0.1:8769/feishu/feishu.html'
LOG = ROOT / '.state/launchagent.log'
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def python_executable():
    # 使用可在系统设置授权的应用本体 / use the app executable authorized in Settings.
    app = Path(sys.prefix) / 'Resources/Python.app/Contents/MacOS/Python'
    return str(app) if app.is_file() else sys.executable


def status():
    request = urllib.request.Request('http://127.0.0.1:8769/api/status',
                                     headers={'X-Feishu-Client': 'sophistudio'})
    try:
        with OPENER.open(request, timeout=3) as response:
            result = json.loads(response.read(1024 * 1024))
    except urllib.error.HTTPError:
        raise RuntimeError('8769 端口被其他服务占用或服务尚未就绪，请检查启动日志。') from None
    except urllib.error.URLError as error:
        if isinstance(error.reason, OSError) and error.reason.errno == errno.ECONNREFUSED:
            return None
        raise RuntimeError('本地服务暂时无响应，请检查启动日志后重试。') from None
    except (ValueError, TimeoutError, OSError):
        raise RuntimeError('本地服务响应异常，请检查启动日志后重试。') from None
    if not isinstance(result, dict) or result.get('service') != 'sophistudio-feishu':
        raise RuntimeError('8769 端口被其他服务占用；未启动重复进程。')
    return result


def launchctl(*args, check=True):
    return subprocess.run(['/bin/launchctl', *args], check=check,
                          capture_output=True, text=True)


def check_agent():
    if not AGENT.exists():
        return
    try:
        value = plistlib.loads(AGENT.read_bytes())
        args = value.get('ProgramArguments', [])
        ours = value.get('Label') == LABEL and args[1:] == ['-u', str(ROOT / 'launcher.py'), '--serve']
    except (ValueError, TypeError, AttributeError):
        ours = False
    if not ours:
        raise RuntimeError(f'同名启动项不属于本工具，已保留：{AGENT}')


def load_agent():
    check_agent()
    launchctl('enable', TARGET)
    if launchctl('print', TARGET, check=False).returncode:
        launchctl('bootstrap', f'gui/{os.getuid()}', str(AGENT))


def wait_ready(timeout=35):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if status() is not None:
            return
        time.sleep(0.5)
    raise RuntimeError(f'服务未能启动，请查看日志：{LOG}')


def wait_agent(timeout=25):
    # 旧后台的健康检查不能掩盖登录进程启动失败 / verify launchd itself as well.
    deadline = time.monotonic() + timeout
    healthy_since = None
    while time.monotonic() < deadline:
        process = launchctl('print', TARGET, check=False)
        running = process.returncode == 0 and re.search(r'^\s*state = running$', process.stdout, re.M)
        if running:
            healthy_since = healthy_since or time.monotonic()
            if time.monotonic() - healthy_since >= 3 and status() is not None:
                return
        else:
            healthy_since = None
        time.sleep(0.5)
    raise RuntimeError(f'登录项已保存，但后台未能运行。请查看 {LOG}；'
                       '若显示 Operation not permitted，需要在 macOS 中允许 Python 访问项目目录。')


def install_login():
    check_agent()
    LOG.parent.mkdir(parents=True, exist_ok=True)
    value = {
        'Label': LABEL,
        'ProgramArguments': [python_executable(), '-u', str(ROOT / 'launcher.py'), '--serve'],
        'WorkingDirectory': str(PROJECT),
        'RunAtLoad': True,
        'KeepAlive': True,
        'ThrottleInterval': 15,
        'LimitLoadToSessionType': 'Aqua',
        'ProcessType': 'Background',
        'Umask': 0o077,
        'StandardOutPath': str(LOG),
        'StandardErrorPath': str(LOG),
    }
    atomic_write(AGENT, plistlib.dumps(value))
    load_agent()
    wait_agent()
    print('已开启登录自动启动。以后在 Edge 打开 feishu/feishu.html 即可连接后台。')


def disable_login():
    check_agent()
    current = status()
    if current and current.get('running'):
        raise RuntimeError('正在同步，请等待本轮完成后再关闭登录启动。')
    if not launchctl('print', TARGET, check=False).returncode:
        launchctl('bootout', TARGET)
    if AGENT.exists():
        AGENT.unlink()
    print('已关闭登录自动启动。配置与本地文档保留，仍可双击 start.command 启动。')


def serve():
    # 等已有服务退出再接管，避免打断同步 / adopt only after the old server exits.
    if status() is not None:
        print('已有飞书后台，等待其退出后自动接管。', flush=True)
        while status() is not None:
            time.sleep(3)
    python = python_executable()
    os.execv(python, [python, '-u', str(ROOT / 'server.py')])


def ensure_running():
    if status() is not None:
        return
    if AGENT.exists():
        load_agent()
    else:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, 'ab') as log:
            subprocess.Popen([python_executable(), '-u', str(ROOT / 'server.py')],
                             cwd=PROJECT, stdin=subprocess.DEVNULL, stdout=log,
                             stderr=subprocess.STDOUT, start_new_session=True)
    wait_ready()


def main():
    parser = argparse.ArgumentParser(description='SophiStudio 飞书后台启动管理')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--serve', action='store_true', help='由 macOS 管理后台进程')
    mode.add_argument('--install-login', action='store_true', help='开启登录自动启动')
    mode.add_argument('--disable-login', action='store_true', help='关闭登录自动启动')
    args = parser.parse_args()
    try:
        if args.serve:
            serve()
        elif args.install_login:
            install_login()
        elif args.disable_login:
            disable_login()
        else:
            ensure_running()
            subprocess.run(['/usr/bin/open', '-a', 'Microsoft Edge', URL], check=True)
            print('后台已就绪，已在 Edge 打开飞书同步页面。可以关闭此终端窗口。')
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f'启动管理失败：{error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
