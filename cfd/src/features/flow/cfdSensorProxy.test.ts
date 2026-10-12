import { describe, expect, it } from "vitest";
import type { TelemetryFrame } from "../experiment/model";
import type { FlowFieldFrame } from "./types";
import {
  captureCfdSensorProxySample,
  summarizeCfdSensorProxySamples,
} from "./cfdSensorProxy";

const runtimeConfiguration = {
  generation: 1,
  gridWidth: 20,
  gridHeight: 20,
  tau: 0.62,
  requestedInletVelocity: 0.1,
  actualInletVelocity: 0.1,
  velocityScale: 1,
  recovery: "none" as const,
  rebuildReason: "initial" as const,
};

function fieldWithPressureWindows(): FlowFieldFrame {
  const width = 20;
  const height = 20;
  const pressure = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const v = (y + 0.5) / height;
      if (v >= 0.70 && v < 0.85 && u >= 0.15 && u < 0.30) pressure[y * width + x] = 0.02;
      if (v >= 0.70 && v < 0.85 && u >= 0.40 && u < 0.65) pressure[y * width + x] = -0.01;
    }
  }
  return {
    width,
    height,
    pressure,
    speed: new Float32Array(width * height),
    vorticity: new Float32Array(width * height),
    velocityX: new Float32Array(width * height),
    velocityY: new Float32Array(width * height),
    provenance: "2d-teaching-cfd",
  };
}

function telemetry(overrides: Partial<TelemetryFrame> = {}): TelemetryFrame {
  return {
    sequence: 12,
    simulationTimeMs: 600,
    phase: "sampling",
    fanPowerPct: 30,
    rpm: 1_860,
    windSpeedMps: 10,
    underbodyPressurePa: -12.25,
    verticalLoadN: 0.1,
    quality: "stable",
    provenance: "simulated",
    ...overrides,
  };
}

