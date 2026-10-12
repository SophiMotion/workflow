import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { countTriangles, simplifyGeometry, splitGeometry } from '../src/lib/armor-geometry.js';

function triangleArea(geometry) {
  const p = geometry.getAttribute('position');
  const index = geometry.index;
  let area = 0;
  for (let i = 0; i < (index ? index.count : p.count); i += 3) {
    const ids = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
    const a = new THREE.Vector3().fromBufferAttribute(p, ids[0]);
    const b = new THREE.Vector3().fromBufferAttribute(p, ids[1]);
    const c = new THREE.Vector3().fromBufferAttribute(p, ids[2]);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}

function crossingTriangle(indexed = false) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, 0, 0, 1, 0, 0, 1, 2, 0,
  ], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 1, 1,
  ], 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([
    1, 0, 0, 0, 1, 0, 0, 0, 1,
  ], 3));
  if (indexed) geometry.setIndex([0, 1, 2]);
  geometry.addGroup(0, 3, 7);
  return geometry;
}

test('countTriangles handles indexed and non-indexed geometry', () => {
  assert.equal(countTriangles(crossingTriangle(false)), 1);
  assert.equal(countTriangles(crossingTriangle(true)), 1);
});

for (const indexed of [false, true]) {
  test(`splitGeometry clips ${indexed ? 'indexed' : 'non-indexed'} triangles and conserves area`, () => {
    const source = crossingTriangle(indexed);
    const { negative, positive } = splitGeometry(source, 'x', 0);

    assert.ok(countTriangles(negative) > 0);
    assert.ok(countTriangles(positive) > 0);
    assert.ok(Math.abs(triangleArea(negative) + triangleArea(positive) - 2) < 1e-6);

    for (const [geometry, predicate] of [[negative, x => x <= 1e-7], [positive, x => x >= -1e-7]]) {
      const positions = geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i += 1) assert.ok(predicate(positions.getX(i)));
      assert.ok(geometry.getAttribute('normal'));
      assert.ok(geometry.getAttribute('uv'));
      assert.ok(geometry.getAttribute('color'));
      assert.deepEqual(geometry.groups.map(group => group.materialIndex), [7]);
      assert.equal(geometry.groups[0].count, countTriangles(geometry) * 3);
    }
  });
}

test('splitGeometry linearly interpolates UVs at the cut', () => {
  const { negative, positive } = splitGeometry(crossingTriangle(), 'x', 0);
  for (const geometry of [negative, positive]) {
    const positions = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    const cutUvs = [];
    for (let i = 0; i < positions.count; i += 1) {
      if (Math.abs(positions.getX(i)) < 1e-7) cutUvs.push([uv.getX(i), uv.getY(i)]);
    }
    assert.ok(cutUvs.some(([u, v]) => Math.abs(u - 0.5) < 1e-6 && Math.abs(v) < 1e-6));
  }
});

test('splitGeometry preserves PBR attributes, normalizes directions, and dequantizes normalized integers', () => {
  const source = crossingTriangle();
  source.setAttribute('uv1', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2));
  source.setAttribute('uv2', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0], 2));
  source.setAttribute('uv3', new THREE.Float32BufferAttribute([0.2, 0.3, 0.4, 0.5, 0.6, 0.7], 2));
  source.setAttribute('tangent', new THREE.Float32BufferAttribute([
    1, 0, 0, 1, 0, 1, 0, -1, 0, 1, 0, -1,
  ], 4));
  source.setAttribute('normal', new THREE.Float32BufferAttribute([
    1, 0, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  source.setAttribute('color', new THREE.Uint8BufferAttribute([
    255, 0, 0, 0, 255, 0, 0, 0, 255,
  ], 3, true));

  const { negative, positive } = splitGeometry(source, 'x', 0);
  for (const half of [negative, positive]) {
    for (const name of ['uv', 'uv1', 'uv2', 'uv3', 'normal', 'color', 'tangent']) {
      assert.ok(half.hasAttribute(name), `missing ${name}`);
    }
    assert.equal(half.getAttribute('color').normalized, false);
    const positions = half.getAttribute('position');
    const normals = half.getAttribute('normal');
    const tangents = half.getAttribute('tangent');
    for (let i = 0; i < positions.count; i += 1) {
      assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(normals, i).length() - 1) < 1e-6);
      assert.ok(Math.abs(Math.hypot(tangents.getX(i), tangents.getY(i), tangents.getZ(i)) - 1) < 1e-6);
      assert.equal(Math.abs(tangents.getW(i)), 1);
    }
    assert.ok(Math.max(...half.getAttribute('color').array) <= 1);
  }
});

