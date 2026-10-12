import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { labStore } from "../experiment/labStore";
import type { TelemetryFrame } from "../experiment/model";
import type { FlowFieldFrame, FlowRuntimeMetadata } from "../flow/types";
import { ControlPanel } from "./ControlPanel";
import { FieldSelector } from "./FieldSelector";
import { HistoryChart } from "./HistoryChart";
import { TelemetryCards } from "./TelemetryCards";
import { mapHistoryToChartData } from "./historyMapping";
import {
  recordFieldInspection,
  recordSensorInspection,
  recordStableTelemetry,
  recordStableWindowInspection,
} from "./evidenceRecording";
import { emptyEvidence } from "../tutorial/tutorialProgress";
import { qualityProfile } from "../shell/quality";

function frame(overrides: Partial<TelemetryFrame> = {}): TelemetryFrame {
  return {
    sequence: 1,
    simulationTimeMs: 50,
    phase: "sampling",
    fanPowerPct: 30,
    rpm: 4380.4,
    windSpeedMps: 8.456,
    underbodyPressurePa: -32.44,
    verticalLoadN: 0.1849,
    quality: "stable",
    provenance: "simulated",
    ...overrides,
  };
}

function flowFrame(): FlowFieldFrame {
  return {
    width: 2,
    height: 1,
    speed: new Float32Array(2),
    pressure: new Float32Array(2),
    vorticity: new Float32Array(2),
    velocityX: new Float32Array(2),
    velocityY: new Float32Array(2),
    provenance: "2d-teaching-cfd",
  };
}

function acceptTestFlowFrame(overrides: Partial<Omit<FlowRuntimeMetadata, "acceptedFrameId">> = {}) {
  labStore.getState().acceptFlowFrame(flowFrame(), {
    generation: 1,
    gridWidth: 2,
    gridHeight: 1,
    tau: 0.62,
    requestedInletVelocity: 0.04,
    actualInletVelocity: 0.04,
    velocityScale: 1,
    recovery: "none",
    sourceTelemetrySequence: 1,
    sourceFanPowerPct: 30,
    sourceSweepRunRevision: labStore.getState().sweepRunRevision,
    sourceSweepConditionIndex: labStore.getState().sweep?.conditionIndex ?? null,
    provenance: "2d-teaching-cfd",
    ...overrides,
    rebuildReason: overrides.rebuildReason ?? "initial",
  });
}

beforeEach(() => labStore.getState().resetLab());

it("commands fan power and supports run, pause, resume, and reset", async () => {
  const user = userEvent.setup();
  const confirmReset = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<ControlPanel />);

  const slider = screen.getByRole("slider", { name: "风扇功率" });
  fireEvent.change(slider, { target: { value: "100" } });
  expect(labStore.getState().fanPowerPct).toBe(100);
  expect(screen.getByText("100%", { selector: "output" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "启动实验" }));
  expect(labStore.getState().phase).toBe("ramping");
  await user.click(screen.getByRole("button", { name: "暂停实验" }));
  expect(labStore.getState().phase).toBe("paused");
  await user.click(screen.getByRole("button", { name: "继续实验" }));
  expect(labStore.getState().phase).toBe("ramping");

  labStore.getState().acceptFrame(frame());
  await user.click(screen.getByRole("button", { name: "停止并重置" }));
  expect(confirmReset).toHaveBeenCalledOnce();
  expect(labStore.getState()).toMatchObject({ phase: "idle", history: [] });
  confirmReset.mockRestore();
});

it("gives the primary fan range a dedicated touch hit area", () => {
  render(<ControlPanel />);
  const slider = screen.getByRole("slider", { name: "风扇功率" });

  expect(slider.parentElement).toHaveClass("fan-slider-hit-area");
});

it("locks manual fan and pause controls while the fixed sweep owns the command", () => {
  labStore.getState().startSweep();
  render(<ControlPanel />);

  expect(screen.getByRole("slider", { name: "风扇功率" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "暂停实验" })).toBeDisabled();
});

