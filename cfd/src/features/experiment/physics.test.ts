import { describe, expect, it } from "vitest";
import { calculateDynamicPressure, stepFirstOrder } from "./physics";

describe("physics", () => {
  it("calculates standard-air dynamic pressure", () => {
    expect(calculateDynamicPressure(1.225, 10)).toBeCloseTo(61.25, 5);
  });

  it("moves a first-order response toward its target without overshoot", () => {
    const next = stepFirstOrder(0, 100, 50, 1000);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(100);
  });
});
