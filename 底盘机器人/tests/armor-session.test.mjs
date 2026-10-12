import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, MeshStandardMaterial, Texture } from 'three';
import { createArmorSession, armorFrame, releaseArmorResources, partResources } from '../src/lib/armor-session.js';
import { editGeometry } from '../src/lib/armor-edit.js';

function asset(){
  const counts={geometry:0,material:0,texture:0,image:0},texture=new Texture({close(){counts.image++;}});
  const geometry=new BoxGeometry(),material=new MeshStandardMaterial({map:texture,normalMap:texture});
  geometry.addEventListener('dispose',()=>counts.geometry++);material.addEventListener('dispose',()=>counts.material++);texture.addEventListener('dispose',()=>counts.texture++);
  return {part:{geometry,material},counts};
}
test('leaving clears source and history and releases shared GPU resources exactly once',()=>{
  const session=createArmorSession(),{part,counts}=asset();session.track([part]);session.history.push([part]);session.source=new ArrayBuffer(1024);
  session.dispose();session.dispose();
  assert.equal(session.signal.aborted,true);assert.equal(session.source,null);assert.deepEqual(session.history,[]);
  assert.equal(session.resources.geometries.size,0);assert.equal(session.resources.materials.size,0);
  assert.deepEqual(counts,{geometry:1,material:1,texture:1,image:1});
});
test('late import results are disposed rather than resurrecting an abandoned session',()=>{
  const session=createArmorSession();session.dispose();const {part,counts}=asset();
  assert.throws(()=>session.track([part]),{name:'AbortError'});
  assert.equal(session.resources.geometries.size,0);assert.equal(counts.geometry,1);assert.equal(counts.image,1);
});
test('dropping undo history keeps textures that the active model still shares',()=>{
  const {part,counts}=asset(),other={geometry:part.geometry.clone(),material:part.material.clone()};
  releaseArmorResources(partResources([part]),partResources([other]));
  assert.equal(counts.texture,0);assert.equal(counts.image,0);
  releaseArmorResources(partResources([other]));assert.equal(counts.texture,1);assert.equal(counts.image,1);
});
test('leaving aborts a geometry worker and prevents progress or late output callbacks',async()=>{
  const original=globalThis.Worker,instances=[];
  globalThis.Worker=class{constructor(){instances.push(this);}postMessage(data){this.data=data;}terminate(){this.terminated=true;}};
  try{
    const controller=new AbortController(),geometry=new BoxGeometry(),events=[];
    const result=editGeometry('split',geometry,{axis:'z',position:0,signal:controller.signal,onProgress:p=>events.push(p)});
    const worker=instances[0];assert.ok(worker.data.geometry);assert.equal(worker.data.signal,undefined);
    worker.onmessage({data:{progress:'50%'}});controller.abort();
    await assert.rejects(result,{name:'AbortError'});assert.equal(worker.terminated,true);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);
    assert.deepEqual(events,['50%']);assert.ok(geometry.attributes.position.array.byteLength>0);
    await assert.rejects(editGeometry('split',geometry,{signal:controller.signal}),{name:'AbortError'});assert.equal(instances.length,1);
  }finally{if(original===undefined)delete globalThis.Worker;else globalThis.Worker=original;}
});
test('background frame waits abort without retaining queued animation callbacks',async()=>{
  const previousRequest=globalThis.requestAnimationFrame,previousCancel=globalThis.cancelAnimationFrame,callbacks=new Map();let id=0;
  globalThis.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};globalThis.cancelAnimationFrame=key=>callbacks.delete(key);
  try{
    const controller=new AbortController(),wait=armorFrame(controller.signal);assert.equal(callbacks.size,1);
    controller.abort();await assert.rejects(wait,{name:'AbortError'});assert.equal(callbacks.size,0);
  }finally{
    if(previousRequest===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previousRequest;
    if(previousCancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=previousCancel;
  }
});
