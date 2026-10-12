import { Group, Mesh, LoadingManager, BufferAttribute } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'meshoptimizer/decoder';
import { inspectGlb, partsFromScene, partMatrix, partMetadata, validatePartMetadata, jointMatrices, GLTF_FROM_ENGINEERING } from './armor-model.js';
import { robotModel } from '../../shared/robot.mjs';
import { armorFrame, partResources, releaseArmorResources } from './armor-session.js';

export async function loadArmorGlb(buffer,config,{onProgress=()=>{},signal}={}){
  signal?.throwIfAborted();onProgress('正在校验原始模型…');await armorFrame(signal);
  const json=inspectGlb(buffer);
  if(json.textures?.some(t=>t.extensions?.KHR_texture_basisu))throw Error('此模型使用 KTX2 贴图，请改为普通 PNG / JPEG 贴图的 GLB。');
  const manager=new LoadingManager(),draco=new DRACOLoader(manager);
  const decoderPath=`${import.meta.env.BASE_URL}draco/`;
  manager.setURLModifier(url=>{
    if(/^(blob:|data:)/i.test(url)||url.startsWith(decoderPath))return url;
    throw Error('模型包含未内嵌的资源，请重新导出。');
  });
  draco.setDecoderPath(decoderPath);
  manager.onProgress=(url,loaded,total)=>{if(!signal?.aborted)onProgress(`正在解码模型资源 · ${loaded} / ${total}`);};
  const abort=()=>{manager.abort();draco.dispose();};signal?.addEventListener('abort',abort,{once:true});
  let loaded,parts,success=false;
  try{
    onProgress('正在解码完整网格与原始贴图…');await armorFrame(signal);
    const loader=new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
    loaded=await loader.parseAsync(buffer,'');
    signal?.throwIfAborted();onProgress('正在校正坐标与尺寸 · 保留全部三角面');await armorFrame(signal);
    parts=partsFromScene(loaded.scene,config);
    onProgress('正在准备高精度预览…');await armorFrame(signal);success=true;return parts;
  }catch(e){if(signal?.aborted)throw signal.reason;throw Error(e.message||'无法读取此 GLB，请检查模型和贴图。');}
  finally{
    signal?.removeEventListener('abort',abort);draco.dispose();
    const meshes=[];loaded?.scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
    // Late results must be disposed after navigation, never remounted.
    // 离开后才完成的读取结果也要释放，不能重新挂回页面。
    releaseArmorResources(partResources([...meshes,...(!success&&parts?parts:[])]),success?partResources(parts):undefined);
  }
}
export async function exportArmorGlb(parts,config,maxTextureSize=Infinity,includeHidden=false,{signal}={}){
  signal?.throwIfAborted();
  if(!parts.some(p=>includeHidden||p.visible!==false))throw Error('没有可导出的可见部件。');
  parts.filter(p=>includeHidden||p.visible!==false).forEach(p=>validatePartMetadata(partMetadata(p)));
  const root=new Group(),matrices=jointMatrices(robotModel(config)),temporary=[];root.name='SkateChassis_Armor';root.matrixAutoUpdate=false;root.matrix.copy(GLTF_FROM_ENGINEERING);
  root.userData={armorWorkbench:{version:1,units:'meter',coordinateSystem:'glTF Y-up',config:{mast:config.mast,width:config.width,wheel:config.wheel},scope:'visual armor; cut surfaces may be open'}};
  parts.filter(p=>includeHidden||p.visible!==false).forEach(p=>{
    let geometry=p.geometry;
    if(!geometry.index&&Array.isArray(p.material)){
      geometry=geometry.clone();const ids=new Uint32Array(geometry.attributes.position.count);for(let i=0;i<ids.length;i++)ids[i]=i;geometry.setIndex(new BufferAttribute(ids,1));temporary.push(geometry);
    }
    const mesh=new Mesh(geometry,p.material);mesh.name=p.name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(partMatrix(p,matrices));
    // 同时保存编辑参数和当前几何位置。 Keep editable binding data alongside the visible geometry transform.
    mesh.userData={armorPart:partMetadata(p)};root.add(mesh);
  });
  root.updateMatrixWorld(true);
  try{
    const buffer=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false,maxTextureSize});
    signal?.throwIfAborted();
    // 保存前验证文件仍能重新载入，避免生成无法恢复的草稿。 Validate recoverability before accepting a saved draft.
    inspectGlb(buffer);return buffer;
  }finally{temporary.forEach(g=>g.dispose());}
}
