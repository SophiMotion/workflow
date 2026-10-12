import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): never {
  throw new Error("render failed");
}

afterEach(() => vi.restoreAllMocks());

it("offers a recoverable application fallback", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole("alert")).toHaveTextContent("界面渲染失败");
  expect(screen.getByRole("button", { name: "重新加载实验台" })).toBeInTheDocument();
  expect(screen.getByText("2D TEACHING CFD / 二维教学近似")).toBeVisible();
  expect(screen.getByText("SIMULATED / 模拟数据")).toBeVisible();
});
