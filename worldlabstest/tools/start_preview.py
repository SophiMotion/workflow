#!/usr/bin/env python3
"""Start the loopback campus viewer and open it in Microsoft Edge on macOS."""
import argparse
import http.client
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:8766/worldlabstestv2.html'


def ready():
    connection = http.client.HTTPConnection('127.0.0.1', 8766, timeout=2)
    try:
        connection.request('GET', '/worldlabstestv2.html')
        response = connection.getresponse()
        body = response.read(1024 * 1024)
        if response.status == 200 and body == (ROOT / 'worldlabstestv2.html').read_bytes():
            return True
        raise RuntimeError('8766 端口被其他页面占用；请先确认对应服务，启动器不会关闭其他进程。')
    except (ConnectionRefusedError, TimeoutError, ConnectionResetError, http.client.RemoteDisconnected):
        return False
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true', help='Only ensure the server is running')
    args = parser.parse_args()
    if not ready():
        log_path = ROOT / 'runs' / 'preview-server.log'
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open('ab', buffering=0) as log:
            process = subprocess.Popen(
                [sys.executable, str(ROOT / 'tools/worldlabs_server.py'), '--no-api', '--port', '8766'],
                cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        for _ in range(40):
            if ready():
                break
            if process.poll() is not None:
                raise RuntimeError('预览服务未能启动，请查看 runs/preview-server.log。')
            time.sleep(.2)
        else:
            raise RuntimeError('预览服务未在预期时间内就绪，请查看 runs/preview-server.log。')
    print('校园预览已就绪：' + URL)
    print('本地查看模式，无需 API 密钥；关闭此终端不会停止后台预览服务。')
    if not args.no_browser:
        if sys.platform != 'darwin':
            print('请将上方地址复制到 Edge 地址栏。')
            return
        result = subprocess.run(['open', '-a', 'Microsoft Edge', URL], check=False)
        if result.returncode:
            raise RuntimeError('未能打开 Microsoft Edge，请手动打开浏览器并粘贴上方地址。')


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError) as exc:
        print('启动失败：' + str(exc), file=sys.stderr)
        sys.exit(1)
