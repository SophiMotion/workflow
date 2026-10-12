import {
  SCENE_VEHICLE_BODY_CENTER_Y,
  SOLVER_VEHICLE_BODY_CENTER_V,
  sceneYToSolverV,
  solverVToSceneY,
} from "./sceneCoordinates";

it("aligns the solver obstacle center with the visible vehicle body center", () => {
  expect(solverVToSceneY(SOLVER_VEHICLE_BODY_CENTER_V)).toBeCloseTo(SCENE_VEHICLE_BODY_CENTER_Y, 6);
  expect(sceneYToSolverV(SCENE_VEHICLE_BODY_CENTER_Y)).toBeCloseTo(SOLVER_VEHICLE_BODY_CENTER_V, 6);
});

it("clamps scene coordinates to the solver field", () => {
  expect(sceneYToSolverV(-99)).toBe(0);
  expect(sceneYToSolverV(99)).toBe(1);
});
