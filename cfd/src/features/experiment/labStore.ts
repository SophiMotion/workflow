import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createDefaultSimulationSource } from "./SimulationSource";
import { experimentReducer } from "./experimentMachine";
import type { ActiveRunPhase, RunPhase, TelemetryFrame } from "./model";
import type { FlowFieldFrame, FlowRuntimeMetadata } from "../flow/types";
import { captureCfdSensorProxySample } from "../flow/cfdSensorProxy";
import {
  appendSweepProxySample,
  advanceSweep,
  createSweepState,
  isValidSweepDt,
  retryFailedCondition,
  type SweepState,
} from "../sweep/sweepRunner";

export const MAX_HISTORY = 1200;

export type LabState = {
  phase: RunPhase;
  resumePhase: ActiveRunPhase | null;
  manualRunRevision: number;
  sweepRunRevision: number;
  fanPowerPct: number;
  telemetry: TelemetryFrame;
  history: TelemetryFrame[];
  flowField: FlowFieldFrame | null;
  flowMetadata: FlowRuntimeMetadata | null;
  flowFrameSequence: number;
  flowStatus: "idle" | "loading" | "ready" | "failed";
  flowError: string | null;
  eventLog: string[];
  selectedField: "speed" | "pressure" | "vorticity" | "streamlines";
  sweep: SweepState | null;
  acceptFlowFrame(frame: FlowFieldFrame, metadata: Omit<FlowRuntimeMetadata, "acceptedFrameId">): void;
  setFanPower(percent: number): void;
  acceptFrame(frame: TelemetryFrame): void;
  startRun(): void;
  pauseRun(): void;
  resumeRun(): void;
  advancePhase(): void;
  resetLab(): void;
  selectField(field: LabState["selectedField"]): void;
  startSweep(): void;
  cancelSweep(): void;
  retrySweep(): void;
};

const initialTelemetry = createDefaultSimulationSource(0).reset();

