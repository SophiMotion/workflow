import type { Diagnostic } from '@sophicad/schema';

export type Point2 = [number, number];

export interface FourBarInput {
  ground: number;
  input: number;
  coupler: number;
  output: number;
  inputAngle: number;
  branch: 'open' | 'crossed';
  previousOutputAngle?: number;
}

export interface FourBarSolution {
  ok: true;
  pivots: {
    groundInput: Point2;
    inputCoupler: Point2;
    couplerOutput: Point2;
    groundOutput: Point2;
  };
  inputAngle: number;
  couplerAngle: number;
  outputAngle: number;
  branch: 'open' | 'crossed';
}

export interface FourBarFailure {
  ok: false;
  diagnostic: Diagnostic;
}

export function unwrapAngle(angle: number, previousAngle: number): number {
  if (!Number.isFinite(angle) || !Number.isFinite(previousAngle)) {
    throw new TypeError('角度必须是有限数。');
  }
  let result = angle;
  while (result - previousAngle > Math.PI) result -= 2 * Math.PI;
  while (result - previousAngle < -Math.PI) result += 2 * Math.PI;
  return result;
}

function failure(code: string, message: string): FourBarFailure {
  return {
    ok: false,
    diagnostic: { severity: 'error', code, message },
  };
}

function cross(origin: Point2, first: Point2, second: Point2): number {
  return (first[0] - origin[0]) * (second[1] - origin[1])
    - (first[1] - origin[1]) * (second[0] - origin[0]);
}

export function solvePlanarFourBar(input: FourBarInput): FourBarSolution | FourBarFailure {
  const lengths = [input.ground, input.input, input.coupler, input.output];
  if (!lengths.every((value) => Number.isFinite(value) && value > 0) || !Number.isFinite(input.inputAngle)) {
    return failure('four_bar_invalid_input', '四连杆长度必须为正有限数，输入角必须为有限数。');
  }

  const groundInput: Point2 = [0, 0];
  const groundOutput: Point2 = [input.ground, 0];
  const inputCoupler: Point2 = [
    input.input * Math.cos(input.inputAngle),
    input.input * Math.sin(input.inputAngle),
  ];

  const dx = groundOutput[0] - inputCoupler[0];
  const dy = groundOutput[1] - inputCoupler[1];
  const centerDistance = Math.hypot(dx, dy);
  const tolerance = 1e-12 * Math.max(1, ...lengths);
  if (centerDistance <= tolerance) {
    return failure('four_bar_singular', '两个活动圆心重合，四连杆构型不唯一。');
  }
  if (
    centerDistance > input.coupler + input.output + tolerance
    || centerDistance < Math.abs(input.coupler - input.output) - tolerance
  ) {
    return failure('four_bar_unreachable', '当前输入角下，耦合杆与输出杆无法闭合。');
  }

  const along = (
    input.coupler * input.coupler
    - input.output * input.output
    + centerDistance * centerDistance
  ) / (2 * centerDistance);
  const heightSquared = input.coupler * input.coupler - along * along;
  if (heightSquared < -tolerance) {
    return failure('four_bar_unreachable', '当前输入角下，闭环圆没有交点。');
  }
  const height = Math.sqrt(Math.max(0, heightSquared));
  const unitX = dx / centerDistance;
  const unitY = dy / centerDistance;
  const baseX = inputCoupler[0] + along * unitX;
  const baseY = inputCoupler[1] + along * unitY;
  const candidates: [Point2, Point2] = [
    [baseX - height * unitY, baseY + height * unitX],
    [baseX + height * unitY, baseY - height * unitX],
  ];
  candidates.sort((left, right) =>
    cross(inputCoupler, groundOutput, right) - cross(inputCoupler, groundOutput, left));
  const couplerOutput = input.branch === 'open' ? candidates[0] : candidates[1];

  const couplerAngle = Math.atan2(
    couplerOutput[1] - inputCoupler[1],
    couplerOutput[0] - inputCoupler[0],
  );
  const rawOutputAngle = Math.atan2(
    couplerOutput[1] - groundOutput[1],
    couplerOutput[0] - groundOutput[0],
  );
  const outputAngle = input.previousOutputAngle === undefined
    ? rawOutputAngle
    : unwrapAngle(rawOutputAngle, input.previousOutputAngle);

  return {
    ok: true,
    pivots: { groundInput, inputCoupler, couplerOutput, groundOutput },
    inputAngle: input.inputAngle,
    couplerAngle,
    outputAngle,
    branch: input.branch,
  };
}
