# Digital Wind Tunnel Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only CFD teaching lab with simulated wind-tunnel telemetry, a worker-based D2Q9 LBM solver, a Three.js digital tunnel, guided lessons, experiment sweeps, charts, and CSV reports.

**Architecture:** React owns low-frequency application and tutorial state; a deterministic `SimulationSource` produces 20 Hz telemetry; a dedicated Web Worker advances the two-dimensional LBM field; React Three Fiber renders original procedural geometry and samples the field without feeding animation frames back through React. Every numeric result carries simulated/teaching provenance, and all hardware or engineering-CFD integrations remain behind interfaces that are not implemented in this release.

**Tech Stack:** React, TypeScript, Vite, Three.js, React Three Fiber, Zustand, Recharts, Vitest, Testing Library, Playwright, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md`

## Global Constraints

- Run without a backend, Arduino, ESP32, serial port, local daemon, account, or database.
- Use an original programmatic wind-tunnel and vehicle model; do not download or redistribute MakerWorld geometry.
- Label every telemetry value `SIMULATED / 模拟数据` and every flow result `2D TEACHING CFD / 二维教学近似`.
- Use D2Q9 BGK LBM in a Web Worker at 240 × 96 by default, with 160 × 64 and 320 × 128 quality profiles.
- Preserve a fixed 20 Hz telemetry timestep and a seeded pseudo-random generator so identical configurations are reproducible.
- Keep React state updates out of the per-frame Three.js particle loop.
- Support 1440 × 900, 1024 × 768, and 390 × 844 layouts; the narrow layout may lower flow resolution and particle count.
- Respect `prefers-reduced-motion`; provide static streamlines when particles are disabled.
- Use bilingual comments for numerical or non-obvious code: English first, Chinese second.
- Stage only files under `workflow/sophicar/cfd`; the parent repository currently contains an unrelated missing Git blob, so destructive repository repair is forbidden. If a normal commit fails for that known reason, record the failure and continue without changing unrelated staged entries.

## Final Review Amendment — 2026-08-18

This amendment is authoritative where the original task prose below differs from the final reviewed behavior.

- The simulation runtime owns the deterministic manual lifecycle `idle → ramping → stabilizing → sampling → completed`. It advances only from accepted simulation timestamps, rejects non-finite/rollback/oversized `dt`, clears continuous timers after transients or command changes, and grants no hidden-tab or paused wall-time credit.
- The 30% tutorial criterion is a strictly consecutive two-second window. Both endpoints of an accrued interval must be active, stable, and at the exact command; run revision, command, reset, stop, transient, pause boundary, or abnormal timestamp breaks the window.
- A sensor inspection is recorded only when its keyboard-accessible explanation is opened. Every explanation states the definition, unit, 20 Hz cadence, simulated source, deterministic noise, delay, and drift behavior, and preserves the `SIMULATED` disclaimer.
- Chapter 6 compares an honest two-dimensional pressure proxy with the virtual underbody pressure sensor. The fixed reference window is normalized `u=[0.15,0.30), v=[0.70,0.85)` and the underbody window is `u=[0.40,0.65), v=[0.70,0.85)`. For request-time paired samples, `Δp_lu = mean(p_under)-mean(p_ref)`, `Cp_CFD = ΣΔp_lu / Σ(0.5·u_actual²)`, `Cp_sensor = Σp_underbody_Pa / Σ(0.5·1.225·v²)`, and residual is `|Cp_sensor-Cp_CFD|`. The UI explicitly explains that lu and Pa are never subtracted directly and reports the normalized residual percentage.
- A proxy sample is accepted only from a fresh solver frame requested during the same sweep run, same condition, exact commanded power, stable sampling phase, and exact request-time telemetry sequence. Each condition needs at least five independent solver frames (at nominal 10 Hz, at least half a second); the four-second telemetry window waits for those real frames rather than fabricating or reusing samples. Transients clear both telemetry and proxy windows.
- Compare evidence stores the actual selected residual power plus a non-empty learner explanation. Export is enabled only when the selected power equals the computed largest residual and the reason is non-empty.
- Every accepted flow snapshot atomically stores its frame and actual runtime identity: accepted frame id, worker generation, grid, `tau`, requested/actual lattice inlet, recovery scale/reason, request telemetry sequence, sweep revision, and condition. HUDs consume the latest accepted snapshot. Each exported raw proxy sample freezes the runtime identity used for that sample; report/CSV identify mixed grids, generations, scales, and recoveries and report requested/actual inlet ranges. `NON_FINITE_FIELD` 0.8 recovery and timeout quality downgrades therefore remain visible instead of being inferred from the requested profile.
- Reset restores the fixed PRNG initial state without consuming a random value, and flow-particle quality changes update CPU buffers and `InstancedMesh.count` atomically. These are regression-tested independently.

## File Structure

```text
index.html                              Vite HTML entry
package.json                            scripts and dependencies
package-lock.json                       locked dependency graph
tsconfig.json                           strict TypeScript configuration
vite.config.ts                          Vite and Vitest configuration
eslint.config.js                       flat ESLint configuration
playwright.config.ts                    browser test configuration
src/main.tsx                            React root bootstrap
src/App.tsx                             feature composition only
src/styles/global.css                   tokens, layout, responsive rules
src/test/setup.ts                       jsdom matchers and browser polyfills
src/features/shell/AppShell.tsx         application regions and mode header
src/features/shell/ErrorBoundary.tsx    render failure recovery
src/features/shell/quality.ts            quality profile selection
src/features/experiment/model.ts        shared telemetry and experiment types
src/features/experiment/physics.ts      pure aerodynamic teaching formulas
src/features/experiment/SimulationSource.ts deterministic telemetry source
src/features/experiment/experimentMachine.ts pure phase reducer
src/features/experiment/labStore.ts     Zustand store and typed actions
src/features/experiment/simulationRuntime.ts fixed-step timer adapter
src/features/tutorial/lessonDefinitions.ts seven lesson definitions
src/features/tutorial/tutorialProgress.ts pure evidence and completion rules
src/features/tutorial/TutorialRail.tsx  lesson navigation and instruction copy
src/features/tutorial/TutorialModeToggle.tsx guided/free mode control
src/features/flow/types.ts               solver and transferable frame types
src/features/flow/obstacleMask.ts        procedural car cross-section mask
src/features/flow/lbmSolver.ts           D2Q9 BGK solver core
src/features/flow/lbm.worker.ts          worker message loop
src/features/flow/LbmWorkerClient.ts     restartable browser worker adapter
src/features/flow/flowRuntime.ts         10 Hz no-overlap frame requests
src/features/flow/cfdSensorProxy.ts      paired dimensionless CFD/sensor pressure proxy
src/features/scene/WindTunnelScene.tsx  R3F scene composition
src/features/scene/WindTunnelGeometry.tsx procedural tunnel modules
src/features/scene/VehicleModel.tsx      procedural teaching vehicle
src/features/scene/FlowParticles.tsx     ref-driven instanced particles
src/features/scene/FieldSlice.tsx        speed/pressure/vorticity texture plane
src/features/scene/Hotspots.tsx          tutorial part interaction
src/features/scene/flowSampling.ts       pure bilinear field sampling
src/features/scene/SceneFallback.tsx     static accessible fallback
src/features/dashboard/ControlPanel.tsx  fan and experiment controls
src/features/dashboard/TelemetryCards.tsx current measurement cards
src/features/dashboard/HistoryChart.tsx  bounded time-series chart
src/features/dashboard/FieldSelector.tsx flow layer selector
src/features/sweep/sweepRunner.ts        deterministic three-condition runner
src/features/report/experimentSummary.ts stable-window statistics
src/features/report/csv.ts               CSV serialization and download
src/features/report/ExperimentReport.tsx printable result view
e2e/tutorial.spec.ts                     guided-course browser contract
e2e/free-lab.spec.ts                     free experiment browser contract
e2e/responsive.spec.ts                   viewport and overflow contract
```

Production files have colocated `*.test.ts` or `*.test.tsx` files where behavior is testable outside the browser. Browser-only integration remains under `e2e/`.

---

### Task 1: Project Foundation and Accessible Application Shell

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/test/setup.ts`
- Create: `src/styles/global.css`
- Create: `src/features/shell/AppShell.tsx`