describe("CFD ↔ virtual pressure-sensor proxy", () => {
  it("captures fixed-window pressure numerators with explicit lattice and SI denominators", () => {
    const sample = captureCfdSensorProxySample({
      frame: fieldWithPressureWindows(),
      telemetry: telemetry(),
      flowFrameId: 7,
      runtimeConfiguration,
    });

    expect(sample).toMatchObject({
      flowFrameId: 7,
      simulationTimeMs: 600,
      fanPowerPct: 30,
      sensorPressurePa: -12.25,
    });
    expect(sample?.cfdPressureDeltaLu).toBeCloseTo(-0.03, 8);
    expect(sample?.latticeDynamicPressure).toBeCloseTo(0.005, 8);
    expect(sample?.physicalDynamicPressurePa).toBeCloseTo(61.25, 8);
  });

  it("compares dimensionless pressure coefficients without calling the proxy a force", () => {
    const sample = captureCfdSensorProxySample({
      frame: fieldWithPressureWindows(),
      telemetry: telemetry(),
      flowFrameId: 7,
      runtimeConfiguration,
    })!;

    const summary = summarizeCfdSensorProxySamples([
      sample,
      { ...sample, flowFrameId: 8, simulationTimeMs: 650 },
      { ...sample, flowFrameId: 9, simulationTimeMs: 700 },
      { ...sample, flowFrameId: 10, simulationTimeMs: 750 },
      { ...sample, flowFrameId: 11, simulationTimeMs: 800 },
    ]);
    expect(summary).toMatchObject({
      valid: true,
      sampleCount: 5,
    });
    expect(summary.cfdPressureCoefficient).toBeCloseTo(-6, 6);
    expect(summary.sensorPressureCoefficient).toBeCloseTo(-0.2, 8);
    expect(summary.signedResidual).toBeCloseTo(5.8, 6);
    expect(summary.absoluteResidual).toBeCloseTo(5.8, 6);
    expect(summary.normalizedResidualPct).toBeCloseTo(2900, 3);
  });

  it("freezes and reports mixed solver configurations used inside one condition", () => {
    const first = captureCfdSensorProxySample({
      frame: fieldWithPressureWindows(),
      telemetry: telemetry(),
      flowFrameId: 21,
      runtimeConfiguration: {
        generation: 2,
        gridWidth: 240,
        gridHeight: 96,
        tau: 0.62,
        requestedInletVelocity: 0.08,
        actualInletVelocity: 0.08,
        velocityScale: 1,
        recovery: "none",
        rebuildReason: "initial",
      },
    })!;
    const degraded = {
      ...first,
      flowFrameId: 24,
      runtimeConfiguration: {
        generation: 3,
        gridWidth: 160,
        gridHeight: 64,
        tau: 0.62,
        requestedInletVelocity: 0.08,
        actualInletVelocity: 0.064,
        velocityScale: 0.8,
        recovery: "non-finite-field-scale" as const,
        rebuildReason: "non-finite-restart" as const,
      },
    };

    const summary = summarizeCfdSensorProxySamples([
      first,
      { ...first, flowFrameId: 22 },
      { ...first, flowFrameId: 23 },
      degraded,
      { ...degraded, flowFrameId: 25 },
    ]);

    expect(summary.mixedRuntimeConfiguration).toBe(true);
    expect(summary.runtimeConfigurations).toEqual([
      first.runtimeConfiguration,
      degraded.runtimeConfiguration,
    ]);
  });

  it("treats changing inlet samples as one solver configuration and reports their range", () => {
    const first = captureCfdSensorProxySample({
      frame: fieldWithPressureWindows(),
      telemetry: telemetry(),
      flowFrameId: 31,
      runtimeConfiguration,
    })!;
    const samples = Array.from({ length: 5 }, (_, index) => ({
      ...first,
      flowFrameId: 31 + index,
      runtimeConfiguration: {
        ...first.runtimeConfiguration,
        requestedInletVelocity: 0.06 + index * 0.005,
        actualInletVelocity: 0.05 + index * 0.005,
      },
    }));

    const summary = summarizeCfdSensorProxySamples(samples);

    expect(summary.mixedRuntimeConfiguration).toBe(false);
    expect(summary.requestedInletVelocityRange).toEqual({ min: 0.06, max: 0.08 });
    expect(summary.actualInletVelocityRange).toEqual({ min: 0.05, max: 0.07 });
  });

  it("rejects zero, non-finite, transient, and non-sampling inputs", () => {
    const field = fieldWithPressureWindows();
    expect(captureCfdSensorProxySample({
      frame: field,
      telemetry: telemetry(),
      flowFrameId: 1,
      runtimeConfiguration: { ...runtimeConfiguration, actualInletVelocity: 0 },
    })).toBeNull();
    expect(captureCfdSensorProxySample({
      frame: field,
      telemetry: telemetry({ quality: "transient" }),
      flowFrameId: 1,
      runtimeConfiguration,
    })).toBeNull();
    expect(captureCfdSensorProxySample({
      frame: field,
      telemetry: telemetry({ phase: "stabilizing" }),
      flowFrameId: 1,
      runtimeConfiguration,
    })).toBeNull();
    expect(summarizeCfdSensorProxySamples([
      {
        flowFrameId: 1,
        simulationTimeMs: 50,
        fanPowerPct: 30,
        cfdPressureDeltaLu: -0.01,
        latticeDynamicPressure: 0.005,
        sensorPressurePa: -1,
        physicalDynamicPressurePa: 5,
        runtimeConfiguration,
      },
      {
        flowFrameId: 2,
        simulationTimeMs: 100,
        fanPowerPct: 30,
        cfdPressureDeltaLu: -0.01,
        latticeDynamicPressure: 0.005,
        sensorPressurePa: -1,
        physicalDynamicPressurePa: 5,
        runtimeConfiguration,
      },
      {
        flowFrameId: 3,
        simulationTimeMs: 150,
        fanPowerPct: 30,
        cfdPressureDeltaLu: -0.01,
        latticeDynamicPressure: 0.005,
        sensorPressurePa: -1,
        physicalDynamicPressurePa: 5,
        runtimeConfiguration,
      },
      {
        flowFrameId: 4,
        simulationTimeMs: 200,
        fanPowerPct: 30,
        cfdPressureDeltaLu: -0.01,
        latticeDynamicPressure: 0.005,
        sensorPressurePa: -1,
        physicalDynamicPressurePa: 5,
        runtimeConfiguration,
      },
    ]).valid).toBe(false);
    expect(summarizeCfdSensorProxySamples([]).valid).toBe(false);
  });
});
