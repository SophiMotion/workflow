import { expect, test } from "@playwright/test";

test("renders the CFD workbench with the approved Google engineering palette", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SophiFlow Lab" })).toBeVisible();
  await expect(page.getByRole("main", { name: "数字风洞" })).toBeVisible();

  const palette = await page.evaluate(() => {
    const colorOf = (selector: string, property: "backgroundColor" | "color" = "backgroundColor") => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing element: ${selector}`);
      return getComputedStyle(element)[property];
    };

    return {
      page: colorOf("body"),
      topbar: colorOf(".topbar"),
      sidePanel: colorOf(".control-panel"),
      primaryAction: colorOf(".action-primary"),
      primaryActionText: colorOf(".action-primary", "color"),
      dangerAction: colorOf(".experiment-actions button:last-child", "color"),
      selectedField: colorOf(".field-selected", "color"),
      tunnel: colorOf(".wind-tunnel-scene"),
    };
  });

  expect(palette).toEqual({
    page: "rgb(248, 249, 250)",
    topbar: "rgb(255, 255, 255)",
    sidePanel: "rgb(255, 255, 255)",
    primaryAction: "rgb(52, 168, 83)",
    primaryActionText: "rgb(255, 255, 255)",
    dangerAction: "rgb(234, 67, 53)",
    selectedField: "rgb(52, 168, 83)",
    tunnel: "rgb(32, 33, 36)",
  });
});
