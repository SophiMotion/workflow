import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaneGeometry, Mesh, MeshStandardMaterial, Group, Uint8BufferAttribute } from 'three';
import { inspectGlb, partsFromScene, partsBounds, TRIANGLE_LIMIT, GLB_LIMIT } from '../src/lib/armor-model.js';
import { splitGeometry, countTriangles } from '../src/lib/armor-geometry.js';
import { packGeometry, unpackGeometry, geometryBuffers } from '../src/lib/armor-transfer.js';
import { defaultConfig } from '../shared/domain.mjs';

function header(faces){
  const data=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},accessors:[{count:faces*3}],meshes:[{primitives:[{indices:0,attributes:{POSITION:0}}]}]}));
  const size=Math.ceil(data.length/4)*4,buffer=new ArrayBuffer(20+size),view=new DataView(buffer);
  [0x46546c67,2,buffer.byteLength,size,0x4e4f534a].forEach((v,i)=>view.setUint32(i*4,v,true));
  new Uint8Array(buffer,20).fill(32);new Uint8Array(buffer,20,data.length).set(data);return buffer;
}
test('high fidelity import accepts 1.5M triangles and guards the enlarged budget',()=>{
  assert.doesNotThrow(()=>inspectGlb(header(1_499_958)));
  assert.doesNotThrow(()=>inspectGlb(header(TRIANGLE_LIMIT)));
  assert.throws(()=>inspectGlb(header(TRIANGLE_LIMIT+1)),/500 万/);
  assert.equal(GLB_LIMIT,512*1024*1024);
});
test('large indexed import and split retain triangles, attributes and shared vertices',()=>{
  const source=new PlaneGeometry(2,2,600,500),scene=new Group();scene.add(new Mesh(source,new MeshStandardMaterial()));
  const [part]=partsFromScene(scene,defaultConfig);
  assert.equal(countTriangles(part.geometry),600000);
  assert.equal(part.geometry.attributes.position.count,source.attributes.position.count);
  const result=splitGeometry(source,'x',0);
  assert.equal(countTriangles(result.negative)+countTriangles(result.positive),600000);
  assert.ok(result.negative.attributes.position.count+result.positive.attributes.position.count<=source.attributes.position.count+501);
  assert.ok(result.negative.index&&result.positive.index);
  assert.equal(countTriangles(source),600000);
  for(const g of Object.values(result))for(const name of ['position','normal','uv'])assert.equal(g.attributes[name].count,g.attributes.position.count);
  let computations=0;const compute=part.geometry.computeBoundingBox.bind(part.geometry);part.geometry.computeBoundingBox=()=>{computations++;compute();};
  partsBounds([part]);partsBounds([part]);assert.equal(computations,0);
});
test('worker transfer keeps typed attributes and never detaches the active mesh',()=>{
  const geometry=new PlaneGeometry(2,2,2,2);geometry.setAttribute('color',new Uint8BufferAttribute(new Uint8Array(geometry.attributes.position.count*3).fill(128),3,true));
  const originalBytes=geometry.attributes.position.array.byteLength,packed=packGeometry(geometry);
  const moved=structuredClone(packed,{transfer:geometryBuffers(packed)}),restored=unpackGeometry(moved);
  assert.equal(geometry.attributes.position.array.byteLength,originalBytes);
  assert.equal(restored.attributes.color.normalized,true);
  assert.ok(restored.attributes.color.array instanceof Uint8Array);
  assert.equal(restored.attributes.color.getX(0),128/255);
  const owned=packGeometry(restored,{copy:false});assert.equal(owned.attributes.position.array,restored.attributes.position.array);
});
