import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {forward,inverse,jointDiagnostics,ABB_JOINTS,ABBTrajectory,RAD,mountMatrix} from '../src/abb-kinematics.js';
import {collisionPair,checkCollisionWorld} from '../src/mesh-collision.js';
import {defaultProject,validateProject} from '../src/model.js';
import {lineSummary} from '../src/engineering.js';
import {BIW_POINTS} from '../src/line-data.js';

test('ABB FK matches the URDF zero pose and base rotation in metres',()=>{
 const q=[0,0,0,0,0,0],p=new Vector3().setFromMatrixPosition(forward(q).flange);assert.ok(p.distanceTo(new Vector3(1.7025,0,2.115))<1e-10);
 q[0]=Math.PI/2;assert.ok(new Vector3().setFromMatrixPosition(forward(q).flange).distanceTo(new Vector3(0,1.7025,2.115))<1e-10);
});
test('all six IK joints reconstruct position AND orientation across both wrist branches',()=>{
 for(let i=0;i<80;i++){const q=ABB_JOINTS.map((j,k)=>(j.limits[0]+(j.limits[1]-j.limits[0])*(.1+.8*((i*17+k*13)%79)/79))*RAD),mount=mountMatrix('OP10'),target=forward(q,mount).flange,ik=inverse(target,mount,q);assert.ok(ik,`pose ${i}`);assert.ok(ik.posError<1e-6);assert.ok(ik.angleError<1e-5);assert.ok(ik.q.every((v,k)=>Math.abs(v-q[k])<1e-6));}
 assert.equal(inverse(new Matrix4().makeTranslation(20,0,0)),null);
 assert.equal(jointDiagnostics([171*RAD,0,0,0,0,0])[0].limited,true);
});
test('three-station six-axis motion is deterministic, continuous, bounded and synchronized',()=>{
 const project=defaultProject(),line=lineSummary(project),motion=new ABBTrajectory(project,line);
 for(const st of line.stations){let previous;for(let t=0;t<line.duration;t+=.02){const s=motion.pose(t,st);assert.ok(s.reachable,`${st.id} at ${t}`);assert.ok(s.joints.every(j=>!j.limited&&!j.speedExceeded),`${st.id} ${s.kind} velocity at ${t}`);assert.ok(s.positionError<.001);if(previous)assert.ok(s.q.every((q,i)=>Math.abs(q-previous.q[i])<.12),'no inverse branch teleport');previous=s;}
  for(const task of st.tasks){const t=task.start+task.duration/2,s=motion.pose(t,st);assert.equal(s.energized,true);assert.equal(s.gunOpening,0);assert.equal(s.clamp,1);assert.ok(s.root.distanceTo(new Vector3(...BIW_POINTS[task.id].p))<1e-7);motion.pose(line.duration,st);assert.deepEqual(motion.pose(t,st).q,s.q);}
  assert.deepEqual(motion.pose(0,st).q,motion.pose(line.duration,st).q,'loop returns to identical home configuration');
 }
 project.seams.forEach(s=>s.enabled=false);const empty=lineSummary(project),idle=new ABBTrajectory(project,empty);assert.equal(idle.pose(0,empty.stations[0]).q.length,6);
});
const box=(name,x,size=1,station='OP10',index=3)=>{const mesh=new Mesh(new BoxGeometry(size,size,size),new MeshBasicMaterial());mesh.position.x=x;mesh.updateMatrixWorld(true);return {name,mesh,station,index,role:'robot'};};
test('mesh collision catches overlap, containment, clearance and updated transforms',()=>{
 const a=box('a',0),b=box('b',.8);assert.equal(collisionPair(a,b).collision,true);
 b.mesh.position.x=1.003;b.mesh.updateMatrixWorld(true);const near=collisionPair(a,b);assert.equal(near.collision,false);assert.ok(Math.abs(near.gap-3)<.001);
 b.mesh.position.x=2;b.mesh.updateMatrixWorld(true);assert.equal(collisionPair(a,b),null);
 const inside=box('small',0,.1);assert.equal(collisionPair(a,inside).collision,true);
});
test('three-cell checks use world transforms, include moving fixtures and non-adjacent self collision',()=>{
 const a=box('OP10 arm',0,1,'OP10',1),b=box('OP20 arm',6,1,'OP20',1),c=box('OP30 arm',12,1,'OP30',1),fixture=box('moving fixture',20);const robots=[a,b,c].map(x=>({colliders:[x],gunColliders:[]}));
 assert.equal(checkCollisionWorld(robots,[fixture]).hits.length,0);
 b.mesh.position.x=.5;b.mesh.updateMatrixWorld(true);assert.ok(checkCollisionWorld(robots,[fixture]).hits.some(h=>h.otherStation==='OP20'));
 fixture.mesh.position.x=12.5;fixture.mesh.updateMatrixWorld(true);assert.ok(checkCollisionWorld(robots,[fixture]).hits.some(h=>h.obstacle==='moving fixture'));
 const wrist=box('OP10 wrist',.5,1,'OP10',6);robots[0].colliders.push(wrist);assert.ok(checkCollisionWorld(robots,[]).hits.some(h=>h.obstacle==='OP10 wrist'));
});
test('new and original robot choices survive project roundtrip and migration',()=>{
 const p=defaultProject();assert.equal(validateProject(p).robotModel,'abb-irb6700');p.robotModel='illustrative';assert.equal(validateProject(p).robotModel,'illustrative');delete p.robotModel;assert.equal(validateProject(p).robotModel,'abb-irb6700');p.robotModel='unknown';assert.throws(()=>validateProject(p),/机器人模型/);
});
