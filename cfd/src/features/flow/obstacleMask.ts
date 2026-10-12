/**
 * Builds a compact side-profile obstacle for the 2D teaching solver.
 * 为二维教学求解器生成紧凑的车辆侧面障碍物。
 */
export function createCarProfileMask(width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y += 1) {
    const normalizedY = (y + 0.5) / height;

    for (let x = 1; x < width - 1; x += 1) {
      const normalizedX = (x + 0.5) / width;
      if (normalizedX < 0.36 || normalizedX > 0.66 || normalizedY < 0.43 || normalizedY > 0.66) {
        continue;
      }

      const roundedBody = normalizedX >= 0.37
        && normalizedX <= 0.65
        && normalizedY >= 0.51
        && normalizedY <= 0.65
        && ellipseValue(normalizedX, normalizedY, 0.51, 0.58, 0.15, 0.08) <= 1;
      const cabin = normalizedY >= 0.43
        && normalizedY <= 0.56
        && normalizedX >= 0.43 + (0.56 - normalizedY) * 0.45
        && normalizedX <= 0.57 - (0.56 - normalizedY) * 0.2;
      const noseRamp = normalizedX >= 0.57
        && normalizedX <= 0.66
        && normalizedY >= 0.48 + (normalizedX - 0.57) * 0.35
        && normalizedY <= 0.64;
      const rearCorner = ellipseValue(normalizedX, normalizedY, 0.39, 0.58, 0.035, 0.07) <= 1;

      const frontWheelCutout = ellipseValue(normalizedX, normalizedY, 0.60, 0.64, 0.026, 0.035) <= 1;
      const rearWheelCutout = ellipseValue(normalizedX, normalizedY, 0.43, 0.64, 0.026, 0.035) <= 1;

      if ((roundedBody || cabin || noseRamp || rearCorner) && !frontWheelCutout && !rearWheelCutout) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}

function ellipseValue(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number): number {
  const offsetX = (x - centerX) / radiusX;
  const offsetY = (y - centerY) / radiusY;
  return offsetX * offsetX + offsetY * offsetY;
}
