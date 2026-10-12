"""Import explicitly verified, openly licensed documentation collections.

Reads a reviewed source config. Fetches data only; never runs repository code.
"""
from pathlib import Path
from urllib.parse import unquote, quote, urljoin, urlparse, urlunparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
configs = json.loads((ROOT / 'content/public-collections.json').read_text())
config = next(c for c in configs if c['id'] == sys.argv[1])
OUT = ROOT / 'content' / config['id']
repo = config['repository'].removeprefix('https://github.com/')
BASE = f"https://raw.githubusercontent.com/{repo}/{config['commit']}/"

def fetch(url, path, retries=3, timeout=90):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size:
        return
    temp = path.with_name(path.name + '.part')
    result = subprocess.run(['curl','-fL','--http1.1','--retry-all-errors','--retry',str(retries),'--connect-timeout','12','--max-time',str(timeout),'-sS',url,'-o',str(temp)],capture_output=True,text=True)
    if result.returncode:
        temp.unlink(missing_ok=True)
        raise RuntimeError(result.stderr.strip()[:250])
    temp.replace(path)

fetch(BASE+'README.md', OUT/'README.md')
readme = (OUT/'README.md').read_text()
if config.get('licenseFile'):
    fetch(BASE+quote(config['licenseFile']), OUT/config['licenseFile'])
license_evidence = (OUT/config['licenseFile']).read_text() if config.get('licenseFile') else readme
if config.get('licenseMarker','by-nc-sa/4.0') not in license_evidence:
    raise RuntimeError('Expected license evidence missing; stop before import.')
docs = []
group = config.get('defaultGroup', '')
for line in readme.splitlines():
    chapter = re.search(r'^\*\*(第.+?)\*\*', line)
    if chapter:
        group = chapter[1]
    for title, rel in re.findall(r'\[([^\]]+)\]\((\./docs/chapter\d+/[^)]+\.md)\)', line):
        local = unquote(rel.removeprefix('./'))
        if config.get('documentPaths') and local not in config['documentPaths']:
            continue
        if local not in [d['path'] for d in docs]:
            docs.append({'id':f"{config['id']}-{len(docs)+1:02}",'title':title,'path':local,'group':group,'order':len(docs)+1,'sourceUrl':config.get('documentSources',{}).get(local)})
if config.get('documents'):
    docs = [{**d,'id':f"{config['id']}-{i+1:03}",'order':i+1} for i,d in enumerate(config['documents'])]
if len(docs) != config['expectedDocuments']:
    raise RuntimeError(f"Expected {config['expectedDocuments']} documents, got {len(docs)}")

def save_document(doc):
    if not (OUT/doc['path']).resolve().is_relative_to(OUT.resolve()):raise ValueError('Unsafe document path')
    fetch(BASE+quote(doc['path']),OUT/doc['path'])
    return doc['title']
with ThreadPoolExecutor(max_workers=4) as pool:
    for title in pool.map(save_document,docs):
        print('Saved:',title,flush=True)

metadata=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/markdown-metadata.mjs')],input=json.dumps([(OUT/doc['path']).read_text() for doc in docs]).encode()))
previous_path=OUT/'manifest.json'
previous=json.loads(previous_path.read_text()) if previous_path.exists() else {}
previous_docs={d['path']:d for d in previous.get('documents',[])} if previous.get('commit')==config['commit'] else {}
assets = {}
for doc,meta in zip(docs,metadata):
    if config.get('titleFromHeading') and meta['title'] and (config['titleFromHeading']!='readme' or Path(doc['path']).stem.lower()=='readme'):
        doc['title']=meta['title']
    refs=meta['images']
    doc['mediaReferences']=meta['media']
    doc['mediaAssets']=[a for a in previous_docs.get(doc['path'],{}).get('mediaAssets',[]) if a['reference'] in meta['media']]
    saved_media={a['reference'] for a in doc['mediaAssets'] if (OUT/a['local']).is_file()}
    doc['unsavedMedia']=[r for r in meta['media'] if r not in saved_media]
    doc['assets']=[]
    for ref in refs:
        ref=re.sub(r'\s+[\"\'][^\"\']*[\"\']$','',ref.strip().strip('<>'))
        absolute=urljoin(BASE+quote(doc['path']),ref)
        absolute=re.sub(r'https://raw\.githubusercontent\.com/'+re.escape(repo)+r'/(?:main|master)/',BASE,absolute,flags=re.I)
        parsed=urlparse(absolute)
        if parsed.scheme not in ['http','https']:
            continue
        absolute=urlunparse(parsed._replace(path=quote(parsed.path,safe='/%:@')))
        if absolute.startswith(BASE):
            local=unquote(parsed.path.split('/'+config['commit']+'/',1)[1])
        else:
            ext=Path(parsed.path).suffix.lower()
            if ext not in ['.png','.jpg','.jpeg','.svg','.gif','.webp']:ext='.png'
            local='external/'+hashlib.sha256(absolute.encode()).hexdigest()[:24]+ext
        if not (OUT/local).resolve().is_relative_to(OUT.resolve()):raise ValueError('Unsafe asset path')
        doc['assets'].append({'reference':ref,'url':absolute,'local':local})
        assets[absolute]=local

def save_asset(item):
    url,local=item
    try:
        fetch(url,OUT/local,retries=1,timeout=35)
    except Exception as error:
        return {'url':url,'local':local,'error':str(error)}
with ThreadPoolExecutor(max_workers=3) as pool:
    failed=[item for item in pool.map(save_asset,assets.items()) if item]
manifest={**config,'retrievedAt':str(date.today()),'documents':docs,'assetCount':len(assets),'failedAssets':failed}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'documents':len(docs),'assets':len(assets),'failures':len(failed)}),flush=True)
