import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import { App, type AppFlowClient } from "./App";
import { labStore } from "./features/experiment/labStore";
import type { FlowFieldFrame } from "./features/flow/types";
import type { QualityProfile } from "./features/shell/quality";

beforeEach(() => labStore.getState().resetLab());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function createFakeFlowClient() {
  return {
    ready: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    requestFrame: vi.fn<(inletVelocity: number, iterations?: number) => Promise<FlowFieldFrame>>(
      () => new Promise<FlowFieldFrame>(() => undefined),
    ),
    getSolverIdentity: vi.fn(() => ({ generation: 1, width: 2, height: 1, tau: 0.62 })),
    restart: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    dispose: vi.fn<() => void>(),
  } satisfies AppFlowClient;
}

it("renders the five digital wind-tunnel workbench regions", () => {
  render(<App />);
  expect(screen.getByRole("banner")).toHaveTextContent("SophiFlow Lab");
  expect(screen.getByRole("navigation", { name: "教学章节" })).toBeInTheDocument();
  expect(screen.getByRole("main", { name: "数字风洞" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "实验控制" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "实验曲线" })).toBeInTheDocument();
});

it("identifies the CFD model as a two-dimensional teaching approximation", () => {
  render(<App />);
  expect(screen.getAllByText("2D TEACHING CFD / 二维教学近似")).toHaveLength(2);
});

it("keeps live announcements limited to phase and fault changes", async () => {
  const client = createFakeFlowClient();
  const { container } = render(<App flowClientFactory={() => client} />);
  await screen.findByRole("heading", { name: "实验曲线" });
  await screen.findByRole("button", { name: /straightener：整流段/ });

  const liveRegions = Array.from(container.querySelectorAll("[aria-live], [role='status']"));
  expect(liveRegions).toEqual([screen.getByText("待机 / IDLE")]);
});

it("advances freely without evidence and restores the chosen lesson in guided mode", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "自由实验" }));
  await user.click(screen.getByRole("button", { name: "进入下一章" }));
  expect(screen.getByRole("heading", { name: "第 2 章：启动虚拟风扇" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "教学模式" }));
  expect(screen.getByRole("heading", { name: "第 2 章：启动虚拟风扇" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /第 1 章.*认识风洞/ })).toHaveClass("lesson-available");
});

