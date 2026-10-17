import * as THREE from 'three';
import {contactState} from './spot-contact.js';
const V=(...a)=>new THREE.Vector3(...a);
export class ServoSpotGun {
 constructor(o,parent,station){
  this.group=new THREE.Group();parent.add(this.group);this.colliders=[];this.visuals=[];
  const dark=o.mat('#283741',.42,.55),silver=o.mat('#a7b3bb',.3,.7),copper=o.mat('#c88d53',.27,.8),black=o.mat('#343c40',.5,.25);
  const solid=(mesh,name)=>{mesh.material=mesh.material.clone();this.visuals.push(mesh);this.colliders.push({mesh,visual:mesh,name:station+' 伺服枪 '+name,index:8,station,role:'gun'});return mesh;};
  solid(o.box(.065,.53,.095,dark,.28,.16,0,this.group),'C 型背架');
  solid(o.box(.245,.035,.075,silver,.1625,-.108,0,this.group),'固定臂');
  solid(o.box(.30,.055,.09,silver,.14,.365,0,this.group),'伺服支架');
  solid(o.cyl(.039,.19,dark,0,.255,0,this.group),'伺服执行器');
  for(const y of [.166,.344])o.cyl(.042,.015,silver,0,y,0,this.group);
  o.box(.068,.095,.055,black,0,.39,0,this.group);o.box(.037,.05,.058,o.mat('#c73b36'),0,.39,0,this.group);
  // Replaceable 16 mm copper caps with 6 mm contact faces, both referenced by their contact face.
  const profile=[[0,0],[.003,0],[.0045,.003],[.008,.018],[.008,.040],[0,.040]].map(a=>new THREE.Vector2(...a));
  this.front=new THREE.Group();this.back=new THREE.Group();this.back.rotation.z=Math.PI;this.group.add(this.front,this.back);
  this.frontCap=o.mesh(new THREE.LatheGeometry(profile,32),copper,0,0,0,this.front);this.backCap=o.mesh(new THREE.LatheGeometry(profile,32),copper,0,0,0,this.back);
  o.cyl(.011,.032,silver,0,.055,0,this.front);this.backStem=o.cyl(.011,.040,silver,0,.06,0,this.back);
  this.fixedLink=o.box(.055,.021,.045,copper,.024,-.108,0,this.group);
  this.piston=o.cyl(.012,.14,silver,0,.11,0,this.group);
  for(const side of [-1,1]){
   const points=[V(.29,.42,side*.06),V(.36,.22,side*.08),V(.25,-.08,side*.07),V(.02,-.09,side*.035)];
   o.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.006,8,false),o.mat(side===1?'#386b8b':'#9b4540'),0,0,0,this.group);
  }
  o.cyl(.095,.055,dark,.28,.475,0,this.group);o.cyl(.072,.04,silver,.28,.43,0,this.group);
  for(const x of [.25,.31])for(const z of [-.025,.025])o.cyl(.006,.012,silver,x,.39,z,this.group);
  this.tipGlow=o.mesh(new THREE.SphereGeometry(.004,16,12),new THREE.MeshBasicMaterial({color:'#e5a075',transparent:true,opacity:.5,depthWrite:false}),0,0,0,this.group);
  const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),a=Math.max(0,1-r);const i=(y*size+x)*4;data.set([255,180,70,Math.round(230*a*a)],i);}
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;
  this.currentHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:'#ffd49b',blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,depthTest:false}));this.currentHalo.scale.set(.055,.055,1);this.group.add(this.currentHalo);
  this.contactLight=new THREE.PointLight('#ffb265',0,.32,2);this.contactLight.position.y=.012;this.group.add(this.contactLight);
  this.currentHalo.userData.description='电阻点焊通电辉光增强示意；不是激光束';
 }
 update(pose,project){
  this.group.position.copy(pose.root);this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(pose.tangent,pose.normal,pose.tangent.clone().cross(pose.normal)));
  const c=contactState(pose,project);const rearEnd=.0975-c.stack/1000;this.backStem.scale.y=Math.max(.01,(rearEnd-.04)/.04);this.backStem.position.y=(rearEnd+.04)/2;this.front.position.y=(c.opening-c.indentation)/1000;this.back.position.y=-c.stack/1000;this.piston.position.y=.11+(c.opening-c.indentation)/2000;this.piston.scale.y=Math.max(.25,1-c.opening/140);
  const on=c.current>0,pulse=.8+.2*Math.sin(pose.phaseProgress*Math.PI*8);this.tipGlow.visible=on;this.tipGlow.position.y=.0008;this.tipGlow.material.opacity=pulse;
  this.currentHalo.visible=on;this.currentHalo.position.y=.002;this.currentHalo.material.opacity=pulse;this.contactLight.intensity=on?.018*pulse:0;
  this.contact=c;return c;
 }
}
