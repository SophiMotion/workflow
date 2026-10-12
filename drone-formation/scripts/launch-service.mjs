import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function health(url) {
  let response;
  try { response = await fetch(url + '/api/drone/health', { signal: AbortSignal.timeout(800) }); }
  catch { return false; }
  let value;
  try { value = await response.json(); } catch { /* Other service / 端口被其他服务占用 */ }
  if (response.ok && value?.ok === true && value?.app === 'sophistudio-drone') return true;
  throw new Error('4178 端口被其他服务占用。请关闭占用该端口的程序后重试。');
}

// Fixed local service only. No URL or shell command comes from the HTML entry.
// 只启动当前项目的本地服务，HTML 不传入地址、路径或命令。
export async function ensureService({ root = projectRoot, port = 4178 } = {}) {
  const url = `http://127.0.0.1:${port}`;
  if (await health(url)) return { url, started: false };
  for (const file of ['index.html', 'server.mjs', 'vendor/three.module.min.js']) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`项目文件缺失：${file}。请恢复项目文件后重试。`);
  }
  const logDir = path.join(root, 'data');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'launcher.log');
  const log = fs.openSync(logPath, 'a', 0o600);
  let child, launchError;
  try {
    child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
      cwd: root, detached: true, stdio: ['ignore', log, log],
      env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port) },
    });
    child.on('error', error => { launchError = error; });
    child.unref();
  } finally { fs.closeSync(log); }
  for (let attempt = 0; attempt < 40; attempt++) {
    if (launchError) throw launchError;
    if (await health(url)) return { url, started: true, pid: child.pid };
    await pause(250);
  }
  throw new Error(`点阵飞行未能启动。请查看日志：${logPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureService().then(result => console.log(JSON.stringify(result))).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
