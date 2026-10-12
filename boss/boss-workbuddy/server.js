// 本地控制台服务：为 boss-workbuddy.html 提供 API 桥接
// 点击"搜索"→ POST /api/run → 后台执行引擎
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { isDebugPortOpen, launchEdge, connectMainTab } from './engine/cdp.js';
import { inspectBossSession } from './engine/browser-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8771;
let lastRun = null;
let currentRun = null; // 当前运行的子进程

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // CORS
  const origin = req.headers.origin;
  const allowed = ['http://127.0.0.1:8771', 'http://localhost:8771'];
  if (origin && !allowed.includes(origin)) return sendJson(res, 403, {ok:false,error:'请从本地控制台执行'});
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 健康检查
  if (url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, edgeDebug: await isDebugPortOpen() });
  }

  // 启动执行
  if (url.pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      let opts;
      try { opts = body ? JSON.parse(body) : {}; } catch { return sendJson(res,400,{ok:false,error:'请求格式错误'}); }
      if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return sendJson(res,400,{ok:false,error:'请求格式错误'});
      if (opts.paidGreet) return sendJson(res,403,{ok:false,error:'本任务不支持付费发送'});
      if (!opts.dryRun && !opts.noSend) return sendJson(res,412,{ok:false,error:'独立发送连接尚未完成精确聊天核验。请在 Codex 任务中通过已登录的内置浏览器执行；此控制台不会自动接管该浏览器。'});
      if (opts.role != null && (typeof opts.role !== 'string' || !/^[a-z0-9_-]+$/i.test(opts.role))) return sendJson(res,400,{ok:false,error:'岗位参数无效'});
      if (currentRun) return sendJson(res, 409, { ok: false, error: '已有任务在运行' });

      const args = [path.join(__dirname, 'start.js')];
      if (opts.dryRun) args.push('--dry-run');
      if (opts.noSend) args.push('--no-send');
      if (opts.role) args.push('--role', opts.role);

      const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      currentRun = child;
      let output = '';
      child.stdout.on('data', d => output = (output+d).slice(-20000));
      child.stderr.on('data', d => output = (output+d).slice(-20000));
      child.on('error', error => {lastRun={finishedAt:new Date().toISOString(),exitCode:1,output:error.message};currentRun=null;});

      child.on('exit', (code) => {
        currentRun = null;
        lastRun={finishedAt:new Date().toISOString(),exitCode:code,output};
        console.log(`[server] 任务结束 code=${code}`);
      });

      // 先返回已启动
      sendJson(res, 200, { ok: true, message: '采集进程已启动；结果以完成日志为准', pid: child.pid });
    });
    return;
  }

  // 获取运行状态
  if (url.pathname === '/api/status') {
    return sendJson(res, 200, {
      running: !!currentRun,
      lastRun,
      scope: '仅本地独立浏览器连接，不代表 Codex、原生 Edge 或 Chrome 的登录状态',
      edgeDebug: await isDebugPortOpen(),
    });
  }

  // Inspect rendered content. A URL alone never proves a valid login.
  if (url.pathname === '/api/check-login') {
    let session;
    try {
      ({session}=await connectMainTab());
      return sendJson(res,200,await inspectBossSession(session));
    } catch (error) {
      return sendJson(res,200,{state:'connection_unavailable',loggedIn:null,error:error.message});
    } finally {if(session)await session.close();}
  }

  // 启动 Edge
  if (url.pathname === '/api/launch-edge') {
    try {
      const r = await launchEdge();
      return sendJson(res, 200, { ok: true, ...r });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // 静态文件
  if (url.pathname === '/' || url.pathname === '/boss-workbuddy.html') {
    const html = fs.readFileSync(path.join(__dirname, 'boss-workbuddy.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  sendJson(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`BOSS 招聘控制台：http://127.0.0.1:${PORT}/boss-workbuddy.html`);
});
