"""飞书结构化内容转 Markdown；unsupported blocks are retained with warnings."""
import json
import mimetypes
import re
from dataclasses import dataclass
from urllib.parse import quote, urlparse

from .client import FeishuError
from .storage import digest


@dataclass
class Export:
    content: str
    assets: dict
    warnings: list


def escape(text):
    return re.sub(r'([\\`*\[\]_<>{}])', r'\\\1', str(text))


def safe_url(value):
    return value if urlparse(value).scheme in ('https', 'http', 'mailto') else ''


def rich(elements, code=False):
    result = []
    for el in elements or []:
        run = el.get('text_run')
        if run is not None:
            text = run.get('content', '')
            if code:
                result.append(text)
                continue
            style = run.get('text_element_style', {})
            if style.get('inline_code'):
                fence = '`' * (max([len(x) for x in re.findall(r'`+', text)] + [0]) + 1)
                text = fence + ' ' + text + ' ' + fence
            else:
                text = escape(text)
                if style.get('bold'):
                    text = '**' + text + '**'
                if style.get('italic'):
                    text = '*' + text + '*'
                if style.get('strikethrough'):
                    text = '~~' + text + '~~'
            link = safe_url(style.get('link', {}).get('url', ''))
            if link:
                text = f'[{text}](<{link}>)'
            result.append(text)
        elif 'equation' in el:
            result.append('$' + el['equation'].get('content', '') + '$')
        elif 'mention_user' in el:
            result.append('@' + escape(el['mention_user'].get('user_id', '成员')))
        elif 'mention_doc' in el:
            doc = el['mention_doc']
            url = safe_url(doc.get('url', ''))
            result.append(f'[{escape(doc.get("title", "文档"))}](<{url}>)' if url else escape(doc.get('title', '文档')))
        elif 'reminder' in el:
            result.append(escape(el['reminder'].get('expire_time', '提醒')))
        else:
            result.append('`' + json.dumps(el, ensure_ascii=False) + '`')
    return ''.join(result)


def table(rows):
    if not rows:
        return '_空表格_\n'
    width = max(len(r) for r in rows)
    if not width:
        return '_空表格_\n'
    def line(row):
        cells = [str(x if x is not None else '').replace('|', '\\|').replace('\n', '<br>') for x in row]
        return '| ' + ' | '.join(cells + [''] * (width - len(cells))) + ' |'
    return '\n'.join([line(rows[0]), '| ' + ' | '.join(['---'] * width) + ' |'] + [line(r) for r in rows[1:]]) + '\n'


