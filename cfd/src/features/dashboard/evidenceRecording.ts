import type { TelemetryFrame } from "../experiment/model";
import type { TutorialEvidence } from "../tutorial/tutorialProgress";
import type { FieldId } from "./FieldSelector";
import type { SensorId } from "./TelemetryCards";

export function recordStableTelemetry(
  evidence: TutorialEvidence,
  previous: TelemetryFrame,
  next: TelemetryFrame,
  commandedFanPower: number,
  manualRunRevision?: number,
): TutorialEvidence {
  if (manualRunRevision !== undefined && evidence.stableRunRevision !== manualRunRevision) {
    return { ...evidence, stableSeconds: 0, stableRunRevision: manualRunRevision };
  }
  const elapsedSeconds = (next.simulationTimeMs - previous.simulationTimeMs) / 1000;
  const previousActive = previous.phase === "ramping" || previous.phase === "stabilizing" || previous.phase === "sampling";
  const activePhase = next.phase === "ramping" || next.phase === "stabilizing" || next.phase === "sampling";
  const continuesStableWindow = commandedFanPower === 30
    && previous.fanPowerPct === 30
    && next.fanPowerPct === 30
    && previous.quality === "stable"
    && next.quality === "stable"
    && previousActive
    && activePhase
    && Number.isFinite(elapsedSeconds)
    && elapsedSeconds > 0
    && elapsedSeconds <= 1;
  if (!continuesStableWindow) {
    return evidence.stableSeconds === 0 ? evidence : { ...evidence, stableSeconds: 0 };
  }

  // `quality` comes from the source's physical state before sensor noise is applied.
  return {
    ...evidence,
    stableSeconds: Math.round((evidence.stableSeconds + elapsedSeconds) * 1000) / 1000,
    ...(manualRunRevision === undefined ? {} : { stableRunRevision: manualRunRevision }),
  };
}

export function recordSensorInspection(evidence: TutorialEvidence, sensor: SensorId): TutorialEvidence {
  return { ...evidence, viewedSensors: appendUnique(evidence.viewedSensors, sensor) };
}

export function recordFieldInspection(evidence: TutorialEvidence, field: FieldId): TutorialEvidence {
  return { ...evidence, viewedFields: appendUnique(evidence.viewedFields, field) };
}

export function recordStableWindowInspection(evidence: TutorialEvidence): TutorialEvidence {
  return evidence.inspectedStableWindow ? evidence : { ...evidence, inspectedStableWindow: true };
}

function appendUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}
