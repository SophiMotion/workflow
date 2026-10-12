import InlineLbmWorker from "./lbm.worker.ts?worker&inline";
import type { FlowFieldFrame, LbmConfig, SolverIdentity } from "./types";

export type WorkerRequest =
  | { type: "init"; config: Omit<LbmConfig, "obstacleMask"> }
  | { type: "frame"; requestId: number; inletVelocity: number; iterations: number }
  | { type: "dispose" };

export type WorkerErrorCode = "NON_FINITE_FIELD" | "WORKER_FAILURE";

export type WorkerResponse =
  | { type: "ready" }
  | { type: "frame"; requestId: number; frame: FlowFieldFrame }
  | { type: "error"; requestId?: number; code: WorkerErrorCode; message: string };

export interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

type PendingFrame = Deferred<FlowFieldFrame> & {
  timeout: ReturnType<typeof setTimeout>;
};

const REQUEST_TIMEOUT_MS = 1_500;

export class FlowWorkerError extends Error {
  constructor(
    readonly code: WorkerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FlowWorkerError";
  }
}

export const createLbmWorker = (): WorkerLike => new InlineLbmWorker();

export class LbmWorkerClient {
  private worker: WorkerLike | null = null;
  private generation = 0;
  private nextRequestId = 1;
  private readyDeferred!: Deferred<void>;
  private readonly pendingFrames = new Map<number, PendingFrame>();
  private state: "starting" | "ready" | "failed" | "disposed" = "starting";
  private failure: Error | null = null;

  constructor(
    private readonly workerFactory: () => WorkerLike,
    private readonly config: Omit<LbmConfig, "obstacleMask">,
  ) {
    this.spawnWorker();
  }

  ready(): Promise<void> {
    if (this.state === "disposed") {
      return Promise.reject(new Error("Flow worker client is disposed"));
    }
    return this.readyDeferred.promise;
  }

  getSolverIdentity(): SolverIdentity {
    return {
      generation: this.generation,
      width: this.config.width,
      height: this.config.height,
      tau: this.config.tau,
    };
  }

  requestFrame(inletVelocity: number, iterations = 4): Promise<FlowFieldFrame> {
    if (this.state === "disposed") {
      return Promise.reject(new Error("Flow worker client is disposed"));
    }

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const deferred = createDeferred<FlowFieldFrame>();
    const timeout = setTimeout(() => {
      if (this.pendingFrames.delete(requestId)) {
        deferred.reject(new Error("Flow worker timed out"));
      }
    }, REQUEST_TIMEOUT_MS);
    this.pendingFrames.set(requestId, { ...deferred, timeout });
    void this.postFrameWhenReady(requestId, inletVelocity, iterations);
    return deferred.promise;
  }

  restart(): Promise<void> {
    if (this.state === "disposed") {
      return Promise.reject(new Error("Flow worker client is disposed"));
    }

    const restartError = new Error("Flow worker restarted");
    this.readyDeferred.reject(restartError);
    this.rejectPending(restartError);
    this.detachAndTerminateWorker(this.worker);
    this.spawnWorker();
    return this.ready();
  }

  dispose(): void {
    if (this.state === "disposed") {
      return;
    }

    const disposedError = new Error("Flow worker client is disposed");
    this.state = "disposed";
    this.generation += 1;
    this.readyDeferred.reject(disposedError);
    this.rejectPending(disposedError);
    const worker = this.worker;
    if (worker !== null) {
      try {
        worker.postMessage({ type: "dispose" });
      } catch {
        // Disposal still owns listener and worker cleanup if posting fails.
      }
      this.detachAndTerminateWorker(worker);
    }
  }

  private spawnWorker(): void {
    this.state = "starting";
    this.failure = null;
    this.readyDeferred = createDeferred<void>();
    const generation = this.generation + 1;
    this.generation = generation;
    let worker: WorkerLike | null = null;

    try {
      worker = this.workerFactory();
      this.worker = worker;
      worker.onmessage = (event) => {
        if (generation !== this.generation || worker !== this.worker) {
          return;
        }
        this.handleMessage(event.data);
      };
      worker.onerror = (event) => {
        if (generation !== this.generation || worker !== this.worker) {
          return;
        }
        this.fail(new FlowWorkerError(
          "WORKER_FAILURE",
          event.message || "Flow worker failed",
        ));
      };
      worker.postMessage({ type: "init", config: { ...this.config } });
    } catch (error) {
      this.detachAndTerminateWorker(worker);
      this.fail(asWorkerFailure(error));
    }
  }

  private async postFrameWhenReady(
    requestId: number,
    inletVelocity: number,
    iterations: number,
  ): Promise<void> {
    try {
      await this.ready();
      if (!this.pendingFrames.has(requestId)) {
        return;
      }
      if (this.state === "failed") {
        throw this.failure ?? new FlowWorkerError("WORKER_FAILURE", "Flow worker failed");
      }
      const worker = this.worker;
      if (worker === null) {
        throw new FlowWorkerError("WORKER_FAILURE", "Flow worker is unavailable");
      }
      worker.postMessage({
        type: "frame",
        requestId,
        inletVelocity,
        iterations,
      });
    } catch (error) {
      if (!this.pendingFrames.has(requestId)) {
        return;
      }
      const failure = error instanceof Error ? error : asWorkerFailure(error);
      if (this.state === "ready") {
        this.detachAndTerminateWorker(this.worker);
        this.fail(asWorkerFailure(failure));
      } else {
        this.rejectFrame(requestId, failure);
      }
    }
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === "ready") {
      if (this.state === "starting") {
        this.state = "ready";
        this.readyDeferred.resolve(undefined);
      }
      return;
    }

    if (message.type === "error") {
      this.fail(new FlowWorkerError(message.code, message.message));
      return;
    }

    const pending = this.pendingFrames.get(message.requestId);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingFrames.delete(message.requestId);
    pending.resolve(message.frame);
  }

  private fail(error: Error): void {
    this.state = "failed";
    this.failure = error;
    this.readyDeferred.reject(error);
    this.rejectPending(error);
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pendingFrames.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingFrames.clear();
  }

  private rejectFrame(requestId: number, error: Error): void {
    const pending = this.pendingFrames.get(requestId);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pendingFrames.delete(requestId);
    pending.reject(error);
  }

  private detachAndTerminateWorker(worker: WorkerLike | null): void {
    if (worker === null) {
      return;
    }
    worker.onmessage = null;
    worker.onerror = null;
    try {
      worker.terminate();
    } catch {
      // Listener detachment and failed state still prevent reuse if termination throws.
    }
    if (this.worker === worker) {
      this.worker = null;
    }
  }
}

function asWorkerFailure(error: unknown): FlowWorkerError {
  if (error instanceof FlowWorkerError) {
    return error;
  }
  return new FlowWorkerError(
    "WORKER_FAILURE",
    error instanceof Error ? error.message : "Unknown flow worker failure",
  );
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  // Lifecycle cleanup may reject readiness before an external consumer awaits it.
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}
