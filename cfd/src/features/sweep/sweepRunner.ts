import type { TelemetryFrame } from "../experiment/model";
import { MIN_PROXY_SAMPLES, type CfdSensorProxySample } from "../flow/cfdSensorProxy";

export const SWEEP_POWERS = [30, 60, 90] as const;
export const REQUIRED_STABLE_MS = 2_000;
export const REQUIRED_SAMPLING_MS = 4_000;
export const CONDITION_TIMEOUT_MS = 15_000;
export const PROXY_SAMPLE_TIMEOUT_MS = 15_000;
export const MAX_SWEEP_STEP_MS = 1_000;

export type SweepPower = (typeof SWEEP_POWERS)[number];
export type SweepStatus = "idle" | "ramping" | "stabilizing" | "sampling" | "completed" | "failed";

export type SweepState = {
  status: SweepStatus;
  conditionIndex: number;
  commandedPowerPct: SweepPower;
  stableMs: number;
  samplingMs: number;
  conditionElapsedMs: number;
  completedPowers: number[];
  samplesByPower: Partial<Record<SweepPower, TelemetryFrame[]>>;
  proxySamplesByPower: Partial<Record<SweepPower, CfdSensorProxySample[]>>;
  lastCapturedFlowFrameId: number;
  error: string | null;
};

export type SweepTransition = {
  state: SweepState;
  commandPowerPct?: SweepPower;
};

export function createSweepState(existingFlowFrameId = 0): SweepState {
  return {
    status: "ramping",
    conditionIndex: 0,
    commandedPowerPct: SWEEP_POWERS[0],
    stableMs: 0,
    samplingMs: 0,
    conditionElapsedMs: 0,
    completedPowers: [],
    samplesByPower: {},
    proxySamplesByPower: {},
    lastCapturedFlowFrameId: existingFlowFrameId,
    error: null,
  };
}

export function advanceSweep(
  state: SweepState,
  frame: TelemetryFrame,
  dtMs: number,
  proxySample: CfdSensorProxySample | null = null,
): SweepTransition {
  if (state.status === "idle" || state.status === "completed" || state.status === "failed") {
    return { state };
  }
  if (frame.fanPowerPct !== state.commandedPowerPct) {
    if (state.status === "sampling") {
      return { state: clearContinuousWindow(state, "stabilizing") };
    }
    if (state.status === "stabilizing" && state.stableMs !== 0) {
      return { state: { ...state, stableMs: 0 } };
    }
    return { state };
  }

  if (!isValidSweepDt(dtMs)) {
    return {
      state: {
        ...state,
        status: "failed",
        error: `${state.commandedPowerPct}% 工况收到无效仿真时间步`,
      },
    };
  }

  const elapsed = dtMs;
  const conditionElapsedMs = state.conditionElapsedMs + elapsed;

  if (state.status === "sampling") {
    if (frame.quality !== "stable") {
      const cleared = clearContinuousWindow(state, "stabilizing");
      return { state: cleared };
    }
    const samplingMs = state.samplingMs + elapsed;
    const samples = [...(state.samplesByPower[state.commandedPowerPct] ?? []), frame];
    let samplingState: SweepState = {
      ...state,
      samplingMs,
      conditionElapsedMs,
      samplesByPower: { ...state.samplesByPower, [state.commandedPowerPct]: samples },
    };
    if (proxySample !== null) samplingState = appendSweepProxySample(samplingState, proxySample);

    if (samplingMs < REQUIRED_SAMPLING_MS) return { state: samplingState };
    if ((samplingState.proxySamplesByPower[state.commandedPowerPct]?.length ?? 0) < MIN_PROXY_SAMPLES) {
      return samplingMs >= PROXY_SAMPLE_TIMEOUT_MS
        ? { state: failCondition(samplingState, `${state.commandedPowerPct}% 工况未获得足够的同步 CFD 样本`) }
        : { state: samplingState };
    }
    return completeCondition(samplingState);
  }

  const stableMs = frame.quality === "stable" ? state.stableMs + elapsed : 0;
  if (stableMs >= REQUIRED_STABLE_MS) {
    return {
      state: {
        ...state,
        status: "sampling",
        stableMs: REQUIRED_STABLE_MS,
        conditionElapsedMs: 0,
      },
    };
  }

  if (conditionElapsedMs >= CONDITION_TIMEOUT_MS) {
    return {
      state: {
        ...state,
        status: "failed",
        stableMs,
        conditionElapsedMs,
        error: `${state.commandedPowerPct}% 工况在 15 秒内未达到连续稳定判据`,
      },
    };
  }

  return {
    state: {
      ...state,
      status: "stabilizing",
      stableMs,
      conditionElapsedMs,
    },
  };
}

export function isValidSweepDt(dtMs: number): boolean {
  return Number.isFinite(dtMs) && dtMs >= 0 && dtMs <= MAX_SWEEP_STEP_MS;
}

export function retryFailedCondition(state: SweepState): SweepState {
  if (state.status !== "failed") return state;
  return {
    ...state,
    status: "ramping",
    stableMs: 0,
    samplingMs: 0,
    conditionElapsedMs: 0,
    samplesByPower: { ...state.samplesByPower, [state.commandedPowerPct]: [] },
    proxySamplesByPower: { ...state.proxySamplesByPower, [state.commandedPowerPct]: [] },
    error: null,
  };
}

export function appendSweepProxySample(state: SweepState, sample: CfdSensorProxySample): SweepState {
  if (state.status !== "sampling"
    || sample.fanPowerPct !== state.commandedPowerPct
    || sample.flowFrameId <= state.lastCapturedFlowFrameId) {
    return state;
  }
  return {
    ...state,
    proxySamplesByPower: {
      ...state.proxySamplesByPower,
      [state.commandedPowerPct]: [
        ...(state.proxySamplesByPower[state.commandedPowerPct] ?? []),
        sample,
      ],
    },
    lastCapturedFlowFrameId: sample.flowFrameId,
  };
}

function clearContinuousWindow(state: SweepState, status: "stabilizing"): SweepState {
  return {
    ...state,
    status,
    stableMs: 0,
    samplingMs: 0,
    conditionElapsedMs: 0,
    samplesByPower: { ...state.samplesByPower, [state.commandedPowerPct]: [] },
    proxySamplesByPower: { ...state.proxySamplesByPower, [state.commandedPowerPct]: [] },
  };
}

function failCondition(state: SweepState, error: string): SweepState {
  return { ...state, status: "failed", error };
}

function completeCondition(state: SweepState): SweepTransition {
  const completedPowers = [...state.completedPowers, state.commandedPowerPct];
  const nextPower = SWEEP_POWERS[state.conditionIndex + 1];
  if (nextPower === undefined) {
    return {
      state: {
        ...state,
        status: "completed",
        completedPowers,
        error: null,
      },
    };
  }

  return {
    commandPowerPct: nextPower,
    state: {
      ...state,
      status: "ramping",
      conditionIndex: state.conditionIndex + 1,
      commandedPowerPct: nextPower,
      stableMs: 0,
      samplingMs: 0,
      conditionElapsedMs: 0,
      completedPowers,
      error: null,
    },
  };
}
