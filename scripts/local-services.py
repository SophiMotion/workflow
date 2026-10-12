#!/usr/bin/env python3
"""Install/remove local workflow services for the current macOS user."""
import argparse
import os
from pathlib import Path
import plistlib
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
AGENTS = Path.home() / 'Library/LaunchAgents'
LOGS = Path.home() / 'Library/Logs/SophiStudio'
DOMAIN = f'gui/{os.getuid()}'
SERVICES = (
    ('want', 'boss/boss-1/want/server.mjs', 8770, '/api/want/health', 'sophistudio-want'),
    ('aipm', 'online-vault/AIPM/scripts/serve.mjs', 4174, '/', 'AI 产品经理知识库'),
    ('drone', 'drone-formation/server.mjs', 4188, '/api/drone/health', 'sophistudio-drone'),
    ('skatechassis', '底盘机器人/server/index.mjs', 4173, '/api/skate/health', '"mode":"shared"'),
    ('feishu', 'feishu/server.py', 8769, '/feishu/feishu.html', '飞书知识库 · SophiStudio'),
    ('media', '../media/media/server.py', 8741, '/', 'sophi- media · 内容创作工作台'),
    ('sophirobot', 'SophiStudio-SophiRobot-Website/scripts/serve.cjs', 4189, '/', 'SophiStudio · SophiRobot'),
)
REQUIRED = {
    'want': ['boss/boss-1/want.html', 'boss/boss-1/want/public/app.js'],
    'aipm': ['online-vault/AIPM/site/index.html'],
    'drone': ['drone-formation/index.html', 'drone-formation/vendor/three.module.min.js'],
    'skatechassis': ['底盘机器人/dist/index.html', 'sophicar-formate/web/dist/index.html'],
    'feishu': ['feishu/feishu.html'],
    'media': ['../media/media/index.html', '../media/media/app.js', '../media/media/team-library.json'],
    'sophirobot': ['SophiStudio-SophiRobot-Website/dist/' + name
                   for name in ['index.html', 'bom.html', 'model.json']],
}
PYTHON_SERVICES = {'feishu', 'media'}
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def launchctl(*args, check=True):
    result = subprocess.run(['/bin/launchctl', *args], capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result


def owned_agent(file, name, relative):
    if not file.exists():
        return None
    value = plistlib.loads(file.read_bytes())
    args = value.get('ProgramArguments', [])
    allowed = {str((ROOT / relative).resolve())}
    if ROOT.name == 'workflow' and not relative.startswith('../'):
        allowed.add(str(ROOT.parent / relative))  # Same project's pre-migration path.
    if name == 'want':
        allowed.add(str(ROOT / 'want/server.mjs'))  # Migrate this project's former path.
    if (value.get('Label') != f'com.sophistudio.{name}' or len(args) != 2
            or str(Path(args[1]).resolve()) not in allowed):
        raise RuntimeError(f'同名登录项不属于此工具，已保留：{file}')
    return value


def node_executable():
    candidates = ['/opt/homebrew/bin/node', '/usr/local/bin/node', shutil.which('node'),
                  str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')]
    for candidate in candidates:
        if candidate and os.access(candidate, os.X_OK):
            version = subprocess.run([candidate, '-p', 'Number(process.versions.node.split(".")[0]) >= 18'],
                                     capture_output=True, text=True)
            if version.returncode == 0 and version.stdout.strip() == 'true':
                return candidate
    raise RuntimeError('找不到 Node.js 18 或更新版本。')


def python_executable():
    # Use the macOS application identity so Documents permission can be granted.
    app = Path(sys.prefix) / 'Resources/Python.app/Contents/MacOS/Python'
    candidates = [str(app), sys.executable, '/usr/bin/python3', shutil.which('python3')]
    for candidate in candidates:
        if candidate and os.access(candidate, os.X_OK):
            result = subprocess.run([candidate, '-c',
                                     'import sys; print(sys.version_info >= (3, 9))'],
                                    capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip() == 'True':
                return candidate
    raise RuntimeError('找不到 Python 3.9 或更新版本。')


def health(port, route, marker):
    try:
        with OPENER.open(f'http://127.0.0.1:{port}{route}', timeout=2) as response:
            return response.status == 200 and marker in response.read(65536).decode('utf-8')
    except (OSError, ValueError):
        return False


def running(target):
    result = launchctl('print', target, check=False)
    return result.returncode == 0 and re.search(r'^\s*state = running$', result.stdout, re.M)


def install():
    node = node_executable()
    python = python_executable()
    prepared = []
    # Check selected services before changing any login items. Never kill a port's owner.
    for name, relative, port, route, marker in SERVICES:
        label = f'com.sophistudio.{name}'
        target = f'{DOMAIN}/{label}'
        file = AGENTS / f'{label}.plist'
        previous = owned_agent(file, name, relative)
        script = (ROOT / relative).resolve()
        required = [script] + [ROOT / file for file in REQUIRED[name]]
        for asset in required:
            if not asset.is_file():
                raise RuntimeError(f'项目文件缺失：{asset}')
        with socket.socket() as probe:
            probe.settimeout(1)
            occupied = probe.connect_ex(('127.0.0.1', port)) == 0
        if occupied and not (previous and running(target) and health(port, route, marker)):
            raise RuntimeError(f'{port} 端口已被其他进程占用，未修改任何登录项。')
        value = {
            'Label': label,
            'ProgramArguments': [python if name in PYTHON_SERVICES else node, str(script)],
            'WorkingDirectory': str(script.parent),
            'EnvironmentVariables': {'NODE_ENV': 'production', 'PORT': str(port),
                                     'HOST': '127.0.0.1', 'PYTHONUNBUFFERED': '1',
                                     'PATH': os.pathsep.join([str(Path(node).parent),
                                             str(Path.home() / '.local/bin'),
                                             str(Path.home() / '.npm-global/bin'),
                                             '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'])},
            'RunAtLoad': True,
            'KeepAlive': True,
            'ThrottleInterval': 5,
            'ProcessType': 'Background',
            'LimitLoadToSessionType': 'Aqua',
            'StandardOutPath': str(LOGS / f'{name}.log'),
            'StandardErrorPath': str(LOGS / f'{name}.log'),
            'Umask': 0o077,
        }
        prepared.append((file, previous, value, target))

    AGENTS.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    for file, previous, value, target in prepared:
        loaded = launchctl('print', target, check=False).returncode == 0
        if loaded and previous != value:
            launchctl('bootout', target)
            loaded = False
        temporary = file.with_suffix('.plist.tmp')
        temporary.write_bytes(plistlib.dumps(value))
        temporary.chmod(0o600)
        temporary.replace(file)
        launchctl('enable', target)
        if not loaded:
            launchctl('bootstrap', DOMAIN, str(file))

    deadline = time.monotonic() + 25
    healthy_since = None
    while time.monotonic() < deadline:
        ready = all(running(f'{DOMAIN}/com.sophistudio.{name}') and health(port, route, marker)
                    for name, _, port, route, marker in SERVICES)
        if ready:
            healthy_since = healthy_since or time.monotonic()
            if time.monotonic() - healthy_since >= 3:
                print('已开启登录自动启动：' + '；'.join(f'{name} http://127.0.0.1:{port}/' for name, _, port, _, _ in SERVICES))
                print('以后直接打开 SophiStudio/index.html，无需保留终端窗口。')
                return
        else:
            healthy_since = None
        time.sleep(0.5)
    raise RuntimeError(f'登录项已保存，但后台尚未就绪。请查看 {LOGS} 中的日志。')


def disable():
    files = []
    for name, relative, _, _, _ in SERVICES:
        file = AGENTS / f'com.sophistudio.{name}.plist'
        if owned_agent(file, name, relative) is not None:
            files.append((file, f'{DOMAIN}/com.sophistudio.{name}'))
    for file, target in files:
        if launchctl('print', target, check=False).returncode == 0:
            launchctl('bootout', target)
        file.unlink()
    print('已关闭所选登录后台。项目文件、资料与日志均保留。')


def main():
    global SERVICES
    parser = argparse.ArgumentParser(description='SophiStudio 工作流后台自动启动')
    parser.add_argument('action', choices=['install', 'disable'])
    parser.add_argument('--only', choices=[s[0] for s in SERVICES], help='只操作一个模块，不重启其他后台')
    args = parser.parse_args()
    if args.only:
        SERVICES = tuple(s for s in SERVICES if s[0] == args.only)
    if sys.platform != 'darwin':
        parser.error('此工具仅用于 macOS。')
    try:
        (install if args.action == 'install' else disable)()
    except (OSError, ValueError, RuntimeError) as error:
        print(f'自动启动设置失败：{error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
