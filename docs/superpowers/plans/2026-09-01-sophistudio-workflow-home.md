# SophiStudio Workflow Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, self-contained root `index.html` that presents the SophiMotion development workflow and directly opens every currently usable static module without npm or a backend.

**Architecture:** The root page is a dependency-free static document with semantic HTML, inline CSS, inline SVG symbols, and no required runtime JavaScript. Three workflow sections encode knowledge/research, engineering, and content/experience; ready modules use relative anchors to existing static entrypoints while planned modules render non-interactive status controls.

**Tech Stack:** HTML5, CSS3, inline SVG, Node.js built-in test runner, browser visual inspection

**Spec:** `docs/superpowers/specs/2026-09-01-sophistudio-workflow-design.md`

## Global Constraints

- Create exactly one runtime file at the repository root: `index.html`.
- Do not add npm dependencies, a root `package.json`, a build command, or a backend service.
- The page must work when opened directly from the filesystem and from a plain static server.
- Workflow colors are fixed: knowledge/research `#1a73e8`, engineering `#188038`, content/experience `#d93025`; Google Yellow `#f9ab00` is supporting only.
- Ready modules open in a new tab using relative paths; planned modules have no `href`.
- Preserve the existing child projects and their files.
- Respect `prefers-reduced-motion` and provide visible keyboard focus.

---

### Task 1: Lock the static workflow contract and create the semantic page

**Files:**
- Create: `tests/workflow-index.test.mjs`
- Create: `index.html`

**Interfaces:**
- Consumes: Existing module entrypoints listed in the design spec.
- Produces: Root document sections identified by `data-workflow="knowledge|engineering|content"`; module articles identified by `data-module` and `data-status="ready|planned"`.

- [ ] **Step 1: Write the failing contract test**

Create `tests/workflow-index.test.mjs` with Node built-ins only:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');

const ready = new Map([
  ['unit', 'unit/index.html'],
  ['online-vault', 'online-vault/index.html'],
  ['sophicarv2', 'sophicarv2/index.html'],
  ['cfd', 'cfd/dist/index.html'],
  ['sophicar-formate', 'sophicar-formate/web/dist/index.html'],
  ['stlquote', 'stlquote/index.html'],
  ['media', 'media/media/index.html'],
]);

const planned = ['paper', 'sophicar-stl-f3d', 'sound'];

function moduleBlock(name) {
  const match = html.match(new RegExp(`<article[^>]*data-module=["']${name}["'][\\s\\S]*?</article>`));
  assert.ok(match, `missing module block: ${name}`);
  return match[0];
}

test('renders the three approved workflow groups', () => {
  for (const group of ['knowledge', 'engineering', 'content']) {
    assert.match(html, new RegExp(`data-workflow=["']${group}["']`));
  }
});

