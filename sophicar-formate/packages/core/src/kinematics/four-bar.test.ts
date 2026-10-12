import { describe, expect, it } from 'vitest';

import { solvePlanarFourBar, unwrapAngle } from './four-bar.js';

function distance(left: readonly number[], right: readonly number[]): number {
  return Math.hypot(left[0]! - right[0]!, left[1]! - right[1]!);
}

function cross(
  origin: readonly number[],
  first: readonly number[],
  second: readonly number[],
): number {
  return (first[0]! - origin[0]!) * (second[1]! - origin[1]!)
    - (first[1]! - origin[1]!) * (second[0]! - origin[0]!);
}

describe('planar four-bar solver', () => {
  it('closes all four links on the open assembly branch', () => {
    const result = solvePlanarFourBar({
      ground: 0.25,
      input: 0.2,
      coupler: 0.25,
      output: 0.2,
      inputAngle: 0.7,
      branch: 'open',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(distance(result.pivots.groundInput, result.pivots.inputCoupler)).toBeCloseTo(0.2, 10);
    expect(distance(result.pivots.inputCoupler, result.pivots.couplerOutput)).toBeCloseTo(0.25, 10);
    expect(distance(result.pivots.couplerOutput, result.pivots.groundOutput)).toBeCloseTo(0.2, 10);
    expect(distance(result.pivots.groundOutput, result.pivots.groundInput)).toBeCloseTo(0.25, 10);
  });

  it('returns opposite circle intersections for open and crossed branches', () => {
    const open = solvePlanarFourBar({
      ground: 0.25, input: 0.2, coupler: 0.25, output: 0.2,
      inputAngle: 0.7, branch: 'open',
    });
    const crossed = solvePlanarFourBar({
      ground: 0.25, input: 0.2, coupler: 0.25, output: 0.2,
      inputAngle: 0.7, branch: 'crossed',
    });

    expect(open.ok && crossed.ok).toBe(true);
    if (!open.ok || !crossed.ok) return;
    const openSign = cross(open.pivots.inputCoupler, open.pivots.groundOutput, open.pivots.couplerOutput);
    const crossedSign = cross(crossed.pivots.inputCoupler, crossed.pivots.groundOutput, crossed.pivots.couplerOutput);
    expect(openSign * crossedSign).toBeLessThan(0);
  });

  it('reports an unreachable linkage without NaN coordinates', () => {
    const result = solvePlanarFourBar({
      ground: 0.5,
      input: 0.02,
      coupler: 0.02,
      output: 0.02,
      inputAngle: 0,
      branch: 'open',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostic.code).toBe('four_bar_unreachable');
    expect(JSON.stringify(result)).not.toContain('NaN');
  });

  it('unwraps an angle across minus pi without a playback jump', () => {
    expect(unwrapAngle(-3.13, 3.13)).toBeGreaterThan(3.13);
    expect(unwrapAngle(-3.13, 3.13)).toBeCloseTo(3.153185307, 8);
  });
});
