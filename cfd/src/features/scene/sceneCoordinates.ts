export const SCENE_FLOW_X_MIN = -2.9;
export const SCENE_FLOW_X_MAX = 2.9;
export const SCENE_FLOW_WIDTH = SCENE_FLOW_X_MAX - SCENE_FLOW_X_MIN;

export const SCENE_FLOW_CENTER_Y = -0.58;
export const SCENE_FLOW_HEIGHT = 1.8;
export const SCENE_FLOW_Y_MIN = SCENE_FLOW_CENTER_Y - SCENE_FLOW_HEIGHT / 2;
export const SCENE_FLOW_Y_MAX = SCENE_FLOW_CENTER_Y + SCENE_FLOW_HEIGHT / 2;

// Center of the solver obstacle's documented y = 0.43…0.66 envelope.
export const SOLVER_VEHICLE_BODY_CENTER_V = (0.43 + 0.66) / 2;
export const SCENE_VEHICLE_BODY_CENTER_Y = SCENE_FLOW_CENTER_Y
  + (SOLVER_VEHICLE_BODY_CENTER_V - 0.5) * SCENE_FLOW_HEIGHT;

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function solverUToSceneX(u: number) {
  return SCENE_FLOW_X_MIN + clamp01(u) * SCENE_FLOW_WIDTH;
}

export function sceneXToSolverU(x: number) {
  return clamp01((x - SCENE_FLOW_X_MIN) / SCENE_FLOW_WIDTH);
}

export function solverVToSceneY(v: number) {
  return SCENE_FLOW_Y_MIN + clamp01(v) * SCENE_FLOW_HEIGHT;
}

export function sceneYToSolverV(y: number) {
  return clamp01((y - SCENE_FLOW_Y_MIN) / SCENE_FLOW_HEIGHT);
}