export const labStore = createStore<LabState>((set) => ({
  phase: "idle",
  resumePhase: null,
  manualRunRevision: 0,
  sweepRunRevision: 0,
  fanPowerPct: 0,
  telemetry: initialTelemetry,
  history: [],
  flowField: null,
  flowMetadata: null,
  flowFrameSequence: 0,
  flowStatus: "idle",
  flowError: null,
  eventLog: [],
  selectedField: "speed",
  sweep: null,
  setFanPower: (percent) => set((state) => {
    if (isSweepActive(state.sweep)) return state;
    const fanPowerPct = Math.min(100, Math.max(0, percent));
    if (fanPowerPct === state.fanPowerPct) return state;
    if (state.phase === "paused") {
      return {
        fanPowerPct,
        resumePhase: "ramping",
        manualRunRevision: state.manualRunRevision + 1,
      };
    }
    if (state.phase === "ramping" || state.phase === "stabilizing" || state.phase === "sampling") {
      return {
        fanPowerPct,
        phase: "ramping",
        resumePhase: null,
        manualRunRevision: state.manualRunRevision + 1,
      };
    }
    return { fanPowerPct, manualRunRevision: state.manualRunRevision + 1 };
  }),
  acceptFrame: (frame) => set((state) => {
    if (!isSweepActive(state.sweep)) {
      return {
        telemetry: frame,
        history: [...state.history.slice(-MAX_HISTORY + 1), frame],
      };
    }

    const dtMs = frame.simulationTimeMs - state.telemetry.simulationTimeMs;
    const transition = advanceSweep(state.sweep, frame, dtMs);
    if (!isValidSweepDt(dtMs)) {
      if (frame.fanPowerPct !== state.sweep.commandedPowerPct) return state;
      return {
        sweep: transition.state,
        phase: "completed",
        resumePhase: null,
      };
    }
    return {
      telemetry: frame,
      history: [...state.history.slice(-MAX_HISTORY + 1), frame],
      sweep: transition.state,
      fanPowerPct: transition.commandPowerPct ?? state.fanPowerPct,
      phase: sweepStatusToRunPhase(transition.state),
      resumePhase: null,
    };
  }),
  acceptFlowFrame: (flowField, metadata) => set((state) => {
    const acceptedFrameId = state.flowFrameSequence + 1;
    const acceptedMetadata = { ...metadata, acceptedFrameId };
    let sweep = state.sweep;
    if (sweep?.status === "sampling"
      && metadata.sourceSweepRunRevision === state.sweepRunRevision
      && metadata.sourceSweepConditionIndex === sweep.conditionIndex
      && metadata.sourceFanPowerPct === sweep.commandedPowerPct) {
      const sourceTelemetry = findTelemetryBySequence(state, metadata.sourceTelemetrySequence);
      if (sourceTelemetry?.phase === "sampling"
        && sourceTelemetry.quality === "stable"
        && sourceTelemetry.fanPowerPct === sweep.commandedPowerPct) {
        const sample = captureCfdSensorProxySample({
          frame: flowField,
          telemetry: sourceTelemetry,
          flowFrameId: acceptedFrameId,
          runtimeConfiguration: metadata,
        });
        if (sample !== null) sweep = appendSweepProxySample(sweep, sample);
      }
    }
    return {
      flowField,
      flowMetadata: acceptedMetadata,
      flowFrameSequence: acceptedFrameId,
      flowStatus: "ready",
      flowError: null,
      sweep,
    };
  }),
  startRun: () => set((state) => {
    if (isSweepActive(state.sweep)) return state;
    const next = experimentReducer(state, { type: "start" });
    return next === state ? state : { ...next, manualRunRevision: state.manualRunRevision + 1 };
  }),
  pauseRun: () => set((state) => {
    if (isSweepActive(state.sweep)) return state;
    const next = experimentReducer(state, { type: "pause" });
    return next === state ? state : { ...next, manualRunRevision: state.manualRunRevision + 1 };
  }),
  resumeRun: () => set((state) => isSweepActive(state.sweep) ? state : experimentReducer(state, { type: "resume" })),
  advancePhase: () => set((state) => isSweepActive(state.sweep) ? state : experimentReducer(state, { type: "advance" })),
  resetLab: () => set((state) => ({
    phase: "idle",
    resumePhase: null,
    manualRunRevision: state.manualRunRevision + 1,
    sweepRunRevision: state.sweepRunRevision + 1,
    fanPowerPct: 0,
    telemetry: initialTelemetry,
    history: [],
    flowField: null,
    flowMetadata: null,
    flowFrameSequence: 0,
    flowStatus: "idle",
    flowError: null,
    eventLog: [],
    selectedField: "speed",
    sweep: null,
  })),
  selectField: (selectedField) => set({ selectedField }),
  startSweep: () => set((state) => isSweepActive(state.sweep) ? state : ({
    sweep: createSweepState(state.flowFrameSequence),
    sweepRunRevision: state.sweepRunRevision + 1,
    fanPowerPct: 30,
    phase: "ramping",
    resumePhase: null,
  })),
  cancelSweep: () => set((state) => ({
    sweep: state.sweep ? { ...state.sweep, status: "idle", error: null } : null,
    fanPowerPct: 0,
    phase: "idle",
    resumePhase: null,
    sweepRunRevision: state.sweepRunRevision + 1,
  })),
  retrySweep: () => set((state) => {
    if (!state.sweep || state.sweep.status !== "failed") return state;
    const sweep = retryFailedCondition(state.sweep);
    return {
      sweep: { ...sweep, lastCapturedFlowFrameId: state.flowFrameSequence },
      sweepRunRevision: state.sweepRunRevision + 1,
      fanPowerPct: sweep.commandedPowerPct,
      phase: "ramping",
      resumePhase: null,
    };
  }),
}));

export function useLabStore<T>(selector: (state: LabState) => T): T {
  return useStore(labStore, selector);
}

function isSweepActive(sweep: SweepState | null): sweep is SweepState {
  return sweep !== null && ["ramping", "stabilizing", "sampling"].includes(sweep.status);
}

function sweepStatusToRunPhase(sweep: SweepState): RunPhase {
  if (sweep.status === "ramping" || sweep.status === "stabilizing" || sweep.status === "sampling") {
    return sweep.status;
  }
  return "completed";
}

function findTelemetryBySequence(state: LabState, sequence: number): TelemetryFrame | undefined {
  if (state.telemetry.sequence === sequence) return state.telemetry;
  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const frame = state.history[index];
    if (frame?.sequence === sequence) return frame;
  }
  return undefined;
}
