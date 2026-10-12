import * as T from 'three';
export const cache=new Map(),effects=[];
export const hooks={useMemo:fn=>fn(),useRef:()=>({current:null}),useEffect:fn=>effects.push(fn),useState:value=>[value,()=>{}]};
export function useGLTF(path){const g=cache.get(path);if(!g)throw Error('Missing '+path);return {scene:g.clone(true)}}useGLTF.preload=()=>{};
export const Edges=()=>null;
function jsx(type,p={}){
 if(typeof type==='function'){const obj=type(p);if(obj)obj.name=type.name;return obj}
 if(typeof type!=='string')return null;
 if(type.endsWith('Material'))return new T[type[0].toUpperCase()+type.slice(1)](p);
 if(type.endsWith('Geometry'))return new T[type[0].toUpperCase()+type.slice(1)](...(p.args||[]));
 const obj=type==='primitive'?p.object:type==='mesh'?new T.Mesh(p.geometry||new T.BufferGeometry(),p.material||new T.MeshStandardMaterial()):type==='lineSegments'?new T.LineSegments(p.geometry):new T.Group();
 for(const key of ['position','rotation','scale','quaternion'])if(p[key]!==undefined){const v=p[key];if(typeof v==='number')obj[key].setScalar(v);else if(Array.isArray(v))obj[key].fromArray(v);else obj[key].copy(v)}
 if(p.ref)p.ref.current=obj;
 for(const child of [p.children].flat(Infinity)){if(child?.isObject3D)obj.add(child);else if(child?.isBufferGeometry)obj.geometry=child;else if(child?.isMaterial)obj.material=child}
 return obj;
}export const factory={jsx,jsxs:jsx};
