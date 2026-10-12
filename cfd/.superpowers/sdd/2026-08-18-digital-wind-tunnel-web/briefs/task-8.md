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

Below the selector, display a solver status row containing `D2Q9 BGK`, the active grid (for example `240 × 96`), the mapped lattice inlet velocity, flow status, and `二维教学近似`. This status is read-only and never presents Cd/Cl values.

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

