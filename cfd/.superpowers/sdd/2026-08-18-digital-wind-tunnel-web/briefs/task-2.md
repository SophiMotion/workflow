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

