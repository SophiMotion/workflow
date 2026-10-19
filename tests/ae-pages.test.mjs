import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = fileURLToPath(new URL('../ae/', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'upstream.json'), 'utf8'));

test('AE ships the complete, unchanged upstream public build', async () => {
  assert.equal(manifest.repository, 'https://github.com/SophiMotion/AE');
  for (const [path, expected] of Object.entries(manifest.files)) {
    const contents = await readFile(resolve(root, path));
    assert.equal(createHash('sha256').update(contents).digest('hex'), expected, path);
  }
});

test('AE entry and lazy module assets resolve within its subdirectory', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(m => ['index.html', m[1]]);
  assert.ok(refs.some(([, path]) => path.endsWith('.js')));
  for (const path of Object.keys(manifest.files).filter(p => p.endsWith('.js'))) {
    const source = await readFile(resolve(root, path), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()(["'])(\.\/[^"']+)\1/g)) {
      refs.push([path, match[2]]);
    }
    for (const match of source.matchAll(/new URL\s*\(["'](\.\/[^"']+)["'],\s*import\.meta\.url/g)) {
      refs.push([path, match[1]]);
    }
    // Vite's preload dependency table uses paths relative to the entry HTML.
    for (const match of source.matchAll(/["'](assets\/[^"']+\.(?:js|css))["']/g)) {
      refs.push(['index.html', match[1]]);
    }
  }
  for (const [parent, path] of refs) {
    const target = resolve(root, dirname(parent), path);
    assert.ok(target.startsWith(root), `${parent}: ${path}`);
    await access(target);
  }
  assert.ok(refs.length > 30, 'cover lazy-loaded assets as well as the entry');
});

test('AE includes the requested public example and downloadable package', async () => {
  const data = JSON.parse(await readFile(resolve(root, 'public-demo.json'), 'utf8'));
  assert.ok(data.projects.some(project => project.id === 'public-sophicore-wave'));
  assert.ok((await readFile(resolve(root, 'model.bin'))).length > 0);
  assert.equal((await readFile(resolve(root, 'foldbot-example.zip'))).subarray(0, 4).toString('hex'), '504b0304');
});

test('AE deploys the preview iframe and preserves its provenance hash', async () => {
  const provenance = JSON.parse(await readFile(resolve(root, 'foldbot-console-provenance.json'), 'utf8'));
  for (const output of provenance.outputs.filter(item => item.mode !== 'local')) {
    const body = await readFile(resolve(root, output.path));
    assert.equal(createHash('sha256').update(body).digest('hex'), output.sha256);
  }
  await assert.rejects(access(resolve(root, 'foldbot-console-local.html')), { code: 'ENOENT' });
});
