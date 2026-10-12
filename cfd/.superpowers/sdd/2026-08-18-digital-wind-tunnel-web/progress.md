# SDD ledger — plan: /Users/wubo/Documents/2026-2/workflow/sophicar/cfd/docs/superpowers/plans/2026-08-18-digital-wind-tunnel-web.md

## Preflight rulings

- Ruling: implement in the current writable `cfd` project directory on `master` — the user explicitly authorized generating the web in this scoped folder, the parent repository contains an unrelated missing Git object, and the sandbox exposes only this subtree for writes — if wrong, the generated files must later be moved into a dedicated worktree/branch.
- Ruling: do not create per-task commits or use commit-range review packages — the unrelated missing parent-repository object makes commits unreliable and the task scope must not modify parent Git state — if wrong, task history must be reconstructed from the per-task reports and final filesystem state.
- Ruling: keep this plan's SDD workspace under `cfd/.superpowers/sdd/…` — the stock workspace script resolves to the non-writable parent repository root — if wrong, scratch artifacts will need relocation before cleanup.

## Preflight consistency scan

| Scope | Producer → consumer / internal contract | Result |
|---|---|---|
| Task 1 | Vite aliases, test setup, tokens, `AppShell` used by all later UI tasks | Clean |
| Task 2 | `TelemetrySample`, physics helpers, experiment state machine consumed by Tasks 3/8/9 | Clean |
| Task 3 | Zustand store and fixed-step runtime consumed by Tasks 4/6/8/9/11 | Clean |
| Task 4 | Tutorial step definitions/actions consumed by AppShell and Task 11 guided-flow test | Clean |
| Task 5 | LBM types, solver and vehicle mask consumed by Task 6 worker and Task 7 renderer | Clean |
| Task 6 | Worker protocol/runtime consumes Task 5 and feeds Task 7/store | Clean |
| Task 7 | Three.js scene consumes store/flow frames and is hosted by Task 1 shell | Clean |
| Task 8 | Controls/telemetry/charts consume Tasks 2/3 and expose actions for Task 9 | Clean |
| Task 9 | Sweep/report consumes state/telemetry and supplies CSV contract to Task 11 | Clean |
| Task 10 | Resilience, adaptive quality and responsive CSS extend Tasks 1/3/6/7/8 | Clean |
| Task 11 | Integration/E2E verifies the public contracts from Tasks 1–10 | Clean |
| Tasks 1 ↔ 4/7/8 | Shell slots and CSS regions match tutorial, scene, control and chart consumers | Clean |
| Tasks 2 ↔ 3/8/9 | Units and deterministic sample shape are consistent | Clean |
| Tasks 5 ↔ 6/7 | Grid dimensions, transferable frame shape and field names agree | Clean |
| Tasks 8 ↔ 9/11 | Accessible names and export affordances match integration selectors | Clean |

## Task progress

- Task 1: fix round 1/5 (1 addressed, 0 open — add visible and tested 2D teaching-CFD disclaimer; commits none by ruling)
- Task 1: complete (filesystem review clean; no commits by ruling)
- Task 2: complete (filesystem review clean; no commits by ruling)
- Task 3: parked — test cleanup is not failure-safe for timers/listeners/getter spy — Ruling: defer cleanup hardening to Task 10, because production cleanup is correct and the suite is green — if wrong, an earlier failing assertion can pollute later Vitest cases.
- Task 3: complete (filesystem review approved with 1 parked Minor; no commits by ruling)
- Task 4: Ruling: the finding “App evidence never writes back” is real only at whole-app scope and is deferred to Tasks 7–9/11, whose plan text explicitly owns hotspot, sensor, field, stable-window, sweep and report evidence callbacks — implementing those producers in Task 4 would duplicate future modules — if wrong, the tutorial remains non-completable until those later tasks land.
- Task 4: Ruling: the 30% fan condition is represented by the exact `stableSeconds` evidence contract and must be enforced by the Task 8 control/telemetry producer (then integrated in Task 11), not by adding an unplanned field to Task 4 — if wrong, another producer could misuse `stableSeconds` before integration.
- Task 4: fix round 1/5 (2 addressed, 0 open — free-mode next action and lesson-state semantics; commits none by ruling)
- Task 4: complete (scoped fix review clean; cross-task evidence integration deferred by rulings)
- Task 5: fix round 1/5 (1 addressed, 1 open — empty-tunnel wake baseline fixed; nose-ramp assertion not exclusive; commits none by ruling)
- Task 5: fix round 2/5 (1 addressed, 0 open — nose-ramp mutation-sensitive geometry assertion; commits none by ruling)
- Task 5: complete (scoped fix review clean; no commits by ruling)
- Task 6: fix round 1/5 (3 addressed, 0 open — restart no-overlap, ready-inclusive timeout, spawn/init failure cleanup; commits none by ruling)
- Task 6: parked — concurrent duplicate `FlowRuntime.restart()` calls can let an older rejection leave `failed=true` after the newer restart succeeds — Ruling: harden with a shared restart promise or generation owner in Task 10 resilience work, where UI re-entry behavior is finalized — if wrong, rapid repeated recovery actions can leave flow updates stopped.
- Task 6: complete (scoped fix review clean; 1 concurrency observation parked for Task 10)
- Task 7: fix round 1/5 (6 addressed, 0 open — cached WebGL probe, shared solver/scene coordinates, precise hotspot dimming, low-allocation hot paths, lazy buffers, red grille; commits none by ruling)
- Task 7: complete (scoped fix review clean; no commits by ruling)
- Task 8: fix round 1/5 (4 addressed, 0 open — radiogroup keyboard contract, four visible axes, click-time reset guard, nonzero stable window; commits none by ruling)
- Task 8: complete (scoped fix review clean; no commits by ruling)
- Task 9: fix round 1/5 (7 addressed, 0 open — complete/finite residual gate, store sweep ownership, spreadsheet-safe CSV, finite timing/statistics, complete URL cleanup, unified export failure snapshot; commits none by ruling)
- Task 9: complete (scoped fix review clean; no commits by ruling)
- Task 10: closed parked Task 3 failure-safe test cleanup and Task 6 duplicate-restart ownership.
- Task 10: fix round 1/5 (5 addressed, 0 open — restart rejection handling, tabpanel semantics, keyboard camera controls, live-region allowlist, 44px mobile targets; commits none by ruling)
- Task 10: complete (scoped fix review clean; both parked findings closed)
- Task 11: fix round 1/5 (8 addressed, 0 open — CSV content contract, real-flow evidence and timeout downgrade, runtime ownership cleanup, real WebGL recovery, keyboard/overflow coverage, reset dialog/power response, artifact ignores, dedicated E2E server; commits none by ruling)
- Task 11: complete (focused fix review approved; full matrix 154 unit + 5 browser tests green)

