import type { TelemetryFrame } from "../experiment/model";
import type { FlowRuntimeMetadata } from "../flow/types";
import type { CfdProxyRuntimeConfiguration, CfdSensorProxySample } from "../flow/cfdSensorProxy";
import { SWEEP_POWERS } from "../sweep/sweepRunner";
import { summarizeRun } from "./experimentSummary";

export type ExperimentCsvMetadata = {
  title?: string;
  generatedTime?: string;
  provenance: "simulated";
  solver?: string;
  conclusion: string;
  comparisonReason?: string;
  selectedLargestResidualPower?: number | null;
  computedLargestResidualPower?: number | null;
  flow?: FlowRuntimeMetadata | null;
  simulationSeed?: number;
  disclaimer?: string;
};

export type ExperimentComparisonCsv = {
  fanPowerPct: number;
  valid: boolean;
  sampleCount: number;
  cfdPressureCoefficient: number | null;
  sensorPressureCoefficient: number | null;
  signedResidual: number | null;
  absoluteResidual: number | null;
  normalizedResidualPct: number | null;
  runtimeConfigurations: CfdProxyRuntimeConfiguration[];
  mixedRuntimeConfiguration: boolean;
  requestedInletVelocityRange: { min: number; max: number } | null;
  actualInletVelocityRange: { min: number; max: number } | null;
};

export type ExperimentCsvInput = {
  metadata: ExperimentCsvMetadata;
  samples: TelemetryFrame[];
  comparisons?: ExperimentComparisonCsv[];
  proxySamples?: CfdSensorProxySample[];
  comparisonFormula?: string;
};

const SAMPLE_HEADERS = [
  "sequence",
  "simulationTimeMs",
  "phase",
  "fanPowerPct",
  "rpm",
  "windSpeedMps",
  "underbodyPressurePa",
  "verticalLoadN",
  "quality",
  "provenance",
] as const;

const SUMMARY_HEADERS = [
  "summaryFanPowerPct",
  "valid",
  "sampleCount",
  "minSimulationTimeMs",
  "maxSimulationTimeMs",
  "meanRpm",
  "stdRpm",
  "minRpm",
  "maxRpm",
  "meanWindSpeedMps",
  "stdWindSpeedMps",
  "minWindSpeedMps",
  "maxWindSpeedMps",
  "meanUnderbodyPressurePa",
  "stdUnderbodyPressurePa",
  "minUnderbodyPressurePa",
  "maxUnderbodyPressurePa",
  "meanVerticalLoadN",
  "stdVerticalLoadN",
  "minVerticalLoadN",
  "maxVerticalLoadN",
] as const;

