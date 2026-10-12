import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildCollections} from '../scripts/build-collections.mjs';

test('additional collection preserves attribution, rewrites internal links and reports missing assets',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipm-collection-'));
  try{
    const content=path.join(root,'content/example'),site=path.join(root,'site');
    fs.mkdirSync(content,{recursive:true});fs.mkdirSync(path.join(site,'data'),{recursive:true});fs.mkdirSync(path.join(site,'articles'));
    const config={id:'example',name:'示例教程',category:'rag',repository:'https://github.com/example/repo',commit:'abc',sourceUrl:'https://example.test/source',author:'原作者',license:'CC BY-NC-SA 4.0',licenseFile:'LICENSE.txt'};
    fs.writeFileSync(path.join(root,'content/public-collections.json'),JSON.stringify([config]));
    fs.writeFileSync(path.join(content,'README.md'),'许可原始说明');
    fs.writeFileSync(path.join(content,'LICENSE.txt'),'完整许可');
    fs.writeFileSync(path.join(content,'first.md'),'# 第一篇\n正文必须保留\n[下一节](second.md)\n![缺失](missing.png)');
    fs.writeFileSync(path.join(content,'second.md'),'# 第二篇\n第二篇正文');
    fs.writeFileSync(path.join(content,'manifest.json'),JSON.stringify({...config,documents:[{id:'example-01',title:'第一篇',path:'first.md',sourceUrl:'https://example.test/chapter1',order:1,assets:[{reference:'missing.png',local:'missing.png'}]},{id:'example-02',title:'第二篇',path:'second.md',order:2,assets:[]}],failedAssets:[]}));
    const output=buildCollections(root,site);
    assert.equal(output.documents.length,2);
    assert.equal(output.documents[0].author,'原作者');
    assert.equal(output.documents[0].category,'rag');
    assert.equal(output.documents[0].collection,'example');
    assert.equal(output.documents[0].sourceUrl,'https://example.test/chapter1');
    assert.equal(output.documents[1].sourceUrl,config.sourceUrl);
    assert.equal(output.documents[0].licensePath,'data/LICENSE-example.txt');
    assert.equal(output.documents[0].status,'public-partial');
    assert.equal(output.documents[0].imageCount,0);
    assert.equal(output.missingImages.length,1);
    const html=fs.readFileSync(path.join(site,'articles/example-01.html'),'utf8');
    assert.match(html,/正文必须保留/);
    assert.match(html,/href="#\/doc\/example-02"/);
    assert.equal(fs.readFileSync(path.join(site,'data/README-example.md'),'utf8'),'许可原始说明');
    assert.equal(fs.readFileSync(path.join(site,'data/LICENSE-example.txt'),'utf8'),'完整许可');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
