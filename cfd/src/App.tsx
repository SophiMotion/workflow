import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "./features/dashboard/ControlPanel";
import { FieldSelector, type FieldId } from "./features/dashboard/FieldSelector";
import { TelemetryCards, type SensorId } from "./features/dashboard/TelemetryCards";
import {
  recordFieldInspection,
  recordSensorInspection,
  recordStableTelemetry,
  recordStableWindowInspection,
} from "./features/dashboard/evidenceRecording";
import { createDefaultSimulationSource } from "./features/experiment/SimulationSource";
import { labStore, useLabStore } from "./features/experiment/labStore";
import type { TelemetrySource } from "./features/experiment/model";
import { startSimulationRuntime } from "./features/experiment/simulationRuntime";
import { createLbmWorker, LbmWorkerClient } from "./features/flow/LbmWorkerClient";
import { startFlowRuntime, type FlowClientLike, type FlowRuntime } from "./features/flow/flowRuntime";
import type { FlowRebuildReason } from "./features/flow/types";
import { ExperimentReport } from "./features/report/ExperimentReport";
import { AppShell } from "./features/shell/AppShell";
import { ErrorBoundary } from "./features/shell/ErrorBoundary";
import { qualityProfile, selectQualityProfile, type QualityProfile } from "./features/shell/quality";
import { TutorialModeToggle } from "./features/tutorial/TutorialModeToggle";
import { TutorialRail } from "./features/tutorial/TutorialRail";
import {
  advanceLesson,
  emptyEvidence,
  recordComparisonReason,
  recordFlowAnswer,
  recordLargestResidualSelection,
  recordReportConclusion,
  recordSweepCompletion,
} from "./features/tutorial/tutorialProgress";
import { LESSONS, type LessonId, type TutorialMode } from "./features/tutorial/lessonDefinitions";

const LazyWindTunnelScene = lazy(() => import("./features/scene/WindTunnelScene").then((module) => ({ default: module.WindTunnelScene })));
const LazyHistoryChart = lazy(() => import("./features/dashboard/HistoryChart").then((module) => ({ default: module.HistoryChart })));

export type AppFlowClient = FlowClientLike & {
  ready(): Promise<void>;
  dispose(): void;
};

type AppProps = {
  flowClientFactory?(profile: QualityProfile): AppFlowClient;
  simulationSourceFactory?(): TelemetrySource;
  simulationRuntimeFactory?: typeof startSimulationRuntime;
  flowRuntimeFactory?: typeof startFlowRuntime;
};

const createFlowClient = (profile: QualityProfile): AppFlowClient => new LbmWorkerClient(createLbmWorker, {
  width: profile.grid[0],
  height: profile.grid[1],
  inletVelocity: 0,
  tau: 0.62,
});
const createSimulationSource = (): TelemetrySource => createDefaultSimulationSource(20260818);

export function App(props: AppProps) {
  return <ErrorBoundary><Workbench {...props} /></ErrorBoundary>;
}

