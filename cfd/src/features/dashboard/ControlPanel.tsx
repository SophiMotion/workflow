import { useId, useState } from "react";
import { labStore, useLabStore } from "../experiment/labStore";
import type { RunPhase } from "../experiment/model";

const PHASE_LABELS: Record<RunPhase, string> = {
  idle: "待机 / IDLE",
  ramping: "升速中 / RAMPING",
  stabilizing: "稳定中 / STABILIZING",
  sampling: "采样 / SAMPLING",
  paused: "已暂停 / PAUSED",
  completed: "已完成 / COMPLETED",
};

const ACTIVE_PHASES: readonly RunPhase[] = ["ramping", "stabilizing", "sampling"];

type ControlPanelProps = {
  onRestartFlow?(): Promise<void> | void;
};

export function ControlPanel({ onRestartFlow }: ControlPanelProps = {}) {
  const inputId = useId();
  const phase = useLabStore((state) => state.phase);
  const fanPowerPct = useLabStore((state) => state.fanPowerPct);
  const sweepStatus = useLabStore((state) => state.sweep?.status);
  const flowStatus = useLabStore((state) => state.flowStatus);
  const flowError = useLabStore((state) => state.flowError);
  const [restartingFlow, setRestartingFlow] = useState(false);
  const active = ACTIVE_PHASES.includes(phase);
  const sweepActive = sweepStatus === "ramping" || sweepStatus === "stabilizing" || sweepStatus === "sampling";

  const startOrResume = () => {
    if (phase === "paused") {
      labStore.getState().resumeRun();
      return;
    }
    labStore.getState().startRun();
  };

  const reset = () => {
    if (labStore.getState().history.length > 0
      && !window.confirm("停止实验并清除当前 60 秒遥测历史？")) return;
    labStore.getState().resetLab();
  };

  const restartFlow = async () => {
    if (!onRestartFlow || restartingFlow) return;
    setRestartingFlow(true);
    try {
      await onRestartFlow();
    } catch {
      // The flow store remains the single visible source for restart failures.
    } finally {
      setRestartingFlow(false);
    }
  };

  return (
    <section className="dashboard-section fan-controls" aria-labelledby="fan-control-title">
      <div className="dashboard-section-heading">
        <div>
          <p className="section-kicker">FAN CONTROL</p>
          <h2 id="fan-control-title">风扇控制</h2>
        </div>
        <span className={`phase-badge phase-${phase}`} aria-live="polite">{PHASE_LABELS[phase]}</span>
      </div>

      {flowStatus === "failed" && (
        <div className="flow-failure-alert" role="alert" aria-live="polite">
          <strong>二维求解器暂时不可用</strong>
          <span>{flowError ?? "Flow worker failure"}</span>
          <button type="button" disabled={!onRestartFlow || restartingFlow} onClick={() => void restartFlow()}>
            {restartingFlow ? "正在重新启动…" : "重新启动求解器"}
          </button>
        </div>
      )}

      <div className="fan-power-row">
        <label htmlFor={inputId}>风扇功率</label>
        <output htmlFor={inputId}>{fanPowerPct}%</output>
      </div>
      <label className="fan-slider-hit-area" htmlFor={inputId}>
        <input
          id={inputId}
          className="fan-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={fanPowerPct}
          disabled={sweepActive}
          onChange={(event) => labStore.getState().setFanPower(event.currentTarget.valueAsNumber)}
        />
      </label>
      <div className="slider-scale" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div>

      <div className="experiment-actions">
        <button type="button" className="action-primary" disabled={active || sweepActive} onClick={startOrResume}>
          {phase === "paused" ? "继续实验" : "启动实验"}
        </button>
        <button type="button" disabled={!active || sweepActive} onClick={() => labStore.getState().pauseRun()}>暂停实验</button>
        <button type="button" onClick={reset}>停止并重置</button>
      </div>
    </section>
  );
}
