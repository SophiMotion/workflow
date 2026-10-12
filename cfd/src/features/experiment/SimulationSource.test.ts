import { describe, expect, it } from "vitest";
import { createDefaultSimulationSource } from "./SimulationSource";

describe("SimulationSource", () => {
  it("replays identical telemetry for an identical seed and command sequence", () => {
    const a = createDefaultSimulationSource(42);
    const b = createDefaultSimulationSource(42);
    a.setFanPower(60); b.setFanPower(60);
    const framesA = Array.from({ length: 80 }, () => a.step(50));
    const framesB = Array.from({ length: 80 }, () => b.step(50));
    expect(framesA).toEqual(framesB);
    expect(framesA.at(-1)!.windSpeedMps).toBeGreaterThan(0);
  });

  it("labels every generated frame as simulated", () => {
    const source = createDefaultSimulationSource(1);
    expect(source.step(50).provenance).toBe("simulated");
  });

  it("returns an exact zero frame when reset without consuming a sample", () => {
    const source = createDefaultSimulationSource(42);
    source.setFanPower(60);
    source.setPhase("ramping");
    source.step(50);

    const resetFrame = source.reset();
    expect(resetFrame).toEqual({
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
    });
  });

  it("replays the identical sequence after resetting the same source", () => {
    const source = createDefaultSimulationSource(42);
    source.setFanPower(60);
    source.setPhase("ramping");
    const firstRun = Array.from({ length: 80 }, () => source.step(50));

    source.reset();
    source.setFanPower(60);
    source.setPhase("ramping");
    const replay = Array.from({ length: 80 }, () => source.step(50));
    expect(replay).toEqual(firstRun);
  });
});
