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
