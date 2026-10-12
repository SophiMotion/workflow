# Task 3 Review — Zustand Lab Store and Fixed-Step Runtime

## Spec Compliance

- `labStore` uses Zustand vanilla `createStore`; `useLabStore(selector)` delegates to the same store for React consumers (`src/features/experiment/labStore.ts:1-2`, `src/features/experiment/labStore.ts:28`, `src/features/experiment/labStore.ts:55-57`).
- `MAX_HISTORY` is 1200, and `acceptFrame` uses one `slice(-MAX_HISTORY + 1)` followed by append (`src/features/experiment/labStore.ts:7`, `src/features/experiment/labStore.ts:35-38`).
- The runtime calls `setFanPower`, `setPhase`, and then `step(50)` for every fixed step (`src/features/experiment/simulationRuntime.ts:4`, `src/features/experiment/simulationRuntime.ts:18-24`). `stepsPerTick` defaults to one and repeats that fixed step (`src/features/experiment/simulationRuntime.ts:12-17`).
- Idle, paused, and completed phases cannot step (`src/features/experiment/simulationRuntime.ts:19-21`, `src/features/experiment/simulationRuntime.ts:55-57`).
- `visibilitychange` clears the interval while hidden and schedules a fresh interval on return, without elapsed-time replay (`src/features/experiment/simulationRuntime.ts:27-45`). The returned cleanup removes both timer and listener (`src/features/experiment/simulationRuntime.ts:49-52`).
- Independently verified: `npm run test:run -- src/features/experiment` passed (5 files, 15 tests); `npm run build` and `npm run lint` passed.

## Strengths

- The state-machine actions delegate to Task 2's reducer rather than duplicating transition rules (`src/features/experiment/labStore.ts:39-42`).
- The runtime rereads store state inside each repeated fixed step, so control values are synchronized per step, not merely once per interval (`src/features/experiment/simulationRuntime.ts:18-24`).
- Tests cover bounded history, clamping, per-step ordering, inactive phases, stop behavior, and visibility recovery (`src/features/experiment/labStore.test.ts:9-32`, `src/features/experiment/simulationRuntime.test.ts:46-106`).

## Issues

### Critical

None.

### Important

None.

### Minor

- Test cleanup is not failure-safe. `afterEach` only restores fake timers (`src/features/experiment/simulationRuntime.test.ts:41-43`), while every runtime is stopped manually after assertions (for example, `src/features/experiment/simulationRuntime.test.ts:67-74` and `src/features/experiment/simulationRuntime.test.ts:102-105`). If an assertion fails before `stop()`, its interval and `visibilitychange` listener remain registered; the final visibility test can also leave its `document.hidden` getter spy unrecovered (`src/features/experiment/simulationRuntime.test.ts:101-106`). Keep the current stop callbacks in an `afterEach` cleanup (and use `try/finally` or `afterEach` for the getter restore) to prevent failure-path timer/DOM-listener pollution across tests.

## Assessment

Approved with one minor test-isolation follow-up. The production implementation satisfies the binding requirements, including bounded history, fixed 50 ms stepping, per-step source synchronization, active-phase gating, visibility scheduling, and explicit runtime cleanup. The report's functional claims are supported by both code inspection and the verification commands above; the only qualification is the tests' cleanup behavior when an assertion itself fails.
