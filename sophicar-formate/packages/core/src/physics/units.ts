export type LengthUnit = 'm' | 'cm' | 'mm' | 'in' | 'ft';
export type AngleUnit = 'rad' | 'deg';
export type InertiaUnit = 'kg*m^2' | 'kg*cm^2' | 'g*mm^2';

export class UnitError extends Error {
  readonly code = 'unsupported_unit';

  constructor(unit: string) {
    super(`不支持单位：${unit}`);
    this.name = 'UnitError';
  }
}

const LENGTH_TO_METERS: Record<LengthUnit, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

const ANGLE_TO_RADIANS: Record<AngleUnit, number> = {
  rad: 1,
  deg: Math.PI / 180,
};

const INERTIA_TO_KG_M2: Record<InertiaUnit, number> = {
  'kg*m^2': 1,
  'kg*cm^2': 0.0001,
  'g*mm^2': 1e-9,
};

function convertWithTable<T extends string>(
  value: number,
  from: T,
  to: T,
  table: Record<T, number>,
): number {
  if (!Number.isFinite(value)) throw new TypeError('单位转换值必须是有限数。');
  const fromScale = table[from];
  const toScale = table[to];
  if (fromScale === undefined) throw new UnitError(from);
  if (toScale === undefined) throw new UnitError(to);
  return value * fromScale / toScale;
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return convertWithTable(value, from, to, LENGTH_TO_METERS);
}

export function convertAngle(value: number, from: AngleUnit, to: AngleUnit): number {
  return convertWithTable(value, from, to, ANGLE_TO_RADIANS);
}

export function convertInertia(value: number, from: InertiaUnit, to: InertiaUnit): number {
  return convertWithTable(value, from, to, INERTIA_TO_KG_M2);
}