def render_blocks(blocks, media, embedded=None):
    by_id = {b['block_id']: b for b in blocks}
    consumed, warnings = set(), []
    names = {1: 'page', 2: 'text', **{i + 2: 'heading' + str(i) for i in range(1, 10)},
             12: 'bullet', 13: 'ordered', 14: 'code', 15: 'quote', 16: 'equation', 17: 'todo'}

    def render(identifier, depth=0):
        if identifier in consumed:
            return ''
        block = by_id.get(identifier)
        if block is None:
            warnings.append('缺少引用块：' + identifier)
            return '> 缺少内容块：' + escape(identifier) + '\n\n'
        consumed.add(identifier)
        kind = block.get('block_type')
        children = block.get('children', [])
        child_text = lambda: ''.join(render(c, depth + 1) for c in children)
        if kind == 1:
            return child_text()
        if kind in names:
            payload = block.get(names[kind], {})
            text = rich(payload.get('elements', []), code=kind in (14, 16))
            if 3 <= kind <= 11:
                return '#' * min(6, kind - 2) + ' ' + text + '\n\n' + child_text()
            if kind in (12, 13, 17):
                prefix = '- ' if kind == 12 else '1. '
                if kind == 17:
                    prefix = '- [x] ' if payload.get('style', {}).get('done') else '- [ ] '
                nested = child_text().rstrip()
                return prefix + text + ('\n' + '\n'.join('  ' + l for l in nested.splitlines()) if nested else '') + '\n\n'
            if kind == 14:
                fence = '`' * max(3, max([len(x) + 1 for x in re.findall(r'`+', text)] + [3]))
                return fence + '\n' + text + '\n' + fence + '\n\n' + child_text()
            if kind == 16:
                return '$$\n' + text + '\n$$\n\n' + child_text()
            if kind == 15:
                return '\n'.join('> ' + l for l in (text + '\n' + child_text()).strip().splitlines()) + '\n\n'
            return text + '\n\n' + child_text()
        if kind == 22:
            return '---\n\n' + child_text()
        if kind in (23, 27):
            payload = block.get('image' if kind == 27 else 'file', {})
            token = payload.get('token', '')
            name = payload.get('name', '图片' if kind == 27 else '附件')
            path = media(token, name, False)
            return ('!' if kind == 27 else '') + f'[{escape(name)}]({path})\n\n' + child_text()
        if kind == 31:
            value = block.get('table', {})
            cells = value.get('cells', children)
            cols = value.get('property', {}).get('column_size', 1)
            if cols == 0 and not cells and not children:
                warnings.append('空表格没有列，已保留占位说明')
                return '_空表格（没有列）_\n\n'
            if not isinstance(cols, int) or cols < 1:
                raise ValueError('文档表格列数无效')
            texts = [render(c).strip() for c in cells]
            return table([texts[i:i + cols] for i in range(0, len(texts), cols)]) + '\n'
        if kind == 34:
            return '\n'.join('> ' + line for line in child_text().strip().splitlines()) + '\n\n'
        if kind in (18, 19, 24, 25, 26, 32, 33):
            content = child_text()
            if children:
                return content
        if kind in (18, 30) and embedded:
            payload = block.get('bitable' if kind == 18 else 'sheet', {})
            token = payload.get('token', '')
            return embedded('bitable' if kind == 18 else 'sheet', token) + '\n\n'
        if kind == 20:
            payload = block.get('chat_card', {})
            return '> 群聊卡片：' + escape(payload.get('chat_id', '')) + '\n\n' + child_text()
        if kind in (21, 35):
            payload = block.get('diagram' if kind == 21 else 'task', {})
            warnings.append('图表或任务块以结构数据保存')
        elif kind in (28, 29):
            payload = block.get('isv' if kind == 28 else 'mindnote', {})
            warnings.append('嵌入应用或思维笔记以结构数据保存')
        else:
            warnings.append(f'块类型 {kind} 暂不支持完整 Markdown 转换，已保留结构数据')
        raw = json.dumps(block, ensure_ascii=False, indent=2)
        fence = '`' * max(3, max([len(x) + 1 for x in re.findall(r'`+', raw)] + [3]))
        return f'> 原始内容块（类型 {kind}）\n\n{fence}json\n{raw}\n{fence}\n\n' + child_text()

    roots = [b['block_id'] for b in blocks if b.get('block_type') == 1]
    if not roots:
        children = {c for b in blocks for c in b.get('children', [])}
        cells = {c for b in blocks for c in b.get('table', {}).get('cells', [])}
        roots = [b['block_id'] for b in blocks if b['block_id'] not in children | cells]
    output = ''.join(render(r) for r in roots)
    # Preserve orphaned blocks if the API returns an incomplete relationship tree.
    for block in blocks:
        if block['block_id'] not in consumed:
            warnings.append('发现未关联的内容块，已追加至文末')
            output += render(block['block_id'])
    return output.strip() + '\n', list(dict.fromkeys(warnings))


def col_name(index):
    output = ''
    while index:
        index, rem = divmod(index - 1, 26)
        output = chr(65 + rem) + output
    return output


