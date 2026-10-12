type VelocityField = {
  width: number;
  height: number;
  velocityX: Float32Array;
  velocityY: Float32Array;
};

export type FlowVelocity = { x: number; y: number };

function clamp01(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function bilinearAt(
  values: Float32Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tx: number,
  ty: number,
) {
  const topLeft = values[y0 * width + x0] ?? 0;
  const topRight = values[y0 * width + x1] ?? 0;
  const bottomLeft = values[y1 * width + x0] ?? 0;
  const bottomRight = values[y1 * width + x1] ?? 0;
  const top = topLeft * (1 - tx) + topRight * tx;
  const bottom = bottomLeft * (1 - tx) + bottomRight * tx;
  return top * (1 - ty) + bottom * ty;
}

export function sampleFlowVelocityInto(frame: VelocityField, u: number, v: number, output: FlowVelocity): FlowVelocity {
  if (frame.width <= 0 || frame.height <= 0 || frame.velocityX.length === 0 || frame.velocityY.length === 0) {
    output.x = 0;
    output.y = 0;
    return output;
  }

  const x = clamp01(u) * Math.max(0, frame.width - 1);
  const y = clamp01(v) * Math.max(0, frame.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(frame.width - 1, x0 + 1);
  const y1 = Math.min(frame.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  output.x = bilinearAt(frame.velocityX, frame.width, x0, y0, x1, y1, tx, ty);
  output.y = bilinearAt(frame.velocityY, frame.width, x0, y0, x1, y1, tx, ty);
  return output;
}

export function sampleFlowVelocity(frame: VelocityField, u: number, v: number): FlowVelocity {
  return sampleFlowVelocityInto(frame, u, v, { x: 0, y: 0 });
}
