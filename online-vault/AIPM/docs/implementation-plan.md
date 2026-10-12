# Local Knowledge Base Implementation Plan

> Execution: implement inline in the current project following superpowers:executing-plans; use one independent review after implementation.

**Goal:** Build a usable local Chinese knowledge library from verified source navigation and reusable source material.

**Architecture:** Build-time Node.js creates sanitized static article HTML and a search manifest. Dependency-free browser UI reads the manifest, displays the source hierarchy and local article content, and searches saved text. All generated assets reside under `site/`; original inputs and import provenance remain under `content/`.

**Tech Stack:** Python importer, Node.js builder, Markdown, HTML/CSS, plain JavaScript; loopback-only static HTTP server. No external frontend CDN or cloud deployment.

**Spec:** `docs/local-knowledge-base-design.md`, approved by the user's request to continue.

## Constraints and decisions

- Preserve source titles and URLs. Never count link-only records as saved content.
- Save licensed public original material with attribution and version, distinct from Feishu copies.
- No credentials, permission modifications, hidden Feishu APIs, or disabled-download bypasses.
- Only local execution. The empty project is the isolated task workspace; no existing Git repository or application is present.
- Use the supplied document layout as visual reference; functional document reading takes priority over decorative concept generation.
- The user has authorized direct continuation; execute inline without another permission loop.

## Review focus

1. Untrusted HTML, script URLs and raw Markdown HTML must not execute in imported articles.
2. Missing images, inaccessible documents and unexpanded directories must remain visible as incomplete.
3. Duplicate document URLs must not inflate article counts; different title aliases remain searchable.
4. Chinese search, empty results and unknown routes must render a useful state.
5. Locally saved reading and search must not require remote network requests.

## Tasks

- [x] Collect Feishu homepage navigation by visible UI, record categories and verified document URLs in `content/catalog.json`.
- [x] Import the 15 matching Hello-Agents chapters and referenced images into `content/hello-agents/`, pinned to a commit; save license and provenance. Verify names and sample first-chapter text against Feishu.
- [x] Build `scripts/build.mjs`: render Markdown with tables and code, sanitize HTML, rewrite local assets and article links, generate article files and `site/data/catalog.json` with plain-text search content. Validate missing assets and output counts.
- [x] Build `site/index.html`, `site/styles.css`, and `site/app.js`: responsive directory tree, local reader, full-text search, source/status labels, table of contents, prev/next navigation, unknown-route and missing-content states.
- [x] Add `启动知识库.command`, project scripts and README with exact local start instructions; bind only to 127.0.0.1.
- [x] Test sanitizer and asset resolution using malicious HTML and missing-file fixtures. Validate every generated article and local image path, and search known body-only Chinese text.
- [x] Run browser checks for desktop, mobile, empty search, local navigation, source attribution and unavailable articles. Inspect final visual rendering and check remote-resource independence.
- [x] Complete independent code review, fix material findings, update migration report with actual content counts and unresolved items, and hand off the running local URL.

Execution result: implemented the scoped local library, not the entire Feishu archive. See migration-report.md for evidence and the 17 categories with no local body, 53 missing image references, and incomplete original archive inventory.