it("keeps controls and teaching data visible while offering solver recovery", async () => {
  const user = userEvent.setup();
  const restartFlow = vi.fn().mockResolvedValue(undefined);
  labStore.setState({ flowStatus: "failed", flowError: "worker crashed" });
  render(<ControlPanel onRestartFlow={restartFlow} />);

  expect(screen.getByRole("alert")).toHaveTextContent("worker crashed");
  expect(screen.getByRole("slider", { name: "风扇功率" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "重新启动求解器" }));
  expect(restartFlow).toHaveBeenCalledOnce();
});

it("consumes an expected restart rejection, re-enables recovery, and allows retry", async () => {
  const user = userEvent.setup();
  const restartFlow = vi.fn()
    .mockRejectedValueOnce(new Error("replacement init failed"))
    .mockResolvedValueOnce(undefined);
  const unhandled = vi.fn();
  const onUnhandled = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    unhandled(event.reason);
  };
  window.addEventListener("unhandledrejection", onUnhandled);
  labStore.setState({ flowStatus: "failed", flowError: "replacement init failed" });
  render(<ControlPanel onRestartFlow={restartFlow} />);

  try {
    await user.click(screen.getByRole("button", { name: "重新启动求解器" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "重新启动求解器" })).toBeEnabled());
    expect(labStore.getState()).toMatchObject({
      flowStatus: "failed",
      flowError: "replacement init failed",
    });
    expect(unhandled).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "重新启动求解器" }));
    expect(restartFlow).toHaveBeenCalledTimes(2);
  } finally {
    window.removeEventListener("unhandledrejection", onUnhandled);
  }
});

it("checks current history at reset activation time", () => {
  const confirmReset = vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<ControlPanel />);
  const resetButton = screen.getByRole("button", { name: "停止并重置" });

  act(() => {
    labStore.getState().acceptFrame(frame());
    resetButton.click();
  });

  expect(confirmReset).toHaveBeenCalledOnce();
  expect(labStore.getState().history).toHaveLength(0);
  confirmReset.mockRestore();
});

it("shows exact telemetry formats, units, quality, and simulated provenance", () => {
  labStore.setState({ telemetry: frame() });
  render(<TelemetryCards onInspect={() => undefined} />);

  expect(screen.getByText("4380")).toBeVisible();
  expect(screen.getByText("8.46")).toBeVisible();
  expect(screen.getByText("-32.4")).toBeVisible();
  expect(screen.getByText("0.185")).toBeVisible();
  expect(screen.getByText("车底相对压力")).toBeVisible();
  for (const unit of ["RPM", "m/s", "Pa", "N"]) {
    expect(screen.getByText(unit)).toBeVisible();
  }
  expect(screen.getAllByText("SIMULATED")).toHaveLength(4);
  expect(screen.getAllByText("稳定 / STABLE")).toHaveLength(4);
});

it("reports each inspected sensor as tutorial evidence", async () => {
  const user = userEvent.setup();
  const onInspect = vi.fn();
  render(<TelemetryCards onInspect={onInspect} />);

  for (const name of ["查看风扇转速说明", "查看来流速度说明", "查看车底相对压力说明", "查看垂向载荷说明"]) {
    await user.click(screen.getByRole("button", { name }));
  }
  expect(onInspect.mock.calls.map(([sensor]) => sensor)).toEqual(["rpm", "wind", "pressure", "load"]);
  expect(screen.getByRole("region", { name: "垂向载荷传感器说明" })).toHaveTextContent("20 Hz");
});

