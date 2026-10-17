import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeldEffects} from '../src/effects.js';
import {bracketProject as defaultProject,schedule} from '../src/model.js';
import {motionAt} from '../src/motion.js';

// A canvas texture stub permits inspecting actual Three.js instance data in Node.
// Rendered WebGL appearance is checked separately in the browser.
function effects(){
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 const scene=new THREE.Scene(),owner={scene,group:()=>new THREE.Group(),mat:(color,roughness,metalness)=>new THREE.MeshStandardMaterial({color,roughness,metalness}),mesh:(geo,mat)=>{const mesh=new THREE.Mesh(geo,mat);scene.add(mesh);return mesh;}};
 try{return new WeldEffects(owner);}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}
test('rendered bead is absent before welding, grows behind arc, cools and disappears on rewind',()=>{
 const p=defaultProject(),plan=schedule(p),fx=effects();fx.configure(p);
 const update=t=>fx.update(t,plan,motionAt(t,plan,p));
 update(0);assert.equal(fx.beads.W01.bead.count,0);assert.equal(fx.arc.visible,false);
 const t=plan[0].start+plan[0].duration*.5;update(t);
 assert.equal(fx.beads.W01.bead.count,75);assert.equal(fx.beads.W02.bead.count,0);assert.equal(fx.arc.visible,true);
 assert.ok(fx.arc.position.distanceTo(motionAt(t,plan,p).root)<.03);
 const hot=new THREE.Color();fx.beads.W01.bead.getColorAt(74,hot);
 update(plan.at(-1).end+90);
 assert.ok(Object.values(fx.beads).every(b=>b.bead.count===150));assert.equal(fx.arc.visible,false);assert.equal(fx.gas.visible,false);
 const cold=new THREE.Color();fx.beads.W01.bead.getColorAt(74,cold);assert.notEqual(hot.getHex(),cold.getHex());
 update(0);assert.ok(Object.values(fx.beads).every(b=>b.bead.count===0&&b.ripple.count===0));
});
test('speed changes the actual 3D bead dimensions and ripple spacing',()=>{
 const p=defaultProject(),fx=effects();
 function sample(){const plan=schedule(p);fx.configure(p);fx.update(plan.at(-1).end+90,plan,motionAt(plan.at(-1).end+90,plan,p));const matrix=new THREE.Matrix4();fx.beads.W01.bead.getMatrixAt(0,matrix);const scale=new THREE.Vector3();matrix.decompose(new THREE.Vector3(),new THREE.Quaternion(),scale);return {width:scale.z,height:scale.y,ripples:fx.beads.W01.ripple.count};}
 const base=sample();p.params.speed=24;const fast=sample();assert.ok(fast.width<base.width);assert.ok(fast.height<base.height);assert.ok(fast.ripples<base.ripples);
});

test('spot process leaves one electrode mark per completed point and rewinds cleanly',()=>{
 const p=defaultProject();p.process='spot';const plan=schedule(p),fx=effects();fx.configure(p);
 const update=t=>fx.update(t,plan,motionAt(t,plan,p));
 update(plan[0].end+.01);assert.equal(fx.beads.W01.bead.count,1);assert.equal(fx.beads.W02.bead.count,0);assert.equal(fx.arc.visible,false);
 update(0);assert.equal(fx.beads.W01.bead.count,0);
});

test('laser energy is visualized separately from an arc',()=>{
 const p=defaultProject();p.process='laser';const plan=schedule(p),fx=effects();fx.configure(p);
 const t=plan[0].start+1;fx.update(t,plan,motionAt(t,plan,p));
 assert.equal(fx.arc.visible,false);assert.equal(fx.pool.visible,true);
});
