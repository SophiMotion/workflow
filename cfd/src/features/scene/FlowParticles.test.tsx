import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowParticles } from "./FlowParticles";

vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
}));

describe("FlowParticles", () => {
  const setMatrixAt = vi.fn();

  beforeEach(() => {
    setMatrixAt.mockClear();
    Object.defineProperty(HTMLElement.prototype, "setMatrixAt", {
      configurable: true,
      value: setMatrixAt,
    });
    Object.defineProperty(HTMLElement.prototype, "instanceMatrix", {
      configurable: true,
      get: () => ({ needsUpdate: false }),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "setMatrixAt");
    Reflect.deleteProperty(HTMLElement.prototype, "instanceMatrix");
  });

  it.each([
    { initialCount: 300, nextCount: 1_400 },
    { initialCount: 1_400, nextCount: 900 },
  ])(
    "initializes exactly $nextCount matrices after resizing from $initialCount particles",
    ({ initialCount, nextCount }) => {
      const { container, rerender } = render(
        <FlowParticles frame={null} phase="idle" windSpeedMps={0} count={initialCount} />,
      );
      const initialMesh = container.querySelector("instancedmesh");
      expect(setMatrixAt).toHaveBeenCalledTimes(initialCount);

      setMatrixAt.mockClear();
      rerender(<FlowParticles frame={null} phase="idle" windSpeedMps={0} count={nextCount} />);

      expect(setMatrixAt).toHaveBeenCalledTimes(nextCount);
      expect(setMatrixAt).toHaveBeenLastCalledWith(nextCount - 1, expect.anything());
      const resizedMesh = container.querySelector("instancedmesh");
      expect(resizedMesh).not.toBe(initialMesh);
      expect((resizedMesh as unknown as { count: number }).count).toBe(nextCount);
    },
  );
});
