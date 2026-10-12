import { Box3, Euler, Matrix4, Quaternion, Vector3, Mesh, Group, BoxGeometry, SphereGeometry, MeshStandardMaterial, BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const GLB_LIMIT=512*1024*1024;
export const TRIANGLE_LIMIT=5_000_000;
export const GLB_LIMIT_LABEL='512 MB';
export const TRIANGLE_LIMIT_LABEL='500 万';
export const ARMOR_VERSION=1;
// Source convention: glTF +Z forward, +X right, +Y up; engineering +X forward, +Y right, +Z up.
export const ENGINEERING_FROM_GLTF=new Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1);
export const GLTF_FROM_ENGINEERING=ENGINEERING_FROM_GLTF.clone().invert();
const identity=()=>new Matrix4();
const vector=v=>new Vector3().fromArray(v);
export function jointMatrices(bodies,angles={}){
  const byId=Object.fromEntries(bodies.map(b=>[b.id,b])),result={base_footprint:identity()};
  function get(id){
    if(result[id])return result[id];
    const b=byId[id];if(!b)return identity();
    const origin=vector(b.position).sub(vector(byId[b.parent]?.position||[0,0,0]));
    const raw=Number(angles[id])||0,angle=b.joint==='revolute'?Math.max(b.lower,Math.min(b.upper,raw*Math.PI/180)):0;
    const local=new Matrix4().compose(origin,new Quaternion().setFromAxisAngle(vector(b.axis).normalize(),angle),new Vector3(1,1,1));
    return result[id]=get(b.parent).clone().multiply(local);
  }
  bodies.forEach(b=>get(b.id));return result;
}
export function transformMatrix(part){return new Matrix4().compose(vector(part.position),new Quaternion().setFromEuler(new Euler(...part.rotation)),vector(part.scale));}
export function partMatrix(part,matrices={}){
  const base=transformMatrix(part);
  return part.binding&&part.bindRest&&matrices[part.binding]?matrices[part.binding].clone().multiply(new Matrix4().fromArray(part.bindRest).invert()).multiply(base):base;
}
export function withMatrix(part,matrix){
  const p=new Vector3(),q=new Quaternion(),s=new Vector3();matrix.decompose(p,q,s);
  return {...part,position:p.toArray(),rotation:new Euler().setFromQuaternion(q).toArray().slice(0,3),scale:s.toArray()};
}
export function detachPart(part,matrices){return {...withMatrix(part,partMatrix(part,matrices)),binding:'',bindRest:null};}
export function partsBounds(parts,matrices={}){
  const box=new Box3();for(const p of parts){if(!p.geometry.boundingBox)p.geometry.computeBoundingBox();box.union(p.geometry.boundingBox.clone().applyMatrix4(partMatrix(p,matrices)));}return box;
}
export function inspectGlb(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<20)throw Error('文件不是有效的 GLB。');
  if(buffer.byteLength>GLB_LIMIT)throw Error(`GLB 超过 ${GLB_LIMIT_LABEL}，请分成多个文件导入。`);
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw Error('GLB 文件头无效或文件不完整。');
  const length=view.getUint32(12,true);
  if(view.getUint32(16,true)!==0x4e4f534a||length%4||20+length>buffer.byteLength)throw Error('GLB 数据块无效。');
  let json;try{json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));}catch{throw Error('GLB 描述数据损坏。');}
  if(json.asset?.version!=='2.0')throw Error('仅支持 GLB 2.0。');
  if([...(json.buffers||[]),...(json.images||[])].some(x=>x.uri&&!/^data:/i.test(x.uri)))throw Error('模型引用了外部文件，请导出贴图内嵌的 GLB。');
  if(json.skins?.length||json.meshes?.some(m=>m.primitives?.some(p=>p.targets?.length)))throw Error('此文件包含蒙皮或变形目标，请从混元导出静态外观模型。');
  if(json.extensionsRequired?.includes('EXT_mesh_gpu_instancing'))throw Error('暂不支持实例化模型，请先展开实例再导出。');
  let triangles=0;
  for(const m of json.meshes||[])for(const p of m.primitives||[]){
    if(p.mode!==undefined&&p.mode!==4)throw Error('请导出三角网格 GLB。');
    triangles+=(json.accessors?.[p.indices??p.attributes?.POSITION]?.count||0)/3;
  }
  if(triangles>TRIANGLE_LIMIT)throw Error(`模型超过 ${TRIANGLE_LIMIT_LABEL}三角面，请分部件导入；无需降低单个部件的精度。`);
  return json;
}
function validMeta(m){
  return m?.version===ARMOR_VERSION&&['position','rotation','scale'].every(k=>Array.isArray(m[k])&&m[k].length===3&&m[k].every(Number.isFinite))&&m.scale.every(v=>v>0&&v<1000)&&(!m.binding||(typeof m.binding==='string'&&Array.isArray(m.bindRest)&&m.bindRest.length===16&&m.bindRest.every(Number.isFinite)&&Math.abs(new Matrix4().fromArray(m.bindRest).determinant())>1e-10));
}
export function validatePartMetadata(value){if(!validMeta(value))throw Error('甲片缩放或绑定参数超出可保存范围，请撤销极端尺寸调整。');return value;}
export function partMetadata(p){return {version:ARMOR_VERSION,id:p.id,name:p.name,position:p.position,rotation:p.rotation,scale:p.scale,binding:p.binding||'',bindRest:p.bindRest||null,visible:p.visible!==false,cutOpen:!!p.cutOpen};}
function bakeGeometry(geometry,matrix){
  geometry.applyMatrix4(matrix);
  if(matrix.determinant()<0){
    // Once a reflection is baked, the renderer no longer sees a negative object scale.
    if(geometry.index){
      const index=geometry.index;
      for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}
      index.needsUpdate=true;
    }else{
      for(const attribute of Object.values(geometry.attributes)){
        for(let i=0;i<attribute.count;i+=3)for(let c=0;c<attribute.itemSize;c++){
          const b=attribute.getComponent(i+1,c);attribute.setComponent(i+1,c,attribute.getComponent(i+2,c));attribute.setComponent(i+2,c,b);
        }
        attribute.needsUpdate=true;
      }
    }
    const tangent=geometry.attributes.tangent;
    if(tangent){for(let i=0;i<tangent.count;i++)tangent.setW(i,-tangent.getW(i));tangent.needsUpdate=true;}
  }
  return geometry;
}
function savedGroupGeometry(node,meshes){
  if(Math.abs(node.matrixWorld.determinant())<1e-10)throw Error('保存的甲片变换无效，无法恢复部件。');
  const inverse=node.matrixWorld.clone().invert(),geometries=[],materials=[],groups=[];
  let offset=0;
  try{
    for(const mesh of meshes){
      let geometry=mesh.geometry.clone();
      if(!geometry.index){const ids=new Uint32Array(geometry.attributes.position.count);for(let i=0;i<ids.length;i++)ids[i]=i;geometry.setIndex(new BufferAttribute(ids,1));}
      geometries.push(geometry);
      if(!geometry.attributes.normal)geometry.computeVertexNormals();
      bakeGeometry(geometry,inverse.clone().multiply(mesh.matrixWorld));
      const sourceMaterials=Array.isArray(mesh.material)?mesh.material:[mesh.material],base=materials.length;
      materials.push(...sourceMaterials);
      const count=geometry.index.count;
      const sourceGroups=Array.isArray(mesh.material)?geometry.groups:[{start:0,count,materialIndex:0}];
      for(const group of sourceGroups)groups.push({start:offset+group.start,count:group.count,materialIndex:base+group.materialIndex});
      offset+=count;
    }
    const geometry=mergeGeometries(geometries,false);
    if(!geometry)throw Error('保存的多材质甲片包含不兼容的顶点属性，无法完整恢复；请先在原编辑器统一属性后重新导出。');
    // Keep compact indices across material primitives. / 多材质恢复也保留共享顶点。
    for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
    return {geometry,material:materials.map(material=>material.clone())};
  }finally{for(const geometry of geometries)geometry.dispose();}
}
export function partsFromScene(scene,config){
  scene.updateMatrixWorld(true);const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
  if(!meshes.length)throw Error('GLB 中没有可编辑的网格。');
  if(meshes.some(m=>m.isSkinnedMesh||m.isInstancedMesh))throw Error('请导入静态、非实例化的三角网格。');
  for(const mesh of meshes){
    const pos=mesh.geometry.attributes.position;
    if(!pos)throw Error('模型缺少顶点坐标。');
    for(let n=0;n<pos.count;n++)if(!Number.isFinite(pos.getX(n))||!Number.isFinite(pos.getY(n))||!Number.isFinite(pos.getZ(n)))throw Error('模型含无效顶点坐标。');
  }
  const triangles=meshes.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position?.count??0)/3,0);
  if(triangles>TRIANGLE_LIMIT)throw Error(`模型超过 ${TRIANGLE_LIMIT_LABEL}三角面，请分部件导入。`);
  const entries=new Map();
  for(const mesh of meshes){
    let owner=mesh;
    for(let node=mesh;node;node=node.parent){
      if(node.userData.armorPart!==undefined){
        if(!validMeta(node.userData.armorPart))throw Error('保存的甲片编辑信息无效，无法安全恢复。');
        owner=node;break;
      }
    }
    if(!entries.has(owner))entries.set(owner,[]);
    entries.get(owner).push(mesh);
  }
  if(entries.size>250)throw Error('网格部件超过 250 个，请先合并细小部件。');
  const saved=[...entries.keys()].every(node=>validMeta(node.userData.armorPart));
  if(!saved&&[...entries.keys()].some(node=>node.userData.armorPart))throw Error('模型混合了保存的甲片和普通网格，请分别导入以保留编辑信息。');
  const parts=[...entries].map(([mesh,children],i)=>{
    if(saved&&(!mesh.isMesh||children.length>1)){
      const result=savedGroupGeometry(mesh,children),meta=mesh.userData.armorPart;
      return {...meta,id:crypto.randomUUID(),name:String(meta.name||mesh.name||`部件 ${i+1}`).slice(0,80),...result};
    }
    const g=mesh.geometry.clone(),meta=saved?mesh.userData.armorPart:null;
    if(!g.attributes.normal)g.computeVertexNormals();
    const materials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>m.clone());
    const material=Array.isArray(mesh.material)?materials:materials[0];
    if(meta)return {...meta,id:crypto.randomUUID(),name:String(meta.name||mesh.name||`部件 ${i+1}`).slice(0,80),geometry:g,material};
    bakeGeometry(g,ENGINEERING_FROM_GLTF.clone().multiply(mesh.matrixWorld));
    return {id:crypto.randomUUID(),name:mesh.name||`部件 ${i+1}`,geometry:g,material,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],binding:'',bindRest:null,visible:true};
  });
  if(!saved){
    const box=partsBounds(parts),size=box.getSize(new Vector3());if(size.z<1e-8)throw Error('模型高度为零，请检查模型方向。');
    const factor=(config.mast/1000)/size.z,center=box.getCenter(new Vector3()),deck=config.wheel/2000+.13;
    const normalizer=new Matrix4().makeTranslation(0,0,deck).multiply(new Matrix4().makeScale(factor,factor,factor)).multiply(new Matrix4().makeTranslation(-center.x,-center.y,-box.min.z));
    parts.forEach(p=>{p.geometry.applyMatrix4(normalizer);p.geometry.computeBoundingBox();const c=p.geometry.boundingBox.getCenter(new Vector3());p.geometry.translate(-c.x,-c.y,-c.z);p.position=c.toArray();});
  }
  return parts;
}
export function demoScene(){
  const root=new Group(),bronze=new MeshStandardMaterial({color:'#8ca78b',metalness:.65,roughness:.5});
  const add=(name,size,pos)=>{const m=new Mesh(new BoxGeometry(...size,4,4,4),bronze);m.name=name;m.position.set(...pos);root.add(m);};
  add('胸甲示例',[.38,.42,.21],[0,.95,0]);add('头盔示例',[.24,.25,.23],[0,1.35,0]);
  for(const s of [-1,1]){add(s<0?'右肩甲示例':'左肩甲示例',[.2,.18,.24],[s*.3,1.12,0]);const m=new Mesh(new SphereGeometry(.1,48,32),bronze);m.scale.set(1,1.8,1);m.position.set(s*.3,.8,0);m.name=s<0?'右臂甲示例':'左臂甲示例';root.add(m);}
  return root;
}
