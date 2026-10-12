import * as THREE from 'three';
import {SHOULDER,L1,L2} from './motion.js';
const up=new THREE.Vector3(0,1,0);
export class RobotRig {
 constructor(owner,parent){this.o=owner;this.parent=parent;const m=owner.materials,[x,y,z]=SHOULDER;
  owner.box(1.05,.07,1.0,m.dark,x,.035,z,parent);owner.box(.72,.55,.70,m.dark,x,.345,z,parent);owner.box(.9,.07,.88,m.metal,x,.645,z,parent);
  for(const dx of [-.35,.35])for(const dz of [-.34,.34])owner.bolt(x+dx,.70,z+dz,parent,.04);
  owner.cyl(.32,.20,m.white,x,.77,z,parent);owner.cyl(.27,.10,m.dark,x,.92,z,parent);owner.box(.38,.24,.40,m.white,x,1.04,z,parent);
  this.upper=this.link(L1,.18,.22);this.lower=this.link(L2,.12,.17);
  this.shoulder=this.joint(.26,.36);this.elbow=this.joint(.22,.34);this.wrist=this.joint(.115,.23);
  this.tool=owner.group('tool');parent.add(this.tool); // Reparented under robot for coherent visibility.
  this.housing=owner.mesh(new THREE.CylinderGeometry(.075,.10,1,24),m.dark,0,0,0,this.tool);
  this.neck=owner.mesh(new THREE.CylinderGeometry(.028,.035,1,24),m.metal,0,0,0,this.tool);
  this.nozzle=owner.mesh(new THREE.CylinderGeometry(.028,.022,.12,24),owner.mat('#b07d4c',.35,.8),0,0,0,this.tool);
  this.wire=owner.mesh(new THREE.CylinderGeometry(.004,.004,1,10),owner.mat('#d9ab75',.28,.8),0,0,0,this.tool);
  const points=new Float32Array(45*3);this.cableGeometry=new THREE.BufferGeometry();this.cableGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));this.cable=new THREE.Line(this.cableGeometry,new THREE.LineBasicMaterial({color:0x20272d}));parent.add(this.cable);
  // Articulated corrugated dress pack: reusable small rings on a smooth cable curve.
  this.dress=new THREE.InstancedMesh(new THREE.SphereGeometry(.042,8,6),m.rubber,65);this.dress.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(this.dress);this.dress.frustumCulled=false;
  this.temp=new THREE.Object3D();
 }
 link(length,r1,r2){const o=this.o,m=o.materials,g=new THREE.Group();this.parent.add(g);const shell=o.mesh(new THREE.CapsuleGeometry(r1,length-2*r1,6,14),m.white,0,0,0,g);shell.scale.z=.88;o.box(r1*1.45,length*.67,r2*.82,m.white,0,0,r1*.30,g);for(const dy of [-length*.28,length*.28]){const bolt=o.cyl(.025,.012,m.metal,0,dy,r1*.94,g);bolt.rotation.x=Math.PI/2;}return g;}
 joint(radius,width){const g=new THREE.Group(),o=this.o,m=o.materials;this.parent.add(g);for(const [r,h,z,mat] of [[radius,width,0,m.dark],[radius*.92,.045,width/2+.014,m.white],[radius*.52,.05,width/2+.045,m.metal]]){const c=o.cyl(r,h,mat,0,0,z,g);c.rotation.x=Math.PI/2;}for(let i=0;i<6;i++){const a=i*Math.PI/3;const c=o.cyl(.015,.017,m.dark,Math.cos(a)*radius*.71,Math.sin(a)*radius*.71,width/2+.048,g);c.rotation.x=Math.PI/2;}return g;}
 segment(object,a,b){object.position.copy(a).add(b).multiplyScalar(.5);object.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());}
 rod(object,a,b){this.segment(object,a,b);object.scale.y=a.distanceTo(b);}
 update(pose){const p=pose;this.segment(this.upper,p.shoulder,p.elbow);this.segment(this.lower,p.elbow,p.wrist);this.shoulder.position.copy(p.shoulder);this.elbow.position.copy(p.elbow);this.wrist.position.copy(p.wrist);this.wrist.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),p.normal);this.rod(this.housing,p.wrist,p.neck);this.rod(this.neck,p.neck,p.nozzle);this.nozzle.position.copy(p.nozzle).addScaledVector(p.normal,.047);this.nozzle.quaternion.setFromUnitVectors(up,p.normal);this.rod(this.wire,p.nozzle,p.tip);
  const curve=new THREE.CatmullRomCurve3([p.shoulder.clone().add(new THREE.Vector3(-.15,0,-.2)),p.elbow.clone().add(new THREE.Vector3(-.15,.28,-.18)),p.elbow.clone().lerp(p.wrist,.6).add(new THREE.Vector3(0,.24,-.22)),p.wrist.clone().addScaledVector(p.normal,.15),p.neck]);const a=this.cableGeometry.attributes.position;for(let i=0;i<a.count;i++){const q=curve.getPoint(i/(a.count-1));a.setXYZ(i,q.x,q.y,q.z);}a.needsUpdate=true;for(let i=0;i<65;i++){this.temp.position.copy(curve.getPoint(i/64));this.temp.updateMatrix();this.dress.setMatrixAt(i,this.temp.matrix);}this.dress.instanceMatrix.needsUpdate=true;
 }
}
