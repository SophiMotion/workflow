import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { waitForRecommendCards, checkGreetResult } from '../engine/boss.js';
const safety = await import('../engine/safety.js').catch(()=>({}));
const engine = await import('../engine/engine.js');
const now='2026-10-03T14:00:00+08:00';
const candidateId='candidate000000001';
const role={id:'structure',bossName:'车辆结构工程师',active:true,reviewTarget:100,contactTarget:20,requirements:'底盘结构与DFM',requirementsVerified:true,requirementsVerifiedAt:now,greeting:'已确认的邀约原文',greetingConfirmed:true};
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'boss-safety-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const reviews=Array.from({length:100},(_,i)=>({id:'read'+i,roleId:'structure',candidateKey:'姓名'+i+'|candidate'+String(i+1).padStart(9,'0'),name:'姓名'+i,reviewedAt:now,reviewLevel:i===0?'详细':'摘要',status:'未发送',...(i===0?{identityVerified:true,detailedReviewedAt:now,evidence:'底盘设计与结构验证项目',fullResumeEvidence:'完整履历和项目已核查'}:{})}));
 const data={reviews,feedback:[{manual:'保留手工备注'}],runs:[],uncertainSends:[],comparisons:[{roleId:'structure',date:'2026-10-03',comparedAt:now,requirements:role.requirements,sampleRecordIds:reviews.map(r=>r.id),selectedRecordIds:['read0']}]};
 fs.writeFileSync(path.join(dir,'recruitment-config.json'),JSON.stringify({roles:[role]}));fs.writeFileSync(path.join(dir,'recruitment-data.json'),JSON.stringify(data));
 return {dir,data,read:()=>JSON.parse(fs.readFileSync(path.join(dir,'recruitment-data.json'))),save:()=>fs.writeFileSync(path.join(dir,'recruitment-data.json'),JSON.stringify(data))};
}
function api(name){assert.equal(typeof safety[name],'function',`${name} must protect the send boundary`);return safety[name];}
function pending(dir){return api('beginSend')(dir,{roleId:'structure',recordId:'read0',candidateId,now});}

test('old-role cards do not satisfy waiting for the new role',async()=>{
 const session={eval:async expression=>expression.includes('jobText')?{jobText:'电控工程师',currentCount:1,cardIds:['oldcandidate00001'],signature:'oldcandidate00001',count:15}:15};
 assert.equal(await waitForRecommendCards(session,20,{expectedJobName:'车辆结构工程师',previousSignature:'oldcandidate00001',requireChanged:true,pollMs:0}),0);
});
test('a generic success dialog is not verified delivery to this candidate',async()=>{
 const session={eval:async()=>({paid:false,sent:true,done:false})};
 const observed=await checkGreetResult(session,candidateId);
 assert.notEqual(observed.sent,true);
 assert.equal(observed.requiresChatVerification,true);
});
test('pending exact message survives restart and prevents renamed cross-role duplicates',t=>{
 const f=fixture(t);const a=pending(f.dir);let saved=f.read();assert.equal(saved.sendAttempts[0].message,'已确认的邀约原文');assert.equal(saved.sendAttempts[0].status,'pending');
 assert.equal(a.candidateId,candidateId);assert.throws(()=>pending(f.dir),/PENDING|UNCERTAIN|DUPLICATE/);
 assert.deepEqual(saved.feedback,[{manual:'保留手工备注'}]);
});
test('summary-only or unverified role cannot enter send queue',t=>{
 const f=fixture(t);delete f.data.reviews[0].detailedReviewedAt;f.save();assert.throws(()=>pending(f.dir),/DETAIL/);
 f.data.reviews[0].detailedReviewedAt=now;f.save();fs.writeFileSync(path.join(f.dir,'recruitment-config.json'),JSON.stringify({roles:[{...role,requirementsVerified:false}]}));assert.throws(()=>pending(f.dir),/REQUIREMENTS/);
});
test('100 people compared means 100 distinct stable identities, not 100 duplicate rows',t=>{
 const f=fixture(t);f.data.reviews[99].candidateKey=f.data.reviews[98].candidateKey;f.save();assert.throws(()=>pending(f.dir),/SAMPLE/);
});
test('daily quota follows Shanghai sentAt and reserves unresolved attempts',t=>{
 const f=fixture(t);for(let i=1;i<=20;i++)Object.assign(f.data.reviews[i],{status:'已发送',sentAt:'2026-10-02T17:00:00Z',runId:'yesterday'});f.save();assert.throws(()=>pending(f.dir),/QUOTA/);
});
test('opt-out and unresolved same-name identity both stop sends',t=>{
 const f=fixture(t);f.data.reviews.push({id:'old',name:'改名',candidateKey:'旧名|'+candidateId,doNotContact:true});f.save();assert.throws(()=>pending(f.dir),/DO_NOT_CONTACT/);
 f.data.reviews.pop();f.data.uncertainSends.push({name:'姓名0',retryBlocked:true,candidateKey:null});f.save();assert.throws(()=>pending(f.dir),/IDENTITY_UNRESOLVED/);
});
test('incorrect recipient, role or text remains uncertain and is never marked sent',t=>{
 const f=fixture(t);const a=pending(f.dir);const result=api('finishSend')(f.dir,a.id,{candidateId,roleId:'electrical',message:role.greeting,sourceUrl:'https://www.zhipin.com/web/chat/index',type:'chat_message',verifiedAt:now,sentAt:now},now);
 assert.equal(result.status,'unknown');const d=f.read();assert.notEqual(d.reviews[0].status,'已发送');assert.equal(d.uncertainSends.at(-1).retryBlocked,true);assert.throws(()=>pending(f.dir),/UNCERTAIN|PENDING/);
});
test('matching chat evidence marks only intended candidate sent and preserves other fields',t=>{
 const f=fixture(t);const a=pending(f.dir);const result=api('finishSend')(f.dir,a.id,{candidateId,roleId:'structure',message:role.greeting,sourceUrl:'https://www.zhipin.com/web/chat/index',type:'chat_message',verifiedAt:now,sentAt:now},now);
 assert.equal(result.status,'sent');const d=f.read();assert.equal(d.reviews[0].status,'已发送');assert.equal(d.reviews[0].message,role.greeting);assert.equal(d.reviews[1].status,'未发送');assert.deepEqual(d.feedback,[{manual:'保留手工备注'}]);assert.throws(()=>pending(f.dir),/DUPLICATE/);
});
test('execution lock rejects a second executor and releases after error',async t=>{
 const f=fixture(t);const lock=api('withExecutionLock');await assert.rejects(lock(f.dir,async()=>{await assert.rejects(lock(f.dir,async()=>null),/EXECUTOR_BUSY/);throw new Error('interrupted');}),/interrupted/);assert.equal(await lock(f.dir,async()=>42),42);
});

