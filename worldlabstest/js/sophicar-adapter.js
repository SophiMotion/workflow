import * as THREE from 'three';
import {assetUrl,jsonAsset} from './local-assets.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const cache = new Map();
export const hooks = {useMemo: fn => fn()};
export const react = {forwardRef: fn => props => fn(props, null)};
export function useGLTF(path) {
  const entry = cache.get(path);
  if (!entry) throw new Error(`尚未加载 Sophicar 零件：${path.split('/').pop()}`);
  // Original module mutates materials on clones; deep-copy geometry so disposal is independent.
  const scene = entry.scene.clone(true);
  scene.traverse(o => { if(o.isMesh) { o.geometry=o.geometry.clone(); } });
  return {scene};
}
useGLTF.preload = () => {};
function jsx(type, props = {}) {
  if (typeof type === 'function') return type(props);
  const {children, ...p} = props;
  if (type === 'meshStandardMaterial') return new THREE.MeshStandardMaterial(p);
  if (type.endsWith('Geometry')) {
    const name=type[0].toUpperCase()+type.slice(1); return new THREE[name](...(p.args||[]));
  }
  let obj = type === 'primitive' ? p.object : type === 'mesh' ? new THREE.Mesh(p.geometry || new THREE.BufferGeometry(), new THREE.MeshStandardMaterial()) : new THREE.Group();
  for (const attr of ['position','scale','rotation','quaternion']) {
    const v = p[attr]; if(v===undefined) continue;
    if(typeof v==='number') obj[attr].setScalar(v);
    else if(Array.isArray(v)) obj[attr].fromArray(v);
    else obj[attr].copy(v);
  }
  for (const child of [children].flat(Infinity)) {
    if(child?.isObject3D) obj.add(child);
    else if(child?.isBufferGeometry) { if(!p.geometry)obj.geometry.dispose(); obj.geometry=child; }
    else if(child?.isMaterial) {obj.material?.dispose();obj.material=child;}
  }
  return obj;
}
export const factory = {jsx,jsxs:jsx};
let ready;
export function preloadParts() {
  if(!ready) ready = (async()=>{
    const manifest=await jsonAsset('vendor/sophicar/source.json');
    const loader=new GLTFLoader();
    await Promise.all(manifest.assets.map(async a=>{
      const data=await loader.loadAsync(await assetUrl(a.file));
      cache.set(new URL(a.source).pathname,data);
    }));
  })().catch(e=>{ready=null;throw e});
  return ready;
}
export async function buildSophicar(params={}) {
  await preloadParts();
  const {default:Factory}=await import('../vendor/sophicar/SkateChassis.js');
  const geometry=Factory(params);
  geometry.scale.setScalar(.001); // Original parametric component and GLBs use millimeters.
  geometry.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(geometry);
  geometry.position.y=-box.min.y;
  const group=new THREE.Group();group.add(geometry);
  group.name='Sophicar 线控底盘';
  group.userData.source='https://sophicar.com/parametric-modeling';
  group.userData.frontAxis='-Z';
  return group;
}
