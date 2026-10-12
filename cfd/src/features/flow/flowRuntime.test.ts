import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { labStore } from "../experiment/labStore";
import type { FlowFieldFrame } from "./types";
import { FlowWorkerError } from "./LbmWorkerClient";
import {
  mapWindToLatticeVelocity,
  startFlowRuntime,
  type FlowClientLike,
} from "./flowRuntime";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function frame(value: number): FlowFieldFrame {
  return {
    width: 2,
    height: 1,
    speed: new Float32Array([value, value]),
    pressure: new Float32Array(2),
    vorticity: new Float32Array(2),
    velocityX: new Float32Array(2),
    velocityY: new Float32Array(2),
    provenance: "2d-teaching-cfd",
  };
}

class FakeFlowClient implements FlowClientLike {
  readonly requests: Array<{ inletVelocity: number; iterations?: number }> = [];
  readonly pending: Array<ReturnType<typeof deferred<FlowFieldFrame>>> = [];
  restartCount = 0;
  restartPending: ReturnType<typeof deferred<void>> | null = null;

  requestFrame(inletVelocity: number, iterations?: number): Promise<FlowFieldFrame> {
    this.requests.push({ inletVelocity, iterations });
    const request = deferred<FlowFieldFrame>();
    this.pending.push(request);
    return request.promise;
  }

  restart(): Promise<void> {
    this.restartCount += 1;
    return this.restartPending?.promise ?? Promise.resolve();
  }

  getSolverIdentity() {
    return { generation: this.restartCount + 1, width: 2, height: 1, tau: 0.62 };
  }
}