**Interfaces:**
- Consumes: none; this is the project foundation.
- Produces: `AppShellProps { left: ReactNode; scene: ReactNode; right: ReactNode; bottom: ReactNode; headerActions?: ReactNode }`, shared CSS tokens, Vitest commands, and the five named application regions used by later tasks.

- [ ] **Step 1: Create the TypeScript/Vite test harness**

Run:

```bash
npm init -y
npm install react react-dom three @react-three/fiber @react-three/drei zustand recharts lucide-react
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom @types/three @types/node eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals @playwright/test
```

Set these exact scripts in `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint ."
  }
}
```

Import `defineConfig` from `vitest/config` in `vite.config.ts`, then configure `plugins: [react()]`, `test.environment = "jsdom"`, `test.setupFiles = ["./src/test/setup.ts"]`, and `test.css = true`. Configure `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `jsx: "react-jsx"`, `moduleResolution: "Bundler"`, `types: ["vite/client", "vitest/globals", "node"]`, and libraries `ES2022`, `DOM`, and `DOM.Iterable`. Put `/// <reference lib="webworker" />` only at the top of `lbm.worker.ts` to avoid global DOM/Worker declaration conflicts.

Create `eslint.config.js` with `typescript-eslint` recommended rules, React Hooks recommended rules, browser globals for `src/**`, Node globals for `vite.config.ts` and `playwright.config.ts`, and ignores for `dist`, `coverage`, and `playwright-report`. Do not disable `react-hooks/rules-of-hooks` or `react-hooks/exhaustive-deps`.

- [ ] **Step 2: Write the failing shell test**

```tsx
// src/App.test.tsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { App } from "./App";

it("renders the five digital wind-tunnel workbench regions", () => {
  render(<App />);
  expect(screen.getByRole("banner")).toHaveTextContent("SophiFlow Lab");
  expect(screen.getByRole("navigation", { name: "教学章节" })).toBeInTheDocument();
  expect(screen.getByRole("main", { name: "数字风洞" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "实验控制" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "实验曲线" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test and verify the expected red state**

Run: `npm run test:run -- src/App.test.tsx`

Expected: FAIL because `./App` and the named workbench regions do not exist.

- [ ] **Step 4: Implement the minimal shell and visual tokens**

Use this public shell contract:

```tsx
// src/features/shell/AppShell.tsx
import type { ReactNode } from "react";

export type AppShellProps = {
  left: ReactNode;
  scene: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
  headerActions?: ReactNode;
};

export function AppShell({ left, scene, right, bottom, headerActions }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div><span className="eyebrow">CFD TEACHING CONSOLE</span><h1>SophiFlow Lab</h1></div>
        <div className="topbar-actions">{headerActions}<span className="provenance-badge">SIMULATED / 模拟数据</span></div>
      </header>
      <nav className="tutorial-rail" aria-label="教学章节">{left}</nav>
      <main className="scene-panel" aria-label="数字风洞">{scene}</main>
      <aside className="control-panel" aria-label="实验控制">{right}</aside>
      <section className="chart-drawer" aria-label="实验曲线">{bottom}</section>
    </div>
  );
}
```

Define CSS tokens `--bg: #071014`, `--panel: #0d181d`, `--panel-raised: #132229`, `--tunnel: #e9e6df`, `--ink: #e9f2f3`, `--muted: #8da3aa`, `--flow: #50e3c2`, `--warning: #f2bd4f`, and `--danger: #e44b43`. Implement a four-area CSS grid with 240 px left rail, flexible scene, 320 px right rail, and 220 px bottom drawer. Do not use gradients.

- [ ] **Step 5: Verify the green state and production build**

Run: `npm run test:run -- src/App.test.tsx`

Expected: PASS, 1 test.

Run: `npm run build`

Expected: exit 0 with a generated `dist/` directory.

- [ ] **Step 6: Commit the foundation if repository integrity permits**

```bash
git add package.json package-lock.json index.html tsconfig.json vite.config.ts eslint.config.js src/main.tsx src/App.tsx src/App.test.tsx src/test/setup.ts src/styles/global.css src/features/shell/AppShell.tsx
git commit -m "feat: scaffold digital wind tunnel web"
```

If the known missing parent-repository blob blocks the commit, preserve the exact staged set and record the command output; do not stage or repair unrelated paths.

---

### Task 2: Deterministic Telemetry Physics and Experiment State Machine

**Files:**
- Create: `src/features/experiment/model.ts`
- Create: `src/features/experiment/physics.ts`
- Create: `src/features/experiment/physics.test.ts`
- Create: `src/features/experiment/SimulationSource.ts`
- Create: `src/features/experiment/SimulationSource.test.ts`
- Create: `src/features/experiment/experimentMachine.ts`
- Create: `src/features/experiment/experimentMachine.test.ts`

**Interfaces:**
- Consumes: no Task 1 production interfaces.
- Produces: `TelemetryFrame`, `SimulationConfig`, `TelemetrySource`, `createDefaultSimulationSource(seed)`, `calculateDynamicPressure`, `stepFirstOrder`, `experimentReducer`, and `ExperimentEvent`.

- [ ] **Step 1: Write failing formula, reproducibility, and reducer tests**

```ts
// physics.test.ts
import { calculateDynamicPressure, stepFirstOrder } from "./physics";

it("calculates standard-air dynamic pressure", () => {
  expect(calculateDynamicPressure(1.225, 10)).toBeCloseTo(61.25, 5);
});

it("moves a first-order response toward its target without overshoot", () => {
  const next = stepFirstOrder(0, 100, 50, 1000);
  expect(next).toBeGreaterThan(0);
  expect(next).toBeLessThan(100);
});
```

```ts
// SimulationSource.test.ts
import { createDefaultSimulationSource } from "./SimulationSource";

it("replays identical telemetry for an identical seed and command sequence", () => {
  const a = createDefaultSimulationSource(42);
  const b = createDefaultSimulationSource(42);
  a.setFanPower(60); b.setFanPower(60);
  const framesA = Array.from({ length: 80 }, () => a.step(50));
  const framesB = Array.from({ length: 80 }, () => b.step(50));
  expect(framesA).toEqual(framesB);
  expect(framesA.at(-1)!.windSpeedMps).toBeGreaterThan(0);
});

it("labels every generated frame as simulated", () => {
  const source = createDefaultSimulationSource(1);
  expect(source.step(50).provenance).toBe("simulated");
});
```

```ts
// experimentMachine.test.ts
import { experimentReducer, initialExperimentState } from "./experimentMachine";

it("pauses and resumes the exact prior phase", () => {
  const running = { ...initialExperimentState, phase: "sampling" as const };
  const paused = experimentReducer(running, { type: "pause" });
  expect(paused).toMatchObject({ phase: "paused", resumePhase: "sampling" });
  expect(experimentReducer(paused, { type: "resume" }).phase).toBe("sampling");
});

it("reset always returns to idle", () => {
  expect(experimentReducer({ phase: "completed", resumePhase: null }, { type: "reset" }))
    .toEqual(initialExperimentState);
});
```

- [ ] **Step 2: Run the tests and verify the expected red state**

Run: `npm run test:run -- src/features/experiment`

Expected: FAIL because the experiment modules are missing.

- [ ] **Step 3: Implement exact domain contracts and formulas**

```ts
// model.ts
export type RunPhase = "idle" | "ramping" | "stabilizing" | "sampling" | "paused" | "completed";
export type ActiveRunPhase = Exclude<RunPhase, "idle" | "paused" | "completed">;

export type TelemetryFrame = {
  sequence: number;
  simulationTimeMs: number;
  phase: RunPhase;
  fanPowerPct: number;
  rpm: number;
  windSpeedMps: number;
  underbodyPressurePa: number;
  verticalLoadN: number;
  quality: "transient" | "stable" | "invalid";
  provenance: "simulated";
};

export type SimulationConfig = {
  maxRpm: number;
  maxWindSpeedMps: number;
  airDensityKgM3: number;
  referenceAreaM2: number;
  pressureCoefficient: number;
  liftCoefficient: number;
  rampTauMs: number;
  coastTauMs: number;
  windTauMs: number;
};

export interface TelemetrySource {
  setFanPower(percent: number): void;
  setPhase(phase: RunPhase): void;
  step(dtMs: number): TelemetryFrame;
  reset(): TelemetryFrame;
}
```

