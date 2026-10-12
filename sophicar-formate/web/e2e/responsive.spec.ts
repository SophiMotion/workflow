import { expect, test } from '@playwright/test';

test('protects the engineering layout below desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto('/?demo=1');
  await expect(page.getByText('请使用至少 1024 px 宽的桌面窗口打开工程工作台。')).toBeVisible();
  await expect(page.locator('.top-bar')).toBeHidden();
});
