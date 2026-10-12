import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consult, main, OpenAIAdapter, citationWarnings } from '../harness.mjs';
const input={question:'制动器如何验证？',sources:[{id:'S1',title:'方案',text:'使用防坠制动器',line_start:1,line_end:1,warnings:[]}],models:{openai:'gpt-5.4',deepseek:'deepseek-v4-pro'}};

test('two independent perspectives precede synthesis, with actual evidence and disagreement instructions',async()=>{
  const calls=[], events=[];
  const result=await consult(input,async(provider,model,system,prompt)=>{calls.push({provider,model,system,prompt});return{text:'验证防坠制动器 [S1]'};},event=>events.push(event));
  assert.equal(result.status,'completed');assert.equal(calls.length,3);
  assert.equal(calls[0].provider,'openai');assert.equal(calls[1].provider,'deepseek-official');
  assert.match(calls[2].system,/保留分歧/);assert.match(calls[2].prompt,/other_model_data/);assert.match(calls[0].prompt,/防坠制动器/);
  assert.equal(events.filter(e=>e.type==='answer').length,3);
});
test('one provider failing preserves the other answer and never fabricates synthesis',async()=>{
  let count=0;
  const result=await consult(input,async(provider)=>{count++;if(provider==='openai')throw new Error('HTTP 401');return{text:'国内建议 [S1]'};},()=>{});
  assert.equal(result.status,'partial');assert.equal(count,2);assert.equal(result.answers.synthesis,undefined);assert.equal(result.answers.domestic.text,'国内建议 [S1]');
});
test('missing and unknown citations are explicitly flagged',()=>{
  assert.equal(citationWarnings('建议 [S99]',input.sources).length,1);
  assert.equal(citationWarnings('没有引用',input.sources).length,1);
  assert.deepEqual(citationWarnings('建议 [S1]',input.sources),[]);
});
test('both providers failing is failed, with no claim that a successful answer exists',async()=>{
  const result=await consult(input,async()=>{throw new Error('account unavailable');},()=>{});
  assert.equal(result.status,'failed');assert.match(result.message,/两路模型均未完成/);assert.equal(result.answers.synthesis,undefined);
});
test('OpenAI uses official Responses API, no storage or tools, rejects incomplete output',async()=>{
  let sent;
  const adapter=new OpenAIAdapter(async(url,options)=>{sent={url,options};return Response.json({status:'incomplete',output:[]});});
  await assert.rejects(async()=>{for await(const ignored of adapter.stream({model:'gpt-5.4',system:'Rules',messages:[],maxTokens:100})){}},/未生成完整/);
  assert.equal(sent.url,'https://api.openai.com/v1/responses');assert.equal(sent.options.redirect,'error');
  const body=JSON.parse(sent.options.body);assert.equal(body.store,false);assert.equal(body.tools,undefined);
});
test('real Harness runtime routes all three stages using fixture provider wire responses',async()=>{
  const home=await mkdtemp(join(tmpdir(),'sophi-harness-'));
  const oldFetch=globalThis.fetch, oldHome=process.env.DSH_HOME, oldDS=process.env.DEEPSEEK_API_KEY, oldOA=process.env.OPENAI_API_KEY;
  process.env.DSH_HOME=home;process.env.DEEPSEEK_API_KEY='sk-unit-test-only';process.env.OPENAI_API_KEY='sk-unit-test-only';
  const requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push({url:String(url),body:JSON.parse(options.body)});
    if(String(url).startsWith('https://api.openai.com/'))return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'国际分析 [S1]'}]}],usage:{input_tokens:10,output_tokens:10,total_tokens:20}});
    assert.ok(String(url).startsWith('https://api.deepseek.com/'));
    const packets=[{id:'chatcmpl-fixture',model:'deepseek-v4-pro',choices:[{index:0,delta:{role:'assistant',content:'DeepSeek 分析 [S1]'},finish_reason:null}]},{id:'chatcmpl-fixture',model:'deepseek-v4-pro',choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20,prompt_cache_hit_tokens:0}}];
    return new Response(packets.map(p=>'data: '+JSON.stringify(p)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
  };
  try {
    const result=await main(input,()=>{});
    assert.equal(result.status,'completed',JSON.stringify(result));assert.equal(requests.length,3);
    assert.equal(requests.filter(r=>r.url.startsWith('https://api.deepseek.com/')).length,2);
    for(const request of requests)assert.equal(request.body.tools,undefined);
  } finally {
    globalThis.fetch=oldFetch;
    for(const [key,value] of Object.entries({DSH_HOME:oldHome,DEEPSEEK_API_KEY:oldDS,OPENAI_API_KEY:oldOA}))if(value===undefined)delete process.env[key];else process.env[key]=value;
    await rm(home,{recursive:true,force:true});
  }
});
