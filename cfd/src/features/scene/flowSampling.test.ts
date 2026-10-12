import { sampleFlowVelocity, sampleFlowVelocityInto } from "./flowSampling";

it("bilinearly samples a normalized flow coordinate", () => {
  const frame = {
    width: 2,
    height: 2,
    velocityX: new Float32Array([0, 2, 4, 6]),
    velocityY: new Float32Array([0, 0, 2, 2]),
  };

  expect(sampleFlowVelocity(frame, 0.5, 0.5)).toEqual({ x: 3, y: 1 });
});

it("clamps samples to the field boundary", () => {
  const frame = {
    width: 2,
    height: 1,
    velocityX: new Float32Array([1, 2]),
    velocityY: new Float32Array([0, 0]),
  };

  expect(sampleFlowVelocity(frame, 9, 0).x).toBe(2);
});

it("samples into a reusable output object without replacing it", () => {
  const frame = {
    width: 2,
    height: 2,
    velocityX: new Float32Array([0, 2, 4, 6]),
    velocityY: new Float32Array([0, 0, 2, 2]),
  };
  const output = { x: -1, y: -1 };

  expect(sampleFlowVelocityInto(frame, 0.5, 0.5, output)).toBe(output);
  expect(output).toEqual({ x: 3, y: 1 });
});
