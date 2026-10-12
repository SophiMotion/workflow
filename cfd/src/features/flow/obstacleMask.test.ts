import { createCarProfileMask } from "./obstacleMask";

it("creates an interior car profile without blocking inlet or outlet", () => {
  const width = 160;
  const height = 64;
  const mask = createCarProfileMask(width, height);
  expect(mask.some((cell) => cell === 1)).toBe(true);

  for (let y = 0; y < height; y += 1) {
    expect(mask[y * width]).toBe(0);
    expect(mask[y * width + width - 1]).toBe(0);
  }
  for (let x = 0; x < width; x += 1) {
    expect(mask[x]).toBe(0);
    expect(mask[(height - 1) * width + x]).toBe(0);
  }

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 1) {
      continue;
    }
    const x = index % width;
    const y = Math.floor(index / width);
    expect((x + 0.5) / width).toBeGreaterThanOrEqual(0.36);
    expect((x + 0.5) / width).toBeLessThanOrEqual(0.66);
    expect((y + 0.5) / height).toBeGreaterThanOrEqual(0.43);
    expect((y + 0.5) / height).toBeLessThanOrEqual(0.66);
  }

  const cellAt = (normalizedX: number, normalizedY: number) => (
    Math.floor(normalizedY * height) * width + Math.floor(normalizedX * width)
  );
  for (const wheelCenterX of [0.43, 0.60]) {
    const center = cellAt(wheelCenterX, 0.64);
    const centerX = center % width;
    const centerY = Math.floor(center / width);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        expect(mask[(centerY + offsetY) * width + centerX + offsetX]).toBe(0);
      }
    }
  }

  expect(mask[cellAt(0.50, 0.48)]).toBe(1);
  expect(mask[cellAt(0.65, 0.52)]).toBe(1);
});
