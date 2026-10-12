import type { RunPhase, SimulationConfig, TelemetryFrame, TelemetrySource } from "./model";
import { calculateDynamicPressure, stepFirstOrder } from "./physics";

const defaultConfig: SimulationConfig = {
  maxRpm: 6200,
  maxWindSpeedMps: 12,
  airDensityKgM3: 1.225,
  referenceAreaM2: 0.018,
  pressureCoefficient: 0.62,
  liftCoefficient: 0.38,
  rampTauMs: 1200,
  coastTauMs: 650,
  windTauMs: 900,
};

type PhysicalState = {
  rpm: number;
  windSpeedMps: number;
  underbodyPressurePa: number;
  verticalLoadN: number;
};

class XorShift32 {
  private readonly initialValue: number;
  private value: number;

  constructor(seed: number) {
    this.initialValue = (seed >>> 0) || 0x6d2b79f5;
    this.value = this.initialValue;
  }

  nextSigned(): number {
    let value = this.value;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.value = value >>> 0;
    return (this.value / 0xffffffff) * 2 - 1;
  }

  reset(): void {
    this.value = this.initialValue;
  }
}

class DefaultSimulationSource implements TelemetrySource {
  private readonly random: XorShift32;
  private readonly config: SimulationConfig;
  private fanPowerPct = 0;
  private phase: RunPhase = "idle";
  private sequence = 0;
  private simulationTimeMs = 0;
  private physical: PhysicalState = { rpm: 0, windSpeedMps: 0, underbodyPressurePa: 0, verticalLoadN: 0 };
  private previousWindSpeedMps = 0;
  private readonly windDelay: number[] = [0];
  private readonly pressureDelay: number[] = [0, 0];
  private readonly loadDelay: number[] = [0, 0];

  constructor(seed: number, config: SimulationConfig = defaultConfig) {
    this.random = new XorShift32(seed);
    this.config = config;
  }

  setFanPower(percent: number): void {
    this.fanPowerPct = Math.min(100, Math.max(0, percent));
  }

  setPhase(phase: RunPhase): void {
    this.phase = phase;
  }

  step(dtMs: number): TelemetryFrame {
    const safeDtMs = Math.max(0, dtMs);
    const targetRpm = this.config.maxRpm * (this.fanPowerPct / 100);
    const rpmTauMs = targetRpm >= this.physical.rpm ? this.config.rampTauMs : this.config.coastTauMs;
    const nextRpm = stepFirstOrder(this.physical.rpm, targetRpm, safeDtMs, rpmTauMs);
    const targetWindSpeedMps = this.config.maxWindSpeedMps * (nextRpm / this.config.maxRpm);
    const nextWindSpeedMps = stepFirstOrder(
      this.physical.windSpeedMps,
      targetWindSpeedMps,
      safeDtMs,
      this.config.windTauMs,
    );
    const dynamicPressure = calculateDynamicPressure(this.config.airDensityKgM3, nextWindSpeedMps);
    const nextPressurePa = -dynamicPressure * this.config.pressureCoefficient;
    const nextLoadN = dynamicPressure * this.config.referenceAreaM2 * this.config.liftCoefficient;
    const windChange = Math.abs(nextWindSpeedMps - this.previousWindSpeedMps);
    const isStable = targetRpm > 0
      && Math.abs(nextRpm - targetRpm) <= targetRpm * 0.03
      && windChange < 0.03;

    this.physical = {
      rpm: nextRpm,
      windSpeedMps: nextWindSpeedMps,
      underbodyPressurePa: nextPressurePa,
      verticalLoadN: nextLoadN,
    };
    this.previousWindSpeedMps = nextWindSpeedMps;
    this.simulationTimeMs += safeDtMs;

    const delayedWind = this.shiftDelay(this.windDelay, nextWindSpeedMps);
    const delayedPressure = this.shiftDelay(this.pressureDelay, nextPressurePa);
    const delayedLoad = this.shiftDelay(this.loadDelay, nextLoadN);
    const driftPressure = 0.35 * Math.sin(this.simulationTimeMs / 45000);
    const driftLoad = 0.006 * Math.sin(this.simulationTimeMs / 60000);

    return {
      sequence: this.sequence++,
      simulationTimeMs: this.simulationTimeMs,
      phase: this.phase,
      fanPowerPct: this.fanPowerPct,
      rpm: nextRpm * (1 + this.random.nextSigned() * 0.0035),
      windSpeedMps: delayedWind * (1 + this.random.nextSigned() * 0.005),
      underbodyPressurePa: delayedPressure + this.random.nextSigned() * 0.8 + driftPressure,
      verticalLoadN: delayedLoad + this.random.nextSigned() * 0.015 + driftLoad,
      quality: isStable ? "stable" : "transient",
      provenance: "simulated",
    };
  }

  reset(): TelemetryFrame {
    this.random.reset();
    this.fanPowerPct = 0;
    this.phase = "idle";
    this.sequence = 0;
    this.simulationTimeMs = 0;
    this.physical = { rpm: 0, windSpeedMps: 0, underbodyPressurePa: 0, verticalLoadN: 0 };
    this.previousWindSpeedMps = 0;
    this.windDelay.splice(0, this.windDelay.length, 0);
    this.pressureDelay.splice(0, this.pressureDelay.length, 0, 0);
    this.loadDelay.splice(0, this.loadDelay.length, 0, 0);
    return {
      sequence: 0,
      simulationTimeMs: 0,
      phase: "idle",
      fanPowerPct: 0,
      rpm: 0,
      windSpeedMps: 0,
      underbodyPressurePa: 0,
      verticalLoadN: 0,
      quality: "transient",
      provenance: "simulated",
    };
  }

  private shiftDelay(values: number[], nextValue: number): number {
    const delayed = values.shift()!;
    values.push(nextValue);
    return delayed;
  }
}

export function createDefaultSimulationSource(seed: number): TelemetrySource {
  return new DefaultSimulationSource(seed);
}
