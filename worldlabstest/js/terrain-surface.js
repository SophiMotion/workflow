import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// This separate, non-rendered mesh supplies heights, not physical collision response.
export class TerrainSurface {
 constructor(){this.root=null;this.source='';this.road=null;this.bounds=new THREE.Box3();this.ray=new THREE.Raycaster();}
 clear(){if(this.root)this.root.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())m?.dispose();});this.root=null;this.source='';}
 async load(url,world){
  if(!url){this.clear();return;}
  if(this.source!==url||!this.root){
   this.clear();const gltf=await new GLTFLoader().loadAsync(url);
   this.content=gltf.scene;this.content.traverse(o=>{for(const m of [o.material].flat())if(m)m.side=THREE.DoubleSide;});
   this.root=new THREE.Group();this.frame=new THREE.Group();this.root.add(this.frame);this.frame.add(this.content);this.source=url;
  }
  this.transform(world);
 }
 transform(world){
  if(!this.root)return;
  this.content.scale.setScalar(world.scale);this.content.position.set(0,-world.ground_offset,0);
  this.frame.rotation.x=world.axis_flip?Math.PI:0;
  this.root.position.fromArray(world.position);this.root.rotation.y=THREE.MathUtils.degToRad(world.yaw);this.root.updateMatrixWorld(true);
  this.bounds.setFromObject(this.root);
 }
 project(ray){
  const roadHit=this.road?.project(ray);
  if(this.road?.exclusive)return roadHit?.point.clone()??null;
  const terrainHit=this.root?ray.intersectObject(this.root,true).find(hit=>!this.road?.contains(hit.point)):null;
  return (!terrainHit||roadHit&&roadHit.distance<=terrainHit.distance?roadHit:terrainHit)?.point.clone()??null;
 }
 heightAt(x,z){
  if(!this.root)return null;
  const bounds=this.bounds.clone();if(this.road)bounds.expandByObject(this.road.root);
  this.ray.set(new THREE.Vector3(x,bounds.max.y+5,z),new THREE.Vector3(0,-1,0));
  this.ray.far=bounds.max.y-bounds.min.y+10;
  return this.project(this.ray)?.y??null;
 }
 bake(points,clearance=.035){
  if(!this.root)throw Error('地面网格未就绪，无法贴地行驶。');
  if(points.length<2)return points.map(p=>[...p]);
  const output=[];
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],steps=Math.max(1,Math.min(40,Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.75)));
   for(let k=i===1?0:1;k<=steps;k++){
    const t=k/steps,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t,y=this.heightAt(x,z);
    if(y===null)throw Error('部分路线超出地面网格，请缩短或重新点选。');
    output.push([x,y+clearance,z]);
   }
  }
  return output;
 }
}
