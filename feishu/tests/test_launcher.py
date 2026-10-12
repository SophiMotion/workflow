import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from feishu import launcher


class LauncherTests(unittest.TestCase):
    def test_existing_service_is_reused_without_launching_another_process(self):
        with patch.object(launcher, 'status', return_value={'running': True}), \
                patch.object(launcher.subprocess, 'Popen') as spawn, \
                patch.object(launcher, 'load_agent') as load:
            launcher.ensure_running()
        spawn.assert_not_called()
        load.assert_not_called()

    def test_unrelated_service_on_port_is_not_treated_as_success(self):
        response = Mock()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = json.dumps({'service': 'another-project'}).encode()
        with patch.object(launcher.OPENER, 'open', return_value=response):
            with self.assertRaisesRegex(RuntimeError, '其他服务'):
                launcher.status()

    def test_cannot_disable_service_during_sync(self):
        with patch.object(launcher, 'status', return_value={'running': True}), \
                patch.object(launcher, 'launchctl') as launchctl:
            with self.assertRaisesRegex(RuntimeError, '同步'):
                launcher.disable_login()
        launchctl.assert_not_called()

    def test_old_healthy_service_does_not_hide_login_process_failure(self):
        with patch.object(launcher, 'status', return_value={'running': False}), \
                patch.object(launcher, 'launchctl', return_value=Mock(returncode=0, stdout='state = spawn scheduled\nlast exit code = 2')), \
                patch.object(launcher.time, 'sleep'), \
                patch.object(launcher.time, 'monotonic', side_effect=[0, 0, 2]):
            with self.assertRaisesRegex(RuntimeError, '后台未能运行'):
                launcher.wait_agent(timeout=1)

    def test_unrelated_login_item_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'agent.plist'
            path.write_bytes(b'not our launch agent')
            with patch.object(launcher, 'AGENT', path), \
                    patch.object(launcher, 'load_agent') as load:
                with self.assertRaisesRegex(RuntimeError, '启动项'):
                    launcher.install_login()
            self.assertEqual(path.read_bytes(), b'not our launch agent')
            load.assert_not_called()


if __name__ == '__main__':
    unittest.main()
