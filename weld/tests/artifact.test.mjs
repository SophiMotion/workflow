import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('standalone HTML has parseable inline JavaScript and no network dependencies',async()=>{const html=await readFile(new URL('../weld.html',import.meta.url),'utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);assert.doesNotThrow(()=>new vm.Script(scripts[0][1]));assert.ok(!/<(?:script|link)[^>]+(?:src|href)=["']https?:/.test(html));assert.ok(!html.includes('/* APP_SCRIPT */'));});

// GitHub Pages serves the committed HTML, not src/app.js.
test('published HTML and licenses match the current sources and embedded models',async()=>{
 const {execFile}=await import('node:child_process');
 const {promisify}=await import('node:util');
 await promisify(execFile)(process.execPath,['scripts/build.mjs','--check'],{cwd:new URL('..',import.meta.url)});
});
