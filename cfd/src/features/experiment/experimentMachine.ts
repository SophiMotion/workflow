import type { ActiveRunPhase, RunPhase } from "./model";

export type ExperimentState = {
  phase: RunPhase;
  resumePhase: ActiveRunPhase | null;
};

export type ExperimentEvent =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "advance" }
  | { type: "reset" };

export const initialExperimentState: ExperimentState = { phase: "idle", resumePhase: null };

const nextPhase: Record<ActiveRunPhase, RunPhase> = {
  ramping: "stabilizing",
  stabilizing: "sampling",
  sampling: "completed",
};

export function experimentReducer(state: ExperimentState, event: ExperimentEvent): ExperimentState {
  switch (event.type) {
    case "start":
      return state.phase === "idle" || state.phase === "completed"
        ? { phase: "ramping", resumePhase: null }
        : state;
    case "pause":
      return isActiveRunPhase(state.phase)
        ? { phase: "paused", resumePhase: state.phase }
        : state;
    case "resume":
      return state.phase === "paused" && state.resumePhase
        ? { phase: state.resumePhase, resumePhase: null }
        : state;
    case "advance":
      return isActiveRunPhase(state.phase)
        ? { phase: nextPhase[state.phase], resumePhase: null }
        : state;
    case "reset":
      return initialExperimentState;
  }
}

function isActiveRunPhase(phase: RunPhase): phase is ActiveRunPhase {
  return phase === "ramping" || phase === "stabilizing" || phase === "sampling";
}
