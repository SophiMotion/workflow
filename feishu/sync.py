"""版本化单向拉取；baseline + working file + incoming content, never silent overwrite."""
import copy
import difflib
import json
import time
import uuid
from pathlib import Path

from .storage import atomic_write, digest, read_json, safe_path, segment, write_json

COUNTERS = ('added', 'updated', 'unchanged', 'local', 'conflict', 'missing', 'error', 'warning')


class SyncEngine:
    def __init__(self, root, client, exporter, *, vault):
        self.root = Path(root).resolve()
        self.vault = Path(vault)
        self.state = self.root / '.state'
        if self.vault.is_symlink() or self.state.is_symlink():
            raise ValueError('同步目录和版本目录不能是符号链接')
        self.vault.mkdir(parents=True, exist_ok=True)
        self.client, self.exporter = client, exporter
        self.manifest = read_json(self.state / 'manifest.json', {'documents': {}, 'initialized': False})
        self.history = read_json(self.state / 'history.json', [])

    def save(self):
        write_json(self.state / 'manifest.json', self.manifest)

    def snapshot(self, content):
        sha = digest(content)
        path = safe_path(self.state / 'objects', sha + '.md')
        if not path.exists():
            atomic_write(path, content)
        return sha

    def content(self, sha):
        return safe_path(self.state / 'objects', sha + '.md').read_text(encoding='utf-8') if sha else ''

    def _record(self, result, event, key='', title='', **extra):
        result['counts'][event] += 1
        result['changes'].append({'event': event, 'key': key, 'title': title, **extra})

    def run(self, spaces=None, progress=None, force=False):
        result = {'id': uuid.uuid4().hex, 'started_at': time.time(), 'counts': dict.fromkeys(COUNTERS, 0), 'changes': []}
        success_spaces = []
        try:
            selected = self.client.spaces() if spaces is None else spaces
            if not selected:
                raise ValueError('没有可访问的知识库。请将应用/机器人添加为知识库成员，或在配置中添加 space_id。')
            for space in selected:
                sid = str(space['space_id'])
                directory = Path(segment(space.get('name', sid), sid))
                seen, ordered = set(), []
                stack = [('', directory, 0)]
                try:
                    # Enumerate the entire space before inferring any remote disappearances.
                    while stack:
                        parent, folder, depth = stack.pop()
                        if depth > 60:
                            raise ValueError('知识库层级超过安全限制（60 层）')
                        for node in self.client.nodes(sid, parent):
                            token = node['node_token']
                            if token in seen:
                                raise ValueError('知识库节点重复，已停止此知识库以避免遗漏')
                            seen.add(token)
                            sub = folder / segment(node.get('title', ''), token)
                            node.update(space_id=sid, space_name=space.get('name', sid))
                            ordered.append((node, str(sub / 'index.md')))
                            if node.get('has_child'):
                                stack.append((token, sub, depth + 1))
                            if progress:
                                progress({'phase': 'scanning', 'message': f'正在扫描 {space.get("name", sid)} · {len(seen)} 个节点'})
                    for index, (node, path) in enumerate(ordered):
                        if progress:
                            progress({'phase': 'downloading', 'message': node.get('title', ''),
                                      'current': index + 1, 'total': len(ordered), 'space': space.get('name', sid)})
                        try:
                            self._sync(node, path, result, force)
                        except Exception as error:
                            key = sid + ':' + node['node_token']
                            previous = self.manifest['documents'].get(key)
                            # Keep prior hashes and paths for retry after a permission/network failure.
                            self.manifest['documents'][key] = {**(previous or {}), 'key': key,
                                'title': node.get('title', ''), 'space_id': sid, 'space_name': space.get('name', sid),
                                'status': 'error', 'error': str(error)[:1000], 'type': node.get('obj_type', '')}
                            self._record(result, 'error', key, node.get('title', ''), message=str(error)[:1000])
                            self.save()
                    for key, old in list(self.manifest['documents'].items()):
                        if old.get('space_id') == sid and key.split(':', 1)[1] not in seen:
                            self.manifest['documents'][key] = {**old, 'status': 'missing', 'error': ''}
                            self._record(result, 'missing', key, old.get('title', ''), message='云端不可见，本地文件已保留（可能删除或权限变化）')
                    if not ordered or any(d.get('base') and d.get('space_id') == sid for d in self.manifest['documents'].values()):
                        success_spaces.append(sid)
                except Exception as error:
                    self._record(result, 'error', title=space.get('name', sid), message=str(error)[:1000])
            self.manifest['initialized'] = bool(self.manifest.get('initialized') or success_spaces)
        except Exception as error:
            self._record(result, 'error', message=str(error)[:1000])
        result['finished_at'] = time.time()
        result['status'] = 'error' if result['counts']['error'] else ('attention' if any(result['counts'][k] for k in ('conflict', 'missing', 'warning')) else 'success')
        self.manifest['last_run'] = result['finished_at']
        self.save()
        self.history.insert(0, result)
        self.history = self.history[:100]
        write_json(self.state / 'history.json', self.history)
        return result

    def _sync(self, node, relative, result, force):
        key = node['space_id'] + ':' + node['node_token']
        old = self.manifest['documents'].get(key, {})
        path = safe_path(self.vault, relative)
        old_path = safe_path(self.vault, old.get('path', relative))
        local = old_path.read_bytes() if old_path.is_file() else None
        local_hash = digest(local) if local is not None else None
        base = old.get('base')
        if hasattr(self.exporter, 'revision'):
            node['revision_id'] = self.exporter.revision(node)
        fingerprint = digest(json.dumps({k: node.get(k) for k in
            ('title', 'obj_type', 'obj_token', 'obj_edit_time', 'parent_node_token', 'revision_id')}, sort_keys=True))
        unchanged = (not force and base and node.get('obj_edit_time') and old.get('fingerprint') == fingerprint
                     and old.get('path') == relative and not old.get('warnings') and not old.get('dynamic')
                     and node.get('obj_type') not in ('sheet', 'bitable') and old.get('status') != 'error')
        if unchanged:
            status = 'conflict' if old.get('pending') else ('unchanged' if local_hash == base else 'local')
            self.manifest['documents'][key] = {**old, 'status': status, 'error': ''}
            self._record(result, status, key, node.get('title', ''))
            self.save()
            return

        exported = self.exporter.export(node)
        source = 'https://feishu.cn/wiki/' + node['node_token']
        metadata = {'title': node.get('title', ''), 'feishu_space_id': node['space_id'],
                    'feishu_node_token': node['node_token'], 'feishu_object_type': node.get('obj_type', ''), 'source': source}
        content = '---\n' + '\n'.join(k + ': ' + json.dumps(v, ensure_ascii=False) for k, v in metadata.items()) + '\n---\n\n'
        content += '# ' + str(node.get('title', '未命名')).replace('\n', ' ') + '\n\n' + exported.content
        if exported.warnings:
            content += '\n\n> 导出提示：\n' + '\n'.join('> ' + w.replace('\n', ' ') for w in exported.warnings) + '\n'
        remote_hash = self.snapshot(content)
        # Every binary is content-addressed; a changed asset cannot overwrite an old version.
        for asset, data in exported.assets.items():
            target = safe_path(self.vault, str(Path(relative).parent / asset))
            if target.exists() and target.read_bytes() != data:
                raise ValueError('本地素材已有修改，已保留：' + str(target.relative_to(self.vault)))
            if not target.exists():
                atomic_write(target, data)
        next_doc = {'key': key, 'space_id': node['space_id'], 'space_name': node.get('space_name', ''),
                    'title': node.get('title', ''), 'type': node.get('obj_type', ''), 'path': relative,
                    'source': source, 'fingerprint': fingerprint, 'warnings': exported.warnings,
                    'dynamic': getattr(exported, 'dynamic', False), 'synced_at': time.time(),
                    'base': remote_hash, 'previous': base, 'error': ''}
        local_changed = (base is not None and local_hash != base) or (base is None and local is not None)
        remote_changed = base != remote_hash or old.get('path', relative) != relative
        if local_hash == remote_hash and old_path == path:
            next_doc['previous'] = old.get('previous') if base == remote_hash else base
            status = 'unchanged'
        elif local_changed and (remote_changed or old.get('pending')):
            pending = {**next_doc, 'content': remote_hash}
            self.manifest['documents'][key] = {**old, **{k: next_doc[k] for k in ('key', 'title', 'space_id', 'space_name', 'type')},
                                              'path': old.get('path', relative), 'status': 'conflict', 'pending': pending, 'error': ''}
            self._record(result, 'conflict', key, next_doc['title'], message='本地与飞书均有变化，等待选择版本')
            self.save()
            return
        elif local_changed:
            self.manifest['documents'][key] = {**old, 'status': 'local', 'error': ''}
            self._record(result, 'local', key, next_doc['title'])
            self.save()
            return
        else:
            # The new destination may be an unrelated local file after a rename.
            if path != old_path and path.exists() and path.read_bytes() != content.encode('utf-8'):
                raise ValueError('改名目标已有本地文件，未覆盖：' + relative)
            if local_hash != remote_hash or path != old_path:
                atomic_write(path, content)
            if old_path != path and old_path.exists():
                old_path.unlink()
            status = 'updated' if base else 'added'
        next_doc['status'] = status
        self.manifest['documents'][key] = next_doc
        self._record(result, status, key, next_doc['title'], before=base, after=remote_hash)
        if exported.warnings:
            self._record(result, 'warning', key, next_doc['title'], message='；'.join(exported.warnings))
        self.save()

    def diff(self, key):
        doc = self.manifest['documents'][key]
        local_path = safe_path(self.vault, doc['path']) if doc.get('path') else None
        local = local_path.read_text(encoding='utf-8', errors='replace') if local_path and local_path.is_file() else ''
        pending = doc.get('pending')
        remote = self.content(pending['content'] if pending else doc.get('base'))
        before = local if pending or doc.get('status') == 'local' else self.content(doc.get('previous'))
        return {'key': key, 'title': doc['title'], 'local': local, 'remote': remote,
                'status': doc['status'], 'local_hash': digest(local),
                'diff': ''.join(difflib.unified_diff(before.splitlines(True), remote.splitlines(True),
                                                    fromfile='local' if pending else 'previous', tofile='feishu'))}

    def resolve(self, key, strategy, expected_hash=None):
        if strategy not in ('remote', 'local'):
            raise ValueError('未知冲突处理方式')
        doc = self.manifest['documents'][key]
        pending = copy.deepcopy(doc.get('pending'))
        if not pending:
            raise ValueError('该文档没有待处理冲突')
        old_path = safe_path(self.vault, doc['path'])
        local = old_path.read_bytes() if old_path.exists() else b''
        if expected_hash and digest(local) != expected_hash:
            raise ValueError('查看差异后本地文件又发生了变化，请刷新差异后再操作')
        # Save the working copy before any explicit resolution so either choice is recoverable.
        backup = self.snapshot(local)
        path = safe_path(self.vault, pending['path'])
        if path != old_path and path.exists():
            raise ValueError('目标路径已有文件，请先处理该文件')
        data = self.content(pending.pop('content')).encode('utf-8') if strategy == 'remote' else local
        if strategy == 'remote' or old_path.exists():
            atomic_write(path, data)
        if old_path != path and old_path.exists():
            old_path.unlink()
        pending['status'] = 'updated' if strategy == 'remote' else 'local'
        pending['local_backup'] = backup
        self.manifest['documents'][key] = pending
        self.save()
        write_json(self.state / 'resolutions' / (uuid.uuid4().hex + '.json'),
                   {'key': key, 'strategy': strategy, 'local_backup': backup, 'remote': pending['base'], 'at': time.time()})
        return pending
