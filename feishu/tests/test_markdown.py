import unittest
from unittest.mock import Mock, patch

from feishu.client import FeishuError
from feishu.markdown import Exporter


def block(identifier, kind, text='', children=None, **payload):
    value = {'block_id': identifier, 'block_type': kind, 'children': children or []}
    names = {1: 'page', 2: 'text', 3: 'heading1', 12: 'bullet', 14: 'code', 17: 'todo'}
    if kind in names:
        value[names[kind]] = {'elements': [{'text_run': {'content': text}}], **payload}
    else:
        value.update(payload)
    return value


class MarkdownTests(unittest.TestCase):
    def test_heading_nested_list_and_code_preserve_markdown(self):
        from feishu.markdown import render_blocks
        blocks = [block('page', 1, children=['h', 'b', 'c']), block('h', 3, '标题'),
                  block('b', 12, '一级', ['nested']), block('nested', 12, '二级'),
                  block('c', 14, 'print(`value`)')]
        text, warnings = render_blocks(blocks, lambda *a: '')
        self.assertIn('# 标题', text)
        self.assertIn('- 一级\n  - 二级', text)
        self.assertIn('print(`value`)', text)
        self.assertEqual(warnings, [])

    def test_table_cells_are_rendered_once(self):
        from feishu.markdown import render_blocks
        blocks = [block('page', 1, children=['table']),
                  block('table', 31, table={'cells': ['a', 'b'], 'property': {'row_size': 1, 'column_size': 2}}),
                  block('a', 32, children=['t1']), block('b', 32, children=['t2']),
                  block('t1', 2, 'A | B'), block('t2', 2, 'C')]
        text, _ = render_blocks(blocks, lambda *a: '')
        self.assertIn('| A \\| B | C |', text)
        self.assertEqual(text.count('A \\| B'), 1)

    def test_unknown_blocks_are_explicit_not_silently_dropped(self):
        from feishu.markdown import render_blocks
        text, warnings = render_blocks([block('unsupported', 999, unknown={'data': 'retained'})], lambda *a: '')
        self.assertTrue(warnings)
        self.assertIn('999', text)
        self.assertIn('retained', text)

    def test_empty_zero_column_table_keeps_the_rest_of_the_document(self):
        from feishu.markdown import render_blocks
        blocks = [block('page', 1, children=['table', 'body']),
                  block('table', 31, table={'cells': [], 'property': {'row_size': 3, 'column_size': 0}}),
                  block('body', 2, '正文仍须完整保存')]
        text, warnings = render_blocks(blocks, lambda *a: '')
        self.assertIn('空表格', text)
        self.assertIn('正文仍须完整保存', text)
        self.assertTrue(any('空表格' in warning for warning in warnings))

    def test_zero_columns_with_cells_still_reports_invalid_structure(self):
        from feishu.markdown import render_blocks
        with self.assertRaisesRegex(ValueError, '列数无效'):
            render_blocks([block('table', 31, table={'cells': ['a'], 'property': {'column_size': 0}})], lambda *a: '')

    def test_page_title_is_not_duplicated(self):
        from feishu.markdown import render_blocks
        text, _ = render_blocks([block('p', 1, 'Title', ['a']), block('a', 2, 'Content')], lambda *a: '')
        self.assertNotIn('Title', text)
        self.assertIn('Content', text)

    def test_images_use_downloaded_asset_paths(self):
        from feishu.markdown import render_blocks
        calls = []
        def download(token, name, file):
            calls.append(token)
            return 'assets/image.png'
        text, warnings = render_blocks([block('img', 27, image={'token': 'image123'})], download)
        self.assertIn('![图片](assets/image.png)', text)
        self.assertEqual(calls, ['image123'])
        self.assertEqual(warnings, [])

    def test_view_container_renders_file_child_without_warning(self):
        from feishu.markdown import render_blocks
        text, warnings = render_blocks([block('view', 33, children=['file']), block('file', 23, file={'token': 'f', 'name': 'demo.pdf'})], lambda *args: 'assets/file.pdf')
        self.assertIn('[demo.pdf](assets/file.pdf)', text)
        self.assertEqual(warnings, [])


class PaginationTests(unittest.TestCase):
    def test_incomplete_response_is_retried_without_using_partial_content(self):
        from http.client import IncompleteRead
        from feishu.client import FeishuClient
        client = FeishuClient('cli_test', 'test-secret')
        broken, complete = Mock(), Mock()
        broken.__enter__ = Mock(return_value=broken)
        broken.__exit__ = Mock(return_value=False)
        broken.read.side_effect = IncompleteRead(b'{"data":', 10)
        complete.__enter__ = Mock(return_value=complete)
        complete.__exit__ = Mock(return_value=False)
        complete.read.return_value = b'{"code":0,"data":{"value":"complete"}}'
        client.opener.open = Mock(side_effect=[broken, complete])
        with patch('feishu.client.time.sleep'):
            result = client._open('GET', '/test')
        self.assertEqual(result['data']['value'], 'complete')
        self.assertEqual(client.opener.open.call_count, 2)

    def test_download_redirect_never_forwards_token_to_another_host(self):
        from urllib.request import Request
        from feishu.client import DownloadRedirect, FeishuError
        request = Request('https://open.feishu.cn/open-apis/drive/v1/medias/t/download', headers={'Authorization': 'Bearer private'})
        redirected = DownloadRedirect().redirect_request(request, None, 302, '', {}, 'https://cdn.example/resource')
        self.assertIsNone(redirected.get_header('Authorization'))
        with self.assertRaises(FeishuError):
            DownloadRedirect().redirect_request(request, None, 302, '', {}, 'http://cdn.example/resource')

    def test_empty_filtered_page_keeps_paging(self):
        from feishu.client import FeishuClient
        client = FeishuClient('', '')
        pages = iter([{'items': [], 'has_more': True, 'page_token': 'next'}, {'items': [{'id': 1}]}])
        client.get = lambda *args: next(pages)
        self.assertEqual(client.pages('/example'), [{'id': 1}])

    def test_repeated_cursor_fails(self):
        from feishu.client import FeishuClient, FeishuError
        client = FeishuClient('', '')
        client.get = lambda *args: {'items': [], 'has_more': True, 'page_token': 'same'}
        with self.assertRaises(FeishuError):
            client.pages('/example')


class ReadOnlyExportTests(unittest.TestCase):
    def test_export_latest_content_with_read_only_access(self):
        client = Mock()
        client.get.return_value = {'document': {'revision_id': 2}}
        def pages(path, params):
            if params['document_revision_id'] != -1:
                raise FeishuError('1770032 forBidden')
            return [block('p', 1, children=['text']), block('text', 2, '最新正文')]
        client.pages.side_effect = pages
        result = Exporter(client).export({'obj_type': 'docx', 'obj_token': 'doc', 'revision_id': 2})
        self.assertIn('最新正文', result.content)
        self.assertEqual(result.warnings, [])

    def test_changing_revision_does_not_save_mixed_pages(self):
        client = Mock()
        client.pages.return_value = [block('text', 2, '读取期间变动的内容')]
        client.get.return_value = {'document': {'revision_id': 3}}
        with self.assertRaisesRegex(FeishuError, '读取期间'):
            Exporter(client).export({'obj_type': 'docx', 'obj_token': 'doc', 'revision_id': 2})
