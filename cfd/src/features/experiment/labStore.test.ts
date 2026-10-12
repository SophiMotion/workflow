import { beforeEach, describe, expect, it } from "vitest";
import type { FlowFieldFrame, FlowRuntimeMetadata } from "../flow/types";
import { labStore, MAX_HISTORY } from "./labStore";

function proxyField(): FlowFieldFrame {
  const width = 20;
  const height = 20;
  const pressure = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const v = (y + 0.5) / height;
      if (v >= 0.70 && v < 0.85 && u >= 0.15 && u < 0.30) pressure[y * width + x] = 0.02;
      if (v >= 0.70 && v < 0.85 && u >= 0.40 && u < 0.65) pressure[y * width + x] = -0.01;
    }
  }
  return {
    width,
    height,
    pressure,
    speed: new Float32Array(width * height),
    vorticity: new Float32Array(width * height),
    velocityX: new Float32Array(width * height),
    velocityY: new Float32Array(width * height),
    provenance: "2d-teaching-cfd",
  };
}

function acceptProxyField(
  sourceFanPowerPct: number,
  sourceSweepRunRevision = labStore.getState().sweepRunRevision,
  sourceSweepConditionIndex = labStore.getState().sweep?.conditionIndex ?? null,
) {
  const metadata: Omit<FlowRuntimeMetadata, "acceptedFrameId"> = {
    generation: 1,
    gridWidth: 20,
    gridHeight: 20,
    tau: 0.62,
    requestedInletVelocity: 0.04,
    actualInletVelocity: 0.04,
    velocityScale: 1,
    recovery: "none",
    rebuildReason: "initial",
    sourceTelemetrySequence: labStore.getState().telemetry.sequence,
    sourceFanPowerPct,
    sourceSweepRunRevision,
    sourceSweepConditionIndex,
    provenance: "2d-teaching-cfd",
  };
  labStore.getState().acceptFlowFrame(proxyField(), metadata);
}

