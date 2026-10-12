import type {
  InertiaTensor,
  Matrix4RowMajor,
  PhysicalPropertiesRecord,
  Vector3,
} from '@sophicad/schema';

type Matrix3 = InertiaTensor;

function normalized(value: number): number {
  return Math.abs(value) < 1e-15 ? 0 : value;
}

function multiply3(left: Matrix3, right: Matrix3): Matrix3 {
  const result = new Array<number>(9).fill(0);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      let value = 0;
      for (let index = 0; index < 3; index += 1) {
        value += left[row * 3 + index]! * right[index * 3 + column]!;
      }
      result[row * 3 + column] = normalized(value);
    }
  }
  return result as InertiaTensor;
}

function transpose3(matrix: Matrix3): Matrix3 {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ];
}

function rotationFromTransform(transform: Matrix4RowMajor): Matrix3 {
  return [
    transform[0], transform[1], transform[2],
    transform[4], transform[5], transform[6],
    transform[8], transform[9], transform[10],
  ];
}

function multiply4(left: Matrix4RowMajor, right: Matrix4RowMajor): Matrix4RowMajor {
  const result = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let value = 0;
      for (let index = 0; index < 4; index += 1) {
        value += left[row * 4 + index]! * right[index * 4 + column]!;
      }
      result[row * 4 + column] = normalized(value);
    }
  }
  return result as Matrix4RowMajor;
}

function transformPoint(transform: Matrix4RowMajor, point: Vector3): Vector3 {
  return [
    normalized(transform[0] * point[0] + transform[1] * point[1] + transform[2] * point[2] + transform[3]),
    normalized(transform[4] * point[0] + transform[5] * point[1] + transform[6] * point[2] + transform[7]),
    normalized(transform[8] * point[0] + transform[9] * point[1] + transform[10] * point[2] + transform[11]),
  ];
}

export function rotateInertiaTensor(tensor: InertiaTensor, rotation: Matrix3): InertiaTensor {
  return multiply3(multiply3(rotation, tensor), transpose3(rotation));
}

export function shiftInertiaTensor(
  tensorAtCenterOfMass: InertiaTensor,
  massKg: number,
  offsetMeters: Vector3,
): InertiaTensor {
  if (!Number.isFinite(massKg) || massKg < 0) {
    throw new TypeError('质量必须是非负有限数。');
  }
  const [x, y, z] = offsetMeters;
  const correction: InertiaTensor = [
    massKg * (y * y + z * z), -massKg * x * y, -massKg * x * z,
    -massKg * y * x, massKg * (x * x + z * z), -massKg * y * z,
    -massKg * z * x, -massKg * z * y, massKg * (x * x + y * y),
  ];
  return tensorAtCenterOfMass.map((value, index) => normalized(value + correction[index]!)) as InertiaTensor;
}

export function isPositiveDefiniteInertia(tensor: InertiaTensor, tolerance = 1e-12): boolean {
  if (!tensor.every(Number.isFinite)) return false;

  // Use a dimensionless matrix so the tolerance is relative to the part's
  // inertia scale. Comparing kg*m^2, (kg*m^2)^2 and (kg*m^2)^3 against the
  // same absolute tolerance rejects otherwise valid small parts.
  const scale = Math.max(...tensor.map(Math.abs));
  if (scale === 0) return false;
  const normalizedTensor = tensor.map((value) => value / scale) as InertiaTensor;

  if (
    Math.abs(normalizedTensor[1] - normalizedTensor[3]) > tolerance
    || Math.abs(normalizedTensor[2] - normalizedTensor[6]) > tolerance
    || Math.abs(normalizedTensor[5] - normalizedTensor[7]) > tolerance
  ) return false;

  const firstMinor = normalizedTensor[0];
  const secondMinor = normalizedTensor[0] * normalizedTensor[4]
    - normalizedTensor[1] * normalizedTensor[3];
  const determinant =
    normalizedTensor[0] * (
      normalizedTensor[4] * normalizedTensor[8]
      - normalizedTensor[5] * normalizedTensor[7]
    )
    - normalizedTensor[1] * (
      normalizedTensor[3] * normalizedTensor[8]
      - normalizedTensor[5] * normalizedTensor[6]
    )
    + normalizedTensor[2] * (
      normalizedTensor[3] * normalizedTensor[7]
      - normalizedTensor[4] * normalizedTensor[6]
    );
  return firstMinor > tolerance && secondMinor > tolerance && determinant > tolerance;
}

export function transformPhysicalProperties(
  properties: PhysicalPropertiesRecord,
  sourceToTarget: Matrix4RowMajor,
): PhysicalPropertiesRecord {
  const rotation = rotationFromTransform(sourceToTarget);
  return {
    ...properties,
    centerOfMass: transformPoint(sourceToTarget, properties.centerOfMass),
    inertiaKgM2: rotateInertiaTensor(properties.inertiaKgM2, rotation),
    inertiaFrame: multiply4(sourceToTarget, properties.inertiaFrame),
  };
}
