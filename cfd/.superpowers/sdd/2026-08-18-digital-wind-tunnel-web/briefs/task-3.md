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

