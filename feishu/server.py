#!/usr/bin/env python3
"""Local-only API and persistent scheduler. Run: python3 feishu/server.py"""
import argparse
import copy
import json
import mimetypes
import secrets
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from feishu.client import FeishuClient, FeishuError
from feishu.markdown import Exporter
from feishu.knowledge import KnowledgeBase
from feishu.consultation import Consultations
from feishu.storage import (PROJECT, DEFAULT_SETTINGS, atomic_write, credentials, read_json, safe_path,
                            save_credentials, validate_settings, write_json)
from feishu.sync import SyncEngine


class Service:
    def __init__(self, root=PROJECT / 'feishu', project=PROJECT):
        self.root, self.project = Path(root), Path(project)
        self.settings = {**DEFAULT_SETTINGS, **read_json(self.root / '.state/settings.json', {})}
        self.lock, self.stop = threading.RLock(), threading.Event()
        self.nonce = secrets.token_urlsafe(32)
        self.local_key = secrets.token_urlsafe(32)
        # Only file:// pages can load this file. It is never served over HTTP.
        atomic_write(self.root / 'local-connection.js', 'window.SOPHI_FEISHU_LOCAL_KEY = ' + json.dumps(self.local_key) + ';\n')
        self.client = FeishuClient(*credentials(self.project))
        # 正文与素材统一存入 online-vault；同步历史仍保留在本模块 .state。
        vault = safe_path(self.project, 'online-vault/feishu-vault')
        self.engine = SyncEngine(self.root, self.client, Exporter(self.client), vault=vault)
        self.knowledge = KnowledgeBase(self.root, vault=vault)
        self.consultations = Consultations(self.root, self.project, self.knowledge, lambda: dict(self.engine.manifest['documents']))
        self.running = False
        self.connection = None
        self.progress = {'phase': 'idle', 'message': '等待初始化'}
        self.next_run = time.time() if self.settings['automation'] else None
        self.scheduler = threading.Thread(target=self._schedule, daemon=True, name='feishu-scheduler')
        self.scheduler.start()

    def _schedule(self):
        while not self.stop.wait(1):
            with self.lock:
                due = self.settings['automation'] and not self.running and self.next_run is not None and time.time() >= self.next_run
            if due:
                try:
                    self.start()
                except ValueError as error:
                    with self.lock:
                        self.progress = {'phase': 'error', 'message': str(error)}
                        self.next_run = time.time() + self.settings['interval']

    def _update(self, value):
        with self.lock:
            self.progress = value

    def start(self, initialize=False):
        with self.lock:
            if self.running:
                raise ValueError('已有同步任务正在运行')
            if not self.client.configured:
                raise ValueError('请先配置飞书 App ID 和 App Secret')
            if not self.settings['all_spaces'] and not self.settings['spaces']:
                raise ValueError('请先添加知识库')
            self.running = True
            self.progress = {'phase': 'starting', 'message': '初始化下载' if initialize else '检查飞书更新'}
            scope = None if self.settings['all_spaces'] else copy.deepcopy(self.settings['spaces'])
            worker = threading.Thread(target=self._run, args=(scope, initialize), daemon=True, name='feishu-sync')
            worker.start()
            return {'accepted': True}

    def _run(self, scope, initialize):
        try:
            result = self.engine.run(scope, self._update, force=initialize)
            self._update({'phase': result['status'], 'message': '本轮同步结束', 'counts': result['counts']})
        except Exception as error:
            self._update({'phase': 'error', 'message': self.client.redact(str(error))[:1000]})
        finally:
            with self.lock:
                self.running = False
                self.next_run = time.time() + self.settings['interval'] if self.settings['automation'] else None

    def configure(self, body):
        with self.lock:
            if self.running:
                raise ValueError('同步运行中，请等待完成后修改配置')
            clean = validate_settings(body)
            if body.get('app_secret'):
                save_credentials(str(body.get('app_id', '')).strip(), str(body['app_secret']).strip(), self.project)
            has_scope = clean['all_spaces'] or bool(clean['spaces'])
            self.settings = {**clean, 'automation': self.settings['automation'] and has_scope}
            write_json(self.root / '.state/settings.json', self.settings)
            self.client = FeishuClient(*credentials(self.project))
            self.engine.client, self.engine.exporter = self.client, Exporter(self.client)
            self.connection = None
            self.next_run = time.time() + self.settings['interval'] if self.settings['automation'] else None
            return {'saved': True}

    def automation(self, enabled):
        if not isinstance(enabled, bool):
            raise ValueError('自动化开关格式错误')
        with self.lock:
            if enabled and not self.settings['all_spaces'] and not self.settings['spaces']:
                raise ValueError('请先添加知识库 ID，再开启自动化')
            if enabled and not self.engine.manifest.get('initialized'):
                raise ValueError('请先完成一次初始化下载，再开启自动化')
            self.settings['automation'] = enabled
            write_json(self.root / '.state/settings.json', self.settings)
            self.next_run = time.time() if enabled and not self.running else None
            return {'automation': enabled}

    def status(self):
        with self.lock:
            docs = list(self.engine.manifest['documents'].values())
            return {'service': 'sophistudio-feishu', 'nonce': self.nonce, 'running': self.running,
                    'configured': self.client.configured, 'app_id': self.client.app_id if self.client.configured else '',
                    'settings': copy.deepcopy(self.settings), 'progress': copy.deepcopy(self.progress),
                    'connection': self.connection, 'next_run': self.next_run,
                    'initialized': self.engine.manifest.get('initialized', False), 'output': str(self.engine.vault),
                    'last_run': self.engine.manifest.get('last_run'),
                    'counts': {'documents': sum(bool(d.get('base')) for d in docs),
                               'conflicts': sum(d.get('status') == 'conflict' for d in docs),
                               'errors': sum(d.get('status') == 'error' for d in docs),
                               'warnings': sum(bool(d.get('warnings')) for d in docs),
                               'spaces': len(set(d.get('space_id') for d in docs))}}

    def check_connection(self):
        with self.lock:
            if self.running:
                raise ValueError('同步运行中，请稍后检查连接')
            client = self.client
            configured = copy.deepcopy(self.settings['spaces'])
            all_spaces = self.settings['all_spaces']
        # Discovery can omit a space that is readable by its explicit ID.
        spaces, discovery_error, checks = [], '', []
        try:
            spaces = client.spaces()
        except FeishuError as error:
            discovery_error = client.redact(str(error))
        for item in configured:
            sid = str(item['space_id'])
            check = {'space_id': sid, 'name': item.get('name') or sid}
            try:
                space = client.space(sid)
                check['name'] = space.get('name') or check['name']
                # Metadata alone does not establish permission to read the directory.
                client.get('/wiki/v2/spaces/' + sid + '/nodes', {'page_size': 1})
                check.update(ok=True, message='ID 已识别，目录读取检查通过；正文和附件权限将在同步时检查。')
            except FeishuError as error:
                detail = client.redact(str(error))
                hint = ('应用尚无此知识库的读取权限，请在飞书中授予应用/机器人知识库成员权限。'
                        if 'wiki space permission denied' in detail else '读取检查失败，请查看飞书返回的原因。')
                check.update(ok=False, message=hint, error=detail)
            checks.append(check)
        passed = sum(check['ok'] for check in checks)
        parts = [f'自动发现 {len(spaces)} 个知识库。' if not discovery_error else '自动发现失败：' + discovery_error]
        if checks:
            parts.append(f'已添加的 {len(checks)} 个 ID 中，{passed} 个目录读取检查通过，{len(checks) - passed} 个检查失败。')
        discovered = {str(space['space_id']) for space in spaces}
        omitted = any(check['ok'] and check['space_id'] not in discovered for check in checks)
        if all_spaces and omitted:
            parts.append('当前“全部同步”只使用自动发现列表。要同步已添加的 ID，请取消勾选“同步应用有权限访问的全部知识库”并保存。')
        elif not spaces and not checks:
            parts.append('尚未找到同步目标。可先添加知识库 ID 再检查；应用需要具备该知识库的成员访问权限。')
        attention = bool(discovery_error or passed < len(checks) or (all_spaces and (omitted or not spaces))
                         or (not all_spaces and not checks))
        result = {'spaces': spaces, 'checks': checks, 'discovery_error': discovery_error,
                  'needs_attention': attention, 'message': '\n'.join(parts)}
        with self.lock:
            if self.client is client:
                self.connection = {'ok': not attention, 'spaces': len(spaces), 'checks': checks, 'at': time.time()}
        return result


