import { afterEach, describe, expect, it, vi } from "vitest";
import { createLbmWorkerMessageHandler } from "./lbm.worker";
import {
  FlowWorkerError,
  LbmWorkerClient,
  type WorkerLike,
  type WorkerRequest,
  type WorkerResponse,
} from "./LbmWorkerClient";

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: WorkerRequest[] = [];
  terminated = false;

  postMessage(message: WorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: WorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
}

class InitThrowWorker extends FakeWorker {
  override postMessage(message: WorkerRequest): void {
    if (message.type === "init") {
      throw new Error("init post failed");
    }
    super.postMessage(message);
  }
}

function frame(value = 0) {
  return {
    width: 2,
    height: 1,
    speed: new Float32Array([value, value]),
    pressure: new Float32Array(2),
    vorticity: new Float32Array(2),
    velocityX: new Float32Array(2),
    velocityY: new Float32Array(2),
    provenance: "2d-teaching-cfd" as const,
  };
}

describe("LbmWorkerClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes immediately, then resolves one default four-iteration frame request", async () => {
    const worker = new FakeWorker();
    const client = new LbmWorkerClient(() => worker, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });

    expect(worker.posted).toEqual([{
      type: "init",
      config: { width: 2, height: 1, inletVelocity: 0, tau: 0.62 },
    }]);

    const ready = client.ready();
    worker.emit({ type: "ready" });
    await ready;
    expect(client.getSolverIdentity()).toEqual({ generation: 1, width: 2, height: 1, tau: 0.62 });
    const pending = client.requestFrame(0.04);
    await Promise.resolve();

    expect(worker.posted.at(-1)).toEqual({
      type: "frame",
      requestId: 1,
      inletVelocity: 0.04,
      iterations: 4,
    });

    worker.emit({ type: "frame", requestId: 1, frame: frame() });
    await expect(pending).resolves.toMatchObject({ width: 2, provenance: "2d-teaching-cfd" });
    client.dispose();
  });

  it("rejects pending work, removes listeners, and terminates when disposed", async () => {
    const worker = new FakeWorker();
    const client = new LbmWorkerClient(() => worker, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });
    worker.emit({ type: "ready" });
    await client.ready();
    const pending = client.requestFrame(0.04);
    await Promise.resolve();

    client.dispose();

    await expect(pending).rejects.toThrow("disposed");
    expect(worker.posted.at(-1)).toEqual({ type: "dispose" });
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });

  it("terminates and replaces a failed worker while ignoring stale-generation messages", async () => {
    const workers: [FakeWorker, FakeWorker] = [new FakeWorker(), new FakeWorker()];
    let factoryIndex = 0;
    const client = new LbmWorkerClient(() => workers[factoryIndex++]!, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });
    workers[0].emit({ type: "ready" });
    await client.ready();

    const oldMessageListener = workers[0].onmessage!;
    const interrupted = client.requestFrame(0.04);
    await Promise.resolve();
    const restarted = client.restart();
    await expect(interrupted).rejects.toThrow("restarted");

    expect(workers[0].terminated).toBe(true);
    expect(workers[1].posted[0]).toEqual(workers[0].posted[0]);
    oldMessageListener({ data: { type: "ready" } } as MessageEvent<WorkerResponse>);
    workers[1].emit({ type: "ready" });
    await restarted;
    expect(client.getSolverIdentity()).toEqual({ generation: 2, width: 2, height: 1, tau: 0.62 });

    const next = client.requestFrame(0.03);
    await Promise.resolve();
    oldMessageListener({
      data: { type: "frame", requestId: 2, frame: frame(99) },
    } as MessageEvent<WorkerResponse>);
    workers[1].emit({ type: "frame", requestId: 2, frame: frame(3) });

    await expect(next).resolves.toMatchObject({ speed: new Float32Array([3, 3]) });
    client.dispose();
  });

  it("rejects all pending requests on a worker error and can restart afterward", async () => {
    const workers: [FakeWorker, FakeWorker] = [new FakeWorker(), new FakeWorker()];
    let factoryIndex = 0;
    const client = new LbmWorkerClient(() => workers[factoryIndex++]!, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });
    workers[0].emit({ type: "ready" });
    await client.ready();
    const first = client.requestFrame(0.02);
    const second = client.requestFrame(0.03);
    await Promise.resolve();

    workers[0].onerror?.({ message: "worker crashed" } as ErrorEvent);

    await expect(first).rejects.toThrow("worker crashed");
    await expect(second).rejects.toThrow("worker crashed");
    await expect(client.requestFrame(0.04)).rejects.toThrow("worker crashed");
    const restarted = client.restart();
    workers[1].emit({ type: "ready" });
    await restarted;
    client.dispose();
  });

  it("preserves protocol error codes for runtime recovery", async () => {
    const worker = new FakeWorker();
    const client = new LbmWorkerClient(() => worker, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });
    worker.emit({ type: "ready" });
    await client.ready();
    const pending = client.requestFrame(0.04);
    await Promise.resolve();
    worker.emit({
      type: "error",
      requestId: 1,
      code: "NON_FINITE_FIELD",
      message: "unstable",
    });

    await expect(pending).rejects.toMatchObject({
      name: "FlowWorkerError",
      code: "NON_FINITE_FIELD",
      message: "unstable",
    } satisfies Partial<FlowWorkerError>);
    client.dispose();
  });

  it("times out a request after 1,500 ms", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const client = new LbmWorkerClient(() => worker, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });
    worker.emit({ type: "ready" });
    await client.ready();
    const pending = client.requestFrame(0.04);
    await Promise.resolve();

    const assertion = expect(pending).rejects.toThrow("Flow worker timed out");
    await vi.advanceTimersByTimeAsync(1_500);
    await assertion;
    client.dispose();
  });

  it("applies the 1,500 ms deadline while waiting for ready", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const client = new LbmWorkerClient(() => worker, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });
    const pending = client.requestFrame(0.04);
    let rejection: unknown;
    void pending.catch((error: unknown) => {
      rejection = error;
    });

    await vi.advanceTimersByTimeAsync(1_499);
    expect(rejection).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    expect(rejection).toMatchObject({ message: "Flow worker timed out" });
    expect(worker.posted).toEqual([{
      type: "init",
      config: { width: 2, height: 1, inletVelocity: 0, tau: 0.62 },
    }]);
    client.dispose();
  });

  it("turns a synchronous worker factory exception into a failed client", async () => {
    let client: LbmWorkerClient | undefined;
    const replacement = new FakeWorker();
    let factoryAttempts = 0;

    expect(() => {
      client = new LbmWorkerClient(() => {
        factoryAttempts += 1;
        if (factoryAttempts === 1) {
          throw new Error("factory failed");
        }
        return replacement;
      }, {
        width: 2,
        height: 1,
        inletVelocity: 0,
        tau: 0.62,
      });
    }).not.toThrow();

    await expect(client!.ready()).rejects.toThrow("factory failed");
    await expect(client!.requestFrame(0.04)).rejects.toThrow("factory failed");
    const restarted = client!.restart();
    replacement.emit({ type: "ready" });
    await restarted;
    client!.dispose();
  });

  it("cleans up a replacement whose init post throws synchronously", async () => {
    const firstWorker = new FakeWorker();
    const replacement = new InitThrowWorker();
    const workers: [FakeWorker, FakeWorker] = [firstWorker, replacement];
    let factoryIndex = 0;
    const client = new LbmWorkerClient(() => workers[factoryIndex++]!, {
      width: 2,
      height: 1,
      inletVelocity: 0,
      tau: 0.62,
    });
    firstWorker.emit({ type: "ready" });
    await client.ready();

    const restarted = client.restart();

    await expect(restarted).rejects.toThrow("init post failed");
    await expect(client.ready()).rejects.toThrow("init post failed");
    expect(replacement.terminated).toBe(true);
    expect(replacement.onmessage).toBeNull();
    expect(replacement.onerror).toBeNull();
    client.dispose();
  });

  it("clears request deadlines on resolve, error, restart, and dispose", async () => {
    vi.useFakeTimers();

    const resolvedWorker = new FakeWorker();
    const resolvedClient = new LbmWorkerClient(() => resolvedWorker, {
      width: 2, height: 1, inletVelocity: 0, tau: 0.62,
    });
    resolvedWorker.emit({ type: "ready" });
    const resolved = resolvedClient.requestFrame(0.01);
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
    resolvedWorker.emit({ type: "frame", requestId: 1, frame: frame() });
    await resolved;
    expect(vi.getTimerCount()).toBe(0);
    resolvedClient.dispose();

    const erroredWorker = new FakeWorker();
    const erroredClient = new LbmWorkerClient(() => erroredWorker, {
      width: 2, height: 1, inletVelocity: 0, tau: 0.62,
    });
    erroredWorker.emit({ type: "ready" });
    const errored = erroredClient.requestFrame(0.02);
    await Promise.resolve();
    erroredWorker.emit({
      type: "error", requestId: 1, code: "WORKER_FAILURE", message: "failed",
    });
    await expect(errored).rejects.toThrow("failed");
    expect(vi.getTimerCount()).toBe(0);
    erroredClient.dispose();

    const restartWorkers: [FakeWorker, FakeWorker] = [new FakeWorker(), new FakeWorker()];
    let restartFactoryIndex = 0;
    const restartedClient = new LbmWorkerClient(() => restartWorkers[restartFactoryIndex++]!, {
      width: 2, height: 1, inletVelocity: 0, tau: 0.62,
    });
    restartWorkers[0].emit({ type: "ready" });
    const interrupted = restartedClient.requestFrame(0.03);
    await Promise.resolve();
    const restartReady = restartedClient.restart();
    await expect(interrupted).rejects.toThrow("restarted");
    expect(vi.getTimerCount()).toBe(0);
    restartWorkers[1].emit({ type: "ready" });
    await restartReady;
    restartedClient.dispose();

    const disposedWorker = new FakeWorker();
    const disposedClient = new LbmWorkerClient(() => disposedWorker, {
      width: 2, height: 1, inletVelocity: 0, tau: 0.62,
    });
    disposedWorker.emit({ type: "ready" });
    const disposed = disposedClient.requestFrame(0.04);
    await Promise.resolve();
    disposedClient.dispose();
    await expect(disposed).rejects.toThrow("disposed");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("LBM worker protocol", () => {
  it("transfers five copied buffers and remains reusable after transfer detaches them", () => {
    const responses: WorkerResponse[] = [];
    const transferLists: Transferable[][] = [];
    const handleMessage = createLbmWorkerMessageHandler((response, transfer = []) => {
      transferLists.push(transfer);
      responses.push(structuredClone(response, { transfer }));
    });

    handleMessage({
      type: "init",
      config: { width: 20, height: 10, inletVelocity: 0.02, tau: 0.62 },
    });
    handleMessage({ type: "frame", requestId: 1, inletVelocity: 0.03, iterations: 4 });
    handleMessage({ type: "frame", requestId: 2, inletVelocity: 0.04, iterations: 4 });

    expect(responses.map((response) => response.type)).toEqual(["ready", "frame", "frame"]);
    expect(transferLists[1]).toHaveLength(5);
    expect(new Set(transferLists[1])).toHaveLength(5);
    expect(transferLists[2]).toHaveLength(5);
    expect(responses[1]).toMatchObject({
      type: "frame",
      requestId: 1,
      frame: { provenance: "2d-teaching-cfd" },
    });
    expect(responses[2]).toMatchObject({ type: "frame", requestId: 2 });
  });

  it("reports a typed numerical error instead of transferring an invalid field", () => {
    const responses: WorkerResponse[] = [];
    const handleMessage = createLbmWorkerMessageHandler((response) => {
      responses.push(response);
    });

    handleMessage({
      type: "init",
      config: { width: 1, height: 1, inletVelocity: 0.02, tau: 0.62 },
    });
    handleMessage({ type: "frame", requestId: 7, inletVelocity: 0.03, iterations: 4 });

    expect(responses.at(-1)).toMatchObject({
      type: "error",
      requestId: 7,
      code: "NON_FINITE_FIELD",
    });
  });
});
