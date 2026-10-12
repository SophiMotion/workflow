import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fusionPayload} from '../shared/fusion.mjs';
import {createProject} from '../shared/domain.mjs';
import {createFusionBridge,localFusionRequest} from '../server/fusion-bridge.mjs';
test('Fusion configuration uses current choices, model geometry and no project credentials',()=>{
  const p=createProject();p.config.length=720;p.config.camera='depth';p.config.arm='dual12';p.revision=7;p.token='PRIVATE';
  const result=fusionPayload(p);assert.equal(result.config.length,720);assert.equal(result.project.revision,7);
  assert(result.bodies.some(b=>b.id==='camera_link'));assert(result.bodies.some(b=>b.id==='left_arm_6'));
  assert.equal(result.bodies.find(b=>b.id==='base_link').size[0],.72);assert(!JSON.stringify(result).includes('PRIVATE'));
});
test('local Fusion bridge requires loopback, exact origin and custom JSON header',()=>{
  const request={socket:{remoteAddress:'127.0.0.1'},headers:{origin:'http://127.0.0.1:4173',host:'127.0.0.1:4173','x-skate-fusion':'1','content-type':'application/json'}};
  assert(localFusionRequest(request));
  for(const headers of [{origin:'https://evil.example'}, {origin:undefined},{host:'evil.example:4173'}, {'x-skate-fusion':undefined},{'content-type':'text/plain'}])assert(!localFusionRequest({...request,headers:{...request.headers,...headers}}));
  assert(!localFusionRequest({...request,socket:{remoteAddress:'192.168.1.10'}}));
});
test('Fusion handoff persists valid payload, acknowledges matching request and rejects stale heartbeats',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'fusion-test-'));let launches=0;
  try{const bridge=createFusionBridge(dir,async()=>{launches++;}),p=createProject();p.config.width=580;
    const result=await bridge.open(p);assert.equal(launches,1);assert.equal(result.launch,'requested');
    const request=JSON.parse(readFileSync(path.join(dir,'request.json'),'utf8'));assert.equal(request.id,result.id);assert.equal(request.payload.config.width,580);
    assert.equal(bridge.status(result.id).state,'queued');assert.equal(bridge.status('unrelated').state,'superseded');
    writeFileSync(path.join(dir,'reply.json'),JSON.stringify({id:result.id,state:'opened',message:'ready'}));
    writeFileSync(path.join(dir,'heartbeat.json'),JSON.stringify({running:true,at:Date.now()}));assert.equal(bridge.status(result.id).pluginRunning,true);assert.equal(bridge.status(result.id).state,'opened');
    writeFileSync(path.join(dir,'heartbeat.json'),JSON.stringify({running:true,at:Date.now()-9000}));assert.equal(bridge.status(result.id).pluginRunning,false);
    p.config.length=999999;await assert.rejects(()=>bridge.open(p));assert.equal(launches,1);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('failed app launch does not discard the configuration handoff',async()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'fusion-test-'));
  try{const bridge=createFusionBridge(dir,async()=>{throw Error('not installed');});const result=await bridge.open(createProject());assert.equal(result.launch,'failed');assert.equal(bridge.status(result.id).state,'queued');}finally{rmSync(dir,{recursive:true,force:true});}
});
