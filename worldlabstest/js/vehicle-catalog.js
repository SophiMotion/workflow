import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {assetUrl} from './local-assets.js';
export const VEHICLES={
 rover:{width:2.08,length:4.1,name:'Sophi 开放式智能试验车',file:'assets/fleet/reference-rover-video.glb',wheelbase:2.63,source:'用户图片 + 视频 · 曲面车身 / 估算尺寸'},
 sophicar:{width:1.85,length:2.75,name:'Sophicar 线控底盘',wheelbase:1.683,source:'Sophicar · 原始参数化模型'},
 fusion:{width:0.35,length:0.51,name:'SophiFusion 无刷小车',file:'assets/fleet/fusion.glb',wheelbase:.32,source:'Sophicar · 官网默认参数'},
 nav:{width:0.48,length:0.43,name:'Sophicar 导航小车',file:'assets/fleet/nav.glb',wheelbase:.35,source:'Sophicar · 官网默认参数'},
 edu:{width:0.36,length:0.53,name:'Sophicar 教育小车',file:'assets/fleet/edu.glb',wheelbase:.372,source:'Sophicar · 官网默认参数'},
 sophicore:{width:0.86,length:0.91,name:'SophiCore 轮式机器人',file:'assets/fleet/sophicore.glb',wheelbase:.49,source:'SophiCore · 公开 STEP 几何模型'}
};
const pending=new Map();
export async function buildCatalogVehicle(kind){
 const def=VEHICLES[kind];if(!def?.file)throw Error('车型不存在');
 if(!pending.has(kind))pending.set(kind,new GLTFLoader().loadAsync(await assetUrl(def.file)).catch(e=>{pending.delete(kind);throw e}));
 const model=(await pending.get(kind)).scene.clone(true);
 model.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();o.castShadow=true;o.receiveShadow=!o.material.transparent;if(o.material.transparent)o.castShadow=false;}});
 const root=new THREE.Group();root.name=def.name;root.add(model);
 if(kind==='rover'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,12,64,64,62);gradient.addColorStop(0,'rgba(16,24,32,.32)');gradient.addColorStop(.65,'rgba(16,24,32,.15)');gradient.addColorStop(1,'rgba(16,24,32,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const map=new THREE.CanvasTexture(canvas),shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.65,4.35),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.014;shadow.name='柔和接地阴影';shadow.userData.presentationOnly=true;shadow.renderOrder=1;root.add(shadow);
 }return root;
}
export function rollWheels(root,travel,scale=1){root?.traverse(o=>{if(o.userData.rollingRadius>0)o.rotation.x=-travel/(o.userData.rollingRadius*scale)});}