it("opens keyboard-accessible sensor teaching panels before recording evidence", async () => {
  const user = userEvent.setup();
  const onInspect = vi.fn();
  render(<TelemetryCards onInspect={onInspect} />);

  const rpmButton = screen.getByRole("button", { name: "查看风扇转速说明" });
  rpmButton.focus();
  await user.keyboard("{Enter}");

  expect(rpmButton).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("region", { name: "风扇转速传感器说明" })).toHaveTextContent("定义");
  expect(screen.getByRole("region", { name: "风扇转速传感器说明" })).toHaveTextContent("RPM");
  expect(screen.getByRole("region", { name: "风扇转速传感器说明" })).toHaveTextContent("20 Hz");
  expect(screen.getByRole("region", { name: "风扇转速传感器说明" })).toHaveTextContent("一阶惯性");
  expect(screen.getByRole("region", { name: "风扇转速传感器说明" })).toHaveTextContent("确定性噪声");
  expect(onInspect).toHaveBeenCalledWith("rpm");

  await user.keyboard("{Enter}");
  expect(rpmButton).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("region", { name: "风扇转速传感器说明" })).not.toBeInTheDocument();
  expect(onInspect).toHaveBeenCalledTimes(1);
});

it.each([
  ["风扇转速", "RPM", "无固定采集延迟", "确定性噪声", "无额外零点漂移"],
  ["来流速度", "m/s", "1 个样本（50 ms）延迟", "确定性噪声", "无额外零点漂移"],
  ["车底相对压力", "Pa", "2 个样本（100 ms）延迟", "噪声", "有界零点漂移"],
  ["垂向载荷", "N", "2 个样本（100 ms）延迟", "噪声", "有界零点漂移"],
] as const)(
  "documents the %s sensor definition, unit, cadence, source, noise, delay, drift, and provenance",
  async (label, unit, delay, noise, drift) => {
    const user = userEvent.setup();
    render(<TelemetryCards onInspect={() => undefined} />);

    await user.click(screen.getByRole("button", { name: `查看${label}说明` }));
    const explanation = screen.getByRole("region", { name: `${label}传感器说明` });

    expect(explanation).toHaveTextContent("定义：");
    expect(explanation).toHaveTextContent(`单位：${unit}`);
    expect(explanation).toHaveTextContent("20 Hz（每 50 ms 一帧）");
    expect(explanation).toHaveTextContent("模拟来源：");
    expect(explanation).toHaveTextContent(delay);
    expect(explanation).toHaveTextContent(noise);
    expect(explanation).toHaveTextContent(drift);
    expect(explanation).toHaveTextContent("SIMULATED / 模拟数据");
  },
);

it("selects and reports all four teaching field views", async () => {
  const user = userEvent.setup();
  const onInspect = vi.fn();
  acceptTestFlowFrame();
  render(<FieldSelector onInspect={onInspect} />);

  for (const name of ["压力", "涡量", "流线", "速度"]) {
    await user.click(screen.getByRole("radio", { name }));
  }
  expect(labStore.getState().selectedField).toBe("speed");
  expect(onInspect.mock.calls.map(([field]) => field)).toEqual(["pressure", "vorticity", "streamlines", "speed"]);
  expect(screen.getByText("D2Q9 BGK")).toBeVisible();
  expect(screen.getByText("2 × 1")).toBeVisible();
  expect(screen.getByText("二维教学近似")).toBeVisible();
});

it("does not record field evidence until a real worker field is ready", async () => {
  const user = userEvent.setup();
  const onInspect = vi.fn();
  const { rerender } = render(<FieldSelector onInspect={onInspect} />);

  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  expect(screen.getByText("等待真实二维流场后可记录观察证据。" )).toBeVisible();

  act(() => acceptTestFlowFrame());
  rerender(<FieldSelector onInspect={onInspect} />);
  await user.click(screen.getByRole("radio", { name: "压力" }));
  expect(onInspect).toHaveBeenCalledWith("pressure");
});

