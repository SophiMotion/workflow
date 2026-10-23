/* ==========================================================================
 * config.js — 环境与接口配置（唯一配置入口）
 * --------------------------------------------------------------------------
 * 本文件是控制台的“接线端子”：
 *   1. feishu  —— 飞书团队协作（登录、通讯录、任务、通知）
 *   2. dsh     —— DeepSeek Harness 能力（AI / 工作流 / 报价 / 自动化 / 知识库）
 *   3. meta    —— 面板元信息（名称、版本、演示数据口径）
 *
 * mode 说明：
 *   'mock'  ：前端内置演示数据，无需任何后端即可运行（默认，可对外静态部署）
 *   'http'  ：通过 fetch 调用真实后端（配合 server.py 或自有网关）
 *   'oauth' ：飞书真实 OAuth 2.0 网页授权（需要已创建的飞书企业自建应用）
 * ========================================================================== */
(function () {
  'use strict';

  // Resolve module links from this shared script, independent of the entry page.
  // 以公共脚本定位工作流目录，新旧入口共享同一套模块路径。
  const workflowRoot = new URL('../../', document.currentScript.src);
  const staticModules = {
    skatechassis: '底盘机器人/dist/index.html',
    hil: 'hil/hil.html',
    'sophicar-formate': 'sophicar-formate/web/dist/index.html',
    'drone-formation': 'drone-formation/index.html'
  };
  const hosted = /^https?:$/.test(workflowRoot.protocol)
    && !['localhost', '127.0.0.1', '[::1]'].includes(workflowRoot.hostname);
  window.PFX_PATHS = {
    moduleHref(id, localHref) {
      return hosted && staticModules[id] ? staticModules[id] : localHref;
    },
    resolve(relative) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\/)/i.test(relative)) return relative;
      return new URL(relative, workflowRoot).href;
    }
  };

  window.PFX_CONFIG = {
    workflowScope: document.body?.dataset.workflowScope || 'full',

    meta: {
      name: 'ProFabX · SophiCar 控制台',
      short: 'P·S 控制台',
      version: '0.1.0',
      // 演示数据口径声明：页面所有数字取自 bp.html 商业计划口径，接入后端后以 API 为准
      demoNotice: '页面数据为演示口径（bp.html 商业计划 + 各参考站点）',
      links: {
        bp: '/Users/wubo/Documents/2026-2/SophiCar/web/sophiv30808/0803/bp.html',
        profabxV1: 'https://profabx.com',
        profabxV2: 'https://2026-gamma-one.vercel.app/',
        sophicar: 'https://sophicar.com',
        kb: window.PFX_PATHS.resolve('online-vault/v2/v2.html'),
        quote3d: window.PFX_PATHS.resolve('stlquote/index.html')
      }
    },

    /* ----------------------------------------------------------------
     * 飞书（Feishu / Lark）团队协作
     * 登录模式：
     *   mock  —— 演示账号直接登录（默认，便于预览）
     *   oauth —— 跳转飞书 OAuth2 网页授权：
     *            1. 在飞书开放平台 open.feishu.cn 创建“企业自建应用”
     *            2. 配置重定向 URL（安全设置 → 重定向 URL）为 <site>/#/collab?feishu=callback
     *            3. 填入 appId，将 mode 改为 'oauth'
     *            4. 后端实现 POST /api/auth/feishu/callback 用 code 换取 user_access_token
     * ---------------------------------------------------------------- */
    feishu: {
      mode: 'mock',                       // 'mock' | 'oauth'
      appId: '',                          // 飞书应用 App ID（oauth 模式必填）
      redirectUri: '',                    // 留空则取当前站点 origin + /#/collab?feishu=callback
      scope: ['contact:user.base:readonly', 'im:message', 'docs:doc'],
      // 后端接口（http 模式使用，server.py 提供 mock 实现）
      endpoints: {
        callback:   '/api/auth/feishu/callback',   // POST { code, state } → session
        me:         '/api/feishu/users/me',        // GET  → 当前用户
        members:    '/api/feishu/team/members',    // GET  → 团队成员
        tasks:      '/api/feishu/team/tasks',      // GET  → 协作任务
        notify:     '/api/feishu/notify'           // POST { text } → 群机器人推送
      }
    },

    /* ----------------------------------------------------------------
     * DeepSeek Harness（DSH）能力接入
     * 面板通过统一网关调用 DSH 侧能力。DSH 侧建议实现方式：
     *   - 由 DSH Host 提供一个 HTTP/RPC 网关（或让 server.py 作为 DSH 的
     *     web 前端代理），将 /api/dsh/* 路由到 DSH 的模型 Tools / 工作流
     *   - 也可反向：DSH 会话直接读写本面板数据文件，实现人机共治
     * capabilities 与面板入口的映射见 README「DSH 接口预留」表。
     * ---------------------------------------------------------------- */
    dsh: {
      mode: 'mock',                        // 'mock' | 'http'
      apiBase: '/api/dsh',                 // 网关前缀（http 模式）
      token: '',                           // 可选 Bearer token，留空不发送
      timeoutMs: 20000,
      capabilities: {
        'ai.chat':          { label: 'AI 助手',   route: '#/overview',  entry: '全局 ⌘K 命令面板 / 总览命令条' },
        'workflow.run':     { label: '工作流',    route: '#/overview',  entry: '联动管线 / 团队协作看板联动' },
        'quote.generate':   { label: '3D 报价',   route: '#/profabx',   entry: 'ProFabX 报价工作台（承接 stlquote）' },
        'automation.trigger': { label: '自动化',  route: '#/collab',    entry: '飞书群机器人 / 审批 / 通知推送' },
        'kb.search':        { label: '知识库',    route: '#/overview',  entry: '知识库检索（承接 online-vault v2）' }
      },
      // 模拟延迟（毫秒），让演示更接近真实调用体验
      mockLatency: { min: 300, max: 900 }
    },

    /* ----------------------------------------------------------------
     * 演示账号（feishu.mode = 'mock' 时在登录对话框展示）
     * 角色取自 bp.html 团队口径；真实接入后由飞书通讯录提供
     * ---------------------------------------------------------------- */
    demoAccounts: [
      { id: 'wu-bo',    name: '吴波',   role: '商业与产品 · DRI',   color: 'av-blue',   feishu: '吴波（飞书演示身份）' },
      { id: 'tong-yishan', name: '佟怡姗', role: '项目与交付 · DRI', color: 'av-green', feishu: '佟怡姗（飞书演示身份）' },
      { id: 'clement',  name: 'Clement', role: '结构与工程化',       color: 'av-red',    feishu: 'Clement（飞书演示身份）' },
      { id: 'jin-bangming', name: '金邦明', role: '软件与集成 · ≈50%', color: 'av-yellow', feishu: '金邦明（飞书演示身份）' },
      { id: 'mu-shuaijie', name: '慕帅杰', role: '内部工作流 · ≈50%', color: 'av-purple', feishu: '慕帅杰（飞书演示身份）' }
    ]
  };
})();
