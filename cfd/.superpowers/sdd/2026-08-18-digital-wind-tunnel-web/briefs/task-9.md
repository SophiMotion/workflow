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

`ExperimentReport` shows three condition cards, an observed `v²` trend statement, a selectable residual comparison, a conclusion textarea with the 12-character requirement, a print button calling `window.print()`, and a CSV export button. It always includes the teaching disclaimer. Wrap export in `try/catch`; on failure keep every sample in the store, show `导出失败，实验数据仍保留`, and expose a `重试导出` button that repeats serialization from the same immutable snapshot.

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