it("shows the accepted runtime grid, tau, generation, and scaled inlet instead of profile guesses", () => {
  acceptTestFlowFrame({
    generation: 4,
    gridWidth: 160,
    gridHeight: 64,
    requestedInletVelocity: 0.04,
    actualInletVelocity: 0.032,
    velocityScale: 0.8,
    recovery: "non-finite-field-scale",
    rebuildReason: "non-finite-restart",
  });
  render(<FieldSelector onInspect={() => undefined} quality={qualityProfile("high")} />);

  expect(screen.getByText("HIGH")).toBeVisible();
  expect(screen.getByText("160 × 64")).toBeVisible();
  expect(screen.getByText("τ = 0.620")).toBeVisible();
  expect(screen.getByText("GEN 4")).toBeVisible();
  expect(screen.getByText("0.0400 → 0.0320 lu (80%)")).toBeVisible();
  expect(screen.getByText("NON_FINITE_FIELD 受控缩放")).toBeVisible();
  expect(screen.getByText("NON_FINITE_RESTART")).toBeVisible();
});

it("uses roving tab focus and all arrow keys to select fields cyclically", async () => {
  const user = userEvent.setup();
  const onInspect = vi.fn();
  acceptTestFlowFrame();
  render(<FieldSelector onInspect={onInspect} />);
  const radios = screen.getAllByRole("radio");

  expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1]);
  radios[0]!.focus();
  await user.keyboard("{ArrowRight}{ArrowDown}{ArrowLeft}{ArrowUp}{ArrowLeft}");

  expect(screen.getByRole("radio", { name: "流线" })).toHaveFocus();
  expect(labStore.getState().selectedField).toBe("streamlines");
  expect(onInspect.mock.calls.map(([field]) => field)).toEqual([
    "pressure",
    "vorticity",
    "pressure",
    "speed",
    "streamlines",
  ]);
  expect(screen.getAllByRole("radio").map((radio) => radio.tabIndex)).toEqual([-1, -1, -1, 0]);
});

it("maps only the latest sixty seconds and never more than 1,200 points", () => {
  const history = Array.from({ length: 1_300 }, (_, sequence) => frame({
    sequence,
    simulationTimeMs: sequence * 50,
  }));

  const mapped = mapHistoryToChartData(history);
  expect(mapped).toHaveLength(1_200);
  expect(mapped[0]).toMatchObject({ timeSeconds: 5, rpm: 4380.4, pressurePa: -32.44 });
  expect(mapped.at(-1)?.timeSeconds).toBe(64.95);
});

it("marks a stable chart window without changing telemetry history", async () => {
  const user = userEvent.setup();
  const history = [
    frame({ sequence: 1, simulationTimeMs: 50, quality: "transient" }),
    frame({ sequence: 2, simulationTimeMs: 100, quality: "stable" }),
    frame({ sequence: 3, simulationTimeMs: 150, quality: "stable" }),
  ];
  labStore.setState({ history });
  const onInspectStableWindow = vi.fn();
  render(<HistoryChart onInspectStableWindow={onInspectStableWindow} />);

  await user.click(screen.getByRole("button", { name: "标记稳定窗口" }));
  expect(onInspectStableWindow).toHaveBeenCalledOnce();
  expect(labStore.getState().history).toBe(history);
});

it("renders four visible, separately positioned unit axes", () => {
  labStore.setState({ history: [
    frame({ sequence: 1, simulationTimeMs: 100, quality: "transient" }),
    frame({ sequence: 2, simulationTimeMs: 150, quality: "transient" }),
  ] });
  render(<HistoryChart onInspectStableWindow={() => undefined} />);
  const plot = screen.getByLabelText("最近 60 秒遥测曲线");
  const axes = plot.querySelectorAll(".recharts-yAxis");
  const axisLines = plot.querySelectorAll<SVGLineElement>(".recharts-yAxis .recharts-cartesian-axis-line");

  expect(axes).toHaveLength(4);
  for (const unit of ["m/s", "RPM", "Pa", "N"]) {
    expect(within(plot).getByText(unit)).toBeVisible();
  }
  expect(new Set(Array.from(axisLines, (line) => line.getAttribute("x1"))).size).toBe(4);
});

