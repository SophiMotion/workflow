import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile);
test('Codex runner resolves Node under the minimal macOS login-service PATH',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'want-cli-test-')),bin=path.join(tmp,'codex');await fs.writeFile(bin,'#!/usr/bin/env node\nconsole.log("Logged in using ChatGPT");\n',{mode:0o700});
 const script=`import {CodexRunner} from ${JSON.stringify(new URL('../boss/boss-1/want/codex.mjs',import.meta.url).href)}; console.log(JSON.stringify(await new CodexRunner({}).status()));`;
 const {stdout}=await exec(process.execPath,['--input-type=module','-e',script],{env:{...process.env,PATH:'/usr/bin:/bin',WANT_CODEX_BIN:bin}});assert.equal(JSON.parse(stdout).available,true);
});
