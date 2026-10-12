/* 本地控制台：all sync state comes from the local service, never mock success. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const base = location.protocol === 'file:' ? 'http://127.0.0.1:8769' : location.origin;
  const labels = { added:'已新增', updated:'已更新', unchanged:'已同步', local:'本地修改', conflict:'待处理冲突', missing:'云端不可见', error:'下载失败', warning:'导出提示' };
  let state = null, documents = [], history = [], draftSpaces = [], spaceChecks = [], activeDiff = null;
  let nonce = '', busy = false, refreshing = false, lastData = 0, toastTimer;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const date = (value) => value ? new Date(value * 1000).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '尚未同步';

  async function api(path, body, binary = false) {
    const response = await fetch(base + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'X-Feishu-Client':'sophistudio', ...(location.protocol === 'file:' ? { 'X-Feishu-Local-Key':window.SOPHI_FEISHU_LOCAL_KEY || '' } : {}), ...(body === undefined ? {} : { 'Content-Type':'application/json', 'X-Feishu-Nonce':nonce }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(body === undefined ? 12000 : 180000),
    });
    if (response.ok && binary) return response.blob();
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '本地服务请求失败');
    return result;
  }

  function localConnection() {
    if (location.protocol !== 'file:') return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = new URL('local-connection.js?v=' + Date.now(), location.href).href;
      script.onload = script.onerror = () => { script.remove(); resolve(); };
      document.head.append(script);
    });
  }

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500);
  }

  function message(text, error = false) {
    $('settings-message').textContent = text;
    $('settings-message').classList.toggle('error', error);
  }

  function renderStatus() {
    const connected = !!state;
    $('connection-status').className = 'connection-pill ' + (connected ? 'connected' : 'disconnected');
    $('connection-status').innerHTML = '<i></i>' + (connected ? '本地服务已连接' : '本地服务未连接');
    $('offline-banner').hidden = connected;
    $('initialize').disabled = !connected || busy || state.running;
    $('automation').disabled = !connected || busy;
    $('sync-now').disabled = !connected || busy || state.running || !state.initialized;
    window.SophiKnowledge?.setState(state);
    if (!state) return;
    $('stat-documents').textContent = state.counts.documents;
    $('stat-spaces').textContent = state.counts.spaces;
    $('stat-conflicts').textContent = state.counts.conflicts;
    $('stat-conflicts').style.color = state.counts.conflicts ? '#b7862a' : '';
    $('stat-last').textContent = date(state.last_run);
    $('output-path').textContent = state.output;
    $('scope-label').textContent = (state.settings.all_spaces ? '全部可访问的知识库' : state.settings.spaces.length + ' 个指定知识库') + ' · Markdown 格式';
    $('automation').classList.toggle('active', state.settings.automation);
    $('automation').querySelector('span').textContent = state.settings.automation ? '暂停自动化' : '自动化';
    $('automation').setAttribute('aria-pressed', String(state.settings.automation));
    $('automation-hint').textContent = state.settings.automation ? `每 ${state.settings.interval / 60} 分钟检查 · ${state.running ? '正在同步' : '下次 ' + date(state.next_run)}` : '初始化完成后，开启自动化持续同步';
    if (!state.configured) $('automation-hint').textContent = '尚未配置飞书应用，点击初始化可完成配置';
    const progress = state.progress;
    $('progress-area').hidden = !state.running && !['error','attention'].includes(progress.phase);
    $('progress-bar').style.width = progress.total ? `${Math.round(progress.current / progress.total * 100)}%` : (state.running ? '15%' : '100%');
    $('progress-message').textContent = state.running ? `${progress.message}${progress.total ? ` · ${progress.current} / ${progress.total}` : ''}` : (progress.phase === 'error' ? (progress.message === '本轮同步结束' ? '部分内容同步失败，请查看同步记录中的具体原因。' : progress.message) : '本轮有冲突、云端不可见或导出提示，请查看文档与同步记录。');
  }

  function renderDocuments() {
    const search = $('search').value.trim().toLowerCase();
    const filter = $('status-filter').value;
    const rows = documents.filter((doc) => `${doc.title} ${doc.space_name} ${doc.path || ''}`.toLowerCase().includes(search)
      && (filter === 'all' || (filter === 'warning' ? doc.warnings?.length : doc.status === filter)));
    $('empty-state').hidden = documents.length > 0 || search !== '' || filter !== 'all';
    $('document-list').innerHTML = rows.slice(0, 300).map((doc) => {
      const status = doc.warnings?.length && !['error','conflict','missing','local'].includes(doc.status) ? 'warning' : doc.status;
      const warning = doc.error || doc.warnings?.join('；') || (doc.status === 'missing' ? '未删除本地文件；可能为云端删除或权限变化。' : '');
      return `<div class="document-row"><div><button type="button" class="document-title read-title" data-read="${esc(doc.key)}" ${!doc.base || !doc.path ? 'disabled' : ''}>${esc(doc.title)} <span aria-hidden="true">↗</span></button><p class="document-meta">${esc(doc.space_name)} · ${esc(doc.type || 'doc')} ${doc.path ? ' · ' + esc(doc.path) : ''}</p>${warning ? `<p class="document-error">${esc(warning)}</p>` : ''}</div><span class="status-tag ${esc(status)}">${esc(labels[status] || status)}</span><button class="button text-button" data-diff="${esc(doc.key)}" ${!doc.base && doc.status !== 'conflict' ? 'disabled' : ''}>${doc.status === 'conflict' ? '处理冲突' : '查看差异'}</button></div>`;
    }).join('');
    if (!rows.length && $('empty-state').hidden) $('document-list').innerHTML = '<p class="history-empty">没有符合筛选条件的文档</p>';
    $('list-footer').textContent = documents.length ? `共 ${documents.length} 个文档条目 · 筛选 ${rows.length} 个${rows.length > 300 ? ' · 当前显示前 300 个，请缩小搜索范围' : ''}` : '本地内容会在首次同步后显示';
  }

  function renderHistory() {
    $('history-list').innerHTML = history.length ? history.map((run) => `<article class="history-item"><header><b>${date(run.started_at)}</b><span class="status-tag ${run.status === 'success' ? '' : 'warning'}">${({ success:'同步完成', attention:'需要关注', error:'有内容失败' })[run.status] || run.status}</span></header><p>${Object.entries(run.counts).filter(([,n]) => n).map(([key,n]) => esc(labels[key]) + ' ' + n).join(' · ') || '没有内容变化'} · ${Math.max(1,Math.round(run.finished_at - run.started_at))} 秒</p><details><summary>查看本轮明细</summary><ul>${run.changes.slice(0, 300).map((change) => `<li>${esc(labels[change.event])} · ${esc(change.title || '连接/扫描')}${change.message ? ' — ' + esc(change.message) : ''}</li>`).join('')}</ul>${run.changes.length > 300 ? '<p>页面展示前 300 条；完整记录保存在本机 .state/history.json。</p>' : ''}</details></article>`).join('') : '<p class="history-empty">还没有同步记录。初始化后，这里会记录每一轮变化。</p>';
  }

  async function refresh(force = false) {
    if (refreshing) return;
    refreshing = true;
    try {
      if (!state) await localConnection();
      const next = await api('status');
      if (next.service !== 'sophistudio-feishu') throw new Error('连接到的服务不是飞书同步服务');
      nonce = next.nonce;
      const changed = !state || next.last_run !== state.last_run || next.running !== state.running;
      state = next;
      renderStatus();
      if (force || changed || Date.now() - lastData > 15000) {
        const results = await Promise.all([api('documents'), api('history')]);
        documents = results[0].documents;
        history = results[1].history;
        lastData = Date.now();
        renderDocuments(); renderHistory();
      }
    } catch (error) {
      state = null; nonce = '';
      renderStatus();
    } finally { refreshing = false; }
  }

  function openSettings() {
    draftSpaces = structuredClone(state?.settings.spaces || []);
    spaceChecks = state?.connection?.checks || [];
    $('all-spaces').checked = state?.settings.all_spaces ?? true;
    $('interval').value = state?.settings.interval || 300;
    $('app-id').value = state?.app_id || '';
    $('app-secret').value = '';
    $('space-input').value = '';
    $('space-name').value = '';
    $('credential-hint').textContent = state?.configured ? '已从本机后端读取应用凭据。密钥不回显；填写新值后才会替换。' : '使用企业自建应用的 App ID 和 App Secret。密钥仅存于本机后端。';
    message(state ? '' : '请先启动本地服务，再保存配置。', !state);
    renderSpaces();
    $('settings-dialog').showModal();
  }

  function renderSpaces() {
    $('space-count').textContent = `已添加 ${draftSpaces.length} 个知识库 ID`;
    $('scope-help').textContent = $('all-spaces').checked ? '当前为全部同步：ID 列表不限制同步范围。若只同步列表中的知识库，请取消勾选。' : (draftSpaces.length ? '当前仅同步 ID 列表中的知识库。' : 'ID 列表为空：保存后将暂停自动化，添加 ID 后可重新开启。');
    $('configured-spaces').innerHTML = draftSpaces.length ? draftSpaces.map((space, index) => {
      const check = spaceChecks.find((item) => item.space_id === space.space_id);
      const status = check ? `<p class="space-check ${check.ok ? 'passed' : 'failed'}">${esc(check.message)}</p>${check.error ? `<details class="space-check failed"><summary>查看接口返回原因</summary>${esc(check.error)}</details>` : ''}` : '';
      return `<div class="configured-space"><div><b>${esc(space.name || '未命名知识库')}</b><code>ID: ${esc(space.space_id)}</code>${status}</div><button type="button" data-remove-space="${index}" aria-label="删除知识库 ID ${esc(space.space_id)}">删除</button></div>`;
    }).join('') : '<p class="space-list-empty">尚未添加知识库 ID，请在上方输入后点击“添加 ID”。</p>';
  }

  function showChecks(result) {
    spaceChecks = result.checks || [];
    renderSpaces();
    message(result.message, result.needs_attention);
  }

  function addSpaces(spaces) {
    for (const space of spaces) if (!draftSpaces.some((s) => s.space_id === String(space.space_id))) draftSpaces.push({ space_id:String(space.space_id), name:space.name || String(space.space_id) });
    renderSpaces();
  }

  async function saveConfig() {
    if (!state) throw new Error('请先启动本地服务');
    const config = { spaces:draftSpaces, all_spaces:$('all-spaces').checked, interval:Number($('interval').value) };
    if ($('app-secret').value.trim()) { config.app_id = $('app-id').value.trim(); config.app_secret = $('app-secret').value.trim(); }
    else if ($('app-id').value.trim() !== state.app_id) throw new Error('修改 App ID 时也需要填写对应的 App Secret');
    await api('config', config);
    spaceChecks = []; renderSpaces();
    $('app-secret').value = '';
    await refresh(true);
    message('配置已保存。');
  }

  async function act(fn, settings = false) {
    if (busy) return;
    busy = true;
    renderStatus();
    const controls = [...document.querySelectorAll('#settings-form button')];
    controls.forEach((el) => { el.disabled = true; });
    try { await fn(); }
    catch (error) { if (settings) message(error.message, true); else toast(error.message); }
    finally { busy = false; controls.forEach((el) => { el.disabled = false; }); renderStatus(); }
  }

  $('settings-open').onclick = $('empty-configure').onclick = openSettings;
  document.querySelectorAll('[data-close]').forEach((button) => { button.onclick = () => $(button.dataset.close).close(); });
  $('reconnect').onclick = () => refresh(true);
  $('settings-form').onsubmit = (event) => { event.preventDefault(); act(saveConfig, true); };
  $('check-connection').onclick = () => act(async () => {
    await saveConfig(); message('正在检查飞书连接…');
    const result = await api('check', {});
    showChecks(result);
    await refresh(true);
  }, true);
  $('discover-spaces').onclick = () => act(async () => {
    if ($('app-secret').value) throw new Error('请先保存新的应用凭据，再发现知识库');
    message('正在发现知识库…');
    const result = await api('check', {});
    addSpaces(result.spaces);
    showChecks(result);
    if (result.spaces.length) message(result.message + '\n发现的知识库已添加到列表，请保存配置。', result.needs_attention);
  }, true);
  $('add-space').onclick = () => act(async () => {
    const value = $('space-input').value.trim();
    const name = $('space-name').value.trim();
    if (!value) throw new Error('请填写知识库 ID 或链接');
    let space;
    if (/^\d{1,30}$/.test(value)) space = { space_id:value, name:name || '知识库 ' + value };
    else {
      message('正在解析链接…');
      const result = await api('resolve-space', { value });
      space = { ...result.space, name:name || result.space.name };
    }
    if (draftSpaces.some((item) => item.space_id === String(space.space_id))) throw new Error('该知识库 ID 已在列表中，无需重复添加。');
    addSpaces([space]);
    $('space-input').value = '';
    $('space-name').value = '';
    message('知识库 ID 已添加，请点击“保存配置”生效。');
  }, true);
  $('space-input').onkeydown = $('space-name').onkeydown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); $('add-space').click(); }
  };
  $('all-spaces').onchange = renderSpaces;
  $('configured-spaces').onclick = (event) => {
    const button = event.target.closest('[data-remove-space]');
    if (button && !busy) { draftSpaces.splice(Number(button.dataset.removeSpace), 1); renderSpaces(); message('知识库 ID 已从列表删除，请点击“保存配置”生效。'); }
  };
  $('initialize').onclick = () => {
    if (!state?.configured) return openSettings();
    act(async () => { await api('initialize', {}); toast('初始化下载已开始，现有文件会先比较版本。'); await refresh(true); });
  };
  $('sync-now').onclick = () => act(async () => { await api('sync', {}); toast('正在检查飞书更新…'); await refresh(true); });
  $('automation').onclick = () => act(async () => {
    if (!state?.initialized) throw new Error('请先完成初始化下载，再开启自动化。');
    const result = await api('automation', { enabled:!state.settings.automation });
    toast(result.automation ? '自动化已开启，关闭页面后仍会继续同步。' : '自动化已暂停；正在执行的一轮会正常完成。');
    await refresh(true);
  });
  $('copy-path').onclick = async () => {
    try { await navigator.clipboard.writeText(state?.output || $('output-path').textContent); toast('本地目录路径已复制'); }
    catch { toast('浏览器限制剪贴板访问，请选中右侧路径手动复制。'); }
  };
  $('search').oninput = $('status-filter').onchange = renderDocuments;
  const tabs = ['documents','history'];
  for (const tab of tabs) {
    $('tab-' + tab).onclick = () => {
      for (const item of tabs) { $('tab-' + item).setAttribute('aria-selected', String(item === tab)); $(item + '-panel').hidden = item !== tab; }
    };
    $('tab-' + tab).onkeydown = (event) => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); const other = tabs.find((item) => item !== tab); $('tab-' + other).click(); $('tab-' + other).focus(); } };
  }
  $('document-list').onclick = (event) => {
    const read = event.target.closest('[data-read]');
    if (read) return window.SophiKnowledge?.openDocument(read.dataset.read);
    const button = event.target.closest('[data-diff]');
    if (!button) return;
    act(async () => {
      activeDiff = await api('diff?key=' + encodeURIComponent(button.dataset.diff));
      $('diff-title').textContent = activeDiff.title;
      $('diff-description').textContent = activeDiff.status === 'conflict' ? '比较当前本地文件与待合入的飞书版本。保留本地不会上传至飞书。' : (activeDiff.status === 'local' ? '比较本地编辑与飞书基线。' : '比较上次版本与当前飞书版本。');
      $('diff-content').replaceChildren();
      const content = activeDiff.diff || '两个版本内容一致。';
      for (const line of content.split('\n')) { const span = document.createElement('span'); span.textContent = line + '\n'; if (line.startsWith('+')) span.className = 'diff-add'; if (line.startsWith('-')) span.className = 'diff-remove'; $('diff-content').append(span); }
      $('conflict-actions').hidden = activeDiff.status !== 'conflict';
      $('diff-dialog').showModal();
    });
  };
  const resolve = (strategy) => act(async () => {
    await api('resolve', { key:activeDiff.key, strategy, local_hash:activeDiff.local_hash });
    $('diff-dialog').close(); toast(strategy === 'remote' ? '已采用飞书版本，本地旧版本已备份。' : '已保留本地版本，后续飞书有新变化时再比较。'); await refresh(true);
  });
  $('keep-local').onclick = () => resolve('local');
  $('use-remote').onclick = () => resolve('remote');
  window.SophiFeishu = { api, refresh, toast };
  renderDocuments(); renderHistory(); refresh(true);
  setInterval(() => refresh(), 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
})();
