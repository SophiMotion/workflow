import * as THREE from './vendor/three.module.min.js';

export const COUNT = 1000;
export const SPAN = 22;
export const CENTER_Y = 15;
export function seededRandom(seed = 8317) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Bake node, skin, morph and instance transforms before measuring world-space area.
export function readSurface(root) {
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const triangles = [], cumulative = [], box = new THREE.Box3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), instance = new THREE.Matrix4(), world = new THREE.Matrix4();
  let total = 0, visited = 0;
  root.traverseVisible(mesh => {
    if (!mesh.isMesh || !mesh.geometry.attributes.position) return;
    const g = mesh.geometry, idx = g.index, count = idx ? idx.count : g.attributes.position.count;
    const start = g.drawRange.start, end = Math.min(count, start + g.drawRange.count);
    for (let inst = 0; inst < (mesh.isInstancedMesh ? mesh.count : 1); inst++) {
      world.copy(mesh.matrixWorld);
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(inst, instance); world.multiply(instance); }
      for (let i = start; i + 2 < end; i += 3) {
        if (++visited > 2000000) throw new Error('模型面数过多，请简化到 200 万个三角面以内。');
        mesh.getVertexPosition(idx ? idx.getX(i) : i, a).applyMatrix4(world);
        mesh.getVertexPosition(idx ? idx.getX(i + 1) : i + 1, b).applyMatrix4(world);
        mesh.getVertexPosition(idx ? idx.getX(i + 2) : i + 2, c).applyMatrix4(world);
        const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * .5;
        if (!Number.isFinite(area) || area <= 0) continue;
        triangles.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
        total += area; cumulative.push(total); box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
      }
    }
  });
  if (!total || !Number.isFinite(total)) throw new Error('模型没有有效的三角形表面，请选择包含网格的 GLB。');
  return { triangles: new Float64Array(triangles), cumulative: new Float64Array(cumulative), total, box };
}
export function sampleTriangles(surface, count = COUNT, { normalize = true } = {}) {
  const { triangles: t, cumulative: cdf, total, box } = surface;
  const result = new Float32Array(count * 3), random = seededRandom();
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const scale = SPAN / Math.max(size.x, size.y, size.z);
  for (let i = 0; i < count; i++) {
    // Stratification prevents small but significant parts being lost by chance.
    const area = (i + random()) / count * total;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (cdf[mid] < area) lo = mid + 1; else hi = mid; }
    const offset = lo * 9, u = Math.sqrt(random()), v = random();
    for (let axis = 0; axis < 3; axis++) {
      let p = t[offset + axis] * (1-u) + t[offset+3+axis]*u*(1-v) + t[offset+6+axis]*u*v;
      if (normalize) p = (p - center.getComponent(axis)) * scale + (axis === 1 ? CENTER_Y : 0);
      result[i*3+axis] = p;
    }
  }
  return result;
}
export function sampleSurface(root, count = COUNT, options) { return sampleTriangles(readSurface(root), count, options); }
export function launchGrid(count = COUNT) {
  const out = new Float32Array(count*3), columns = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count/columns);
  for (let i=0;i<count;i++) out.set([(i%columns-(columns-1)/2)*.8,.2,(Math.floor(i/columns)-(rows-1)/2)*.8],i*3);
  return out;
}
export function preset(kind = 'sphere', count = COUNT) {
  const out = new Float32Array(count*3), random = seededRandom();
  for (let i=0;i<count;i++) {
    let x,y,z;
    if(kind==='helix') { const t=i/(count-1),a=t*Math.PI*10; x=8*Math.cos(a); z=8*Math.sin(a); y=(t-.5)*22; }
    else if(kind==='cube') { const v=[(random()-.5)*18,(random()-.5)*18,(random()-.5)*18];v[i%3]=i%6<3?9:-9;[x,y,z]=v; }
    else { y=1-2*(i+.5)/count;const r=Math.sqrt(1-y*y),angle=i*Math.PI*(3-Math.sqrt(5));x=11*r*Math.cos(angle);z=11*r*Math.sin(angle);y*=11; }
    out.set([x,y+CENTER_Y,z],i*3);
  }
  return out;
}
export function interpolate(from, to, progress, out) {
  if(progress<=0) {out.set(from);return out;}
  if(progress>=1) {out.set(to);return out;}
  for(let i=0;i<from.length;i+=3) {
    const delay=(i/3%32)/31*.12;
    const p=Math.max(0,Math.min(1,(progress-delay)/(1-delay))), eased=p*p*p*(p*(p*6-15)+10);
    for(let a=0;a<3;a++)out[i+a]=from[i+a]+(to[i+a]-from[i+a])*eased;
    out[i+1]+=Math.sin(Math.PI*p)*3;
  }
  return out;
}
