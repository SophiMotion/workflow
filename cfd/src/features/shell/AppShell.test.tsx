import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

afterEach(() => vi.unstubAllGlobals());

function useCompactViewport() {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    media: "(max-width: 1100px)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

it("provides a keyboard-operable three-tab compact panel affordance", async () => {
  useCompactViewport();
  const user = userEvent.setup();
  render(
    <AppShell
      left={<p>教程内容</p>}
      scene={<p>场景内容</p>}
      right={<p>控制内容</p>}
      bottom={<p>曲线内容</p>}
    />,
  );

  expect(screen.getByRole("tablist", { name: "窄屏实验面板" })).toBeInTheDocument();
  const tutorialTab = screen.getByRole("tab", { name: "教程" });
  const controlTab = screen.getByRole("tab", { name: "控制" });
  const chartTab = screen.getByRole("tab", { name: "曲线" });
  expect(tutorialTab).toHaveAttribute("aria-selected", "true");
  const panels = screen.getAllByRole("tabpanel", { hidden: true });
  expect(panels).toHaveLength(3);
  for (const tab of [tutorialTab, controlTab, chartTab]) {
    const panel = document.getElementById(tab.getAttribute("aria-controls")!);
    expect(panel).toHaveAttribute("role", "tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  }
  expect(document.getElementById("compact-panel-tutorial")).not.toHaveAttribute("hidden");
  expect(document.getElementById("compact-panel-controls")).toHaveAttribute("hidden");
  expect(document.getElementById("compact-panel-charts")).toHaveAttribute("hidden");

  await user.click(controlTab);
  expect(controlTab).toHaveAttribute("aria-selected", "true");
  expect(document.getElementById("compact-panel-tutorial")).toHaveAttribute("hidden");
  expect(document.getElementById("compact-panel-controls")).not.toHaveAttribute("hidden");

  chartTab.focus();
  await user.keyboard("{ArrowLeft}");
  expect(controlTab).toHaveFocus();
  expect(controlTab).toHaveAttribute("aria-selected", "true");
});

it("moves Tab from an active compact tab into that panel instead of the intervening scene", async () => {
  useCompactViewport();
  const user = userEvent.setup();
  render(
    <AppShell
      left={<button type="button">教程动作</button>}
      scene={<button type="button">场景动作</button>}
      right={<><input aria-label="功率" type="range" /><button type="button">启动</button></>}
      bottom={<button type="button">图表动作</button>}
    />,
  );

  const controlTab = screen.getByRole("tab", { name: "控制" });
  await user.click(controlTab);
  await user.tab();
  expect(screen.getByRole("slider", { name: "功率" })).toHaveFocus();

  const chartTab = screen.getByRole("tab", { name: "曲线" });
  await user.click(chartTab);
  await user.tab();
  expect(screen.getByRole("button", { name: "图表动作" })).toHaveFocus();
});
