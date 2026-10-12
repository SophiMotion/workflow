"""本机网页连接；CAD 操作仅由主线程执行 / Loopback transport, no CAD API in HTTP handlers."""
import json
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from .design_data import parse_design

PORT = 19876
ORIGINS = {'null', 'http://127.0.0.1:5173', 'http://localhost:5173',
           'http://127.0.0.1:4173', 'http://localhost:4173'}
MAX_BYTES = 4 * 1024 * 1024


class Bridge:
    def __init__(self, wake, port=PORT):
        self.wake = wake
        self.token = secrets.token_urlsafe(32)
        self.jobs = {}
        self.lock = threading.Lock()
        self.server = ThreadingHTTPServer(('127.0.0.1', port), self._handler())
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def accept(self, job_id, raw):
        if not isinstance(job_id, str) or len(job_id) != 36 or any(c not in '0123456789abcdef-' for c in job_id):
            raise ValueError('任务编号无效。')
        data = parse_design(raw)
        with self.lock:
            if job_id in self.jobs:
                return self.status_unlocked(job_id)
            if any(j['state'] in ('queued', 'building') for j in self.jobs.values()):
                raise RuntimeError('已有建模任务正在进行，请稍候。')
            # 只保留最近任务，避免长期运行积累内存 / Retain a bounded recent history.
            if len(self.jobs) >= 20:
                del self.jobs[next(iter(self.jobs))]
            self.jobs[job_id] = {'state': 'queued', 'data': data, 'created': time.time(), 'message': '设计已送达 Fusion，等待创建实体…'}
        try:
            # 发送返回值在部分 Fusion 版本中不可靠 / Completion is acknowledged by the main-thread callback.
            self.wake()
        except Exception as exc:
            self.finish(job_id, {'ok': False, 'error': str(exc)})
            raise
        return self.status(job_id)

    def take(self):
        with self.lock:
            for job_id, job in self.jobs.items():
                if job['state'] == 'queued':
                    job['state'] = 'building'
                    job['message'] = 'Fusion 正在生成月饼与三件模具…'
                    return job_id, job.pop('data')
        return None

    def finish(self, job_id, reply):
        with self.lock:
            job = self.jobs.get(job_id)
            if job:
                job.pop('data', None)
                job.update(reply, state='complete' if reply['ok'] else 'failed')

    def status_unlocked(self, job_id):
        job = self.jobs.get(job_id)
        if not job:
            raise KeyError('未找到建模任务。')
        return {'ok': True, 'jobId': job_id, **{k: v for k, v in job.items() if k != 'data'}}

    def status(self, job_id):
        with self.lock:
            return self.status_unlocked(job_id)

    def _handler(self):
        bridge = self

        class Handler(BaseHTTPRequestHandler):
            def setup(self):
                super().setup()
                self.connection.settimeout(10)

            def log_message(self, *_args):
                pass

            def allowed(self):
                host = self.headers.get('Host', '')
                return host == '127.0.0.1:{}'.format(bridge.server.server_port) and self.headers.get('Origin') in ORIGINS | {None}

            def respond(self, code, payload=None):
                body = json.dumps(payload or {}, ensure_ascii=False).encode('utf-8')
                self.send_response(code)
                origin = self.headers.get('Origin')
                if origin in ORIGINS:
                    self.send_header('Access-Control-Allow-Origin', origin)
                    self.send_header('Vary', 'Origin')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Mooncake-Token, X-Mooncake-Job')
                self.send_header('Access-Control-Allow-Private-Network', 'true')
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def authorized(self):
                if not self.allowed():
                    self.respond(403, {'ok': False, 'error': '此网页来源未获准连接。'})
                    return False
                if self.command != 'OPTIONS' and self.path != '/session' and not secrets.compare_digest(self.headers.get('X-Mooncake-Token', ''), bridge.token):
                    self.respond(403, {'ok': False, 'error': '本机连接已失效，请重新导入。'})
                    return False
                return True

            def do_OPTIONS(self):
                if self.authorized():
                    self.respond(200)

            def do_GET(self):
                if not self.authorized():
                    return
                if self.path == '/session':
                    self.respond(200, {'ok': True, 'service': 'mooncake.fusion', 'version': 1, 'token': bridge.token, 'pluginPath': str(Path(__file__).resolve().parent)})
                elif self.path.startswith('/jobs/'):
                    try:
                        self.respond(200, bridge.status(self.path[6:]))
                    except KeyError:
                        self.respond(404, {'ok': False, 'error': '未找到建模任务，请检查 Fusion。'})
                else:
                    self.respond(404, {'ok': False})

            def do_POST(self):
                if not self.authorized():
                    return
                if self.path != '/jobs':
                    return self.respond(404, {'ok': False})
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    return self.respond(415, {'ok': False, 'error': '需要 JSON 设计文件。'})
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                    if length <= 0 or length > MAX_BYTES:
                        return self.respond(413, {'ok': False, 'error': '设计文件需要小于 4 MB。'})
                    raw = self.rfile.read(length).decode('utf-8')
                    result = bridge.accept(self.headers.get('X-Mooncake-Job'), raw)
                    self.respond(202, result)
                except RuntimeError as exc:
                    self.respond(409, {'ok': False, 'error': str(exc)})
                except Exception as exc:
                    self.respond(400, {'ok': False, 'error': str(exc)})

        return Handler
