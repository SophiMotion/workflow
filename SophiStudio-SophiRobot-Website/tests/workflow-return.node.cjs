const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtemp,writeFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createWorkflowHandler}=require('../scripts/workflow-return.cjs');

async function request(handler,overrides={}){
 const req={method:'POST',headers:{host:'127.0.0.1:4189',origin:'http://127.0.0.1:4189','x-sophistudio-action':'open-workflow'},socket:{localPort:4189},...overrides};
 let status,body;
 await handler(req,{writeHead(code){status=code;},end(value){body=JSON.parse(value);}});
 return {status,body};
}

test('a same-origin action opens only the configured workflow file and preserves its route',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'sophi-workflow-'));
 try{
  const file=path.join(dir,'a space 中文.html');await writeFile(file,'<!doctype html>');
  const opened=[];
  const handler=createWorkflowHandler({workflowFile:file,launch:async url=>opened.push(url)});
  const result=await request(handler);
  const expected=pathToFileURL(file);expected.hash='/workflow';
  assert.equal(result.status,200);assert.equal(result.body.ok,true);
  assert.deepEqual(opened,[expected.href]);assert.equal(result.body.url,expected.href);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('GET and cross-origin requests cannot trigger the desktop opener',async()=>{
 let count=0;
 const handler=createWorkflowHandler({workflowFile:__filename,launch:async()=>count++});
 for(const overrides of [
  {method:'GET'},
  {headers:{host:'127.0.0.1:4189',origin:'https://other.example','x-sophistudio-action':'open-workflow'}},
  {headers:{host:'127.0.0.1:4189',origin:'http://127.0.0.1:4189'}},
  {headers:{host:'other.example:4189',origin:'http://other.example:4189','x-sophistudio-action':'open-workflow'}},
 ])assert.ok((await request(handler,overrides)).status>=400);
 assert.equal(count,0);
});

test('a missing homepage returns a useful failure without opening anything',async()=>{
 let count=0;
 const handler=createWorkflowHandler({workflowFile:path.join(__dirname,'missing-homepage.html'),launch:async()=>count++});
 assert.equal((await request(handler)).status,404);assert.equal(count,0);
});

test('an opener failure is not reported as success',async()=>{
 const handler=createWorkflowHandler({workflowFile:__filename,launch:async()=>{throw new Error('Launch failed');}});
 const result=await request(handler);
 assert.equal(result.status,500);assert.equal(result.body.ok,false);
 assert.ok(result.body.url.endsWith('#/workflow'));
});
