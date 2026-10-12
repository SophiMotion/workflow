const BASE = 'http://127.0.0.1:19876';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, options = {}, timeout = 15000) {
  const response = await fetch(BASE + path, { ...options, signal: AbortSignal.timeout(timeout) });
  const reply = await response.json();
  if (!response.ok || reply.ok === false) throw Error(reply.error || 'Fusion 连接失败。');
  return reply;
}
function launchFusion() {
  // 只唤起已安装的 Fusion；不通过网址执行脚本 / Launch Fusion only; no code or file commands in the URI.
  const link = document.createElement('a'); link.href = 'fusion360://'; link.click();
}
export async function importIntoFusion(design, onProgress) {
  onProgress({ state: 'connecting', message: '正在连接本机 Fusion…' });
  let session;
  try { session = await request('/session', {}, 1500); }
  catch {
    launchFusion();
    onProgress({ state: 'connecting', message: '正在打开 Fusion，请允许浏览器打开应用…' });
    for (let attempt = 0; attempt < 40; attempt++) {
      await pause(1500);
      try { session = await request('/session', {}, 1500); break; } catch { /* 等待应用启动 / Wait for startup. */ }
    }
  }
  if (!session) throw Error('尚未连接到 Mooncake。请在 Fusion 的“脚本和附加模块”中运行 mooncake，并启用“启动时运行”，然后重试。');
  if (session.service !== 'mooncake.fusion' || session.version !== 1) throw Error('本机连接版本不兼容，请更新 Mooncake 插件。');
  const jobId = crypto.randomUUID(), headers = { 'Content-Type': 'application/json', 'X-Mooncake-Token': session.token, 'X-Mooncake-Job': jobId };
  let job;
  // 网络重试沿用同一编号，避免重复建模 / Reuse the job ID after an uncertain response.
  try { job = await request('/jobs', { method: 'POST', headers, body: JSON.stringify(design) }); }
  catch (error) {
    try { job = await request(`/jobs/${jobId}`, { headers }); } catch { throw error; }
  }
  onProgress({ state: job.state, message: job.message, pluginPath: session.pluginPath });
  for (let attempt = 0; attempt < 600; attempt++) {
    if (job.state === 'complete') return job;
    if (job.state === 'failed') throw Error(job.error || 'Fusion 建模失败。');
    await pause(1000);
    job = await request(`/jobs/${jobId}`, { headers });
    onProgress({ state: job.state, message: job.message, pluginPath: session.pluginPath });
  }
  throw Error('Fusion 仍在处理此设计，请查看 Fusion 的进度；请勿重复提交。');
}
