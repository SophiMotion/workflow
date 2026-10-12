"""Regressions for moved projects and ownership-safe login item updates."""
import importlib.util
import os
from pathlib import Path
import plistlib
import tempfile
import unittest

ROOT = Path(os.environ.get('SOPHI_TEST_ROOT', Path(__file__).resolve().parents[1]))
spec = importlib.util.spec_from_file_location('local_services', ROOT / 'scripts/local-services.py')
services = importlib.util.module_from_spec(spec)
spec.loader.exec_module(services)


class LocalServicesTests(unittest.TestCase):
    def test_every_registered_entrypoint_exists_after_project_moves(self):
        for name, relative, *_ in services.SERVICES:
            with self.subTest(service=name):
                self.assertTrue((ROOT / relative).is_file(), str(ROOT / relative))

    def write_agent(self, folder, script):
        file = Path(folder) / 'com.sophistudio.want.plist'
        file.write_bytes(plistlib.dumps({'Label': 'com.sophistudio.want',
                                        'ProgramArguments': ['/opt/homebrew/bin/node', script]}))
        return file

    def test_old_want_agent_can_migrate_to_the_moved_project(self):
        with tempfile.TemporaryDirectory() as folder:
            file = self.write_agent(folder, str(ROOT / 'want/server.mjs'))
            self.assertIsNotNone(services.owned_agent(file, 'want', 'boss/boss-1/want/server.mjs'))

    def test_another_projects_agent_is_never_taken_over_by_suffix(self):
        with tempfile.TemporaryDirectory() as folder:
            file = self.write_agent(folder, '/another/project/boss/boss-1/want/server.mjs')
            with self.assertRaises(RuntimeError):
                services.owned_agent(file, 'want', 'boss/boss-1/want/server.mjs')


if __name__ == '__main__':
    unittest.main()
