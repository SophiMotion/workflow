import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelemetryFrame } from "../experiment/model";
import type { CfdSensorProxySample } from "../flow/cfdSensorProxy";
import { advanceSweep, createSweepState, retryFailedCondition } from "./sweepRunner";

const frame = (
  power: number,
  quality: TelemetryFrame["quality"] = "stable",
  sequence = power,
): TelemetryFrame => ({
  sequence,
  simulationTimeMs: sequence * 50,
  phase: quality === "stable" ? "stabilizing" : "ramping",
  fanPowerPct: power,
  rpm: power * 62,
  windSpeedMps: power * 0.12,
  underbodyPressurePa: -power,
  verticalLoadN: power / 100,
  quality,
  provenance: "simulated",
});

function advanceFor(state: ReturnType<typeof createSweepState>, power: number, milliseconds: number) {
  let next = state;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) {
    next = advanceSweep(
      next,
      frame(power, "stable", elapsed / 50),
      50,
      proxySample(power, power * 1_000 + elapsed / 50 + 1),
    ).state;
  }
  return next;
}

const proxySample = (power: number, flowFrameId: number): CfdSensorProxySample => ({
  flowFrameId,
  simulationTimeMs: flowFrameId * 100,
  fanPowerPct: power,
  cfdPressureDeltaLu: -0.001,
  latticeDynamicPressure: 0.001,
  sensorPressurePa: -10,
  physicalDynamicPressurePa: 10,
  runtimeConfiguration: {
    generation: 1,
    gridWidth: 160,
    gridHeight: 64,
    tau: 0.62,
    requestedInletVelocity: 0.04,
    actualInletVelocity: 0.04,
    velocityScale: 1,
    recovery: "none",
    rebuildReason: "initial",
  },
});

describe("three-condition sweep reducer", () => {
  afterEach(() => vi.useRealTimers());

  it("runs exactly 30, 60, and 90 percent in order", () => {
    let state = createSweepState();
    for (const power of [30, 60, 90]) {
      state = advanceFor(state, power, 6_500);
    }

    expect(state.completedPowers).toEqual([30, 60, 90]);
    expect(state.status).toBe("completed");
    expect(Object.keys(state.samplesByPower).map(Number)).toEqual([30, 60, 90]);
  });

  it("requires 2,000 consecutive stable milliseconds then samples for 4,000 milliseconds", () => {
    let state = createSweepState();
    state = advanceFor(state, 30, 1_950);
    expect(state).toMatchObject({ status: "stabilizing", stableMs: 1_950, samplingMs: 0 });

    state = advanceSweep(state, frame(30, "transient"), 50).state;
    expect(state.stableMs).toBe(0);
    state = advanceFor(state, 30, 2_000);
    expect(state).toMatchObject({ status: "sampling", stableMs: 2_000, samplingMs: 0 });

    state = advanceFor(state, 30, 3_950);
    expect(state).toMatchObject({ status: "sampling", samplingMs: 3_950 });
    const transition = advanceSweep(state, frame(30), 50);
    expect(transition.state).toMatchObject({ status: "ramping", commandedPowerPct: 60 });
    expect(transition.commandPowerPct).toBe(60);
    expect(transition.state.samplesByPower[30]).toHaveLength(80);
  });

  it("clears a nearly complete sampling window after a transient or command mismatch", () => {
    let state = advanceFor(createSweepState(), 30, 2_000);
    state = advanceFor(state, 30, 3_950);
    state = advanceSweep(state, frame(30, "transient"), 50).state;
    expect(state).toMatchObject({ status: "stabilizing", stableMs: 0, samplingMs: 0 });
    expect(state.samplesByPower[30]).toEqual([]);

    state = advanceFor(state, 30, 2_000);
    state = advanceFor(state, 30, 3_950);
    state = advanceSweep(state, frame(31, "stable"), 50).state;
    expect(state).toMatchObject({ status: "stabilizing", stableMs: 0, samplingMs: 0 });
    expect(state.samplesByPower[30]).toEqual([]);
  });

  it("does not finish a condition until five fresh solver samples exist", () => {
    let state = advanceFor(createSweepState(), 30, 2_000);
    for (let index = 0; index < 80; index += 1) {
      const sample = index < 4 ? proxySample(30, index + 1) : null;
      state = advanceSweep(state, frame(30, "stable", index), 50, sample).state;
    }
    expect(state).toMatchObject({ status: "sampling", samplingMs: 4_000 });
    expect(state.proxySamplesByPower[30]).toHaveLength(4);

    state = advanceSweep(state, frame(30, "stable", 81), 50, proxySample(30, 5)).state;
    expect(state).toMatchObject({ status: "ramping", commandedPowerPct: 60 });
  });

  it("gives real CFD frames a sampling-local timeout after a slow ramp", () => {
    const initial = createSweepState();
    const state = {
      ...initial,
      status: "sampling" as const,
      stableMs: 2_000,
      samplingMs: 3_950,
      conditionElapsedMs: 14_990,
      proxySamplesByPower: {
        30: [1, 2, 3, 4].map((flowFrameId) => proxySample(30, flowFrameId)),
      },
      lastCapturedFlowFrameId: 4,
    };

    const next = advanceSweep(state, frame(30), 50).state;

    expect(next).toMatchObject({ status: "sampling", samplingMs: 4_000 });
    expect(next.error).toBeNull();
  });

  it("ignores a prior condition trailing frame completely", () => {
    const state = advanceFor(createSweepState(), 30, 6_000);
    expect(state.commandedPowerPct).toBe(60);
    const unchanged = advanceSweep(state, frame(30), 2_000);

    expect(unchanged.state).toBe(state);
    expect(unchanged.commandPowerPct).toBeUndefined();
    expect(state.conditionElapsedMs).toBe(0);
  });

  it("fails at 15,000 simulation milliseconds and retries only that condition", () => {
    let state = advanceFor(createSweepState(), 30, 6_000);
    const firstSamples = state.samplesByPower[30];
    for (let elapsed = 0; elapsed < 15_000; elapsed += 50) {
      state = advanceSweep(state, frame(60, "transient", elapsed / 50), 50).state;
    }

    expect(state).toMatchObject({ status: "failed", commandedPowerPct: 60, conditionElapsedMs: 15_000 });
    expect(state.error).toContain("60%");
    const retry = retryFailedCondition(state);
    expect(retry).toMatchObject({
      status: "ramping",
      commandedPowerPct: 60,
      stableMs: 0,
      samplingMs: 0,
      conditionElapsedMs: 0,
      completedPowers: [30],
    });
    expect(retry.samplesByPower[30]).toBe(firstSamples);
  });

  it("is deterministic under fake system-time changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2031-01-01T00:00:00Z");
    const first = advanceFor(createSweepState(), 30, 2_000);
    vi.setSystemTime("2099-12-31T23:59:59Z");
    const second = advanceFor(createSweepState(), 30, 2_000);

    expect(second).toEqual(first);
  });

  it.each([
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["negative rollback", -50],
    ["single-frame jump", 6_000],
  ])("fails retryably without polluting timers for %s dt", (_label, dtMs) => {
    const initial = createSweepState();
    const failed = advanceSweep(initial, frame(30), dtMs).state;

    expect(failed).toMatchObject({
      status: "failed",
      stableMs: 0,
      samplingMs: 0,
      conditionElapsedMs: 0,
    });
    expect(failed.error).toContain("无效仿真时间步");
    expect(Number.isFinite(failed.stableMs)).toBe(true);
    expect(retryFailedCondition(failed)).toMatchObject({ status: "ramping", error: null });
  });
});
