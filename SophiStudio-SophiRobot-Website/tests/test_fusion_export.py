import importlib.util,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
folder=ROOT/'public/fusion/SophiRobotExport'
spec=importlib.util.spec_from_file_location('export_core',folder/'export_core.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
schema=json.loads((folder/'schema.json').read_text());mapping=json.loads((folder/'mapping.json').read_text())
def request():
 c=json.loads((ROOT/'examples/default-configuration.json').read_text());c['fusionExport']={'version':1,'poseMode':'fusion'};return c
class Parameter:
 def __init__(self):self.expression='900 mm'
class ExportTests(unittest.TestCase):
 def plan(self,c=None):
  params={v['name']:Parameter() for group in mapping.values() for v in group.values()}
  return core.build_plan(c or request(),schema,mapping,params.get,lambda e,u:True),params
 def test_dimensions_and_units(self):
  plan,_=self.plan();self.assertEqual(len(plan),20);self.assertIn('30 deg',[x['expression'] for x in plan]);self.assertNotIn('structural_sheet',[x['key'] for x in plan])
 def test_website_pose_requires_all_joint_mappings(self):
  c=request();c['fusionExport']['poseMode']='website';plan,_=self.plan(c);self.assertEqual(len(plan),38)
  with self.assertRaisesRegex(ValueError,'arm_l.shoulder_lift'):core.build_plan(c,schema,mapping,lambda n:None,lambda e,u:True)
 def test_rejects_bad_source_and_values(self):
  for key,value in [('base_length',float('nan')),('base_width',False),('tube_thickness',100)]:
   c=request();c['parameters'][key]=value
   with self.assertRaises(ValueError):self.plan(c)
  c=request();c['sourceSha256']='other'
  with self.assertRaises(ValueError):self.plan(c)
 def test_bad_units_and_duplicate_mapping(self):
  with self.assertRaisesRegex(ValueError,'unit'):core.build_plan(request(),schema,mapping,lambda n:Parameter(),lambda e,u:False)
  m=json.loads(json.dumps(mapping));m['dimensions']['base_width']['name']=m['dimensions']['base_length']['name']
  with self.assertRaisesRegex(ValueError,'Duplicate'):core.build_plan(request(),schema,m,lambda n:Parameter(),lambda e,u:True)
 def test_success_restores_original_expressions(self):
  plan,_=self.plan();calls=[]
  def apply(items,expressions):
   for p,e in zip(items,expressions):p.expression=e
   return True
  core.run_transaction(plan,apply,lambda:True,lambda:calls.append('export'))
  self.assertEqual(calls,['export']);self.assertTrue(all(x['parameter'].expression=='900 mm' for x in plan))
 def test_failure_restores_and_never_exports_bad_geometry(self):
  plan,_=self.plan();calls=[];count=[0]
  def apply(items,expressions):
   for p,e in zip(items,expressions):p.expression=e
   return True
  def compute():count[0]+=1;return count[0]>1
  with self.assertRaisesRegex(RuntimeError,'rebuild'):core.run_transaction(plan,apply,compute,lambda:calls.append('export'))
  self.assertEqual(calls,[]);self.assertTrue(all(x['parameter'].expression=='900 mm' for x in plan))
 def test_export_failure_restores_original_values(self):
  plan,_=self.plan()
  def apply(items,expressions):
   for p,e in zip(items,expressions):p.expression=e
   return True
  def fail():raise RuntimeError('Translator failed')
  with self.assertRaisesRegex(RuntimeError,'Translator'):core.run_transaction(plan,apply,lambda:True,fail)
  self.assertTrue(all(x['parameter'].expression=='900 mm' for x in plan))
 def test_scale_offset_and_joint_sign(self):
  c=request();c['fusionExport']['poseMode']='website';c['limbs']['pose']['leg_l']['elbow_bend']=30
  m=json.loads(json.dumps(mapping));m['joints']['leg_l.elbow_bend']['scale']=-1;m['dimensions']['total_height']['offset']=-100
  plan=core.build_plan(c,schema,m,lambda n:Parameter(),lambda p,e:True)
  values={x['key']:x['expression'] for x in plan};self.assertEqual(values['leg_l.elbow_bend'],'-30 deg');self.assertEqual(values['total_height'],'1775.75 mm')
 def test_head_mapping_and_limits(self):
  c=request();c['fusionExport']={'version':2,'poseMode':'website'};c['head']={'pose':{'rotation':70,'tilt':-20},'movable':True}
  plan,_=self.plan(c);values={x['key']:x['expression'] for x in plan};self.assertEqual(values['head.rotation'],'70 deg');self.assertEqual(values['head.tilt'],'-20 deg')
  c['head']['pose']['tilt']=31
  with self.assertRaises(ValueError):self.plan(c)
 def test_failed_restore_is_reported(self):
  plan,_=self.plan();count=[0]
  def apply(p,e):count[0]+=1;return count[0]==1
  with self.assertRaisesRegex(RuntimeError,'restore'):core.run_transaction(plan,apply,lambda:True,lambda:None)
if __name__=='__main__':unittest.main()
