import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSimulationSource } from "./SimulationSource";
import { labStore } from "./labStore";
import type { RunPhase, TelemetryFrame, TelemetrySource } from "./model";
import { startSimulationRuntime } from "./simulationRuntime";

function createRecordingSource(): TelemetrySource & { calls: string[]; steps: number[] } {
  const calls: string[] = [];
  const steps: number[] = [];
  return {
    calls,
    steps,
    setFanPower(power) { calls.push(`power:${power}`); },
    setPhase(phase) { calls.push(`phase:${phase}`); },
    step(dtMs) {
      steps.push(dtMs);
      calls.push(`step:${dtMs}`);
      return {
        sequence: steps.length,
        simulationTimeMs: steps.length * dtMs,
        phase: "ramping",
        fanPowerPct: 0,
        rpm: 0,
        windSpeedMps: 0,
        underbodyPressurePa: 0,
        verticalLoadN: 0,
        quality: "transient",
        provenance: "simulated",
      };
    },
    reset() {
      return {} as TelemetryFrame;
    },
  };
}

function createPhaseAwareSource(): TelemetrySource & {
  steps: number[];
  setQuality(quality: TelemetryFrame["quality"]): void;
  setNextTimestamp(timestamp: number): void;
} {
  let phase: RunPhase = "idle";
  let fanPowerPct = 0;
  let sequence = 0;
  let simulationTimeMs = 0;
  let quality: TelemetryFrame["quality"] = "stable";
  let nextTimestamp: number | null = null;
  const steps: number[] = [];

  return {
    steps,
    setQuality(nextQuality) { quality = nextQuality; },
    setNextTimestamp(timestamp) { nextTimestamp = timestamp; },
    setFanPower(power) { fanPowerPct = power; },
    setPhase(nextPhase) { phase = nextPhase; },
    step(dtMs) {
      steps.push(dtMs);
      simulationTimeMs += dtMs;
      if (nextTimestamp !== null) {
        simulationTimeMs = nextTimestamp;
        nextTimestamp = null;
      }
      return {
        sequence: sequence++,
        simulationTimeMs,
        phase,
        fanPowerPct,
        rpm: 1_860,
        windSpeedMps: 3.6,
        underbodyPressurePa: -8,
        verticalLoadN: 0.1,
        quality,
        provenance: "simulated",
      };
    },
    reset() {
      phase = "idle";
      fanPowerPct = 0;
      sequence = 0;
      simulationTimeMs = 0;
      return {
        sequence: 0,
        simulationTimeMs: 0,
        phase: "idle",
        fanPowerPct: 0,
        rpm: 0,
        windSpeedMps: 0,
        underbodyPressurePa: 0,
        verticalLoadN: 0,
        quality: "transient",
        provenance: "simulated",
      };
    },
  };
}

