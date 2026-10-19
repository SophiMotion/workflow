import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = await readFile(resolve(root, 'unit/js/config.js'), 'utf8');
const views = await readFile(resolve(root, 'unit/js/views.js'), 'utf8');
function cards(base) {
  const context = { window: {}, URL, document: { currentScript: { src: `${base}unit/js/config.js` }, body: { dataset: { workflowScope: 'engineering' } } } };
  vm.runInNewContext(config, context);
  vm.runInNewContext(views, context);
  return [...context.window.PFXViews.renderWorkflow().matchAll(/data-module="([^"]+)"[^>]+href="([^"]+)"/g)]
    .map(([, id, href]) => ({ id, href: context.window.PFX_PATHS.resolve(href) }));
}
test('all 13 hosted cards stay under the Pages subpath and point to shipped entries', async () => {
  for (const base of ['https://sophimotion.github.io/workflow/', 'https://example.com/tools/workflow/', 'https://sophistudio.com/']) {
    const links = cards(base);
    assert.equal(links.length, 13);
    assert.equal(links.some(({ id }) => id === 'skatechassis'), false);
    for (const { id, href } of links) {
      assert.ok(href.startsWith(base), `${id} escapes the hosted site: ${href}`);
      await access(resolve(root, decodeURIComponent(new URL(href).pathname.slice(new URL(base).pathname.length))));
    }
  }
});
test('local file and HTTP previews preserve local service URLs including the HIL bridge', () => {
  const expected = {
    sophirobot: 'http://127.0.0.1:4189/',
    hil: 'http://127.0.0.1:8247/hil.html',
    'sophicar-formate': 'http://127.0.0.1:4173/studio/sophicar-formate/web/dist/index.html',
    'drone-formation': 'http://127.0.0.1:4188/'
  };
  for (const base of ['file:///example/workflow/', 'http://127.0.0.1:4173/studio/', 'http://localhost:8080/workflow/']) {
    const byId = Object.fromEntries(cards(base).map(({ id, href }) => [id, href]));
    for (const [id, href] of Object.entries(expected)) assert.equal(byId[id], href);
  }
});

test('AE card preserves its project query at hosted and local entries', () => {
  for (const base of ['https://sophistudio.com/', 'https://sophimotion.github.io/workflow/', 'http://127.0.0.1:4187/']) {
    const ae = cards(base).find(({ id }) => id === 'ae');
    assert.equal(ae.href, `${base}ae/?project=public-sophicore-wave`);
  }
});

// Validate the deployed artifact rather than a second copy of its physics model.
test('HIL ships its unchanged standalone build, license and project screenshot', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'hil/deployment-manifest.json'), 'utf8'));
  for (const name of ['hil.html', 'THIRD-PARTY-NOTICES.txt']) {
    const content = await readFile(resolve(root, 'hil', name));
    assert.equal(content.length, manifest.files[name].bytes);
    assert.equal(createHash('sha256').update(content).digest('hex'), manifest.files[name].sha256);
  }
  const html = await readFile(resolve(root, 'hil/hil.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel=["']stylesheet/i);
  assert.match(html, /HIL 实验室/);
  assert.match(html, /未连接真实 ECU/);
  await access(resolve(root, 'assets/workflow-previews/hil.jpg'));
});
