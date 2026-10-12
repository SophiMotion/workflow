import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ensureService } from '../scripts/launch-service.mjs';

const exec = promisify(execFile);
const helper = new URL('../scripts/launch-service.mjs', import.meta.url).href;
const root = fileURLToPath(new URL('..', import.meta.url));
const cli = 'const {ensureService}=await import(process.argv[1]);console.log(JSON.stringify(await ensureService(JSON.parse(process.argv[2]))));';
async function run(config) {
  const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', cli, helper, JSON.stringify(config)]);
  return JSON.parse(stdout);
}

test('launcher service survives its launcher process and reuses the existing service', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skate-launch-test-'));
  for (const folder of ['server', 'shared']) fs.cpSync(path.join(root, folder), path.join(temp, folder), { recursive: true });
  fs.mkdirSync(path.join(temp, 'node_modules'));
  fs.mkdirSync(path.join(temp, 'dist'));
  fs.writeFileSync(path.join(temp, 'dist/index.html'), '<!doctype html><title>Isolated test</title>');
  let pid;
  t.after(() => { if (pid) { try { process.kill(pid, 'SIGTERM'); } catch {} } fs.rmSync(temp, { recursive: true, force: true }); });
  const first = await run({ root: temp, port: 44175 });
  assert.equal(first.started, true); pid = first.pid;
  assert.equal((await fetch(first.url + '/api/skate/health')).status, 200);
  assert.equal((await run({ root: temp, port: 44175 })).started, false);
  assert.equal(process.kill(pid, 0), true);
  assert.ok(fs.existsSync(path.join(temp, 'data/workstation.log')));
});

test('launcher reports occupied ports and missing builds without replacing anything', async t => {
  const occupied = http.createServer((req, res) => { res.writeHead(404); res.end('Other application'); });
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  t.after(() => occupied.close());
  await assert.rejects(ensureService({ port: occupied.address().port }), /其他服务占用/);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skate-launch-empty-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  await assert.rejects(ensureService({ root: temp, port: 44176 }), /项目文件缺失：dist\/index.html/);
  assert.equal(fs.existsSync(path.join(temp, 'data')), false);
});
