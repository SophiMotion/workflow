import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshStandardMaterial, Group, Vector3, Matrix4 } from 'three';
import { robotModel } from '../shared/robot.mjs';
import { defaultConfig } from '../shared/domain.mjs';
import * as armor from '../src/lib/armor-model.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('save validation rejects transforms the import metadata cannot restore',()=>{
  const metadata={version:1,position:[0,0,0],rotation:[0,0,0],scale:[1000,1,1],binding:'',bindRest:null};
  assert.throws(()=>armor.validatePartMetadata(metadata),/缩放/);
  assert.doesNotThrow(()=>armor.validatePartMetadata({...metadata,scale:[1,1,1]}));
});
test('attachment retains its rest location then follows the parent joint rotation',()=>{
  const bodies=robotModel(defaultConfig), rest=armor.jointMatrices(bodies,{});
  const joint=bodies.find(b=>b.id==='left_arm_1');
  const part={position:[joint.position[0],joint.position[1],joint.position[2]-.1],rotation:[0,0,0],scale:[1,1,1],binding:'left_arm_1',bindRest:rest.left_arm_1.toArray()};
  const p=new Vector3().setFromMatrixPosition(armor.partMatrix(part,rest));
  near(p.z,part.position[2]);
  const moved=armor.jointMatrices(bodies,{left_arm_1:90});
  const q=new Vector3().setFromMatrixPosition(armor.partMatrix(part,moved));
  near(q.z,joint.position[2]);near(q.y,joint.position[1]+.1);
  const child=new Vector3().setFromMatrixPosition(moved.left_arm_2);
  assert.ok(child.y>joint.position[1]);
});
test('detaching a posed part preserves its visible world pose',()=>{
  const bodies=robotModel(defaultConfig), rest=armor.jointMatrices(bodies,{}), moved=armor.jointMatrices(bodies,{left_arm_1:45});
  const part={position:[0,.2,1],rotation:[0,0,0],scale:[1,1,1],binding:'left_arm_1',bindRest:rest.left_arm_1.toArray()};
  const before=armor.partMatrix(part,moved);
  const after=armor.detachPart(part,moved);
  const actual=armor.partMatrix(after,{});
  before.elements.forEach((v,i)=>near(v,actual.elements[i]));
});
test('scene import bakes nested transformations and fits a complete model without changing source',()=>{
  const scene=new Group(), nested=new Group();nested.position.set(2,4,1);scene.add(nested);
  const mesh=new Mesh(new BoxGeometry(2,4,1),new MeshStandardMaterial());nested.add(mesh);
  const parts=armor.partsFromScene(scene,defaultConfig),box=armor.partsBounds(parts),size=box.getSize(new Vector3());
  near(size.z,defaultConfig.mast/1000);assert.equal(parts.length,1);near(mesh.geometry.parameters.height,4);
  assert.ok(box.min.z>0);
});
test('GLB validation rejects corrupt containers, external assets, and unsupported rigged imports',()=>{
  assert.throws(()=>armor.inspectGlb(new ArrayBuffer(20)),/GLB/);
  const make=json=>{const text=JSON.stringify(json),bytes=new TextEncoder().encode(text),n=Math.ceil(bytes.length/4)*4,buf=new ArrayBuffer(20+n),v=new DataView(buf);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,buf.byteLength,true);v.setUint32(12,n,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(buf,20).fill(32);new Uint8Array(buf,20,bytes.length).set(bytes);return buf;};
  assert.throws(()=>armor.inspectGlb(make({asset:{version:'2.0'},images:[{uri:'https://example.com/private.png'}]})),/外部/);
  assert.throws(()=>armor.inspectGlb(make({asset:{version:'2.0'},skins:[{}]})),/蒙皮/);
  assert.equal(armor.inspectGlb(make({asset:{version:'2.0'}})).asset.version,'2.0');
});

test('glTF axes map forward to engineering X and roundtrip exactly',()=>{
  for(const [source,target] of [[[1,0,0],[0,1,0]],[[0,1,0],[0,0,1]],[[0,0,1],[1,0,0]]]){
    const converted=new Vector3(...source).applyMatrix4(armor.ENGINEERING_FROM_GLTF);
    converted.toArray().forEach((v,i)=>near(v,target[i]));
    converted.applyMatrix4(armor.GLTF_FROM_ENGINEERING).toArray().forEach((v,i)=>near(v,source[i]));
  }
});