it("does not join tutorial stability evidence across pause and resume", async () => {
  const user = userEvent.setup();
  const flowRuntime = {
    stop: vi.fn(),
    restart: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
  render(<App
    flowClientFactory={() => createFakeFlowClient()}
    flowRuntimeFactory={() => flowRuntime}
    simulationRuntimeFactory={() => vi.fn()}
  />);

  await user.click(screen.getByRole("button", { name: "自由实验" }));
  await user.click(screen.getByRole("button", { name: "进入下一章" }));
  await user.click(screen.getByRole("button", { name: "教学模式" }));
  const advance = screen.getByRole("button", { name: "进入下一章" });

  act(() => {
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    const baseline = labStore.getState().telemetry;
    labStore.getState().acceptFrame({
      ...baseline,
      sequence: 1,
      simulationTimeMs: 1_000,
      phase: "stabilizing",
      fanPowerPct: 30,
      quality: "stable",
    });
    labStore.getState().acceptFrame({
      ...baseline,
      sequence: 2,
      simulationTimeMs: 2_000,
      phase: "stabilizing",
      fanPowerPct: 30,
      quality: "stable",
    });
  });
  expect(advance).toBeDisabled();

  act(() => {
    labStore.getState().pauseRun();
    labStore.getState().resumeRun();
    labStore.getState().acceptFrame({
      ...labStore.getState().telemetry,
      sequence: 3,
      simulationTimeMs: 3_000,
      phase: "stabilizing",
      fanPowerPct: 30,
      quality: "stable",
    });
  });
  expect(advance).toBeDisabled();

  act(() => {
    labStore.getState().acceptFrame({
      ...labStore.getState().telemetry,
      sequence: 4,
      simulationTimeMs: 4_000,
      phase: "stabilizing",
      fanPowerPct: 30,
      quality: "stable",
    });
  });
  expect(advance).toBeDisabled();

  act(() => {
    labStore.getState().acceptFrame({
      ...labStore.getState().telemetry,
      sequence: 5,
      simulationTimeMs: 5_000,
      phase: "stabilizing",
      fanPowerPct: 30,
      quality: "stable",
    });
  });
  expect(advance).toBeEnabled();
});

it("assembles the automatic sweep report and starts the fixed sequence", async () => {
  const user = userEvent.setup();
  labStore.getState().resetLab();
  render(<App />);

  expect(screen.getByRole("heading", { name: "三工况实验报告" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "开始自动扫频" }));
  expect(labStore.getState().fanPowerPct).toBe(30);
  expect(["ramping", "stabilizing"]).toContain(labStore.getState().phase);
  expect(labStore.getState().sweep?.commandedPowerPct).toBe(30);
});

it("wires the flow failure recovery button to the mounted runtime", async () => {
  const user = userEvent.setup();
  const client = createFakeFlowClient();
  render(<App flowClientFactory={() => client} />);
  act(() => labStore.setState({ flowStatus: "failed", flowError: "worker stopped" }));

  await user.click(screen.getByRole("button", { name: "重新启动求解器" }));
  expect(client.restart).toHaveBeenCalledOnce();
});

it("rebuilds the worker for a new grid without clearing telemetry, tutorial, or the last field", async () => {
  const user = userEvent.setup();
  const width = vi.spyOn(window, "innerWidth", "get").mockReturnValue(1_024);
  vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(12);
  const clients: ReturnType<typeof createFakeFlowClient>[] = [];
  const factory = vi.fn((profile: QualityProfile) => {
    void profile;
    const client = createFakeFlowClient();
    clients.push(client);
    return client;
  });
  render(<App flowClientFactory={factory} />);
  await user.click(screen.getByRole("button", { name: "自由实验" }));
  await user.click(screen.getByRole("button", { name: "进入下一章" }));
  const telemetry = labStore.getState().telemetry;
  const lastField: FlowFieldFrame = {
    width: 240,
    height: 96,
    speed: new Float32Array(1),
    pressure: new Float32Array(1),
    vorticity: new Float32Array(1),
    velocityX: new Float32Array(1),
    velocityY: new Float32Array(1),
    provenance: "2d-teaching-cfd",
  };
  act(() => labStore.setState({ flowField: lastField }));

  width.mockReturnValue(1_440);
  act(() => window.dispatchEvent(new Event("resize")));

  await waitFor(() => expect(factory).toHaveBeenCalledTimes(2));
  expect(factory.mock.calls.map(([profile]) => profile.name)).toEqual(["medium", "high"]);
  expect(clients[0]!.dispose).toHaveBeenCalledOnce();
  expect(labStore.getState().telemetry).toBe(telemetry);
  expect(labStore.getState().flowField).toBe(lastField);
  expect(screen.getByRole("heading", { name: "第 2 章：启动虚拟风扇" })).toBeVisible();
});

it("downgrades timed-out HIGH and MEDIUM workers until LOW reaches a real field without clearing lab state", async () => {
  vi.useFakeTimers();
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(1_440);
  vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(12);
  const realFrame: FlowFieldFrame = {
    width: 240,
    height: 96,
    speed: new Float32Array([1]),
    pressure: new Float32Array([2]),
    vorticity: new Float32Array([3]),
    velocityX: new Float32Array([4]),
    velocityY: new Float32Array([5]),
    provenance: "2d-teaching-cfd",
  };
  const timedOut = {
    ...createFakeFlowClient(),
    requestFrame: vi.fn(async () => { throw new Error("Flow worker timed out"); }),
  };
  const mediumTimedOut = {
    ...createFakeFlowClient(),
    requestFrame: vi.fn(async () => { throw new Error("Flow worker timed out"); }),
  };
  const recovered = {
    ...createFakeFlowClient(),
    requestFrame: vi.fn(async () => realFrame),
  };
  const clients = [timedOut, mediumTimedOut, recovered];
  const factory = vi.fn((profile: QualityProfile) => {
    void profile;
    return clients.shift()!;
  });
  const telemetry = labStore.getState().telemetry;
  render(<App
    flowClientFactory={factory}
    simulationRuntimeFactory={() => vi.fn()}
  />);
  fireEvent.click(screen.getByRole("button", { name: "自由实验" }));
  fireEvent.click(screen.getByRole("button", { name: "进入下一章" }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
  });

  expect(factory.mock.calls.map(([profile]) => profile.name)).toEqual(["high", "medium", "low"]);
  expect(timedOut.dispose).toHaveBeenCalledOnce();
  expect(mediumTimedOut.dispose).toHaveBeenCalledOnce();
  expect(labStore.getState().flowStatus).toBe("ready");
  expect(labStore.getState().flowField).toBe(realFrame);
  expect(labStore.getState().flowMetadata?.rebuildReason).toBe("timeout-downgrade");
  expect(labStore.getState().telemetry).toBe(telemetry);
  expect(labStore.getState().eventLog).toEqual(expect.arrayContaining([
    expect.stringContaining("HIGH 超时"),
    expect.stringContaining("MEDIUM 超时"),
  ]));
  expect(screen.getByRole("heading", { name: "第 2 章：启动虚拟风扇" })).toBeVisible();
});
