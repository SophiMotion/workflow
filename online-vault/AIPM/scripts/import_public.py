"""Import a pinned, openly licensed source cited by the Feishu homepage.

No browser credentials or private Feishu endpoints are used.
"""
from pathlib import Path
from urllib.parse import unquote, quote, urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'content' / 'hello-agents'
COMMIT = '5caceca4e4c9a3d25cd14627881436953f4d6912'
BASE = f'https://raw.githubusercontent.com/datawhalechina/hello-agents/{COMMIT}/'
OUT.mkdir(parents=True, exist_ok=True)

def fetch(url, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size:
        return
    temp = path.with_name(path.name + '.part')
    result = subprocess.run(['curl', '-fL', '--retry', '2', '--connect-timeout', '12', '--max-time', '90', '-sS', url, '-o', str(temp)], capture_output=True, text=True)
    if result.returncode:
        temp.unlink(missing_ok=True)
        raise RuntimeError(result.stderr.strip()[:250])
    temp.replace(path)

for name in ['README.md', 'LICENSE.txt']:
    fetch(BASE + name, OUT / name)
readme = (OUT / 'README.md').read_text()
chapters = []
for title, rel in re.findall(r'\[([^\]]+)\]\((\./docs/chapter\d+/[^)]+\.md)\)', readme):
    number = int(re.search(r'chapter(\d+)', rel)[1])
    if number <= 15:
        chapters.append({'number':number, 'title':title, 'path':unquote(rel.removeprefix('./'))})
assert len(chapters) == 15, f'Expected 15 chapters, got {len(chapters)}'

def chapter_download(ch):
    fetch(BASE + quote(ch['path']), OUT / ch['path'])
    return ch['title']

with ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(chapter_download, chapters):
        print('Saved chapter:', result, flush=True)

assets = {}
for ch in chapters:
    md = (OUT / ch['path']).read_text()
    refs = re.findall(r'!\[[^\]]*\]\(([^\n]+?)\)', md)
    refs += re.findall(r'<img\b[^>]*\bsrc=[\"\']([^\"\']+)', md, re.I)
    ch['assets'] = []
    for ref in refs:
        ref = ref.strip().strip('<>')
        ref = re.sub(r'\s+[\"\'][^\"\']*[\"\']$', '', ref)
        normalized = 'h' + ref if ref.startswith('ttps://raw.githubusercontent.com/') else ref
        absolute = urljoin(BASE + quote(ch['path']), normalized)
        same_repo = re.match(r'https://raw\.githubusercontent\.com/datawhalechina/hello-agents/(?:main|master)/(.+)', absolute, re.I)
        if same_repo:
            absolute = BASE + same_repo[1]
        parsed = urlparse(absolute)
        if parsed.scheme not in ['http', 'https']:
            continue
        if parsed.netloc == 'raw.githubusercontent.com' and parsed.path.startswith('/datawhalechina/hello-agents/' + COMMIT + '/'):
            local = unquote(parsed.path.split('/' + COMMIT + '/', 1)[1])
        else:
            suffix = Path(parsed.path).suffix.lower()
            if suffix not in ['.png','.jpg','.jpeg','.webp','.gif','.svg']:
                suffix = '.png'
            local = 'external/' + hashlib.sha256(absolute.encode()).hexdigest()[:24] + suffix
        if not (OUT / local).resolve().is_relative_to(OUT.resolve()):
            raise ValueError('Unsafe source asset path')
        ch['assets'].append({'reference':ref, 'url':absolute, 'local':local})
        assets[absolute] = local

failures = []
def asset_download(pair):
    url, local = pair
    try:
        fetch(url, OUT / local)
        return None
    except Exception as exc:
        return {'url':url, 'local':local, 'error':str(exc)}

print('Downloading referenced images:', len(assets), flush=True)
with ThreadPoolExecutor(max_workers=5) as pool:
    for i,result in enumerate(pool.map(asset_download, assets.items()),1):
        if result:
            failures.append(result)
        if i % 25 == 0:
            print(f'Images checked: {i}/{len(assets)}', flush=True)

manifest = {'repository':'https://github.com/datawhalechina/hello-agents', 'commit':COMMIT,
            'license':'CC BY-NC-SA 4.0', 'retrievedAt':'2026-09-23',
            'chapters':chapters, 'assetCount':len(assets), 'failedAssets':failures}
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(json.dumps({'chapters':len(chapters),'assets':len(assets),'failed':len(failures)}, ensure_ascii=False), flush=True)