test('ready modules link to existing static entrypoints in a new tab', async () => {
  for (const [name, href] of ready) {
    const block = moduleBlock(name);
    assert.match(block, /data-status=["']ready["']/);
    assert.ok(
      block.includes(`href="${href}"`) || block.includes(`href='${href}'`),
      `wrong entrypoint for ${name}`,
    );
    assert.match(block, /target=["']_blank["']/);
    assert.match(block, /rel=["']noopener noreferrer["']/);
    await access(resolve(root, href));
  }
});

test('planned modules contain no links', () => {
  for (const name of planned) {
    const block = moduleBlock(name);
    assert.match(block, /data-status=["']planned["']/);
    assert.doesNotMatch(block, /<a\b/i);
  }
});

test('contains the approved product copy and seven-of-ten summary', () => {
  assert.match(html, /SophiMotion 研发工作流/);
  assert.match(html, /7\s*\/\s*10/);
  assert.match(html, /候选课题/);
  assert.match(html, /F3D/);
  assert.match(html, /URDF/);
});
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run: `node --test tests/workflow-index.test.mjs`

Expected: FAIL with `ENOENT` for the missing root `index.html`.

- [ ] **Step 3: Create the minimal semantic document**

Create `index.html` containing:

- A skip link and a `<header>` with the four-color SophiStudio mark.
- A `<main>` with a hero headed “SophiMotion 研发工作流” and the visible summary “7 / 10 模块可直接使用”.
- Three `<section>` elements with `data-workflow="knowledge"`, `data-workflow="engineering"`, and `data-workflow="content"`.
- Ten `<article>` module nodes with exact `data-module` and `data-status` attributes.
- Ready-node anchors with the exact paths in the test, `target="_blank"`, and `rel="noopener noreferrer"`.
- Planned-node `<span aria-disabled="true">规划中</span>` controls and no anchors.
- An inline SVG symbol sheet containing consistent 24px outline icons for team, vault, paper, vehicle, airflow, cube conversion, export, quote, video, and sound.
- A footer reading “SophiStudio · SophiMotion Development System · Updated 2026.09”.

- [ ] **Step 4: Run the contract test and confirm it passes**

Run: `node --test tests/workflow-index.test.mjs`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the semantic workflow**

```bash
git add index.html tests/workflow-index.test.mjs
git commit -m "feat: add sophistudio workflow hub structure"
```

---

### Task 2: Apply the approved Google visual system and responsive workflow layout

**Files:**
- Modify: `tests/workflow-index.test.mjs`
- Modify: `index.html`
- Create: `docs/design/sophistudio-workflow-concept.png`

**Interfaces:**
- Consumes: Task 1 semantic hooks and the approved design tokens.
- Produces: CSS custom properties, desktop workflow rails, the CFD branch treatment, responsive vertical timelines, hover/focus states, and reduced-motion behavior.

- [ ] **Step 1: Generate the full-page visual reference**

Use the installed image-generation workflow to create a 1440px desktop concept at `docs/design/sophistudio-workflow-concept.png` with this fixed art direction:

```text
A polished desktop product dashboard for “SophiStudio — SophiMotion 研发工作流”. Pure white background, Google-inspired visual language without copying a Google product. Minimal top bar with a four-color geometric S mark. Spacious editorial hero with title, one-line Chinese description, and “7 / 10 模块可直接使用”. Below, three open horizontal workflow rails rather than a card grid: blue knowledge/research with unit, online-vault, paper; green engineering with sophicarv2, sophicar-stl-f3d, sophicar-formate, stlquote and a clearly branching CFD node; red content/experience with media and sound. Ready nodes have restrained colored accents and “打开模块” actions; planned nodes use gray dashed outlines and “规划中”. Google blue #1a73e8, green #188038, red #d93025, yellow #f9ab00, charcoal #202124, gray #5f6368, divider #dadce0. Crisp Chinese typography, generous whitespace, subtle line icons, no gradients, no dark theme, no bento grid, no decorative pills above the headline.
```

- [ ] **Step 2: Extend the test with visual-system invariants**

Append these tests:

```js
test('uses the fixed Google workflow palette', () => {
  assert.match(html, /--blue:\s*#1a73e8/i);
  assert.match(html, /--green:\s*#188038/i);
  assert.match(html, /--red:\s*#d93025/i);
  assert.match(html, /--yellow:\s*#f9ab00/i);
});

test('includes responsive, focus, and reduced-motion rules', () => {
  assert.match(html, /@media\s*\(max-width:\s*760px\)/i);
  assert.match(html, /:focus-visible/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/i);
});

test('has no required remote styles, fonts, or scripts', () => {
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)=["']https?:/i);
});
```

- [ ] **Step 3: Run the tests and confirm the new assertions fail**

Run: `node --test tests/workflow-index.test.mjs`

Expected: the palette and responsive-rule tests fail before the inline design system is added.

- [ ] **Step 4: Implement the visual system in inline CSS**

Add CSS to `index.html` using these exact core tokens:

```css
:root {
  --blue: #1a73e8;
  --green: #188038;
  --red: #d93025;
  --yellow: #f9ab00;
  --ink: #202124;
  --muted: #5f6368;
  --line: #dadce0;
  --surface: #f8f9fa;
  --white: #ffffff;
  --radius: 18px;
  --shadow: 0 8px 28px rgba(60, 64, 67, 0.12);
}
```

Implement the approved reference faithfully:

- A maximum 1280px content width and a first viewport with ample white space.
- An open rail per workflow, using the workflow color through a scoped `--accent` variable.
- Compact module nodes with a 40px icon field, name, Chinese responsibility, status text, and right-aligned action.
- A visible engineering branch connector from SophiCar V2 to CFD.
- Dashed neutral treatment for planned modules without reducing text contrast below WCAG AA.
- Button and link focus rings using `outline: 3px solid color-mix(in srgb, var(--accent), white 45%)` with a solid-color fallback.
- A `760px` breakpoint that stacks every rail as a vertical timeline and removes horizontal connectors.
- CSS entry motion and hover motion; disable both in `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 5: Run the static contract tests**

Run: `node --test tests/workflow-index.test.mjs`

Expected: 7 tests pass, 0 fail.

- [ ] **Step 6: Commit the designed workflow page**

```bash
git add index.html tests/workflow-index.test.mjs docs/design/sophistudio-workflow-concept.png
git commit -m "style: apply google workflow visual system"
```

---

### Task 3: Verify direct-open behavior, responsive rendering, and visual fidelity

**Files:**
- Modify: `index.html` only if verification finds defects
- Modify: `tests/workflow-index.test.mjs` only if a discovered regression needs a durable assertion

**Interfaces:**
- Consumes: Completed static page and visual concept.
- Produces: Browser-verified direct-open workflow with no remaining material visual or functional mismatches.

- [ ] **Step 1: Verify the final diff and static test suite**

Run:

```bash
git diff --check
node --test tests/workflow-index.test.mjs
```

Expected: no whitespace errors; 7 tests pass, 0 fail.

- [ ] **Step 2: Open the root page directly in the in-app browser**

Open `file:///Users/wubo/Documents/2026-2/sophistudio/index.html`. Inspect the full page at approximately 1440×1000 and confirm that all three workflow rails, the 7/10 summary, the CFD branch, statuses, and footer render without a server.

- [ ] **Step 3: Exercise the core link workflow**

Click each ready module action and verify its URL resolves to the exact relative entrypoint. Confirm that all seven open in a new tab and that paper, sophicar-stl-f3d, and sound have no clickable navigation action.

- [ ] **Step 4: Verify responsive and keyboard behavior**

At approximately 390×844, confirm the rails become vertical, all copy remains readable, buttons do not overflow, and there is no horizontal scrollbar. Tab through every ready action and confirm a visible focus ring and logical order.

- [ ] **Step 5: Capture and compare screenshots**

Capture the final 1440px implementation screenshot to `/tmp/sophistudio-workflow-final.png`. Use image inspection on both `docs/design/sophistudio-workflow-concept.png` and `/tmp/sophistudio-workflow-final.png`; compare title/copy, workflow geometry, palette, typography, spacing, planned treatment, icons, and first-viewport balance. Fix every material mismatch and repeat the capture until the implementation is agency-signoff faithful.

- [ ] **Step 6: Record the final verification state**

Run:

```bash
git status --short
git log --oneline --decorate -3
```

Expected: no unintended files; the workflow implementation commits appear after baseline commit `be53880`.

- [ ] **Step 7: Commit any verification fixes**

If Step 5 required changes:

```bash
git add index.html tests/workflow-index.test.mjs
git commit -m "fix: refine workflow hub fidelity and accessibility"
```

If no files changed, do not create an empty commit.
