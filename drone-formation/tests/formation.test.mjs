import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { sampleSurface, preset, launchGrid, interpolate } from '../formation.mjs';
const mesh = (positions) => new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)));
test('samples 1000 finite points, honoring world transforms and bounds',()=>{
 const root=new THREE.Group();const m=mesh([0,0,0, 2,0,0, 0,2,0]);m.position.set(7,3,-2);root.add(m);
 const points=sampleSurface(root,1000,{normalize:false});assert.equal(points.length,3000);
 for(let i=0;i<points.length;i+=3){assert.ok(points[i]>=7 && points[i]<=9);assert.ok(points[i+1]>=3 && points[i+1]<=5);assert.equal(points[i+2],-2);}
});
test('area-weighted sampling gives the larger mesh a proportional share',()=>{
 const root=new THREE.Group();root.add(mesh([0,0,0, 1,0,0, 0,1,0]),mesh([10,0,0, 13,0,0, 10,3,0]));
 const p=sampleSurface(root,1000,{normalize:false});let big=0;for(let i=0;i<p.length;i+=3)if(p[i]>9)big++;
 assert.ok(big>850 && big<950,`larger triangle received ${big}`);
});
test('empty and zero-area models fail clearly',()=>{
 assert.throws(()=>sampleSurface(new THREE.Group(),1000),/有效/);
 assert.throws(()=>sampleSurface(mesh([0,0,0,0,0,0,0,0,0]),1000),/有效/);
});
test('presets contain exactly 1000 points above the ground',()=>{
 for(const kind of ['sphere','helix','cube']){const p=preset(kind,1000);assert.equal(p.length,3000);assert.ok(p.every(Number.isFinite));for(let i=1;i<p.length;i+=3)assert.ok(p[i]>0);}
});
test('motion starts and ends exactly at the assigned formations',()=>{
 const a=launchGrid(1000),b=preset('sphere',1000),out=new Float32Array(3000);
 interpolate(a,b,0,out);assert.deepEqual(out,a);interpolate(a,b,1,out);assert.deepEqual(out,b);
 interpolate(a,b,.5,out);assert.ok(out.every(Number.isFinite));assert.notDeepEqual(out,a);assert.notDeepEqual(out,b);
});
