import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { TelemetryFrame } from "../experiment/model";
import type { CfdSensorProxySample } from "../flow/cfdSensorProxy";
import type { FlowRuntimeMetadata } from "../flow/types";
import type { SweepPower, SweepState } from "../sweep/sweepRunner";
import { ExperimentReport } from "./ExperimentReport";
import type { ExperimentCsvInput } from "./csv";

function telemetrySamples(power: SweepPower): TelemetryFrame[] {
  return Array.from({ length: 80 }, (_, sequence) => ({
    sequence,
    simulationTimeMs: power * 1_000 + sequence * 50,
    phase: "sampling",
    fanPowerPct: power,
    rpm: power * 62,
    windSpeedMps: power * 0.1,
    underbodyPressurePa: -power,
    verticalLoadN: power / 100,
    quality: "stable",
    provenance: "simulated",
  }));
}

function proxySamples(power: SweepPower, cfdCp: number, sensorCp: number): CfdSensorProxySample[] {
  return Array.from({ length: 5 }, (_, index) => ({
    flowFrameId: power * 10 + index,
    simulationTimeMs: power * 1_000 + index * 100,
    fanPowerPct: power,
    cfdPressureDeltaLu: cfdCp * 0.001,
    latticeDynamicPressure: 0.001,
    sensorPressurePa: sensorCp * 10,
    physicalDynamicPressurePa: 10,
    runtimeConfiguration: {
      generation: 3,
      gridWidth: 160,
      gridHeight: 64,
      tau: 0.62,
      requestedInletVelocity: 0.04,
      actualInletVelocity: 0.032,
      velocityScale: 0.8,
      recovery: "non-finite-field-scale",
      rebuildReason: "non-finite-restart",
    },
  }));
}

const mixedNinetyPercentProxy = proxySamples(90, -1, -0.6).map((sample, index) => index < 3
  ? {
      ...sample,
      runtimeConfiguration: {
        ...sample.runtimeConfiguration,
        generation: 2,
        gridWidth: 240,
        gridHeight: 96,
        actualInletVelocity: 0.04,
        velocityScale: 1,
        recovery: "none" as const,
        rebuildReason: "timeout-downgrade" as const,
      },
    }
  : sample);

const sweep: SweepState = {
  status: "completed",
  conditionIndex: 2,
  commandedPowerPct: 90,
  stableMs: 2_000,
  samplingMs: 4_000,
  conditionElapsedMs: 6_000,
  completedPowers: [30, 60, 90],
  samplesByPower: {
    30: telemetrySamples(30),
    60: telemetrySamples(60),
    90: telemetrySamples(90),
  },
  proxySamplesByPower: {
    30: proxySamples(30, -0.5, -0.45),
    60: proxySamples(60, -0.7, -0.5),
    90: mixedNinetyPercentProxy,
  },
  lastCapturedFlowFrameId: 904,
  error: null,
};

const flowMetadata: FlowRuntimeMetadata = {
  acceptedFrameId: 77,
  generation: 3,
  gridWidth: 160,
  gridHeight: 64,
  tau: 0.62,
  requestedInletVelocity: 0.04,
  actualInletVelocity: 0.032,
  velocityScale: 0.8,
  recovery: "non-finite-field-scale",
  rebuildReason: "non-finite-restart",
  sourceTelemetrySequence: 44,
  sourceFanPowerPct: 90,
  sourceSweepRunRevision: 3,
  sourceSweepConditionIndex: 2,
  provenance: "2d-teaching-cfd",
};

const baseProps = {
  sweep,
  conclusion: "这是十二字符以上的有效实验结论",
  comparisonReason: "二维中心截面忽略了真实三维泄漏与支架干扰",
  selectedLargestResidualPower: null,
  flowMetadata,
  onConclusionChange: () => undefined,
  onComparisonReasonChange: () => undefined,
  onSelectLargestResidual: () => undefined,
  onStartSweep: () => undefined,
  onCancelSweep: () => undefined,
  onRetrySweep: () => undefined,
} as const;

it("compares real 2D pressure-window Cp with the virtual pressure sensor and records a reason", async () => {
  const user = userEvent.setup();
  const onSelectLargestResidual = vi.fn();
  const onComparisonReasonChange = vi.fn();
  render(<ExperimentReport
    {...baseProps}
    comparisonReason=""
    onSelectLargestResidual={onSelectLargestResidual}
    onComparisonReasonChange={onComparisonReasonChange}
  />);

  expect(screen.getByText(/Cp_CFD = ΣΔp_lu/)).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "CFD Cp" })).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "传感器 Cp" })).toBeVisible();
  expect(screen.getByText("0.4000", { exact: false })).toBeVisible();

  await user.click(screen.getByRole("radio", { name: "90% 为最大残差" }));
  expect(onSelectLargestResidual).toHaveBeenCalledWith(90, 90);
  await user.type(screen.getByRole("textbox", { name: "偏差原因" }), "二维中心截面忽略三维泄漏");
  expect(onComparisonReasonChange).toHaveBeenCalled();
});

it("freezes accepted runtime metadata, Cp summaries, formula, and reason into export input", async () => {
  const user = userEvent.setup();
  const inputs: ExperimentCsvInput[] = [];
  const serializeCsv = vi.fn((input: ExperimentCsvInput) => {
    inputs.push(input);
    return "csv";
  });
  render(<ExperimentReport
    {...baseProps}
    selectedLargestResidualPower={90}
    serializeCsv={serializeCsv}
    downloadCsv={() => undefined}
    generatedTime="2026-08-18T01:02:03.000Z"
  />);

  await user.click(screen.getByRole("button", { name: "导出 CSV" }));

  expect(inputs).toHaveLength(1);
  const exportInput = inputs[0]!;
  expect(exportInput.metadata).toMatchObject({
    comparisonReason: "二维中心截面忽略了真实三维泄漏与支架干扰",
    selectedLargestResidualPower: 90,
    computedLargestResidualPower: 90,
    flow: flowMetadata,
  });
  expect(exportInput.comparisons).toHaveLength(3);
  expect(exportInput.proxySamples).toHaveLength(15);
  expect(exportInput.proxySamples?.[0]).not.toBe(sweep.proxySamplesByPower[30]?.[0]);
  expect(exportInput.proxySamples?.[0]?.runtimeConfiguration).not.toBe(
    sweep.proxySamplesByPower[30]?.[0]?.runtimeConfiguration,
  );
  expect(exportInput.comparisons?.[2]).toMatchObject({
    fanPowerPct: 90,
    cfdPressureCoefficient: -1,
    sensorPressureCoefficient: -0.6,
    absoluteResidual: 0.4,
    mixedRuntimeConfiguration: true,
  });
  expect(exportInput.comparisons?.[2]?.runtimeConfigurations).toHaveLength(2);
  expect(exportInput.comparisonFormula).toContain("Cp_CFD");
});

it("keeps export locked until the actual largest residual and a non-empty reason are recorded", () => {
  const { rerender } = render(<ExperimentReport
    {...baseProps}
    comparisonReason=""
    selectedLargestResidualPower={90}
  />);
  expect(screen.getByRole("button", { name: "导出 CSV" })).toBeDisabled();

  rerender(<ExperimentReport
    {...baseProps}
    selectedLargestResidualPower={60}
  />);
  expect(screen.getByRole("button", { name: "导出 CSV" })).toBeDisabled();

  rerender(<ExperimentReport
    {...baseProps}
    selectedLargestResidualPower={90}
  />);
  expect(screen.getByRole("button", { name: "导出 CSV" })).toBeEnabled();
});
