import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/');
  const measurements = await page.evaluate(async () => {
    const { makeGeometry, normalize, DEFAULT } = await import('/src/design.js');
    await document.fonts.ready;
    const results = [];
    for (const font of ['serif', 'sans']) for (const character of ['金', '福', '囍', '月', '一']) for (const diameter of [50, 68, 120]) {
      const design = normalize({ ...DEFAULT, diameter, font, character });
      const points = makeGeometry(design).reliefs.filter(r => r.label === '文字').flatMap(r => r.outer);
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
      results.push({ font, character, diameter, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
    }
    return results;
  });
  console.log(JSON.stringify(measurements, null, 2));
  for (const r of measurements) assert.ok(Math.abs(r.x) <= .0001 && Math.abs(r.y) <= .0001, `Glyph off center: ${JSON.stringify(r)}`);
  console.log('PASS: 30 real-font glyph bounds are centered within 0.0001 mm.');
} finally { await browser.close(); }
