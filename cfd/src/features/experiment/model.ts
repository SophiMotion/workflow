export type RunPhase = "idle" | "ramping" | "stabilizing" | "sampling" | "paused" | "completed";
export type ActiveRunPhase = Exclude<RunPhase, "idle" | "paused" | "completed">;

export type TelemetryFrame = {
  sequence: number;
  simulationTimeMs: number;
  phase: RunPhase;
  fanPowerPct: number;
  rpm: number;
  windSpeedMps: number;
  underbodyPressurePa: number;
  verticalLoadN: number;
  quality: "transient" | "stable" | "invalid";
  provenance: "simulated";
};

export type SimulationConfig = {
  maxRpm: number;
  maxWindSpeedMps: number;
  airDensityKgM3: number;
  referenceAreaM2: number;
  pressureCoefficient: number;
  liftCoefficient: number;
  rampTauMs: number;
  coastTauMs: number;
  windTauMs: number;
};

export interface TelemetrySource {
  setFanPower(percent: number): void;
  setPhase(phase: RunPhase): void;
  step(dtMs: number): TelemetryFrame;
  reset(): TelemetryFrame;
}
