#!/usr/bin/env python3
"""Submit exactly one image-to-world job; resume by operation ID after interruption."""
import argparse,getpass,json,os,time,re,hashlib
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
BASE='https://api.worldlabs.ai/marble/v1'
def main():
 p=argparse.ArgumentParser();p.add_argument('--image',type=Path);p.add_argument('--prompt',type=Path);p.add_argument('--out',type=Path,required=True);p.add_argument('--resume',action='store_true');a=p.parse_args()
 key=os.environ.get('WORLDLABS_API_KEY') or getpass.getpass('World Labs API key (hidden): ')
 def save(name,data):
  f=a.out/name;t=f.with_suffix(f.suffix+'.tmp');t.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');t.replace(f)
 def api(path,body=None):
  req=Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={'WLT-Api-Key':key,'Content-Type':'application/json'})
  try:
   with urlopen(req,timeout=60) as r:return json.load(r)
  except HTTPError as e:raise RuntimeError('World API HTTP '+str(e.code)+' at '+path.split('/')[1]) from None
 if a.resume:
  op=json.loads((a.out/'operation.json').read_text())
 else:
  if not a.image or not a.prompt:p.error('--image and --prompt required for a new job')
  a.out.mkdir(parents=True,exist_ok=False)
  balance=api('/credits');save('credits-before.json',balance)
  if balance.get('remaining_credits',0)<1580:raise RuntimeError('Insufficient prepaid balance for fixed-price Marble 1.1 image job')
  asset=api('/media-assets:prepare_upload',{'file_name':a.image.name[:64],'kind':'image','extension':'png','metadata':{'project':'sophi-worlds','purpose':'campus-concept-area-4x'}})
  media=asset['media_asset'];info=asset['upload_info'];save('media-asset.json',media)
  headers=info.get('required_headers') or {};headers.setdefault('Content-Type','image/png')
  req=Request(info['upload_url'],data=a.image.read_bytes(),method=info.get('upload_method') or 'PUT',headers=headers)
  with urlopen(req,timeout=120) as r:
   if r.status not in (200,201,204):raise RuntimeError('Media upload failed')
  print('Reference image uploaded.',flush=True)
  request={'display_name':'Sophi Campus 4x - concept 2026-10-02','model':'marble-1.1','world_prompt':{'type':'image','image_prompt':{'source':'media_asset','media_asset_id':media['media_asset_id']},'is_pano':False,'text_prompt':a.prompt.read_text()}}
  save('request.json',request);save('submission.json',{'status':'submitting-once','estimated_credits':1580,'image_sha256':hashlib.sha256(a.image.read_bytes()).hexdigest()})
  op=api('/worlds:generate',request);save('operation.json',op)
  save('submission.json',{'status':'accepted','operation_id':op['operation_id'],'estimated_credits':1580})
  print(json.dumps({'submitted_once':True,'operation_id':op['operation_id']}),flush=True)
 operation_id=op['operation_id'];deadline=time.monotonic()+1500;last=None
 while True:
  op=api('/operations/'+operation_id);save('operation.json',op)
  state={'done':op.get('done',False),'progress':(op.get('metadata') or {}).get('progress')}
  if state!=last:print(json.dumps(state),flush=True);last=state
  if op.get('error'):raise RuntimeError('Generation failed; inspect operation.json. No resubmission made.')
  if op.get('done'):
   snap=op.get('response') or {};snap=snap.get('world',snap)
   wid=snap.get('world_id') or snap.get('id') or (op.get('metadata') or {}).get('world_id')
   if not wid or not re.fullmatch(r'[A-Za-z0-9_-]+',wid):raise RuntimeError('Completed operation lacks valid world ID')
   r=api('/worlds/'+wid);world=r.get('world',r);save('world.json',world)
   balance=api('/credits');save('credits-after.json',balance)
   print(json.dumps({'completed':True,'world_id':wid,'remaining_credits':balance.get('remaining_credits'),'saved_world':str(a.out/'world.json')}),flush=True)
   return
  if time.monotonic()>deadline:print('Still pending. Resume this exact operation with --resume.',flush=True);return
  time.sleep(10)
if __name__=='__main__':
 try:main()
 except Exception as e:
  # Never print request headers, upload URLs, or credential values.
  print('Job stopped:',str(e) if isinstance(e,(RuntimeError,ValueError,FileExistsError)) else type(e).__name__,flush=True)
  raise SystemExit(1)
