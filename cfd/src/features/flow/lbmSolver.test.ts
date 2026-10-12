import { LbmSolver, NumericalInstabilityError } from "./lbmSolver";
import { createCarProfileMask } from "./obstacleMask";

it("preserves a finite rest field", () => {
  const solver = new LbmSolver({ width: 48, height: 24, inletVelocity: 0, tau: 0.62, obstacleMask: new Uint8Array(48 * 24) });
  const frame = solver.step(20);
  expect(Math.max(...frame.speed)).toBeCloseTo(0, 6);
  expect(Array.from(frame.pressure).every(Number.isFinite)).toBe(true);
  const meanPressure = Array.from(frame.pressure).reduce((sum, value) => sum + value, 0) / frame.pressure.length;
  expect(meanPressure).toBeCloseTo(0, 6);
});

it("produces a vehicle wake deficit relative to an empty tunnel", () => {
  const width = 96;
  const height = 40;
  const emptyMask = new Uint8Array(width * height);
  const vehicleFrame = new LbmSolver({ width, height, inletVelocity: 0.055, tau: 0.62, obstacleMask: createCarProfileMask(width, height) }).step(160);
  const emptyFrame = new LbmSolver({ width, height, inletVelocity: 0.055, tau: 0.62, obstacleMask: emptyMask }).step(160);

  const meanSpeed = (frame: { speed: Float32Array }) => {
    let total = 0;
    let sampleCount = 0;
    for (let y = 18; y <= 23; y += 1) {
      for (let x = 68; x <= 82; x += 1) {
        total += frame.speed[y * width + x]!;
        sampleCount += 1;
      }
    }
    return total / sampleCount;
  };

  const vehicleWake = meanSpeed(vehicleFrame);
  const emptyTunnel = meanSpeed(emptyFrame);
  expect(emptyTunnel).toBeGreaterThan(0.02);
  expect(vehicleWake).toBeLessThan(emptyTunnel * 0.92);
  expect(Array.from(vehicleFrame.vorticity).every(Number.isFinite)).toBe(true);
});

it("keeps solid-cell speed at zero", () => {
  const width = 64;
  const height = 32;
  const mask = createCarProfileMask(width, height);
  const solver = new LbmSolver({ width, height, inletVelocity: 0.04, tau: 0.62, obstacleMask: mask });
  const frame = solver.step(40);
  const solidIndex = mask.findIndex((cell) => cell === 1);
  expect(frame.speed[solidIndex]).toBe(0);
});

it("keeps every driven-field component finite", () => {
  const width = 72;
  const height = 32;
  const solver = new LbmSolver({ width, height, inletVelocity: 0.08, tau: 0.62, obstacleMask: createCarProfileMask(width, height) });
  const frame = solver.step(120);

  for (const field of [frame.speed, frame.pressure, frame.vorticity, frame.velocityX, frame.velocityY]) {
    expect(Array.from(field).every(Number.isFinite)).toBe(true);
  }
});

it("clamps inlet velocity and rejects unstable relaxation time", () => {
  const width = 24;
  const height = 12;
  const obstacleMask = new Uint8Array(width * height);
  expect(() => new LbmSolver({ width, height, inletVelocity: 0, tau: 0.5, obstacleMask })).toThrow(RangeError);

  const solver = new LbmSolver({ width, height, inletVelocity: 1, tau: 0.62, obstacleMask });
  let frame = solver.step(1);
  expect(frame.speed[Math.floor(height / 2) * width]).toBeCloseTo(0.08, 6);

  solver.setInletVelocity(-1);
  frame = solver.step(1);
  expect(frame.speed[Math.floor(height / 2) * width]).toBeCloseTo(0, 6);
});

it("throws a typed error instead of returning non-finite fields", () => {
  const width = 24;
  const height = 12;
  const solver = new LbmSolver({ width, height, inletVelocity: Number.NaN, tau: 0.62, obstacleMask: new Uint8Array(width * height) });

  let thrown: unknown;
  try {
    solver.step(1);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(NumericalInstabilityError);
  expect(thrown).toMatchObject({ code: "NON_FINITE_FIELD" });
});
