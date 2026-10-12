import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerspectiveCamera, Vector3 } from "three";
import { expect, it, vi } from "vitest";
import { CameraControlBar } from "./CameraControlBar";
import { applyCameraCommand } from "./cameraCommands";

it("uses keyboard-activated DOM controls to rotate, zoom, and reset the shared camera target", async () => {
  const user = userEvent.setup();
  const camera = new PerspectiveCamera();
  camera.position.set(7.8, 4.6, 10.4);
  const controls = { target: new Vector3(0, -0.05, 0), update: vi.fn() };
  const execute = (command: Parameters<typeof applyCameraCommand>[1]) => {
    applyCameraCommand({ camera, controls }, command);
  };
  render(<CameraControlBar onCommand={execute} />);

  const initialPosition = camera.position.clone();
  const rotateRight = screen.getByRole("button", { name: "向右旋转三维视角" });
  rotateRight.focus();
  await user.keyboard("{Enter}");
  expect(camera.position.equals(initialPosition)).toBe(false);

  const distanceBeforeZoom = camera.position.distanceTo(controls.target);
  await user.click(screen.getByRole("button", { name: "放大三维视角" }));
  expect(camera.position.distanceTo(controls.target)).toBeLessThan(distanceBeforeZoom);

  await user.click(screen.getByRole("button", { name: "重置三维视角" }));
  expect(camera.position.toArray()).toEqual([7.8, 4.6, 10.4]);
  expect(controls.target.toArray()).toEqual([0, -0.05, 0]);
  expect(controls.update).toHaveBeenCalledTimes(3);
  for (const name of ["向左旋转三维视角", "缩小三维视角"]) {
    expect(screen.getByRole("button", { name })).toBeEnabled();
  }
});
