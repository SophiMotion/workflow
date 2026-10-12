import * as THREE from 'three';
import {robotModel} from '../vendor/skatechassis/shared/robot.mjs';
import {defaultConfig} from '../vendor/skatechassis/shared/domain.mjs';
export function buildRobot(){
 const colors={dark:0x2a3432,metal:0xaeb8b0,rubber:0x252925,sensor:0x355642,battery:0x4b5b63,green:0x5a8757,red:0xcf573c};
 const zup=new THREE.Group();
 for(const b of robotModel(defaultConfig)){
  const g=b.shape==='box'?new THREE.BoxGeometry(...b.size):new THREE.CylinderGeometry(b.size[0],b.size[0],b.size[1],20);
  if(b.shape==='cylinder')g.rotateX(Math.PI/2);
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:colors[b.color],roughness:.4,metalness:b.color==='metal'?.6:.1}));
  mesh.rotation.fromArray(b.rotation);mesh.position.fromArray(b.position.map((v,i)=>v+b.offset[i]));mesh.name=b.id;zup.add(mesh);
 }
 zup.rotation.x=-Math.PI/2;
 const root=new THREE.Group();root.rotation.y=Math.PI/2;root.add(zup);
 const outer=new THREE.Group();outer.add(root);return outer;
}
