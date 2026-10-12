import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('standalone HTML has parseable inline JavaScript and no network dependencies',async()=>{const html=await readFile(new URL('../weld.html',import.meta.url),'utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);assert.doesNotThrow(()=>new vm.Script(scripts[0][1]));assert.ok(!/<(?:script|link)[^>]+(?:src|href)=["']https?:/.test(html));assert.ok(!html.includes('/* APP_SCRIPT */'));});
