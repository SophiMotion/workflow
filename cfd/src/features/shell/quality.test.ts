import { describe, expect, it, vi } from "vitest";
import { AdaptiveQualityController, selectQualityProfile } from "./quality";

describe("selectQualityProfile", () => {
  it("disables particles for reduced motion", () => {
    expect(selectQualityProfile({
      viewportWidth: 1440,
      hardwareConcurrency: 12,
      reducedMotion: true,
    })).toMatchObject({ name: "reduced", grid: [160, 64], particleCount: 0, chartRefreshHz: 5 });
  });

  it("uses the low profile on a narrow four-core device", () => {
    expect(selectQualityProfile({
      viewportWidth: 390,
      hardwareConcurrency: 4,
      reducedMotion: false,
    })).toMatchObject({ name: "low", grid: [160, 64], particleCount: 300, chartRefreshHz: 5 });
  });

  it("selects the exact high and medium profiles", () => {
    expect(selectQualityProfile({
      viewportWidth: 1440,
      hardwareConcurrency: 12,
      reducedMotion: false,
    })).toEqual({ name: "high", grid: [320, 128], particleCount: 1_400, chartRefreshHz: 10 });
    expect(selectQualityProfile({
      viewportWidth: 1024,
      hardwareConcurrency: 8,
      reducedMotion: false,
    })).toEqual({ name: "medium", grid: [240, 96], particleCount: 900, chartRefreshHz: 10 });
  });
});

describe("AdaptiveQualityController", () => {
  it("degrades one level after three seconds of sustained slow frames", () => {
    const changes: string[] = [];
    const controller = new AdaptiveQualityController("high", (profile) => changes.push(profile.name));
    for (let elapsed = 0; elapsed < 3_100; elapsed += 50) controller.recordFrame(50);
    expect(changes).toEqual(["medium"]);
  });

  it("clears its window and requires another slow interval before degrading again", () => {
    const changes: string[] = [];
    const controller = new AdaptiveQualityController("high", (profile) => changes.push(profile.name));
    for (let elapsed = 0; elapsed < 3_100; elapsed += 50) controller.recordFrame(50);
    controller.setProfile("medium");
    for (let elapsed = 0; elapsed < 2_900; elapsed += 50) controller.recordFrame(50);
    expect(changes).toEqual(["medium"]);
    for (let elapsed = 2_900; elapsed < 3_100; elapsed += 50) controller.recordFrame(50);
    expect(changes).toEqual(["medium", "low"]);
  });

  it("does not emit per-frame events or degrade below low", () => {
    const onChange = vi.fn();
    const controller = new AdaptiveQualityController("low", onChange);
    for (let elapsed = 0; elapsed < 6_200; elapsed += 50) controller.recordFrame(50);
    expect(onChange).not.toHaveBeenCalled();
  });
});
