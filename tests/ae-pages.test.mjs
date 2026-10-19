import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = fileURLToPath(new URL('../ae/', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'upstream.json'), 'utf8'));

test('AE ships the complete upstream public build with documented entry adaptation', async () => {
  assert.equal(manifest.repository, 'https://github.com/SophiMotion/AE');
  for (const [path, expected] of Object.entries(manifest.files)) {
    const contents = await readFile(resolve(root, path));
    assert.equal(createHash('sha256').update(contents).digest('hex'), manifest.deployment_overrides?.[path]?.sha256 ?? expected, path);
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

function httpContext(crypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }) {
  const context = vm.createContext({ crypto, ArrayBuffer, Uint8Array, DOMException });
  context.window = context;
  return context;
}
async function loadCompatibility(context) {
  vm.runInContext(await readFile(resolve(root, 'vendor/sha256-0.11.1.min.js'), 'utf8'), context);
  vm.runInContext(await readFile(resolve(root, 'http-compat.js'), 'utf8'), context);
}
test('HTTP preview creates distinct RFC 4122 v4 draft identifiers using secure random bytes', async () => {
  const context = httpContext();
  await loadCompatibility(context);
  const ids = Array.from({ length: 256 }, () => context.crypto.randomUUID());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('HTTP draft binding digest agrees with native SHA-256 including byte offsets', async () => {
  const context = httpContext();
  await loadCompatibility(context);
  const backing = new Uint8Array([1, 2, 3, 4, 5]);
  for (const bytes of [new Uint8Array(), new TextEncoder().encode('abc'), new TextEncoder().encode('折叠机器人'), new Uint8Array(100000), backing.subarray(1, 4), new DataView(backing.buffer, 1, 3)]) {
    const actual = Buffer.from(await context.crypto.subtle.digest({ name: 'SHA-256' }, bytes)).toString('hex');
    const expected = createHash('sha256').update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest('hex');
    assert.equal(actual, expected);
  }
  const actual = await context.crypto.subtle.digest('sha-256', backing.buffer);
  assert.equal(Buffer.from(actual).toString('hex'), createHash('sha256').update(backing).digest('hex'));
  await assert.rejects(context.crypto.subtle.digest('SHA-1', backing), { name: 'NotSupportedError' });
  await assert.rejects(context.crypto.subtle.digest('SHA-256', 'abc'), { name: 'TypeError' });
});
test('HTTP compatibility preserves secure-context native crypto implementations', async () => {
  const context = httpContext(webcrypto);
  const uuid = webcrypto.randomUUID, subtle = webcrypto.subtle;
  await loadCompatibility(context);
  assert.equal(context.crypto.randomUUID, uuid);
  assert.equal(context.crypto.subtle, subtle);
});
test('HTTP compatibility loads before the application module', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('vendor/sha256-0.11.1.min.js') < html.indexOf('http-compat.js'));
  assert.ok(html.indexOf('http-compat.js') < html.indexOf('<script type="module"'));
});