async function flushRuntime(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("flowRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    labStore.getState().resetLab();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("maps real speed into the stable 2D teaching range", () => {
    expect(mapWindToLatticeVelocity(0)).toBe(0);
    expect(mapWindToLatticeVelocity(6)).toBeCloseTo(0.04, 5);
    expect(mapWindToLatticeVelocity(99)).toBe(0.08);
    expect(mapWindToLatticeVelocity(-2)).toBe(0);
  });

  it("requests at 10 Hz without overlapping pending frames", async () => {
    const client = new FakeFlowClient();
    const runtime = startFlowRuntime(client);

    await vi.advanceTimersByTimeAsync(100);
    expect(client.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(client.requests).toHaveLength(1);

    client.pending[0]!.resolve(frame(1));
    await flushRuntime();
    await vi.advanceTimersByTimeAsync(100);
    expect(client.requests).toHaveLength(2);
    runtime.stop();
  });

  it("skips hidden-document ticks and stores successful teaching frames", async () => {
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const client = new FakeFlowClient();
    const runtime = startFlowRuntime(client);

    await vi.advanceTimersByTimeAsync(300);
    expect(client.requests).toHaveLength(0);
    hidden.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(100);
    client.pending[0]!.resolve(frame(2));
    await flushRuntime();

    expect(labStore.getState()).toMatchObject({
      flowStatus: "ready",
      flowError: null,
      flowField: { provenance: "2d-teaching-cfd" },
      flowMetadata: {
        acceptedFrameId: 1,
        generation: 1,
        gridWidth: 2,
        gridHeight: 1,
        tau: 0.62,
        requestedInletVelocity: 0,
        actualInletVelocity: 0,
        velocityScale: 1,
        recovery: "none",
        rebuildReason: "initial",
      },
    });
    runtime.stop();
    hidden.mockRestore();
  });

  it("preserves the last frame, logs instability, reduces velocity, restarts once, and retries", async () => {
    const previousFrame = frame(7);
    labStore.setState((state) => ({
      ...state,
      flowField: previousFrame,
      telemetry: { ...state.telemetry, windSpeedMps: 6 },
    }));
    const client = new FakeFlowClient();
    const runtime = startFlowRuntime(client);

    await vi.advanceTimersByTimeAsync(100);
    client.pending[0]!.reject(new FlowWorkerError("NON_FINITE_FIELD", "unstable"));
    await flushRuntime();

    expect(client.restartCount).toBe(1);
    expect(client.requests.map(({ inletVelocity }) => inletVelocity)).toEqual([0.04, 0.032]);
    expect(labStore.getState().flowField).toBe(previousFrame);
    expect(labStore.getState().eventLog.at(-1)).toContain("二维教学 CFD");

    client.pending[1]!.resolve(frame(3));
    await flushRuntime();
    expect(labStore.getState()).toMatchObject({
      flowStatus: "ready",
      flowError: null,
      flowMetadata: {
        acceptedFrameId: 1,
        generation: 2,
        requestedInletVelocity: 0.04,
        actualInletVelocity: 0.032,
        velocityScale: 0.8,
        recovery: "non-finite-field-scale",
      },
    });
    runtime.stop();
  });

  it("fails without another restart when instability repeats", async () => {
    const client = new FakeFlowClient();
    const runtime = startFlowRuntime(client);

    await vi.advanceTimersByTimeAsync(100);
    client.pending[0]!.reject(new FlowWorkerError("NON_FINITE_FIELD", "first instability"));
    await flushRuntime();
    client.pending[1]!.reject(new FlowWorkerError("NON_FINITE_FIELD", "second instability"));
    await flushRuntime();

    expect(client.restartCount).toBe(1);
    expect(labStore.getState()).toMatchObject({
      flowStatus: "failed",
      flowError: "second instability",
    });
    runtime.stop();
  });

  it("records other failures and manual restart clears only flow failure state", async () => {
    const previousFrame = frame(5);
    const previousTelemetry = labStore.getState().telemetry;
    labStore.setState({ flowField: previousFrame });
    const client = new FakeFlowClient();
    const runtime = startFlowRuntime(client);

    await vi.advanceTimersByTimeAsync(100);
    client.pending[0]!.reject(new Error("network worker failure"));
    await flushRuntime();
    expect(labStore.getState()).toMatchObject({
      flowStatus: "failed",
      flowError: "network worker failure",
    });

    await runtime.restart();
    expect(client.restartCount).toBe(1);
    expect(labStore.getState().flowError).toBeNull();
    expect(labStore.getState().flowStatus).toBe("failed");
    expect(labStore.getState().flowField).toBe(previousFrame);
    expect(labStore.getState().telemetry).toBe(previousTelemetry);

    await vi.advanceTimersByTimeAsync(100);
    expect(client.requests).toHaveLength(2);
    runtime.stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(client.requests).toHaveLength(2);
  });

  it("does not request during restart or overlap the first post-restart frame", async () => {
    const client = new FakeFlowClient();
    client.restartPending = deferred<void>();
    const runtime = startFlowRuntime(client);

    const restarting = runtime.restart();
    await vi.advanceTimersByTimeAsync(250);
    expect(client.requests).toHaveLength(0);

    client.restartPending.resolve(undefined);
    await restarting;
    await vi.advanceTimersByTimeAsync(100);
    expect(client.requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(400);
    expect(client.requests).toHaveLength(1);
    runtime.stop();
  });

  it("coalesces rapid duplicate recovery and allows a clean retry after rejection", async () => {
    const firstRestart = deferred<void>();
    const retryRestart = deferred<void>();
    const restartQueue = [firstRestart, retryRestart];
    const client = new FakeFlowClient();
    vi.spyOn(client, "restart").mockImplementation(() => {
      client.restartCount += 1;
      return restartQueue.shift()!.promise;
    });
    const runtime = startFlowRuntime(client);

    const first = runtime.restart();
    const duplicate = runtime.restart();
    expect(client.restartCount).toBe(1);

    firstRestart.reject(new Error("old recovery failed"));
    await expect(first).rejects.toThrow("old recovery failed");
    await expect(duplicate).rejects.toThrow("old recovery failed");

    const retry = runtime.restart();
    expect(client.restartCount).toBe(2);
    retryRestart.resolve(undefined);
    await retry;

    await vi.advanceTimersByTimeAsync(100);
    client.pending[0]!.resolve(frame(9));
    await flushRuntime();
    expect(labStore.getState()).toMatchObject({ flowStatus: "ready", flowError: null });
    runtime.stop();
  });
});