it("does not expose a zero-duration stable window from one sample", () => {
  labStore.setState({ history: [frame({ sequence: 1, simulationTimeMs: 100, quality: "stable" })] });
  render(<HistoryChart onInspectStableWindow={() => undefined} />);

  expect(screen.queryByRole("button", { name: "标记稳定窗口" })).not.toBeInTheDocument();
});

it("accrues stable evidence only from finite physical-stable steps at exactly 30 percent", () => {
  const previous = frame({ simulationTimeMs: 1_000, quality: "transient" });
  const stable = frame({ simulationTimeMs: 2_000, fanPowerPct: 30, quality: "stable", rpm: 99_999 });

  const established = recordStableTelemetry(emptyEvidence, previous, stable, 30);
  expect(established.stableSeconds).toBe(0);
  expect(recordStableTelemetry(
    established,
    stable,
    { ...stable, sequence: 2, simulationTimeMs: 3_000 },
    30,
  ).stableSeconds).toBe(1);
  expect(recordStableTelemetry(emptyEvidence, previous, stable, 31).stableSeconds).toBe(0);
  expect(recordStableTelemetry(emptyEvidence, previous, { ...stable, quality: "transient" }, 30).stableSeconds).toBe(0);
});

it("resets the consecutive stable window after any transient or command break", () => {
  const first = recordStableTelemetry(
    emptyEvidence,
    frame({ simulationTimeMs: 0, quality: "stable" }),
    frame({ simulationTimeMs: 1_000, quality: "stable", fanPowerPct: 30 }),
    30,
  );
  const interrupted = recordStableTelemetry(
    first,
    frame({ simulationTimeMs: 1_000, quality: "stable" }),
    frame({ simulationTimeMs: 1_050, quality: "transient", fanPowerPct: 30 }),
    30,
  );
  const resumed = recordStableTelemetry(
    interrupted,
    frame({ simulationTimeMs: 1_050, quality: "transient" }),
    frame({ simulationTimeMs: 2_050, quality: "stable", fanPowerPct: 30 }),
    30,
  );

  expect(first.stableSeconds).toBe(1);
  expect(interrupted.stableSeconds).toBe(0);
  expect(resumed.stableSeconds).toBe(0);

  const commandBreak = recordStableTelemetry(
    first,
    frame({ simulationTimeMs: 1_000, quality: "stable" }),
    frame({ simulationTimeMs: 1_050, quality: "stable", fanPowerPct: 31 }),
    31,
  );
  expect(commandBreak.stableSeconds).toBe(0);
});

it.each([
  ["stopped", frame({ simulationTimeMs: 1_050, phase: "idle", fanPowerPct: 0, quality: "transient" })],
  ["reset timestamp", frame({ simulationTimeMs: 0, phase: "idle", fanPowerPct: 0, quality: "transient" })],
  ["non-finite dt", frame({ simulationTimeMs: Number.NaN, fanPowerPct: 30, quality: "stable" })],
  ["oversized dt", frame({ simulationTimeMs: 3_001, fanPowerPct: 30, quality: "stable" })],
] as const)("clears prior stable credit for a %s frame", (_label, next) => {
  const credited = { ...emptyEvidence, stableSeconds: 1 };
  const previous = frame({ simulationTimeMs: 1_000, quality: "stable" });

  expect(recordStableTelemetry(credited, previous, next, next.fanPowerPct).stableSeconds).toBe(0);
});

it("records sensor, field, and stable-window evidence without duplicate identifiers", () => {
  const withSensor = recordSensorInspection(recordSensorInspection(emptyEvidence, "rpm"), "rpm");
  const withField = recordFieldInspection(recordFieldInspection(withSensor, "pressure"), "pressure");
  const complete = recordStableWindowInspection(withField);

  expect(complete).toMatchObject({
    viewedSensors: ["rpm"],
    viewedFields: ["pressure"],
    inspectedStableWindow: true,
  });
});