class Exporter:
    def __init__(self, client):
        self.client = client

    def revision(self, node):
        if node.get('obj_type') == 'docx':
            document = self.client.get('/docx/v1/documents/' + quote(node['obj_token'], safe='')).get('document', {})
            return document.get('revision_id', -1)
        return None

    def export(self, node):
        assets, warnings = {}, []

        def media(token, name='附件', file=False):
            if not token:
                warnings.append('素材缺少 token')
                return '#missing-media'
            try:
                content, mime = self.client.download(token, file=file)
                ext = mimetypes.guess_extension(mime.split(';')[0]) or '.bin'
                # Keep original filename as label, use content hash as filesystem identity.
                path = 'assets/' + digest(content) + ext
                assets[path] = content
                return path
            except Exception as error:
                warnings.append('素材下载失败：' + str(error))
                return '#media-' + quote(token, safe='')

        def sheets(token, sheet_id=''):
            base = '/sheets/v3/spreadsheets/' + quote(token, safe='')
            result = self.client.get(base + '/sheets/query').get('sheets', [])
            chunks = []
            for sheet in result:
                sid = sheet['sheet_id']
                if sheet_id and sid != sheet_id:
                    continue
                if sheet.get('resource_type', 'sheet') != 'sheet':
                    warnings.append('电子表格中的非网格工作表未转换：' + sheet.get('title', sid))
                    continue
                grid = sheet.get('grid_properties', {})
                rows_count, cols_count = int(grid.get('row_count', 0)), int(grid.get('column_count', 0))
                rows = []
                if cols_count > 0:
                    for start in range(1, rows_count + 1, 200):
                        area = f'{sid}!A{start}:{col_name(cols_count)}{min(start + 199, rows_count)}'
                        values = self.client.get('/sheets/v2/spreadsheets/' + quote(token, safe='') + '/values/' + quote(area, safe=''),
                                                 {'valueRenderOption': 'ToString', 'dateTimeRenderOption': 'FormattedString'})
                        batch = values.get('valueRange', {}).get('values', [])
                        rows.extend([[field_text(x, media) for x in r] for r in batch])
                while rows and not any(rows[-1]):
                    rows.pop()
                chunks.append('## ' + escape(sheet.get('title', sid)) + '\n\n' + table(rows))
            return '\n'.join(chunks) or '_空电子表格_\n'

        def bitable(token, table_id=''):
            base = '/bitable/v1/apps/' + quote(token, safe='')
            tables = self.client.pages(base + '/tables')
            chunks = []
            for item in tables:
                tid = item['table_id']
                if table_id and tid != table_id:
                    continue
                fields = self.client.pages(base + '/tables/' + quote(tid, safe='') + '/fields')
                names = [f['field_name'] for f in fields]
                records = self.client.pages(base + '/tables/' + quote(tid, safe='') + '/records', {'page_size': 500})
                rows = [names] + [[field_text(record.get('fields', {}).get(n, ''), media) for n in names] for record in records]
                chunks.append('## ' + escape(item.get('name', tid)) + '\n\n' + table(rows))
            return '\n'.join(chunks) or '_空多维表格_\n'

        def embedded(kind, token):
            parent, _, sub = token.partition('_')
            try:
                return sheets(parent, sub) if kind == 'sheet' else bitable(parent, sub)
            except Exception as error:
                warnings.append('嵌入表格导出失败：' + str(error))
                return '> 嵌入表格未导出，token：' + escape(token)

        kind, token = node.get('obj_type'), quote(node.get('obj_token', ''), safe='')
        if kind == 'docx':
            base = '/docx/v1/documents/' + token
            revision = node.get('revision_id', -1)
            # Explicit revision numbers can require history/edit access, even when metadata
            # reports that number as current. Read the latest content using read-only access.
            blocks = self.client.pages(base + '/blocks', {'page_size': 500, 'document_revision_id': -1})
            if revision != -1 and self.revision(node) != revision:
                raise FeishuError('文档在读取期间发生更新，已保留本地版本；请在下轮同步重试。')
            text, block_warnings = render_blocks(blocks, media, embedded)
            warnings.extend(block_warnings)
            # Embedded sheets can change without the containing document's revision changing.
            dynamic = any(b.get('block_type') in (18, 30) for b in blocks)
        elif kind == 'doc':
            text = self.client.get('/doc/v2/' + token + '/raw_content').get('content', '')
            warnings.append('旧版文档按纯文本导出，原有格式及图片需在飞书升级为新版文档后同步')
            dynamic = False
        elif kind == 'sheet':
            text, dynamic = sheets(node['obj_token']), True
        elif kind == 'bitable':
            text, dynamic = bitable(node['obj_token']), True
        elif kind == 'file':
            path = media(node['obj_token'], node.get('title', '附件'), True)
            text, dynamic = '[下载原始文件](' + path + ')\n', False
        else:
            text = '> 此类型暂不支持完整 Markdown 转换，原始节点信息如下。\n\n```json\n' + json.dumps(node, ensure_ascii=False, indent=2) + '\n```\n'
            warnings.append('尚不支持完整导出的节点类型：' + str(kind))
            dynamic = False
        result = Export(text, assets, list(dict.fromkeys(warnings)))
        result.dynamic = dynamic
        return result


def field_text(value, media):
    if value is None:
        return ''
    if isinstance(value, list):
        return ', '.join(field_text(v, media) for v in value)
    if isinstance(value, dict):
        if value.get('file_token'):
            name = value.get('name', '附件')
            return f'[{escape(name)}]({media(value["file_token"], name)})'
        if 'text' in value:
            text = str(value['text'])
            url = safe_url(value.get('link', ''))
            return f'[{escape(text)}](<{url}>)' if url else text
        if 'name' in value:
            return str(value['name'])
        return json.dumps(value, ensure_ascii=False)
    return str(value)