describe("startSimulationRuntime", () => {
  const runtimeStops: Array<() => void> = [];

  const startTrackedRuntime = (options: Parameters<typeof startSimulationRuntime>[0]) => {
    const stop = startSimulationRuntime(options);
    runtimeStops.push(stop);
    return stop;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    labStore.getState().resetLab();
  });

  afterEach(() => {
    for (const stop of runtimeStops.splice(0).reverse()) stop();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("advances active experiments at a fixed 50 ms timestep and stops cleanly", () => {
    labStore.getState().startRun();
    const stop = startTrackedRuntime({ source: createDefaultSimulationSource(7), tickMs: 50 });
    vi.advanceTimersByTime(250);
    expect(labStore.getState().history).toHaveLength(5);
    stop();
    vi.advanceTimersByTime(100);
    expect(labStore.getState().history).toHaveLength(5);
  });

  it("synchronizes store controls before every fixed step", () => {
    const source = createRecordingSource();
    labStore.getState().setFanPower(36);
    labStore.getState().startRun();
    const stop = startTrackedRuntime({ source, tickMs: 50, stepsPerTick: 2 });

    vi.advanceTimersByTime(50);

    expect(source.steps).toEqual([50, 50]);
    expect(source.calls).toEqual([
      "power:36", "phase:ramping", "step:50",
      "power:36", "phase:ramping", "step:50",
    ]);
    stop();
  });

  it.each<RunPhase>(["idle", "paused", "completed"])("skips ticks while phase is %s", (phase) => {
    const source = createRecordingSource();
    if (phase === "paused") {
      labStore.getState().startRun();
      labStore.getState().pauseRun();
    } else if (phase === "completed") {
      labStore.getState().startRun();
      labStore.getState().advancePhase();
      labStore.getState().advancePhase();
      labStore.getState().advancePhase();
    }
    const stop = startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(150);

    expect(source.steps).toEqual([]);
    stop();
  });

  it("pauses scheduling while the document is hidden without backfilling on return", () => {
    const source = createRecordingSource();
    labStore.getState().startRun();
    const revisionBeforeHide = labStore.getState().manualRunRevision;
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const stop = startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(200);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(50);

    expect(source.steps).toEqual([50]);
    expect(labStore.getState().manualRunRevision).toBe(revisionBeforeHide);
    stop();
  });

  it("owns the complete deterministic manual run lifecycle", () => {
    const source = createPhaseAwareSource();
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(50);
    expect(labStore.getState().phase).toBe("stabilizing");

    vi.advanceTimersByTime(2_000);
    expect(labStore.getState().phase).toBe("sampling");

    vi.advanceTimersByTime(4_000);
    expect(labStore.getState().phase).toBe("completed");
    expect(source.steps).toHaveLength(121);
  });

  it("requires a fresh stable window after pausing a partially stable manual run", () => {
    const source = createPhaseAwareSource();
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(50);
    vi.advanceTimersByTime(1_000);
    expect(labStore.getState().phase).toBe("stabilizing");
    const stepsBeforePause = source.steps.length;

    labStore.getState().pauseRun();
    vi.advanceTimersByTime(5_000);
    expect(source.steps).toHaveLength(stepsBeforePause);
    expect(labStore.getState()).toMatchObject({ phase: "paused", resumePhase: "stabilizing" });

    labStore.getState().resumeRun();
    vi.advanceTimersByTime(1_000);
    expect(labStore.getState().phase).toBe("stabilizing");
    vi.advanceTimersByTime(1_000);
    expect(labStore.getState().phase).toBe("sampling");
  });

  it("requires a fresh consecutive two-second stable window after a late transient", () => {
    const source = createPhaseAwareSource();
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(50);
    vi.advanceTimersByTime(1_950);
    source.setQuality("transient");
    vi.advanceTimersByTime(50);
    source.setQuality("stable");
    vi.advanceTimersByTime(50);
    expect(labStore.getState().phase).toBe("stabilizing");

    vi.advanceTimersByTime(1_950);
    expect(labStore.getState().phase).toBe("sampling");
  });

  it("returns to stabilization when a transient breaks a nearly complete sampling window", () => {
    const source = createPhaseAwareSource();
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(50 + 2_000 + 3_950);
    expect(labStore.getState().phase).toBe("sampling");
    source.setQuality("transient");
    vi.advanceTimersByTime(50);
    expect(labStore.getState().phase).toBe("stabilizing");

    source.setQuality("stable");
    vi.advanceTimersByTime(2_000);
    expect(labStore.getState().phase).toBe("sampling");
    vi.advanceTimersByTime(3_950);
    expect(labStore.getState().phase).toBe("sampling");
    vi.advanceTimersByTime(50);
    expect(labStore.getState().phase).toBe("completed");
  });

  it("rejects an abnormal source timestamp without advancing or accepting the frame", () => {
    const source = createPhaseAwareSource();
    source.setNextTimestamp(Number.NaN);
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(50);

    expect(labStore.getState()).toMatchObject({ phase: "ramping", history: [] });
    expect(labStore.getState().eventLog.at(-1)).toContain("无效仿真时间步");
  });

  it("starts a new evidence revision after a recoverable bad timestamp and requires a fresh stable window", () => {
    const source = createPhaseAwareSource();
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    startTrackedRuntime({ source, tickMs: 50 });

    vi.advanceTimersByTime(50);
    vi.advanceTimersByTime(1_000);
    expect(labStore.getState().phase).toBe("stabilizing");
    const revisionBeforeBadFrame = labStore.getState().manualRunRevision;
    const acceptedTimestamp = labStore.getState().telemetry.simulationTimeMs;

    source.setNextTimestamp(acceptedTimestamp);
    vi.advanceTimersByTime(50);

    expect(labStore.getState()).toMatchObject({
      phase: "ramping",
      manualRunRevision: revisionBeforeBadFrame + 1,
    });
    expect(labStore.getState().telemetry.simulationTimeMs).toBe(acceptedTimestamp);

    vi.advanceTimersByTime(50);
    expect(labStore.getState().phase).toBe("stabilizing");
    vi.advanceTimersByTime(1_950);
    expect(labStore.getState().phase).toBe("stabilizing");
    vi.advanceTimersByTime(50);
    expect(labStore.getState().phase).toBe("sampling");
  });
});