Implement:

```ts
export const calculateDynamicPressure = (rho: number, velocity: number) => 0.5 * rho * velocity ** 2;

export function stepFirstOrder(current: number, target: number, dtMs: number, tauMs: number) {
  const alpha = 1 - Math.exp(-dtMs / tauMs);
  return current + (target - current) * alpha;
}
```

Use default configuration `{ maxRpm: 6200, maxWindSpeedMps: 12, airDensityKgM3: 1.225, referenceAreaM2: 0.018, pressureCoefficient: 0.62, liftCoefficient: 0.38, rampTauMs: 1200, coastTauMs: 650, windTauMs: 900 }`. Clamp power to 0–100. Use xorshift32 for noise with fixed amplitudes of 0.35% RPM, 0.5% wind, 0.8 Pa pressure, and 0.015 N load. Add bounded zero drift of `0.35 * sin(t / 45000)` Pa and `0.006 * sin(t / 60000)` N. Model fixed acquisition delay with the current RPM, wind delayed by one 50 ms sample, and pressure/load delayed by two samples. Compute `quality = "stable"` from the un-noised, un-delayed physical state only when RPM is within 3% of target and wind-speed change is below 0.03 m/s over the current step; measurement noise must never prevent a physically stable run from completing.

Implement the reducer so `start` is accepted only from `idle`/`completed`, `pause` only from active phases, `resume` only from `paused`, `advance` follows the main phase sequence, and `reset` always returns `{ phase: "idle", resumePhase: null }`.

- [ ] **Step 4: Run domain tests and verify green**

Run: `npm run test:run -- src/features/experiment`

Expected: all formula, simulation, and state-machine tests PASS with no warnings.

- [ ] **Step 5: Commit the domain layer if repository integrity permits**

```bash
git add src/features/experiment/model.ts src/features/experiment/physics.ts src/features/experiment/physics.test.ts src/features/experiment/SimulationSource.ts src/features/experiment/SimulationSource.test.ts src/features/experiment/experimentMachine.ts src/features/experiment/experimentMachine.test.ts
git commit -m "feat: add deterministic wind tunnel telemetry"
```

---

### Task 3: Zustand Lab Store and Fixed-Step Runtime

**Files:**
- Create: `src/features/experiment/labStore.ts`
- Create: `src/features/experiment/labStore.test.ts`
- Create: `src/features/experiment/simulationRuntime.ts`
- Create: `src/features/experiment/simulationRuntime.test.ts`

**Interfaces:**
- Consumes: `TelemetryFrame`, `TelemetrySource`, `RunPhase`, `createDefaultSimulationSource`, and `experimentReducer` from Task 2.
- Produces: `labStore`, `useLabStore(selector)`, `MAX_HISTORY = 1200`, and `startSimulationRuntime({ source, tickMs, stepsPerTick? }) => stop`.

- [ ] **Step 1: Write failing bounded-history and timer tests**

```ts
// labStore.test.ts
import { labStore, MAX_HISTORY } from "./labStore";

it("keeps at most sixty seconds of 20 Hz telemetry", () => {
  const frame = labStore.getState().telemetry;
  for (let index = 0; index < MAX_HISTORY + 25; index += 1) {
    labStore.getState().acceptFrame({ ...frame, sequence: index });
  }
  expect(labStore.getState().history).toHaveLength(MAX_HISTORY);
  expect(labStore.getState().history[0]!.sequence).toBe(25);
});

it("clamps fan commands and exposes typed control actions", () => {
  labStore.getState().setFanPower(140);
  expect(labStore.getState().fanPowerPct).toBe(100);
  labStore.getState().setFanPower(-4);
  expect(labStore.getState().fanPowerPct).toBe(0);
});
```

```ts
// simulationRuntime.test.ts
import { vi } from "vitest";
import { createDefaultSimulationSource } from "./SimulationSource";
import { labStore } from "./labStore";
import { startSimulationRuntime } from "./simulationRuntime";

it("advances active experiments at a fixed 50 ms timestep and stops cleanly", () => {
  vi.useFakeTimers();
  labStore.getState().resetLab();
  labStore.getState().startRun();
  const stop = startSimulationRuntime({ source: createDefaultSimulationSource(7), tickMs: 50 });
  vi.advanceTimersByTime(250);
  expect(labStore.getState().history).toHaveLength(5);
  stop();
  vi.advanceTimersByTime(100);
  expect(labStore.getState().history).toHaveLength(5);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/experiment/labStore.test.ts src/features/experiment/simulationRuntime.test.ts`

Expected: FAIL because the store and runtime do not exist.

- [ ] **Step 3: Implement the store contract**

Use Zustand's vanilla `createStore` so non-React runtimes can write frames:

```ts
export const MAX_HISTORY = 1200;

export type LabState = {
  phase: RunPhase;
  resumePhase: ActiveRunPhase | null;
  fanPowerPct: number;
  telemetry: TelemetryFrame;
  history: TelemetryFrame[];
  selectedField: "speed" | "pressure" | "vorticity" | "streamlines";
  setFanPower(percent: number): void;
  acceptFrame(frame: TelemetryFrame): void;
  startRun(): void;
  pauseRun(): void;
  resumeRun(): void;
  advancePhase(): void;
  resetLab(): void;
  selectField(field: LabState["selectedField"]): void;
};
```

`acceptFrame` must use one `slice(-MAX_HISTORY + 1)` plus append, and runtime updates must set the `SimulationSource` power and phase before every `step(50)`. `stepsPerTick` defaults to 1 and, when greater than 1 in E2E only, repeats the same fixed 50 ms step that many times per wall-clock interval. Skip ticks when phase is `idle`, `paused`, or `completed`. Register `visibilitychange`; hidden pages pause scheduling and visible pages resume without backfilling elapsed time.

- [ ] **Step 4: Verify store/runtime green and regression safety**

Run: `npm run test:run -- src/features/experiment`

Expected: all Task 2 and Task 3 tests PASS.

- [ ] **Step 5: Commit if repository integrity permits**

```bash
git add src/features/experiment/labStore.ts src/features/experiment/labStore.test.ts src/features/experiment/simulationRuntime.ts src/features/experiment/simulationRuntime.test.ts
git commit -m "feat: run fixed-step virtual experiments"
```

---

### Task 4: Seven-Chapter Tutorial Progress and Rail

**Files:**
- Create: `src/features/tutorial/lessonDefinitions.ts`
- Create: `src/features/tutorial/tutorialProgress.ts`
- Create: `src/features/tutorial/tutorialProgress.test.ts`
- Create: `src/features/tutorial/TutorialRail.tsx`
- Create: `src/features/tutorial/TutorialRail.test.tsx`
- Create: `src/features/tutorial/TutorialModeToggle.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `RunPhase` and selected field identifiers from Tasks 2–3.
- Produces: `LessonId`, `TutorialMode`, `LESSONS`, `TutorialEvidence`, `canCompleteLesson`, `advanceLesson`, `<TutorialRail />`, and `<TutorialModeToggle />`.

- [ ] **Step 1: Write failing evidence and rail tests**

```ts
// tutorialProgress.test.ts
import { canCompleteLesson, emptyEvidence } from "./tutorialProgress";

it("requires all five physical hotspots for the anatomy lesson", () => {
  expect(canCompleteLesson("anatomy", emptyEvidence)).toBe(false);
  expect(canCompleteLesson("anatomy", {
    ...emptyEvidence,
    viewedHotspots: ["straightener", "contraction", "test-section", "model-stand", "fan"],
  })).toBe(true);
});

it("does not complete the flow lesson until every view was opened", () => {
  expect(canCompleteLesson("flow", {
    ...emptyEvidence,
    viewedFields: ["speed", "pressure", "vorticity"],
  })).toBe(false);
});

it("requires the four sensor explanations and a selected stable chart window", () => {
  expect(canCompleteLesson("sensors", {
    ...emptyEvidence,
    viewedSensors: ["rpm", "wind", "pressure", "load"],
    inspectedStableWindow: false,
  })).toBe(false);
});
```

```tsx
// TutorialRail.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { TutorialRail } from "./TutorialRail";
import { TutorialModeToggle } from "./TutorialModeToggle";
import { emptyEvidence } from "./tutorialProgress";

