import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const studio = resolve(root, '..');
const folders = ['online-vault', 'boss', 'feishu', 'paper', '底盘机器人',
  'SophiStudio-SophiRobot-Website', 'prd', 'sophicarv2', 'sophicar-stl-f3d',
  'sophicar-formate', 'stlquote', 'cfd', 'worldlabstest', 'mooncake', 'santi',
  'weld', 'drone-formation', 'sound'];

test('workflow module directories live in the repository while Media stays in studio', () => {
  for (const folder of folders) {
    assert.ok(existsSync(resolve(root, folder)), `module not moved: ${folder}`);
    assert.equal(existsSync(resolve(studio, folder)), false, `old module location remains: ${folder}`);
  }
  assert.ok(existsSync(resolve(studio, 'media/media/server.py')));
  assert.equal(existsSync(resolve(root, 'media')), false);
});

test('both console entrypoints resolve all local scripts, styles and brand assets', async () => {
  for (const entry of [resolve(studio, 'index.html'), resolve(root, 'index.html')]) {
    assert.ok(existsSync(entry), `missing console entry: ${entry}`);
    const html = await readFile(entry, 'utf8');
    for (const [, reference] of html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)=["']([^"']+)["']/g)) {
      if (/^(?:https?:|data:|#)/.test(reference)) continue;
      const url = new URL(reference, pathToFileURL(entry));
      url.search = ''; url.hash = '';
      await access(url);
    }
  }
});

test('relative links target the same modules from the old, new and HTTP console entries', async () => {
  const configFile = existsSync(resolve(root, 'unit/js/config.js'))
    ? resolve(root, 'unit/js/config.js') : resolve(studio, 'unit/js/config.js');
  const source = await readFile(configFile, 'utf8');
  for (const [scriptUrl, expected] of [
    ['file:///example/sophistudio/workflow/unit/js/config.js?v=1', 'file:///example/sophistudio/workflow/prd/prd.html'],
    ['http://127.0.0.1:4173/studio/unit/js/config.js?v=1', 'http://127.0.0.1:4173/studio/prd/prd.html'],
    ['http://localhost:8000/workflow/unit/js/config.js', 'http://localhost:8000/workflow/prd/prd.html'],
  ]) {
    const context = { window: {}, document: { currentScript: { src: scriptUrl } }, URL };
    vm.runInNewContext(source, context);
    assert.equal(typeof context.window.PFX_PATHS?.resolve, 'function', 'console has no shared resource resolver');
    const paths = context.window.PFX_PATHS;
    assert.equal(paths.resolve('prd/prd.html'), expected);
    assert.equal(paths.resolve('#/overview'), '#/overview');
    assert.equal(paths.resolve('http://127.0.0.1:8741/'), 'http://127.0.0.1:8741/');
  }
});

test('workflow links preserve the complete module inventory and existing Media service', async () => {
  const context = { window: {} };
  const scripts = existsSync(resolve(root, 'unit/js/views.js')) ? root : studio;
  vm.runInNewContext(await readFile(resolve(scripts, 'unit/js/views.js'), 'utf8'), context);
  const html = context.window.PFXViews.renderWorkflow();
  assert.equal([...html.matchAll(/data-module=/g)].length, 22);
  assert.equal([...html.matchAll(/data-status="ready"/g)].length, 19);
  assert.match(html, /data-module="media"[^>]+href="http:\/\/127\.0\.0\.1:8741\/"/);
});
