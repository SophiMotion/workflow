import { expect, test, type Page } from "@playwright/test";

function capturePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test("free lab supports run controls, field switching, and reset", async ({ page }) => {
  const errors = capturePageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "自由实验" }).click();
  await page.getByLabel("风扇功率").fill("42", { force: true });
  const phaseAfterStart = await page.getByRole("button", { name: "启动实验" }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error("Start control is not a button");
    button.click();
    return new Promise<string>((resolve) => requestAnimationFrame(() => {
      const phaseText = button.closest(".dashboard-section")?.querySelector(".phase-badge")?.textContent ?? "";
      const pauseButton = button.nextElementSibling;
      if (!(pauseButton instanceof HTMLButtonElement)) throw new Error("Pause control is missing");
      pauseButton.click();
      resolve(phaseText);
    }));
  });
  expect(phaseAfterStart).toMatch(/升速中/);
  await expect(page.getByText(/已暂停/)).toBeVisible();
  const rpmBeforePause = Number(await page.locator(".telemetry-card").first().locator("strong").textContent());

  const phaseAfterResume = await page.getByRole("button", { name: "继续实验" }).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error("Resume control is not a button");
    button.click();
    return new Promise<string>((resolve) => requestAnimationFrame(() => {
      resolve(button.closest(".dashboard-section")?.querySelector(".phase-badge")?.textContent ?? "");
    }));
  });
  expect(phaseAfterResume).toMatch(/升速中/);
  await page.getByLabel("风扇功率").fill("65", { force: true });
  await expect(page.locator("output")).toHaveText("65%");
  await expect(page.locator(".sample-time")).not.toHaveText("T+0.00 s", { timeout: 15_000 });
  await expect.poll(async () => Number(await page.locator(".telemetry-card").first().locator("strong").textContent()))
    .toBeGreaterThan(rpmBeforePause);

  await expect(page.getByText("流场就绪 / READY")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/实时场/)).toBeVisible();
  const pressureField = page.getByRole("radio", { name: "压力", exact: true });
  await expect(async () => {
    await expect(pressureField).toBeEnabled();
    await pressureField.click({ force: true });
    await expect(pressureField).toHaveAttribute("aria-checked", "true");
  }).toPass({ timeout: 10_000 });

  const dialogPromise = page.waitForEvent("dialog");
  const resetPromise = page.getByRole("button", { name: "停止并重置" }).click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe("停止实验并清除当前 60 秒遥测历史？");
  await dialog.accept();
  await resetPromise;
  await expect(page.getByText("待机 / IDLE")).toBeVisible();
  await expect(page.getByLabel("风扇功率")).toHaveValue("0");
  expect(errors).toEqual([]);
});

test("restores the solver and canvas after WebGL context loss", async ({ page }) => {
  const errors = capturePageErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "自由实验" }).click();
  await page.getByLabel("风扇功率").fill("65", { force: true });
  await expect(page.getByText("流场就绪 / READY")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/实时场/)).toBeVisible();

  const canvas = page.locator(".scene-canvas canvas");
  await expect(canvas).toHaveCount(1);
  const originalCanvas = await canvas.elementHandle();
  const extensionAvailable = await canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const context = canvasElement.getContext("webgl2") ?? canvasElement.getContext("webgl");
    const extension = context?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    (window as unknown as { __sophiWebglLoss?: WEBGL_lose_context }).__sophiWebglLoss = extension;
    extension.loseContext();
    return true;
  });
  test.skip(!extensionAvailable, "Chromium did not expose WEBGL_lose_context");
  await expect(page.getByText(/三维上下文已丢失/)).toBeVisible();
  await page.evaluate(() => {
    const holder = window as unknown as { __sophiWebglLoss?: WEBGL_lose_context };
    holder.__sophiWebglLoss?.restoreContext();
    delete holder.__sophiWebglLoss;
  });
  await expect(page.getByText(/三维上下文已丢失/)).toBeHidden({ timeout: 15_000 });
  await expect(canvas).toHaveCount(1);
  expect(await originalCanvas?.evaluate((element) => element.isConnected)).toBe(false);
  await expect(page.getByText("流场就绪 / READY")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/实时场/)).toBeVisible();
  expect(errors).toEqual([]);
});
