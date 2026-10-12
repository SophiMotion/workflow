import type { TelemetryFrame } from "../experiment/model";

type SummarySample = Pick<
  TelemetryFrame,
  "quality" | "windSpeedMps" | "rpm" | "underbodyPressurePa" | "verticalLoadN" | "simulationTimeMs"
>;

export type MetricStatistics = {
  mean: number | null;
  standardDeviation: number | null;
  min: number | null;
  max: number | null;
};

export type RunSummary = {
  sampleCount: number;
  valid: boolean;
  minSimulationTimeMs: number | null;
  maxSimulationTimeMs: number | null;
  rpm: MetricStatistics;
  windSpeedMps: MetricStatistics;
  underbodyPressurePa: MetricStatistics;
  verticalLoadN: MetricStatistics;
  meanRpm: number | null;
  meanWindSpeedMps: number | null;
  meanUnderbodyPressurePa: number | null;
  meanVerticalLoadN: number | null;
};

const emptyMetric = (): MetricStatistics => ({ mean: null, standardDeviation: null, min: null, max: null });

export function summarizeRun(samples: SummarySample[]): RunSummary {
  const stable = samples.filter((sample) => sample.quality === "stable" && isFiniteSample(sample));
  const rpm = summarizeMetric(stable.map((sample) => sample.rpm));
  const windSpeedMps = summarizeMetric(stable.map((sample) => sample.windSpeedMps));
  const underbodyPressurePa = summarizeMetric(stable.map((sample) => sample.underbodyPressurePa));
  const verticalLoadN = summarizeMetric(stable.map((sample) => sample.verticalLoadN));

  return {
    sampleCount: stable.length,
    valid: stable.length >= 20 && [rpm, windSpeedMps, underbodyPressurePa, verticalLoadN].every(isFiniteMetric),
    minSimulationTimeMs: stable.length > 0 ? Math.min(...stable.map((sample) => sample.simulationTimeMs)) : null,
    maxSimulationTimeMs: stable.length > 0 ? Math.max(...stable.map((sample) => sample.simulationTimeMs)) : null,
    rpm,
    windSpeedMps,
    underbodyPressurePa,
    verticalLoadN,
    meanRpm: rpm.mean,
    meanWindSpeedMps: windSpeedMps.mean,
    meanUnderbodyPressurePa: underbodyPressurePa.mean,
    meanVerticalLoadN: verticalLoadN.mean,
  };
}

function isFiniteSample(sample: SummarySample): boolean {
  return Number.isFinite(sample.simulationTimeMs)
    && Number.isFinite(sample.rpm)
    && Number.isFinite(sample.windSpeedMps)
    && Number.isFinite(sample.underbodyPressurePa)
    && Number.isFinite(sample.verticalLoadN);
}

function isFiniteMetric(metric: MetricStatistics): boolean {
  return metric.mean !== null
    && metric.standardDeviation !== null
    && metric.min !== null
    && metric.max !== null
    && Number.isFinite(metric.mean)
    && Number.isFinite(metric.standardDeviation)
    && Number.isFinite(metric.min)
    && Number.isFinite(metric.max);
}

function summarizeMetric(values: number[]): MetricStatistics {
  if (values.length === 0) return emptyMetric();
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return {
    mean,
    standardDeviation: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
