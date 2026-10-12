import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './want-fixture.mjs';
import { viewRecords, filterRecords, dashboard, verifiedSent } from '../boss/boss-1/want/model.mjs';
test('same names remain separate; drafts are not successful messages',async()=>{
 const {store}=await fixture(), s=await store.snapshot(),rows=viewRecords(s);
 assert.equal(rows.length,3);assert.equal(rows.filter(x=>x.name==='同名').length,2);
 assert.equal(verifiedSent(rows[0]),true);assert.equal(verifiedSent(rows[1]),false);
 assert.equal(filterRecords(rows,{role:'3d'}).length,1);
 assert.equal(dashboard(s,'today',new Date('2026-09-27T05:00:00Z'))[0].sent,1);
 assert.equal(dashboard(s,'today',new Date('2026-09-27T05:00:00Z'))[0].read,1);
});
test('concurrent reviews persist without changing original history, stale edit rejects',async()=>{
 const {root,store}=await fixture();const p=path.join(root,'boss/recruitment-data.json'), before=await fs.readFile(p,'utf8');
 await Promise.all([store.addReview('a',{category:'需要核实',note:'核对到岗'}),store.addReview('b',{category:'当前岗位证据不足',note:'核对项目'})]);
 const s=await store.snapshot();assert.equal(Object.values(s.state.reviews).flat().length,2);assert.equal(await fs.readFile(p,'utf8'),before);
 await assert.rejects(store.addReview('a',{category:'需要核实',note:'过期',expectedVersion:0}),/版本/);
 assert.equal(viewRecords(s)[0].category,'需要核实');
});
test('source changes invalidate model assessment but preserve manual decision',async()=>{
 const {root,store}=await fixture();const snap=await store.snapshot();const row=viewRecords(snap)[0];
 await store.mutate(st=>{st.assessments.a={fingerprint:row.fingerprint,category:'匹配证据充分',evidence:'CAN',gaps:'',at:'2026-09-27T04:00:00Z'};});
 assert.equal(viewRecords(await store.snapshot())[0].category,'匹配证据充分');
 const p=path.join(root,'boss/recruitment-data.json');const d=JSON.parse(await fs.readFile(p));d.reviews[0].skills='新资料';await fs.writeFile(p,JSON.stringify(d));
 const changed=viewRecords(await store.snapshot())[0];assert.equal(changed.category,'未评估');assert.equal(changed.assessmentStale,true);
 await store.addReview('a',{category:'需要核实',note:'人工复核'});assert.equal(viewRecords(await store.snapshot())[0].category,'需要核实');
});

test('reply and delivered filters are independent and unverified identities do not collapse',async()=>{
 const {store}=await fixture();const s=await store.snapshot();s.data.reviews[0].reply='愿意了解';s.data.reviews[1].candidateKey=s.data.reviews[0].candidateKey;s.data.reviews[0].reviewedAt=s.data.reviews[1].reviewedAt;
 const rows=viewRecords(s);assert.equal(filterRecords(rows,{status:'有回复'}).length,1);assert.equal(filterRecords(rows,{status:'已核验发送'}).length,1);
 assert.equal(dashboard(s,'today',new Date('2026-09-27T05:00:00Z'))[0].read,2);
});
test('manual reviews retain categories but expose source changes as needing another review',async()=>{
 const {root,store}=await fixture();await store.addReview('a',{category:'需要核实',note:'已复核'});
 const file=path.join(root,'boss/recruitment-config.json');const cfg=JSON.parse(await fs.readFile(file));cfg.roles[0].requirements='CAN and embedded C';await fs.writeFile(file,JSON.stringify(cfg));
 const rows=viewRecords(await store.snapshot());assert.equal(rows[0].category,'需要核实');assert.equal(rows[0].reviewStale,true);assert.equal(filterRecords(rows,{revisited:'stale'}).length,1);
});

test('progress does not merge records based on an unverified legacy key',async()=>{
 const {store}=await fixture();const s=await store.snapshot();for(const r of s.data.reviews.slice(0,2)){r.candidateKey='same-legacy-name';r.reviewedAt='2026-09-27T03:00:00Z';}
 assert.equal(dashboard(s,'today',new Date('2026-09-27T05:00:00Z'))[0].read,2);
});

test('a review cannot claim new source facts the reader has not seen',async()=>{
 const {root,store}=await fixture();const row=viewRecords(await store.snapshot())[0];const file=path.join(root,'boss/recruitment-data.json');const raw=JSON.parse(await fs.readFile(file));raw.reviews[0].skills='new qualifications';await fs.writeFile(file,JSON.stringify(raw));
 await assert.rejects(store.addReview('a',{category:'需要核实',note:'reading previous version',expectedVersion:0,expectedFingerprint:row.fingerprint}),/资料.*更新/);
 assert.equal((await store.readState()).reviews.a,undefined);
});
