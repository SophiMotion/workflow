import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1_440, height: 900 },
  { name: "tablet", width: 1_024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} has no horizontal overflow and keeps controls keyboard-reachable`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("main", { name: "数字风洞" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "风洞模块热点" }))
      .toBeVisible({ timeout: 15_000 });

    if (viewport.width <= 1_100) {
      const tutorial = page.getByRole("tab", { name: "教程" });
      await tutorial.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "控制" })).toBeFocused();
      await page.keyboard.press("Tab");
      const slider = page.getByRole("slider", { name: "风扇功率" });
      await expect(slider).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("output")).toHaveText("1%");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "启动实验" })).toBeFocused();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "暂停实验" })).toBeFocused();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "停止并重置" })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole("tab", { name: "控制" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "曲线" })).toBeFocused();
      await expect(page.getByRole("heading", { name: "三工况实验报告" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } else {
      const slider = page.getByRole("slider", { name: "风扇功率" });
      for (let index = 0; index < 20 && !await slider.evaluate((element) => element === document.activeElement); index += 1) {
        await page.keyboard.press("Tab");
      }
      await expect(slider).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("output")).toHaveText("1%");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "启动实验" })).toBeFocused();
      await expect(page.getByRole("heading", { name: "三工况实验报告" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }

    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-${viewport.width}x${viewport.height}.png`), fullPage: true });
  });
}
