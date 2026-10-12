import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const app = await readFile(resolve(root, 'unit/js/app.js'), 'utf8');
const data = await readFile(resolve(root, 'unit/js/data.js'), 'utf8');
const views = await readFile(resolve(root, 'unit/js/views.js'), 'utf8');
const styles = await readFile(resolve(root, 'unit/css/style.css'), 'utf8');

const ready = new Map([
  ['want', 'http://127.0.0.1:8770/want.html?from=workflow'],
  ['ai-guide', '../../guide.html'],
  ['online-vault', 'online-vault/index.html'],
  ['aipm', 'http://127.0.0.1:4174/'],
  ['drone-formation', 'http://127.0.0.1:4188/'],
  ['sophicarv2', 'sophicarv2/index.html'],
  ['sophirobot', 'http://127.0.0.1:4189/'],
  ['traffic-scene-lab', 'worldlabstest/worldlabstestv2.html'],
  ['mooncake', 'mooncake/mooncake/Mooncake.html'],
  ['cfd', 'cfd/dist/index.html'],
  ['sophicar-formate', 'http://127.0.0.1:4173/studio/sophicar-formate/web/dist/index.html'],
  ['stlquote', 'stlquote/index.html'],
  ['prd', 'prd/prd.html'],
  ['media', 'http://127.0.0.1:8741/'],
  ['feishu', 'http://127.0.0.1:8769/feishu/feishu.html'],
]);

const planned = ['paper', 'sophicar-stl-f3d', 'sound'];

const context = { window: {} };
vm.runInNewContext(views, context);
const renderedWorkflow = context.window.PFXViews.renderWorkflow();

function moduleBlock(name) {
  const match = renderedWorkflow.match(
    new RegExp(`<(article|a)[^>]*data-module=["']${name}["'][\\s\\S]*?</\\1>`),
  );
  assert.ok(match, `missing module block: ${name}`);
  return match[0].trim();
}