export function serializeExperimentCsv({
  metadata,
  samples,
  comparisons = [],
  proxySamples = [],
  comparisonFormula = "",
}: ExperimentCsvInput): string {
  const flow = metadata.flow;
  const runtime = summarizeRuntime(proxySamples, flow);
  const rows: Array<Array<string | number | boolean | null | undefined>> = [
    ["title", metadata.title ?? "SophiFlow 三工况数字风洞实验"],
    ["generatedTime", metadata.generatedTime ?? ""],
    ["provenance", metadata.provenance],
    ["solver", metadata.solver ?? "D2Q9 BGK teaching solver"],
    ["gridSize", runtime.gridSize],
    ["solverGeneration", runtime.generation],
    ["tau", runtime.tau],
    ["requestedInletVelocityLu", runtime.requestedInlet],
    ["actualInletVelocityLu", runtime.actualInlet],
    ["velocityScale", runtime.velocityScale],
    ["numericalRecovery", runtime.recovery],
    ["rebuildReason", runtime.rebuildReason],
    ["latestAcceptedGridSize", flow ? `${flow.gridWidth} × ${flow.gridHeight}` : "unavailable"],
    ["latestAcceptedSolverGeneration", flow?.generation ?? "unavailable"],
    ["latestAcceptedTau", flow?.tau ?? "unavailable"],
    ["latestAcceptedRequestedInletVelocityLu", flow?.requestedInletVelocity ?? "unavailable"],
    ["latestAcceptedActualInletVelocityLu", flow?.actualInletVelocity ?? "unavailable"],
    ["latestAcceptedVelocityScale", flow?.velocityScale ?? "unavailable"],
    ["latestAcceptedRecovery", flow?.recovery ?? "unavailable"],
    ["latestAcceptedRebuildReason", flow?.rebuildReason ?? "unavailable"],
    ["latestAcceptedFlowFrameId", flow?.acceptedFrameId ?? "unavailable"],
    ["simulationSeed", metadata.simulationSeed ?? "unavailable"],
    ["conclusion", metadata.conclusion],
    ["comparisonReason", metadata.comparisonReason ?? ""],
    ["selectedLargestResidualPower", metadata.selectedLargestResidualPower ?? ""],
    ["computedLargestResidualPower", metadata.computedLargestResidualPower ?? ""],
    ["comparisonFormula", comparisonFormula],
    ["disclaimer", metadata.disclaimer ?? "SIMULATED / 模拟数据；2D TEACHING CFD / 二维教学近似"],
    ["units", "sequence=count; simulationTimeMs=ms; fanPowerPct=%; rpm=RPM; windSpeedMps=m/s; underbodyPressurePa=Pa; verticalLoadN=N"],
    [],
    [...SAMPLE_HEADERS],
    ...samples.map((sample) => SAMPLE_HEADERS.map((header) => sample[header])),
    [],
    [...SUMMARY_HEADERS],
  ];

  for (const power of SWEEP_POWERS) {
    const summary = summarizeRun(samples.filter((sample) => sample.fanPowerPct === power));
    rows.push([
      power,
      summary.valid,
      summary.sampleCount,
      summary.minSimulationTimeMs,
      summary.maxSimulationTimeMs,
      summary.rpm.mean,
      summary.rpm.standardDeviation,
      summary.rpm.min,
      summary.rpm.max,
      summary.windSpeedMps.mean,
      summary.windSpeedMps.standardDeviation,
      summary.windSpeedMps.min,
      summary.windSpeedMps.max,
      summary.underbodyPressurePa.mean,
      summary.underbodyPressurePa.standardDeviation,
      summary.underbodyPressurePa.min,
      summary.underbodyPressurePa.max,
      summary.verticalLoadN.mean,
      summary.verticalLoadN.standardDeviation,
      summary.verticalLoadN.min,
      summary.verticalLoadN.max,
    ]);
  }

  rows.push(
    [],
    [
      "comparisonFanPowerPct",
      "valid",
      "flowSampleCount",
      "cfdPressureCoefficient",
      "sensorPressureCoefficient",
      "signedResidualCp",
      "absoluteResidualCp",
      "normalizedResidualPct",
      "mixedRuntimeConfiguration",
      "runtimeConfigurations",
      "requestedInletVelocityRangeLu",
      "actualInletVelocityRangeLu",
    ],
  );
  for (const comparison of comparisons) {
    rows.push([
      comparison.fanPowerPct,
      comparison.valid,
      comparison.sampleCount,
      comparison.cfdPressureCoefficient,
      comparison.sensorPressureCoefficient,
      comparison.signedResidual,
      comparison.absoluteResidual,
      comparison.normalizedResidualPct,
      comparison.mixedRuntimeConfiguration,
      comparison.runtimeConfigurations.map(formatRuntimeConfiguration).join("; "),
      formatRange(comparison.requestedInletVelocityRange),
      formatRange(comparison.actualInletVelocityRange),
    ]);
  }

  rows.push(
    [],
    ["CFD_PROXY_SAMPLES"],
    [
      "flowFrameId",
      "simulationTimeMs",
      "fanPowerPct",
      "cfdPressureDeltaLu",
      "latticeDynamicPressure",
      "sensorPressurePa",
      "physicalDynamicPressurePa",
      "generation",
      "gridWidth",
      "gridHeight",
      "tau",
      "requestedInletVelocityLu",
      "actualInletVelocityLu",
      "velocityScale",
      "recovery",
      "rebuildReason",
    ],
  );
  for (const sample of proxySamples) {
    const configuration = sample.runtimeConfiguration;
    rows.push([
      sample.flowFrameId,
      sample.simulationTimeMs,
      sample.fanPowerPct,
      sample.cfdPressureDeltaLu,
      sample.latticeDynamicPressure,
      sample.sensorPressurePa,
      sample.physicalDynamicPressurePa,
      configuration.generation,
      configuration.gridWidth,
      configuration.gridHeight,
      configuration.tau,
      configuration.requestedInletVelocity,
      configuration.actualInletVelocity,
      configuration.velocityScale,
      configuration.recovery,
      configuration.rebuildReason,
    ]);
  }

  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;
}

