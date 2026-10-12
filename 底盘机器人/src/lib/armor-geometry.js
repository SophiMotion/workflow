import * as THREE from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

const SKINNING_ATTRIBUTES = new Set(['skinIndex', 'skinWeight']);

function supportedAttributeNames(geometry) {
  return Object.keys(geometry.attributes).filter(name => !SKINNING_ATTRIBUTES.has(name));
}

export function countTriangles(geometry) {
  const count = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
  return Math.floor(count / 3);
}

export { splitGeometry } from './armor-split.js';

function sourceIndices(geometry) {
  if (geometry.index) return Uint32Array.from(geometry.index.array);
  return Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, index) => index);
}

function copyGroupVertices(geometry, indices, attributeNames) {
  if(geometry.index){
    // Indexed GLBs already encode UV seams as separate vertices. / 索引已区分纹理接缝，无需逐角生成字符串键。
    const remap=new Int32Array(geometry.attributes.position.count).fill(-1),compactIndices=new Uint32Array(indices.length);
    let count=0;
    for(let i=0;i<indices.length;i++){const old=indices[i];if(remap[old]===-1)remap[old]=count++;compactIndices[i]=remap[old];}
    const localValues=Object.fromEntries(attributeNames.map(name=>[name,new Float32Array(count*geometry.attributes[name].itemSize)]));
    for(let old=0;old<remap.length;old++){const mapped=remap[old];if(mapped<0)continue;for(const name of attributeNames){const a=geometry.attributes[name];for(let c=0;c<a.itemSize;c++)localValues[name][mapped*a.itemSize+c]=a.getComponent(old,c);}}
    return {compactIndices,localValues};
  }
  const remap = new Map();
  const compactIndices = new Uint32Array(indices.length);
  const localValues = Object.fromEntries(attributeNames.map(name => [name, []]));
  for (let i = 0; i < indices.length; i += 1) {
    const oldIndex = indices[i];
    const key = attributeNames.flatMap(name => {
      const attribute = geometry.getAttribute(name);
      return Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(oldIndex, component));
    }).join('|');
    let newIndex = remap.get(key);
    if (newIndex === undefined) {
      newIndex = remap.size;
      remap.set(key, newIndex);
      for (const name of attributeNames) {
        const attribute = geometry.getAttribute(name);
        for (let component = 0; component < attribute.itemSize; component += 1) {
          localValues[name].push(attribute.getComponent(oldIndex, component));
        }
      }
    }
    compactIndices[i] = newIndex;
  }
  return { compactIndices, localValues };
}

/**
 * Returns a compact, simplified clone. Material groups are simplified independently
 * to preserve their boundaries; the conservative error limit can prevent reaching
 * the exact requested ratio on meshes with strong borders or attribute seams.
 * 返回紧凑的简化副本；各材质组独立处理以保留边界。对于强边界或属性接缝较多的
 * 网格，保守误差限制可能使结果达不到请求的精简比例。
 */
export async function simplifyGeometry(geometry, ratio) {
  if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 1) throw new RangeError('ratio must be between 0.1 and 1');
  const position = geometry.getAttribute('position');
  if (!position) throw new TypeError('geometry must have a position attribute');
  await MeshoptSimplifier.ready;

  const allIndices = sourceIndices(geometry);
  const groups = geometry.groups.length > 0
    ? geometry.groups
    : [{ start: 0, count: allIndices.length, materialIndex: 0 }];
  const attributeNames = supportedAttributeNames(geometry);
  const output = { indices: [], values: Object.fromEntries(attributeNames.map(name => [name, []])), groups: [] };

  for (const group of groups) {
    const groupCount = Math.floor(group.count / 3) * 3;
    if (groupCount === 0) continue;
    const sliced = allIndices.slice(group.start, group.start + groupCount);
    const local = copyGroupVertices(geometry, sliced, attributeNames);
    const positions = new Float32Array(local.localValues.position);
    const auxiliaryNames = attributeNames.filter(name => name !== 'position');
    const attributeStride = auxiliaryNames.reduce((sum, name) => sum + geometry.getAttribute(name).itemSize, 0);
    const attributes = new Float32Array((positions.length / 3) * attributeStride);
    const weights = [];
    let attributeOffset = 0;
    for (const name of auxiliaryNames) {
      const itemSize = geometry.getAttribute(name).itemSize;
      const values = local.localValues[name];
      for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
        for (let component = 0; component < itemSize; component += 1) {
          attributes[vertex * attributeStride + attributeOffset + component] = values[vertex * itemSize + component];
        }
      }
      for (let component = 0; component < itemSize; component += 1) weights.push(name.startsWith('uv') ? 0.5 : 1);
      attributeOffset += itemSize;
    }

    const target = Math.max(3, Math.floor((local.compactIndices.length * ratio) / 3) * 3);
    let simplified = local.compactIndices;
    if (target < local.compactIndices.length) {
      [simplified] = attributeStride > 0
        ? MeshoptSimplifier.simplifyWithAttributes(local.compactIndices, positions, 3, attributes, attributeStride, weights, null, target, 0.01)
        : MeshoptSimplifier.simplify(local.compactIndices, positions, 3, target, 0.01);
    }

    const [vertexRemap, vertexCount] = MeshoptSimplifier.compactMesh(simplified);
    const baseVertex = output.values.position.length / 3;
    const groupStart = output.indices.length;
    // compactMesh rewrites indices in place and returns old-to-new mapping. / 原地重写索引并返回旧到新映射。
    for (const index of simplified) output.indices.push(baseVertex + index);
    for (const name of attributeNames) {
      const itemSize = geometry.getAttribute(name).itemSize;
      const compact = new Array(vertexCount * itemSize);
      for (let oldIndex = 0; oldIndex < vertexRemap.length; oldIndex += 1) {
        const newIndex = vertexRemap[oldIndex];
        if (newIndex === 0xffffffff) continue;
        for (let component = 0; component < itemSize; component += 1) {
          compact[newIndex * itemSize + component] = local.localValues[name][oldIndex * itemSize + component];
        }
      }
      // Avoid spread-call argument limits on production-size meshes. / 避免大型网格触发展开调用参数上限。
      for (const value of compact) output.values[name].push(value);
    }
    output.groups.push({ start: groupStart, count: simplified.length, materialIndex: group.materialIndex });
  }

  const result = new THREE.BufferGeometry();
  result.setIndex(output.indices);
  for (const name of attributeNames) {
    const source = geometry.getAttribute(name);
    const attribute = new THREE.Float32BufferAttribute(output.values[name], source.itemSize);
    result.setAttribute(name, attribute);
  }
  if (geometry.groups.length > 0) {
    for (const group of output.groups) result.addGroup(group.start, group.count, group.materialIndex);
  }
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}