class Handler(BaseHTTPRequestHandler):
    server_version = 'SophiStudioFeishu/1.0'

    @property
    def service(self):
        return self.server.service

    def log_message(self, format, *args):
        # Avoid request bodies, secrets or document names in server logs.
        if args and isinstance(args[0], str) and '/api/' not in args[0]:
            super().log_message(format, *args)

    def origin_allowed(self):
        origin = self.headers.get('Origin')
        port = self.server.server_address[1]
        return origin in (None, 'null', f'http://127.0.0.1:{port}', f'http://localhost:{port}')

    def host_allowed(self):
        port = self.server.server_address[1]
        return self.headers.get('Host') in (f'127.0.0.1:{port}', f'localhost:{port}')

    def send(self, code, body, mime='application/json; charset=utf-8', filename=None, location=None):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if location:
            self.send_header('Location', location)
        if filename:
            self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(filename, safe=''))
        if self.origin_allowed() and self.headers.get('Origin'):
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Feishu-Client, X-Feishu-Nonce, X-Feishu-Local-Key')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.send(204 if self.origin_allowed() and self.host_allowed() else 403, b'')

    def api_guard(self, write=False):
        if not self.host_allowed() or not self.origin_allowed():
            self.send(403, {'error': '仅允许本机 SophiStudio 页面访问'})
            return False
        if self.headers.get('X-Feishu-Client') != 'sophistudio':
            self.send(403, {'error': '缺少本机客户端标识'})
            return False
        if self.headers.get('Origin') == 'null' and not secrets.compare_digest(self.headers.get('X-Feishu-Local-Key', ''), self.service.local_key):
            self.send(403, {'error': '需要本地页面连接密钥，请刷新 feishu.html'})
            return False
        if write and not secrets.compare_digest(self.headers.get('X-Feishu-Nonce', ''), self.service.nonce):
            self.send(403, {'error': '服务会话已变化，请刷新页面'})
            return False
        return True

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if any(part in ('.', '..') for part in path.split('/')):
            return self.send(404, {'error': '文件未公开'})
        if path.startswith('/api/'):
            if not self.api_guard():
                return
            try:
                query = parse_qs(parsed.query)
                if path == '/api/status':
                    return self.send(200, self.service.status())
                if path == '/api/documents':
                    docs = list(self.service.engine.manifest['documents'].values())
                    return self.send(200, {'documents': [{k: v for k, v in d.items() if k not in ('pending', 'fingerprint')} for d in docs]})
                if path == '/api/history':
                    return self.send(200, {'history': self.service.engine.history[:30]})
                if path == '/api/diff':
                    return self.send(200, self.service.engine.diff(query.get('key', [''])[0]))
                if path == '/api/document':
                    return self.send(200, self.service.knowledge.document(self.service.engine.manifest['documents'], query.get('key', [''])[0]))
                if path == '/api/asset':
                    asset = self.service.knowledge.asset(self.service.engine.manifest['documents'], query.get('key', [''])[0], query.get('path', [''])[0])
                    return self.send(200, asset.read_bytes(), 'application/octet-stream', filename=asset.name)
                if path == '/api/search':
                    sources = self.service.knowledge.search(self.service.engine.manifest['documents'], query.get('q', [''])[0][:2000], query.get('space', []))
                    return self.send(200, {'sources': sources})
                if path == '/api/ai/config':
                    return self.send(200, self.service.consultations.config.public())
                if path == '/api/qa/history':
                    return self.send(200, self.service.consultations.history())
                if path == '/api/qa/job':
                    return self.send(200, self.service.consultations.get(query.get('id', [''])[0]))
                return self.send(404, {'error': '接口不存在'})
            except (KeyError, ValueError, OSError) as error:
                return self.send(400, {'error': str(error)[:1000]})
        if not self.host_allowed():
            return self.send(403, {'error': 'Host 不允许'})
        if path in ('/', '/feishu.html', '/feishu', '/feishu/'):
            return self.send(302, b'', location='/feishu/feishu.html')
        # Explicit public file allowlist: never expose credentials, snapshots or downloaded docs.
        static = {'/feishu/feishu.html': 'feishu/feishu.html', '/index.html': 'index.html',
                  '/feishu/app.js': 'feishu/app.js', '/feishu/style.css': 'feishu/style.css',
                  '/feishu/knowledge.js': 'feishu/knowledge.js',
                  '/feishu/vendor/marked.umd.js': 'feishu/vendor/marked.umd.js',
                  '/feishu/vendor/purify.min.js': 'feishu/vendor/purify.min.js'}
        allowed = static.get(path)
        if not allowed and path.startswith(('/unit/js/', '/unit/css/', '/assets/')) and Path(path).suffix in ('.js', '.css', '.png', '.svg'):
            allowed = path.lstrip('/')
        if not allowed:
            return self.send(404, {'error': '文件未公开'})
        try:
            file = safe_path(self.service.project, allowed)
            self.send(200, file.read_bytes(), mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        except (OSError, ValueError):
            self.send(404, {'error': '文件不存在'})

    def do_POST(self):
        if not self.api_guard(write=True):
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 <= length <= 128 * 1024:
                return self.send(413, {'error': '请求内容过大'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.send(415, {'error': '仅支持 JSON 请求'})
            body = json.loads(self.rfile.read(length) or '{}')
            if not isinstance(body, dict):
                raise ValueError('请求内容必须为 JSON 对象')
            path = urlparse(self.path).path
            if path == '/api/config':
                result = self.service.configure(body)
            elif path in ('/api/initialize', '/api/sync'):
                result = self.service.start(path == '/api/initialize')
            elif path == '/api/automation':
                result = self.service.automation(body.get('enabled'))
            elif path == '/api/check':
                result = self.service.check_connection()
            elif path == '/api/ai/config':
                with self.service.consultations.lock:
                    if self.service.consultations.active:
                        raise ValueError('请等待本次问答结束后修改模型配置')
                    result = self.service.consultations.config.save(body)
            elif path == '/api/qa/ask':
                result = self.service.consultations.start(body)
            elif path == '/api/ai/check':
                result = self.service.consultations.config.check()
            elif path == '/api/qa/cancel':
                result = self.service.consultations.cancel(body.get('id'))
            elif path == '/api/resolve-space':
                if self.service.running:
                    raise ValueError('同步运行中，请稍后解析知识库')
                result = {'space': self.service.client.resolve_space(str(body.get('value', '')))}
            elif path == '/api/resolve':
                with self.service.lock:
                    if self.service.running:
                        raise ValueError('同步运行中，请等待完成后处理冲突')
                    if not isinstance(body.get('local_hash'), str):
                        raise ValueError('请先查看最新差异')
                    result = self.service.engine.resolve(body['key'], body['strategy'], body['local_hash'])
            else:
                return self.send(404, {'error': '接口不存在'})
            self.send(200, result)
        except FeishuError as error:
            self.service.connection = {'ok': False, 'error': str(error), 'at': time.time()}
            self.send(502, {'error': str(error)})
        except (ValueError, KeyError, TypeError, OSError) as error:
            self.send(400, {'error': self.service.client.redact(str(error))[:1000]})
        except Exception as error:
            self.send(500, {'error': self.service.client.redact(str(error))[:1000]})


def create_server(port=8769, service=None):
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    server.service = service or Service()
    return server


def main():
    parser = argparse.ArgumentParser(description='SophiStudio 飞书知识库本地同步服务')
    parser.add_argument('--port', type=int, default=8769)
    args = parser.parse_args()
    try:
        server = create_server(args.port)
    except OSError as error:
        print(f'服务启动失败：{error}。如服务已运行，请直接打开 http://127.0.0.1:{args.port}/feishu/feishu.html', file=sys.stderr)
        return 1
    print(f'SophiStudio 飞书同步：http://127.0.0.1:{args.port}/feishu/feishu.html', flush=True)
    print('关闭网页后同步继续；停止此进程会暂停同步。', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.service.stop.set()
        server.service.consultations.close()
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
