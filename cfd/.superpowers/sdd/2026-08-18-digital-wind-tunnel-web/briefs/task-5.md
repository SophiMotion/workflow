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

