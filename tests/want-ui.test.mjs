import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('rapid filtering applies the latest response, even if older requests finish later', async () => {
 const nodes = new Map();
 const node = id => {if (!nodes.has(id)) nodes.set(id,{value:'',innerHTML:'',textContent:'',classList:{toggle(){},remove(){},add(){}}});return nodes.get(id);};
 const pending=[];
 const context={document:{getElementById:node},location:{protocol:'http:'},URLSearchParams,URL,Set,Date,clearTimeout,setTimeout,
  fetch:(url)=>url.includes('/session')?new Promise(()=>{}):new Promise(resolve=>pending.push({url,resolve}))};
 vm.createContext(context);
 vm.runInContext(await fs.readFile(new URL('../boss/boss-1/want/public/app.js',import.meta.url),'utf8'),context);
 node('role').value='navigation';const first=context.loadRows();
 node('role').value='structure';const second=context.loadRows();
 assert.equal(pending.length,2,'the second filter must not be dropped while loading');
 pending[1].resolve({ok:true,json:async()=>({rows:[],page:1,pages:1,total:9})});await second;
 pending[0].resolve({ok:true,json:async()=>({rows:[],page:1,pages:1,total:100})});await first;
 assert.equal(node('result-count').textContent,'找到 9 条阅读记录');
 assert.match(pending[1].url,/role=structure/);
});

test('external source revision refreshes rows and role descriptions without a sidecar write',async()=>{
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',classList:{toggle(){},remove(){},add(){}}});return nodes.get(id);};
 const base={version:7,sourceRevision:'old',capabilities:{codex:{available:true},browser:{}},stats:[],categories:[],counts:{},roles:[{id:'a',name:'role',requirements:'old'}],jobs:[],exports:[]};let source=base,reads=0;
 const context={document:{getElementById:node},location:{protocol:'http:'},URLSearchParams,URL,Set,Date,clearTimeout,setTimeout,fetch:async url=>{
 if(url.includes('/session'))return new Promise(()=>{});
 return {ok:true,json:async()=>url.includes('/snapshot')?source:(reads++,{rows:[],page:1,pages:1,total:0})};}};
 vm.createContext(context);vm.runInContext(await fs.readFile(new URL('../boss/boss-1/want/public/app.js',import.meta.url),'utf8'),context);
 await context.refreshSummary(true);await context.loadRows();source={...base,sourceRevision:'new',roles:[{id:'a',name:'role',requirements:'NEW REQUIREMENTS'}]};await context.refreshSummary();
 assert.equal(reads,2);assert.match(node('sources').innerHTML,/NEW REQUIREMENTS/);
});
test('return to workflow uses the original history context instead of a partial static mirror',async()=>{
 const node={classList:{remove(){},toggle(){},add(){}}};let back=0;
 const context={document:{getElementById:()=>node},location:{protocol:'http:',search:'?from=workflow'},history:{length:2,back(){back++;}},URLSearchParams,URL,Set,Date,clearTimeout,setTimeout:()=>0,fetch:()=>new Promise(()=>{})};
 vm.createContext(context);vm.runInContext(await fs.readFile(new URL('../boss/boss-1/want/public/app.js',import.meta.url),'utf8'),context);
 context.returnToStudio();assert.equal(back,1);
 context.location.search='';context.returnToStudio();assert.equal(back,1);assert.match(node.textContent,/SophiStudio/);
});
