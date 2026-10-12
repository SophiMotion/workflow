/* ==========================================================================
 * feishu.js — 飞书登录与团队协作
 * --------------------------------------------------------------------------
 * 登录模式（feishu.mode）：
 *   mock  —— 演示账号直接建立本地会话（默认）
 *   oauth —— 跳转飞书 OAuth2 网页授权（open.feishu.cn），回调后经后端换 token
 *
 * 会话保存在 localStorage（键 pfx.session），刷新不丢失。
 * 协作数据（成员 / 任务）：
 *   mock：读本地演示数据（PFX_DATA）
 *   http：调 /api/feishu/... 后端接口（server.py 提供 mock 实现）
 * ========================================================================== */
(function () {
  'use strict';

  const SESSION_KEY = 'pfx.session';
  const CFG = () => window.PFX_CONFIG.feishu;

  /* ---------- 会话 ---------- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function isLoggedIn() { return !!getSession(); }

  /* ---------- 登录 ---------- */
  async function login(account) {
    const cfg = CFG();
    if (cfg.mode === 'oauth') {
      redirectToFeishu();
      return { ok: false, pending: true, message: '正在跳转飞书授权…' };
    }
    // mock：演示账号直接登录
    const acc = account || PFX_CONFIG.demoAccounts[0];
    const session = {
      openId: 'mock-' + acc.id,
      unionId: 'mock-union-' + acc.id,
      name: acc.name,
      role: acc.role,
      avatarColor: acc.color,
      feishuName: acc.feishu,
      tenant: 'ProFabX · SophiCar 团队',
      loginAt: Date.now(),
      mode: 'mock'
    };
    saveSession(session);
    return { ok: true, session };
  }

  function redirectToFeishu() {
    const cfg = CFG();
    const redirect = cfg.redirectUri || (location.origin + location.pathname + '#/collab?feishu=callback');
    const state = 'pfx-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('pfx.oauth.state', state);
    const url = 'https://open.feishu.cn/open-apis/authen/v1/index'
      + '?redirect_uri=' + encodeURIComponent(redirect)
      + '&app_id=' + encodeURIComponent(cfg.appId)
      + '&state=' + state;
    location.href = url;
  }

  /* OAuth 回调（真实接入：后端用 code 换取 token 后回填） */
  async function handleCallback(code, state) {
    const saved = localStorage.getItem('pfx.oauth.state');
    if (saved && state && saved !== state) return { ok: false, error: 'state 校验失败' };
    try {
      const res = await fetch(CFG().endpoints.callback, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      });
      if (!res.ok) throw new Error('回调接口返回 ' + res.status);
      const data = await res.json();
      saveSession({ ...data.session, mode: 'oauth', loginAt: Date.now() });
      return { ok: true, session: getSession() };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('pfx.oauth.state');
  }

  /* ---------- 协作数据 ---------- */
  async function teamMembers() {
    const s = getSession();
    if (!s) return [];
    if (CFG().mode === 'http') {
      try {
        const res = await fetch(CFG().endpoints.members);
        if (!res.ok) throw new Error(String(res.status));
        return await res.json();
      } catch (e) { /* 后端不可用时回退演示数据 */ }
    }
    return PFX_DATA.team;
  }

  async function teamTasks() {
    const s = getSession();
    if (!s) return [];
    if (CFG().mode === 'http') {
      try {
        const res = await fetch(CFG().endpoints.tasks);
        if (!res.ok) throw new Error(String(res.status));
        return await res.json();
      } catch (e) { /* 回退演示数据 */ }
    }
    return PFX_DATA.tasks;
  }

  /* 群机器人推送（自动化演示） */
  async function notifyGroup(text) {
    const s = getSession();
    if (!s) return { ok: false, error: '未登录' };
    if (CFG().mode === 'http') {
      try {
        const res = await fetch(CFG().endpoints.notify, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, openId: s.openId })
        });
        if (!res.ok) throw new Error(String(res.status));
        return { ok: true, data: await res.json() };
      } catch (e) { return { ok: false, error: String(e.message || e) }; }
    }
    // mock：本地记录一次推送
    const history = JSON.parse(localStorage.getItem('pfx.notify.history') || '[]');
    history.unshift({ text, at: Date.now(), by: s.name });
    localStorage.setItem('pfx.notify.history', JSON.stringify(history.slice(0, 20)));
    return { ok: true, data: { status: 'ok', channel: '飞书群机器人（演示）' } };
  }

  function notifyHistory() {
    try { return JSON.parse(localStorage.getItem('pfx.notify.history') || '[]'); }
    catch (e) { return []; }
  }

  window.Feishu = {
    login, logout, handleCallback, getSession, isLoggedIn,
    teamMembers, teamTasks, notifyGroup, notifyHistory,
    config: CFG
  };
})();
