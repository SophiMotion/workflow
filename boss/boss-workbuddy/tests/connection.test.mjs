import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesJobName,waitForRecommendCards} from '../engine/boss.js';
const cdp=await import('../engine/cdp.js');
const policy=await import('../engine/browser-state.js').catch(()=>({}));
const tab=(id,url)=>({id,url,type:'page',webSocketDebuggerUrl:'ws://127.0.0.1/fixture'});
test('job name matches a complete label with location, never a different role suffix',async()=>{
 assert.equal(matchesJobName('车辆结构工程师 宁波 5-10K','车辆结构工程师'),true);
 assert.equal(matchesJobName('车辆结构工程师助理','车辆结构工程师'),false);
 const session={eval:async()=>({jobText:'车辆结构工程师 宁波',currentCount:1,cardIds:['candidate00000001'],signature:'candidate00000001',count:1})};
 assert.equal(await waitForRecommendCards(session,50,{expectedJobName:'车辆结构工程师',pollMs:0}),1);
});
test('browser selection uses exact BOSS origin and refuses ambiguity or unrelated tabs',()=>{
 assert.equal(typeof cdp.selectBossTab,'function');
 const good=tab('boss','https://www.zhipin.com/web/chat/recommend');
 assert.equal(cdp.selectBossTab([tab('other','https://example.com/?zhipin.com'),good]).id,'boss');
 assert.throws(()=>cdp.selectBossTab([tab('lookalike','https://www.zhipin.com.evil.example/web/chat/index')]),/BOSS_TAB/);
 assert.throws(()=>cdp.selectBossTab([good,tab('boss2','https://www.zhipin.com/web/chat/index')]),/AMBIGUOUS/);
 assert.equal(cdp.selectBossTab([good,tab('boss2','https://www.zhipin.com/web/chat/index')],'boss2').id,'boss2');
});
test('login cannot be inferred from a non-login URL or stale employer shell',()=>{
 assert.equal(typeof policy.classifyBossState,'function');
 const base={url:'https://www.zhipin.com/web/chat/recommend',hasEmployerNav:true,candidateCount:0};
 assert.equal(policy.classifyBossState({...base,text:'正在加载中... 当前登录状态已失效'}).state,'login_required');
 assert.equal(policy.classifyBossState({...base,text:'安全验证'}).state,'verification_required');
 assert.equal(policy.classifyBossState({...base,text:'正在加载中...'}).loggedIn,null);
 assert.equal(policy.classifyBossState({...base,text:'推荐牛人',candidateCount:15}).loggedIn,true);
 assert.equal(policy.classifyBossState({url:'https://example.com/',text:'hello'}).loggedIn,null);
});

test('default CLI reports the missing delivery connection and exits before browser access',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('../start.js',import.meta.url))],{encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stdout+result.stderr,/DELIVERY_ADAPTER_UNAVAILABLE/);assert.match(result.stdout,/成功打招呼：0/);
});

test('a disconnected or silent browser cannot leave commands pending forever',async()=>{
 const ws={send(){},close(){}};
 const session=new cdp.CDPSession(ws,{timeoutMs:15});
 await assert.rejects(session.send('Fixture.command'),/TIMEOUT/);
 const waiting=session.send('Fixture.other');
 await session.close();
 await assert.rejects(waiting,/CLOSED/);
 assert.equal(session.pending.size,0);
});
