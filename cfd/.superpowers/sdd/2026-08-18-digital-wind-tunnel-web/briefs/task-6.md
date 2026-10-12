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

