import { labStore } from "../experiment/labStore";
import { FlowWorkerError } from "./LbmWorkerClient";
import type { FlowFieldFrame, FlowRebuildReason, SolverIdentity } from "./types";

const FRAME_INTERVAL_MS = 100;

export interface FlowClientLike {
  requestFrame(inletVelocity: number, iterations?: number): Promise<FlowFieldFrame>;
  restart(): Promise<void>;
  getSolverIdentity(): SolverIdentity;
}

export interface FlowRuntime {
  stop(): void;
  restart(): Promise<void>;
}

export type FlowRuntimeOptions = {
  rebuildReason?: FlowRebuildReason;
};

export function mapWindToLatticeVelocity(windSpeedMps: number): number {
  return Math.min(0.08, Math.max(0, windSpeedMps / 12 * 0.08));
}

export function startFlowRuntime(client: FlowClientLike, options: FlowRuntimeOptions = {}): FlowRuntime {
  let stopped = false;
  let pending = false;
  let restarting = false;
  let failed = false;
  let recoveryUsed = false;
  let velocityScale = 1;
  let rebuildReason: FlowRebuildReason = options.rebuildReason ?? "initial";
  let generation = 0;
  let restartPromise: Promise<void> | null = null;

  labStore.setState({ flowStatus: "loading", flowError: null });

  const tick = async () => {
    if (stopped || failed || pending || restarting || document.hidden) {
      return;
    }

    pending = true;
    const tickGeneration = generation;
    const sourceState = labStore.getState();
    const sourceTelemetry = sourceState.telemetry;
    const windSpeedMps = sourceTelemetry.windSpeedMps;
    const inletVelocity = mapWindToLatticeVelocity(windSpeedMps) * velocityScale;
    const requestedInletVelocity = mapWindToLatticeVelocity(windSpeedMps);
    let actualInletVelocity = inletVelocity;

    try {
      let nextFrame: FlowFieldFrame;
      try {
        nextFrame = await client.requestFrame(inletVelocity);
      } catch (error) {
        if (!isNumericalInstability(error) || recoveryUsed) {
          throw error;
        }

        recoveryUsed = true;
        velocityScale *= 0.8;
        rebuildReason = "non-finite-restart";
        labStore.setState((state) => ({
          eventLog: [
            ...state.eventLog,
            "二维教学 CFD 数值场异常：入口格点速度已降至 80%，正在重启求解器。",
          ],
        }));
        await client.restart();
        actualInletVelocity = requestedInletVelocity * velocityScale;
        nextFrame = await client.requestFrame(actualInletVelocity);
      }

      if (!stopped && tickGeneration === generation) {
        const identity = client.getSolverIdentity();
        labStore.getState().acceptFlowFrame(nextFrame, {
          generation: identity.generation,
          gridWidth: nextFrame.width,
          gridHeight: nextFrame.height,
          tau: identity.tau,
          requestedInletVelocity,
          actualInletVelocity,
          velocityScale,
          recovery: velocityScale < 1 ? "non-finite-field-scale" : "none",
          rebuildReason,
          sourceTelemetrySequence: sourceTelemetry.sequence,
          sourceFanPowerPct: sourceTelemetry.fanPowerPct,
          sourceSweepRunRevision: sourceState.sweepRunRevision,
          sourceSweepConditionIndex: sourceState.sweep?.conditionIndex ?? null,
          provenance: "2d-teaching-cfd",
        });
      }
    } catch (error) {
      if (!stopped && tickGeneration === generation) {
        failed = true;
        labStore.setState({
          flowStatus: "failed",
          flowError: errorMessage(error),
        });
      }
    } finally {
      if (tickGeneration === generation) {
        pending = false;
      }
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, FRAME_INTERVAL_MS);

  return {
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      generation += 1;
      clearInterval(timer);
    },
    restart() {
      if (stopped) {
        return Promise.reject(new Error("Flow runtime is stopped"));
      }
      if (restartPromise !== null) return restartPromise;

      restarting = true;
      const restartGeneration = generation + 1;
      generation = restartGeneration;
      failed = false;
      recoveryUsed = false;
      velocityScale = 1;
      rebuildReason = "manual-restart";
      labStore.setState({ flowError: null });
      restartPromise = (async () => {
        try {
          await client.restart();
        } catch (error) {
          if (!stopped && restartGeneration === generation) {
            failed = true;
            labStore.setState({
              flowStatus: "failed",
              flowError: errorMessage(error),
            });
          }
          throw error;
        } finally {
          if (restartGeneration === generation) {
            pending = false;
            restarting = false;
          }
          restartPromise = null;
        }
      })();
      return restartPromise;
    },
  };
}

function isNumericalInstability(error: unknown): boolean {
  return error instanceof FlowWorkerError && error.code === "NON_FINITE_FIELD"
    || (typeof error === "object" && error !== null && "code" in error
      && error.code === "NON_FINITE_FIELD");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown flow worker failure";
}
