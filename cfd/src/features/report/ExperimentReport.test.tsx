import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { TelemetryFrame } from "../experiment/model";
import type { CfdSensorProxySample } from "../flow/cfdSensorProxy";
import type { FlowRuntimeMetadata } from "../flow/types";
import type { SweepState } from "../sweep/sweepRunner";
import { ExperimentReport } from "./ExperimentReport";
import type { ExperimentCsvInput } from "./csv";

function samples(power: 30 | 60 | 90, wind: number, load: number): TelemetryFrame[] {
  return Array.from({ length: 80 }, (_, sequence) => ({
    sequence,
    simulationTimeMs: power * 1_000 + sequence * 50,
    phase: "sampling",
    fanPowerPct: power,
    rpm: power * 62,
    windSpeedMps: wind,
    underbodyPressurePa: -power,
    verticalLoadN: load,
    quality: "stable",
    provenance: "simulated",
  }));
}

function proxySamples(power: 30 | 60 | 90, cfdCp: number, sensorCp: number): CfdSensorProxySample[] {
  return Array.from({ length: 5 }, (_, index) => ({
    flowFrameId: power * 10 + index,
    simulationTimeMs: power * 1_000 + index * 100,
    fanPowerPct: power,
    cfdPressureDeltaLu: cfdCp * 0.001,
    latticeDynamicPressure: 0.001,
    sensorPressurePa: sensorCp * 10,
    physicalDynamicPressurePa: 10,
    runtimeConfiguration: {
      generation: 2,
      gridWidth: 160,
      gridHeight: 64,
      tau: 0.62,
      requestedInletVelocity: power / 1_500,
      actualInletVelocity: power / 1_500,
      velocityScale: 1,
      recovery: "none",
      rebuildReason: "initial",
    },
  }));
}

const flowMetadata: FlowRuntimeMetadata = {
  acceptedFrameId: 99,
  generation: 2,
  gridWidth: 160,
  gridHeight: 64,
  tau: 0.62,
  requestedInletVelocity: 0.06,
  actualInletVelocity: 0.06,
  velocityScale: 1,
  recovery: "none",
  rebuildReason: "initial",
  sourceTelemetrySequence: 240,
  sourceFanPowerPct: 90,
  sourceSweepRunRevision: 1,
  sourceSweepConditionIndex: 2,
  provenance: "2d-teaching-cfd",
};

const reportRequirements = {
  comparisonReason: "二维截面忽略了侧向泄漏和支架干扰",
  selectedLargestResidualPower: 90 as const,
  flowMetadata,
  onComparisonReasonChange: () => undefined,
};

const completedSweep: SweepState = {
  status: "completed",
  conditionIndex: 2,
  commandedPowerPct: 90,
  stableMs: 2_000,
  samplingMs: 4_000,
  conditionElapsedMs: 6_000,
  completedPowers: [30, 60, 90],
  samplesByPower: {
    30: samples(30, 3, 0.1),
    60: samples(60, 6, 0.45),
    90: samples(90, 9, 0.8),
  },
  proxySamplesByPower: {
    30: proxySamples(30, -0.5, -0.5),
    60: proxySamples(60, -0.7, -0.69996),
    90: proxySamples(90, -1, -0.99992),
  },
  lastCapturedFlowFrameId: 904,
  error: null,
};

