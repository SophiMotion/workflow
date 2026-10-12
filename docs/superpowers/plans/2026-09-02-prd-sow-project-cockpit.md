# PRD/SOW Project Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a directly-openable SophiStudio project cockpit that manages multiple simulator and drive-by-wire chassis projects from requirements through FAT/SAT acceptance.

**Architecture:** A static app under `prd/` uses classic browser scripts so it remains reliable under `file://`. Pure project/template/metric/validation functions live in `prd-core.js` and are tested with Node's built-in test runner; `prd-app.js` owns DOM rendering, navigation, local storage, import/export, print, and editable dialogs. The SophiStudio root workflow links to the app as a ready engineering module.

**Tech Stack:** Semantic HTML5, CSS custom properties and responsive layout, vanilla JavaScript, localStorage, File/Blob APIs, Node.js built-in test runner, browser screenshot QA.

**Spec:** `docs/superpowers/specs/2026-09-02-prd-sow-project-cockpit-design.md`

## Global Constraints

- `file:///Users/wubo/Documents/2026-2/sophistudio/prd/prd.html` must run without npm, a web server, or network access.
- The app manages multiple projects and initializes either a driving-simulator or drive-by-wire-chassis template.
- The background is `#f8f9fa`; semantic accents are Google blue `#1a73e8`, green `#34a853`, yellow `#fbbc04`, and red `#ea4335`.
- Unknown facts display `待确认`; maturity uses `已实现 / 在研 / 规划`; evidence uses `F1 / F2 / P / H / D / C`.
- Project data autosaves locally and supports versioned JSON import/export and browser printing.
- The root workflow card opens `prd/prd.html` in the current tab and has no secondary “打开模块” action.
- Do not add third-party runtime dependencies.

---

### Task 1: Project domain model, templates, metrics, and validation

**Files:**
- Create: `prd/prd-core.js`
- Create: `tests/prd-core.test.mjs`

**Interfaces:**
- Produces: `PrdCore.createProject(type, input, now) -> Project`
- Produces: `PrdCore.calculateMetrics(project, today) -> ProjectMetrics`
- Produces: `PrdCore.validateProject(project, today) -> Alert[]`
- Produces: `PrdCore.createEmptyStore() -> Store`
- Produces: `PrdCore.normalizeStore(value) -> Store`
- Produces: `PrdCore.STAGES`, `PrdCore.TEMPLATES`, and `PrdCore.SCHEMA_VERSION`

- [ ] **Step 1: Write failing template tests**

Add tests that call `createProject('chassis', ...)` and `createProject('simulator', ...)`. Assert literal stage names, four professional domains, chassis requirements such as `安全状态机`, simulator requirements such as `座舱与操纵`, default acceptance records, unique IDs, and unknown fields represented as `待确认`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/prd-core.test.mjs`
Expected: FAIL because `prd/prd-core.js` does not exist.

- [ ] **Step 3: Implement the minimal UMD-style domain module**

Expose the API on `window.PrdCore` in browsers and `module.exports` in Node. Define literal seed templates derived from the approved spec, immutable constants, ID creation, date normalization, and fresh deep-cloned project records.

- [ ] **Step 4: Run template tests and verify GREEN**

Run: `node --test tests/prd-core.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write failing metric and validation tests**

Use hand-calculated fixtures to assert overall progress, budget use, BOM totals, remaining days, acceptance completion, open risk count, domain completion, delayed-task detection, missing DRI/budget/acceptance/IP/safety gate warnings, and malformed import normalization.

- [ ] **Step 6: Run the new tests and verify RED**

Run: `node --test tests/prd-core.test.mjs`
Expected: FAIL because metric, alert, and normalization branches are not implemented.

- [ ] **Step 7: Implement metric calculation, alerts, and store normalization**

Calculate with explicit zero-denominator behavior, cap percentages to `0..100`, classify delayed work from ISO dates, preserve valid imported projects, reject unsupported schema versions, and fall back to a valid empty store for malformed data.

- [ ] **Step 8: Run all core tests and verify GREEN**

Run: `node --test tests/prd-core.test.mjs`
Expected: PASS with no warnings.

- [ ] **Step 9: Commit the domain layer**

