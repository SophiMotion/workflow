export const calculateDynamicPressure = (rho: number, velocity: number) => 0.5 * rho * velocity ** 2;

export function stepFirstOrder(current: number, target: number, dtMs: number, tauMs: number) {
  const alpha = 1 - Math.exp(-dtMs / tauMs);
  return current + (target - current) * alpha;
}
