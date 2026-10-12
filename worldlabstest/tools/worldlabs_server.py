#!/usr/bin/env python3
"""Loopback static viewer + read-only World Labs broker. Key stays in process memory."""
import argparse
import getpass
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, unquote, quote
from urllib.request import Request, urlopen

BASE = 'https://api.worldlabs.ai/marble/v1'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--no-api', action='store_true', help='View/edit local assets without a credential')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    api_key = None if args.no_api else os.environ.get('WORLDLABS_API_KEY') or getpass.getpass('World Labs API key (hidden, memory only): ')

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(root), **kw)

        def log_message(self, fmt, *a):
            # Avoid logging query strings, share links or credentials.
            pass

        def reply(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def request_api(self, path, payload=None):
            if not api_key:
                self.reply(409, {'error': '本机服务未配置密钥。请重新启动 tools/worldlabs_server.py 并在隐藏提示中输入。'})
                return
            try:
                data = json.dumps(payload).encode() if payload is not None else None
                req = Request(BASE + path, data=data, headers={'WLT-Api-Key': api_key, 'Content-Type': 'application/json'})
                with urlopen(req, timeout=45) as response:
                    result = json.load(response)
                self.reply(200, result)
            except HTTPError as e:
                hints = {401: 'API 密钥无效', 403: '当前账号无权读取这个世界', 404: '未找到 API 世界；网页端世界请导出 SPZ 后导入', 429: 'API 查询频率受限，请稍后重试'}
                self.reply(e.code, {'error': hints.get(e.code, 'World API HTTP ' + str(e.code))})
            except (URLError, TimeoutError, OSError, ValueError):
                self.reply(502, {'error': 'World API 暂时无法连接，请稍后重试同一个只读查询。'})

        def do_GET(self):
            host = self.headers.get('Host', '')
            if host not in {f'127.0.0.1:{args.port}', f'localhost:{args.port}'}:
                self.reply(403, {'error': 'Loopback host required'})
                return
            path = unquote(urlparse(self.path).path)
            if path.startswith('/api/'):
                origin = self.headers.get('Origin')
                if origin and origin != 'http://' + host:
                    self.reply(403, {'error': 'Same-origin local requests only'})
                    return
                if self.headers.get('Sec-Fetch-Site') == 'cross-site':
                    self.reply(403, {'error': 'Cross-site requests are not accepted'})
                    return
                if path == '/api/status':
                    self.request_api('/credits')
                elif path == '/api/worlds':
                    self.request_api('/worlds:list', {'page_size': 100, 'sort_by': 'updated_at'})
                elif re.fullmatch(r'/api/worlds/[A-Za-z0-9_-]{1,150}', path):
                    self.request_api('/worlds/' + quote(path.rsplit('/', 1)[-1], safe=''))
                else:
                    self.reply(404, {'error': 'Read-only endpoint not found'})
                return
            if path == '/':
                self.path = '/worldlabstestv2.html'
                path = self.path
            target = (root / path.lstrip('/')).resolve()
            if root not in target.parents or any(p.startswith('.') for p in Path(path).parts if p != '/') or target.is_dir():
                self.reply(404, {'error': 'File not found'})
                return
            super().do_GET()

        def do_HEAD(self):
            # No directory listing or alternative route around the GET checks.
            self.reply(405, {'error': 'Use GET'})

        def do_POST(self):
            self.reply(405, {'error': 'This local broker is read-only; generation uses the explicit CLI workflow.'})

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Open http://127.0.0.1:{args.port}/worldlabstestv2.html', flush=True)
    print('World API: ' + ('ready (read-only)' if api_key else 'disabled'), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
