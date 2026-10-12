#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ProFabX · SophiCar 控制台 — 本地静态服务器 + Mock API 网关
================================================================
用途：
  1. 静态托管整个控制台（等价于 nginx / Vercel 静态部署）
  2. 提供 /api/dsh/* 与 /api/feishu/* 的 mock 实现，
     用于验证 js/config.js 切换 http 模式后的真实链路

用法：
  python3 server.py            # 默认 0.0.0.0:8000
  python3 server.py 3000       # 指定端口

切换前端到 http 模式（js/config.js）：
  dsh.mode = 'http'; dsh.apiBase = 'http://127.0.0.1:8000/api/dsh'
  feishu.mode = 'http'

接入真实 DeepSeek Harness 时：
  把 /api/dsh/* 的路由替换为对 DSH 网关的转发（或由 DSH Host
  直接暴露这些路径），前端无需任何改动。
"""
import json
import os
import sys
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


def load_demo_tasks():
    """从 js/data.js 提取演示任务（轻量解析，避免双份维护）"""
    try:
        path = os.path.join(ROOT, 'js', 'data.js')
        text = open(path, encoding='utf-8').read()
        start = text.index('tasks: [')
        end = text.index(']', start)
        # 将 JS 对象字面量近似转换为 JSON（演示数据均为双引号安全内容）
        body = text[start + len('tasks: ['):end]
        body = body.replace("'", '"')
        items = []
        for line in body.split('},'):
            line = line.strip().strip('{}').strip()
            if not line:
                continue
            kv = {}
            for part in line.split(','):
                part = part.strip()
                if ':' not in part:
                    continue
                k, v = part.split(':', 1)
                kv[k.strip().strip('"')] = v.strip().strip('"')
            if kv.get('id'):
                items.append(kv)
        return items
    except Exception:
        return []


TEAM_MEMBERS = [
    {"id": "wu-bo", "name": "吴波", "role": "商业与产品 · DRI", "time": "全职", "color": "av-blue"},
    {"id": "tong-yishan", "name": "佟怡姗", "role": "项目与交付 · DRI", "time": "全职", "color": "av-green"},
    {"id": "clement", "name": "Clement", "role": "结构与工程化", "time": "全职", "color": "av-red"},
    {"id": "jin-bangming", "name": "金邦明", "role": "软件与集成", "time": "≈50%", "color": "av-yellow"},
    {"id": "mu-shuaijie", "name": "慕帅杰", "role": "内部工作流", "time": "≈50%", "color": "av-purple"},
]


class Handler(BaseHTTPRequestHandler):
    server_version = 'PFXConsole/0.1'

    # ---------- 工具 ----------
    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()
        self.wfile.write(data)

    def _json(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return {}

    def do_OPTIONS(self):
        self._send(204, b'')

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/health':
            return self._send(200, {'ok': True, 'service': 'pfx-console', 'version': '0.1.0'})
        if path == '/api/feishu/users/me':
            return self._send(200, {'openId': 'mock-me', 'name': '吴波', 'role': '商业与产品 · DRI', 'avatarColor': 'av-blue'})
        if path == '/api/feishu/team/members':
            return self._send(200, TEAM_MEMBERS)
        if path == '/api/feishu/team/tasks':
            return self._send(200, load_demo_tasks() or [])
        return self._serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path
        body = self._json()

        if path.startswith('/api/dsh/'):
            return self._dsh(path, body)

        if path == '/api/auth/feishu/callback':
            return self._send(200, {'session': {
                'openId': 'ou_mock_' + str(body.get('code', ''))[-6:],
                'name': '吴波', 'role': '商业与产品 · DRI',
                'avatarColor': 'av-blue', 'tenant': 'ProFabX · SophiCar 团队',
                'feishuName': '吴波（飞书 OAuth 演示）'
            }})

        if path == '/api/feishu/notify':
            return self._send(200, {'status': 'ok', 'channel': '飞书群机器人（mock 网关）',
                                    'message': '已推送：' + str(body.get('text', ''))[:80]})

        return self._send(404, {'error': 'not found: ' + path})

    def _dsh(self, path, body):
        """DSH mock 网关：路径 /api/dsh/<capability>，与前端 dsh.js 一一对应"""
        cap = path[len('/api/dsh/'):]
        if cap == 'ai/chat':
            q = body.get('query', '')
            return self._send(200, {
                'answer': f'【mock 网关】已收到问题：「{q}」。接入 DSH 后由模型工具结合知识库实时回答。',
                'sources': [{'kind': '网关', 'title': 'server.py mock', 'score': 1.0}],
                'actions': [{'label': '查看客户漏斗', 'route': '#/sophimotion'}],
                'mock': True
            })
        if cap == 'workflow/run':
            return self._send(200, {
                'runId': 'gw-run-' + str(abs(hash(str(body))) % 100000),
                'workflowId': body.get('workflowId', 'linkage-pipeline'),
                'status': 'running',
                'steps': [
                    {'id': 's1', 'name': '需求雷达扫描（SophiGo）', 'status': 'done'},
                    {'id': 's2', 'name': '原型与报价（ProFabX）', 'status': 'running'},
                    {'id': 's3', 'name': '交付与验收（SophiMotion）', 'status': 'pending'}
                ],
                'note': 'mock 网关实现，接入 DSH 后由工作流编排服务执行'
            })
        if cap == 'quote/generate':
            return self._send(200, {
                'quoteId': 'GW-Q-' + str(abs(hash(str(body))) % 10000),
                'material': body.get('material', 'ABS-like'),
                'items': [{'file': 'demo.stl', 'format': 'STL', 'volumeCm3': 3.5, 'weightG': 2.0,
                           'process': body.get('process', 'SLA'), 'finish': body.get('finish', '打磨'),
                           'risk': '无', 'fee': 620}],
                'total': 620, 'currency': 'CNY', 'note': 'mock 网关报价'
            })
        if cap == 'automation/trigger':
            return self._send(200, {'jobId': 'gw-job', 'trigger': body.get('trigger', 'demo'),
                                    'channel': '飞书群机器人（mock 网关）', 'message': '已模拟触发', 'status': 'ok'})
        if cap == 'kb/search':
            return self._send(200, {
                'query': body.get('query', ''),
                'hits': [{'title': 'mock 网关知识条目', 'kind': '资料', 'score': 0.9,
                          'snippet': '接入 DSH 知识库后返回真实检索结果。'}],
                'mock': True
            })
        return self._send(404, {'error': 'unknown dsh capability: ' + cap})

    # ---------- 静态文件 ----------
    def _serve_static(self, path):
        if path == '/' or path == '':
            path = '/index.html'
        # 去掉可能的查询串（已在 do_GET 处理）；防目录穿越
        target = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
        if not target.startswith(ROOT) or not os.path.isfile(target):
            return self._send(404, {'error': 'not found'})
        ctype = mimetypes.guess_type(target)[0] or 'application/octet-stream'
        if target.endswith('.html'):
            ctype = 'text/html; charset=utf-8'
        if target.endswith('.js'):
            ctype = 'application/javascript; charset=utf-8'
        if target.endswith('.css'):
            ctype = 'text/css; charset=utf-8'
        with open(target, 'rb') as f:
            self._send(200, f.read(), ctype)

    def log_message(self, fmt, *args):
        sys.stderr.write('[pfx] %s\n' % (fmt % args))


if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'ProFabX · SophiCar 控制台已启动 → http://127.0.0.1:{PORT}/')
    print('Mock API 网关：/api/dsh/* 与 /api/feishu/*（切换 js/config.js 的 mode 为 http 即可联调）')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止')
