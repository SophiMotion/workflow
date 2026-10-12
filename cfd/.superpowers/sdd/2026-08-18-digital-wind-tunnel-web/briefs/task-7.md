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

