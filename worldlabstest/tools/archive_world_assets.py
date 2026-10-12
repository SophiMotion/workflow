#!/usr/bin/env python3
"""Archive a completed world's referenced assets, with hashes, without any API credential."""
import argparse,concurrent.futures,hashlib,json
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse

def image_suffix(url):
 suffix=Path(urlparse(url).path).suffix.lower()
 if suffix not in {'.png','.jpg','.jpeg','.webp'}:raise ValueError('Unknown image extension')
 return suffix

def main():
 p=argparse.ArgumentParser();p.add_argument('--world',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
 w=json.loads(a.world.read_text());assets=w.get('assets') or {};sources=[]
 for quality,url in (assets.get('splats',{}).get('spz_urls') or {}).items():
  if quality in {'100k','500k','full_res'} and url:sources.append((quality+'.spz',url))
 mesh=assets.get('mesh') or {}
 if mesh.get('collider_mesh_url'):sources.append(('collider.glb',mesh['collider_mesh_url']))
 imagery=assets.get('imagery') or {}
 if imagery.get('pano_url'):sources.append(('panorama'+image_suffix(imagery['pano_url']),imagery['pano_url']))
 if assets.get('thumbnail_url'):sources.append(('thumbnail'+image_suffix(assets['thumbnail_url']),assets['thumbnail_url']))
 a.out.mkdir(parents=True,exist_ok=True)
 def fetch(item):
  name,url=item;parsed=urlparse(url)
  if parsed.scheme!='https' or parsed.username or parsed.password:raise ValueError('Asset must be HTTPS')
  final=a.out/name;temporary=final.with_suffix(final.suffix+'.part');h=hashlib.sha256();size=0
  with urlopen(url,timeout=120) as response,temporary.open('wb') as out:
   while True:
    chunk=response.read(1024*1024)
    if not chunk:break
    out.write(chunk);h.update(chunk);size+=len(chunk)
  temporary.replace(final)
  print(json.dumps({'archived':name,'bytes':size}),flush=True)
  return {'file':name,'source':url,'sha256':h.hexdigest(),'bytes':size}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:records=list(pool.map(fetch,sources))
 (a.out/'provenance.json').write_text(json.dumps({'world_id':w.get('world_id') or w.get('id'),'world_marble_url':w.get('world_marble_url'),'semantics':assets.get('splats',{}).get('semantics_metadata'),'assets':records},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'asset_count':len(records),'total_bytes':sum(r['bytes'] for r in records)}))
if __name__=='__main__':main()
