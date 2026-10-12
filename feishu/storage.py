"""本地文件及配置；atomic files and backend-only credentials."""
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
DEFAULT_SETTINGS = {'spaces': [], 'all_spaces': True, 'interval': 300, 'automation': False}


def digest(data):
    return hashlib.sha256(data if isinstance(data, bytes) else data.encode('utf-8')).hexdigest()


def safe_path(root, relative):
    if Path(root).is_symlink():
        raise ValueError('同步目录不能是符号链接')
    root = Path(root).resolve()
    candidate = root / relative
    if not candidate.resolve().is_relative_to(root) or candidate.is_symlink():
        raise ValueError('文件路径越界或使用了符号链接')
    # Reject all symlink components, including links that remain inside the root.
    if any(p.is_symlink() for p in [candidate, *candidate.parents] if p != root):
        raise ValueError('同步目录不能包含符号链接')
    return candidate


def atomic_write(path, data, mode=0o600):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.write-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data if isinstance(data, bytes) else data.encode('utf-8'))
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_json(path, default):
    if not Path(path).exists():
        return default
    # Corrupt state must fail visibly instead of replacing a trusted baseline.
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path, value):
    atomic_write(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def segment(title, identifier):
    clean = re.sub(r'[\x00-\x1f/\\:*?"<>|]', '-', str(title)).strip(' .')[:32] or '未命名'
    return clean + '--' + digest(str(identifier))[:12]


def read_env(path):
    values = {}
    if Path(path).is_file():
        for line in Path(path).read_text(encoding='utf-8').splitlines():
            line = line.strip().removeprefix('export ')
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"\'')
    return values


def credentials(project=PROJECT):
    values = {}
    studio = project.parent if project.name == 'workflow' else project
    for path in [studio.parent / '.env', studio / '.env', project / '.env', project / 'config/feishu.env']:
        values.update(read_env(path))
    values.update({k: v for k, v in os.environ.items() if k.startswith('FEISHU_')})
    return values.get('FEISHU_APP_ID', ''), values.get('FEISHU_APP_SECRET', '')


def save_credentials(app_id, secret, project=PROJECT):
    if not re.fullmatch(r'cli_[A-Za-z0-9]+', app_id):
        raise ValueError('App ID 应以 cli_ 开头，仅包含字母和数字')
    if not secret or len(secret) > 512 or re.search(r'[\s\x00\x22\x27]', secret):
        raise ValueError('App Secret 格式不正确')
    atomic_write(project / 'config/feishu.env', f'FEISHU_APP_ID={app_id}\nFEISHU_APP_SECRET={secret}\n')


def validate_settings(value):
    interval = value.get('interval', 300)
    if isinstance(interval, bool) or not isinstance(interval, int) or not 60 <= interval <= 86400:
        raise ValueError('同步间隔须为 60 至 86400 秒的整数')
    spaces = value.get('spaces', [])
    if not isinstance(spaces, list) or len(spaces) > 200:
        raise ValueError('知识库列表格式错误，最多支持 200 个')
    normalized, seen = [], set()
    for item in spaces:
        if not isinstance(item, dict) or not re.fullmatch(r'\d{1,30}', str(item.get('space_id', ''))):
            raise ValueError('知识库 space_id 必须为数字；知识库链接请先使用“解析链接”')
        sid = str(item['space_id'])
        if sid not in seen:
            normalized.append({'space_id': sid, 'name': str(item.get('name', sid))[:120]})
            seen.add(sid)
    all_spaces = value.get('all_spaces', True)
    if not isinstance(all_spaces, bool):
        raise ValueError('同步范围格式错误')
    return {'spaces': normalized, 'all_spaces': all_spaces, 'interval': interval}
