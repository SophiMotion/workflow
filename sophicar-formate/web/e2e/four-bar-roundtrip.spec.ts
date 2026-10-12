import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('imports, edits l1, separates the loop closure and downloads an update', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('导入 SophiCAD 数据包').setInputFiles(
    resolve(import.meta.dirname, '../../fixtures/generated/four-bar.sophicad.zip'),
  );
  await expect(page.getByText('四连杆装配', { exact: true })).toBeVisible();

  await page.getByLabel('l1 表达式').fill('220 mm');
  await page.getByRole('button', { name: '应用 l1 修改' }).click();
  await expect(page.getByText('代理预览 · 等待 Fusion 重建')).toBeVisible();

  await page.getByRole('button', { name: 'URDF / Isaac' }).click();
  await expect(page.getByTestId('loop-closures')).toContainText('j-output-ground');
  await expect(page.getByTestId('urdf-tree')).not.toContainText('j-output-ground');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出更新包' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('four-bar-update.sophicad.zip');
});
