"""Import reviewed documentation from a pinned Git checkout as data only."""
from pathlib import Path
from urllib.parse import unquote, urlparse
from datetime import date
import json, subprocess, sys, posixpath

root=Path(sys.argv[1]).resolve()
source=Path(sys.argv[2]).resolve()
config=next(c for c in json.loads((root/'content/public-collections.json').read_text()) if c['id']==sys.argv[3])
out=root/'content'/config['id']
out.mkdir(parents=True,exist_ok=True)
commit=config['commit']
remote=subprocess.check_output(['git','-C',str(source),'remote','get-url','origin'],text=True).strip().removesuffix('.git')
assert remote==config['repository'], 'Source repository mismatch'
assert subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()==commit
def read_git(path):
    if path.startswith('/') or '..' in Path(path).parts:raise ValueError('Unsafe source path')
    return subprocess.check_output(['git','-C',str(source),'show',f'{commit}:{path}'])
def save(path,destination=None):
    target=out/(destination or path)
    if not target.resolve().is_relative_to(out):raise ValueError('Unsafe destination')
    target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists():target.write_bytes(read_git(path))
    return target
readme=save(config['readmeSource'],'README.md')
save('LICENSE','REPOSITORY-LICENSE.txt')
assert config['licenseMarker'] in readme.read_text()
docs=[]
for i,record in enumerate(config['documents']):
    doc={**record,'id':f"{config['id']}-{i+1:03}",'order':i+1}
    text=save(doc['path']).read_text()
    assert config['licenseMarker'] in text or ('license: '+config['license']) in text[:1800], 'Missing per-document license: '+doc['path']
    docs.append(doc)
metadata=json.loads(subprocess.check_output(['node',str(root/'scripts/markdown-metadata.mjs')],input=json.dumps([(out/d['path']).read_text() for d in docs]).encode()))
tree=set(subprocess.check_output(['git','-C',str(source),'ls-tree','-r','--name-only',commit],text=True).splitlines())
failed=[];images=set()
for doc,meta in zip(docs,metadata):
    doc['assets']=[];doc['unsavedMedia']=meta['media']
    for ref in meta['images']:
        parsed=urlparse(ref)
        if parsed.scheme or parsed.netloc:
            failed.append({'doc':doc['id'],'reference':ref,'error':'External image; not covered by repository-file import'})
            continue
        local=posixpath.normpath(posixpath.join(posixpath.dirname(doc['path']),unquote(parsed.path)))
        local=config.get('assetPathAliases',{}).get(local,local)
        if local not in tree:
            failed.append({'doc':doc['id'],'reference':ref,'error':'Referenced file absent from pinned Git tree'})
            continue
        save(local)
        doc['assets'].append({'reference':ref,'local':local,'url':config['repository']+'/tree/'+commit+'/'+local})
        images.add(local)
    print('Saved:',doc['title'],flush=True)
manifest={**config,'documents':docs,'retrievedAt':str(date.today()),'assetCount':len(images),'failedAssets':failed}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'documents':len(docs),'images':len(images),'failures':len(failed)},ensure_ascii=False))