## Final-review remediation

- I1: addressed — ordinary runs now have a simulation-time-owned `idle → ramping → stabilizing → sampling → completed` lifecycle; pause/hidden time is not backfilled and invalid timestamps fail safe.
- I2: addressed — exact-30% evidence and sweep/manual stabilization/sampling windows are strictly consecutive and reset on transient, command/run revision, reset, stop, or invalid time boundaries.
- I3: addressed — all four sensor controls open visible, keyboard-accessible definition/unit/20 Hz/simulation/noise-delay-drift explanations; evidence is written only on open.
- I4: addressed — Chapter 6 now compares paired dimensionless `Cp_CFD ↔ Cp_sensor`, requires five fresh solver frames per condition, records a non-empty bias reason, and prints/exports formula, summaries, and raw proxy evidence.
- I5: addressed — accepted flow metadata is atomic and actual; HUD/report/CSV consume generation/grid/tau/requested+actual inlet/scale/recovery/rebuild reason, while raw export identifies mixed configurations across the sweep.
- I6: addressed — particle buffers, host capacity, matrices, and `InstancedMesh.count` change together for 300→1400 and 1400→900.
- I7: addressed — reset restores PRNG/physical/delay state without consuming randomness, returning an exact zero frame and replaying identically.
- M1: parked by final-review ruling — no speculative transport rewrite without measurements; the existing lazy Three chunk warning remains documented.
- M2: addressed — root README documents prerequisites, commands, browser/test scope, simulation/teaching boundaries, exact E2E acceleration, downgrade behavior, and known chunk warning.
- Final verification: 29 Vitest files / 193 tests passed; ESLint passed; TypeScript + production build passed; focused real Chromium tutorial/CSV flow passed; `git diff --check -- .` passed. No Git index/HEAD/branch/commit mutation.

## Final E2E stabilization

- Default Playwright matrix RED: the original unconstrained run used three workers and produced 2 failures / 3 passes. Each page owns a WebGL renderer plus LBM Worker, while the desktop full-page capture alone takes about 24.7 s; concurrent failures moved between context recovery, desktop capture, and focus timing.
- The acceptance environment now uses `workers: 1`, matching the product's single-instance runtime. Per-test 30 s / suite 120 s timeouts and all user-visible assertions remain unchanged.
- Accelerated lifecycle tests now act within the real transient phase instead of racing the 20× simulation clock; the field radio retry still requires an enabled real control and `aria-checked=true` after a real click.
- WebGL recovery RED: a synchronously emitted stale loss from the disconnected old canvas called `onLost` twice (1 failed / 3 passed). The restore handler now removes the old canvas listeners before `onRestored`; the focused unit suite is 4/4 and the real `WEBGL_lose_context` browser case is 1/1.
- Final browser gate: `npm run test:e2e` ran six tests with one worker and passed 6/6 in 2.3 min (controls 20.4 s, context restore 11.6 s, desktop 24.7 s, tablet 11.9 s, mobile 8.4 s, tutorial 58.4 s). Real canvas replacement, post-restore READY/live field, keyboard focus, responsive layout, tutorial/CSV, console errors, and page errors remain asserted.
- Final unified recheck after the late FR-I2/FR-I3 regressions: Vitest 29 files / 193 tests, ESLint, and production build all passed. Build first caught the expected test-only TypeScript RED (`HTMLElement | SVGElement` had no guaranteed `click`); explicit `HTMLButtonElement` guards produced GREEN, and the affected real controls browser case passed again 1/1 in 20.3 s.
