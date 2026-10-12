// Optional local CDP connection for a separately configured dedicated browser.
// Codex in-app browser is operated through Codex Computer Use, not this port.
const DEBUG_PORT = 9222;
async function readEndpoint(endpoint) {
 const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/${endpoint}`, {signal:AbortSignal.timeout(2500)});
 if (!response.ok) throw new Error('BROWSER_CONNECTION_UNAVAILABLE');
 return response.json();
}
export async function getBrowserWs(){return (await readEndpoint('version')).webSocketDebuggerUrl;}
export async function listTabs(){return readEndpoint('list');}
export async function isDebugPortOpen(){try{return !!(await getBrowserWs());}catch{return false;}}
// Kept as a compatibility endpoint; it never copies a profile or starts a foreground window.
export async function launchEdge(){throw new Error('请在 Codex 内置浏览器登录 BOSS，或通过官方扩展连接已有 Edge/Chrome；本地控制台不会自动启动浏览器或复制登录资料。');}

export function selectBossTab(tabs, targetId) {
 const allowed=tabs.filter(t=>{
  try{const u=new URL(t.url);return t.type==='page'&&u.protocol==='https:'&&u.hostname==='www.zhipin.com'&&u.pathname.startsWith('/web/');}catch{return false;}
 });
 if(targetId){const tab=allowed.find(t=>t.id===targetId);if(!tab)throw new Error('BOSS_TAB_NOT_FOUND');return tab;}
 if(allowed.length>1)throw new Error('BOSS_TAB_AMBIGUOUS：存在多个 BOSS 标签，请指定目标标签');
 if(allowed.length!==1)throw new Error('BOSS_TAB_NOT_FOUND：未找到已连接的 BOSS 标签');
 return allowed[0];
}

// ---------- CDP 会话 ----------
export class CDPSession {
  constructor(ws, {timeoutMs=8000}={}) {
    this.ws=ws;this.id=0;this.pending=new Map();this.handlers=new Map();this.timeoutMs=timeoutMs;
    ws.onclose=()=>this._rejectPending('BROWSER_CLOSED');
  }
  _rejectPending(reason) {
    for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(reason));}
    this.pending.clear();
  }
  static async connect(wsUrl) {
    const ws=new WebSocket(wsUrl);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{reject(new Error('BROWSER_CONNECTION_TIMEOUT'));ws.close();},3000);
      ws.onopen=()=>{clearTimeout(timer);resolve();};
      ws.onerror=()=>{clearTimeout(timer);reject(new Error('BROWSER_CONNECTION_FAILED'));};
    });
    const session=new CDPSession(ws);
    ws.onmessage=event=>{try{session._onMessage(JSON.parse(event.data));}catch{session._rejectPending('BROWSER_RESPONSE_INVALID');}};
    return session;
  }
  _onMessage(msg) {
    if(msg.id){
      const pending=this.pending.get(msg.id);
      if(pending){clearTimeout(pending.timer);this.pending.delete(msg.id);msg.error?pending.reject(new Error(msg.error.message)):pending.resolve(msg.result);}
    } else if(msg.method){for(const handler of this.handlers.get(msg.method)||[])handler(msg.params);}
  }
  send(method,params={}) {
    const id=++this.id;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('BROWSER_COMMAND_TIMEOUT: '+method));},this.timeoutMs);
      this.pending.set(id,{resolve,reject,timer});
      try{this.ws.send(JSON.stringify({id,method,params}));}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise, userGesture: true });
    if (r.exceptionDetails) throw new Error('页面脚本执行异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result?.value;
  }

  // 通过 CDP Input 派发真实鼠标点击（isTrusted=true，仍须核验页面实际响应）
  // x,y 为视口坐标（CSS 像素）
  async clickAt(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  // 计算某元素在页面视口中的绝对坐标（含 iframe 偏移）
  // selector 支持在 iframe 内：{ iframeSrc 关键词, selector } 或直接主文档 selector
  async getElementCenter(iframeSrcKeyword, selector) {
    return this.eval(`(function(){
      let el = null;
      if (${JSON.stringify(iframeSrcKeyword)}) {
        const f = Array.from(document.querySelectorAll("iframe")).find(f => (f.src||"").includes(${JSON.stringify(iframeSrcKeyword)}));
        if (!f || !f.contentDocument) return null;
        el = f.contentDocument.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const fr = f.getBoundingClientRect();
        return { x: fr.x + r.x + r.width/2, y: fr.y + r.y + r.height/2 };
      }
      el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    })()`);
  }

  async navigate(url, { force = false } = {}) {
    // 已在目标页面则跳过导航（避免重复导航导致 SPA 重新洗牌/重新加载）
    if (!force) {
      const cur = await this.eval(`location.href`).catch(() => '');
      if (cur && cur.split('#')[0].split('?')[0] === url.split('#')[0].split('?')[0]) {
        return false; // 已在目标页，未导航
      }
    }
    await this.send('Page.navigate', { url });
    await this.waitLoad().catch(() => {});
    return true;
  }

  async waitLoad(timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const st = await this.eval(`document.readyState`).catch(() => 'loading');
      if (st === 'complete') return;
      await new Promise(r => setTimeout(r, 300));
    }
    throw new Error('页面加载超时');
  }

  async close() { this._rejectPending('BROWSER_CLOSED');try { this.ws.close(); } catch {} }
}

// Connect only to an unambiguous BOSS tab; never fall back to an unrelated page.
export async function connectMainTab(targetId = process.env.BOSS_TARGET_ID) {
 const page=selectBossTab(await listTabs(),targetId);
 const session=await CDPSession.connect(page.webSocketDebuggerUrl);
 try{await session.send('Page.enable');await session.send('Runtime.enable');return {session,targetId:page.id};}
 catch(error){await session.close();throw error;}
}
