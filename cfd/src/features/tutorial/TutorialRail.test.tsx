import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { TutorialRail } from "./TutorialRail";
import { TutorialModeToggle } from "./TutorialModeToggle";
import { emptyEvidence } from "./tutorialProgress";

it("lists all seven chapters and explains why next is locked", () => {
  render(<TutorialRail activeLesson="anatomy" evidence={emptyEvidence} onAdvance={() => undefined} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(7);
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeDisabled();
  expect(screen.getByText(/查看 5 个风洞模块/)).toBeInTheDocument();
});

it("keeps future chapters readable but marks them unavailable", () => {
  render(<TutorialRail activeLesson="anatomy" evidence={emptyEvidence} onAdvance={() => undefined} />);
  expect(screen.getByRole("button", { name: /第 2 章.*启动虚拟风扇/ })).toHaveAttribute("aria-disabled", "true");
});

it("marks only the active incomplete lesson as current after returning to guided mode", () => {
  render(<TutorialRail activeLesson="flow" evidence={emptyEvidence} onAdvance={() => undefined} />);

  expect(screen.getByRole("button", { name: /第 1 章.*认识风洞/ })).toHaveClass("lesson-available");
  expect(screen.getByRole("button", { name: /第 4 章.*观察 CFD 场/ })).toHaveClass("lesson-current");
  expect(screen.getByRole("button", { name: /第 5 章.*风速扫描/ })).toHaveAttribute("aria-disabled", "true");
});

it("explains that the comparison uses dimensionless Cp rather than subtracting lu from Pa", () => {
  render(<TutorialRail activeLesson="compare" evidence={emptyEvidence} onAdvance={() => undefined} />);

  expect(screen.getByText(/无量纲 Cp/)).toBeVisible();
  expect(screen.getByText(/不能直接相减/)).toBeVisible();
});

it("switches to free mode without mutating tutorial evidence", async () => {
  const user = userEvent.setup();
  const onModeChange = vi.fn();
  render(<TutorialModeToggle mode="guided" onModeChange={onModeChange} />);
  await user.click(screen.getByRole("button", { name: "自由实验" }));
  expect(onModeChange).toHaveBeenCalledWith("free");
});