test('splitGeometry assigns coplanar faces once and emits no zero-area triangles', () => {
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 0, 1, 0, 0, 0, 1,
    -1, 2, 0, 1, 2, 0, 1, 3, 0,
  ], 3));

  const result = splitGeometry(source, 'x', 0);
  assert.ok(Math.abs(triangleArea(result.negative) + triangleArea(result.positive) - triangleArea(source)) < 1e-6);
  for (const half of [result.negative, result.positive]) {
    const positions = half.getAttribute('position');
    for (let i = 0; i < (half.index?.count??positions.count); i += 3) {
      const ids=[0,1,2].map(n=>half.index?half.index.getX(i+n):i+n);
      const triangle = new THREE.BufferGeometry();
      triangle.setAttribute('position', new THREE.Float32BufferAttribute([
        ...new THREE.Vector3().fromBufferAttribute(positions, ids[0]),
        ...new THREE.Vector3().fromBufferAttribute(positions, ids[1]),
        ...new THREE.Vector3().fromBufferAttribute(positions, ids[2]),
      ], 3));
      assert.ok(triangleArea(triangle) > 1e-10);
    }
  }
});

test('splitGeometry keeps each source triangle material assignment', () => {
  const geometry = crossingTriangle();
  const second = crossingTriangle().translate(0, 3, 0);
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const a = geometry.getAttribute(name).array;
    const b = second.getAttribute(name).array;
    const Attribute = geometry.getAttribute(name).constructor;
    merged.setAttribute(name, new Attribute(new Float32Array([...a, ...b]), geometry.getAttribute(name).itemSize));
  }
  merged.addGroup(0, 3, 2);
  merged.addGroup(3, 3, 9);

  const result = splitGeometry(merged, 'x', 0);
  for (const half of [result.negative, result.positive]) {
    assert.deepEqual(half.groups.map(group => group.materialIndex), [2, 9]);
    assert.equal(half.groups.reduce((sum, group) => sum + group.count, 0), countTriangles(half) * 3);
  }
});

test('splitGeometry rejects a plane that does not genuinely cross the mesh', () => {
  assert.throws(() => splitGeometry(crossingTriangle(), 'x', 2), /does not split/i);
  assert.throws(() => splitGeometry(crossingTriangle(), 'q', 0), /axis/i);
});

test('simplifyGeometry reduces a smooth mesh and preserves source and vertex attributes', async () => {
  const source = new THREE.SphereGeometry(2, 24, 16);
  const firstGroupCount = Math.floor(source.index.count / 6) * 3;
  source.clearGroups();
  source.addGroup(0, firstGroupCount, 3);
  source.addGroup(firstGroupCount, source.index.count - firstGroupCount, 8);
  const colors = new Uint8Array(source.getAttribute('position').count * 3).fill(102);
  source.setAttribute('color', new THREE.Uint8BufferAttribute(colors, 3, true));
  source.setAttribute('uv1', source.getAttribute('uv').clone());
  source.setAttribute('tangent', new THREE.Float32BufferAttribute(
    Array.from({ length: source.getAttribute('position').count }, () => [1, 0, 0, 1]).flat(), 4,
  ));
  const sourceIndex = source.index.array.slice();
  const sourcePositions = source.getAttribute('position').array.slice();
  const sourceTriangles = countTriangles(source);

  const result = await simplifyGeometry(source, 0.4);

  assert.notEqual(result, source);
  assert.ok(countTriangles(result) < sourceTriangles);
  assert.ok(countTriangles(result) > 0);
  assert.deepEqual(source.index.array, sourceIndex);
  assert.deepEqual(source.getAttribute('position').array, sourcePositions);
  for (const name of ['position', 'normal', 'uv', 'uv1', 'color', 'tangent']) {
    assert.ok(result.getAttribute(name), `missing ${name}`);
    assert.equal(result.getAttribute(name).count, result.getAttribute('position').count);
  }
  assert.ok(result.index.array.every(index => index < result.getAttribute('position').count));
  assert.equal(result.getAttribute('color').normalized, false);
  assert.ok(Math.max(...result.getAttribute('color').array) <= 1);
  assert.equal(result.groups.reduce((sum, group) => sum + group.count, 0), result.index.count);
  assert.deepEqual(result.groups.map(group => group.materialIndex), source.groups.map(group => group.materialIndex));
});

test('simplifyGeometry supports non-indexed input and validates ratio', async () => {
  const source = new THREE.SphereGeometry(1, 16, 12).toNonIndexed();
  const result = await simplifyGeometry(source, 0.5);
  assert.ok(result.index);
  assert.ok(countTriangles(result) > 0);
  assert.ok(result.getAttribute('position').count < source.getAttribute('position').count);
  await assert.rejects(simplifyGeometry(source, 0.09), /ratio/i);
  await assert.rejects(simplifyGeometry(source, 1.01), /ratio/i);
});

test('simplifyGeometry compacts attributes larger than the JavaScript argument limit', async () => {
  const vertexCount = 50_001;
  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i += 1) {
    positions[i * 3] = i;
    positions[i * 3 + 1] = i % 2;
  }
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const result = await simplifyGeometry(source, 1);

  assert.equal(result.getAttribute('position').array.length, 150_003);
  assert.equal(result.index.count, vertexCount);
});