test('the root document is the single SophiStudio console entry', async () => {
  assert.match(html, /<title>SophiStudio · 工作流<\/title>/);
  assert.match(html, /src=["']assets\/sophistudio-logo\.png["']/);
  assert.match(html, /href=["']#\/workflow["']/);
  assert.match(html, /id=["']view["']/);
  await assert.rejects(access(resolve(root, 'unit/index.html')));
  await access(resolve(root, 'assets/sophistudio-logo.png'));
});

test('the root document keeps scripts local and limits remote styles to Google Fonts', async () => {
  const resources = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi)]
    .map(([, resource]) => resource)
    .filter((resource) => !resource.startsWith('data:'));

  assert.ok(resources.length > 0);
  for (const resource of resources) {
    if (/^https?:/i.test(resource)) {
      assert.match(resource, /^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com)(?:\/|$)/i);
    } else {
      await access(resolve(root, resource.split(/[?#]/, 1)[0]));
    }
  }
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
});

test('local console assets carry a cache version for direct file reopening', () => {
  const localAssets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']((?:unit\/)[^"']+)["']/gi)]
    .map(([, resource]) => resource);

  assert.ok(localAssets.length > 0);
  for (const resource of localAssets) {
    assert.match(resource, /\?v=\d{8}(?:-\d+)?$/);
  }
});

test('the console registers a SophiStudio workflow route', () => {
  assert.match(app, /workflow:\s*\{\s*title:\s*["']SophiStudio 工作流["']/);
  assert.match(app, /renderWorkflow\(\)/);
  assert.match(app, /SophiStudio 控制台/);
});

test('the overview opens with the approved SophiStudio architecture diagram', async () => {
  const context = { window: {} };
  vm.runInNewContext(data, context);
  vm.runInNewContext(views, context);

  const overview = context.window.PFXViews.renderOverview().trimStart();
  const firstSection = overview.match(/^<section\b[\s\S]*?<\/section>/)?.[0] || '';

  assert.match(firstSection, /class=["']card overview-architecture["']/);
  assert.match(firstSection, /src=["']assets\/sophistudio-overview-architecture\.png["']/);
  assert.match(firstSection, /alt=["'][^"']*SophiStudio[^"']*业务与产品架构[^"']*["']/);
  await access(resolve(root, 'assets/sophistudio-overview-architecture.png'));
});

test('the workflow renders the three approved Google-color groups', () => {
  for (const group of ['knowledge', 'engineering', 'content']) {
    assert.match(views, new RegExp(`data-workflow=["']${group}["']`));
  }
  assert.match(views, /知识与研究/);
  assert.match(views, /工程研发/);
  assert.match(views, /内容与体验/);
});

test('the engineering workflow includes the ready PRD project cockpit', () => {
  const engineering = views.match(/<section class="workflow-group engineering"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(engineering, /data-module="prd"/);
  assert.match(engineering, /PRD \/ SOW 项目驾驶舱/);
  assert.match(engineering, /需求、计划、预算、交付与验收的一体化项目管理/);
  const rendered = renderedWorkflow;
  const total = [...rendered.matchAll(/data-module=/g)].length;
  const available = [...rendered.matchAll(/data-status="ready"/g)].length;
  assert.ok(rendered.includes(`<strong>${available}</strong><span>/ ${total} 模块可用</span>`));
});

test('each ready workflow card is a same-tab link to its entrypoint', async () => {
  for (const [name, href] of ready) {
    const block = moduleBlock(name);
    assert.match(block, /^<a\b/);
    assert.match(block, /data-status=["']ready["']/);
    assert.ok(block.includes(`href="${href}"`) || block.includes(`href='${href}'`));
    assert.doesNotMatch(block, /target=["']_blank["']/);
    assert.doesNotMatch(block.slice(2), /<a\b/i, `nested link inside ${name} card`);
    const target = new URL(href, pathToFileURL(resolve(root, 'index.html')));
    if (target.protocol === 'file:') await access(target);
  }
});

test('Feishu opens its own service even from a nested studio route', () => {
  const href = moduleBlock('feishu').match(/href="([^"]+)"/)[1];
  assert.equal(new URL(href, 'http://127.0.0.1:4173/studio/index.html').href,
    'http://127.0.0.1:8769/feishu/feishu.html');
});

test('SkateChassis card opens its managed service without a protocol prompt', () => {
  const block = moduleBlock('skatechassis');
  assert.match(block, /^<a\b/);
  assert.match(block, /href=["']http:\/\/127\.0\.0\.1:4173\/["']/);
  assert.doesNotMatch(block, /target=["']_blank["']/);
});

test('ready workflow cards contain no secondary open-module action', () => {
  for (const name of ready.keys()) {
    const block = moduleBlock(name);
    assert.doesNotMatch(block, /打开模块/);
    assert.doesNotMatch(block, /wf-action/);
  }
});

test('planned workflow modules are visibly unavailable', () => {
  for (const name of planned) {
    const block = moduleBlock(name);
    assert.match(block, /data-status=["']planned["']/);
    assert.doesNotMatch(block, /<a\b/i);
  }
});

test('the workflow overview replaces the former unit link', () => {
  const block = moduleBlock('sophistudio');
  assert.match(block, /^<a\b/);
  assert.match(block, /href=["']#\/overview["']/);
  assert.match(block, /团队与平台总览/);
  assert.doesNotMatch(block, /unit\/index\.html/);
});

test('all console views use the light Google palette', () => {
  assert.match(styles, /--bg:\s*#F8F9FA/i);
  assert.match(styles, /--c-blue:\s*#4285F4/i);
  assert.match(styles, /--c-green:\s*#34A853/i);
  assert.match(styles, /--c-yellow:\s*#FBBC04/i);
  assert.match(styles, /--c-red:\s*#EA4335/i);
  assert.doesNotMatch(styles, /prefers-color-scheme:\s*dark/i);
});

test('the console remains responsive and accessible', () => {
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/i);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/i);
});

test('the mobile app bar gives navigation its own full-width row', () => {
  const mobileRules = styles.match(/@media\s*\(max-width:\s*760px\)[\s\S]*$/i)?.[0] || '';
  assert.match(mobileRules, /\.appbar-inner\s*\{[^}]*flex-wrap:\s*wrap/i);
  assert.match(mobileRules, /\.tabs\s*\{[^}]*width:\s*100%/i);
});

test('SophiCAD static build resolves entry assets relative to its own directory', async () => {
  const distDirectory = resolve(root, 'sophicar-formate/web/dist');
  const distIndex = await readFile(resolve(distDirectory, 'index.html'), 'utf8');
  const assetUrls = [...distIndex.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(
    ([, url]) => url,
  );

  assert.ok(assetUrls.length > 0, 'SophiCAD dist index has no assets');
  for (const assetUrl of assetUrls) {
    assert.ok(!assetUrl.startsWith('/'), `root-absolute asset: ${assetUrl}`);
    await access(resolve(distDirectory, assetUrl));
  }
});

test('SophiCAD bundles do not request public files from the site root', async () => {
  const assetDirectory = resolve(root, 'sophicar-formate/web/dist/assets');
  const files = await readdir(assetDirectory, { recursive: true });
  const scripts = files.filter((file) => file.endsWith('.js'));

  for (const script of scripts) {
    const source = await readFile(resolve(assetDirectory, script), 'utf8');
    assert.doesNotMatch(
      source,
      /["'`]\/(?:assets\/|four-bar\.sophicad\.zip)/,
      `root-absolute public asset in ${script}`,
    );
  }
});


test('Drone formation opens its managed service directly from the content workflow', () => {
  const block = moduleBlock('drone-formation');
  assert.match(block, /^<a\b/);
  assert.match(block, /href=["']http:\/\/127\.0\.0\.1:4188\/["']/);
  assert.match(block, /data-status=["']ready["']/);
  assert.match(block, /点阵飞行/);
  const section=renderedWorkflow.match(/<section class="workflow-group content"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(section, /data-module="drone-formation"/);
});
