/* ==========================================================================
 * dsh.js — DeepSeek Harness（DSH）能力接口层
 * --------------------------------------------------------------------------
 * 面板所有“AI / 工作流 / 报价 / 自动化 / 知识库”需求统一经 DSH.call 发出。
 * 两种模式（由 js/config.js 的 dsh.mode 决定）：
 *   mock —— 前端内置演示实现，返回模拟数据（默认，无需后端）
 *   http —— fetch 调用网关 <apiBase>/<capability 路径>，POST JSON，可带 Bearer
 *
 * 接入 DSH 时只需实现网关路由（见 server.py 的 /api/dsh/* 与 README），
 * 页面业务代码零改动。
 * ========================================================================== */
(function () {
  'use strict';

  const CFG = () => window.PFX_CONFIG.dsh;

  /* 统一调用入口
   * capability ∈ 'ai.chat' | 'workflow.run' | 'quote.generate'
   *             | 'automation.trigger' | 'kb.search'
   * payload    —— 能力相关参数
   * 返回 { ok, mode, capability, data, error? }
   */
  async function call(capability, payload, opts) {
    const cfg = CFG();
    const known = ['ai.chat', 'workflow.run', 'quote.generate', 'automation.trigger', 'kb.search'];
    if (!known.includes(capability)) {
      return { ok: false, mode: cfg.mode, capability, error: '未知能力：' + capability };
    }
    try {
      const data = cfg.mode === 'http'
        ? await callHttp(cfg, capability, payload, opts)
        : await callMock(cfg, capability, payload, opts);
      return { ok: true, mode: cfg.mode, capability, data };
    } catch (err) {
      return { ok: false, mode: cfg.mode, capability, error: String(err && err.message || err) };
    }
  }

  /* ---------- http 模式：POST /api/dsh/<capability> ---------- */
  async function callHttp(cfg, capability, payload, opts) {
    const path = capability.replace(/\./g, '/');
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), (opts && opts.timeoutMs) || cfg.timeoutMs || 20000);
    try {
      const res = await fetch(`${cfg.apiBase}/${path}`, {
        method: 'POST', headers, body: JSON.stringify(payload || {}), signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`网关返回 ${res.status}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  /* ---------- mock 模式：内置演示实现 ---------- */
  async function callMock(cfg, capability, payload, opts) {
    await latency(cfg, opts);
    const p = payload || {};
    switch (capability) {
      case 'ai.chat':         return mockAiChat(p);
      case 'workflow.run':    return mockWorkflow(p);
      case 'quote.generate':  return mockQuote(p);
      case 'automation.trigger': return mockAutomation(p);
      case 'kb.search':       return mockKbSearch(p);
    }
  }

  function latency(cfg, opts) {
    const lo = (opts && opts.latencyMin) ?? cfg.mockLatency.min;
    const hi = (opts && opts.latencyMax) ?? cfg.mockLatency.max;
    const ms = lo + Math.random() * (hi - lo);
    return new Promise(r => setTimeout(r, ms));
  }

  /* --- 演示实现细节 --- */

  function mockAiChat(p) {
    const q = String(p.query || '');
    const text = q.includes('报价') || q.includes('估价')
      ? answerQuote(q)
      : q.includes('漏斗') || q.includes('客户') || q.includes('访谈')
        ? answerFunnel()
        : q.includes('知识库') || q.includes('资料') || q.includes('Fab')
          ? answerKb()
          : answerDefault(q);
    return {
      answer: text,
      sources: [
        { kind: '知识库', title: 'bp.html · 商业计划（解决方案 / 进展证据）', score: 0.92 },
        { kind: '联动数据', title: '控制台演示数据 · KPI 与管线', score: 0.87 },
        { kind: '能力', title: 'stlquote 报价工作台（工艺价目演示）', score: 0.74 }
      ],
      actions: [
        { label: '查看客户漏斗', route: '#/sophimotion' },
        { label: '打开 3D 报价台', route: '#/profabx' }
      ],
      mock: true
    };
  }

  function answerDefault(q) {
    return `【演示模式 · DSH 接口预留】\n\n收到问题：「${q}」\n\n当前三块业务联动状态：\n\n1. SophiGo 教育 —— 需求雷达运行中，课程线索持续进入漏斗（60 个具名目标账户口径）。\n2. ProFabX 工程 —— 3D 报价工作台与打样工艺就绪，承接原型验证。\n3. SophiMotion 实验室 —— 主攻第二独立付费学校客户首付款（当前唯一关键指标）。\n\n接入 DeepSeek Harness 后，这里将由 DSH 模型工具结合知识库实时回答，并可直接触发工作流与报价。`;
  }
  function answerQuote() {
    return `【演示模式 · 快速估价】\n\n以「底盘场景实验室套件」为例（ABS / SLA + CNC + 打磨）：\n\n- 主体件 3 件：约 380 cm³ · SLA · ¥2,280\n- 结构件 2 件：约 1,150 g · CNC 铝合金 · ¥1,950\n- 装配与后处理：¥1,100\n- 风险预留（壁厚风险 2 项）：¥640\n\n预估合计：¥5,970（演示口径）。\n\n接入 DSH 后可直接调用 quote.generate 完成正式报价单，并推送飞书群。`;
  }
  function answerFunnel() {
    return `【演示模式 · 客户漏斗】\n\n当前漏斗口径（目标）：60 个具名目标账户 → 15+ 预算相关访谈 → 5+ 合格机会 → 3+ 正式报价 → 1 第二客户合同 + 定金。\n\n唯一关键指标：第二个独立付费学校客户的首付款。课程人数、合作协议与比赛奖项不计入客户口径。`;
  }
  function answerKb() {
    return `【演示模式 · 知识库检索】\n\n知识库（online-vault v2 口径）命中 3 条：\n\n1. Fab Academy 课程体系本土化资料（NexMaker Academy）\n2. 数字制造工艺手册：SLA / LCD / FDM / MJF / SLM / CNC / 硅胶复模\n3. 汽车场景实验室：滑板底盘与智能座舱项目纪要\n\n接入 DSH 后由知识库服务实时检索并带来源引用。`;
  }

  function mockWorkflow(p) {
    const wf = String(p.workflowId || p.workflow || 'linkage-pipeline');
    const steps = [
      { id: 's1', name: '需求雷达扫描（SophiGo）', status: 'done', owner: 'SophiGo' },
      { id: 's2', name: '原型与报价（ProFabX）', status: 'done', owner: 'ProFabX' },
      { id: 's3', name: '冻结与定价（SophiStudio）', status: 'running', owner: 'SophiStudio' },
      { id: 's4', name: '交付与验收（SophiMotion）', status: 'pending', owner: 'SophiMotion' },
      { id: 's5', name: '场景复制（伙伴）', status: 'pending', owner: '场景伙伴' },
      { id: 's6', name: '资产回流（DSH KB）', status: 'pending', owner: 'DSH' }
    ];
    return {
      runId: 'run-' + Date.now().toString(36),
      workflowId: wf,
      status: 'running',
      input: p.input || {},
      steps,
      note: '演示实现。接入 DSH 后由工作流编排服务真实执行。'
    };
  }

  function mockQuote(p) {
    const files = p.files || [{ name: 'chassis-body.stl', format: 'STL' }, { name: 'bracket.stp', format: 'STEP' }];
    const process = p.process || 'SLA';
    const items = files.map((f, i) => ({
      file: f.name, format: f.format,
      volumeCm3: +(2.4 + i * 1.1).toFixed(1),
      weightG: +(1.2 + i * 0.8).toFixed(1),
      process, finish: p.finish || '打磨',
      risk: i === 0 ? '壁厚风险：1 项' : '无',
      fee: +(380 + i * 240).toFixed(0)
    }));
    const total = items.reduce((s, it) => s + Number(it.fee), 0);
    return {
      quoteId: 'Q-2026-' + String(Date.now()).slice(-4),
      material: p.material || 'ABS-like',
      density: p.density || 1.12,
      items, total, currency: 'CNY',
      note: '演示报价：按体积、密度与工艺估算。接入 DSH 后调用正式报价服务并支持导出 Excel。'
    };
  }

  function mockAutomation(p) {
    const trigger = String(p.trigger || 'kanban-advance');
    return {
      jobId: 'job-' + Date.now().toString(36),
      trigger,
      channel: '飞书群机器人（演示）',
      message: p.payload && p.payload.text
        ? `已推送到团队群：「${p.payload.text}」`
        : '已模拟触发：看板任务推进通知',
      status: 'ok'
    };
  }

  function mockKbSearch(p) {
    const q = String(p.query || '');
    return {
      query: q,
      hits: [
        { title: '商业计划 · 解决方案（bp.html）', kind: '资料', score: 0.93, snippet: '教育发现问题，核心产品完成交付，场景伙伴负责复制。' },
        { title: '数字制造工艺手册（ProFabX v1）', kind: '课程', score: 0.86, snippet: 'SLA / LCD / FDM / MJF / SLM、CNC、硅胶复膜、钣金加工及后处理。' },
        { title: '3D 报价工作台使用说明（stlquote）', kind: '工具', score: 0.71, snippet: '多格式导入、装配关系编辑、壁厚风险与报价分析一体化工作台。' }
      ],
      mock: true
    };
  }

  /* 能力状态（供 UI 展示） */
  function statusOf() {
    const cfg = CFG();
    return Object.keys(cfg.capabilities).map(key => ({
      cap: key,
      label: cfg.capabilities[key].label,
      mode: cfg.mode,
      available: true,
      entry: cfg.capabilities[key].entry
    }));
  }

  window.DSH = { call, statusOf, config: CFG };
})();
