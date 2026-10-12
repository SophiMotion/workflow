"""Model settings; secret values remain in backend files and child environment."""
import os
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, build_opener, HTTPRedirectHandler
from feishu.storage import PROJECT, atomic_write, read_env, read_json, write_json, digest

DEFAULTS = {'OPENAI_MODEL': 'gpt-5.4', 'DEEPSEEK_MODEL': 'deepseek-v4-pro'}
KEYS = ('OPENAI_API_KEY', 'DEEPSEEK_API_KEY')


def usable(value):
    return bool(value and not re.search(r'your_|placeholder|example|replace_me|changeme', value, re.I))


class AIConfig:
    def __init__(self, project=PROJECT, harness_home=None):
        self.project = Path(project)
        self.harness_home = Path(harness_home) if harness_home else Path.home() / '.dsh'
        self.path = self.project / 'config/feishu-ai.env'
        self.check_file = self.project / 'feishu/.state/ai-check.json'

    def values(self):
        values, origins = dict(DEFAULTS), {}
        # Only these two scalar credential references are imported. No profile/code is loaded.
        credential_file = self.harness_home / '.credentials.yaml'
        if credential_file.is_file():
            for line in credential_file.read_text(encoding='utf-8').splitlines():
                match = re.fullmatch(r'  (OPENAI_API_KEY|DEEPSEEK_API_KEY):\s*([\x21-\x7e]+)\s*', line)
                if match:
                    key, value = match.groups()
                    value = value.strip('"\'')
                    if usable(value):
                        values[key], origins[key] = value, '现有 DeepSeek Harness 配置'
        for path, origin in [((self.project.parent.parent if self.project.name == 'workflow' else self.project.parent) / '.env', '2026 项目配置'),
                             (self.project / '.env', '项目配置'), (self.path, '此页面的模型配置')]:
            for key, value in read_env(path).items():
                if key in (*KEYS, *DEFAULTS) and usable(value):
                    values[key], origins[key] = value, origin
        for key in (*KEYS, *DEFAULTS):
            if usable(os.environ.get(key)):
                values[key], origins[key] = os.environ[key], '后台环境变量'
        return values, origins

    def public(self):
        values, origins = self.values()
        check = read_json(self.check_file, {})
        if check.get('fingerprint') != self.fingerprint(values):
            check = {}
        return {'openai_model': values['OPENAI_MODEL'], 'deepseek_model': values['DEEPSEEK_MODEL'],
                'openai_configured': bool(values.get(KEYS[0])), 'deepseek_configured': bool(values.get(KEYS[1])),
                'openai_source': origins.get(KEYS[0], ''), 'deepseek_source': origins.get(KEYS[1], ''),
                'runtime': 'DeepSeek Harness · LLM 核心组件', 'checks': check.get('providers', []),
                'endpoints': ['https://api.openai.com/v1/responses', 'https://api.deepseek.com']}

    @staticmethod
    def fingerprint(values):
        return digest(json.dumps({key:values.get(key) for key in (*KEYS,*DEFAULTS)},sort_keys=True))

    def check(self):
        values, _ = self.values()
        class NoRedirect(HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        def probe(provider, base, key, model):
            result = {'provider':provider, 'model':model, 'ok':False}
            if not values.get(key):
                return {**result, 'message':'尚未填写 API Key'}
            try:
                request = Request(base + '/models',headers={'Authorization':'Bearer ' + values[key]})
                with build_opener(NoRedirect()).open(request,timeout=20) as response:
                    data = json.load(response)
                available = model in [entry.get('id') for entry in data.get('data',[])]
                return {**result, 'ok':True, 'message':'官方接口认证通过；' + ('所选模型在可用列表中。' if available else '所选模型未列出，实际可用性以回答结果为准。')}
            except HTTPError as error:
                return {**result, 'http':error.code, 'message':f'HTTP {error.code}：' + ('密钥无效或已失效，请更换 API Key。' if error.code == 401 else '官方接口拒绝请求，请检查账户、权限、额度或地区。')}
            except Exception:
                return {**result, 'message':'无法连接官方接口，请检查网络后重试。'}
        specs = [('openai','https://api.openai.com/v1','OPENAI_API_KEY',values['OPENAI_MODEL']),
                 ('deepseek','https://api.deepseek.com','DEEPSEEK_API_KEY',values['DEEPSEEK_MODEL'])]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda args:probe(*args),specs))
        write_json(self.check_file, {'at':time.time(),'fingerprint':self.fingerprint(values),'providers':results})
        return {'checks':results}

    def save(self, body):
        saved = read_env(self.path)
        for field, key in [('openai_model', 'OPENAI_MODEL'), ('deepseek_model', 'DEEPSEEK_MODEL')]:
            value = body.get(field, DEFAULTS[key])
            if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9._:-]{1,100}', value):
                raise ValueError('模型名称格式不正确')
            saved[key] = value
        for field, key in [('openai_key', KEYS[0]), ('deepseek_key', KEYS[1])]:
            value = body.get(field, '')
            if not isinstance(value, str) or (value and not re.fullmatch(r'[A-Za-z0-9_.-]{15,512}', value.strip())):
                raise ValueError('API Key 格式不正确')
            if value.strip():
                saved[key] = value.strip()
        atomic_write(self.path, ''.join(f'{key}={saved[key]}\n' for key in (*KEYS, *DEFAULTS) if key in saved))
        return self.public()

    def ready(self):
        values, _ = self.values()
        missing = [key for key in KEYS if not values.get(key)]
        if missing:
            raise ValueError('请先在“模型设置”填写 ' + ' / '.join(missing))
        return values

    def redact(self, value):
        values, _ = self.values()
        for key in KEYS:
            if values.get(key):
                value = value.replace(values[key], '[已隐藏密钥]')
        return re.sub(r'sk-[A-Za-z0-9_-]+', '[已隐藏密钥]', value)[:800]
