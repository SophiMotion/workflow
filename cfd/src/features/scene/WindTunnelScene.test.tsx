import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WindTunnelScene } from "./WindTunnelScene";
import { registerWebglContextRecovery } from "./webglContextRecovery";

it("renders an explanatory fallback when WebGL is unavailable", () => {
  render(<WindTunnelScene webglAvailable={false} onHotspot={() => undefined} />);

  expect(screen.getByRole("img", { name: "模块化数字风洞示意图" })).toBeInTheDocument();
  expect(screen.getByText(/浏览器无法初始化 WebGL/)).toBeInTheDocument();
  for (const label of ["整流段", "收缩段", "透明测试段", "模型台", "风扇段"]) {
    expect(screen.getByText(label, { selector: "text" })).toBeInTheDocument();
  }
  expect(screen.getByText("2D TEACHING CFD / 二维教学近似", { selector: "strong" })).toBeVisible();
});

it("exposes the five physical modules and records hotspot evidence", async () => {
  const user = userEvent.setup();
  const viewed: string[] = [];
  render(<WindTunnelScene webglAvailable={false} onHotspot={(id) => viewed.push(id)} />);

  const hotspotIds = ["straightener", "contraction", "test-section", "model-stand", "fan"];
  for (const id of hotspotIds) {
    expect(screen.getByRole("button", { name: new RegExp(id) })).toBeInTheDocument();
  }

  const testSection = screen.getByRole("button", { name: /test-section/ });
  await user.click(testSection);

  expect(viewed).toEqual(["test-section"]);
  expect(testSection).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/剖视已开启/)).toBeVisible();
});

it("probes WebGL only once across rerenders", () => {
  vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { rerender } = render(<WindTunnelScene onHotspot={() => undefined} />);

  rerender(<WindTunnelScene onHotspot={() => undefined} />);
  rerender(<WindTunnelScene onHotspot={() => undefined} />);

  expect(getContext).toHaveBeenCalledTimes(2);
  getContext.mockRestore();
  vi.unstubAllGlobals();
});

it("prevents context loss and cleans up recovery listeners", () => {
  const canvas = document.createElement("canvas");
  const onLost = vi.fn();
  const stalePreventDefault = vi.fn();
  const onRestored = vi.fn(() => {
    canvas.dispatchEvent(Object.assign(new Event("webglcontextlost", { cancelable: true }), {
      preventDefault: stalePreventDefault,
    }));
  });
  const preventDefault = vi.fn();
  const remove = registerWebglContextRecovery(canvas, onLost, onRestored);

  canvas.dispatchEvent(Object.assign(new Event("webglcontextlost", { cancelable: true }), { preventDefault }));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(onLost).toHaveBeenCalledOnce();
  expect(onRestored).toHaveBeenCalledOnce();
  expect(stalePreventDefault).not.toHaveBeenCalled();

  remove();
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(onRestored).toHaveBeenCalledOnce();
});
