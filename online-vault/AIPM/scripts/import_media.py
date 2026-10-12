"""Save media referenced by already reviewed public collections; execute no source code."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, unquote, urljoin
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
config = next(c for c in json.loads((root/'content/public-collections.json').read_text()) if c['id'] == sys.argv[1])
out = root/'content'/config['id']
manifest_path = out/'manifest.json'
manifest = json.loads(manifest_path.read_text())
assert manifest['commit'] == config['commit']
base = f"https://raw.githubusercontent.com/{config['repository'].removeprefix('https://github.com/')}/{config['commit']}/"
assets = {}
for doc in manifest['documents']:
    refs = doc.get('mediaReferences', doc.get('unsavedMedia', []))
    doc['mediaReferences'] = refs
    doc['mediaAssets'] = []
    for ref in refs:
        url = urljoin(base+quote(doc['path']), ref)
        if not url.startswith(base):
            continue  # External media requires its own source and reuse review.
        local = unquote(url[len(base):])
        if not (out/local).resolve().is_relative_to(out.resolve()):
            raise ValueError('Unsafe media path')
        asset = {'reference': ref, 'url': url, 'local': local}
        doc['mediaAssets'].append(asset)
        assets[url] = local

def save(item):
    url, local = item
    dest = out/local
    if dest.is_file() and dest.stat().st_size:
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_name(dest.name+'.part')
    result = subprocess.run(['curl','-fL','--http1.1','--retry','1','--connect-timeout','12','--max-time','120','-sS',url,'-o',str(temp)],capture_output=True,text=True)
    if result.returncode:
        temp.unlink(missing_ok=True)
        return {'url':url,'error':result.stderr.strip()[:250]}
    with temp.open('rb') as stream:
        is_pointer = stream.read(80).startswith(b'version https://git-lfs.github.com/')
    if is_pointer:
        temp.unlink()
        return {'url':url,'error':'Git LFS pointer; media bytes not saved'}
    temp.replace(dest)
    print('Saved media:',local,flush=True)
    return None

with ThreadPoolExecutor(max_workers=3) as pool:
    failed = [r for r in pool.map(save,assets.items()) if r]
for doc in manifest['documents']:
    saved = {a['reference'] for a in doc['mediaAssets'] if (out/a['local']).is_file() and (out/a['local']).stat().st_size}
    doc['unsavedMedia'] = [r for r in doc['mediaReferences'] if r not in saved]
manifest['failedMedia'] = failed
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'uniqueMedia':len(assets),'failed':len(failed),'unsavedReferences':sum(len(d['unsavedMedia']) for d in manifest['documents'])}))