```bash
git add prd/prd-core.js tests/prd-core.test.mjs
git commit -m "feat: add PRD project domain model"
```

### Task 2: Static app shell and accepted visual system

**Files:**
- Create: `prd/prd.html`
- Create: `prd/prd.css`
- Create: `prd/prd-data.js`
- Create: `tests/prd-static.test.mjs`

**Interfaces:**
- Consumes: `window.PrdCore`
- Produces: stable DOM hooks `#project-select`, `#new-project`, `#app-nav`, `#main-content`, `#project-dialog`, `#record-dialog`, `#toast-root`, `#import-file`
- Produces: `window.PrdSeed.createDemoStore()`

- [ ] **Step 1: Write a failing static-contract test**

Read the target files and assert that the HTML uses only relative local runtime resources, contains all stable DOM hooks, links back to `../index.html#/workflow`, loads `prd-core.js`, `prd-data.js`, and `prd-app.js` in order, declares printable content, and supplies semantic dialog labels. Assert CSS contains the exact Google palette, app-shell/sidebar/table/timeline selectors, `:focus-visible`, `prefers-reduced-motion`, print rules, and breakpoints at 1100px and 760px.

- [ ] **Step 2: Run the static test and verify RED**

Run: `node --test tests/prd-static.test.mjs`
Expected: FAIL because the app files do not exist.

- [ ] **Step 3: Implement the semantic app shell and seed data**

Build the top bar, fixed navigation, content host, accessible dialogs, hidden import input, and toast region. Seed one polished chassis demonstration project matching the approved concept while marking customer-specific unknowns as `待确认`.

- [ ] **Step 4: Implement the locked design system**

Reproduce `docs/design/prd-cockpit-overview-concept.png` and `docs/design/prd-cockpit-gantt-concept.png`: 68px top bar, 226px desktop sidebar, white work surfaces, thin borders, 8–12px radii, KPI strip, seven-stage rail, table-first layouts, donut/progress charts implemented with CSS, dense 13–14px controls, responsive sidebar and print mode.

- [ ] **Step 5: Run static tests and verify GREEN**

Run: `node --test tests/prd-static.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the shell and visual system**

```bash
git add prd/prd.html prd/prd.css prd/prd-data.js tests/prd-static.test.mjs docs/design/prd-cockpit-overview-concept.png docs/design/prd-cockpit-gantt-concept.png
git commit -m "feat: add PRD cockpit app shell"
```

### Task 3: Project CRUD, navigation, dashboards, and editable modules

**Files:**
- Create: `prd/prd-app.js`
- Extend: `tests/prd-core.test.mjs`
- Extend: `tests/prd-static.test.mjs`

**Interfaces:**
- Consumes: `PrdCore`, `PrdSeed`, stable DOM hooks from Task 2
- Produces: `PrdApp.init()`, project selection/creation/deletion, module navigation, record CRUD, autosave, import/export, print, and derived dashboard/Gantt views

- [ ] **Step 1: Write failing state-transition tests**

Extend core tests for adding/updating/removing records by collection name, selecting a project, preventing deletion of an unknown record, and importing duplicate project IDs by assigning fresh IDs.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/prd-core.test.mjs`
Expected: FAIL because the transition functions are missing.

- [ ] **Step 3: Implement tested state transitions**

