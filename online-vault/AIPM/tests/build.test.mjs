import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('build counts only saved assets and reports a missing image', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipm-build-'));
  try {
    fs.mkdirSync(path.join(root,'scripts'));
    for(const file of ['build.mjs','build-collections.mjs','render.mjs']) fs.copyFileSync(new URL('../scripts/'+file,import.meta.url),path.join(root,'scripts',file));
    fs.symlinkSync(path.resolve('node_modules'),path.join(root,'node_modules'),'dir');
    const content=path.join(root,'content/hello-agents');fs.mkdirSync(content,{recursive:true});
    fs.writeFileSync(path.join(root,'content/catalog.json'),JSON.stringify({categories:[{id:'agent-course'}],chapters:[{number:1,title:'测试',aliases:[]}]}));
    fs.writeFileSync(path.join(content,'chapter.md'),'# 测试\n![已存](ok.png)\n![缺失](gone.png)');
    fs.writeFileSync(path.join(content,'ok.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPlsAAAAASUVORK5CYII=','base64'));
    for(const file of ['README.md','LICENSE.txt'])fs.writeFileSync(path.join(content,file),'fixture');
    fs.writeFileSync(path.join(content,'manifest.json'),JSON.stringify({commit:'test',chapters:[{number:1,path:'chapter.md',assets:[{reference:'ok.png',local:'ok.png'},{reference:'gone.png',local:'gone.png'}]}],failedAssets:[]}));
    execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{stdio:'pipe'});
    const result=JSON.parse(fs.readFileSync(path.join(root,'site/data/catalog.json'),'utf8'));
    assert.equal(result.stats.images,1);
    assert.equal(result.documents[0].imageCount,1);
    assert.equal(result.stats.missingImages,1);
    assert.equal(result.documents[0].status,'public-partial');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