function formatRuntimeConfiguration(configuration: CfdProxyRuntimeConfiguration): string {
  return [
    `generation=${configuration.generation}`,
    `grid=${configuration.gridWidth}x${configuration.gridHeight}`,
    `tau=${configuration.tau}`,
    `scale=${configuration.velocityScale}`,
    `recovery=${configuration.recovery}`,
    `rebuild=${configuration.rebuildReason}`,
  ].join(" ");
}

function formatRange(range: { min: number; max: number } | null): string {
  return range === null ? "" : `${range.min}..${range.max}`;
}

function summarizeRuntime(proxySamples: readonly CfdSensorProxySample[], flow: FlowRuntimeMetadata | null | undefined) {
  const configurations = uniqueBy(proxySamples.map(({ runtimeConfiguration }) => runtimeConfiguration), (configuration) => [
    configuration.generation,
    configuration.gridWidth,
    configuration.gridHeight,
    configuration.tau,
    configuration.velocityScale,
    configuration.recovery,
    configuration.rebuildReason,
  ].join("|"));
  if (configurations.length === 0 && flow) configurations.push(flow);
  return {
    gridSize: mixedValue(configurations.map((configuration) => `${configuration.gridWidth} × ${configuration.gridHeight}`)),
    generation: mixedValue(configurations.map((configuration) => String(configuration.generation))),
    tau: mixedValue(configurations.map((configuration) => String(configuration.tau))),
    requestedInlet: numericRange(proxySamples.map(({ runtimeConfiguration }) => runtimeConfiguration.requestedInletVelocity), flow?.requestedInletVelocity),
    actualInlet: numericRange(proxySamples.map(({ runtimeConfiguration }) => runtimeConfiguration.actualInletVelocity), flow?.actualInletVelocity),
    velocityScale: mixedValue(configurations.map((configuration) => String(configuration.velocityScale))),
    recovery: mixedValue(configurations.map((configuration) => configuration.recovery), " | "),
    rebuildReason: mixedValue(configurations.map((configuration) => configuration.rebuildReason), " | "),
  };
}

function uniqueBy<T>(values: readonly T[], keyOf: (value: T) => string): T[] {
  const unique = new Map<string, T>();
  for (const value of values) if (!unique.has(keyOf(value))) unique.set(keyOf(value), value);
  return [...unique.values()];
}

function mixedValue(values: readonly string[], separator = " | "): string {
  const unique = [...new Set(values)];
  if (unique.length === 0) return "unavailable";
  return unique.length === 1 ? unique[0]! : `mixed: ${unique.join(separator)}`;
}

function numericRange(values: readonly number[], fallback: number | undefined): string | number {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return fallback ?? "unavailable";
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return min === max ? min : `range: ${min}..${max}`;
}

export function downloadExperimentCsv(csv: string, generatedTime = new Date().toISOString()): string {
  const timestamp = generatedTime.replace(/\D/g, "").slice(0, 14).padEnd(14, "0");
  const filename = `sophiflow-cfd-sweep-${timestamp.slice(0, 8)}-${timestamp.slice(8)}.csv`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
  return filename;
}

function escapeCell(value: string | number | boolean | null | undefined): string {
  const safeValue = typeof value === "string" && /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
  const cell = safeValue == null ? "" : String(safeValue).replace(/\r\n|\r|\n/g, "\r\n");
  return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}
