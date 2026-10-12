"""受保护的文档阅读与本地段落检索 / authenticated reading and local retrieval."""
import json
import re
import sqlite3
import threading
from collections import Counter
from pathlib import Path
from urllib.parse import quote, urlparse

from .storage import digest, safe_path

MAX_DOCUMENT = 4 * 1024 * 1024
STOP = set('the and for with from this that what how about into which can are was were please based knowledge advice'.split())
FILLER = re.compile(r'请问|请|给我|一些|基于|知识库|专业建议|建议|如何|怎么|什么|我们|一下|以及|是否|的|了|是|在|和|与')


def tokens(text):
    text = FILLER.sub(' ', str(text).lower())
    words = []
    for value in re.findall(r'[a-z0-9][a-z0-9_+-]+|[\u3400-\u9fff]+', text):
        if re.match(r'[\u3400-\u9fff]', value):
            words.extend(value[i:i + 2] for i in range(len(value) - 1))
        elif value not in STOP:
            words.append(value)
    return words


def chunks(content):
    lines = content.splitlines()
    start = 0
    if lines and lines[0].strip() == '---':
        for i in range(1, min(len(lines), 40)):
            if lines[i].strip() == '---':
                start = i + 1
                break
    while start < len(lines):
        end, size = start, 0
        while end < len(lines) and (end == start or size + len(lines[end]) < 1700):
            size += len(lines[end]) + 1
            end += 1
        text = '\n'.join(lines[start:end]).strip()
        # 超长行也需完整分段 / split long lines without silently dropping text.
        for offset in range(0, len(text), 1700):
            piece = text[offset:offset + 1700]
            if piece:
                yield start + 1, end, piece
        start = max(start + 1, end - 2) if end < len(lines) else end


