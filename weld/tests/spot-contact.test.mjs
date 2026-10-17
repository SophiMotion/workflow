import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {defaultProject,validateProject} from '../src/model.js';
import {BIW_POINTS} from '../src/line-data.js';
import {contactState,indentationProfile} from '../src/spot-contact.js';
import {ServoSpotGun} from '../src/servo-spot-gun.js';
import {buildSheetBody,dentGeometry} from '../src/sheet-body.js';
const owner={mat:(color,roughness=.5,metalness=.3)=>new THREE.MeshStandardMaterial({color,roughness,metalness})};owner.mesh=(g,m,x,y,z,p)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);p.add(mesh);return mesh;};owner.box=(w,h,d,m,x,y,z,p)=>owner.mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);owner.cyl=(r,h,m,x,y,z,p)=>owner.mesh(new THREE.CylinderGeometry(r,r,h,32),m,x,y,z,p);
const pose=(id,kind='hold',gunOpening=0)=>({id,kind,gunOpening,root:new THREE.Vector3(...BIW_POINTS[id].p),normal:new THREE.Vector3(0,0,1),tangent:new THREE.Vector3(...BIW_POINTS[id].t),reachable:true,phaseProgress:.5});
test('real electrode contact faces agree with two-sheet surfaces for all 12 target orientations',()=>{
 const p=defaultProject(),parent=new THREE.Group(),gun=new ServoSpotGun(owner,parent,'OP10');
 for(const thickness of [1.2,2,3])for(const id of Object.keys(BIW_POINTS)){
  p.params.thickness=thickness;const q=pose(id),contact=gun.update(q,p);parent.updateMatrixWorld(true);
  const front=gun.front.getWorldPosition(new THREE.Vector3()),back=gun.back.getWorldPosition(new THREE.Vector3());
  assert.ok(front.distanceTo(new THREE.Vector3(...contact.front))<1e-9);assert.ok(back.distanceTo(new THREE.Vector3(...contact.back))<1e-9);
  assert.ok(Math.abs(front.z-(BIW_POINTS[id].p[2]-contact.indentation/1000))<1e-9);
  assert.ok(Math.abs(back.z-(BIW_POINTS[id].p[2]-2*thickness/1000))<1e-9);assert.equal(contact.seated,true);assert.equal(contact.force,3);assert.equal(contact.current,0);assert.ok(Math.abs(-contact.stack/1000-gun.backStem.position.y-.02*gun.backStem.scale.y+.0975)<1e-9,'rear stem meets the fixed copper bridge');
  const open=gun.update(pose(id,'open',.5),p);assert.equal(open.opening,40);assert.equal(open.force,0);assert.equal(open.seated,false);
 }
});
test('current, force, progressive indentation and contact flags follow process stages',()=>{
 const p=defaultProject();assert.equal(contactState(pose('W01','weld'),p).current,8);assert.equal(contactState(pose('W01','squeeze'),p).indentation,0);
 const ramp=pose('W01','squeeze');ramp.phaseProgress=.1;assert.ok(Math.abs(contactState(ramp,p).force-.9)<1e-9);
 const weld=contactState(pose('W01','weld'),p),hold=contactState(pose('W01','hold'),p);assert.ok(Math.abs(weld.indentation-hold.indentation*.5)<1e-9);
 const away=pose('W01','weld');away.root.x+=.01;const c=contactState(away,p);assert.equal(c.seated,false);assert.equal(c.current,0);assert.equal(c.frontGap,null);
 away.root.fromArray(BIW_POINTS.W01.p);away.reachable=false;assert.equal(contactState(away,p).current,0);
 for(const outcome of ['under','nominal','over']){const pr=indentationProfile(outcome,1),g=dentGeometry(pr.depth,pr.radius);g.computeBoundingBox();assert.ok(Math.abs(g.boundingBox.min.z+pr.depth)<1e-10);assert.ok(Math.abs(g.boundingBox.max.z)<1e-10);assert.ok(g.boundingBox.max.x<=.005501);}
});
test('sheet-metal body wheelhouses are open above the wheel center and lap surfaces follow plate thickness',()=>{
 for(const thickness of [1.2,2]){
  const parent=new THREE.Group(),body=buildSheetBody(owner,parent,thickness),houses=[];body.shell.traverse(o=>{if(o.userData.wheelhouse)houses.push(o);});assert.equal(houses.length,4);body.shell.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.geometry.attributes.normal.count,mesh.geometry.attributes.position.count,'thin sheet inner and outer faces both need vertex normals');assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));}});
  for(const house of houses){house.geometry.computeBoundingBox();assert.ok(house.geometry.boundingBox.min.y>=1.005,'wheelhouse must not form a full ring below the axle');assert.ok(house.geometry.boundingBox.max.y<1.49);}
  assert.equal(Object.keys(body.dots).length,12);parent.updateMatrixWorld(true);
  for(const [id,dot] of Object.entries(body.dots)){const [x,y,z]=BIW_POINTS[id].p,ray=new THREE.Raycaster(new THREE.Vector3(x,y,z+.1),new THREE.Vector3(0,0,-1));const hits=ray.intersectObject(dot.dent);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.z-z)<1e-6);}
 }
});
test('new and legacy body selections survive validation; malformed selections are rejected',()=>{
 for(const bodyModel of ['sheet-metal','legacy']){const p=defaultProject();p.bodyModel=bodyModel;assert.equal(validateProject(p).bodyModel,bodyModel);}
 const old=defaultProject();delete old.bodyModel;assert.equal(validateProject(old).bodyModel,'sheet-metal');const unsupported=defaultProject();unsupported.engineering.gunType='x';assert.throws(()=>validateProject(unsupported),/C 型枪/);unsupported.engineering.gunType='c';unsupported.params.thickness=4;assert.throws(()=>validateProject(unsupported),/1–3 mm/);old.bodyModel='unknown';assert.throws(()=>validateProject(old),/车身模型/);
});
