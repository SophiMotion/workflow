import type { TelemetryFrame } from "../experiment/model";
import type { FlowFieldFrame, FlowRuntimeMetadata } from "./types";

const AIR_DENSITY_KG_M3 = 1.225;
// Five independent 10 Hz fields represent at least half a second of solver evidence.
// 5 个独立的 10 Hz 流场，代表至少半秒求解器证据。
export const MIN_PROXY_SAMPLES = 5;
const MIN_DENOMINATOR = 1e-9;

const REFERENCE_WINDOW = { uMin: 0.15, uMax: 0.30, vMin: 0.70, vMax: 0.85 } as const;
const UNDERBODY_WINDOW = { uMin: 0.40, uMax: 0.65, vMin: 0.70, vMax: 0.85 } as const;

export type CfdSensorProxySample = {
  flowFrameId: number;
  simulationTimeMs: number;
  fanPowerPct: number;
  cfdPressureDeltaLu: number;
  latticeDynamicPressure: number;
  sensorPressurePa: number;
  physicalDynamicPressurePa: number;
  runtimeConfiguration: CfdProxyRuntimeConfiguration;
};

export type CfdProxyRuntimeConfiguration = Pick<FlowRuntimeMetadata,
  | "generation"
  | "gridWidth"
  | "gridHeight"
  | "tau"
  | "requestedInletVelocity"
  | "actualInletVelocity"
  | "velocityScale"
  | "recovery"
  | "rebuildReason"
>;

