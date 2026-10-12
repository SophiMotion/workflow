import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, 'prd');
const html = await readFile(resolve(directory, 'prd.html'), 'utf8');
const css = await readFile(resolve(directory, 'prd.css'), 'utf8');
const data = await readFile(resolve(directory, 'prd-data.js'), 'utf8');

test('the project cockpit has a complete accessible static shell', () => {
  assert.match(html, /<title>项目驾驶舱 · SophiStudio<\/title>/);
  assert.match(html, /href=["']\.\.\/index\.html#\/workflow["']/);
  for (const id of [
    'project-select', 'new-project', 'app-nav', 'main-content', 'project-dialog',
    'record-dialog', 'toast-root', 'import-file',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /aria-label=["']项目管理导航["']/);
  assert.match(html, /aria-live=["']polite["']/);
  assert.match(html, /<main[^>]+id=["']main-content["']/);
  assert.match(html, /<dialog[^>]+id=["']project-dialog["']/);
  assert.match(html, /<dialog[^>]+id=["']record-dialog["']/);
});

test('runtime assets are local and scripts load in dependency order', async () => {
  const resources = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi)]
    .map(([, value]) => value)
    .filter((value) => !value.startsWith('data:'));
  assert.ok(resources.length >= 4);
  assert.ok(resources.every((value) => !/^https?:/i.test(value)), 'runtime must not use the network');
  assert.ok(html.indexOf('prd-core.js') < html.indexOf('prd-data.js'));
  assert.ok(html.indexOf('prd-data.js') < html.indexOf('prd-app.js'));
  for (const resource of resources) {
    await access(resolve(directory, resource.split(/[?#]/, 1)[0]));
  }
});

test('the accepted Google design system covers app, timeline, accessibility, and print', () => {
  assert.match(css, /--bg:\s*#f8f9fa/i);
  assert.match(css, /--blue:\s*#1a73e8/i);
  assert.match(css, /--green:\s*#34a853/i);
  assert.match(css, /--yellow:\s*#fbbc04/i);
  assert.match(css, /--red:\s*#ea4335/i);
  for (const selector of ['app-shell', 'sidebar', 'kpi-strip', 'stage-rail', 'data-table', 'gantt-grid', 'task-bar']) {
    assert.match(css, new RegExp(`\\.${selector}\\b`), `missing .${selector}`);
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s+print/);
});

test('seed data exposes a demonstration project factory', () => {
  assert.match(data, /PrdSeed/);
  assert.match(data, /createDemoStore/);
});

test('dialog cancel controls never submit project or record forms', () => {
  const cancelButtons = [...html.matchAll(/<button\b[^>]*data-close-dialog[^>]*>/gi)].map(([button]) => button);
  assert.equal(cancelButtons.length, 4);
  for (const button of cancelButtons) {
    assert.match(button, /type=["']button["']/i);
  }
});

test('mobile app bar reserves separate columns for menu, brand, project, and create', () => {
  const mobile = css.match(/@media\s*\(max-width:\s*760px\)[\s\S]*?(?=@media\s*\(prefers-reduced-motion|$)/i)?.[0] || '';
  assert.match(mobile, /--topbar-h:\s*64px/i);
  assert.match(mobile, /\.topbar\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*36px\s+100px\s+minmax\(0,\s*1fr\)\s+42px/is);
  assert.match(mobile, /\.brand\s*\{[^}]*width:\s*100px/is);
  assert.match(mobile, /\.brand img\s*\{[^}]*width:\s*100px/is);
});