it("lists all seven chapters and explains why next is locked", () => {
  render(<TutorialRail activeLesson="anatomy" evidence={emptyEvidence} onAdvance={() => undefined} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(7);
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeDisabled();
  expect(screen.getByText(/查看 5 个风洞模块/)).toBeInTheDocument();
});

it("switches to free mode without mutating tutorial evidence", async () => {
  const user = userEvent.setup();
  const onModeChange = vi.fn();
  render(<TutorialModeToggle mode="guided" onModeChange={onModeChange} />);
  await user.click(screen.getByRole("button", { name: "自由实验" }));
  expect(onModeChange).toHaveBeenCalledWith("free");
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/tutorial`

Expected: FAIL because tutorial modules do not exist.

- [ ] **Step 3: Implement exact lesson and evidence contracts**

```ts
export type LessonId = "anatomy" | "fan" | "sensors" | "flow" | "sweep" | "compare" | "report";

export type TutorialEvidence = {
  viewedHotspots: string[];
  stableSeconds: number;
  viewedSensors: string[];
  inspectedStableWindow: boolean;
  viewedFields: string[];
  flowAnswerCorrect: boolean;
  completedSweepPowers: number[];
  selectedLargestResidualPower: 30 | 60 | 90 | null;
  comparisonReason: string;
  reportConclusion: string;
};
```

Define `TutorialMode = "guided" | "free"`. Define `LESSONS` in the exact order above with Chinese titles, one-sentence goals, completion hints, and ordinal numbers 1–7. Completion rules are: five required hotspots; 2 stable seconds at 30%; four sensor cards plus `inspectedStableWindow`; four fields plus correct answer; sweep powers exactly containing 30/60/90; residual selection; and, for the report chapter, all three completed sweep powers plus a trimmed conclusion of at least 12 characters.

`TutorialRail` renders a numbered list, progress count, goal, completion hint, and next button. Completed chapters remain selectable; future chapters display locked styling but remain readable. `TutorialModeToggle` is a topbar segmented control named `教学模式` and `自由实验`; switching to free mode lifts lesson control restrictions without clearing active lesson or evidence, and switching back restores the same tutorial position. Integrate it through `AppShell.headerActions` while the rail remains in the left region.

- [ ] **Step 4: Verify tutorial green and shell regression**

Run: `npm run test:run -- src/features/tutorial src/App.test.tsx`

Expected: tutorial tests and the original shell test PASS.

- [ ] **Step 5: Commit if repository integrity permits**

```bash
git add src/features/tutorial/lessonDefinitions.ts src/features/tutorial/tutorialProgress.ts src/features/tutorial/tutorialProgress.test.ts src/features/tutorial/TutorialRail.tsx src/features/tutorial/TutorialRail.test.tsx src/features/tutorial/TutorialModeToggle.tsx src/App.tsx
git commit -m "feat: add guided CFD curriculum"
```

---

### Task 5: D2Q9 LBM Core and Procedural Vehicle Mask

**Files:**
- Create: `src/features/flow/types.ts`
- Create: `src/features/flow/obstacleMask.ts`
- Create: `src/features/flow/obstacleMask.test.ts`
- Create: `src/features/flow/lbmSolver.ts`
- Create: `src/features/flow/lbmSolver.test.ts`

**Interfaces:**
- Consumes: no runtime interfaces; inlet velocity is normalized before it reaches this task.
- Produces: `FlowFieldFrame`, `LbmConfig`, `NumericalInstabilityError`, `createCarProfileMask`, and `LbmSolver` with `setInletVelocity(value)`, `step(iterations)`, and `snapshot()`.

- [ ] **Step 1: Write failing mask and solver tests**

```ts
// obstacleMask.test.ts
import { createCarProfileMask } from "./obstacleMask";

it("creates an interior car profile without blocking inlet or outlet", () => {
  const width = 80;
  const height = 32;
  const mask = createCarProfileMask(width, height);
  expect(mask.some((cell) => cell === 1)).toBe(true);
  for (let y = 0; y < height; y += 1) {
    expect(mask[y * width]).toBe(0);
    expect(mask[y * width + width - 1]).toBe(0);
  }
});
```

```ts
// lbmSolver.test.ts
import { LbmSolver } from "./lbmSolver";
import { createCarProfileMask } from "./obstacleMask";

it("preserves a finite rest field", () => {
  const solver = new LbmSolver({ width: 48, height: 24, inletVelocity: 0, tau: 0.62, obstacleMask: new Uint8Array(48 * 24) });
  const frame = solver.step(20);
  expect(Math.max(...frame.speed)).toBeCloseTo(0, 6);
  expect(Array.from(frame.pressure).every(Number.isFinite)).toBe(true);
  const meanPressure = Array.from(frame.pressure).reduce((sum, value) => sum + value, 0) / frame.pressure.length;
  expect(meanPressure).toBeCloseTo(0, 6);
});

it("produces forward flow and a slower vehicle wake", () => {
  const width = 96;
  const height = 40;
  const solver = new LbmSolver({ width, height, inletVelocity: 0.055, tau: 0.62, obstacleMask: createCarProfileMask(width, height) });
  const frame = solver.step(160);
  const upstream = frame.speed[Math.floor(height / 2) * width + 20]!;
  const wake = frame.speed[Math.floor(height / 2) * width + 72]!;
  expect(upstream).toBeGreaterThan(0.01);
  expect(wake).toBeLessThan(upstream);
  expect(Array.from(frame.vorticity).every(Number.isFinite)).toBe(true);
});

it("keeps solid-cell speed at zero", () => {
  const width = 64;
  const height = 32;
  const mask = createCarProfileMask(width, height);
  const solver = new LbmSolver({ width, height, inletVelocity: 0.04, tau: 0.62, obstacleMask: mask });
  const frame = solver.step(40);
  const solidIndex = mask.findIndex((cell) => cell === 1);
  expect(frame.speed[solidIndex]).toBe(0);
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/flow/obstacleMask.test.ts src/features/flow/lbmSolver.test.ts`

Expected: FAIL because the flow modules are missing.

- [ ] **Step 3: Define transferable flow types and procedural mask**

```ts
export type LbmConfig = {
  width: number;
  height: number;
  inletVelocity: number;
  tau: number;
  obstacleMask: Uint8Array;
};

export type FlowFieldFrame = {
  width: number;
  height: number;
  speed: Float32Array;
  pressure: Float32Array;
  vorticity: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  provenance: "2d-teaching-cfd";
};
```

`createCarProfileMask(width, height)` combines a rounded lower body, cabin, nose ramp, and two wheel cutouts in normalized coordinates. Keep the model between x = 36%–66% and y = 43%–66% of the grid. The mask uses `1` for solid cells and `0` for fluid; it must not modify tunnel boundaries.

- [ ] **Step 4: Implement the D2Q9 BGK solver**

Use the exact lattice constants:

```ts
const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1] as const;
const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1] as const;
const WEIGHT = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36] as const;
const OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6] as const;

function equilibrium(direction: number, density: number, ux: number, uy: number) {
  const cu = 3 * (CX[direction]! * ux + CY[direction]! * uy);
  const u2 = ux * ux + uy * uy;
  return WEIGHT[direction]! * density * (1 + cu + 0.5 * cu * cu - 1.5 * u2);
}
```

Allocate two `Float32Array(width * height * 9)` distribution buffers and initialize every fluid cell to equilibrium at density 1 and zero velocity. Each iteration must:

1. Compute density and velocity for each fluid cell.
2. Relax each distribution with `fPost = f - (f - fEq) / tau`.
3. Stream to the neighbor cell; if the neighbor is solid or outside the top/bottom wall, write the value into the opposite direction at the source cell.
4. Replace the left boundary with equilibrium at density 1 and the current inlet velocity.
5. Copy outgoing distributions from x = `width - 2` into the right boundary for a zero-gradient teaching outlet.
6. Swap buffers without allocating during the step loop.

Clamp inlet velocity to `[0, 0.08]`; throw a typed `RangeError` when `tau <= 0.5`. In `snapshot`, set solid-cell velocity to zero, compute pressure as `(density - 1) / 3`, and compute vorticity using centered finite differences with one-sided differences at edges. For a zero-inlet rest field, require mean pressure drift below `1e-6` after 20 iterations as the finite-step mass-conservation check. Throw `NumericalInstabilityError` with code `NON_FINITE_FIELD` when any field value is non-finite; do not silently return invalid fields.

- [ ] **Step 5: Run focused and full unit tests**

Run: `npm run test:run -- src/features/flow/obstacleMask.test.ts src/features/flow/lbmSolver.test.ts`

Expected: all flow-core tests PASS.

Run: `npm run test:run`

Expected: all project tests PASS.

- [ ] **Step 6: Commit if repository integrity permits**

```bash
git add src/features/flow/types.ts src/features/flow/obstacleMask.ts src/features/flow/obstacleMask.test.ts src/features/flow/lbmSolver.ts src/features/flow/lbmSolver.test.ts
git commit -m "feat: add browser LBM teaching solver"
```

---

### Task 6: Restartable LBM Worker and Flow Runtime

**Files:**
- Create: `src/features/flow/lbm.worker.ts`
- Create: `src/features/flow/LbmWorkerClient.ts`
- Create: `src/features/flow/LbmWorkerClient.test.ts`
- Create: `src/features/flow/flowRuntime.ts`
- Create: `src/features/flow/flowRuntime.test.ts`
- Modify: `src/features/experiment/labStore.ts`

**Interfaces:**
- Consumes: `LbmConfig`, `FlowFieldFrame`, `LbmSolver`, `createCarProfileMask`, and current `windSpeedMps` from the lab store.
- Produces: `LbmWorkerClient`, `WorkerLike`, `mapWindToLatticeVelocity`, `FlowRuntime { stop(); restart(); }`, `startFlowRuntime`, and store fields `flowField`, `flowStatus`, `flowError`, `eventLog`.

- [ ] **Step 1: Write failing client and no-overlap runtime tests**

```ts
// LbmWorkerClient.test.ts
import { LbmWorkerClient, type WorkerLike } from "./LbmWorkerClient";

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown[] = [];
  postMessage(message: unknown) { this.posted.push(message); }
  terminate() { this.posted.push("terminated"); }
}

