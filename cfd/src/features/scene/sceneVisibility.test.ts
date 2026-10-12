import { vehicleModuleOpacities } from "./sceneVisibility";

it("highlights only the stand when model-stand is selected", () => {
  expect(vehicleModuleOpacities("model-stand")).toEqual({ stand: 1, car: 0.2 });
});

it("keeps the vehicle visible for the test-section cutaway", () => {
  expect(vehicleModuleOpacities("test-section")).toEqual({ stand: 0.2, car: 1 });
});
