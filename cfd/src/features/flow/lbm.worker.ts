/// <reference lib="webworker" />

import { LbmSolver, NumericalInstabilityError } from "./lbmSolver";
import { createCarProfileMask } from "./obstacleMask";
import type { WorkerRequest, WorkerResponse } from "./LbmWorkerClient";
import type { FlowFieldFrame } from "./types";

type PostWorkerResponse = (response: WorkerResponse, transfer?: Transferable[]) => void;

export function createLbmWorkerMessageHandler(postResponse: PostWorkerResponse) {
  let solver: LbmSolver | null = null;
  let disposed = false;

  return (request: WorkerRequest): void => {
    if (disposed) {
      return;
    }

    if (request.type === "dispose") {
      disposed = true;
      solver = null;
      return;
    }

    if (request.type === "init") {
      try {
        const { width, height } = request.config;
        solver = new LbmSolver({
          ...request.config,
          obstacleMask: createCarProfileMask(width, height),
        });
        postResponse({ type: "ready" });
      } catch (error) {
        postFailure(postResponse, error);
      }
      return;
    }

    if (solver === null) {
      postResponse({
        type: "error",
        requestId: request.requestId,
        code: "WORKER_FAILURE",
        message: "Flow worker has not been initialized",
      });
      return;
    }

    try {
      solver.setInletVelocity(request.inletVelocity);
      const outboundFrame = copyFrameForTransfer(solver.step(request.iterations));
      const transfer = frameTransferList(outboundFrame);
      postResponse({
        type: "frame",
        requestId: request.requestId,
        frame: outboundFrame,
      }, transfer);
    } catch (error) {
      postFailure(postResponse, error, request.requestId);
    }
  };
}

function copyFrameForTransfer(frame: FlowFieldFrame): FlowFieldFrame {
  return {
    width: frame.width,
    height: frame.height,
    speed: frame.speed.slice(),
    pressure: frame.pressure.slice(),
    vorticity: frame.vorticity.slice(),
    velocityX: frame.velocityX.slice(),
    velocityY: frame.velocityY.slice(),
    provenance: "2d-teaching-cfd",
  };
}

function frameTransferList(frame: FlowFieldFrame): Transferable[] {
  return [
    frame.speed.buffer,
    frame.pressure.buffer,
    frame.vorticity.buffer,
    frame.velocityX.buffer,
    frame.velocityY.buffer,
  ];
}

function postFailure(
  postResponse: PostWorkerResponse,
  error: unknown,
  requestId?: number,
): void {
  const numericalFailure = error instanceof NumericalInstabilityError
    || (typeof error === "object" && error !== null && "code" in error
      && error.code === "NON_FINITE_FIELD");
  const message = error instanceof Error ? error.message : "Unknown flow worker failure";
  postResponse({
    type: "error",
    ...(requestId === undefined ? {} : { requestId }),
    code: numericalFailure ? "NON_FINITE_FIELD" : "WORKER_FAILURE",
    message,
  });
}

const workerScope = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope
  ? self as DedicatedWorkerGlobalScope
  : null;

if (workerScope !== null) {
  const handleMessage = createLbmWorkerMessageHandler((response, transfer = []) => {
    workerScope.postMessage(response, transfer);
  });
  workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
    handleMessage(event.data);
  };
}