it("resolves one frame request and transfers typed arrays", async () => {
  const worker = new FakeWorker();
  const client = new LbmWorkerClient(() => worker, { width: 2, height: 1, inletVelocity: 0, tau: 0.62 });
  const ready = client.ready();
  worker.onmessage?.({ data: { type: "ready" } } as MessageEvent);
  await ready;
  const pending = client.requestFrame(0.04);
  worker.onmessage?.({ data: {
    type: "frame", requestId: 1, frame: {
      width: 2, height: 1,
      speed: new Float32Array(2), pressure: new Float32Array(2), vorticity: new Float32Array(2),
      velocityX: new Float32Array(2), velocityY: new Float32Array(2), provenance: "2d-teaching-cfd",
    },
  }} as MessageEvent);
  await expect(pending).resolves.toMatchObject({ width: 2, provenance: "2d-teaching-cfd" });
});

it("rejects pending work when disposed", async () => {
  const worker = new FakeWorker();
  const client = new LbmWorkerClient(() => worker, { width: 2, height: 1, inletVelocity: 0, tau: 0.62 });
  const ready = client.ready();
  worker.onmessage?.({ data: { type: "ready" } } as MessageEvent);
  await ready;
  const pending = client.requestFrame(0.04);
  client.dispose();
  await expect(pending).rejects.toThrow("disposed");
});
```

```ts
// flowRuntime.test.ts
import { mapWindToLatticeVelocity } from "./flowRuntime";

