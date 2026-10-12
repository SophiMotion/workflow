"""本机传输边界与任务去重 / Loopback origin, token and job-state regression checks."""
import json
from pathlib import Path
import unittest
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError
from mooncake.local_bridge import Bridge


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.wakes = []
        self.bridge = Bridge(lambda: self.wakes.append(True) or True, port=0)
        self.bridge.start()
        self.base = 'http://127.0.0.1:{}'.format(self.bridge.server.server_port)
        self.opener = build_opener(ProxyHandler({}))
        self.raw = (Path(__file__).resolve().parents[1] / 'mooncake/examples/lotus.json').read_bytes()
        self.job = 'a1111111-1111-4111-a111-111111111111'

    def tearDown(self):
        self.bridge.stop()

    def call(self, path, data=None, origin='http://127.0.0.1:5173', token=None, job=None, method=None):
        headers = {'Origin': origin, 'Content-Type': 'application/json', 'X-Mooncake-Job': job or self.job}
        if token:
            headers['X-Mooncake-Token'] = token
        req = Request(self.base + path, data=data, headers=headers, method=method)
        try:
            reply = self.opener.open(req, timeout=10)
        except HTTPError as exc:
            reply = exc
        with reply:
            return reply.status, json.loads(reply.read())

    def test_session_rejects_remote_websites(self):
        self.assertEqual(self.call('/session', origin='https://untrusted.example')[0], 403)
        code, reply = self.call('/session')
        self.assertEqual(code, 200)
        self.assertEqual(reply['service'], 'mooncake.fusion')
        self.assertTrue(reply['pluginPath'].endswith('/mooncake'))

    def test_token_required_for_build_and_job(self):
        self.assertEqual(self.call('/jobs', self.raw)[0], 403)
        self.assertEqual(self.call('/jobs/' + self.job)[0], 403)
        self.assertEqual(self.wakes, [])

    def test_preflight_supports_offline_html(self):
        self.assertEqual(self.call('/jobs', origin='null', method='OPTIONS')[0], 200)

    def test_idempotent_submission_and_busy(self):
        token = self.bridge.token
        self.assertEqual(self.call('/jobs', self.raw, token=token)[0], 202)
        self.assertEqual(self.call('/jobs', self.raw, token=token)[0], 202)
        self.assertEqual(len(self.wakes), 1)
        self.assertEqual(self.call('/jobs', self.raw, token=token, job=self.job.replace('a', 'b'))[0], 409)
        job, data = self.bridge.take()
        self.assertEqual(job, self.job)
        self.assertEqual(data['front']['pattern'], 'lotus')
        self.assertNotIn('data', self.call('/jobs/' + job, token=token)[1])
        self.bridge.finish(job, {'ok': True, 'message': '完成', 'filePath': '/example.f3d'})
        result = self.call('/jobs/' + job, token=token)[1]
        self.assertEqual(result['state'], 'complete')
        self.assertEqual(self.call('/jobs', self.raw, token=token, job=self.job.replace('a', 'b'))[0], 202)

    def test_invalid_data_never_reaches_fusion(self):
        self.assertEqual(self.call('/jobs', b'{"schema":"evil"}', token=self.bridge.token)[0], 400)
        self.assertEqual(self.call('/jobs', self.raw, token=self.bridge.token, job='../bad')[0], 400)
        self.assertEqual(self.wakes, [])

    def test_wake_failure_is_reported_and_unlocks(self):
        def fail():
            raise RuntimeError('event failure')
        self.bridge.wake = fail
        self.assertEqual(self.call('/jobs', self.raw, token=self.bridge.token)[0], 409)
        self.assertEqual(self.bridge.status(self.job)['state'], 'failed')
        self.assertIsNone(self.bridge.take())

    def test_false_dispatch_result_waits_for_actual_callback(self):
        self.bridge.wake = lambda: False
        code, result = self.call('/jobs', self.raw, token=self.bridge.token)
        self.assertEqual(code, 202)
        self.assertEqual(result['state'], 'queued')
        self.assertEqual(self.bridge.take()[0], self.job)


if __name__ == '__main__':
    unittest.main()