Add pure `addRecord`, `updateRecord`, `removeRecord`, `selectProject`, and `mergeImportedStore` functions to `PrdCore`, with validation of allowed project collections.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/prd-core.test.mjs`
Expected: PASS.

- [ ] **Step 5: Extend the static test for the complete interaction contract**

Assert that `prd-app.js` exists and the HTML exposes project, navigation, import, export, print, task edit, table-add, and dialog-submit controls required by the app. This catches removal of a user-facing workflow rather than implementation wording.

- [ ] **Step 6: Run the static test and verify RED**

Run: `node --test tests/prd-static.test.mjs`
Expected: FAIL because `prd-app.js` and required controls are not complete.

- [ ] **Step 7: Implement the real browser application**

Render all seven views from project data. Implement project selection and creation; overview KPIs, stage rail, milestones, cost distribution, domain progress and alerts; requirement/team/BOM/acceptance/risk tables; Gantt table/time axis/current-day marker/task editor; generic record editing; localStorage autosave; versioned JSON import/export; project deletion confirmation; print; accessible focus management; status toasts.

- [ ] **Step 8: Run core and static tests and verify GREEN**

Run: `node --test tests/prd-core.test.mjs tests/prd-static.test.mjs`
Expected: PASS with no warnings.

- [ ] **Step 9: Commit the working app**

```bash
git add prd/prd-core.js prd/prd-app.js tests/prd-core.test.mjs tests/prd-static.test.mjs
git commit -m "feat: implement PRD project cockpit"
```

### Task 4: SophiStudio workflow integration

**Files:**
- Modify: `unit/js/views.js`
- Modify: `index.html`
- Modify: `tests/workflow-index.test.mjs`

**Interfaces:**
- Produces: ready workflow module `data-module="prd"` linking to `prd/prd.html`

- [ ] **Step 1: Write the failing workflow-entry test**

Add `['prd', 'prd/prd.html']` to the ready map. Assert the overview copy reads `8 / 11 模块可用`, the PRD card is inside the engineering group, is a same-tab link, has no secondary action, and its target exists.

- [ ] **Step 2: Run the workflow test and verify RED**

Run: `node --test tests/workflow-index.test.mjs`
Expected: FAIL because the PRD module card and count are missing.

- [ ] **Step 3: Add the workflow card and refresh direct-file cache versions**

Insert “PRD / SOW 项目驾驶舱” with description “需求、计划、预算、交付与验收的一体化项目管理” in the engineering rail, link it to `prd/prd.html`, update count to `8 / 11`, and bump root local asset cache versions from `20260902-2` to `20260902-3`.

- [ ] **Step 4: Run workflow tests and verify GREEN**

Run: `node --test tests/workflow-index.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit integration**

```bash
git add unit/js/views.js index.html tests/workflow-index.test.mjs
git commit -m "feat: add PRD cockpit workflow entry"
```

### Task 5: Browser behavior, responsive fidelity, and final verification

**Files:**
- Modify if defects are found: `prd/prd.html`, `prd/prd.css`, `prd/prd-app.js`, `prd/prd-core.js`
- Create during QA, then remove: `/private/tmp/prd-cockpit-*.png`

**Interfaces:**
- Consumes: completed static app and accepted concept images
- Produces: verified direct-file workflow with no retained QA artifacts

- [ ] **Step 1: Run the complete automated suite**

Run: `node --test tests/prd-core.test.mjs tests/prd-static.test.mjs tests/workflow-index.test.mjs`
Expected: all tests PASS with pristine output.

- [ ] **Step 2: Open the exact `file://` target in the in-app browser**

Open `file:///Users/wubo/Documents/2026-2/sophistudio/prd/prd.html`. Verify project switching, new simulator project creation, navigation through all seven views, one record edit, one Gantt task edit, local reload persistence, JSON export/import, and print invocation.

- [ ] **Step 3: Verify root workflow navigation**

Open `file:///Users/wubo/Documents/2026-2/sophistudio/index.html#/workflow`, click the whole PRD card, and confirm navigation occurs in the same tab.

- [ ] **Step 4: Capture desktop and narrow-screen renders**

Capture the overview at the concept-native 1536×1024 viewport, the Gantt selected state, and a 760px-wide layout. Save screenshots only under `/private/tmp` for QA.

- [ ] **Step 5: Compare concept and implementation with `view_image`**

Inspect both accepted concepts and the latest renders in the same QA pass. Record at least these comparison points: header/project selector, sidebar density, KPI strip, stage rail, table/time-axis anatomy, typography, exact palette, borders/radii, content fit, and responsive behavior. Fix every visible mismatch that would block agency sign-off.

- [ ] **Step 6: Re-run tests after visual or behavioral fixes**

Run: `node --test tests/prd-core.test.mjs tests/prd-static.test.mjs tests/workflow-index.test.mjs`
Expected: all tests PASS.

- [ ] **Step 7: Remove temporary QA artifacts and commit final fixes**

```bash
git add prd tests unit/js/views.js index.html
git commit -m "fix: polish PRD cockpit interactions"
```

- [ ] **Step 8: Confirm final repository state**

Run: `git status --short`
Expected: no uncommitted project files; temporary screenshots are absent from the repository.
