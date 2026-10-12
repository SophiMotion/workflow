import fs from 'node:fs/promises';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './want-fixture.mjs';
import {validateResult} from '../boss/boss-1/want/codex.mjs';
import {Queue} from '../boss/boss-1/want/queue.mjs';
const result=ids=>({items:ids.map(id=>({id,category:'需要核实',evidence:'CAN 项目',gaps:'到岗待核查'}))});
test('model outputs require exact unique IDs and evidence',()=>{
 assert.equal(validateResult(result(['a','b']),['a','b']).length,2);
 for(const ids of [['a'],['a','a'],['a','z']])assert.throws(()=>validateResult(result(ids),['a','b']),/记录/);
 assert.throws(()=>validateResult({items:[{id:'a',category:'录用',evidence:'',gaps:''}]},['a']),/分类/);
});
test('queue deduplicates active work, caches results and recovers interruption',async()=>{
 const {store}=await fixture();let calls=0;const q=new Queue(store,{run:async(batch)=>{calls++;return result(batch.map(x=>x.id));}});
 const a=await q.create(['a','b']),b=await q.create(['a']);assert.equal(a.id,b.id);
 await q.drain();let state=await store.readState();assert.equal(state.jobs[0].status,'completed');assert.equal(Object.keys(state.assessments).length,2);
 await q.create(['a','b']);await q.drain();assert.equal(calls,1);
 await store.mutate(s=>s.jobs.push({id:'interrupted',status:'running',ids:['c'],done:[]}));await q.recover();assert.equal((await store.readState()).jobs.at(-1).status,'interrupted');
});
test('changes while model runs never replace an assessment with stale facts',async()=>{
 const {store,root}=await fixture();const q=new Queue(store,{run:async(batch)=>{const file=path.join(root,'boss/recruitment-data.json');const raw=JSON.parse(await fs.readFile(file));raw.reviews[0].skills='Changed during inference';await fs.writeFile(file,JSON.stringify(raw));return result(batch.map(x=>x.id));}});
 await q.create(['a']);await q.drain();const st=await store.readState();assert.equal(st.jobs[0].status,'failed');assert.equal(st.assessments.a,undefined);assert.match(st.jobs[0].note,/变化/);
});

test('paused jobs cannot be claimed from an older queued snapshot',async()=>{
 const {store}=await fixture();let calls=0;const q=new Queue(store,{run:async b=>{calls++;return result(b.map(x=>x.id));}});
 const j=await q.create(['a']);await q.pause(j.id);await q.process(j.id);
 assert.equal(calls,0);assert.equal((await store.readState()).jobs[0].status,'paused');
});
