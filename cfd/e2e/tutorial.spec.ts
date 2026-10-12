import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { parseCsv } from "./csvParser";

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test("completes the evidence-gated seven-chapter tutorial and downloads CSV", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectBrowserErrors(page);
  await page.goto("/");

  await expect(page.getByText("SIMULATED / 模拟数据").first()).toBeVisible();
  await expect(page.getByText(/二维教学近似/).first()).toBeVisible();

  for (const name of ["straightener：整流段", "contraction：收缩段", "test-section：透明测试段", "model-stand：模型台", "fan：风扇段"]) {
    await page.getByRole("button", { name }).click();
  }
  await page.getByRole("button", { name: "进入下一章" }).click();

  await page.getByLabel("风扇功率").fill("30");
  await page.getByRole("button", { name: "启动实验" }).click();
  await expect(page.getByText(/稳定 \/ STABLE/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "进入下一章" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "进入下一章" }).click();

  for (const name of ["查看风扇转速说明", "查看来流速度说明", "查看车底相对压力说明", "查看垂向载荷说明"]) {
    await page.getByRole("button", { name }).click();
  }
  await page.getByRole("button", { name: "标记稳定窗口" }).click();
  await expect(page.getByRole("button", { name: "进入下一章" })).toBeEnabled();
  await page.getByRole("button", { name: "进入下一章" }).click();
  await expect(page.getByRole("heading", { name: "第 4 章：观察 CFD 场" })).toBeVisible();

  await expect(page.getByText("流场就绪 / READY")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/实时场/)).toBeVisible();

  for (const name of ["速度", "压力", "涡量", "流线"]) {
    await page.getByRole("radio", { name, exact: true }).click();
  }
  await page.getByRole("radio", { name: /二维中心截面/ }).click();
  await page.getByRole("button", { name: "进入下一章" }).click();

  await page.getByRole("button", { name: "开始自动扫频" }).click();
  await expect(page.getByText("30%、60%、90% 均已完成")).toBeVisible({ timeout: 30_000 });
  for (const power of [30, 60, 90]) {
    await expect(page.getByRole("heading", { name: `${power}%`, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "进入下一章" }).click();

  const enabledResidual = page.locator('input[name="largest-residual"]:not(:disabled)');
  await expect(enabledResidual).toHaveCount(3);
  const residualValues = await page.locator(".comparison-panel tbody tr td:nth-child(4)").allTextContents();
  const largestIndex = residualValues
    .map((value) => Number(value.trim()))
    .reduce((largest, value, index, values) => value > values[largest]! ? index : largest, 0);
  const largestPower = [30, 60, 90][largestIndex]!;
  await enabledResidual.nth(largestIndex).click();
  const comparisonReason = "二维中心截面忽略侧向泄漏、支架干扰和真实三维边界层。";
  await page.getByRole("textbox", { name: "偏差原因" }).fill(comparisonReason);
  await expect(page.getByRole("button", { name: "进入下一章" })).toBeEnabled();
  await page.getByRole("button", { name: "进入下一章" }).click();
  await expect(page.getByRole("heading", { name: "第 7 章：形成报告" })).toBeVisible();

  const conclusion = "三档同步样本的无量纲压力系数存在可解释偏差，二维结果仅用于教学趋势。";
  await page.getByRole("textbox", { name: "实验结论" }).fill(conclusion);
  await expect(page.getByText("七章教程已完成。" )).toBeVisible();
  await expect(page.getByText("2D TEACHING CFD / 二维教学近似").last()).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const csv = await readFile(downloadPath!, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const rows = parseCsv(csv.slice(1));
  const sampleHeaderIndex = rows.findIndex((row) => row[0] === "sequence");
  const metadata = new Map(rows.slice(0, sampleHeaderIndex).map((row) => [row[0], row[1]]));
  expect(metadata.get("disclaimer")).toContain("SIMULATED / 模拟数据");
  expect(metadata.get("disclaimer")).toContain("2D TEACHING CFD / 二维教学近似");
  expect(metadata.get("conclusion")).toBe(conclusion);
  expect(metadata.get("comparisonReason")).toBe(comparisonReason);
  expect(metadata.get("comparisonFormula")).toContain("Cp_CFD");
  expect(Number(metadata.get("selectedLargestResidualPower"))).toBe(largestPower);
  expect(Number(metadata.get("computedLargestResidualPower"))).toBe(largestPower);
  expect(metadata.get("gridSize")).toMatch(/^(?:\d+ × \d+|mixed: .+)/);
  expect(metadata.get("latestAcceptedGridSize")).toMatch(/^\d+ × \d+$/);
  expect(metadata.get("rebuildReason")).toBeTruthy();

  expect(rows[sampleHeaderIndex]).toEqual([
    "sequence", "simulationTimeMs", "phase", "fanPowerPct", "rpm", "windSpeedMps",
    "underbodyPressurePa", "verticalLoadN", "quality", "provenance",
  ]);
  const summaryHeaderIndex = rows.findIndex((row) => row[0] === "summaryFanPowerPct");
  const sampleRows = rows.slice(sampleHeaderIndex + 1, summaryHeaderIndex - 1);
  for (const power of [30, 60, 90]) {
    const powerSamples = sampleRows.filter((row) => Number(row[3]) === power);
    expect(powerSamples.length).toBeGreaterThanOrEqual(20);
    expect(powerSamples.every((row) => row[8] === "stable" && row[9] === "simulated")).toBe(true);
    const summary = rows.slice(summaryHeaderIndex + 1).find((row) => Number(row[0]) === power);
    expect(summary?.[1]).toBe("true");
    expect(Number(summary?.[2])).toBeGreaterThanOrEqual(20);
  }

  const proxyHeaderIndex = rows.findIndex((row) => row[0] === "flowFrameId");
  expect(rows[proxyHeaderIndex]).toEqual([
    "flowFrameId", "simulationTimeMs", "fanPowerPct", "cfdPressureDeltaLu",
    "latticeDynamicPressure", "sensorPressurePa", "physicalDynamicPressurePa",
    "generation", "gridWidth", "gridHeight", "tau", "requestedInletVelocityLu",
    "actualInletVelocityLu", "velocityScale", "recovery", "rebuildReason",
  ]);
  const proxyRows = rows.slice(proxyHeaderIndex + 1).filter((row) => row.length >= 16 && row[0] !== "");
  for (const power of [30, 60, 90]) {
    const powerProxyRows = proxyRows.filter((row) => Number(row[2]) === power);
    expect(powerProxyRows.length).toBeGreaterThanOrEqual(5);
    expect(powerProxyRows.every((row) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
      .every((index) => Number.isFinite(Number(row[index]))))).toBe(true);
    expect(powerProxyRows.every((row) => Number(row[12]) > 0 && row[14] !== "" && row[15] !== "")).toBe(true);
  }
  expect(errors).toEqual([]);
});
