import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
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
test('all 10 hosted cards stay under the Pages subpath and point to shipped entries', async () => {
  for (const base of ['https://sophimotion.github.io/workflow/', 'https://example.com/tools/workflow/']) {
    const links = cards(base);
    assert.equal(links.length, 10);
    assert.equal(links.some(({ id }) => id === 'skatechassis'), false);
    for (const { id, href } of links) {
      assert.ok(href.startsWith(base), `${id} escapes the hosted site: ${href}`);
      await access(resolve(root, decodeURIComponent(href.slice(base.length))));
    }
  }
});
test('local file and HTTP previews preserve the three existing service URLs', () => {
  const expected = {
    sophirobot: 'http://127.0.0.1:4189/',
    'sophicar-formate': 'http://127.0.0.1:4173/studio/sophicar-formate/web/dist/index.html',
    'drone-formation': 'http://127.0.0.1:4188/'
  };
  for (const base of ['file:///example/workflow/', 'http://127.0.0.1:4173/studio/', 'http://localhost:8080/workflow/']) {
    const byId = Object.fromEntries(cards(base).map(({ id, href }) => [id, href]));
    for (const [id, href] of Object.entries(expected)) assert.equal(byId[id], href);
  }
});
