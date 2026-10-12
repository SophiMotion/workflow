import { contours } from 'd3-contour';
import { PATTERNS } from './patterns.js';

export const MOLD_HARDWARE = Object.freeze({ connection: 'M20x2.5', baseThickness: 6, shaftDiameter: 30, shaftLength: 40, studLength: 15, handleDiameter: 40, bossDiameter: 30, guideHeight: 6 });
export const MOLD_DEFAULT = Object.freeze({ type: 'hand_press', radialClearance: .3, wallThickness: 3.5, stampThickness: 6, ...MOLD_HARDWARE });
export const currentMold = mold => ({ ...MOLD_DEFAULT, ...mold, ...MOLD_HARDWARE });
export function moldFitError(d) {
  if (currentMold(d.mold).stampThickness > 6) return '压片厚度不能超过 6 mm 内部直壁段，请将压片厚度调至 4–6 mm。';
  const inside = Math.min(...topOutline(d).map(p => Math.hypot(...p)));
  if (inside < 15 + currentMold(d.mold).radialClearance) return '文字面内腔不足以容纳直径 30 mm 螺纹座，请增大月饼直径或减小斜度。';
  return '';
}
export const DEFAULT = Object.freeze({ diameter: 80, thickness: 25, draftAngle: 5, side: 'scallop', count: 24, mode: 'parametric', pattern: 'petals', patternDiameter: 68, relief: 1.6, petals: 16, character: '福', textSize: 23, font: 'serif', textLayout: 'straight', image: null, invert: false, mold: MOLD_DEFAULT });
export const SIDE_NAMES = { scallop: '经典花边', wave: '柔和波纹', round: '简约圆形' };
export const PATTERN_NAMES = Object.fromEntries(Object.entries(PATTERNS).map(([id, p]) => [id, p.name]));
export const round = n => Math.round(n * 10000) / 10000;
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const isHan = s => typeof s === 'string' && /^\p{Script=Han}{1,2}$/u.test(s);
export const isEnglish = s => typeof s === 'string' && /^[A-Za-z]{1,5}$/.test(s);
export const isValidText = s => s === '' || isHan(s) || isEnglish(s);
// 角度相对竖直方向，直径指底面 / Draft is measured from vertical; diameter refers to the base.
export const topDiameter = d => d.diameter - 2 * d.thickness * Math.tan((d.draftAngle ?? 0) * Math.PI / 180);
export const maxPatternDiameter = d => Math.floor(Math.min(d.diameter - 10, topDiameter(d) - 6) * 10 + 1e-8) / 10;
export function topOutline(d, bottom = outline(d)) {
  const inset = d.thickness * Math.tan((d.draftAngle ?? 0) * Math.PI / 180);
  return bottom.map(([x, y]) => { const scale = 1 - inset / Math.hypot(x, y); return [round(x * scale), round(y * scale)]; });
}
export function normalize(d) {
  const diameter = clamp(Number(d.diameter) || 80, 50, 120);
  const thickness = clamp(Number(d.thickness) || 25, 10, 40);
  const draftAngle = clamp(Number(d.draftAngle ?? 5), 0, 8);
  const patternDiameter = clamp(Number(d.patternDiameter) || 68, 30, maxPatternDiameter({ diameter, thickness, draftAngle }));
  const mold = currentMold(d.mold);
  for (const [key, low, high] of [['radialClearance', .15, .8], ['wallThickness', 2, 8], ['stampThickness', 4, 10]]) mold[key] = clamp(Number(mold[key]) || MOLD_DEFAULT[key], low, high);
  return { ...d, textLayout: isEnglish(d.character) && d.textLayout === 'circular' ? 'circular' : 'straight', diameter, thickness, draftAngle, patternDiameter, textSize: clamp(Number(d.textSize) || 23, 10, Math.floor(patternDiameter * .38)), relief: clamp(Number(d.relief) || 1.6, .5, 3), count: clamp(Math.round(Number(d.count) || 24), 12, 36), petals: clamp(Math.round(Number(d.petals) || 16), 8, 24), mold };
}
export function circle(r, n = 128) { return Array.from({ length: n }, (_, i) => [round(r * Math.cos(i * 2 * Math.PI / n)), round(r * Math.sin(i * 2 * Math.PI / n))]); }
export function outline(d) {
  const r = d.diameter / 2;
  return Array.from({ length: 384 }, (_, i) => {
    const a = i * Math.PI * 2 / 384;
    const amp = d.side === 'round' ? 0 : d.side === 'wave' ? 1 : 2;
    const radius = r - amp / 2 + amp / 2 * Math.cos(a * d.count);
    return [round(radius * Math.cos(a)), round(radius * Math.sin(a))];
  });
}
export function area(loop) { return loop.reduce((sum, p, i) => { const q = loop[(i + 1) % loop.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2; }
export function regionArea(r) { return Math.abs(area(r.outer)) - r.holes.reduce((sum, h) => sum + Math.abs(area(h)), 0); }
function ring(radius, width, height, label) { return { outer: circle(radius), holes: [circle(radius - width).reverse()], height, label }; }
function radialMotifs(d) {
  const R = d.patternDiameter / 2, h = d.relief, n = d.petals, regions = [];
  const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const place = (loop, a, center = .71) => loop.map(([x, y]) => [round(R * ((x + center) * Math.cos(a) - y * Math.sin(a))), round(R * ((x + center) * Math.sin(a) + y * Math.cos(a)))]);
  const add = (outer, a, label, holes = [], center = .71, height = h) => regions.push({ outer: place(outer, a, center), holes: holes.map(hole => place(hole, a, center).reverse()), height, label });
  const sample = (fn, count = 32) => Array.from({ length: count }, (_, i) => fn(i * Math.PI * 2 / count));
  const ellipse = (rx, ry) => sample(t => [rx * Math.cos(t), ry * Math.sin(t)]);
  const width = Math.min(.1, 1.15 / n);
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n;
    if (d.pattern === 'lotus') {
      const leaf = (rx, ry) => sample(t => [rx * Math.cos(t), ry * Math.sin(t) * Math.abs(Math.sin(t))]);
      add(leaf(.155, width), a, '莲瓣', [leaf(.105, width * .48)]);
      add(circle(.022, 12), a + Math.PI / n, '联珠', [], .9, h * .7);
    } else if (d.pattern === 'rosette') {
      add(ellipse(.075, width * .6), a, '内层莲瓣', [], .56, h * .7);
      add(ellipse(.10, width * .82), a + Math.PI / n, '外层莲瓣', [], .81);
    } else if (d.pattern === 'blossom') {
      const radius = Math.min(.12, 1.35 / n);
      add(sample(t => polar(radius * (1 + .2 * Math.cos(5 * t)), t), 60), a, '五瓣团花', [circle(radius * .24, 12)]);
      add(circle(.018, 12), a + Math.PI / n, '花间珠点', [], .87, h * .7);
    } else if (d.pattern === 'brocade') {
      const diamond = (rx, ry) => [[rx, 0], [0, ry], [-rx, 0], [0, -ry]];
      add(diamond(.16, width), a, '镂空菱锦', [diamond(.092, width * .48)]);
      add(diamond(.034, width * .4), a + Math.PI / n, '错位小菱', [], .9, h * .7);
    } else if (d.pattern === 'stars') {
      const r = Math.min(.115, 1.3 / n);
      add(Array.from({ length: 16 }, (_, j) => polar(r * (j % 2 ? .5 : 1), j * Math.PI / 8)), a, '八芒星', [circle(r * .2, 12)]);
      add(circle(.02, 12), a + Math.PI / n, '星间联珠', [], .9, h * .7);
    } else if (d.pattern === 'fan') {
      for (const r of [.57, .70, .83]) {
        const half = Math.PI / n * .72;
        const arc = (radius, reverse) => Array.from({ length: 14 }, (_, j) => polar(radius, a - half + 2 * half * (reverse ? 13 - j : j) / 13));
        const loop = [...arc(r, false), ...arc(r - .028, true)].map(p => p.map(v => round(v * R)));
        regions.push({ outer: loop, holes: [], height: h * (r === .7 ? 1 : .75), label: '扇面弧纹' });
      }
    } else if (d.pattern === 'moon') {
      const r = Math.min(.125, 1.4 / n);
      // 两条弧线围成单一月牙，无相切内孔 / Two arcs form a simple crescent with no tangent hole.
      const crescent = [...Array.from({ length: 25 }, (_, j) => polar(r, Math.PI / 2 + Math.PI * j / 24)), ...Array.from({ length: 23 }, (_, j) => [-r * .32 * Math.sin(Math.PI * (j + 1) / 24), -r * Math.cos(Math.PI * (j + 1) / 24)])];
      add(crescent, a, '弦月');
      add([[.032, 0], [0, .02], [-.032, 0], [0, -.02]], a + Math.PI / n, '伴月星', [], .84, h * .7);
    }
  }
  return regions;
}
export function parametricReliefs(d) {
  const R = d.patternDiameter / 2, h = d.relief;
  const result = [ring(R, .9, h * .75, '外圈')];
  if (d.mode === 'image') return result;
  result.push(ring(R * .45, .8, h, '团圆内环'));
  if (!['petals', 'rays', 'cloud'].includes(d.pattern)) return [...result, ...radialMotifs(d)];
  if (d.pattern === 'cloud') {
    result.push(ring(R * .66, .85, h * .75, '中环'));
    result.push({ outer: Array.from({ length: 256 }, (_, i) => { const a = i / 256 * Math.PI * 2, r = R * (.81 + .035 * Math.cos(d.petals * a)); return [round(r * Math.cos(a)), round(r * Math.sin(a))]; }), holes: [Array.from({ length: 256 }, (_, i) => { const a = -i / 256 * Math.PI * 2, r = R * (.81 + .035 * Math.cos(d.petals * a)) - .8; return [round(r * Math.cos(a)), round(r * Math.sin(a))]; })], height: h, label: '涟漪' });
  } else {
    for (let i = 0; i < d.petals; i++) {
      const a = i / d.petals * Math.PI * 2;
      const radial = R * .175, center = R * .70, tangential = Math.min(R * .075, Math.PI * R * .5 / d.petals);
      const n = d.pattern === 'rays' ? 4 : 32;
      const outer = Array.from({ length: n }, (_, j) => {
        const t = j / n * Math.PI * 2;
        const x = center + radial * Math.cos(t), y = tangential * Math.sin(t) * (d.pattern === 'petals' ? (.82 + .18 * Math.cos(t)) : 1);
        return [round(x * Math.cos(a) - y * Math.sin(a)), round(x * Math.sin(a) + y * Math.cos(a))];
      });
      result.push({ outer, holes: [], height: h, label: `花瓣 ${i + 1}` });
    }
  }
  return result;
}

// 闭合轮廓简化，保留孔洞 / Simplify closed contours without changing winding.
function simplifyLine(points, epsilon) {
  if (points.length < 3) return points;
  const first = points[0], last = points[points.length - 1];
  let max = 0, at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], dx = last[0] - first[0], dy = last[1] - first[1];
    const t = clamp(((p[0] - first[0]) * dx + (p[1] - first[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const dist = Math.hypot(p[0] - first[0] - t * dx, p[1] - first[1] - t * dy);
    if (dist > max) { max = dist; at = i; }
  }
  if (max <= epsilon) return [first, last];
  return [...simplifyLine(points.slice(0, at + 1), epsilon).slice(0, -1), ...simplifyLine(points.slice(at), epsilon)];
}
function simplifyLoop(loop, epsilon) {
  const points = loop.slice(0, -1), middle = Math.floor(points.length / 2);
  return [...simplifyLine(points.slice(0, middle + 1), epsilon).slice(0, -1), ...simplifyLine([...points.slice(middle), points[0]], epsilon).slice(0, -1)];
}
export function rasterRegions(values, size, diameter, height, levels = 1, label = '浮雕') {
  const thresholds = levels === 1 ? [.5] : [.24, .49, .74];
  const regions = [];
  for (const [level, threshold] of thresholds.entries()) {
    const polys = contours().size([size, size]).thresholds([threshold])(values)[0].coordinates;
    for (const polygon of polys) {
      const loops = polygon.map(loop => simplifyLoop(loop.map(([x, y]) => [(x / size - .5) * diameter, (.5 - y / size) * diameter]), levels === 1 ? .065 : .14).map(p => p.map(round)));
      if (loops[0].length < 3 || Math.abs(area(loops[0])) < .16) continue;
      const region = { outer: loops[0], holes: loops.slice(1).filter(p => p.length >= 3 && Math.abs(area(p)) > .09), height: round(height * (level + 1) / thresholds.length), label };
      if (regionArea(region) > .12) regions.push(region);
    }
  }
  return regions;
}
export function centerRegions(regions) {
  if (!regions.length) return regions;
  const points = regions.flatMap(r => r.outer);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const move = loop => loop.map(([x, y]) => [round(x - cx), round(y - cy)]);
  // 所有笔画和字孔一起平移，保留相对位置 / Center the complete ink bounds, including counters.
  return regions.map(r => ({ ...r, outer: move(r.outer), holes: r.holes.map(move) }));
}
// 实际墨迹居中后适配内环，保留字孔 / Center ink bounds and fit the inner ring, retaining counters.
export function textRadius(d) { return d.patternDiameter * (d.mode === 'image' ? .24 : .225) - (d.mode === 'image' ? .7 : .8) - .6; }
function transformRegions(regions, transform) {
  const loop = points => points.map(p => transform(...p).map(round));
  return regions.map(r => ({ ...r, outer: loop(r.outer), holes: r.holes.map(loop) }));
}
function inkRegions(text, d, emSize) {
  const size = 512, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const family = isEnglish(text) ? (d.font === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif') : (d.font === 'serif' ? '"Songti SC", "SimSun", serif' : '"PingFang SC", "Microsoft YaHei", sans-serif');
  let fontSize = size * .8;
  ctx.font = `600 ${fontSize}px ${family}`;
  let metrics = ctx.measureText(text);
  fontSize *= Math.min(1, size * .86 / Math.max(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent));
  ctx.font = `600 ${fontSize}px ${family}`; metrics = ctx.measureText(text);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, size / 2 + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2, size / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  return centerRegions(rasterRegions(Array.from({ length: size * size }, (_, i) => pixels[i * 4] / 255), size, emSize * size / fontSize, d.relief, 1, '文字'));
}
export function textReliefs(d) {
  if (!isValidText(d.character)) throw Error('请输入最多 2 个汉字或 5 个英文字母，请勿混用。');
  if (!d.character) return [];
  const radius = textRadius(d);
  let regions;
  if (d.textLayout === 'circular' && isEnglish(d.character)) {
    const letters = [...d.character], em = radius * .64 * d.textSize / Math.floor(d.patternDiameter * .38), orbit = radius - em * .62;
    const span = (letters.length - 1) * Math.PI / 3;
    regions = letters.flatMap((letter, i) => {
      const a = Math.PI / 2 + span / 2 - i * Math.PI / 3, rotation = a - Math.PI / 2;
      return transformRegions(inkRegions(letter, d, em), (x, y) => [orbit * Math.cos(a) + x * Math.cos(rotation) - y * Math.sin(rotation), orbit * Math.sin(a) + x * Math.sin(rotation) + y * Math.cos(rotation)]);
    });
  } else regions = inkRegions(d.character, d, d.textSize);
  const extent = Math.max(...regions.flatMap(r => r.outer.map(p => Math.hypot(...p))));
  const scale = Math.min(1, radius / extent);
  return transformRegions(regions, (x, y) => [x * scale, y * scale]);
}
export function makeGeometry(d) {
  const reliefs = parametricReliefs(d);
  if (d.mode === 'image' && d.image) {
    const { size, values } = d.image;
    const texture = values.map((v, i) => {
      const x = (i % size + .5) / size - .5, y = (Math.floor(i / size) + .5) / size - .5;
      if (Math.hypot(x, y) > .45 || (d.character && Math.hypot(x, y) < .24)) return 0;
      return d.invert ? 1 - v : v;
    });
    reliefs.push(...rasterRegions(texture, size, d.patternDiameter, d.relief, 3, '图片浮雕'));
    if (d.character) reliefs.push(ring(d.patternDiameter * .24, .7, d.relief, '文字内环'));
  }
  if (d.character) reliefs.push(...textReliefs(d));
  if (reliefs.length > 400 || reliefs.some(r => r.outer.length > 2000 || r.holes.length > 150 || r.holes.some(h => h.length > 2000)) || reliefs.reduce((n, r) => n + r.outer.length + r.holes.reduce((s, h) => s + h.length, 0), 0) > 10000) throw Error('图片细节过多，请换用轮廓更清晰、背景更简洁的图片。');
  return { outline: outline(d), topOutline: topOutline(d), reliefs: reliefs.sort((a, b) => a.height - b.height) };
}
export function designDocument(d, geometry) {
  return { schema: 'mooncake.design', version: 2, units: 'mm', createdAt: new Date().toISOString(), dimensions: { diameter: d.diameter, thickness: d.thickness, draftAngle: d.draftAngle ?? 0 }, side: { pattern: d.side, count: d.count }, front: { mode: d.mode, pattern: d.pattern, diameter: d.patternDiameter, relief: d.relief, petals: d.petals, invert: d.invert, image: d.mode === 'image' ? d.image : null }, text: { character: d.character, size: d.textSize, font: d.font, layout: d.textLayout || 'straight' }, mold: currentMold(d.mold), geometry: geometry ? { ...geometry, topOutline: geometry.topOutline || topOutline(d, geometry.outline) } : null };
}
export function readDocument(doc) {
  if (!doc || doc.schema !== 'mooncake.design' || ![1, 2].includes(doc.version) || doc.units !== 'mm') throw Error('请选择 Mooncake 导出的毫米制设计 JSON（v1 / v2）。');
  if (doc.version === 1 && (doc.dimensions?.draftAngle ?? 0) !== 0) throw Error('尺寸超出范围，请检查 JSON。');
  const d = { diameter: doc.dimensions?.diameter, thickness: doc.dimensions?.thickness, draftAngle: doc.version === 1 ? 0 : doc.dimensions?.draftAngle, side: doc.side?.pattern, count: doc.side?.count, mode: doc.front?.mode, pattern: doc.front?.pattern, patternDiameter: doc.front?.diameter, relief: doc.front?.relief, petals: doc.front?.petals, invert: doc.front?.invert, image: doc.front?.image ?? null, character: doc.text?.character, textSize: doc.text?.size, font: doc.text?.font, textLayout: doc.text?.layout ?? 'straight' };
  for (const key of ['diameter', 'thickness', 'draftAngle', 'count', 'patternDiameter', 'relief', 'petals', 'textSize']) if (!Number.isFinite(d[key])) throw Error(`设计参数 ${key} 无效。`);
  if (!(d.side in SIDE_NAMES) || !(d.pattern in PATTERN_NAMES) || !['image', 'parametric'].includes(d.mode) || !['serif', 'sans'].includes(d.font) || typeof d.invert !== 'boolean' || !isValidText(d.character) || !['straight', 'circular'].includes(d.textLayout) || (d.textLayout === 'circular' && !isEnglish(d.character))) throw Error('花纹类型或文字格式无效。');
  const normalized = normalize(d);
  if (Object.keys(normalized).some(k => typeof d[k] === 'number' && normalized[k] !== d[k])) throw Error('尺寸超出范围，请检查 JSON。');
  if (d.image && (d.image.size !== 64 || !Array.isArray(d.image.values) || d.image.values.length !== 4096 || d.image.values.some(v => !Number.isFinite(v) || v < 0 || v > 1) || typeof d.image.name !== 'string')) throw Error('图片高度数据无效。');
  if (d.mode === 'image' && !d.image) throw Error('该设计缺少图片高度数据。');
  const mold = doc.mold === undefined ? { ...MOLD_DEFAULT } : doc.mold;
  if (!mold || mold.type !== 'hand_press' || !['M8x1.25', 'M20x2.5'].includes(mold.connection) || [['radialClearance', .15, .8], ['wallThickness', 2, 8], ['stampThickness', 4, 10]].some(([key, low, high]) => !Number.isFinite(mold[key]) || mold[key] < low || mold[key] > high) || Object.entries(MOLD_HARDWARE).some(([key, value]) => key !== 'connection' && key in mold && !(key === 'bossDiameter' && !('guideHeight' in mold) && mold[key] === 40) && mold[key] !== value)) throw Error('模具参数无效。');
  d.mold = currentMold(mold);
  return d;
}
export async function loadImage(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('支持 PNG、JPG 或 WebP 图片。');
  if (file.size > 10 * 1024 * 1024) throw Error('图片请小于 10 MB。');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const size = 64, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    const scale = (size - 8) / Math.max(img.width, img.height), w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const raw = Array.from({ length: size * size }, (_, i) => 1 - (.2126 * pixels[i * 4] + .7152 * pixels[i * 4 + 1] + .0722 * pixels[i * 4 + 2]) / 255);
    const values = raw.map((_, i) => {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = i % size + dx, y = Math.floor(i / size) + dy; if (x >= 0 && y >= 0 && x < size && y < size) { sum += raw[y * size + x]; count++; } }
      return round(sum / count);
    });
    return { name: file.name.slice(0, 120), size, values };
  } finally { URL.revokeObjectURL(url); }
}
export function download(name, content, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
