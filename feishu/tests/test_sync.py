import copy
import tempfile
import unittest
from pathlib import Path


class FakeClient:
    def __init__(self):
        self.items = [{'node_token': 'root', 'obj_token': 'doc1', 'obj_type': 'docx',
                       'title': '开始 / Start', 'obj_edit_time': '1', 'has_child': True},
                      {'node_token': 'child', 'obj_token': 'doc2', 'obj_type': 'docx',
                       'title': '子文档', 'obj_edit_time': '1', 'parent_node_token': 'root'}]
        self.fail = False

    def spaces(self):
        return [{'space_id': '123', 'name': '团队知识库'}]

    def nodes(self, space_id, parent=''):
        if self.fail:
            raise RuntimeError('permission denied')
        return [copy.deepcopy(n) for n in self.items if n.get('parent_node_token', '') == parent]


class FakeExporter:
    def __init__(self):
        self.content = '正文 **加粗**\n'
        self.fail = False

    def export(self, node):
        from feishu.markdown import Export
        if self.fail:
            raise RuntimeError('文档权限不足')
        return Export(self.content, {}, [])


class SyncTests(unittest.TestCase):
    def setUp(self):
        from feishu.sync import SyncEngine
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.client, self.exporter = FakeClient(), FakeExporter()
        self.engine = SyncEngine(Path(self.tmp.name), self.client, self.exporter,
                                 vault=Path(self.tmp.name) / 'vault')

    def path(self, token='root'):
        return self.engine.vault / self.engine.manifest['documents']['123:' + token]['path']

    def test_initialization_and_idempotent_pull(self):
        result = self.engine.run()
        self.assertEqual(result['counts']['added'], 2)
        self.assertIn('正文 **加粗**', self.path().read_text())
        self.assertTrue(self.path('child').is_relative_to(self.path().parent))
        self.assertEqual(self.engine.run()['counts']['unchanged'], 2)

    def test_remote_update_has_history_diff(self):
        self.engine.run()
        self.client.items[0]['obj_edit_time'] = '2'
        self.exporter.content = '更新正文\n'
        result = self.engine.run()
        self.assertEqual(result['counts']['updated'], 1)
        self.assertIn('更新正文', self.path().read_text())
        self.assertIn('+更新正文', self.engine.diff('123:root')['diff'])

    def test_conflict_never_overwrites_local_and_can_resolve(self):
        self.engine.run()
        self.path().write_text('我的本地修改\n')
        self.client.items[0]['obj_edit_time'] = '2'
        self.exporter.content = '远端更新\n'
        self.assertEqual(self.engine.run()['counts']['conflict'], 1)
        self.assertEqual(self.path().read_text(), '我的本地修改\n')
        self.assertIn('远端更新', self.engine.diff('123:root')['remote'])
        self.engine.resolve('123:root', 'remote')
        self.assertIn('远端更新', self.path().read_text())

    def test_local_only_edit_is_preserved(self):
        self.engine.run()
        self.path().write_text('local only')
        self.assertEqual(self.engine.run()['counts']['local'], 1)
        self.assertEqual(self.path().read_text(), 'local only')

    def test_missing_remote_is_retained(self):
        self.engine.run()
        path = self.path('child')
        self.client.items.pop()
        result = self.engine.run()
        self.assertEqual(result['counts']['missing'], 1)
        self.assertTrue(path.exists())

    def test_traversal_failure_does_not_mark_missing(self):
        self.engine.run()
        self.client.fail = True
        result = self.engine.run()
        self.assertGreater(result['counts']['error'], 0)
        self.assertEqual(result['counts']['missing'], 0)
        self.assertTrue(self.path().exists())

    def test_rename_moves_clean_files_and_preserves_history(self):
        self.engine.run()
        old_path = self.path()
        self.client.items[0]['title'] = '新标题'
        self.engine.run()
        self.assertFalse(old_path.exists())
        self.assertIn('新标题', self.path().read_text())
        self.assertTrue(self.path('child').exists())

    def test_export_error_keeps_last_good_baseline(self):
        self.engine.run()
        before = self.path().read_bytes()
        self.client.items[0]['obj_edit_time'] = '2'
        self.exporter.fail = True
        self.assertGreater(self.engine.run()['counts']['error'], 0)
        self.assertEqual(before, self.path().read_bytes())

    def test_state_restores_and_path_cannot_escape(self):
        from feishu.sync import SyncEngine
        from feishu.storage import safe_path
        self.engine.run()
        restored = SyncEngine(Path(self.tmp.name), self.client, self.exporter, vault=self.engine.vault)
        self.assertEqual(len(restored.manifest['documents']), 2)
        with self.assertRaises(ValueError):
            safe_path(self.engine.vault, '../../outside')

    def test_moving_vault_preserves_local_edits_history_assets_and_retrieval(self):
        from feishu.knowledge import KnowledgeBase
        from feishu.sync import SyncEngine
        self.engine.run()
        self.client.items[0]['obj_edit_time'] = '2'
        self.exporter.content = '远端制动器更新\n'
        self.engine.run()
        self.path().write_text('本地制动器修改\n', encoding='utf-8')
        asset = self.path().parent / 'assets/diagram.png'
        asset.parent.mkdir()
        asset.write_bytes(b'fixture image')
        before = copy.deepcopy(self.engine.manifest)
        history = copy.deepcopy(self.engine.history)
        vault = Path(self.tmp.name) / 'online-vault/feishu-vault'
        vault.parent.mkdir()
        self.engine.vault.rename(vault)
        restored = SyncEngine(Path(self.tmp.name), self.client, self.exporter, vault=vault)
        self.assertEqual(restored.manifest, before)
        self.assertEqual(restored.history, history)
        self.assertIn('+远端制动器更新', restored.diff('123:root')['diff'])
        result = restored.run()
        self.assertEqual(result['counts']['added'], 0)
        self.assertEqual(result['counts']['local'], 1)
        self.assertEqual(result['counts']['error'], 0)
        kb = KnowledgeBase(Path(self.tmp.name), vault=vault)
        docs = restored.manifest['documents']
        self.assertEqual(kb.document(docs, '123:root')['content'], '本地制动器修改\n')
        self.assertEqual(kb.asset(docs, '123:root', 'assets/diagram.png').read_bytes(), b'fixture image')
        self.assertEqual(kb.search(docs, '本地制动器', ['123'])[0]['key'], '123:root')

    def test_keep_local_acknowledges_remote_until_next_change(self):
        self.engine.run()
        self.path().write_text('保留的本地正文')
        self.client.items[0]['obj_edit_time'] = '2'
        self.exporter.content = '远端版本 2'
        self.engine.run()
        self.engine.resolve('123:root', 'local')
        result = self.engine.run()
        self.assertEqual(result['counts']['conflict'], 0)
        self.assertEqual(self.path().read_text(), '保留的本地正文')
        self.client.items[0]['obj_edit_time'] = '3'
        self.exporter.content = '远端版本 3'
        self.assertEqual(self.engine.run()['counts']['conflict'], 1)

    def test_revision_detects_update_when_node_edit_time_is_unchanged(self):
        revision = [1]
        self.exporter.revision = lambda node: revision[0]
        self.engine.run()
        revision[0] = 2
        self.exporter.content = '同一秒内的最新修订'
        self.assertEqual(self.engine.run()['counts']['updated'], 2)

    def test_stale_diff_cannot_overwrite_new_local_edits(self):
        self.engine.run()
        self.path().write_text('local v1')
        self.client.items[0]['obj_edit_time'] = '2'
        self.exporter.content = 'remote v2'
        self.engine.run()
        diff = self.engine.diff('123:root')
        self.path().write_text('local v2')
        with self.assertRaises(ValueError):
            self.engine.resolve('123:root', 'remote', diff['local_hash'])
        self.assertEqual(self.path().read_text(), 'local v2')

    def test_all_documents_failed_is_not_successful_initialization(self):
        self.exporter.fail = True
        self.engine.run()
        self.assertFalse(self.engine.manifest['initialized'])

    def test_no_remote_access_does_not_discard_existing_documents(self):
        self.engine.run()
        self.client.spaces = lambda: []
        result = self.engine.run()
        self.assertGreater(result['counts']['error'], 0)
        self.assertEqual(result['counts']['missing'], 0)
        self.assertTrue(self.path().exists())

    def test_symlink_escape_is_rejected(self):
        from feishu.storage import safe_path
        (self.engine.vault / 'escape').symlink_to(self.tmp.name, target_is_directory=True)
        with self.assertRaises(ValueError):
            safe_path(self.engine.vault, 'escape/other.md')


if __name__ == '__main__':
    unittest.main()
