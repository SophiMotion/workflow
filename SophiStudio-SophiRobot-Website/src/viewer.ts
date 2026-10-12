import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {deform,roleOf,type Model,type SourceMesh,type Bounds} from './geometry';
import {defaults,type Params} from './parameters';
import {limbMatrix,neutralLimbs,limbPart,type LimbPoses} from './limbs';
import {headMatrix,headStage,neutralHead,type HeadPose} from './head';
export type View='ISO'|'Top'|'Front'|'Rear'|'Side';
export class Viewer{
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.OrthographicCamera(-1000,1000,1000,-1000,1,20000);
 readonly renderer:THREE.WebGLRenderer;
 readonly controls:OrbitControls;
 readonly root=new THREE.Group();
 private meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[];
 private edges:THREE.LineSegments[]=[];
 private grid:THREE.GridHelper;
 private axes=new THREE.AxesHelper(180);
 private model?:Model;
 private frustum=2200;
 private selected?:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>;
 private dimensions?:THREE.Box3Helper;
 private measurePoints:THREE.Vector3[]=[];
 private measureLine?:THREE.Line;
 private measuring=false;
 private view:View='ISO';
 private params:Params={...defaults};
 private pose:LimbPoses=neutralLimbs();
 private head:HeadPose=neutralHead();
 onSelect:(name:string,size:number[])=>void=()=>{};
 onMeasure:(text:string)=>void=()=>{};
 constructor(private host:HTMLElement){
  this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0xf8f9fa);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
  this.renderer.domElement.setAttribute('aria-label','Interactive 3D humanoid assembly. Drag to orbit, right-drag to pan, scroll to zoom.');
  this.renderer.domElement.setAttribute('role','img');this.host.append(this.renderer.domElement);
  this.camera.up.set(0,0,1);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.1;this.controls.minZoom=.25;this.controls.maxZoom=15;
  const pmrem=new THREE.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
  this.scene.add(new THREE.HemisphereLight(0xe1eaff,0x43444a,2));
  for(const [x,y,z,intensity] of [[-1200,-1200,2500,3],[1700,800,2000,2],[0,1500,500,1]]){const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(x,y,z);this.scene.add(light);}
  this.grid=new THREE.GridHelper(6000,60,0xbdc1c6,0xe8eaed);this.grid.rotation.x=Math.PI/2;this.grid.position.z=-.5;
  const mat=this.grid.material as THREE.LineBasicMaterial;mat.transparent=true;mat.opacity=.3;
  this.axes.position.set(-650,-650,1);this.axes.visible=false;this.scene.add(this.root,this.grid,this.axes);
  new ResizeObserver(()=>this.resize()).observe(host);
  let start=[0,0];this.renderer.domElement.addEventListener('pointerdown',e=>start=[e.clientX,e.clientY]);
  this.renderer.domElement.addEventListener('pointerup',e=>{if(e.button===0&&Math.hypot(e.clientX-start[0],e.clientY-start[1])<5)this.pick(e)});
  this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.onMeasure('3D graphics context lost. Reload this page to recover.');});
  this.renderer.setAnimationLoop(()=>{this.controls.update();this.renderer.render(this.scene,this.camera)});
 }
 load(model:Model,p:Params){
  this.model=model;
  model.meshes.forEach(source=>{
   const role=roleOf(source);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(source.positions,3));geometry.setIndex(source.indices);geometry.computeVertexNormals();
   const rubber=role==='tire',motor=role==='motor'||role==='actuator',caster=role==='caster';
   const material=new THREE.MeshStandardMaterial({color:rubber?0x292b2e:motor?0x70767d:caster?0x626971:role==='cover'?0xb5bdc5:0xa2acb7,metalness:rubber?.05:.65,roughness:rubber?.88:.34,side:THREE.DoubleSide});
   const mesh=new THREE.Mesh(geometry,material);mesh.name=source.name;mesh.userData={id:source.id,role};mesh.matrixAutoUpdate=false;this.meshes.push(mesh);this.root.add(mesh);
   const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,32),new THREE.LineBasicMaterial({color:rubber?0x131518:0x444b54,transparent:true,opacity:rubber?.35:.42}));mesh.add(edge);this.edges.push(edge);
  });
  this.update(p);this.setView('ISO');
 }
 update(p:Params):Bounds{
  this.params={...p};
  this.model?.meshes.forEach((source:SourceMesh,i)=>{
   const mesh=this.meshes[i];const a=deform(source,p);(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).copyArray(new Float32Array(a));mesh.geometry.getAttribute('position').needsUpdate=true;
   mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
   this.edges[i].geometry.dispose();this.edges[i].geometry=new THREE.EdgesGeometry(mesh.geometry,32);
  });
  return this.setPose(this.pose);
 }
 setHeadPose(pose:HeadPose):Bounds{this.head={...pose};return this.setPose(this.pose);}
 setPose(pose:LimbPoses,precise=true):Bounds{
  this.pose={...pose};const all=new THREE.Box3();const cache=new Map<string,THREE.Matrix4>();
  for(const mesh of this.meshes){
   const id=mesh.userData.id as number,part=limbPart(id),group=part?`${part.limb}:${part.stage}`:`head:${headStage(id)}`;
   if(!cache.has(group))cache.set(group,part?limbMatrix(id,this.params,this.pose):headMatrix(id,this.params,this.head));
   mesh.matrix.copy(cache.get(group)!);mesh.matrixWorldNeedsUpdate=true;
  }
  this.root.updateMatrixWorld(true);all.setFromObject(this.root,precise);if(this.dimensions)this.dimensions.box.copy(all);this.clearMeasurement();
  const min=all.min.toArray(),max=all.max.toArray();return {min,max,size:max.map((v,i)=>v-min[i]),center:max.map((v,i)=>(v+min[i])/2)};
 }
 setView(view:View){
  this.view=view;const box=new THREE.Box3().setFromObject(this.root),center=box.getCenter(new THREE.Vector3());
  const offsets:Record<View,THREE.Vector3>={ISO:new THREE.Vector3(1.4,1.8,.85),Top:new THREE.Vector3(0,0,1),Front:new THREE.Vector3(0,-1,0),Rear:new THREE.Vector3(0,1,0),Side:new THREE.Vector3(1,0,0)};
  this.camera.up.set(0,view==='Top'?1:0,view==='Top'?0:1);this.camera.position.copy(center).addScaledVector(offsets[view],3500);this.controls.target.copy(center);this.camera.lookAt(center);this.fit();
 }
 fit(){
  const box=new THREE.Box3().setFromObject(this.root);if(box.isEmpty())return;
  const center=box.getCenter(new THREE.Vector3());const delta=center.clone().sub(this.controls.target);this.camera.position.add(delta);this.controls.target.copy(center);this.camera.updateMatrixWorld();
  const vertices=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])vertices.push(new THREE.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse));
  const projected=new THREE.Box3().setFromPoints(vertices).getSize(new THREE.Vector3());const ratio=this.host.clientWidth/Math.max(1,this.host.clientHeight);
  this.frustum=Math.max(projected.y,projected.x/ratio)*1.36;this.camera.zoom=1;this.resize();this.controls.update();
 }
 private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const ratio=w/h;this.camera.left=-this.frustum*ratio/2;this.camera.right=this.frustum*ratio/2;this.camera.top=this.frustum/2;this.camera.bottom=-this.frustum/2;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
 toggle(name:string,value:boolean){
  if(name==='cover')this.meshes.forEach(m=>{if(m.userData.role==='cover')m.visible=value});
  if(name==='grid')this.grid.visible=value;
  if(name==='axes')this.axes.visible=value;
  if(name==='edges')this.edges.forEach(e=>e.visible=value);
  if(name==='dimensions'){
   if(!this.dimensions){this.dimensions=new THREE.Box3Helper(new THREE.Box3().setFromObject(this.root),new THREE.Color(0x002fa7));this.scene.add(this.dimensions);}
   this.dimensions.visible=value;
  }
  if(this.selected&&!this.selected.visible)this.select(undefined);
 }
 get visibleCount(){return this.meshes.filter(m=>m.visible).length;}
 measure(value:boolean){this.measuring=value;this.clearMeasurement();this.renderer.domElement.style.cursor=value?'crosshair':'grab';if(value)this.onMeasure('Select two points on the assembly.');}
 private clearMeasurement(){this.measurePoints=[];if(this.measureLine){this.scene.remove(this.measureLine);this.measureLine.geometry.dispose();(this.measureLine.material as THREE.Material).dispose();this.measureLine=undefined;}if(this.measuring)this.onMeasure('Select two points on the assembly.');}
 private pick(e:PointerEvent){
  const rect=this.renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),this.camera);
  const hit=ray.intersectObjects(this.meshes.filter(m=>m.visible),false)[0];
  if(this.measuring){if(!hit)return;if(this.measurePoints.length===2)this.clearMeasurement();this.measurePoints.push(hit.point.clone());
   if(this.measurePoints.length===2){this.measureLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.measurePoints),new THREE.LineBasicMaterial({color:0x002fa7,depthTest:false}));this.measureLine.renderOrder=99;this.scene.add(this.measureLine);this.onMeasure(`${this.measurePoints[0].distanceTo(this.measurePoints[1]).toFixed(2)} mm · point-to-point`);}else this.onMeasure('First point selected. Choose the second point.');
  }else this.select(hit?.object as typeof this.selected);
 }
 private select(mesh:typeof this.selected){if(this.selected)this.selected.material.emissive.setHex(0);this.selected=mesh;if(mesh){mesh.material.emissive.setHex(0x081b36);this.onSelect(mesh.name,mesh.geometry.boundingBox!.getSize(new THREE.Vector3()).toArray());}else this.onSelect('',[]);}
 screenshot(){this.renderer.render(this.scene,this.camera);return this.renderer.domElement.toDataURL('image/png');}
 get currentView(){return this.view;}
}