it("shows three condition summaries, Cp guidance, and records the largest residual selection", async () => {
  const user = userEvent.setup();
  const onSelectLargestResidual = vi.fn();
  render(<ExperimentReport
    {...reportRequirements}
    selectedLargestResidualPower={null}
    sweep={completedSweep}
    conclusion=""
    onConclusionChange={() => undefined}
    onSelectLargestResidual={onSelectLargestResidual}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  for (const power of ["30%", "60%", "90%"]) {
    expect(screen.getByRole("heading", { name: power })).toBeVisible();
  }
  expect(screen.getAllByText("RPM avg ± std")).toHaveLength(3);
  expect(screen.getAllByText("压力 avg ± std")).toHaveLength(3);
  expect(screen.getByText(/Cp_CFD = ΣΔp_lu/)).toBeVisible();
  await user.click(screen.getByRole("radio", { name: "90% 为最大残差" }));
  expect(onSelectLargestResidual).toHaveBeenCalledOnce();
  expect(screen.getByText("SIMULATED / 模拟数据")).toBeVisible();
  expect(screen.getByText("2D TEACHING CFD / 二维教学近似")).toBeVisible();
});

it("shows enough residual precision to identify the same largest condition used by validation", () => {
  render(<ExperimentReport
    {...reportRequirements}
    sweep={{
      ...completedSweep,
      samplesByPower: {
        30: samples(30, 3, 0.1),
        60: samples(60, 6, 0.40004),
        90: samples(90, 9, 0.90008),
      },
      proxySamplesByPower: {
        30: proxySamples(30, -0.5, -0.5),
        60: proxySamples(60, -0.7, -0.69996),
        90: proxySamples(90, -1, -0.99992),
      },
    }}
    conclusion=""
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  const residuals = screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[2]!.textContent);
  expect(residuals).toEqual(["0.000000", "0.000040", "0.000080"]);
});

it("enforces a twelve-character conclusion and prints the report", async () => {
  const user = userEvent.setup();
  const onConclusionChange = vi.fn();
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  const { rerender } = render(<ExperimentReport
    {...reportRequirements}
    sweep={completedSweep}
    conclusion="短结论"
    onConclusionChange={onConclusionChange}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  expect(screen.getByText("还需 9 个字符")).toBeVisible();
  expect(screen.getByRole("button", { name: "导出 CSV" })).toBeDisabled();
  await user.type(screen.getByRole("textbox", { name: "实验结论" }), "abcdefghijkl");
  expect(onConclusionChange).toHaveBeenCalled();

  rerender(<ExperimentReport
    {...reportRequirements}
    sweep={completedSweep}
    conclusion="这是十二字符以上的有效实验结论"
    onConclusionChange={onConclusionChange}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);
  await user.click(screen.getByRole("button", { name: "打印报告" }));
  expect(print).toHaveBeenCalledOnce();
});

it("keeps an immutable CSV snapshot and exposes retry after export failure", async () => {
  const user = userEvent.setup();
  const attemptedCsv: string[] = [];
  const downloadCsv = vi.fn((csv: string) => {
    attemptedCsv.push(csv);
    if (attemptedCsv.length === 1) throw new Error("blocked");
  });
  const { rerender } = render(<ExperimentReport
    {...reportRequirements}
    sweep={completedSweep}
    conclusion="这是十二字符以上的有效实验结论"
    generatedTime="2026-08-18T01:02:03.000Z"
    downloadCsv={downloadCsv}
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  await user.click(screen.getByRole("button", { name: "导出 CSV" }));
  expect(screen.getByRole("alert")).toHaveTextContent("导出失败，实验数据仍保留");

  rerender(<ExperimentReport
    {...reportRequirements}
    sweep={{ ...completedSweep, samplesByPower: {} }}
    conclusion="被外部修改但不应进入重试快照"
    generatedTime="2099-01-01T00:00:00.000Z"
    downloadCsv={downloadCsv}
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);
  await user.click(screen.getByRole("button", { name: "重试导出" }));
  expect(attemptedCsv[1]).toBe(attemptedCsv[0]);
});

it("routes serialization failure through the same immutable retry UI", async () => {
  const user = userEvent.setup();
  const serializationInputs: ExperimentCsvInput[] = [];
  const serializeCsv = vi.fn((input: ExperimentCsvInput) => {
    serializationInputs.push(input);
    if (serializationInputs.length === 1) throw new Error("serialization failed");
    return "serialized immutable snapshot";
  });
  const downloadCsv = vi.fn();
  const serializerProp = { serializeCsv };
  const { rerender } = render(<ExperimentReport
    {...reportRequirements}
    {...serializerProp}
    sweep={completedSweep}
    conclusion="这是原始且足够长度的实验结论"
    generatedTime="2026-08-18T01:02:03.000Z"
    downloadCsv={downloadCsv}
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  await user.click(screen.getByRole("button", { name: "导出 CSV" }));
  expect(screen.getByRole("alert")).toHaveTextContent("导出失败，实验数据仍保留");
  expect(downloadCsv).not.toHaveBeenCalled();

  rerender(<ExperimentReport
    {...reportRequirements}
    {...serializerProp}
    sweep={{ ...completedSweep, samplesByPower: {} }}
    conclusion="后来变化且不应进入重试的数据"
    generatedTime="2099-01-01T00:00:00.000Z"
    downloadCsv={downloadCsv}
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);
  await user.click(screen.getByRole("button", { name: "重试导出" }));

  expect(serializationInputs).toHaveLength(2);
  expect(serializationInputs[1]).toEqual(serializationInputs[0]);
  expect(serializationInputs[1]?.samples).toHaveLength(240);
  expect(serializationInputs[1]?.metadata.conclusion).toBe("这是原始且足够长度的实验结论");
  expect(downloadCsv).toHaveBeenCalledWith("serialized immutable snapshot", "2026-08-18T01:02:03.000Z");
  expect(completedSweep.samplesByPower[30]).toHaveLength(80);
});

it("does not enable residual evidence from invalid condition summaries", () => {
  render(<ExperimentReport
    {...reportRequirements}
    sweep={{
      ...completedSweep,
      samplesByPower: {
        30: samples(30, 3, 0.1).slice(0, 1),
        60: samples(60, 6, 0.45).slice(0, 1),
        90: samples(90, 9, 0.8).slice(0, 1),
      },
    }}
    conclusion=""
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
});

it.each([
  ["only 30%", { 30: samples(30, 3, 0.1) }],
  ["only 30% and 60%", { 30: samples(30, 3, 0.1), 60: samples(60, 6, 0.45) }],
])("keeps every residual choice disabled with %s valid", (_label, samplesByPower) => {
  render(<ExperimentReport
    {...reportRequirements}
    sweep={{ ...completedSweep, samplesByPower }}
    conclusion=""
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
});

it("keeps residual choices disabled until the fully valid sweep is completed", () => {
  render(<ExperimentReport
    {...reportRequirements}
    sweep={{ ...completedSweep, status: "sampling" }}
    conclusion=""
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
});

it("keeps residual choices disabled when proxy denominators are non-finite", () => {
  render(<ExperimentReport
    {...reportRequirements}
    sweep={{
      ...completedSweep,
      proxySamplesByPower: {
        ...completedSweep.proxySamplesByPower,
        30: proxySamples(30, -0.5, -0.5).map((sample) => ({
          ...sample,
          latticeDynamicPressure: Number.NaN,
        })),
      },
    }}
    conclusion=""
    onConclusionChange={() => undefined}
    onSelectLargestResidual={() => undefined}
    onStartSweep={() => undefined}
    onCancelSweep={() => undefined}
    onRetrySweep={() => undefined}
  />);

  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
});
