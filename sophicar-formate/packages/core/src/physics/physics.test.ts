import { describe, expect, it } from 'vitest';

import {
  isPositiveDefiniteInertia,
  rotateInertiaTensor,
  shiftInertiaTensor,
  transformPhysicalProperties,
} from './inertia.js';
import { convertAngle, convertInertia, convertLength } from './units.js';

describe('SI physics conversions', () => {
  it('converts Fusion document lengths and angles to SI', () => {
    expect(convertLength(20, 'cm', 'm')).toBeCloseTo(0.2, 12);
    expect(convertLength(250, 'mm', 'm')).toBeCloseTo(0.25, 12);
    expect(convertAngle(180, 'deg', 'rad')).toBeCloseTo(Math.PI, 12);
  });

  it('converts Fusion kg*cm^2 to kg*m^2', () => {
    expect(convertInertia(250, 'kg*cm^2', 'kg*m^2')).toBeCloseTo(0.025, 12);
  });

  it('applies the parallel-axis theorem for an offset along X', () => {
    const shifted = shiftInertiaTensor(
      [1, 0, 0, 0, 1, 0, 0, 0, 1],
      2,
      [1, 0, 0],
    );

    expect(shifted).toEqual([1, 0, 0, 0, 3, 0, 0, 0, 3]);
  });

  it('rotates a tensor by 90 degrees around Z', () => {
    const rotated = rotateInertiaTensor(
      [1, 0, 0, 0, 2, 0, 0, 0, 3],
      [0, -1, 0, 1, 0, 0, 0, 0, 1],
    );

    expect(rotated[0]).toBeCloseTo(2, 12);
    expect(rotated[4]).toBeCloseTo(1, 12);
    expect(rotated[8]).toBeCloseTo(3, 12);
  });

  it('rejects a physically impossible tensor', () => {
    expect(isPositiveDefiniteInertia([1, 2, 0, 2, 1, 0, 0, 0, -1])).toBe(false);
  });

  it('accepts a small positive-definite inertia tensor exported by Fusion', () => {
    expect(isPositiveDefiniteInertia([
      0.00030184651290652057, -1.2889966871654223e-16, -0.000027127652565165627,
      -1.2889966871654223e-16, 0.0003011785972037264, 5.88418203051333e-19,
      -0.000027127652565165627, 5.88418203051333e-19, 0.000005908484918720291,
    ])).toBe(true);
  });

  it('transforms center of mass and inertia into a robot frame', () => {
    const transformed = transformPhysicalProperties({
      entityId: 'link',
      massKg: 1,
      volumeM3: 0.001,
      centerOfMass: [1, 0, 0],
      inertiaKgM2: [1, 0, 0, 0, 2, 0, 0, 0, 3],
      inertiaFrame: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      accuracy: 'very-high',
    }, [
      0, -1, 0, 0,
      1, 0, 0, 2,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);

    expect(transformed.centerOfMass).toEqual([0, 3, 0]);
    expect(transformed.inertiaKgM2[0]).toBeCloseTo(2, 12);
    expect(transformed.inertiaKgM2[4]).toBeCloseTo(1, 12);
  });
});
