/* ==========================================================================
 * app.js — 路由、Shell、交互绑定
 * ========================================================================== */
(function () {
  'use strict';

  const ROUTES = {
    overview:    { title: '总览',                render: () => PFXViews.renderOverview() },
    workflow:    { title: 'SophiStudio 工作流',  render: () => PFXViews.renderWorkflow() },
    sophigo:     { title: 'SophiGo 教育',        render: () => PFXViews.renderSophigo() },
    profabx:     { title: 'ProFabX 工程',        render: () => PFXViews.renderProFabx() },
    sophimotion: { title: 'SophiMotion 实验室',  render: () => PFXViews.renderSophimotion() },
    collab:      { title: '团队协作',            render: () => PFXViews.renderCollab() },
    log:         { title: '日志',                render: () => PFXViews.renderLog() }
  };

  const viewEl = () => document.getElementById('view');
  const authSlot = () => document.getElementById('auth-slot');

  /* ---------- 路由 ---------- */
  function currentRoute() {
    if (PFX_CONFIG.workflowScope === 'engineering') return 'workflow';
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return ROUTES[h] ? h : (document.body.dataset.defaultRoute || 'overview');
  }

  function navigate() {
    const route = currentRoute();
    document.querySelectorAll('#tabs a').forEach(a => {
      if (a.dataset.route === route) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    viewEl().innerHTML = ROUTES[route].render();
    // Keep hash navigation local; resolve module files from the workflow repository.
    viewEl().querySelectorAll('a[href], img[src]').forEach(node => {
      const attribute = node.hasAttribute('href') ? 'href' : 'src';
      node.setAttribute(attribute, PFX_PATHS.resolve(node.getAttribute(attribute)));
    });
    viewEl().scrollTop = 0;
    window.scrollTo({ top: 0 });
    document.title = `${ROUTES[route].title} · SophiStudio 控制台`;
    bindView(route);
    renderAuthSlot();
  }

  /* ---------- 视图内事件绑定 ---------- */
  function bindView(route) {
    // 联动环节点
    viewEl().querySelectorAll('.loop-node[data-route]').forEach(n => {
      n.addEventListener('click', () => { location.hash = n.dataset.route; });
      n.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = n.dataset.route; }
      });
    });

    // 命令条
    const cmdbar = viewEl().querySelector('#cmdbar');
    if (cmdbar) cmdbar.addEventListener('click', openAi);

    // DSH 能力卡演示按钮
    viewEl().querySelectorAll('[data-dsh-demo]').forEach(btn => {
      btn.addEventListener('click', () => dshDemo(btn.dataset.dshDemo, btn.dataset.route));
    });

    if (route === 'collab') bindCollab();
    if (route === 'profabx') bindQuote();
    if (route === 'log') loadReadme();
  }

  /* ---------- DSH 演示入口 ---------- */
  async function dshDemo(cap, route) {
    const open = (txt, chipTone) => openAiResult(`【${cap} 演示调用】`, txt, chipTone);
    switch (cap) {
      case 'ai.chat': openAi(); return;
      case 'workflow.run': {
        const r = await DSH.call('workflow.run', { workflowId: 'linkage-pipeline' });
        if (r.ok) {
          const steps = r.data.steps.map(s => `· ${s.name}（${s.status}）`).join('\n');
          open(`联动管线工作流 runId=${r.data.runId}\n\n${steps}\n\n${r.data.note}`, 'blue');
        } else toast('工作流调用失败：' + r.error, 'err');
        return;
      }
      case 'quote.generate': {
        location.hash = '#/profabx';
        setTimeout(() => { const b = document.getElementById('quote-run'); if (b) b.click(); }, 150);
        return;
      }
      case 'automation.trigger': {
        const r = await DSH.call('automation.trigger', { trigger: 'dsh-card-demo', payload: { text: 'DSH 自动化演示：联动管线状态正常' } });
        toast(r.ok ? r.data.message : '自动化触发失败：' + r.error, r.ok ? 'ok' : 'err');
        if (r.ok) open(`自动化演示\n\n${r.data.message}\n\nchannel：${r.data.channel}`, 'green');
        return;
      }
      case 'kb.search': {
        const r = await DSH.call('kb.search', { query: 'Fab Academy 数字制造' });
        if (r.ok) {
          const hits = r.data.hits.map(h => `· [${h.kind}] ${h.title}（相关度 ${h.score}）\n  ${h.snippet}`).join('\n\n');
          open(`知识库检索（演示）：\n\n${hits}\n\n接入 DSH 后由知识库服务实时检索并带来源引用。`, 'blue');
        } else toast('检索失败：' + r.error, 'err');
        return;
      }
    }
  }

  /* ---------- AI 命令面板 ---------- */
  function openAi() {
    const dlg = document.getElementById('ai-dialog');
    const input = document.getElementById('ai-input');
    document.getElementById('ai-body').innerHTML = defaultAiHint();
    dlg.showModal();
    setTimeout(() => input.focus(), 60);
  }

  function defaultAiHint() {
    return `<div class="palette-hint">
      <p><b>DSH · AI 助手（接口预留）</b></p>
      <p>当前为演示模式，返回模拟数据。接入 DeepSeek Harness 后，这里将连接模型、工作流、报价、自动化与知识库。</p>
      <div class="palette-chips">
        <button data-ai-prompt="今天三块业务的联动状态如何？">联动状态</button>
        <button data-ai-prompt="帮我看下第二客户漏斗进展">客户漏斗</button>
        <button data-ai-prompt="估算一个底盘套件的打样报价">快速报价</button>
        <button data-ai-prompt="知识库里有哪些关于 Fab Academy 的资料？">知识库检索</button>
      </div>
    </div>`;
  }

  async function askAi(query) {
    const body = document.getElementById('ai-body');
    body.innerHTML = `<div class="palette-answer"><div class="pa-head">${icon('auto_awesome')}正在思考<span class="typing"><i></i><i></i><i></i></span></div></div>`;
    const r = await DSH.call('ai.chat', { query });
    if (!r.ok) {
      body.innerHTML = `<div class="palette-answer"><div class="pa-head">${chip('失败', 'red')}AI 助手</div>
        <div class="pa-text">${esc(r.error)}</div></div>`;
      return;
    }
    openAiResult('', r.data.answer, 'blue', r.data.sources, r.data.actions);
  }

  function openAiResult(title, text, chipTone, sources, actions) {
    const body = document.getElementById('ai-body');
    const src = (sources || []).map(s => `
      <div class="pa-source">${icon('link')}<div><b>${esc(s.title)}</b><div class="small muted">${esc(s.kind)} · 相关度 ${esc(s.score)}</div></div></div>`).join('');
    const acts = (actions || []).map(a => `<a class="btn btn-tonal btn-sm" href="${esc(a.route)}">${esc(a.label)}</a>`).join('');
    body.innerHTML = `<div class="palette-answer">
      <div class="pa-head">${icon('auto_awesome')}${chip('演示模式', chipTone || 'blue')}${title ? esc(title) : 'DSH · AI 助手'}</div>
      <div class="pa-text">${esc(text)}</div>
      ${src ? `<div class="pa-sources">${src}</div>` : ''}
      ${acts ? `<div class="pa-actions">${acts}</div>` : ''}
    </div>`;
  }

  /* ---------- 飞书登录 / 用户 ---------- */
  function renderAuthSlot() {
    if (!authSlot()) return;
    const s = Feishu.getSession();
    if (!s) {
      authSlot().innerHTML = `<button class="btn btn-filled btn-sm" id="appbar-login" style="height:36px;padding:0 18px">${icon('login')}飞书登录</button>`;
      const b = document.getElementById('appbar-login');
      if (b) b.addEventListener('click', openLoginDialog);
      return;
    }
    authSlot().innerHTML = `
      <button class="user-chip" id="user-chip" aria-label="用户菜单">
        <span class="avatar sm ${esc(s.avatarColor)}">${esc((s.name || '?').charAt(0))}</span>
        <span class="uname"><b>${esc(s.name)}</b><small>${esc(s.role)}</small></span>
        <span class="ms" style="font-size:16px">arrow_drop_down</span>
      </button>`;
    document.getElementById('user-chip').addEventListener('click', toggleUserMenu);
  }

  function toggleUserMenu(e) {
    e.stopPropagation();
    const old = document.querySelector('.user-menu');
    if (old) { old.remove(); return; }
    const s = Feishu.getSession();
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
      <div class="um-head"><b>${esc(s.name)}</b><small>${esc(s.feishuName || '')} · ${esc(s.tenant || '')}</small></div>
      <button data-um="collab">${icon('groups')}打开团队协作</button>
      <button data-um="switch">${icon('swap_horiz')}切换演示账号</button>
      <button data-um="logout">${icon('logout')}退出登录</button>`;
    menu.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      menu.remove();
      if (b.dataset.um === 'collab') location.hash = '#/collab';
      if (b.dataset.um === 'switch') openLoginDialog();
      if (b.dataset.um === 'logout') { Feishu.logout(); toast('已退出登录', 'info'); navigate(); }
    }));
    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', function once() {
      menu.remove(); document.removeEventListener('click', once);
    }, { once: true }), 0);
  }

  function openLoginDialog() {
    const cfg = PFX_CONFIG.feishu;
    const dlg = document.getElementById('login-dialog');
    document.getElementById('login-title').textContent = '飞书登录';
    const accounts = PFX_CONFIG.demoAccounts.map(a => `
      <button class="demo-account" data-account="${a.id}">
        <span class="avatar ${a.color}">${esc(a.name.charAt(0))}</span>
        <span><b>${esc(a.name)}</b><small>${esc(a.role)}</small></span>
        <span class="spacer"></span><span class="ms muted">arrow_forward</span>
      </button>`).join('');
    document.getElementById('login-body').innerHTML = `
      <div class="login-logo">飞</div>
      <p class="login-note">${cfg.mode === 'oauth'
        ? '将跳转飞书 OAuth 2.0 网页授权完成登录。'
        : '演示模式：选择演示账号模拟飞书身份登录（本地会话）。'}</p>
      ${cfg.mode === 'mock' ? accounts : ''}
      <div class="login-divider">或</div>
      <button class="fs-btn" id="fs-oauth-btn">
        <span class="fs-ico">飞</span>飞书 OAuth 2.0 登录（真实接入）
      </button>
      <p class="small muted mt-12" style="text-align:center">
        真实接入：在 open.feishu.cn 创建企业自建应用并配置重定向 URL，<br>将 js/config.js 的 feishu.mode 改为 'oauth' 并填入 appId（详见 README）。
      </p>`;
    document.querySelectorAll('[data-account]').forEach(b => b.addEventListener('click', async () => {
      const acc = PFX_CONFIG.demoAccounts.find(x => x.id === b.dataset.account);
      const r = await Feishu.login(acc);
      if (r.ok) { dlg.close(); toast(`已以「${acc.name}」登录（演示身份）`, 'ok'); renderAuthSlot(); if (currentRoute() === 'collab') navigate(); }
    }));
    const oauthBtn = document.getElementById('fs-oauth-btn');
    oauthBtn.addEventListener('click', () => {
      dlg.close();
      if (!cfg.appId) { toast('未配置 appId：请先按 README 配置 js/config.js', 'err'); return; }
      Feishu.login();
      toast('正在跳转飞书授权…', 'info');
    });
    dlg.showModal();
  }

  /* ---------- 协作视图交互 ---------- */
  function bindCollab() {
    const loginBtn = viewEl().querySelector('#collab-login-btn');
    if (loginBtn) loginBtn.addEventListener('click', openLoginDialog);

    const logoutBtn = viewEl().querySelector('#collab-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
      Feishu.logout(); toast('已退出登录', 'info'); navigate();
    });

    // 看板推进
    viewEl().querySelectorAll('[data-advance]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.advance;
        const t = PFX_DATA.tasks.find(x => x.id === id);
        if (!t) return;
        const order = ['todo', 'doing', 'done'];
        const next = order[Math.min(order.length - 1, order.indexOf(t.col) + 1)];
        t.col = next;
        const r = await DSH.call('automation.trigger', {
          trigger: 'kanban-advance',
          payload: { text: `【看板】「${t.title}」已推进至${next === 'done' ? '已完成' : '进行中'}（${t.owner}）` }
        });
        if (r.ok) await Feishu.notifyGroup(`【看板】「${t.title}」已推进至${next === 'done' ? '已完成' : '进行中'}（${t.owner}）`);
        navigate();
        toast(r.ok ? '任务已推进，飞书群机器人已模拟通知' : '任务已推进', 'ok');
      });
    });

    // 群通知
    const notifyBtn = viewEl().querySelector('#notify-btn');
    if (notifyBtn) notifyBtn.addEventListener('click', async () => {
      const text = (viewEl().querySelector('#notify-text') || {}).value || '（空消息）';
      const r = await Feishu.notifyGroup(text);
      if (r.ok) { toast('已推送到团队群（演示）', 'ok'); navigate(); }
      else toast('推送失败：' + r.error, 'err');
    });
  }

  /* ---------- ProFabX 报价演示 ---------- */
  function bindQuote() {
    const run = viewEl().querySelector('#quote-run');
    if (!run) return;
    run.addEventListener('click', async () => {
      const result = viewEl().querySelector('#quote-result');
      const process = viewEl().querySelector('#q-process').value;
      const material = viewEl().querySelector('#q-material').value;
      const finish = viewEl().querySelector('#q-finish').value;
      const count = Math.max(1, Math.min(100, parseInt(viewEl().querySelector('#q-count').value || '3', 10)));
      const files = [];
      for (let i = 0; i < count; i++) files.push({ name: `part-${String(i + 1).padStart(2, '0')}.stl`, format: 'STL' });
      result.innerHTML = `<div class="palette-answer"><div class="pa-head">${icon('view_in_ar')}正在估算<span class="typing"><i></i><i></i><i></i></span></div></div>`;
      const r = await DSH.call('quote.generate', { files, process, material, finish });
      if (!r.ok) { result.innerHTML = `<p class="muted">调用失败：${esc(r.error)}</p>`; return; }
      const d = r.data;
      result.innerHTML = `
        <div class="flex-between">
          <b>${esc(d.quoteId)} · ${esc(d.material)} · ${esc(process)} + ${esc(finish)}</b>
          <span class="chip chip-green">合计 ¥${d.total.toLocaleString()}</span>
        </div>
        <div class="table-wrap mt-12">
          <table class="tbl">
            <thead><tr><th>文件</th><th>体积 cm³</th><th>重量 g</th><th>风险</th><th>费用 ¥</th></tr></thead>
            <tbody>${d.items.map(it => `
              <tr><td>${esc(it.file)}</td><td class="num">${it.volumeCm3}</td><td class="num">${it.weightG}</td><td>${esc(it.risk)}</td><td class="num">${it.fee.toLocaleString()}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="small muted mt-8">${esc(d.note)} · 完整版工作台：stlquote（见 README 关联路径）</p>`;
    });
  }

  /* ---------- 日志页：加载 README ---------- */
  async function loadReadme() {
    const body = document.getElementById('readme-body');
    if (!body) return;
    try {
      const res = await fetch(PFX_PATHS.resolve('README.md'), { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const md = await res.text();
      body.innerHTML = PFXMarkdown.render(md);
    } catch (e) {
      body.innerHTML = PFXMarkdown.render(PFX_DATA.readmeFallback)
        + `<p class="small muted mt-12">（fetch README.md 失败：${esc(e.message)}。file:// 协议下静态读取受限，请用本地服务器打开。）</p>`;
    }
  }

  /* ---------- 全局：Toast / 快捷键 / 对话框 ---------- */
  function toast(msg, kind) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.innerHTML = `${icon(kind === 'ok' ? 'check_circle' : kind === 'err' ? 'error' : 'info')}<span>${esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3200);
    setTimeout(() => el.remove(), 3600);
  }

  function bindGlobal() {
    // 快捷键：⌘K / Ctrl+K 打开 AI 面板
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const dlg = document.getElementById('ai-dialog');
        dlg.open ? dlg.close() : openAi();
      }
      if (e.key === 'Escape') {
        const menu = document.querySelector('.user-menu');
        if (menu) menu.remove();
      }
    });

    const aiBtn = document.getElementById('ai-cmd-btn');
    aiBtn.addEventListener('click', openAi);

    const aiInput = document.getElementById('ai-input');
    aiInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && aiInput.value.trim()) {
        askAi(aiInput.value.trim());
        aiInput.value = '';
      }
    });
    document.getElementById('ai-body').addEventListener('click', e => {
      const chipBtn = e.target.closest('[data-ai-prompt]');
      if (chipBtn) askAi(chipBtn.dataset.aiPrompt);
    });

    // 对话框关闭按钮
    document.querySelectorAll('[data-close-dialog]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

    // 路由变化
    window.addEventListener('hashchange', navigate);

    // 飞书 OAuth 回调（#/collab?feishu=callback&code=…&state=…）
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    if (authSlot() && qs.get('feishu') === 'callback' && qs.get('code')) {
      const code = qs.get('code');
      const state = qs.get('state');
      Feishu.handleCallback(code, state).then(r => {
        if (r.ok) { toast(`飞书登录成功：${r.session.name}`, 'ok'); history.replaceState(null, '', '#/collab'); }
        else toast('飞书回调失败：' + r.error, 'err');
        navigate();
      });
    }
  }

  /* ---------- 启动 ---------- */
  function boot() {
    const modePill = document.getElementById('mode-pill');
    if (modePill) {
      modePill.textContent = PFX_CONFIG.dsh.mode === 'http' ? '已接网关' : '演示';
      modePill.dataset.mode = PFX_CONFIG.dsh.mode;
    }
    bindGlobal();
    navigate();
  }

  function icon(n) { return `<span class="ms">${n}</span>`; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
