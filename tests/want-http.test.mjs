import http from 'node:http';import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {fixture} from './want-fixture.mjs';import {createServer} from '../boss/boss-1/want/server.mjs';import {exportCSV,exportHTML} from '../boss/boss-1/want/export.mjs';import {viewRecords} from '../boss/boss-1/want/model.mjs';
test('exports escape formulas and HTML, highlight verified messages only',async()=>{
 const {store}=await fixture();const rows=viewRecords(await store.snapshot());rows[0].name='=HYPERLINK("bad")';
 assert.match(exportCSV(rows),/'=HYPERLINK/);const html=exportHTML(rows,{});assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>x/);assert.equal((html.match(/class="sent-message"/g)||[]).length,1);
});
test('HTTP blocks cross-origin writes, traversal and invalid IDs while filter exports work',async t=>{
 const {root,store}=await fixture();const app=await createServer({root,store,runner:{status:async()=>({available:false}),run:async()=>{throw Error('offline');}}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.server.close());const base='http://127.0.0.1:'+app.server.address().port;
 const session=await (await fetch(base+'/api/want/session')).json();
 const post=(url,data,origin=base)=>fetch(base+url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Want-Token':session.token},body:JSON.stringify(data)});
 assert.equal((await post('/api/want/jobs',{ids:['a']},'https://evil.example')).status,403);
 assert.equal((await post('/api/want/reviews',{id:'unknown',category:'需要核实',note:'测试'})).status,400);
 assert.equal((await fetch(base+'/boss/recruitment-data.json')).status,404);
 assert.equal(await new Promise((resolve,reject)=>http.get(base+'/api/want/snapshot',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject)),403);
 assert.equal((await fetch(base+'/api/want/reviews',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Want-Token':'wrong'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/want/reviews',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Want-Token':session.token},body:'broken json'})).status,400);
 assert.equal((await fetch(base+'/api/want/download/..%2f..%2fboss%2frecruitment-data.json')).status,404);

 assert.equal((await fetch(base+'/api/want/snapshot',{headers:{Origin:'https://evil.example'}})).status,403);
 const res=await post('/api/want/export',{format:'csv',filters:{role:'3d'}});assert.equal(res.status,200);const out=await res.json();const text=await(await fetch(base+out.url)).text();assert.match(text,/归档/);assert.doesNotMatch(text,/同名/);
 const d=await(await fetch(base+'/api/want/records?role=electrical')).json();assert.equal(d.total,2);
});

test('a second server never recovers jobs owned by the first worker',async t=>{
 const {root,store}=await fixture();const runner={status:async()=>({available:false})};const first=await createServer({root,store,runner});
 await new Promise(r=>first.server.listen(0,'127.0.0.1',r));t.after(()=>first.server.close());
 await store.mutate(s=>s.jobs.push({id:'live',ids:['a'],done:[],batches:[],status:'running'}));
 await assert.rejects(createServer({root,store,runner}),/后台|worker/);
 assert.equal((await store.readState()).jobs[0].status,'running');
});
test('snapshot revision changes when source or role configuration changes',async t=>{
 const {root,store}=await fixture();const app=await createServer({root,store,runner:{status:async()=>({available:false})}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.server.close());
 const base='http://127.0.0.1:'+app.server.address().port;const before=await(await fetch(base+'/api/want/snapshot')).json();
 const file=root+'/boss/recruitment-config.json';const cfg=JSON.parse(await fs.readFile(file));cfg.roles[0].requirements+=' updated';await fs.writeFile(file,JSON.stringify(cfg));
 const after=await(await fetch(base+'/api/want/snapshot')).json();assert.notEqual(after.sourceRevision,before.sourceRevision);
});
