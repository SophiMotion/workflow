import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from feishu.ai_config import AIConfig
from feishu.consultation import Consultations, model_environment
from feishu.storage import write_json


class ConfigTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base=Path(self.tmp.name)
        self.project=self.base/'project'
        self.project.mkdir()
        self.harness=self.base/'harness'
        self.harness.mkdir()
        self.config=AIConfig(self.project,self.harness)

    def test_placeholder_does_not_override_existing_harness_key(self):
        (self.harness/'.credentials.yaml').write_text('version: 1\nrefs:\n  DEEPSEEK_API_KEY: sk-unit-test-secret\n')
        (self.base/'.env').write_text('DEEPSEEK_API_KEY=your_deepseek_api_key_here\n')
        with patch.dict('os.environ',{},clear=True):
            values,_=self.config.values()
            self.assertEqual(values['DEEPSEEK_API_KEY'],'sk-unit-test-secret')

    def test_keys_never_returned_and_saved_file_private_and_blank_preserves(self):
        self.config.save({'openai_key':'sk-unit-test-openai','deepseek_key':'sk-unit-test-deepseek'})
        self.config.save({'openai_key':'','deepseek_key':''})
        self.assertEqual(self.config.path.stat().st_mode & 0o777,0o600)
        self.assertNotIn('sk-unit-test',json.dumps(self.config.public()))
        with patch.dict('os.environ',{},clear=True):
            self.assertEqual(self.config.ready()['OPENAI_API_KEY'],'sk-unit-test-openai')

    def test_invalid_config_does_not_overwrite(self):
        self.config.save({})
        before=self.config.path.read_text()
        with self.assertRaises(ValueError):self.config.save({'openai_model':'x\nOPENAI_API_KEY=oops'})
        self.assertEqual(before,self.config.path.read_text())

    def test_model_child_uses_existing_system_proxy_without_loading_unrelated_env(self):
        with patch('feishu.consultation.getproxies',return_value={'https':'http://127.0.0.1:7897'}),patch.dict('os.environ',{'UNRELATED_SECRET':'secret'}):
            env=model_environment({'OPENAI_API_KEY':'a','DEEPSEEK_API_KEY':'b'},self.project)
        self.assertEqual(env['NODE_USE_ENV_PROXY'],'1')
        self.assertEqual(env['HTTPS_PROXY'],'http://127.0.0.1:7897')
        self.assertNotIn('UNRELATED_SECRET',env)


class JobTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.project=Path(self.tmp.name);self.root=self.project/'feishu'
        self.kb=Mock();self.config=Mock();self.config.redact.side_effect=lambda text:text
        self.jobs=Consultations(self.root,self.project,self.kb,lambda:{},self.config)
        self.addCleanup(self.jobs.close)

    def wait(self):
        until=time.time()+3
        while self.jobs.active and time.time()<until:time.sleep(.01)
        self.assertIsNone(self.jobs.active)

    def test_no_evidence_does_not_send_any_model_request(self):
        self.kb.search.return_value=[]
        with patch('feishu.consultation.subprocess.Popen') as process:
            job=self.jobs.start({'question':'无资料的问题'})
            self.wait()
        self.assertEqual(self.jobs.get(job['id'])['status'],'needs_context')
        process.assert_not_called();self.config.ready.assert_not_called()

    def test_missing_credentials_retains_sources_and_explains_failure(self):
        self.kb.search.return_value=[{'id':'S1','text':'相关资料'}]
        self.config.ready.side_effect=ValueError('请配置 API Key')
        job=self.jobs.start({'question':'机器人制动方案'})
        self.wait();result=self.jobs.get(job['id'])
        self.assertEqual(result['status'],'failed');self.assertEqual(len(result['sources']),1)
        self.assertIn('API Key',result['message'])

    def test_cancel_during_retrieval_prevents_model_requests(self):
        import threading
        entered,release=threading.Event(),threading.Event()
        def search(*args):entered.set();release.wait(2);return [{'id':'S1'}]
        self.kb.search.side_effect=search
        job=self.jobs.start({'question':'机器人安全设计'});self.assertTrue(entered.wait(1))
        self.jobs.cancel(job['id']);release.set();self.wait()
        self.assertEqual(self.jobs.get(job['id'])['status'],'cancelled');self.config.ready.assert_not_called()

    def test_restart_marks_inflight_jobs_interrupted(self):
        write_json(self.root/'.state/consultations.json',[{'id':'example','status':'running','question':'问题'}])
        restarted=Consultations(self.root,self.project,self.kb,lambda:{},self.config)
        self.assertEqual(restarted.get('example')['status'],'interrupted')
