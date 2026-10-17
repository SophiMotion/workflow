import * as THREE from 'three';
import {visualGeometry,collisionGeometry} from './abb-assets.js';
import {ABB_JOINTS,mountMatrix} from './abb-kinematics.js';
import {ServoSpotGun} from './servo-spot-gun.js';
import {sheetMetal} from './spot-contact.js';
const V=(...a)=>new THREE.Vector3(...a);
export class ABBSixAxisRig {
 constructor(o,parent,station){
  this.parent=parent;this.station=station;this.joints=[];this.colliders=[];this.visuals=[];
  const white=o.mat('#e6e9e7',.36,.27),dark=o.mat('#323c43',.5,.5),metal=o.mat('#8b9ca7',.32,.75),copper=o.mat('#c78a57',.3,.72);
  this.base=new THREE.Group();this.base.matrixAutoUpdate=false;this.base.matrix.copy(mountMatrix(station));parent.add(this.base);
  const bp=new THREE.Vector3().setFromMatrixPosition(this.base.matrix);o.box(.95,.12,.86,dark,bp.x,.06,bp.z,parent);o.box(.72,.18,.69,metal,bp.x,.21,bp.z,parent);
  const link=(name,group,index)=>{const material=(name==='piston'?metal:white).clone(),mesh=o.mesh(visualGeometry[name],material,0,0,0,group);this.visuals.push(mesh);const proxy=new THREE.Mesh(collisionGeometry[name],new THREE.MeshBasicMaterial());proxy.visible=false;group.add(proxy);this.colliders.push({mesh:proxy,visual:mesh,name:`${station} ${name}`,index,station,role:'robot'});return mesh;};
  link('base_link',this.base,0);let previous=this.base;
  ABB_JOINTS.forEach((j,i)=>{const g=new THREE.Group();g.position.fromArray(j.origin);previous.add(g);this.joints.push(g);link('link_'+(i+1),g,i+1);previous=g;});
  this.cylinder=new THREE.Group();this.cylinder.position.set(-.349,-.194,-.142);this.joints[0].add(this.cylinder);link('cylinder',this.cylinder,2);
  this.piston=new THREE.Group();this.cylinder.add(this.piston);link('piston',this.piston,2);
  this.gun=new THREE.Group();parent.add(this.gun);this.gunColliders=[];
  const solid=(name,mesh)=>{mesh.material=mesh.material.clone();this.visuals.push(mesh);this.gunColliders.push({mesh,visual:mesh,name:station+' '+name,index:8,station,role:'gun'});return mesh;};
  solid('枪背架',o.box(.07,.49,.105,dark,.28,.15,0,this.gun));
  solid('固定枪臂',o.box(.25,.045,.08,metal,.165,-.085,0,this.gun));
  // Copper caps are intentional workpiece contacts; excluded from collision pairs.
  o.cyl(.016,.06,copper,0,-.055,0,this.gun);
  const neck=o.mesh(new THREE.CylinderGeometry(.012,.012,.055,16),copper,.024,-.085,0,this.gun);neck.rotation.z=Math.PI/2;
  this.upper=new THREE.Group();this.upper.position.set(.28,.36,0);this.gun.add(this.upper);
  solid('移动枪臂',o.box(.31,.065,.10,metal,-.14,0,0,this.upper));
  solid('加压缸',o.cyl(.054,.18,dark,-.28,-.10,0,this.upper));
  o.cyl(.061,.026,metal,-.28,-.01,0,this.upper);
  this.cap=o.cyl(.017,.07,copper,0,.035,0,this.gun);
  this.plunger=o.cyl(.024,.16,metal,0,.15,0,this.gun);
  o.cyl(.10,.065,dark,.28,.46,0,this.gun);o.cyl(.075,.06,metal,.28,.41,0,this.gun);
  for(const side of [-1,1]){const curve=new THREE.CatmullRomCurve3([V(.29,.3,side*.07),V(.39,.1,side*.08),V(.20,-.07,side*.08),V(.04,-.07,side*.04)]);o.mesh(new THREE.TubeGeometry(curve,18,.009,6,false),o.mat(side===1?'#4b6c80':'#9a3d38'),0,0,0,this.gun);}
  this.indicator=o.mesh(new THREE.SphereGeometry(.021,10,8),new THREE.MeshBasicMaterial({color:'#f6a253'}),0,0,0,parent);
  this.legacyGunColliders=this.gunColliders;this.servoGun=new ServoSpotGun(o,parent,station);this.visuals.push(...this.servoGun.visuals);
 }
 update(p,project){
  const detailed=sheetMetal(project);this.gun.visible=!detailed;this.servoGun.group.visible=detailed;this.gunColliders=detailed?this.servoGun.colliders:this.legacyGunColliders;this.contact=detailed?this.servoGun.update(p,project):null;
  this.joints.forEach((g,i)=>g.quaternion.setFromAxisAngle(V(...ABB_JOINTS[i].axis),p.q[i]));
  this.cylinder.rotation.y=-.25*p.q[1];this.piston.position.set(0,.15*p.q[1],0);this.piston.rotation.set(.20897,0,-Math.PI/2,'ZYX');
  this.gun.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(p.tangent,p.normal,p.tangent.clone().cross(p.normal)));this.gun.position.copy(p.root);
  const stroke=project.engineering.gunStroke/1000*p.gunOpening;this.cap.position.y=.035+stroke;this.plunger.position.y=.15+stroke*.5;this.upper.rotation.z=project.engineering.gunType==='x'?-.28*p.gunOpening:0;
  this.indicator.visible=!detailed&&p.energized&&p.reachable;this.indicator.position.copy(p.root).addScaledVector(p.normal,.012);
 }
 clearHighlights(){this.visuals.forEach(m=>m.material.emissive.set(0));}
}
