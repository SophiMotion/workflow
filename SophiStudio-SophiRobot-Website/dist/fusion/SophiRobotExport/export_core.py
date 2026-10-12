"""Pure validation and transaction logic; deliberately independent of Autodesk imports."""
import math

def number(value):
 return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def build_plan(request,schema,mapping,lookup,valid_unit):
 if not isinstance(request,dict) or request.get('version')!=1 or request.get('sourceSha256')!=schema['sourceSha256']:
  raise ValueError('Configuration is not for the supported SophiRobot model 4.')
 export=request.get('fusionExport',{})
 if export.get('version') not in (1,2) or export.get('poseMode') not in ('fusion','website'):
  raise ValueError('Download an Export via Fusion 360 request from the website.')
 params=request.get('parameters',{}); entries=[]
 for field in schema['fields']:
  key=field['key'];v=params.get(key)
  if not number(v) or not field['min']<=v<=field['max']:raise ValueError('Invalid dimension: '+key)
  if key!='structural_sheet':entries.append((key,v,field['unit'],mapping.get('dimensions',{}).get(key)))
 if export['poseMode']=='website':
  poses=request.get('limbs',{}).get('pose',{})
  for limb,joints in schema['joints'].items():
   for joint in joints:
    key=limb+'.'+joint['key'];v=poses.get(limb,{}).get(joint['key'])
    if not number(v) or not joint['min']<=v<=joint['max']:raise ValueError('Invalid joint angle: '+key)
    entries.append((key,v,'deg',mapping.get('joints',{}).get(key)))
  head=request.get('head',{'pose':{'rotation':0,'tilt':0},'movable':False})
  if not isinstance(head,dict) or not isinstance(head.get('pose'),dict):raise ValueError('Invalid head configuration.')
  for joint in schema.get('head',[]):
   key='head.'+joint['key'];v=head['pose'].get(joint['key'])
   if not number(v) or not joint['min']<=v<=joint['max']:raise ValueError('Invalid head angle: '+key)
   entries.append((key,v,'deg',mapping.get('joints',{}).get(key)))
 plan=[];errors=[];seen=set()
 for key,value,unit,item in entries:
  if not isinstance(item,dict) or not isinstance(item.get('name'),str) or not item['name']:
   errors.append('Missing mapping: '+key);continue
  name=item['name'];scale=item.get('scale',1);offset=item.get('offset',0)
  if not number(scale) or scale==0 or not number(offset):errors.append('Invalid scale/offset: '+key);continue
  if name in seen:errors.append('Duplicate target parameter: '+name)
  seen.add(name);parameter=lookup(name)
  if parameter is None:errors.append(key+' -> missing native user parameter '+name);continue
  transformed=value*scale+offset
  if not number(transformed):errors.append('Invalid mapped value: '+key);continue
  expression=format(transformed,'.15g')+' '+unit
  if not valid_unit(parameter,expression):errors.append('Incompatible unit: '+key+' -> '+name);continue
  plan.append({'key':key,'name':name,'expression':expression,'parameter':parameter})
 if errors:raise ValueError('Fusion mapping check failed. Edit mapping.json and verify the native design.\n\n'+'\n'.join(errors))
 return plan

def run_transaction(plan,apply,compute,export):
 parameters=[x['parameter'] for x in plan];original=[p.expression for p in parameters]
 try:
  if not apply(parameters,[x['expression'] for x in plan]):raise RuntimeError('Fusion refused the parameter update.')
  if not compute():raise RuntimeError('Fusion rebuild failed; STEP export stopped.')
  export()
 finally:
  if not apply(parameters,original) or not compute():raise RuntimeError('Could not restore the original Fusion parameters. Inspect the open document before saving. The STEP output has not been finalized.')
