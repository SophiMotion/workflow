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

