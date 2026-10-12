import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import { App, type AppFlowClient } from "./App";
import { labStore } from "./features/experiment/labStore";
import type { TelemetryFrame, TelemetrySource } from "./features/experiment/model";
import { startSimulationRuntime } from "./features/experiment/simulationRuntime";
import type { FlowFieldFrame } from "./features/flow/types";

beforeEach(() => labStore.getState().resetLab());
afterEach(() => vi.useRealTimers());

function telemetry(sequence: number): TelemetryFrame {
  return {
    sequence,
    simulationTimeMs: (sequence + 1) * 50,
    phase: "ramping",
    fanPowerPct: 30,
    rpm: 1_800 + sequence,
    windSpeedMps: 3.5,
    underbodyPressurePa: -5,
    verticalLoadN: 0.05,
    quality: "transient",
    provenance: "simulated",
  };
}

it("starts a virtual run and keeps provenance visible", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "启动实验" }));

  expect(screen.getByText(/升速中/)).toBeInTheDocument();
  expect(screen.getAllByText(/SIMULATED/).length).toBeGreaterThanOrEqual(4);
  expect(screen.getAllByText(/二维教学近似/).length).toBeGreaterThanOrEqual(1);
});

it("offers a real answer action for the flow-field lesson", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "自由实验" }));
  await user.click(screen.getByRole("button", { name: /第 4 章.*观察 CFD 场/ }));

  expect(screen.getByRole("group", { name: "流场判断题" })).toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: /二维中心截面/ }));
  expect(screen.getByText("回答正确，二维教学场用于观察趋势。"))
    .toBeInTheDocument();
});

it("owns exactly one simulation and flow runtime and releases every owner on unmount", () => {
  vi.useFakeTimers();
  let sequence = 0;
  const source: TelemetrySource = {
    setFanPower: vi.fn(),
    setPhase: vi.fn(),
    step: vi.fn(() => telemetry(sequence++)),
    reset: vi.fn(() => telemetry(-1)),
  };
  const simulationSourceFactory = vi.fn(() => source);
  const stopSimulation = vi.fn();
  const simulationRuntimeFactory = vi.fn((options: Parameters<typeof startSimulationRuntime>[0]) => {
    const stop = startSimulationRuntime(options);
    return () => {
      stop();
      stopSimulation();
    };
  });
  const flowClient = {
    ready: vi.fn(async () => undefined),
    requestFrame: vi.fn<(inletVelocity: number, iterations?: number) => Promise<FlowFieldFrame>>(
      () => new Promise<FlowFieldFrame>(() => undefined),
    ),
    getSolverIdentity: vi.fn(() => ({ generation: 1, width: 2, height: 1, tau: 0.62 })),
    restart: vi.fn(async () => undefined),
    dispose: vi.fn(),
  } satisfies AppFlowClient;
  const stopFlow = vi.fn();
  const flowRuntimeFactory = vi.fn(() => ({ stop: stopFlow, restart: flowClient.restart }));

  const { unmount } = render(<App
    simulationSourceFactory={simulationSourceFactory}
    simulationRuntimeFactory={simulationRuntimeFactory}
    flowClientFactory={() => flowClient}
    flowRuntimeFactory={flowRuntimeFactory}
  />);
  fireEvent.click(screen.getByRole("button", { name: "启动实验" }));
  act(() => vi.advanceTimersByTime(50));

  expect(simulationSourceFactory).toHaveBeenCalledOnce();
  expect(simulationRuntimeFactory).toHaveBeenCalledOnce();
  expect(flowRuntimeFactory).toHaveBeenCalledOnce();
  expect(labStore.getState().history).toHaveLength(1);
  expect(labStore.getState().telemetry.simulationTimeMs).toBe(50);

  unmount();
  expect(stopSimulation).toHaveBeenCalledOnce();
  expect(stopFlow).toHaveBeenCalledOnce();
  expect(flowClient.dispose).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("clears consecutive-stability evidence on frame-between commands and reset before telemetry changes", async () => {
  const user = userEvent.setup();
  const flowClient = {
    ready: vi.fn(async () => undefined),
    requestFrame: vi.fn<(inletVelocity: number, iterations?: number) => Promise<FlowFieldFrame>>(
      () => new Promise<FlowFieldFrame>(() => undefined),
    ),
    getSolverIdentity: vi.fn(() => ({ generation: 1, width: 2, height: 1, tau: 0.62 })),
    restart: vi.fn(async () => undefined),
    dispose: vi.fn(),
  } satisfies AppFlowClient;
  render(<App
    simulationRuntimeFactory={() => () => undefined}
    flowClientFactory={() => flowClient}
    flowRuntimeFactory={() => ({ stop: () => undefined, restart: flowClient.restart })}
  />);

  await user.click(screen.getByRole("button", { name: "自由实验" }));
  await user.click(screen.getByRole("button", { name: /第 2 章.*启动虚拟风扇/ }));
  act(() => {
    labStore.getState().setFanPower(30);
    labStore.getState().startRun();
    labStore.getState().acceptFrame({ ...telemetry(0), simulationTimeMs: 50, quality: "stable" });
    labStore.getState().acceptFrame({ ...telemetry(1), simulationTimeMs: 1_050, quality: "stable" });
    labStore.getState().acceptFrame({ ...telemetry(2), simulationTimeMs: 2_050, quality: "stable" });
  });
  await user.click(screen.getByRole("button", { name: "教学模式" }));
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeEnabled();

  act(() => {
    labStore.getState().setFanPower(31);
    labStore.getState().setFanPower(30);
  });
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeDisabled();

  act(() => {
    labStore.getState().acceptFrame({ ...telemetry(3), simulationTimeMs: 3_050, quality: "stable" });
    labStore.getState().acceptFrame({ ...telemetry(4), simulationTimeMs: 4_050, quality: "stable" });
    labStore.getState().acceptFrame({ ...telemetry(5), simulationTimeMs: 5_050, quality: "stable" });
  });
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeEnabled();

  act(() => {
    labStore.getState().advancePhase();
    labStore.getState().advancePhase();
    labStore.getState().advancePhase();
    labStore.getState().startRun();
    labStore.getState().acceptFrame({ ...telemetry(6), simulationTimeMs: 6_050, quality: "stable" });
    labStore.getState().acceptFrame({ ...telemetry(7), simulationTimeMs: 7_050, quality: "stable" });
  });
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeDisabled();

  act(() => {
    labStore.getState().resetLab();
    labStore.getState().startRun();
  });
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeDisabled();
});
