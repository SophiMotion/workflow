import * as THREE from 'three';

// 两个独立三角化端面和直线侧壁 / Independently triangulated caps and straight tapered sides.
export function taperedBodyGeometry(bottom, top, height) {
  if (bottom.length !== top.length) throw Error('Mismatched body sections');
  const positions = [];
  const triangle = (a, b, c) => positions.push(...a, ...b, ...c);
  const cap = (loop, z, reverse) => {
    const points = loop.map(([x, y]) => new THREE.Vector2(x, y));
    for (const indices of THREE.ShapeUtils.triangulateShape(points, [])) {
      const [a, b, c] = (reverse ? [...indices].reverse() : indices).map(i => [...loop[i], z]);
      triangle(a, b, c);
    }
  };
  cap(bottom, 0, true); cap(top, height, false);
  for (let i = 0; i < bottom.length; i++) {
    const j = (i + 1) % bottom.length;
    const a = [...bottom[i], 0], b = [...bottom[j], 0], c = [...top[j], height], d = [...top[i], height];
    triangle(a, b, c); triangle(c, d, a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return geometry;
}
