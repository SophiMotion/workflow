"""飞书只读客户端；bounded retries, pagination and renewable tenant token."""
import json
import http.client
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request


class FeishuError(RuntimeError):
    pass


class DownloadRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlparse(newurl).scheme != 'https':
            raise FeishuError('已拒绝非 HTTPS 的飞书下载重定向')
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected and urllib.parse.urlparse(req.full_url).netloc != urllib.parse.urlparse(newurl).netloc:
            redirected.remove_header('Authorization')
        return redirected


class FeishuClient:
    BASE = 'https://open.feishu.cn/open-apis'

    def __init__(self, app_id, secret):
        self.app_id, self.secret = app_id, secret
        self.token, self.expires = '', 0
        self.lock = threading.RLock()
        self.last_request = 0
        self.opener = urllib.request.build_opener(DownloadRedirect())

    def redact(self, text):
        for secret in (self.secret, self.token):
            if secret:
                text = text.replace(secret, '[redacted]')
        return text

    @property
    def configured(self):
        return bool(re.fullmatch(r'cli_[A-Za-z0-9]+', self.app_id) and self.secret
                    and not any(x in self.secret.lower() for x in ('your_', 'placeholder', '请填写')))

    def _open(self, method, path, params=None, body=None, token='', binary=False):
        query = urllib.parse.urlencode({k: v for k, v in (params or {}).items() if v is not None})
        url = self.BASE + path + ('?' + query if query else '')
        headers = {'User-Agent': 'SophiStudio-Feishu/1.0', 'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                         headers=headers, method=method)
        for attempt in range(4):
            time.sleep(max(0, .22 - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                with self.opener.open(request, timeout=40) as response:
                    if binary:
                        content = response.read(100 * 1024 * 1024 + 1)
                        if len(content) > 100 * 1024 * 1024:
                            raise FeishuError('单个素材超过 100 MB，未下载')
                        return content, response.headers.get('Content-Type', 'application/octet-stream')
                    data = json.load(response)
                if data.get('code', 0) == 0:
                    return data
                code = data.get('code')
                if code in (99991400, 99991401) and attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                if code in (99991663, 99991668):
                    self.expires = 0
                message = self.redact(str(data.get('msg', '未知错误')))[:600]
                hint = '请检查真实 App ID / App Secret，不能使用示例值。' if path.startswith('/auth/') else '请检查应用权限、发布状态和知识库成员权限。'
                raise FeishuError(f'飞书 {code}: {message}。{hint}')
            except urllib.error.HTTPError as error:
                if (error.code == 429 or error.code >= 500) and attempt < 3:
                    retry = error.headers.get('Retry-After', '')
                    time.sleep(min(30, int(retry) if retry.isdigit() else 2 ** attempt))
                    continue
                try:
                    payload = json.loads(error.read(65536))
                    detail = self.redact(str(payload.get('msg', '')))[:1600]
                    detail = f'（{payload.get("code", error.code)}）{detail}'
                except (ValueError, OSError):
                    detail = ''
                raise FeishuError(f'飞书 HTTP {error.code}{detail}：{path}。请检查权限或稍后重试。') from None
            except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as error:
                if attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise FeishuError(self.redact(f'飞书网络连接失败：{error}')[:500]) from None

    def access_token(self):
        with self.lock:
            if time.time() >= self.expires:
                if not self.configured:
                    raise FeishuError('尚未配置有效的 FEISHU_APP_ID / FEISHU_APP_SECRET，请替换示例占位值')
                data = self._open('POST', '/auth/v3/tenant_access_token/internal',
                                  body={'app_id': self.app_id, 'app_secret': self.secret})
                self.token = data['tenant_access_token']
                self.expires = time.time() + max(1, int(data.get('expire', 7200)) - 120)
            return self.token

    def get(self, path, params=None):
        with self.lock:
            for attempt in range(2):
                try:
                    return self._open('GET', path, params=params, token=self.access_token()).get('data', {})
                except FeishuError:
                    if self.expires or attempt:
                        raise

    def pages(self, path, params=None, key='items'):
        query = dict(params or {})
        query.setdefault('page_size', 50)
        result, seen = [], set()
        while True:
            data = self.get(path, query)
            result.extend(data.get(key) or [])
            if not data.get('has_more'):
                return result
            token = data.get('page_token')
            if not token or token in seen:
                raise FeishuError('飞书分页游标缺失或重复，已停止以防遗漏数据')
            seen.add(token)
            query['page_token'] = token

    def spaces(self):
        return self.pages('/wiki/v2/spaces')

    def space(self, space_id):
        return self.get('/wiki/v2/spaces/' + urllib.parse.quote(str(space_id), safe='')).get('space', {})

    def nodes(self, space_id, parent=''):
        return self.pages('/wiki/v2/spaces/' + urllib.parse.quote(str(space_id), safe='') + '/nodes',
                          {'parent_node_token': parent or None})

    def resolve_space(self, value):
        value = value.strip()
        if re.fullmatch(r'\d{1,30}', value):
            return self.space(value)
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.feishu.cn'):
            raise ValueError('请提供 https://企业.feishu.cn/wiki/… 链接或数字 space_id')
        match = re.search(r'/wiki/(?:space/)?([A-Za-z0-9]+)', parsed.path)
        if not match:
            raise ValueError('链接中没有找到知识库节点')
        token = match.group(1)
        if '/wiki/space/' in parsed.path and token.isdigit():
            return self.space(token)
        node = self.get('/wiki/v2/spaces/get_node', {'token': token, 'obj_type': 'wiki'}).get('node', {})
        return self.space(node['space_id'])

    def download(self, token, file=False):
        with self.lock:
            path = '/drive/v1/' + ('files/' if file else 'medias/') + urllib.parse.quote(token, safe='') + '/download'
            return self._open('GET', path, token=self.access_token(), binary=True)