it("maps real speed into the stable teaching range", () => {
  expect(mapWindToLatticeVelocity(0)).toBe(0);
  expect(mapWindToLatticeVelocity(6)).toBeCloseTo(0.04, 5);
  expect(mapWindToLatticeVelocity(99)).toBe(0.08);
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/flow/LbmWorkerClient.test.ts src/features/flow/flowRuntime.test.ts`

Expected: FAIL because the worker adapter and runtime do not exist.

- [ ] **Step 3: Implement the worker protocol and transfer ownership**

Use discriminated messages:

```ts
type WorkerRequest =
  | { type: "init"; config: Omit<LbmConfig, "obstacleMask"> }
  | { type: "frame"; requestId: number; inletVelocity: number; iterations: number }
  | { type: "dispose" };

type WorkerResponse =
  | { type: "ready" }
  | { type: "frame"; requestId: number; frame: FlowFieldFrame }
  | { type: "error"; requestId?: number; code: "NON_FINITE_FIELD" | "WORKER_FAILURE"; message: string };
```

The worker builds its obstacle mask after `init`, advances four iterations for each default request, and posts all five `Float32Array.buffer` objects in the transfer list. `LbmWorkerClient(workerFactory, config)` immediately posts `init`, exposes `ready(): Promise<void>`, and persists the config for restart. Its production factory is:

```ts
() => new Worker(new URL("./lbm.worker.ts", import.meta.url), { type: "module" })
```

Track monotonically increasing request IDs and one pending promise per ID. `requestFrame` waits for `ready()` before posting. A worker error rejects all pending requests, sets the client to failed, and allows `restart()` to terminate the old worker, post the persisted config to a replacement, and await its ready response. A 1,500 ms request timeout rejects the request with `Flow worker timed out`.

- [ ] **Step 4: Implement the 10 Hz no-overlap flow runtime**

```ts
export function mapWindToLatticeVelocity(windSpeedMps: number) {
  return Math.min(0.08, Math.max(0, windSpeedMps / 12 * 0.08));
}
```

`startFlowRuntime` uses a 100 ms interval but skips a tick while the previous promise is pending or `document.hidden` is true. On success, write `flowField` and `flowStatus: "ready"` to the store. On a `NON_FINITE_FIELD` response, preserve the last valid frame, append an event-log entry, multiply the requested lattice velocity by 0.8, restart the worker once, and retry the current condition. If instability repeats, or for any other failure, write `flowStatus: "failed"` plus the error message. Return `{ stop, restart }`; `restart()` clears only the flow error, calls `client.restart()`, and resumes frame requests without resetting telemetry or tutorial progress. `App` passes this runtime callback to the recovery button rather than storing a worker instance inside Zustand.

- [ ] **Step 5: Verify flow transport and regressions**

Run: `npm run test:run -- src/features/flow src/features/experiment`

Expected: worker-client, runtime, LBM, and experiment tests PASS.

- [ ] **Step 6: Commit if repository integrity permits**

```bash
git add src/features/flow/lbm.worker.ts src/features/flow/LbmWorkerClient.ts src/features/flow/LbmWorkerClient.test.ts src/features/flow/flowRuntime.ts src/features/flow/flowRuntime.test.ts src/features/experiment/labStore.ts
git commit -m "feat: stream LBM fields from a web worker"
```

---

### Task 7: Three.js Digital Tunnel and Flow Visualization

**Files:**
- Create: `src/features/scene/flowSampling.ts`
- Create: `src/features/scene/flowSampling.test.ts`
- Create: `src/features/scene/WindTunnelGeometry.tsx`
- Create: `src/features/scene/VehicleModel.tsx`
- Create: `src/features/scene/FlowParticles.tsx`
- Create: `src/features/scene/FieldSlice.tsx`
- Create: `src/features/scene/Hotspots.tsx`
- Create: `src/features/scene/SceneFallback.tsx`
- Create: `src/features/scene/WindTunnelScene.tsx`
- Create: `src/features/scene/WindTunnelScene.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `FlowFieldFrame`, store `flowField`, selected field, telemetry wind speed, and tutorial hotspot callback.
- Produces: `sampleFlowVelocity(frame, u, v)`, `<WindTunnelScene />`, and exact hotspot identifiers required by Task 4.

- [ ] **Step 1: Write failing field-sampling and accessible fallback tests**

```ts
// flowSampling.test.ts
import { sampleFlowVelocity } from "./flowSampling";

it("bilinearly samples a normalized flow coordinate", () => {
  const frame = {
    width: 2, height: 2,
    velocityX: new Float32Array([0, 2, 4, 6]),
    velocityY: new Float32Array([0, 0, 2, 2]),
  };
  expect(sampleFlowVelocity(frame, 0.5, 0.5)).toEqual({ x: 3, y: 1 });
});

it("clamps samples to the field boundary", () => {
  const frame = { width: 2, height: 1, velocityX: new Float32Array([1, 2]), velocityY: new Float32Array([0, 0]) };
  expect(sampleFlowVelocity(frame, 9, 0).x).toBe(2);
});
```

```tsx
// WindTunnelScene.test.tsx
import { render, screen } from "@testing-library/react";
import { WindTunnelScene } from "./WindTunnelScene";

it("renders an explanatory fallback when WebGL is unavailable", () => {
  render(<WindTunnelScene webglAvailable={false} onHotspot={() => undefined} />);
  expect(screen.getByRole("img", { name: "模块化数字风洞示意图" })).toBeInTheDocument();
  expect(screen.getByText(/浏览器无法初始化 WebGL/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/scene`

Expected: FAIL because scene modules do not exist.

- [ ] **Step 3: Implement pure sampling and programmatic geometry**

`sampleFlowVelocity` clamps normalized `u` and `v` to 0–1, maps them to cell coordinates, and performs bilinear interpolation over `velocityX` and `velocityY`.

Build the wind tunnel only from Three.js primitives:

- fan module: short cylinder, red grille, six static blade meshes;
- diffuser/contraction: tapered boxes created with `BufferGeometry`;
- two honeycomb straightener planes using instanced hexagonal rings;
- transparent test chamber with a glass material and dark structural hoops;
- red model stand and a procedural vehicle made from rounded boxes, a wedge nose, cabin, wheels, and a small rear wing.

Place the tunnel on the x-axis with airflow traveling from x = -6 to x = 6. Use off-white body surfaces, charcoal frames, and red functional elements. Add hotspot buttons as DOM overlays or accessible companion buttons with exact IDs `straightener`, `contraction`, `test-section`, `model-stand`, and `fan`. Activating a hotspot highlights that module, dims the others, opens its explanation card, and records tutorial evidence. Activating `test-section` additionally toggles a cutaway view so the vehicle and center flow plane remain visible.

- [ ] **Step 4: Implement ref-driven particles and field texture**

Create 900 particles at desktop default. Store positions in a `Float32Array` ref; in `useFrame`, sample the latest field from a ref and update the instance matrix. Reset particles at x = -2.8 when they leave x = 2.8 or stall for more than 1.5 seconds. Freeze particle positions when the experiment phase is `paused`, while leaving camera controls available for wake inspection. Never call a React state setter inside `useFrame`.

`FieldSlice` converts only a newly received field frame into a 120 × 48 `DataTexture`. `VehicleModel` also receives the current normalized pressure samples and updates a small fixed set of body material bands only when a new field arrives, providing the specified teaching pressure pseudocolor without remeshing the vehicle. Color maps are fixed and accessible:

- speed: dark teal → cyan → off-white;
- pressure: blue → neutral gray → red;
- vorticity: purple → neutral gray → amber;
- streamlines: transparent slice with only cyan path traces.

Display `2D TEACHING CFD / 二维教学近似` in the scene HUD. For reduced motion, render 24 static streamline curves and do not mount `FlowParticles`.

- [ ] **Step 5: Integrate the scene and verify tests/build**

Mount `WindTunnelScene` in the central shell region. Use `React.lazy` and `Suspense` so Three.js loads after the shell, with a semantic loading message `正在初始化数字风洞…`.

Run: `npm run test:run -- src/features/scene src/App.test.tsx`

Expected: sampling, fallback, and shell tests PASS.

Run: `npm run build`

Expected: exit 0; Three.js is emitted in a separate lazy chunk.

- [ ] **Step 6: Commit if repository integrity permits**

```bash
git add src/features/scene src/App.tsx
git commit -m "feat: render modular threejs wind tunnel"
```

---

### Task 8: Experiment Controls, Telemetry Cards, Field Selector, and Charts

**Files:**
- Create: `src/features/dashboard/ControlPanel.tsx`
- Create: `src/features/dashboard/TelemetryCards.tsx`
- Create: `src/features/dashboard/HistoryChart.tsx`
- Create: `src/features/dashboard/FieldSelector.tsx`
- Create: `src/features/dashboard/Dashboard.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Consumes: `labStore`, `useLabStore`, `TelemetryFrame`, selected field, and tutorial evidence callbacks.
- Produces: accessible fan/start/pause/reset controls, four telemetry cards, a bounded multi-series chart, and four flow-layer buttons.

- [ ] **Step 1: Write failing dashboard behavior tests**

```tsx
// Dashboard.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { labStore } from "../experiment/labStore";
import { ControlPanel } from "./ControlPanel";
import { TelemetryCards } from "./TelemetryCards";
import { FieldSelector } from "./FieldSelector";

beforeEach(() => labStore.getState().resetLab());

it("commands fan power and changes the run state", async () => {
  const user = userEvent.setup();
  render(<ControlPanel />);
  const slider = screen.getByRole("slider", { name: "风扇功率" });
  await user.click(slider);
  await user.keyboard("{End}");
  expect(labStore.getState().fanPowerPct).toBe(100);
  await user.click(screen.getByRole("button", { name: "启动实验" }));
  expect(labStore.getState().phase).toBe("ramping");
});

it("shows four units and simulated provenance", () => {
  render(<TelemetryCards onInspect={() => undefined} />);
  expect(screen.getByText("RPM")).toBeInTheDocument();
  expect(screen.getByText("m/s")).toBeInTheDocument();
  expect(screen.getByText("Pa")).toBeInTheDocument();
  expect(screen.getByText("N")).toBeInTheDocument();
  expect(screen.getAllByText("SIMULATED")).toHaveLength(4);
});

it("selects all four teaching field views", async () => {
  const user = userEvent.setup();
  render(<FieldSelector onInspect={() => undefined} />);
  await user.click(screen.getByRole("radio", { name: "压力" }));
  expect(labStore.getState().selectedField).toBe("pressure");
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/dashboard/Dashboard.test.tsx`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement controls and semantic data cards**

`ControlPanel` includes:

- a range input from 0 to 100 with step 1 and a synchronized numeric output;
- primary start/resume button;
- pause button enabled only in an active phase;
- stop/reset button with a confirmation only when history is non-empty;
- run-phase badge with Chinese and English state labels.

`TelemetryCards` renders RPM, wind speed, underbody pressure, and vertical load using fixed formats: integer RPM, two decimals for m/s, one decimal for Pa, and three decimals for N. Each card includes `SIMULATED`, the unit, quality, and an inspect button used as tutorial evidence. Negative pressure must retain its minus sign and use the label `车底相对压力`.

`FieldSelector` is a radiogroup with `速度`, `压力`, `涡量`, and `流线`. Every selection updates the store and reports the field identifier to the tutorial evidence callback.

Below the selector, display a solver status row containing `D2Q9 BGK`, the grid/generation/`tau` from the latest accepted frame, requested and actual mapped lattice inlet velocity, recovery scale/reason, flow status, and `二维教学近似`. This status is read-only and never presents Cd/Cl values or guesses runtime identity from the requested quality profile.

- [ ] **Step 4: Implement the bounded chart and jsdom observer polyfill**

Use Recharts `ResponsiveContainer`, `LineChart`, four `Line` elements, a time-seconds x-axis, and unit-specific y-axes grouped into velocity/RPM and pressure/load. Render at most the existing 1,200 store samples. The legend can hide a series but must not delete history.

Add a deterministic `ResizeObserver` polyfill in `src/test/setup.ts`:

```ts
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
```

Mount controls and telemetry in the right region, and charts in the bottom region. Keep chart data transformation in a module-level pure function so unchanged history does not produce multiple mapping passes per render. When a stable segment exists, render a keyboard-accessible `标记稳定窗口` button anchored to that segment; activating it sets tutorial evidence `inspectedStableWindow = true` without mutating telemetry history.

- [ ] **Step 5: Verify dashboard, shell, and build**

Run: `npm run test:run -- src/features/dashboard src/App.test.tsx`

Expected: dashboard and shell tests PASS.

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 6: Commit if repository integrity permits**

```bash
git add src/features/dashboard src/App.tsx src/test/setup.ts
git commit -m "feat: add wind tunnel controls and telemetry"
```

---

### Task 9: Three-Condition Sweep, Comparison, and CSV Report

**Files:**
- Create: `src/features/sweep/sweepRunner.ts`
- Create: `src/features/sweep/sweepRunner.test.ts`
- Create: `src/features/report/experimentSummary.ts`
- Create: `src/features/report/experimentSummary.test.ts`
- Create: `src/features/report/csv.ts`
- Create: `src/features/report/csv.test.ts`
- Create: `src/features/report/ExperimentReport.tsx`
- Create: `src/features/report/ExperimentReport.test.tsx`
- Modify: `src/features/experiment/labStore.ts`
- Modify: `src/features/tutorial/tutorialProgress.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `TelemetryFrame`, lab control actions, tutorial evidence, and the fixed 30/60/90 power sequence.
- Produces: `SweepState`, `advanceSweep`, `summarizeRun`, `serializeExperimentCsv`, `downloadExperimentCsv`, and `<ExperimentReport />`.

- [ ] **Step 1: Write failing sweep, summary, and escaping tests**

```ts
// sweepRunner.test.ts
import { advanceSweep, createSweepState } from "./sweepRunner";
import type { TelemetryFrame } from "../experiment/model";

const stableFrame = (power: number): TelemetryFrame => ({
  sequence: power, simulationTimeMs: power * 100, phase: "stabilizing", fanPowerPct: power,
  rpm: power * 62, windSpeedMps: power * 0.12, underbodyPressurePa: -power,
  verticalLoadN: power / 100, quality: "stable", provenance: "simulated",
});

it("runs 30, 60, and 90 percent in order", () => {
  let state = createSweepState();
  for (const power of [30, 60, 90]) {
    for (let elapsed = 0; elapsed < 6500; elapsed += 50) {
      state = advanceSweep(state, stableFrame(power), 50).state;
    }
  }
  expect(state.completedPowers).toEqual([30, 60, 90]);
  expect(state.status).toBe("completed");
});
```

```ts
// experimentSummary.test.ts
import { summarizeRun } from "./experimentSummary";

it("uses only stable samples for run means", () => {
  const summary = summarizeRun([
    { simulationTimeMs: 0, quality: "transient", windSpeedMps: 99, rpm: 99, underbodyPressurePa: 99, verticalLoadN: 99 },
    { simulationTimeMs: 50, quality: "stable", windSpeedMps: 4, rpm: 2000, underbodyPressurePa: -10, verticalLoadN: 0.2 },
    { simulationTimeMs: 100, quality: "stable", windSpeedMps: 6, rpm: 3000, underbodyPressurePa: -20, verticalLoadN: 0.4 },
  ]);
  expect(summary.meanWindSpeedMps).toBe(5);
  expect(summary.meanVerticalLoadN).toBeCloseTo(0.3, 8);
});
```

```ts
// csv.test.ts
import { serializeExperimentCsv } from "./csv";

it("writes provenance, units, and safely quoted conclusions", () => {
  const csv = serializeExperimentCsv({ metadata: { conclusion: "速度越高, 载荷越大", provenance: "simulated" }, samples: [] });
  expect(csv).toContain("provenance,simulated");
  expect(csv).toContain('conclusion,"速度越高, 载荷越大"');
  expect(csv).toContain("windSpeedMps");
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/sweep src/features/report`

Expected: FAIL because sweep and report modules do not exist.

- [ ] **Step 3: Implement deterministic sweep phases**

```ts
export type SweepState = {
  status: "idle" | "ramping" | "stabilizing" | "sampling" | "completed" | "failed";
  conditionIndex: number;
  commandedPowerPct: 30 | 60 | 90;
  stableMs: number;
  samplingMs: number;
  conditionElapsedMs: number;
  completedPowers: number[];
  samplesByPower: Record<number, TelemetryFrame[]>;
  error: string | null;
};
```

Rules per condition:

1. Start at the exact commanded power.
2. Ignore frames whose `fanPowerPct` does not equal the current commanded power; this prevents a prior condition's trailing frame from advancing the next condition.
3. Accumulate `stableMs` only for consecutive `quality === "stable"` frames; reset it on a transient frame.
4. Enter sampling after 2,000 stable milliseconds.
5. Collect 4,000 milliseconds of samples.
6. Advance 30 → 60 → 90, then mark completed.
7. Fail a condition after 15,000 milliseconds without reaching stability; expose a retry that restarts only the failed condition.

The returned value from `advanceSweep` includes `commandPowerPct` whenever the lab store needs a new command. Integrate this runner without using wall-clock dates; advance only by simulation `dtMs`.

- [ ] **Step 4: Implement summaries, comparison, and CSV**

`summarizeRun` filters stable samples and returns means for RPM, wind, pressure, and load; standard deviation for wind and load; minimum/maximum timestamps; sample count; and `valid: false` when fewer than 20 stable samples exist.

`serializeExperimentCsv` begins with metadata rows for title, generated time, provenance, solver (`D2Q9 BGK teaching solver`), grid size, conclusion, and disclaimer. It then emits columns:

```text
sequence,simulationTimeMs,phase,fanPowerPct,rpm,windSpeedMps,underbodyPressurePa,verticalLoadN,quality,provenance
```

Escape double quotes by doubling them and quote any cell containing a comma, quote, or newline. Prefix the result with UTF-8 BOM for spreadsheet compatibility. `downloadExperimentCsv` revokes the object URL after the anchor click.

`summarizeRun` accepts `Array<Pick<TelemetryFrame, "quality" | "windSpeedMps" | "rpm" | "underbodyPressurePa" | "verticalLoadN" | "simulationTimeMs">>` so the focused statistics test and production frames use the same named fields.

`ExperimentReport` shows three condition cards and the dimensionless `Cp_CFD ↔ Cp_sensor` comparison defined in the final-review amendment. It displays the formula, units, normalization, per-condition solver configuration/ranges, a largest-residual selector, a required bias-reason textarea, a conclusion textarea with the 12-character requirement, a print button calling `window.print()`, and a CSV export button. CSV freezes telemetry, raw CFD proxy numerators/denominators, per-sample runtime identities, summary residuals, selected/computed largest powers, reason, formula, seed, and actual/mixed runtime metadata. It always includes the teaching disclaimer. Wrap export in `try/catch`; on failure keep every sample in the store, show `导出失败，实验数据仍保留`, and expose a `重试导出` button that repeats serialization from the same immutable snapshot.

- [ ] **Step 5: Verify report UI and full unit suite**

Run: `npm run test:run -- src/features/sweep src/features/report src/features/tutorial`

Expected: sweep, summary, CSV, report, and updated tutorial tests PASS.

Run: `npm run test:run`

Expected: all tests PASS.

- [ ] **Step 6: Commit if repository integrity permits**

```bash
git add src/features/sweep src/features/report src/features/experiment/labStore.ts src/features/tutorial/tutorialProgress.ts src/App.tsx
git commit -m "feat: add automated CFD teaching report"
```

---

### Task 10: Resilience, Adaptive Quality, Responsive Layout, and Accessibility

**Files:**
- Create: `src/features/shell/ErrorBoundary.tsx`
- Create: `src/features/shell/ErrorBoundary.test.tsx`
- Create: `src/features/shell/quality.ts`
- Create: `src/features/shell/quality.test.ts`
- Modify: `src/features/scene/WindTunnelScene.tsx`
- Modify: `src/features/scene/SceneFallback.tsx`
- Modify: `src/features/dashboard/ControlPanel.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: flow failure/restart state, reduced-motion media query, viewport width, and browser hardware concurrency.
- Produces: `QualityProfile`, `selectQualityProfile`, `AdaptiveQualityController`, `<ErrorBoundary />`, flow/context-restart banners, narrow-screen tab layout, and keyboard-visible focus behavior.

- [ ] **Step 1: Write failing quality and error recovery tests**

```ts
// quality.test.ts
import { AdaptiveQualityController, selectQualityProfile } from "./quality";

it("disables particles for reduced motion", () => {
  expect(selectQualityProfile({ viewportWidth: 1440, hardwareConcurrency: 12, reducedMotion: true }))
    .toMatchObject({ name: "reduced", grid: [160, 64], particleCount: 0 });
});

it("uses the low profile on a narrow four-core device", () => {
  expect(selectQualityProfile({ viewportWidth: 390, hardwareConcurrency: 4, reducedMotion: false }))
    .toMatchObject({ name: "low", grid: [160, 64], particleCount: 300 });
});

it("degrades one level after three seconds of sustained slow frames", () => {
  const changes: string[] = [];
  const controller = new AdaptiveQualityController("high", (profile) => changes.push(profile.name));
  for (let elapsed = 0; elapsed < 3100; elapsed += 50) controller.recordFrame(50);
  expect(changes).toEqual(["medium"]);
});
```

```tsx
// ErrorBoundary.test.tsx
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken() { throw new Error("render failed"); }

it("offers a recoverable application fallback", () => {
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole("alert")).toHaveTextContent("界面渲染失败");
  expect(screen.getByRole("button", { name: "重新加载实验台" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/shell/quality.test.ts src/features/shell/ErrorBoundary.test.tsx`

Expected: FAIL because quality selection and error boundary do not exist.

- [ ] **Step 3: Implement exact quality profiles and recovery paths**

```ts
export type QualityProfile = {
  name: "reduced" | "low" | "medium" | "high";
  grid: readonly [number, number];
  particleCount: number;
  chartRefreshHz: number;
};
```

Selection rules:

- reduced motion: 160 × 64, 0 particles, 5 Hz charts;
- width under 600 or hardware concurrency at most 4: 160 × 64, 300 particles, 5 Hz charts;
- width at least 1200 and hardware concurrency at least 8: 320 × 128, 1,400 particles, 10 Hz charts;
- otherwise: 240 × 96, 900 particles, 10 Hz charts.

`AdaptiveQualityController` keeps frame durations in refs/non-React state. If the rolling three-second average remains above 41.7 ms (below 24 FPS), degrade exactly one level `high → medium → low`; clear the rolling window after a change and never auto-upgrade during an experiment. `WindTunnelScene` reports only the resulting low-frequency profile-change event. `App` then rebuilds the worker using the new grid while preserving telemetry, tutorial evidence, and the last displayed field until the replacement sends `ready`. Display the active quality name and grid in the solver status row.

Wrap the whole app in `ErrorBoundary`. Display a non-modal alert when `flowStatus === "failed"`; keep telemetry running, keep the last field visible, and wire `重新启动求解器` to the Task 6 runtime restart callback. `SceneFallback` includes an inline SVG with role `img`, five labeled modules, and the same teaching disclaimer.

Register `webglcontextlost` and `webglcontextrestored` on the R3F canvas. On loss, call `preventDefault()`, pause scene/flow updates, keep telemetry active, and show `三维上下文已丢失`. On restoration, remount the scene with a new key and restart the flow runtime; if restoration does not arrive, retain the static SVG fallback and all text controls.

- [ ] **Step 4: Implement responsive and keyboard behavior**

At widths below 1,100 px, use scene on row one and a three-tab panel (`教程`, `控制`, `曲线`) on row two. At widths below 600 px, use a 52 px topbar, 48 vh scene, and one-column cards. No region may exceed viewport width.

Add visible `:focus-visible` outlines using `--flow`, minimum 44 × 44 px primary targets, semantic headings, and `aria-live="polite"` only for phase/fault changes. The high-frequency telemetry numbers must not be live regions. Ensure every canvas function has a keyboard-accessible DOM control.

- [ ] **Step 5: Verify resilience, responsive CSS, and build**

Run: `npm run test:run -- src/features/shell src/features/scene src/features/dashboard`

Expected: resilience and prior feature tests PASS.

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 6: Commit if repository integrity permits**

```bash
git add src/features/shell src/features/scene/WindTunnelScene.tsx src/features/scene/SceneFallback.tsx src/features/dashboard/ControlPanel.tsx src/styles/global.css src/App.tsx
git commit -m "feat: harden responsive CFD lab experience"
```

---

### Task 11: Browser Integration, Guided-Flow Contract, and Final Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/tutorial.spec.ts`
- Create: `e2e/free-lab.spec.ts`
- Create: `e2e/responsive.spec.ts`
- Create: `src/App.integration.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: every production interface from Tasks 1–10.
- Produces: one running application lifecycle, accelerated E2E-only simulation time, three browser contracts, and final verification evidence.

- [ ] **Step 1: Write the failing application integration test**

```tsx
// App.integration.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

it("starts a virtual run and keeps provenance visible", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "启动实验" }));
  expect(screen.getByText(/升速中/)).toBeInTheDocument();
  expect(screen.getAllByText(/SIMULATED/).length).toBeGreaterThanOrEqual(4);
  expect(screen.getByText(/二维教学近似/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the integration test and verify red**

Run: `npm run test:run -- src/App.integration.test.tsx`

Expected: FAIL until `App` composes the store, simulation runtime, flow runtime, tutorial evidence, sweep, scene, dashboard, and report.

- [ ] **Step 3: Compose runtime ownership and cleanup**

`App` starts exactly one `SimulationSource`, simulation runtime, and `LbmWorkerClient` per mount. All intervals, worker promises, object URLs, Three.js textures, and workers are disposed on unmount. Add an E2E-only time scale:

```ts
const stepsPerTick = import.meta.env.VITE_E2E_TIME_SCALE === "20" ? 20 : 1;
```

Pass `stepsPerTick` to Task 3's fixed-step runtime. E2E therefore executes 20 ordinary 50 ms simulation steps per 50 ms wall-clock tick; it does not alter formulas, coefficients, displayed units, or the LBM mapping. Sweep and tutorial durations advance from the emitted simulation frames, so they accelerate consistently. Production and development default to 1.

Run: `npm run test:run -- src/App.integration.test.tsx`

Expected: PASS.

- [ ] **Step 4: Configure Playwright and write the guided tutorial contract**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    env: { VITE_E2E_TIME_SCALE: "20" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

`tutorial.spec.ts` performs real UI actions in order:

1. Verify the simulated and 2D-teaching labels.
2. Click all five module hotspot buttons and advance.
3. Set power to 30, start, wait for stable completion, and advance.
4. Inspect the four telemetry cards and advance.
5. Select speed, pressure, vorticity, streamlines; answer the flow question; advance.
6. Start the automatic 30/60/90 sweep and wait for all three condition cards.
7. Select the largest residual and enter a conclusion longer than 12 characters.
8. Verify the report disclaimer and intercept the CSV download; assert the filename ends with `.csv`.

`free-lab.spec.ts` verifies start, pause, resume, field switch, and reset. It also asserts no `pageerror` events and no unexpected console errors.

`responsive.spec.ts` checks 1440 × 900, 1024 × 768, and 390 × 844. At each size, evaluate `document.documentElement.scrollWidth <= window.innerWidth`, verify controls remain reachable, and capture a screenshot into Playwright's test artifacts.

- [ ] **Step 5: Run browser tests and inspect failures before changing production code**

Run: `npx playwright install chromium`

Expected: Chromium is present for Playwright.

Run: `npm run test:e2e`

Expected: tutorial, free-lab, and responsive projects PASS with 0 failed tests.

If a browser test exposes a product defect, add the smallest failing unit/component test that reproduces it before changing production code, then rerun both that test and the browser test.

- [ ] **Step 6: Run the complete verification matrix**

Run each command fresh and retain the full output:

```bash
npm run lint
npm run test:run
npm run build
npm run test:e2e
git diff --check -- .
```

Expected:

- lint exits 0 with no errors;
- Vitest reports 0 failed tests;
- TypeScript and Vite build exit 0;
- Playwright reports 0 failed tests;
- `git diff --check` prints nothing and exits 0.

Open the application at 1440 × 900 and manually verify the accepted design against the spec: modular off-white/charcoal/red tunnel, central transparent chamber, cyan flow, tutorial rail, right controls, bottom chart drawer, simulated labels, teaching-CFD labels, all seven chapters, and printable report. Record any intentional deviation in the final handoff.

- [ ] **Step 7: Stage exact project files and commit if repository integrity permits**

```bash
git add index.html package.json package-lock.json tsconfig.json vite.config.ts eslint.config.js playwright.config.ts src e2e docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md docs/superpowers/plans/2026-08-18-digital-wind-tunnel-web.md
git commit -m "feat: build digital wind tunnel teaching lab"
```

Do not use `git add -A`. If the known missing blob blocks the commit, report the exact failure and leave unrelated parent-repository staged changes untouched.

## Plan Completion Criteria

The plan is complete only when the five fresh verification commands in Task 11 Step 6 pass, the guided browser flow reaches the report, all three target viewports have no horizontal overflow, and the final handoff states whether any material mismatch remains between the implementation and the approved design.
