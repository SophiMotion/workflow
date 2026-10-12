import { Vector3, type PerspectiveCamera } from "three";

export type CameraCommand = "reset" | "rotate-left" | "rotate-right" | "zoom-in" | "zoom-out";

export type CameraCommandTarget = {
  camera: PerspectiveCamera;
  controls: {
    target: Vector3;
    update(): void;
  };
};

const INITIAL_POSITION = new Vector3(7.8, 4.6, 10.4);
const INITIAL_TARGET = new Vector3(0, -0.05, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const ROTATION_STEP = Math.PI / 12;
const MIN_DISTANCE = 7;
const MAX_DISTANCE = 18;

export function applyCameraCommand(
  { camera, controls }: CameraCommandTarget,
  command: CameraCommand,
): void {
  if (command === "reset") {
    camera.position.copy(INITIAL_POSITION);
    controls.target.copy(INITIAL_TARGET);
  } else {
    const offset = camera.position.clone().sub(controls.target);
    if (command === "rotate-left" || command === "rotate-right") {
      offset.applyAxisAngle(Y_AXIS, command === "rotate-left" ? ROTATION_STEP : -ROTATION_STEP);
    } else {
      const scale = command === "zoom-in" ? 0.85 : 1.15;
      offset.setLength(Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, offset.length() * scale)));
    }
    camera.position.copy(controls.target).add(offset);
  }
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();
}