class KnowledgeBase:
    def __init__(self, root, *, vault):
        self.root = Path(root)
        self.vault = Path(vault)
        self.db = self.root / '.state/knowledge.sqlite3'
        self.lock = threading.Lock()

    def _path(self, documents, key):
        doc = documents.get(key)
        if not doc or not doc.get('path') or not doc.get('base'):
            raise ValueError('此文档尚未下载，无法读取正文')
        path = safe_path(self.vault, doc['path'])
        if not path.is_file():
            raise ValueError('本地文档不存在，请重新同步')
        return doc, path

    def document(self, documents, key):
        doc, path = self._path(documents, key)
        if path.stat().st_size > MAX_DOCUMENT:
            raise ValueError('文档超过 4 MB 阅读上限，请在本地目录打开')
        content = path.read_text(encoding='utf-8')
        source = doc.get('source', '')
        parsed = urlparse(source)
        if parsed.scheme != 'https' or not (parsed.hostname == 'feishu.cn' or (parsed.hostname or '').endswith('.feishu.cn')):
            source = 'https://feishu.cn/wiki/' + quote(key.split(':')[-1], safe='')
        return {**{k: doc.get(k, '') for k in ('key', 'title', 'space_id', 'space_name', 'path', 'status')},
                'content': content, 'version': digest(content), 'warnings': doc.get('warnings', []),
                'source': source}

    def asset(self, documents, key, relative):
        _, path = self._path(documents, key)
        parts = Path(relative).parts
        if not parts or parts[0] != 'assets' or any(p in ('.', '..') for p in relative.split('/')) or '\\' in relative:
            raise ValueError('仅允许读取该文档 assets 目录中的附件')
        asset = safe_path(path.parent, relative)
        if not asset.is_file() or asset.stat().st_size > 100 * 1024 * 1024:
            raise ValueError('附件不存在或超过 100 MB 上限')
        return asset

    def _connect(self):
        safe_path(self.root, '.state/knowledge.sqlite3')
        self.db.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db)
        self.db.chmod(0o600)
        connection.row_factory = sqlite3.Row
        connection.executescript('''
            CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, signature TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY, key TEXT, title TEXT,
                space_id TEXT, space_name TEXT, line_start INTEGER, line_end INTEGER,
                text TEXT, version TEXT, warnings TEXT);
            CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(title_tokens, text_tokens);
        ''')
        return connection

    def _remove(self, db, key):
        db.execute('DELETE FROM search WHERE rowid IN (SELECT id FROM chunks WHERE key=?)', (key,))
        db.execute('DELETE FROM chunks WHERE key=?', (key,))
        db.execute('DELETE FROM documents WHERE key=?', (key,))

    def _update(self, db, documents):
        retained = set()
        existing = dict(db.execute('SELECT key, signature FROM documents'))
        for key, doc in list(documents.items()):
            if not doc.get('base') or doc.get('status') in ('missing', 'error'):
                continue
            try:
                _, path = self._path(documents, key)
                stat = path.stat()
                if stat.st_size > MAX_DOCUMENT:
                    continue
                signature = digest(json.dumps([stat.st_mtime_ns, stat.st_size, doc.get('title'),
                                               doc.get('space_id'), doc.get('warnings'), doc.get('path')]))
                retained.add(key)
                if existing.get(key) == signature:
                    continue
                content = path.read_text(encoding='utf-8')
                version = digest(content)
                self._remove(db, key)
                for first, last, text in chunks(content):
                    row = db.execute('INSERT INTO chunks(key,title,space_id,space_name,line_start,line_end,text,version,warnings) VALUES(?,?,?,?,?,?,?,?,?)',
                                     (key, doc['title'], doc['space_id'], doc.get('space_name', ''), first, last,
                                      text, version, json.dumps(doc.get('warnings', []), ensure_ascii=False)))
                    db.execute('INSERT INTO search(rowid,title_tokens,text_tokens) VALUES(?,?,?)',
                               (row.lastrowid, ' '.join(tokens(doc['title'])), ' '.join(tokens(text))))
                db.execute('INSERT INTO documents VALUES(?,?)', (key, signature))
            except (ValueError, OSError, UnicodeError):
                retained.discard(key)
        for key in set(existing) - retained:
            self._remove(db, key)

    def search(self, documents, query, space_ids, limit=10):
        terms = list(dict.fromkeys(tokens(query)))[:48]
        if not terms:
            return []
        if not isinstance(space_ids, list) or any(not isinstance(s, str) for s in space_ids):
            raise ValueError('知识库范围格式错误')
        match = ' OR '.join('"' + t.replace('"', '""') + '"' for t in terms)
        # Recognize explicit project phrases from local titles. Short generic matches
        # such as “机器人” must not outrank a named “爬索机器人” project.
        phrases = set()
        clean_query = FILLER.sub(' ', query.lower())
        for doc in list(documents.values()):
            if space_ids and doc.get('space_id') not in space_ids:
                continue
            for run in re.findall(r'[\u3400-\u9fff]{4,}', doc.get('title', '')):
                for length in range(min(len(run), 16), 3, -1):
                    hits = {run[i:i+length] for i in range(len(run)-length+1) if run[i:i+length] in clean_query}
                    if hits:
                        phrases.update(hits)
                        break
        anchors = {phrase for phrase in phrases if not any(phrase != other and phrase in other for other in phrases)}
        with self.lock:
            db = self._connect()
            try:
                with db:
                    self._update(db, documents)
                    sql = 'SELECT chunks.*,bm25(search,4,1) AS rank FROM search JOIN chunks ON chunks.id=search.rowid WHERE search MATCH ?'
                    params = [match]
                    if space_ids:
                        sql += ' AND space_id IN (' + ','.join('?' for _ in space_ids) + ')'
                        params += space_ids
                    rows = db.execute(sql + ' ORDER BY rank LIMIT 80', params).fetchall()
            finally:
                db.close()
        if anchors:
            anchored = [row for row in rows if any(p in row['title'] or p in row['text'] for p in anchors)]
            if anchored:
                rows = anchored
        def relevance(row):
            coverage = len(set(tokens(row['text'])) & set(terms)) / len(terms)
            title_match = max((len(p) for p in anchors if p in row['title']), default=0)
            return (title_match > 0, coverage, -row['rank'])
        rows = sorted(rows, key=relevance, reverse=True)
        selected, counts, total = [], Counter(), 0
        for row in rows:
            if counts[row['key']] >= 3 or total + len(row['text']) > 16000:
                continue
            # 同文档相邻重叠块去重 / avoid repeating near-identical evidence.
            if any(s['key'] == row['key'] and row['line_start'] <= s['line_end']
                   and s['line_start'] <= row['line_end'] for s in selected):
                continue
            source = {k: row[k] for k in ('key', 'title', 'space_id', 'space_name', 'line_start', 'line_end', 'text', 'version')}
            source.update(id='S' + str(len(selected) + 1), warnings=json.loads(row['warnings']))
            selected.append(source)
            counts[row['key']] += 1
            total += len(row['text'])
            if len(selected) >= limit:
                break
        return selected