test('prepared queue writes pending before browser action and records matching chat proof',async t=>{
 assert.equal(typeof engine.runPreparedQueue,'function','all sends need the durable prepared-queue boundary');
 const f=fixture(t);let sent=0;
 const browser={selectRole:async()=>({ok:true}),prepareCandidate:async()=>({roleId:'structure',candidateId}),sendApprovedGreeting:async attempt=>{assert.equal(f.read().sendAttempts[0].status,'pending');assert.equal(attempt.message,'已确认的邀约原文');sent++;},verifySentMessage:async attempt=>({type:'chat_message',candidateId,roleId:attempt.roleId,message:attempt.message,sourceUrl:'https://www.zhipin.com/web/chat/index',verifiedAt:now,sentAt:now})};
 const result=await engine.runPreparedQueue({dataDir:f.dir,browser,now:()=>now});assert.equal(result.summary.totalSent,1);assert.equal(sent,1);assert.equal(f.read().reviews[0].status,'已发送');
});
test('missing exact-message verifier prevents any click; a thrown send persists unknown',async t=>{
 assert.equal(typeof engine.runPreparedQueue,'function');const f=fixture(t);let sent=0;
 const browser={selectRole:async()=>({ok:true}),prepareCandidate:async()=>({roleId:'structure',candidateId}),sendApprovedGreeting:async()=>{sent++;throw new Error('connection lost after click');}};
 const blocked=await engine.runPreparedQueue({dataDir:f.dir,browser,now:()=>now});assert.equal(sent,0);assert.equal(blocked.ok,false);
 browser.verifySentMessage=async()=>null;const attempted=await engine.runPreparedQueue({dataDir:f.dir,browser,now:()=>now});assert.equal(sent,1);assert.equal(attempted.ok,false);assert.equal(f.read().sendAttempts[0].status,'unknown');
 await engine.runPreparedQueue({dataDir:f.dir,browser,now:()=>now});assert.equal(sent,1);
});
test('changed role or candidate immediately before send prevents the browser action',async t=>{
 assert.equal(typeof engine.runPreparedQueue,'function');const f=fixture(t);let sent=0;
 const browser={selectRole:async()=>({ok:true}),prepareCandidate:async()=>({roleId:'electrical',candidateId}),sendApprovedGreeting:async()=>sent++,verifySentMessage:async()=>null};
 const result=await engine.runPreparedQueue({dataDir:f.dir,browser,now:()=>now});assert.equal(sent,0);assert.equal(result.ok,false);assert.equal(f.read().sendAttempts,undefined);
});

test('invalid resume timestamp and a legacy uncertain record cannot be sent',t=>{
 const f=fixture(t);f.data.reviews[0].detailedReviewedAt='not a date';f.save();assert.throws(()=>pending(f.dir),/DETAIL/);
 f.data.reviews[0].detailedReviewedAt=now;f.data.reviews[0].status='发送待核验';f.save();assert.throws(()=>pending(f.dir),/UNCERTAIN/);
});
test('an unknown requested role cannot be reported as a completed run',async t=>{
 const f=fixture(t);let calls=0;const browser={selectRole:async()=>{calls++;},prepareCandidate:async()=>null,sendApprovedGreeting:async()=>null,verifySentMessage:async()=>null};
 const result=await engine.runPreparedQueue({dataDir:f.dir,browser,roleIds:['missing'],now:()=>now});assert.equal(result.ok,false);assert.equal(calls,0);
});

test('BOSS IDs with tilde enter the queue and still block prior cross-role contacts',t=>{
 const f=fixture(t);const bossId='47a22b842c1a5b1e0XNy3t69GFE~';
 f.data.reviews[0].candidateKey='姓名0|'+bossId;f.save();
 const attempt=api('beginSend')(f.dir,{roleId:'structure',recordId:'read0',candidateId:bossId,now});
 assert.equal(attempt.candidateId,bossId);
 assert.equal(f.read().sendAttempts[0].candidateId,bossId);
 const g=fixture(t);g.data.reviews[0].candidateKey='姓名0|'+bossId;
 g.data.reviews.push({id:'old-nav',name:'旧名',roleId:'navigation',candidateKey:'旧名|'+bossId,status:'已发送',sentAt:'2026-10-02T10:00:00+08:00'});g.save();
 assert.throws(()=>api('beginSend')(g.dir,{roleId:'structure',recordId:'read0',candidateId:bossId,now}),/DUPLICATE/);
});
