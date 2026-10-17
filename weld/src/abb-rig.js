import * as THREE from 'three';
import {LINE_SHOULDER,ARM_LENGTHS} from './line-motion.js';
import {ServoSpotGun} from './servo-spot-gun.js';
import {sheetMetal} from './spot-contact.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z),UP=V(0,1,0);

export function label(text,color='#263e52',background='#ffffff',width=3,height=.5){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
 const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,1024,192);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 74px Arial, sans-serif';ctx.fillText(text,512,100);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));sprite.scale.set(width,height,1);return sprite;
}

// ABB IRB 6700 inspired visual shell. The two-link pose model is deliberately
// independent of ABB controller kinematics; no RAPID or certified reach claim.
export class ABBRig {
 constructor(o,parent){
  this.o=o;this.parent=parent;
  const white=o.mat('#ecefed',.30,.23),dark=o.mat('#313941',.45,.55),metal=o.mat('#91a3ad',.28,.75),red=o.mat('#db2934'),copper=o.mat('#bd8555',.28,.8);
  this.materials={white,dark,metal,red,copper};const [x,y,z]=LINE_SHOULDER;
  o.box(.95,.10,.86,dark,x,.05,z,parent);o.box(.69,.4,.64,dark,x,.30,z,parent);o.box(.82,.08,.77,metal,x,.54,z,parent);
  for(const dx of [-.32,.32])for(const dz of [-.29,.29])o.bolt(x+dx,.59,z+dz,parent,.035);
  o.cyl(.29,.23,white,x,.70,z,parent);o.cyl(.25,.10,dark,x,.87,z,parent);o.box(.34,.28,.4,white,x,1.02,z,parent);
  this.upper=this.link(ARM_LENGTHS[0],.17,.23);this.lower=this.link(ARM_LENGTHS[1],.11,.18);
  this.joints=[this.joint(.25,.41),this.joint(.20,.35),this.joint(.12,.25)];
  const logoCanvas=document.createElement('canvas');logoCanvas.width=256;logoCanvas.height=128;const ctx=logoCanvas.getContext('2d');ctx.fillStyle='#ecefed';ctx.fillRect(0,0,256,128);ctx.fillStyle='#e32934';ctx.font='bold 88px Arial';ctx.textAlign='center';ctx.fillText('ABB',128,96);const map=new THREE.CanvasTexture(logoCanvas);map.colorSpace=THREE.SRGBColorSpace;
  const logo=o.mesh(new THREE.PlaneGeometry(.36,.18),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}),0,0,.205,this.upper);
  logo.rotation.z=-Math.PI/2;
  this.gun=new THREE.Group();parent.add(this.gun);
  o.box(.07,.49,.105,dark,.28,.15,0,this.gun);
  o.box(.31,.065,.10,metal,.14,-.085,0,this.gun);
  o.cyl(.016,.06,copper,0,-.055,0,this.gun);
  this.upperGun=new THREE.Group();this.gun.add(this.upperGun);this.upperGun.position.set(.28,.36,0);
  o.box(.31,.065,.10,metal,-.14,0,0,this.upperGun);
  o.cyl(.054,.18,dark,-.28,-.10,0,this.upperGun);
  o.cyl(.061,.026,metal,-.28,-.01,0,this.upperGun);
  this.electrode=o.cyl(.017,.07,copper,0,.035,0,this.gun);
  this.plunger=o.cyl(.024,.16,metal,0,.15,0,this.gun);
  o.cyl(.10,.065,dark,.28,.46,0,this.gun);o.cyl(.075,.06,metal,.28,.41,0,this.gun);
  for(const side of [-1,1]){
   const points=[V(.29,.3,side*.07),V(.39,.1,side*.08),V(.20,-.07,side*.08),V(.04,-.07,side*.04)];
   o.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),18,.009,6,false),o.mat(side===1?'#4b6c80':'#9a3d38'),0,0,0,this.gun);
  }
  this.dress=new THREE.InstancedMesh(new THREE.SphereGeometry(.037,7,5),dark,45);this.dress.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.dress.frustumCulled=false;parent.add(this.dress);this.temp=new THREE.Object3D();
  this.indicator=o.mesh(new THREE.SphereGeometry(.024,10,8),new THREE.MeshBasicMaterial({color:'#f8a63d'}),0,0,0,parent);this.indicator.visible=false;
  this.servoGun=new ServoSpotGun(o,parent,'示意机械臂');
 }
 link(length,r1,r2){const o=this.o,m=this.materials,g=new THREE.Group();this.parent.add(g);
  const shape=new THREE.Shape();shape.moveTo(-r2,-length*.39);shape.lineTo(r2,-length*.39);shape.lineTo(r1,length*.39);shape.lineTo(-r1,length*.39);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:r1*1.5,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,steps:1});geometry.translate(0,0,-r1*.75);
  o.mesh(geometry,m.white,0,0,0,g);o.box(r1*.7,length*.48,r1*.9,m.white,0,0,r1*.55,g);
  o.box(r1*.8,length*.30,.025,m.dark,0,-length*.1,-r1*.85,g);
  for(const y of [-length*.30,length*.28])for(const x of [-r1*.65,r1*.65]){const b=o.cyl(.013,.014,m.metal,x,y,r1*.86,g);b.rotation.x=Math.PI/2;}
  return g;
 }
 joint(radius,width){const g=new THREE.Group(),o=this.o,m=this.materials;this.parent.add(g);
  for(const [r,h,z,mat] of [[radius,width,0,m.white],[radius*.88,.05,width/2,m.dark],[radius*.55,.055,width/2+.04,m.metal],[radius*.70,.16,-width/2-.07,m.dark]]){const c=o.cyl(r,h,mat,0,0,z,g);c.rotation.x=Math.PI/2;}
  for(let i=0;i<6;i++){const a=i*Math.PI/3,b=o.cyl(.012,.015,m.dark,Math.cos(a)*radius*.68,Math.sin(a)*radius*.68,width/2+.035,g);b.rotation.x=Math.PI/2;}return g;
 }
 segment(obj,a,b){obj.position.copy(a).add(b).multiplyScalar(.5);obj.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());}
 update(p,project){
  const detailed=sheetMetal(project);this.gun.visible=!detailed;this.servoGun.group.visible=detailed;this.contact=detailed?this.servoGun.update(p,project):null;
  this.segment(this.upper,p.shoulder,p.elbow);this.segment(this.lower,p.elbow,p.wrist);
  [p.shoulder,p.elbow,p.wrist].forEach((v,i)=>this.joints[i].position.copy(v));
  const basis=new THREE.Matrix4().makeBasis(p.tangent,p.normal,p.tangent.clone().cross(p.normal));this.gun.quaternion.setFromRotationMatrix(basis);this.gun.position.copy(p.root);
  this.joints[2].quaternion.copy(this.gun.quaternion);
  const stroke=project.engineering.gunStroke/1000*p.gunOpening;
  this.electrode.position.y=.035+stroke;this.plunger.position.y=.15+stroke*.5;
  this.upperGun.rotation.z=project.engineering.gunType==='x'?-.28*p.gunOpening:0;
  this.indicator.visible=!detailed&&p.energized;this.indicator.position.copy(p.root).addScaledVector(p.normal,.012);
  const curve=new THREE.CatmullRomCurve3([p.shoulder.clone().add(V(-.17,.1,.15)),p.elbow.clone().add(V(-.10,.18,.18)),p.elbow.clone().lerp(p.wrist,.65).add(V(0,.22,.17)),p.wrist.clone().addScaledVector(p.normal,.09)]);
  for(let i=0;i<45;i++){this.temp.position.copy(curve.getPoint(i/44));this.temp.updateMatrix();this.dress.setMatrixAt(i,this.temp.matrix);}this.dress.instanceMatrix.needsUpdate=true;
 }
}
