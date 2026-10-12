import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('payload',ROOT/'public/fusion/SkateChassis20260906/payload.py')
payload=importlib.util.module_from_spec(spec);spec.loader.exec_module(payload)

class PayloadTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        js="import {createProject} from './shared/domain.mjs'; import {fusionPayload} from './shared/fusion.mjs'; console.log(JSON.stringify(['none','dual6','dual12'].map(arm=>{const p=createProject();p.config.arm=arm;p.config.camera='depth';return fusionPayload(p)})));"
        cls.fixtures=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=ROOT))

    def test_web_payloads_and_expressions_match_geometry(self):
        for config in self.fixtures:
            payload.validate_payload(config)
            for body in config['bodies']:
                for exp,size in zip(body['sizeExpr'],body['size']):
                    self.assertAlmostEqual(payload.expression_value(exp,config['config']),size*1000,places=4)
                for exp,position in zip(body['positionExpr'],body['center']):
                    self.assertAlmostEqual(payload.expression_value(exp,config['config']),position*1000,places=4)

    def test_rejects_executable_or_excessive_expressions(self):
        for expression in ["__import__('os').system('whoami')",'body_length ** 1000','1 / 0','float("nan")','-10 mm','999999 mm']:
            fixture=copy.deepcopy(self.fixtures[0]);fixture['bodies'][0]['sizeExpr'][0]=expression
            with self.assertRaises((ValueError,SyntaxError,ZeroDivisionError)): payload.validate_payload(fixture)

    def test_rejects_duplicate_names_bad_schema_and_nonfinite_parameters(self):
        fixture=copy.deepcopy(self.fixtures[0]);fixture['bodies'].append(fixture['bodies'][0])
        with self.assertRaises(ValueError): payload.validate_payload(fixture)
        fixture=copy.deepcopy(self.fixtures[0]);fixture['schema']='invalid'
        with self.assertRaises(ValueError): payload.validate_payload(fixture)
        fixture=copy.deepcopy(self.fixtures[0]);fixture['config']['length']=float('nan')
        with self.assertRaises(ValueError): payload.validate_payload(fixture)

if __name__=='__main__': unittest.main()