function Workbench({
  flowClientFactory = createFlowClient,
  simulationSourceFactory = createSimulationSource,
  simulationRuntimeFactory = startSimulationRuntime,
  flowRuntimeFactory = startFlowRuntime,
}: AppProps) {
  const [mode, setMode] = useState<TutorialMode>("guided");
  const [activeLesson, setActiveLesson] = useState<LessonId>("anatomy");
  const [evidence, setEvidence] = useState(emptyEvidence);
  const phase = useLabStore((state) => state.phase);
  const sweep = useLabStore((state) => state.sweep);
  const flowMetadata = useLabStore((state) => state.flowMetadata);
  const [quality, setQuality] = useState(readEnvironmentQuality);
  const [activeQuality, setActiveQuality] = useState(readEnvironmentQuality);
  const [flowPaused, setFlowPaused] = useState(false);
  const [flowEpoch, setFlowEpoch] = useState(0);
  const flowRuntimeRef = useRef<FlowRuntime | null>(null);
  const flowRebuildReasonRef = useRef<FlowRebuildReason>("initial");

  useEffect(() => {
    const source = simulationSourceFactory();
    const stepsPerTick = import.meta.env.VITE_E2E_TIME_SCALE === "20" ? 20 : 1;
    const stopSimulation = simulationRuntimeFactory({ source, tickMs: 50, stepsPerTick });
    const unsubscribe = labStore.subscribe((state, previous) => {
      if (state.manualRunRevision !== previous.manualRunRevision) {
        setEvidence((current) => current.stableSeconds === 0
          && current.stableRunRevision === null
          ? current
          : { ...current, stableSeconds: 0, stableRunRevision: null });
      }
      if (state.phase === "idle" && state.history.length === 0
        && (previous.phase !== "idle" || previous.history.length > 0)) {
        source.reset();
      }

      if (state.telemetry === previous.telemetry) return;
      setEvidence((current) => recordStableTelemetry(
        current,
        previous.telemetry,
        state.telemetry,
        state.fanPowerPct,
        state.manualRunRevision,
      ));
      if (state.sweep?.completedPowers !== previous.sweep?.completedPowers) {
        setEvidence((current) => recordSweepCompletion(current, state.sweep?.completedPowers ?? []));
      }
    });

    return () => {
      unsubscribe();
      stopSimulation();
    };
  }, [simulationRuntimeFactory, simulationSourceFactory]);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const updateQuality = () => {
      const candidate = readEnvironmentQuality();
      setQuality((current) => {
        const next = isExperimentActive(phase) && isHigherQuality(candidate, current) ? current : candidate;
        if (next.name !== current.name) flowRebuildReasonRef.current = "environment-profile-change";
        return next;
      });
    };
    window.addEventListener("resize", updateQuality);
    reducedMotion?.addEventListener("change", updateQuality);
    updateQuality();
    return () => {
      window.removeEventListener("resize", updateQuality);
      reducedMotion?.removeEventListener("change", updateQuality);
    };
  }, [phase]);

  useEffect(() => {
    if (flowPaused) return;
    const client = flowClientFactory(quality);
    const runtime = flowRuntimeFactory(client, { rebuildReason: flowRebuildReasonRef.current });
    let current = true;
    flowRuntimeRef.current = runtime;
    const unsubscribeFailure = labStore.subscribe((state, previous) => {
      if (state.flowStatus === previous.flowStatus && state.flowError === previous.flowError) return;
      if (state.flowStatus !== "failed" || !state.flowError?.includes("Flow worker timed out")) return;
      const next = quality.name === "high"
        ? qualityProfile("medium")
        : quality.name === "medium"
          ? qualityProfile("low")
          : null;
      if (next === null) return;
      flowRebuildReasonRef.current = "timeout-downgrade";
      labStore.setState((labState) => ({
        eventLog: [
          ...labState.eventLog,
          `${quality.name.toUpperCase()} 超时：二维求解器受控降档至 ${next.name.toUpperCase()} 并重建。`,
        ],
      }));
      setQuality(next);
    });
    void client.ready().then(() => {
      if (current) setActiveQuality(quality);
    }).catch(() => undefined);
    return () => {
      current = false;
      unsubscribeFailure();
      if (flowRuntimeRef.current === runtime) flowRuntimeRef.current = null;
      runtime.stop();
      client.dispose();
    };
  }, [flowClientFactory, flowEpoch, flowPaused, flowRuntimeFactory, quality]);

  const restartFlow = useCallback(() => {
    return flowRuntimeRef.current?.restart() ?? Promise.reject(new Error("Flow runtime is unavailable"));
  }, []);
  const handleQualityChange = useCallback((next: QualityProfile) => {
    if (next.name === quality.name) return;
    flowRebuildReasonRef.current = "performance-downgrade";
    labStore.setState((state) => ({
      eventLog: [...state.eventLog, `渲染性能持续低于 24 FPS：质量已降至 ${next.name.toUpperCase()}。`],
    }));
    setQuality(next);
  }, [quality.name]);
  const handleContextLost = useCallback(() => setFlowPaused(true), []);
  const handleContextRestored = useCallback(() => {
    flowRebuildReasonRef.current = "context-restore";
    setFlowEpoch((current) => current + 1);
    setFlowPaused(false);
  }, []);

  const inspectSensor = (sensor: SensorId) => setEvidence((current) => recordSensorInspection(current, sensor));
  const inspectField = (field: FieldId) => setEvidence((current) => recordFieldInspection(current, field));

  return (
    <AppShell
      headerActions={<TutorialModeToggle mode={mode} onModeChange={setMode} />}
      left={<TutorialRail
        activeLesson={activeLesson}
        evidence={evidence}
        mode={mode}
        onLessonChange={setActiveLesson}
        onFlowAnswer={(correct) => setEvidence((current) => recordFlowAnswer(current, correct))}
        onAdvance={() => setActiveLesson((currentLesson) => {
          if (mode === "guided") return advanceLesson(currentLesson, evidence);
          const currentIndex = LESSONS.findIndex((lesson) => lesson.id === currentLesson);
          return LESSONS[Math.min(currentIndex + 1, LESSONS.length - 1)]!.id;
        })}
      />}
      scene={
        <Suspense fallback={<p className="scene-loading">正在初始化数字风洞…</p>}>
          <LazyWindTunnelScene
            quality={quality}
            onQualityChange={handleQualityChange}
            onContextLost={handleContextLost}
            onContextRestored={handleContextRestored}
            onHotspot={(id) => setEvidence((current) => current.viewedHotspots.includes(id)
              ? current
              : { ...current, viewedHotspots: [...current.viewedHotspots, id] })}
          />
        </Suspense>
      }
      right={(
        <div className="dashboard-sidebar">
          <ControlPanel onRestartFlow={restartFlow} />
          <FieldSelector onInspect={inspectField} quality={activeQuality} />
          <TelemetryCards onInspect={inspectSensor} />
        </div>
      )}
      bottom={(
        <div className="experiment-lower-deck">
          <Suspense fallback={<p className="chart-empty">正在准备实验曲线…</p>}>
            <LazyHistoryChart
              refreshHz={quality.chartRefreshHz}
              onInspectStableWindow={() => setEvidence(recordStableWindowInspection)}
            />
          </Suspense>
          <ExperimentReport
            sweep={sweep}
            conclusion={evidence.reportConclusion}
            comparisonReason={evidence.comparisonReason}
            selectedLargestResidualPower={evidence.selectedLargestResidualPower}
            flowMetadata={flowMetadata}
            onConclusionChange={(conclusion) => setEvidence((current) => recordReportConclusion(current, conclusion))}
            onComparisonReasonChange={(reason) => setEvidence((current) => recordComparisonReason(current, reason))}
            onSelectLargestResidual={(power, largestPower) => setEvidence((current) => (
              recordLargestResidualSelection(current, power, largestPower)
            ))}
            onStartSweep={() => {
              setEvidence((current) => ({
                ...recordSweepCompletion(current, []),
                selectedLargestResidualPower: null,
                comparisonReason: "",
                reportConclusion: "",
              }));
              labStore.getState().startSweep();
            }}
            onCancelSweep={() => labStore.getState().cancelSweep()}
            onRetrySweep={() => labStore.getState().retrySweep()}
          />
        </div>
      )}
    />
  );
}

function readEnvironmentQuality(): QualityProfile {
  return selectQualityProfile({
    viewportWidth: typeof window === "undefined" ? 1_024 : window.innerWidth,
    hardwareConcurrency: typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency || 4,
    reducedMotion: typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  });
}

function isExperimentActive(runPhase: ReturnType<typeof labStore.getState>["phase"]): boolean {
  return runPhase === "ramping" || runPhase === "stabilizing" || runPhase === "sampling" || runPhase === "paused";
}

function isHigherQuality(candidate: QualityProfile, current: QualityProfile): boolean {
  const rank: Record<QualityProfile["name"], number> = { reduced: 0, low: 1, medium: 2, high: 3 };
  return rank[candidate.name] > rank[current.name];
}
