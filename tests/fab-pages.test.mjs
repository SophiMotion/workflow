import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { createHash, randomFillSync } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));

test('Fab pages and the student scene have no missing local links or localhost dependencies', async () => {
  async function htmlPages(directory) {
    const entries = await readdir(resolve(root, directory), { withFileTypes: true });
    const pages = await Promise.all(entries.map(entry => entry.isDirectory()
      ? htmlPages(`${directory}/${entry.name}`)
      : entry.name.endsWith('.html') ? [`${directory}/${entry.name}`] : []));
    return pages.flat();
  }
  const pages = await htmlPages('fab');
  pages.push('worldlabstest/fab-embed.html');
  for (const page of pages) {
    const html = await readFile(resolve(root, page), 'utf8');
    assert.doesNotMatch(html, /https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/);
    for (const [, href] of html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (href.startsWith('#') || /^(?:https?:|data:|mailto:)/.test(href)) continue;
      const url = new URL(href, `https://example.com/workflow/${page}`);
      assert.ok(url.pathname.startsWith('/workflow/'), `${page}: ${href} leaves the Pages subpath`);
      await access(resolve(root, decodeURIComponent(url.pathname.slice('/workflow/'.length))));
    }
    // Script bodies may contain template links; script sources must still be deployed.
    for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
      if (/^https?:/.test(src)) continue;
      const url = new URL(src, `https://example.com/workflow/${page}`);
      await access(resolve(root, decodeURIComponent(url.pathname.slice('/workflow/'.length))));
    }
  }
});

test('Fab preserves its source scene bundle and shared model manifests', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'fab/deployment-manifest.json'), 'utf8'));
  const bundle = await readFile(resolve(root, 'fab/traffic-lab/workbench.bundle.js'));
  assert.equal(createHash('sha256').update(bundle).digest('hex'), manifest.sourceFiles['traffic-lab/workbench.bundle.js']);
  assert.match(bundle.toString(), /fab-learning-traffic-lab-v1/);
  await access(resolve(root, 'worldlabstest/data/campus-default.json'));
  await access(resolve(root, 'worldlabstest/assets/offline/manifest.js'));
  const entry = await readFile(resolve(root, 'worldlabstest/fab-embed.html'), 'utf8');
  assert.ok(entry.indexOf('http-compat.js') < entry.indexOf('launch-workbench.js'));
  const homepage = await readFile(resolve(root, 'fab/sophilabv2.html'), 'utf8');
  assert.match(homepage, /href="\.\.\/worldlabstest\/fab-embed.html"/);
});

test('Fab HTTP scene IDs are distinct UUIDs and preserve native implementations', async () => {
  const source = await readFile(resolve(root, 'fab/traffic-lab/http-compat.js'), 'utf8');
  const crypto = { getRandomValues: bytes => randomFillSync(bytes) };
  vm.runInNewContext(source, { crypto, Uint8Array });
  const values = Array.from({ length: 100 }, () => crypto.randomUUID());
  assert.equal(new Set(values).size, 100);
  for (const value of values) assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const native = () => 'native';
  const existing = { randomUUID: native };
  vm.runInNewContext(source, { crypto: existing });
  assert.equal(existing.randomUUID, native);
});

test('workflow assigns every published project to one of five categories with correct counts', async () => {
  const context = { window: {}, URL, document: { currentScript: { src: 'https://sophistudio.com/unit/js/config.js' }, body: { dataset: { workflowScope: 'engineering' } } } };
  vm.runInNewContext(await readFile(resolve(root, 'unit/js/config.js'), 'utf8'), context);
  vm.runInNewContext(await readFile(resolve(root, 'unit/js/views.js'), 'utf8'), context);
  const html = context.window.PFXViews.renderWorkflow();
  const projects = [...html.matchAll(/data-module="([^"]+)" data-category="([^"]+)"/g)].map(([, id, category]) => ({ id, category }));
  assert.equal(projects.length, 14);
  assert.equal(new Set(projects.map(({ id }) => id)).size, 14);
  const counts = { learning: 1, robotics: 4, simulation: 3, manufacturing: 4, creative: 2 };
  for (const [category, count] of Object.entries(counts)) {
    assert.equal(projects.filter(project => project.category === category).length, count);
    assert.match(html, new RegExp(`data-workflow-filter="${category}"[^>]*>[^<]*<span>${count}</span>`));
  }
  assert.equal(projects.find(project => project.id === 'fab').category, 'learning');
  assert.equal(projects.find(project => project.id === 'hil').category, 'simulation');
  assert.equal(projects.find(project => project.id === 'tanyuan').category, 'robotics');
  for (const { id } of projects) await access(resolve(root, `assets/workflow-previews/${id}.jpg`));
});