describe("labStore", () => {
  beforeEach(() => {
    labStore.getState().resetLab();
  });

  it("keeps at most sixty seconds of 20 Hz telemetry", () => {
    const frame = labStore.getState().telemetry;
    for (let index = 0; index < MAX_HISTORY + 25; index += 1) {
      labStore.getState().acceptFrame({ ...frame, sequence: index });
    }

    expect(labStore.getState().history).toHaveLength(MAX_HISTORY);
    expect(labStore.getState().history[0]!.sequence).toBe(25);
  });

  it("clamps fan commands and exposes typed control actions", () => {
    labStore.getState().setFanPower(140);
    expect(labStore.getState().fanPowerPct).toBe(100);
    labStore.getState().setFanPower(-4);
    expect(labStore.getState().fanPowerPct).toBe(0);
  });

  it("drives phase transitions through the experiment reducer", () => {
    labStore.getState().startRun();
    labStore.getState().pauseRun();
    expect(labStore.getState()).toMatchObject({ phase: "paused", resumePhase: "ramping" });
    labStore.getState().resumeRun();
    labStore.getState().advancePhase();
    expect(labStore.getState().phase).toBe("stabilizing");
  });

  it("starts a new manual evidence revision only when pause enters the paused phase", () => {
    labStore.getState().startRun();
    const activeRevision = labStore.getState().manualRunRevision;

    labStore.getState().pauseRun();

    expect(labStore.getState()).toMatchObject({
      phase: "paused",
      resumePhase: "ramping",
      manualRunRevision: activeRevision + 1,
    });

    labStore.getState().pauseRun();
    labStore.getState().resumeRun();
    expect(labStore.getState().manualRunRevision).toBe(activeRevision + 1);
  });

  it("retargets active and paused manual runs when the fan command changes", () => {
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    labStore.getState().advancePhase();
    const activeRevision = labStore.getState().manualRunRevision;

    labStore.getState().setFanPower(31);
    expect(labStore.getState()).toMatchObject({
      phase: "ramping",
      fanPowerPct: 31,
      manualRunRevision: activeRevision + 1,
    });

    labStore.getState().advancePhase();
    labStore.getState().pauseRun();
    const pausedRevision = labStore.getState().manualRunRevision;
    labStore.getState().setFanPower(32);
    expect(labStore.getState()).toMatchObject({
      phase: "paused",
      resumePhase: "ramping",
      fanPowerPct: 32,
      manualRunRevision: pausedRevision + 1,
    });
    labStore.getState().resumeRun();
    expect(labStore.getState().phase).toBe("ramping");
  });

  it("changes the manual-run revision for frame-between commands, reset, and a new run", () => {
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    const started = labStore.getState().manualRunRevision;
    labStore.getState().setFanPower(31);
    labStore.getState().setFanPower(30);
    expect(labStore.getState().manualRunRevision).toBe(started + 2);

    labStore.getState().resetLab();
    const reset = labStore.getState().manualRunRevision;
    expect(reset).toBe(started + 3);
    labStore.getState().startRun();
    expect(labStore.getState().manualRunRevision).toBe(reset + 1);
  });

  it("starts, cancels, and reruns a sweep without using wall-clock time", () => {
    labStore.getState().acceptFrame({ ...labStore.getState().telemetry, sequence: 1 });
    labStore.getState().startSweep();
    expect(labStore.getState()).toMatchObject({ fanPowerPct: 30, phase: "ramping" });
    expect(labStore.getState().sweep?.commandedPowerPct).toBe(30);

    labStore.getState().cancelSweep();
    expect(labStore.getState()).toMatchObject({ fanPowerPct: 0, phase: "idle", history: [{ sequence: 1 }] });
    expect(labStore.getState().sweep).toMatchObject({ status: "idle", completedPowers: [] });

    labStore.getState().startRun();
    labStore.getState().acceptFrame({
      ...labStore.getState().telemetry,
      sequence: 2,
      simulationTimeMs: labStore.getState().telemetry.simulationTimeMs + 50,
      phase: "ramping",
    });
    expect(labStore.getState().phase).toBe("ramping");
    labStore.getState().resetLab();

    labStore.getState().startSweep();
    expect(labStore.getState().sweep?.completedPowers).toEqual([]);
    labStore.getState().resetLab();
    expect(labStore.getState()).toMatchObject({ sweep: null, history: [] });
  });

  it("keeps the exact store state while an active sweep owns every run action", () => {
    const actions = ["startRun", "pauseRun", "resumeRun", "advancePhase", "startSweep"] as const;

    for (const action of actions) {
      labStore.getState().resetLab();
      labStore.getState().startSweep();
      const owned = labStore.getState();
      labStore.getState()[action]();
      expect(labStore.getState(), action).toBe(owned);
    }
  });

  it.each(["idle", "failed", "completed"] as const)("unlocks sweep restart from %s", (status) => {
    labStore.getState().startSweep();
    const previousSweep = labStore.getState().sweep!;
    labStore.setState({ sweep: { ...previousSweep, status }, phase: status === "idle" ? "idle" : "completed" });

    labStore.getState().startSweep();

    expect(labStore.getState().sweep).not.toBe(previousSweep);
    expect(labStore.getState()).toMatchObject({ phase: "ramping", fanPowerPct: 30 });
  });

  it("unlocks manual run actions after cancel and reset", () => {
    labStore.getState().startSweep();
    labStore.getState().cancelSweep();
    labStore.getState().startRun();
    expect(labStore.getState().phase).toBe("ramping");

    labStore.getState().resetLab();
    labStore.getState().startRun();
    expect(labStore.getState().phase).toBe("ramping");
  });

  it.each([
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["rollback", 50],
    ["single-frame jump", 10_000],
  ])("rejects %s simulation timestamps without accepting the bad frame", (_label, simulationTimeMs) => {
    const baseline = { ...labStore.getState().telemetry, simulationTimeMs: 100 };
    labStore.setState({ telemetry: baseline, history: [] });
    labStore.getState().startSweep();

    labStore.getState().acceptFrame({
      ...baseline,
      sequence: 2,
      simulationTimeMs,
      fanPowerPct: 30,
      quality: "stable",
    });

    expect(labStore.getState().telemetry).toBe(baseline);
    expect(labStore.getState().history).toEqual([]);
    expect(labStore.getState().sweep).toMatchObject({
      status: "failed",
      stableMs: 0,
      samplingMs: 0,
      conditionElapsedMs: 0,
    });

    labStore.getState().retrySweep();
    labStore.getState().acceptFrame({
      ...baseline,
      sequence: 3,
      simulationTimeMs: 150,
      fanPowerPct: 30,
      quality: "stable",
    });
    expect(labStore.getState().sweep).toMatchObject({ status: "stabilizing", conditionElapsedMs: 50 });
  });

  it("ignores an invalid-time trailing frame without poisoning the next commanded frame", () => {
    const baseline = { ...labStore.getState().telemetry, simulationTimeMs: 100 };
    labStore.setState({ telemetry: baseline, history: [] });
    labStore.getState().startSweep();
    const owned = labStore.getState();

    labStore.getState().acceptFrame({ ...baseline, simulationTimeMs: Number.NaN, fanPowerPct: 0 });
    expect(labStore.getState()).toBe(owned);

    labStore.getState().acceptFrame({ ...baseline, simulationTimeMs: 150, fanPowerPct: 30, quality: "stable" });
    expect(labStore.getState().sweep).toMatchObject({ status: "stabilizing", conditionElapsedMs: 50 });
  });

  it("pairs the accepted CFD field immediately with its exact request telemetry frame", () => {
    acceptProxyField(30);
    const staleFrameId = labStore.getState().flowMetadata!.acceptedFrameId;
    labStore.getState().startSweep();
    let simulationTimeMs = 0;
    for (let index = 0; index < 40; index += 1) {
      simulationTimeMs += 50;
      labStore.getState().acceptFrame({
        ...labStore.getState().telemetry,
        sequence: index + 1,
        simulationTimeMs,
        phase: "stabilizing",
        fanPowerPct: 30,
        windSpeedMps: 6,
        underbodyPressurePa: -10,
        quality: "stable",
      });
    }
    expect(labStore.getState().sweep?.status).toBe("sampling");
    expect(labStore.getState().sweep?.proxySamplesByPower?.[30]).toBeUndefined();
    expect(labStore.getState().sweep?.lastCapturedFlowFrameId).toBe(staleFrameId);

    simulationTimeMs += 50;
    const requestTelemetry = {
      ...labStore.getState().telemetry,
      sequence: 41,
      simulationTimeMs,
      phase: "sampling",
      fanPowerPct: 30,
      windSpeedMps: 6,
      underbodyPressurePa: -10,
      quality: "stable",
    } as const;
    labStore.getState().acceptFrame(requestTelemetry);
    acceptProxyField(30);
    expect(labStore.getState().sweep?.proxySamplesByPower?.[30]).toHaveLength(1);
    expect(labStore.getState().sweep?.proxySamplesByPower?.[30]?.[0]?.sensorPressurePa).toBe(-10);

    simulationTimeMs += 50;
    labStore.getState().acceptFrame({
      ...labStore.getState().telemetry,
      sequence: 42,
      simulationTimeMs,
      underbodyPressurePa: -999,
    });
    expect(labStore.getState().sweep?.proxySamplesByPower?.[30]).toHaveLength(1);

    acceptProxyField(60);
    simulationTimeMs += 50;
    labStore.getState().acceptFrame({
      ...labStore.getState().telemetry,
      sequence: 43,
      simulationTimeMs,
      phase: "sampling",
      fanPowerPct: 30,
      quality: "stable",
    });
    expect(labStore.getState().sweep?.proxySamplesByPower?.[30]).toHaveLength(1);
  });

  it("rejects a delayed CFD response from a previous sweep run at the same power", () => {
    labStore.getState().startSweep();
    const previousRevision = labStore.getState().sweepRunRevision;
    labStore.getState().cancelSweep();
    labStore.getState().startSweep();
    const currentRevision = labStore.getState().sweepRunRevision;
    expect(currentRevision).not.toBe(previousRevision);

    const current = labStore.getState().sweep!;
    labStore.setState({
      phase: "sampling",
      telemetry: {
        ...labStore.getState().telemetry,
        sequence: 99,
        simulationTimeMs: 5_000,
        phase: "sampling",
        fanPowerPct: 30,
        windSpeedMps: 6,
        underbodyPressurePa: -12,
        quality: "stable",
      },
      sweep: { ...current, status: "sampling", stableMs: 2_000 },
    });

    acceptProxyField(30, previousRevision, 0);

    expect(labStore.getState().sweep?.proxySamplesByPower[30]).toBeUndefined();
  });
});
