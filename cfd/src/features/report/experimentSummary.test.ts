import { expect, it } from "vitest";
import { summarizeRun } from "./experimentSummary";

it("uses only stable samples for run statistics", () => {
  const summary = summarizeRun([
    { simulationTimeMs: 0, quality: "transient", windSpeedMps: 99, rpm: 99, underbodyPressurePa: 99, verticalLoadN: 99 },
    { simulationTimeMs: 50, quality: "stable", windSpeedMps: 4, rpm: 2_000, underbodyPressurePa: -10, verticalLoadN: 0.2 },
    { simulationTimeMs: 100, quality: "stable", windSpeedMps: 6, rpm: 3_000, underbodyPressurePa: -20, verticalLoadN: 0.4 },
  ]);

  expect(summary).toMatchObject({
    sampleCount: 2,
    valid: false,
    meanWindSpeedMps: 5,
    meanRpm: 2_500,
    meanUnderbodyPressurePa: -15,
    minSimulationTimeMs: 50,
    maxSimulationTimeMs: 100,
  });
  expect(summary.meanVerticalLoadN).toBeCloseTo(0.3, 8);
  expect(summary.windSpeedMps).toEqual({ mean: 5, standardDeviation: 1, min: 4, max: 6 });
  expect(summary.verticalLoadN.standardDeviation).toBeCloseTo(0.1, 8);
});

it("marks a run valid only from twenty stable samples", () => {
  const sample = { simulationTimeMs: 50, quality: "stable" as const, windSpeedMps: 4, rpm: 2_000, underbodyPressurePa: -10, verticalLoadN: 0.2 };
  expect(summarizeRun(Array.from({ length: 19 }, () => sample)).valid).toBe(false);
  expect(summarizeRun(Array.from({ length: 20 }, () => sample)).valid).toBe(true);
});

it("returns empty nullable statistics when no stable sample exists", () => {
  const summary = summarizeRun([]);
  expect(summary).toMatchObject({ sampleCount: 0, valid: false, minSimulationTimeMs: null, maxSimulationTimeMs: null });
  expect(summary.windSpeedMps).toEqual({ mean: null, standardDeviation: null, min: null, max: null });
});

it.each([
  ["simulation time NaN", { simulationTimeMs: Number.NaN }],
  ["RPM infinity", { rpm: Number.POSITIVE_INFINITY }],
  ["wind NaN", { windSpeedMps: Number.NaN }],
  ["pressure negative infinity", { underbodyPressurePa: Number.NEGATIVE_INFINITY }],
  ["load infinity", { verticalLoadN: Number.POSITIVE_INFINITY }],
])("drops an otherwise stable sample with non-finite %s", (_label, invalidField) => {
  const validSample = {
    simulationTimeMs: 50,
    quality: "stable" as const,
    windSpeedMps: 4,
    rpm: 2_000,
    underbodyPressurePa: -10,
    verticalLoadN: 0.2,
  };
  const summary = summarizeRun([
    ...Array.from({ length: 19 }, () => validSample),
    { ...validSample, ...invalidField },
  ]);

  expect(summary).toMatchObject({ sampleCount: 19, valid: false });
  expect(summary.rpm.mean === null || Number.isFinite(summary.rpm.mean)).toBe(true);
  expect(summary.windSpeedMps.mean === null || Number.isFinite(summary.windSpeedMps.mean)).toBe(true);
});

it("returns empty statistics when every stable frame is non-finite", () => {
  const summary = summarizeRun(Array.from({ length: 20 }, () => ({
    simulationTimeMs: Number.NaN,
    quality: "stable" as const,
    windSpeedMps: Number.POSITIVE_INFINITY,
    rpm: Number.NaN,
    underbodyPressurePa: Number.NEGATIVE_INFINITY,
    verticalLoadN: Number.POSITIVE_INFINITY,
  })));

  expect(summary).toMatchObject({ sampleCount: 0, valid: false });
  expect(summary.rpm.mean).toBeNull();
  expect(summary.maxSimulationTimeMs).toBeNull();
});
