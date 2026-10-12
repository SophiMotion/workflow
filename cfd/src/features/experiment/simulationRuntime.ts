import { labStore } from "./labStore";
import type { RunPhase, TelemetrySource } from "./model";

const FIXED_STEP_MS = 50;

type SimulationRuntimeOptions = {
  source: TelemetrySource;
  tickMs: number;
  stepsPerTick?: number;
};

export function startSimulationRuntime({ source, tickMs, stepsPerTick = 1 }: SimulationRuntimeOptions): () => void {
  const steps = Math.max(1, Math.floor(stepsPerTick));
  let timer: ReturnType<typeof setInterval> | undefined;
  let manualStableMs = 0;
  let manualSamplingMs = 0;
  let manualRunRevision = labStore.getState().manualRunRevision;

  const tick = () => {
    for (let index = 0; index < steps; index += 1) {
      const stateBeforeStep = labStore.getState();
      const { fanPowerPct, phase, sweep } = stateBeforeStep;
      if (!isActiveRunPhase(phase)) {
        return;
      }
      if (manualRunRevision !== stateBeforeStep.manualRunRevision) {
        manualRunRevision = stateBeforeStep.manualRunRevision;
        manualStableMs = 0;
        manualSamplingMs = 0;
      }
      source.setFanPower(fanPowerPct);
      source.setPhase(phase);
      const frame = source.step(FIXED_STEP_MS);

      // The sweep owns its own phase machine. Ordinary experiments advance only
      // from emitted simulation steps, so pause/hidden wall time is never credited.
      // 自动扫频拥有独立阶段机；普通实验仅由已发出的仿真步推进，不计入暂停或隐藏页时间。
      if (isSweepOwned(sweep)) {
        labStore.getState().acceptFrame(frame);
        continue;
      }

      const simulationDtMs = frame.simulationTimeMs - stateBeforeStep.telemetry.simulationTimeMs;
      if (!isValidManualDt(simulationDtMs)) {
        manualStableMs = 0;
        manualSamplingMs = 0;
        labStore.setState((state) => ({
          phase: "ramping",
          resumePhase: null,
          manualRunRevision: state.manualRunRevision + 1,
          eventLog: [...state.eventLog, "普通实验收到无效仿真时间步，阶段已安全回到 RAMPING。"],
        }));
        continue;
      }

      labStore.getState().acceptFrame(frame);

      if (phase === "ramping") {
        manualStableMs = 0;
        manualSamplingMs = 0;
        if (frame.quality === "stable" && frame.fanPowerPct === fanPowerPct && fanPowerPct > 0) {
          labStore.getState().advancePhase();
        }
        continue;
      }

      if (phase === "stabilizing") {
        manualStableMs = frame.quality === "stable" && frame.fanPowerPct === fanPowerPct
          ? manualStableMs + simulationDtMs
          : 0;
        if (manualStableMs >= 2_000) {
          manualStableMs = 2_000;
          manualSamplingMs = 0;
          labStore.getState().advancePhase();
        }
        continue;
      }

      if (frame.quality !== "stable" || frame.fanPowerPct !== fanPowerPct) {
        manualStableMs = 0;
        manualSamplingMs = 0;
        labStore.setState({ phase: "stabilizing", resumePhase: null });
        continue;
      }
      manualSamplingMs += simulationDtMs;
      if (manualSamplingMs >= 4_000) {
        manualSamplingMs = 4_000;
        labStore.getState().advancePhase();
      }
    }
  };

  const schedule = () => {
    if (timer === undefined && !document.hidden) {
      timer = setInterval(tick, tickMs);
    }
  };
  const unschedule = () => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  const onVisibilityChange = () => {
    if (document.hidden) {
      unschedule();
    } else {
      schedule();
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  schedule();

  return () => {
    unschedule();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

function isActiveRunPhase(phase: RunPhase): boolean {
  return phase === "ramping" || phase === "stabilizing" || phase === "sampling";
}

function isSweepOwned(sweep: ReturnType<typeof labStore.getState>["sweep"]): boolean {
  return sweep !== null && (sweep.status === "ramping" || sweep.status === "stabilizing" || sweep.status === "sampling");
}

function isValidManualDt(dtMs: number): boolean {
  return Number.isFinite(dtMs) && dtMs > 0 && dtMs <= 1_000;
}