export type CfdSensorProxySummary = {
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

export function captureCfdSensorProxySample(input: {
  frame: FlowFieldFrame;
  telemetry: TelemetryFrame;
  flowFrameId: number;
  runtimeConfiguration: CfdProxyRuntimeConfiguration;
}): CfdSensorProxySample | null {
  const { frame, telemetry, flowFrameId, runtimeConfiguration } = input;
  const actualLatticeInletVelocity = runtimeConfiguration.actualInletVelocity;
  if (telemetry.phase !== "sampling" || telemetry.quality !== "stable"
    || !Number.isInteger(flowFrameId) || flowFrameId < 1
    || !isFiniteRuntimeConfiguration(runtimeConfiguration)
    || !Number.isFinite(actualLatticeInletVelocity) || actualLatticeInletVelocity <= 0
    || !Number.isFinite(telemetry.windSpeedMps) || telemetry.windSpeedMps <= 0
    || !Number.isFinite(telemetry.underbodyPressurePa)) {
    return null;
  }

  const referencePressure = meanPressureInWindow(frame, REFERENCE_WINDOW);
  const underbodyPressure = meanPressureInWindow(frame, UNDERBODY_WINDOW);
  if (referencePressure === null || underbodyPressure === null) return null;

  const cfdPressureDeltaLu = underbodyPressure - referencePressure;
  const latticeDynamicPressure = 0.5 * actualLatticeInletVelocity ** 2;
  const physicalDynamicPressurePa = 0.5 * AIR_DENSITY_KG_M3 * telemetry.windSpeedMps ** 2;
  if (![cfdPressureDeltaLu, latticeDynamicPressure, physicalDynamicPressurePa].every(Number.isFinite)
    || latticeDynamicPressure <= MIN_DENOMINATOR
    || physicalDynamicPressurePa <= MIN_DENOMINATOR) {
    return null;
  }

  return {
    flowFrameId,
    simulationTimeMs: telemetry.simulationTimeMs,
    fanPowerPct: telemetry.fanPowerPct,
    cfdPressureDeltaLu,
    latticeDynamicPressure,
    sensorPressurePa: telemetry.underbodyPressurePa,
    physicalDynamicPressurePa,
    runtimeConfiguration: { ...runtimeConfiguration },
  };
}

export function summarizeCfdSensorProxySamples(samples: readonly CfdSensorProxySample[]): CfdSensorProxySummary {
  const finiteSamples = samples.filter(isFiniteProxySample);
  const runtimeConfigurations = uniqueRuntimeConfigurations(finiteSamples);
  const requestedInletVelocityRange = finiteRange(finiteSamples.map(({ runtimeConfiguration }) => runtimeConfiguration.requestedInletVelocity));
  const actualInletVelocityRange = finiteRange(finiteSamples.map(({ runtimeConfiguration }) => runtimeConfiguration.actualInletVelocity));
  if (finiteSamples.length < MIN_PROXY_SAMPLES) {
    return invalidSummary(
      finiteSamples.length,
      runtimeConfigurations,
      requestedInletVelocityRange,
      actualInletVelocityRange,
    );
  }

  const totals = finiteSamples.reduce((sum, sample) => ({
    cfdPressureDeltaLu: sum.cfdPressureDeltaLu + sample.cfdPressureDeltaLu,
    latticeDynamicPressure: sum.latticeDynamicPressure + sample.latticeDynamicPressure,
    sensorPressurePa: sum.sensorPressurePa + sample.sensorPressurePa,
    physicalDynamicPressurePa: sum.physicalDynamicPressurePa + sample.physicalDynamicPressurePa,
  }), {
    cfdPressureDeltaLu: 0,
    latticeDynamicPressure: 0,
    sensorPressurePa: 0,
    physicalDynamicPressurePa: 0,
  });
  if (totals.latticeDynamicPressure <= MIN_DENOMINATOR
    || totals.physicalDynamicPressurePa <= MIN_DENOMINATOR) {
    return invalidSummary(
      finiteSamples.length,
      runtimeConfigurations,
      requestedInletVelocityRange,
      actualInletVelocityRange,
    );
  }

  const cfdPressureCoefficient = totals.cfdPressureDeltaLu / totals.latticeDynamicPressure;
  const sensorPressureCoefficient = totals.sensorPressurePa / totals.physicalDynamicPressurePa;
  const signedResidual = sensorPressureCoefficient - cfdPressureCoefficient;
  const absoluteResidual = Math.abs(signedResidual);
  const normalizedResidualPct = absoluteResidual / Math.max(Math.abs(sensorPressureCoefficient), MIN_DENOMINATOR) * 100;
  if (![cfdPressureCoefficient, sensorPressureCoefficient, signedResidual, absoluteResidual, normalizedResidualPct]
    .every(Number.isFinite)) {
    return invalidSummary(
      finiteSamples.length,
      runtimeConfigurations,
      requestedInletVelocityRange,
      actualInletVelocityRange,
    );
  }

  return {
    valid: true,
    sampleCount: finiteSamples.length,
    cfdPressureCoefficient,
    sensorPressureCoefficient,
    signedResidual,
    absoluteResidual,
    normalizedResidualPct,
    runtimeConfigurations,
    mixedRuntimeConfiguration: runtimeConfigurations.length > 1,
    requestedInletVelocityRange,
    actualInletVelocityRange,
  };
}

function meanPressureInWindow(
  frame: FlowFieldFrame,
  window: { uMin: number; uMax: number; vMin: number; vMax: number },
): number | null {
  if (!Number.isInteger(frame.width) || frame.width < 1
    || !Number.isInteger(frame.height) || frame.height < 1
    || frame.pressure.length < frame.width * frame.height) return null;

  let total = 0;
  let count = 0;
  for (let y = 0; y < frame.height; y += 1) {
    const v = (y + 0.5) / frame.height;
    if (v < window.vMin || v >= window.vMax) continue;
    for (let x = 0; x < frame.width; x += 1) {
      const u = (x + 0.5) / frame.width;
      if (u < window.uMin || u >= window.uMax) continue;
      const value = frame.pressure[y * frame.width + x];
      if (value === undefined || !Number.isFinite(value)) return null;
      total += value;
      count += 1;
    }
  }
  return count > 0 && Number.isFinite(total) ? total / count : null;
}

function isFiniteProxySample(sample: CfdSensorProxySample): boolean {
  return Number.isInteger(sample.flowFrameId) && sample.flowFrameId > 0
    && Number.isFinite(sample.simulationTimeMs)
    && Number.isFinite(sample.fanPowerPct)
    && Number.isFinite(sample.cfdPressureDeltaLu)
    && Number.isFinite(sample.latticeDynamicPressure) && sample.latticeDynamicPressure > MIN_DENOMINATOR
    && Number.isFinite(sample.sensorPressurePa)
    && Number.isFinite(sample.physicalDynamicPressurePa) && sample.physicalDynamicPressurePa > MIN_DENOMINATOR
    && isFiniteRuntimeConfiguration(sample.runtimeConfiguration);
}

function isFiniteRuntimeConfiguration(configuration: CfdProxyRuntimeConfiguration): boolean {
  return Number.isInteger(configuration.generation) && configuration.generation >= 0
    && Number.isInteger(configuration.gridWidth) && configuration.gridWidth > 0
    && Number.isInteger(configuration.gridHeight) && configuration.gridHeight > 0
    && Number.isFinite(configuration.tau) && configuration.tau > 0
    && Number.isFinite(configuration.requestedInletVelocity) && configuration.requestedInletVelocity >= 0
    && Number.isFinite(configuration.actualInletVelocity) && configuration.actualInletVelocity > 0
    && Number.isFinite(configuration.velocityScale) && configuration.velocityScale > 0;
}

function uniqueRuntimeConfigurations(samples: readonly CfdSensorProxySample[]): CfdProxyRuntimeConfiguration[] {
  const configurations = new Map<string, CfdProxyRuntimeConfiguration>();
  for (const sample of samples) {
    const configuration = sample.runtimeConfiguration;
    const key = [
      configuration.generation,
      configuration.gridWidth,
      configuration.gridHeight,
      configuration.tau,
      configuration.velocityScale,
      configuration.recovery,
      configuration.rebuildReason,
    ].join("|");
    if (!configurations.has(key)) configurations.set(key, { ...configuration });
  }
  return [...configurations.values()];
}

function invalidSummary(
  sampleCount: number,
  runtimeConfigurations: CfdProxyRuntimeConfiguration[] = [],
  requestedInletVelocityRange: { min: number; max: number } | null = null,
  actualInletVelocityRange: { min: number; max: number } | null = null,
): CfdSensorProxySummary {
  return {
    valid: false,
    sampleCount,
    cfdPressureCoefficient: null,
    sensorPressureCoefficient: null,
    signedResidual: null,
    absoluteResidual: null,
    normalizedResidualPct: null,
    runtimeConfigurations,
    mixedRuntimeConfiguration: runtimeConfigurations.length > 1,
    requestedInletVelocityRange,
    actualInletVelocityRange,
  };
}

function finiteRange(values: readonly number[]): { min: number; max: number } | null {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}
