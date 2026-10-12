import http.client
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock

from feishu.client import FeishuClient, FeishuError
from feishu.server import Service, create_server
from feishu.storage import read_json, save_credentials, validate_settings
from test_sync import FakeClient, FakeExporter


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.project = Path(self.tmp.name)
        self.root = self.project / 'feishu'
        self.service = Service(self.root, self.project)
        self.addCleanup(self.service.stop.set)

    def test_placeholder_credentials_are_not_configured(self):
        self.assertFalse(FeishuClient('your_app_id', 'your_secret').configured)
        self.assertFalse(self.service.status()['configured'])
        with self.assertRaises(ValueError):
            self.service.start()

    def test_settings_maintainable_and_persisted_without_secrets(self):
        body = {'spaces': [{'space_id': '123', 'name': '研发'}], 'all_spaces': False, 'interval': 60,
                'app_id': 'cli_testapp', 'app_secret': 'unitTestSecret'}
        self.service.configure(body)
        status = self.service.status()
        self.assertTrue(status['configured'])
        self.assertNotIn('unitTestSecret', json.dumps(status))
        self.assertNotIn('unitTestSecret', (self.root / '.state/settings.json').read_text())
        self.assertEqual((self.project / 'config/feishu.env').stat().st_mode & 0o777, 0o600)
        restarted = Service(self.root, self.project)
        self.addCleanup(restarted.stop.set)
        self.assertEqual(restarted.settings['spaces'], body['spaces'])

    def test_invalid_settings_do_not_destroy_previous_config(self):
        before = dict(self.service.settings)
        with self.assertRaises(ValueError):
            self.service.configure({'spaces': [], 'all_spaces': False, 'interval': 5})
        self.assertEqual(before, self.service.settings)

    def test_delete_last_knowledge_id_saves_empty_scope_and_pauses_automation(self):
        self.service.stop.set()
        self.service.settings.update(spaces=[{'space_id': '123', 'name': '研发'}],
                                     all_spaces=False, automation=True)
        self.service.configure({'spaces': [], 'all_spaces': False, 'interval': 300})
        saved = read_json(self.root / '.state/settings.json', {})
        self.assertEqual(saved['spaces'], [])
        self.assertFalse(saved['all_spaces'])
        self.assertFalse(saved['automation'])
        self.assertIsNone(self.service.next_run)
        self.service.engine.manifest['initialized'] = True
        with self.assertRaisesRegex(ValueError, '知识库'):
            self.service.automation(True)

    def test_automation_requires_initialization_and_persists(self):
        with self.assertRaises(ValueError):
            self.service.automation(True)
        self.service.engine.manifest['initialized'] = True
        self.service.engine.save()
        # Prevent the test scheduler from issuing any network request.
        self.service.stop.set()
        self.service.automation(True)
        settings = read_json(self.root / '.state/settings.json', {})
        self.assertTrue(settings['automation'])
        self.service.automation(False)
        self.assertFalse(read_json(self.root / '.state/settings.json', {})['automation'])

    def test_check_direct_id_even_when_discovery_is_empty(self):
        client = Mock(spec=FeishuClient)
        client.spaces.return_value = []
        client.space.return_value = {'space_id': '123', 'name': '研发'}
        client.get.return_value = {'items': [{}], 'has_more': True}
        self.service.client = client
        self.service.settings.update(spaces=[{'space_id': '123', 'name': '研发'}], all_spaces=True)
        result = self.service.check_connection()
        self.assertEqual(result['spaces'], [])
        self.assertTrue(result['checks'][0]['ok'])
        self.assertTrue(result['needs_attention'])
        self.assertIn('取消勾选', result['message'])
        client.get.assert_called_once_with('/wiki/v2/spaces/123/nodes', {'page_size': 1})

    def test_check_directory_denial_does_not_hide_other_ids(self):
        client = Mock(spec=FeishuClient)
        client.spaces.return_value = []
        client.space.side_effect = lambda sid: {'space_id': sid, 'name': sid}
        client.get.side_effect = [FeishuError('131006: wiki space permission denied'), {'items': []}]
        client.redact.side_effect = lambda value: value
        self.service.client = client
        self.service.settings.update(spaces=[{'space_id': '123'}, {'space_id': '456'}], all_spaces=False)
        result = self.service.check_connection()
        self.assertEqual([item['ok'] for item in result['checks']], [False, True])
        self.assertIn('131006', result['checks'][0]['error'])
        self.assertIn('目录', result['checks'][1]['message'])
        self.assertTrue(result['needs_attention'])

    def test_discovery_error_still_checks_explicit_ids(self):
        client = Mock(spec=FeishuClient)
        client.spaces.side_effect = FeishuError('list unavailable')
        client.space.return_value = {'space_id': '123', 'name': '研发'}
        client.get.return_value = {'items': []}
        client.redact.side_effect = lambda value: value
        self.service.client = client
        self.service.settings.update(spaces=[{'space_id': '123'}], all_spaces=False)
        result = self.service.check_connection()
        self.assertTrue(result['checks'][0]['ok'])
        self.assertEqual(result['discovery_error'], 'list unavailable')
        self.assertIn('自动发现失败', result['message'])

    def test_empty_discovery_is_not_reported_as_sync_ready(self):
        client = Mock(spec=FeishuClient)
        client.spaces.return_value = []
        self.service.client = client
        result = self.service.check_connection()
        self.assertTrue(result['needs_attention'])
        self.assertNotIn('连接成功', result['message'])


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.project = Path(cls.tmp.name)
        (cls.project / 'feishu').mkdir()
        (cls.project / 'feishu/feishu.html').write_text('<h1>Feishu test page</h1>')
        (cls.project / 'assets').mkdir()
        cls.service = Service(cls.project / 'feishu', cls.project)
        cls.server = create_server(0, cls.service)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.service.stop.set()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.tmp.cleanup()

    def request(self, path, method='GET', body=None, headers=None):
        client = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        base = {'X-Feishu-Client': 'sophistudio'}
        if body is not None:
            base.update({'Content-Type': 'application/json', 'X-Feishu-Nonce': self.service.nonce})
        base.update(headers or {})
        client.request(method, path, json.dumps(body) if body is not None else None, base)
        response = client.getresponse()
        data = response.read()
        result = response.status, dict(response.getheaders()), data
        client.close()
        return result

    def test_same_origin_status_does_not_expose_secret(self):
        code, _, body = self.request('/api/status')
        self.assertEqual(code, 200)
        self.assertNotIn(b'app_secret', body)

    def test_storage_and_reader_share_the_online_vault(self):
        vault = (self.project / 'online-vault/feishu-vault').resolve()
        self.assertEqual(self.service.engine.vault, vault)
        self.assertEqual(self.service.knowledge.vault, vault)
        self.assertFalse((self.project / 'feishu/vault').exists())
        self.assertEqual(json.loads(self.request('/api/status')[2])['output'], str(vault))

    def test_canonical_page_and_legacy_redirects(self):
        code, _, body = self.request('/feishu/feishu.html')
        self.assertEqual(code, 200)
        self.assertIn(b'Feishu test page', body)
        for path in ('/', '/feishu.html', '/feishu', '/feishu/'):
            with self.subTest(path=path):
                code, headers, _ = self.request(path)
                self.assertEqual(code, 302)
                self.assertEqual(headers['Location'], '/feishu/feishu.html')

    def test_null_origin_requires_local_file_key(self):
        self.assertEqual(self.request('/api/status', headers={'Origin': 'null'})[0], 403)
        code, headers, _ = self.request('/api/status', headers={'Origin': 'null', 'X-Feishu-Local-Key': self.service.local_key})
        self.assertEqual(code, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'null')

    def test_file_origin_preflight(self):
        code, headers, _ = self.request('/api/status', method='OPTIONS', headers={'Origin': 'null'})
        self.assertEqual(code, 204)
        self.assertIn('X-Feishu-Local-Key', headers['Access-Control-Allow-Headers'])

    def test_origin_host_and_nonce_guards(self):
        self.assertEqual(self.request('/api/status', headers={'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('/api/status', headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.request('/api/automation', method='POST', body={'enabled': True}, headers={'X-Feishu-Nonce': 'wrong'})[0], 403)

    def test_private_files_cannot_be_served_even_via_public_prefix(self):
        # 确认已存在的私有文件也不会经静态路由暴露。
        vault = self.service.engine.vault
        (vault / 'anything.md').write_text('private fixture')
        (vault / 'private.png').write_bytes(b'private image')
        self.addCleanup((vault / 'anything.md').unlink)
        self.addCleanup((vault / 'private.png').unlink)
        for path in ['/config/feishu.env', '/config/feishu-ai.env', '/feishu/.state/consultations.json', '/feishu/.state/knowledge.sqlite3', '/feishu/.state/settings.json', '/feishu/local-connection.js',
                     '/feishu/vault/anything.md', '/online-vault/feishu-vault/anything.md',
                     '/assets/../online-vault/feishu-vault/private.png', '/assets/../feishu/local-connection.js',
                     '/unit/js/%2e%2e/%2e%2e/feishu/local-connection.js']:
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)

    def test_reader_asset_and_search_are_authenticated_and_use_local_text(self):
        from urllib.parse import quote
        path=self.service.engine.vault/'reader-fixture/index.md'
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text('# 制动方案\n\n本地防坠制动器测试。',encoding='utf-8')
        (path.parent/'assets').mkdir(exist_ok=True)
        (path.parent/'assets/image.png').write_bytes(b'fixture')
        self.service.engine.manifest['documents']['reader']={'key':'reader','title':'制动方案','space_id':'123','space_name':'测试','base':'fixture','path':'reader-fixture/index.md','status':'unchanged'}
        try:
            self.assertEqual(self.request('/api/document?key=reader',headers={'X-Feishu-Client':''})[0],403)
            code,_,body=self.request('/api/document?key=reader')
            self.assertEqual(code,200);self.assertIn('本地防坠',json.loads(body)['content'])
            code,headers,body=self.request('/api/asset?key=reader&path=assets/image.png')
            self.assertEqual(code,200);self.assertEqual(body,b'fixture');self.assertIn('attachment',headers['Content-Disposition'])
            self.assertEqual(self.request('/api/asset?key=reader&path=assets/%2e%2e/index.md')[0],400)
            code,_,body=self.request('/api/search?q='+quote('防坠制动器')+'&space=123')
            self.assertEqual(code,200);self.assertEqual(json.loads(body)['sources'][0]['key'],'reader')
        finally:
            del self.service.engine.manifest['documents']['reader']

    def test_qa_and_ai_config_have_same_origin_and_nonce_protection(self):
        self.assertEqual(self.request('/api/qa/history',headers={'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.request('/api/ai/config','POST',{},headers={'X-Feishu-Nonce':'wrong'})[0],403)
        code,_,body=self.request('/api/ai/config')
        self.assertEqual(code,200);self.assertNotIn(b'API_KEY',body)
        self.assertEqual(self.request('/api/qa/ask','POST',{'question':'x'})[0],400)

    def test_http_initialization_runs_real_sync_with_fixture_remote(self):
        self.service.client = FeishuClient('cli_testapp', 'unitTestSecret')
        self.service.engine.client = FakeClient()
        self.service.engine.exporter = FakeExporter()
        code, _, _ = self.request('/api/initialize', 'POST', {})
        self.assertEqual(code, 200)
        deadline = time.time() + 5
        while self.service.running and time.time() < deadline:
            time.sleep(.02)
        self.assertFalse(self.service.running)
        self.assertEqual(self.service.engine.history[0]['counts']['added'], 2)
        self.assertEqual(len(list(self.service.engine.vault.rglob('*.md'))), 2)
        code, _, body = self.request('/api/documents')
        self.assertEqual(code, 200)
        self.assertEqual(len(json.loads(body)['documents']), 2)


if __name__ == '__main__':
    unittest.main()