test('multi-material GLB exporter/loader roundtrip retains one logical bound part',async()=>{
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const previous=globalThis.FileReader;
  globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
  try{
    const geometry=new BoxGeometry(),material=[new MeshStandardMaterial({color:'red'}),new MeshStandardMaterial({color:'blue'})];
    geometry.groups.forEach(g=>g.materialIndex%=2);
    const part={id:'original',name:'bound shell',position:[3,4,5],rotation:[0,.2,0],scale:[1,2,1],binding:'mast',bindRest:new Matrix4().toArray(),visible:false,cutOpen:true};
    const mesh=new Mesh(geometry,material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(armor.transformMatrix(part));mesh.userData.armorPart=armor.partMetadata(part);
    const scene=new Group();scene.add(mesh);
    const binary=await new GLTFExporter().parseAsync(scene,{binary:true});
    const loaded=await new GLTFLoader().parseAsync(binary,'');
    const actual=armor.partsFromScene(loaded.scene,defaultConfig);
    assert.equal(actual.length,1);assert.equal(actual[0].binding,'mast');assert.equal(actual[0].visible,false);assert.equal(actual[0].cutOpen,true);
    assert.deepEqual(actual[0].position,part.position);assert.deepEqual(actual[0].scale,part.scale);
    assert.equal(actual[0].geometry.index?.count??actual[0].geometry.attributes.position.count,36);
    assert.equal(actual[0].geometry.groups.length,6);
    assert.equal(actual[0].material[0].color.getHexString(),'ff0000');assert.equal(actual[0].material[1].color.getHexString(),'0000ff');
    const restored=new Mesh(actual[0].geometry,actual[0].material);restored.userData.armorPart=armor.partMetadata(actual[0]);
    const again=await new GLTFLoader().parseAsync(await new GLTFExporter().parseAsync(restored,{binary:true}),'');
    const [twice]=armor.partsFromScene(again.scene,defaultConfig);
    assert.equal(twice.geometry.index.count,36);assert.equal(twice.binding,'mast');
  }finally{globalThis.FileReader=previous;}
});

test('saved primitive groups bake child transforms relative to metadata node',()=>{
  const root=new Group(),group=new Group();root.add(group);group.position.set(100,200,300);
  group.userData.armorPart=armor.partMetadata({id:'g',name:'g',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1]});
  const child=new Mesh(new BoxGeometry(),new MeshStandardMaterial());child.position.set(2,0,0);group.add(child);
  const [part]=armor.partsFromScene(root,defaultConfig);part.geometry.computeBoundingBox();near(part.geometry.boundingBox.min.x,1.5);near(part.geometry.boundingBox.max.x,2.5);assert.deepEqual(part.position,[1,2,3]);
});

test('mirrored imports preserve outward winding and tangent handedness for indexed and unindexed geometry',async()=>{
  const {Float32BufferAttribute}=await import('three');
  for(const indexed of [true,false]){
    let geometry=new BoxGeometry();geometry.setAttribute('tangent',new Float32BufferAttribute(Array.from({length:geometry.attributes.position.count},()=>[1,0,0,1]).flat(),4));
    if(!indexed)geometry=geometry.toNonIndexed();
    const scene=new Group(),mesh=new Mesh(geometry,new MeshStandardMaterial());mesh.scale.x=-1;scene.add(mesh);
    const [part]=armor.partsFromScene(scene,defaultConfig),g=part.geometry,pos=g.attributes.position,normal=g.attributes.normal;
    for(let offset=0;offset<(g.index?.count??pos.count);offset+=3){
      const ids=[0,1,2].map(i=>g.index?g.index.getX(offset+i):offset+i),a=new Vector3().fromBufferAttribute(pos,ids[0]),b=new Vector3().fromBufferAttribute(pos,ids[1]),c=new Vector3().fromBufferAttribute(pos,ids[2]);
      assert.ok(b.sub(a).cross(c.sub(a)).dot(new Vector3().fromBufferAttribute(normal,ids[0]))>0);
    }
    for(let i=0;i<g.attributes.tangent.count;i++)assert.equal(g.attributes.tangent.getW(i),-1);
    assert.equal(geometry.attributes.tangent.getW(0),1);
  }
});
