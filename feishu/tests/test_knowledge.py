import tempfile
import unittest
from pathlib import Path

from feishu.knowledge import KnowledgeBase


class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.kb = KnowledgeBase(self.root, vault=self.root / 'vault')
        self.docs = {}

    def add(self, key, title, content, space='wiki1'):
        path = self.root / 'vault' / key / 'index.md'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        self.docs[key] = {'key': key, 'title': title, 'space_id': space, 'space_name': space,
                          'path': str(path.relative_to(self.root / 'vault')), 'base': 'saved', 'status': 'unchanged'}
        return path

    def test_document_returns_current_local_text_not_old_snapshot(self):
        path = self.add('wiki1:n1', '方案', '原始内容')
        path.write_text('本地修订内容', encoding='utf-8')
        result = self.kb.document(self.docs, 'wiki1:n1')
        self.assertEqual(result['content'], '本地修订内容')
        self.assertEqual(result['title'], '方案')

    def test_documents_and_assets_cannot_escape_vault(self):
        self.add('wiki1:n1', '方案', '正文')
        for path in ('../private.env', '/etc/passwd', 'assets/../../private.env'):
            with self.assertRaises(ValueError):
                self.kb.asset(self.docs, 'wiki1:n1', path)
        self.docs['wiki1:n1']['path'] = '../../private.env'
        with self.assertRaises(ValueError):
            self.kb.document(self.docs, 'wiki1:n1')

    def test_asset_is_read_only_from_document_asset_directory(self):
        path = self.add('wiki1:n1', '方案', '![图](assets/diagram.png)')
        asset = path.parent / 'assets/diagram.png'
        asset.parent.mkdir()
        asset.write_bytes(b'png fixture')
        self.assertEqual(self.kb.asset(self.docs, 'wiki1:n1', 'assets/diagram.png'), asset.resolve())
        asset.unlink()
        asset.symlink_to(path)
        with self.assertRaises(ValueError):
            self.kb.asset(self.docs, 'wiki1:n1', 'assets/diagram.png')

    def test_chinese_and_english_retrieval_with_scope_and_line_citations(self):
        self.add('wiki1:n1', '爬索机器人方案', '# 方案\n\n爬索机器人采用双电机驱动和防坠制动器。\n\nCable robot safety brake.')
        self.add('wiki2:n2', '财务预算', '预算管理与收入预测。', 'wiki2')
        self.add('wiki2:n3', '爬索机器人供应商', '爬索机器人供应商询价。', 'wiki2')
        found = self.kb.search(self.docs, '爬索机器人制动方案', ['wiki1'])
        self.assertTrue(found)
        self.assertTrue(all(s['space_id'] == 'wiki1' for s in found))
        self.assertIn('防坠制动器', found[0]['text'])
        self.assertGreaterEqual(found[0]['line_start'], 1)
        self.assertEqual(self.kb.search(self.docs, 'safety brake', ['wiki1'])[0]['key'], 'wiki1:n1')
        self.assertEqual(self.kb.search(self.docs, 'quantum entanglement', []), [])

    def test_index_updates_and_excludes_removed_or_missing_documents(self):
        path = self.add('wiki1:n1', '方案', '电机制动器测试')
        self.assertTrue(self.kb.search(self.docs, '电机制动器', []))
        path.write_text('液压驱动试验', encoding='utf-8')
        self.assertTrue(self.kb.search(self.docs, '液压驱动', []))
        self.assertEqual(self.kb.search(self.docs, '电机制动器', []), [])
        self.docs['wiki1:n1']['status'] = 'missing'
        self.assertEqual(self.kb.search(self.docs, '液压驱动', []), [])

    def test_empty_or_generic_question_has_no_fabricated_sources(self):
        self.add('wiki1:n1', '方案', '机器人制动器')
        for query in ('', '请给我一些专业建议', '的了是在和与'):
            self.assertEqual(self.kb.search(self.docs, query, []), [])

    def test_named_project_does_not_get_displaced_by_generic_neighbor(self):
        self.add('wiki1:n1','轨道机器人','机器人技术风险：电机与传感器。')
        self.add('wiki1:n2','爬索机器人安全方案','制动保持测试，断电后防坠。')
        found=self.kb.search(self.docs,'爬索机器人技术风险',[])
        self.assertEqual(found[0]['key'],'wiki1:n2')
        self.assertNotIn('wiki1:n1',[s['key'] for s in found])
