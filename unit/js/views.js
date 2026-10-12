/* ==========================================================================
 * views.js — 六个视图的渲染函数（返回 HTML 字符串）
 * 事件绑定统一由 app.js 在渲染后处理（事件委托 + data-* 钩子）
 * ========================================================================== */
(function () {
  'use strict';

  const D = () => window.PFX_DATA;

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function icon(name, cls) {
    return `<span class="ms${cls ? ' ' + cls : ''}">${name}</span>`;
  }
  function chip(text, tone) { return `<span class="chip chip-${tone || 'gray'}">${esc(text)}</span>`; }
  function avatar(name, color, lg) {
    const c = (name || '?').trim().charAt(0);
    return `<span class="avatar ${color || 'av-blue'}${lg ? ' lg' : ''}">${esc(c)}</span>`;
  }
  function ownerTag(owner) {
    const map = {
      'SophiGo': 'owner-go', 'ProFabX': 'owner-pfx', 'SophiMotion': 'owner-sm',
      '场景伙伴': 'owner-ext', 'SophiStudio': 'owner-studio', 'DSH': 'owner-pfx'
    };
    return `<span class="tag-owner ${map[owner] || 'owner-studio'}">${esc(owner)}</span>`;
  }
  function moduleHead(eyebrow, title, tagline, tone, iconName) {
    return `<div class="card card-pad hero" style="margin-bottom:16px">
      <div class="hero-eyebrow">${chip(eyebrow, 'outline')}${chip(tone, tone)}</div>
      <div class="flex" style="gap:14px">
        <div class="mc-ico ${tone}" style="border-radius:16px">${icon(iconName, 'ms-fill')}</div>
        <div>
          <h1>${esc(title)}</h1>
          <p class="hero-sub" style="margin-top:2px"><b>${esc(tagline)}</b></p>
        </div>
      </div>
    </div>`;
  }

  /* ========================================================================
   * 视图 1 — 总览
   * ====================================================================== */
  function renderOverview() {
    const kpis = D().kpis.map(k => `
      <div class="card kpi${k.tone === 'blue' ? ' kpi-accent' : ''}">
        <div class="k">${icon(k.icon)}${esc(k.label)}${chip(k.status, k.status === '已验证' ? 'green' : 'blue')}</div>
        <div class="v ${k.tone}">${esc(k.value)}<small>${esc(k.unit)}</small></div>
        <div class="n">${esc(k.note)}</div>
      </div>`).join('');

    return `
    <section class="card overview-architecture" aria-label="SophiStudio 业务与产品架构">
      <div class="overview-architecture-scroll">
        <img src="assets/sophistudio-overview-architecture.png" alt="SophiStudio 业务与产品架构：场景应用、SophiMotion 核心产品、SophiGo 科教探索、ProFabX 与内部工作流" width="3464" height="2310" fetchpriority="high">
      </div>
    </section>

    <section class="overview-school" aria-labelledby="overview-school-title">
      <div class="section-head">
        <h2 id="overview-school-title">高校课程与毕业设计</h2>
        <span class="sub">课程实践 · 毕业课题 · 校园场景</span>
      </div>
      <a class="card overview-school-card" data-project="zwu2026" href="../school/zwu2026.html" aria-label="未来校园毕业设计案例，查看十二个可选主题">
        <div class="overview-school-image">
          <img src="../school/zju2026-assets/campus-mobility-background.png" alt="校园移动服务场景，连接软件界面、移动原型与互动展示" width="1774" height="887" loading="lazy">
        </div>
        <div class="overview-school-copy">
          <div class="overview-school-meta">${chip('跨学科毕业设计', 'blue')}${chip('12 个可选主题', 'green')}${chip('沟通稿', 'outline')}</div>
          <h3>未来校园移动服务的交互与场景设计</h3>
          <p>面向各高校的毕业设计案例，从 12 个主题中组合六人课题，连接软件交互、实体原型与校园场景。</p>
          <p class="overview-school-directions">软件交互 6 题 · 实体与空间 6 题 · 按需组合</p>
          <span class="overview-school-action">查看毕业设计方案 <span aria-hidden="true">→</span></span>
        </div>
      </a>
      <a class="card overview-school-card" data-project="zju2026" href="../school/zju2026.html" aria-label="未来校园移动体设计，查看课程详情">
        <div class="overview-school-image">
          <img src="../school/zju2026-assets/campus-mobility-background.png" alt="未来校园缩比模型，包含交通工具、服务机器人与剖面建筑" width="1774" height="887" loading="lazy">
        </div>
        <div class="overview-school-copy">
          <div class="overview-school-meta">${chip('设计工程学', 'blue')}${chip('跨学科项目', 'green')}${chip('2026 秋季', 'outline')}</div>
          <h3>未来校园移动体设计</h3>
          <p>从校园场景研究出发，结合参数化设计、数字制造与交互硬件，完成可验证的缩比原型。</p>
          <p class="overview-school-directions">日常出行 · 校园运输 · 场景机器人</p>
          <span class="overview-school-action">查看课程详情 <span aria-hidden="true">→</span></span>
        </div>
      </a>
    </section>

    <section class="card card-pad hero">
      <div class="hero-eyebrow">
        ${chip('三模块联动', 'blue')}${chip('外部公开', 'green')}${chip('飞书团队协作 · 接口预留', 'outline')}${chip('DSH 能力底座 · 接口预留', 'outline')}
      </div>
      <h1>SophiGo 教育 × ProFabX 工程模型 × SophiMotion 汽车场景实验室</h1>
      <p class="hero-sub">教育发现问题，核心产品完成交付，场景伙伴负责复制 —— 一个控制台看全三块业务的联动闭环、客户漏斗与工程资产。</p>
      <div class="cmdbar" id="cmdbar" role="button" tabindex="0" aria-label="打开 AI 命令面板">
        <span class="ms">auto_awesome</span>
        <span class="ph">问控制台任何问题，例如：三块业务的联动状态如何？</span>
        <kbd>⌘K</kbd>
        <button class="go" type="button">问 AI</button>
      </div>
    </section>

    <div class="grid grid-4 mt-16">${kpis}</div>

    <div class="section-head">
      <h2>业务联动环</h2>
      <span class="sub">点击模块进入对应面板 · 箭头为业务流</span>
    </div>
    <div class="card">${loopSvg()}</div>

    <div class="section-head">
      <h2>联动管线</h2>
      <span class="sub">六步闭环 · 每一步都有明确归属</span>
    </div>
    <div class="card">${pipelineHtml()}</div>

    <div class="section-head">
      <h2>DSH 能力底座</h2>
      <span class="sub">AI · 工作流 · 报价 · 自动化 · 知识库 —— 统一经 <code>DSH.call()</code> 调用</span>
      <span class="spacer"></span>
      <a href="#/log" class="btn btn-outline btn-sm">接口清单</a>
    </div>
    <div class="grid grid-3">
      ${D().dshCards.map(c => `
      <div class="card iface-card">
        <div class="if-head">
          <div class="if-ico">${icon(c.icon)}</div>
          ${chip('演示模式', 'blue')}
        </div>
        <h3 class="mt-12" style="font-size:16px">${esc(c.title)}</h3>
        <p class="card-desc">${esc(c.desc)}</p>
        <code>DSH.call('${c.cap}', …)</code>
        <div class="card-foot">
          <button class="btn btn-tonal btn-sm" data-dsh-demo="${c.cap}" data-route="${c.route}">${esc(c.action)}</button>
        </div>
      </div>`).join('')}
    </div>

    <div class="section-head">
      <h2>最近动态</h2>
      <span class="sub">由 DSH 能力触发（演示记录）</span>
    </div>
    <div class="card">
      <div class="feed">
        ${D().activities.map(a => `
        <div class="feed-item">
          <div class="fi-ico">${icon(a.icon)}</div>
          <div class="fi-main">
            <div class="fi-t">${esc(a.title)}</div>
            <div class="fi-d">${esc(a.desc)}</div>
          </div>
          <div class="fi-time">${esc(a.time)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  /* ========================================================================
   * 视图 2 — SophiStudio 工作流
   * ====================================================================== */
  function renderWorkflow() {
    const engineeringOnly = window.PFX_CONFIG?.workflowScope === 'engineering';
    const projectCard = (id, title, description, href, icon, status, branch = false) => {
      href = window.PFX_PATHS?.moduleHref(id, href) || href;
      if (engineeringOnly) {
        const content = `
          <h3>${title}</h3>
          <img class="workflow-project-image" src="assets/workflow-previews/${id}.jpg" alt="${title}项目界面截图" width="1280" height="720" loading="lazy" decoding="async">
          <p>${description}</p>`;
        if (id === 'sophirobot') return `
          <article class="workflow-card workflow-project-card">
            <a class="workflow-project-main" data-module="${id}" data-status="ready" href="${href}">${content}</a>
            <a class="workflow-related-link" href="https://sophimotion.github.io/workflow/%E5%BA%95%E7%9B%98%E6%9C%BA%E5%99%A8%E4%BA%BA/dist/index.html">打开 SkateChassis 机器人工作台<span aria-hidden="true">→</span></a>
          </article>`;
        return `<a class="workflow-card workflow-project-card" data-module="${id}" data-status="ready" href="${href}">${content}</a>`;
      }
      return `
        <a class="workflow-card${branch ? ' workflow-branch' : ''}" data-module="${id}" data-status="ready" href="${href}">
          <div class="wf-icon"><span class="ms">${icon}</span></div>
          <div class="wf-copy"><h3>${title}</h3><p>${description}</p><small>${status}</small></div>
        </a>`;
    };
    return `
    <section class="workflow-intro">
      <div>
        <h1>SophiStudio 工作流</h1>
        <p>${engineeringOnly ? '' : '从知识沉淀、工程研发、工程加工到内容体验，'}统一管理 SophiMotion 及相关项目的本地工具链。</p>
      </div>
      <div class="workflow-count">${engineeringOnly ? '<strong>11</strong><span>/ 11 模块可用</span>' : '<strong>19</strong><span>/ 22 模块可用</span>'}</div>
    </section>

    ${engineeringOnly ? '' : `
    <section class="workflow-group knowledge" data-workflow="knowledge" aria-labelledby="knowledge-title">
      <header>
        <div class="workflow-heading-icon"><span class="ms">science</span></div>
        <div><h2 id="knowledge-title">知识与研究</h2><p>团队信息、知识库与科研选题形成可追溯的研究基础。</p></div>
      </header>
      <div class="workflow-rail">
        <a class="workflow-card" data-module="sophistudio" data-status="ready" href="#/overview">
          <div class="wf-icon"><span class="ms">groups</span></div>
          <div class="wf-copy"><h3>团队与平台总览</h3><p>SophiStudio 团队、业务闭环与协作入口。</p><small>当前可用</small></div>
          <span class="wf-action">返回总览<span class="ms">arrow_forward</span></span>
        </a>
        <a class="workflow-card" data-module="ai-guide" data-status="ready" href="../../guide.html">
          <div class="wf-icon"><span class="ms">hub</span></div>
          <div class="wf-copy"><h3>AI 工作环境架构总览</h3><p>AI 模型、Agent、Skill 与 RAG 布局，工作流路由及迁移方案。</p><small>本地指南 · 可直接打开</small></div>
        </a>
        <a class="workflow-card" data-module="online-vault" data-status="ready" href="online-vault/index.html">
          <div class="wf-icon"><span class="ms">database</span></div>
          <div class="wf-copy"><h3>Online Vault</h3><p>知识库管理与 RAG 调试基础。</p><small>可直接使用</small></div>
        </a>
        <a class="workflow-card" data-module="aipm" data-status="ready" href="http://127.0.0.1:4174/">
          <div class="wf-icon"><span class="ms">menu_book</span></div>
          <div class="wf-copy"><h3>AIPM</h3><p>AI 产品经理知识库，分类阅读、正文检索与来源追溯。</p><small>后台自动运行 · 离线正文</small></div>
        </a>
        <a class="workflow-card" data-module="feishu" data-status="ready" href="http://127.0.0.1:8769/feishu/feishu.html">
          <div class="wf-icon"><span class="ms">sync_saved_locally</span></div>
          <div class="wf-copy"><h3>飞书知识库自动化</h3><p>初始化下载 Markdown，持续同步飞书更新，查看版本差异与冲突。</p><small>本地服务 · 需飞书知识库权限</small></div>
        </a>
        <a class="workflow-card" data-module="want" data-status="ready" href="http://127.0.0.1:8770/want.html?from=workflow">
          <div class="wf-icon"><span class="ms">person_search</span></div>
          <div class="wf-copy"><h3>Want 招聘工作台</h3><p>四岗人才资料分类、二次阅读、沟通留档与 Codex 批量评估。</p><small>本地后台 · 复核与导出</small></div>
        </a>
        <article class="workflow-card" data-module="paper" data-status="planned">
          <div class="wf-icon"><span class="ms">description</span></div>
          <div class="wf-copy"><h3>科研课题建议器</h3><p>输出候选课题、研究假设、变量、设备数据、创新点、依据与风险。</p><small>规划中</small></div>
          <span class="wf-disabled" aria-disabled="true">暂未开放</span>
        </article>
      </div>
    </section>`}

${engineeringOnly ? `
    <section class="workflow-group workflow-flat" aria-label="工作流模块">
      <div class="workflow-rail workflow-gallery">
    ` : `
    <section class="workflow-group engineering" data-workflow="engineering" aria-labelledby="engineering-title">
      <header>
        <div class="workflow-heading-icon"><span class="ms">precision_manufacturing</span></div>
        <div><h2 id="engineering-title">工程研发</h2><p>连接项目管理、底盘设计、格式转换、仿真与工程报价。</p></div>
      </header>
      <div class="workflow-rail engineering-rail">
    `}
        ${projectCard("skatechassis", "SkateChassis 机器人工作台", "参数设计、BOM 核价、报价、协作 PRD 与 ROS / Fusion 工程导出。", "http://127.0.0.1:4173/", "smart_toy", "点击自动启动本机服务")}
        ${projectCard("sophirobot", "SophiRobot 三维机器人工作台", "机器人尺寸配置、关节动作预览、BOM 清单与 STEP 导出。", "http://127.0.0.1:4189/", "precision_manufacturing", "后台自动运行 · 打开即可使用")}
        ${engineeringOnly ? '' : `
        <a class="workflow-card" data-module="prd" data-status="ready" href="prd/prd.html">
          <div class="wf-icon"><span class="ms">assignment</span></div>
          <div class="wf-copy"><h3>PRD / SOW 项目驾驶舱</h3><p>需求、计划、预算、交付与验收的一体化项目管理。</p><small>可直接使用</small></div>
        </a>`}
        ${projectCard("sophicarv2", "SophiCar V2", "底盘设计与仿真基础。", "sophicarv2/index.html", "directions_car", "可直接使用")}
        ${engineeringOnly ? '' : `
        <article class="workflow-card" data-module="sophicar-stl-f3d" data-status="planned">
          <div class="wf-icon"><span class="ms">view_in_ar</span></div>
          <div class="wf-copy"><h3>STL → F3D</h3><p>STL 数据处理分析并生成 Fusion 360 原始数据。</p><small>规划中</small></div>
          <span class="wf-disabled" aria-disabled="true">暂未开放</span>
        </article>`}
        ${projectCard("sophicar-formate", "SophiCAD Bridge", "检查 F3D 装配并导出 STL、URDF 工程数据。", "http://127.0.0.1:4173/studio/sophicar-formate/web/dist/index.html", "conversion_path", "可直接使用")}
        ${projectCard("stlquote", "STL Quote", "工程模型分析与制造报价。", "stlquote/index.html", "request_quote", "可直接使用")}
        ${projectCard("cfd", "CFD", "SophiCar V2 的空气动力学仿真模块。", "cfd/dist/index.html", "air", "可直接使用", true)}
        ${projectCard("traffic-scene-lab", "交通场景实验室地图", "三维场景装配、车辆路径演示、赛车赛道与多路面测试道路。", "worldlabstest/worldlabstestv2.html", "map", "本地地图 · 可直接打开")}
        ${projectCard("mooncake", "Mooncake 月饼定制工坊", "月饼尺寸、花纹与文字定制，三维预览及 Fusion 模具建模。", "mooncake/mooncake/Mooncake.html", "bakery_dining", "离线设计 · Fusion 插件联动")}
        ${projectCard("santi", "三体漫游", "基于《三体》策展方案的第三人称虚拟展馆，探索 13 个展区与文明抉择。", "santi/santi.html", "travel_explore", "离线体验 · 键盘与鼠标漫游")}
      ${engineeringOnly ? '' : `
      </div>
    </section>

    <section class="workflow-group manufacturing" data-workflow="manufacturing" aria-labelledby="manufacturing-title">
      <header>
        <div class="workflow-heading-icon"><span class="ms">construction</span></div>
        <div><h2 id="manufacturing-title">工程加工</h2><p>连接加工策略开发、机器人作业与工艺仿真分析。</p></div>
      </header>
      <div class="workflow-rail">
      `}
        ${projectCard("weld", "机械臂焊接", "机器人焊接工作站、焊道策略、温度场与焊后风险分析。", "weld/weld.html", "precision_manufacturing", "可交互演示 · 本地直接打开")}
      ${engineeringOnly ? '' : `
      </div>
    </section>

    <section class="workflow-group content" data-workflow="content" aria-labelledby="content-title">
      <header>
        <div class="workflow-heading-icon"><span class="ms">movie</span></div>
        <div><h2 id="content-title">内容与体验</h2><p>把项目能力转化为可传播、可感知的内容与体验。</p></div>
      </header>
      <div class="workflow-rail content-rail">
      `}
        ${engineeringOnly ? '' : `
        <a class="workflow-card" data-module="media" data-status="ready" href="http://127.0.0.1:8741/">
          <div class="wf-icon"><span class="ms">video_library</span></div>
          <div class="wf-copy"><h3>Media</h3><p>自媒体视频生成器。</p><small>可直接使用</small></div>
        </a>`}
        ${projectCard("drone-formation", "点阵飞行", "上传 GLB，生成 1000 架无人机三维点阵与飞行成形动画。", "http://127.0.0.1:4188/", "scatter_plot", "后台自动运行 · 打开即可使用")}
        ${engineeringOnly ? '' : `
        <article class="workflow-card" data-module="sound" data-status="planned">
          <div class="wf-icon"><span class="ms">graphic_eq</span></div>
          <div class="wf-copy"><h3>Sound</h3><p>声音模拟器，预留后续开发。</p><small>规划中</small></div>
          <span class="wf-disabled" aria-disabled="true">暂未开放</span>
        </article>`}
      </div>
    </section>`;
  }

  /* 业务联动环 SVG */
  function loopSvg() {
    return `
    <div class="loop-wrap">
    <svg class="loop-svg" viewBox="0 0 1160 560" role="img" aria-label="SophiGo 教育、ProFabX 工程模型、SophiMotion 汽车场景实验室联动闭环图">
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#9AA0A6"></path>
        </marker>
      </defs>

      <!-- 外部场景伙伴 -->
      <rect class="loop-ext" x="410" y="27" width="340" height="34" rx="17"></rect>
      <text class="loop-ext-label" x="580" y="48" text-anchor="middle">学校 POC · 社会 OPC · 行业伙伴 —— 承接场景扩张</text>
      <path class="loop-ext" d="M 210 106 C 300 72, 420 62, 500 62"></path>
      <path class="loop-ext" d="M 950 106 C 900 72, 760 62, 660 62"></path>
      <text class="loop-ext-label" x="330" y="74" text-anchor="middle">POC 承接</text>
      <text class="loop-ext-label" x="840" y="74" text-anchor="middle">场景扩张</text>

      <!-- 双向业务流 -->
      <path class="loop-arrow" d="M 365 150 Q 580 118 795 150"></path>
      <text class="loop-arrow-label" x="580" y="112" text-anchor="middle">① 需求 · 人才 · 原型验证</text>
      <path class="loop-arrow" d="M 795 192 Q 580 226 365 192"></path>
      <text class="loop-arrow-label" x="580" y="250" text-anchor="middle">② 标准套件 · 真实项目 · 科研回流</text>

      <!-- 工程层 -->
      <path class="loop-arrow" d="M 300 230 C 300 292, 440 296, 478 334"></path>
      <text class="loop-arrow-label" x="356" y="316" text-anchor="middle">③ 原型 · 打样需求</text>
      <path class="loop-arrow" d="M 660 336 C 700 292, 810 274, 848 232"></path>
      <text class="loop-arrow-label" x="790" y="300" text-anchor="middle">④ 套件 · 工艺 · 小批交付</text>

      <!-- SophiGo -->
      <g class="loop-node" data-route="#/sophigo" role="button" tabindex="0" aria-label="进入 SophiGo 教育">
        <rect class="node-box" x="60" y="110" width="300" height="116" stroke="#34A853"></rect>
        <circle cx="104" cy="168" r="22" fill="#34A853"></circle>
        <text x="104" y="169" text-anchor="middle" dominant-baseline="central" font-family="Material Symbols Outlined" font-size="22" fill="#fff">school</text>
        <text class="t1" x="142" y="152">SophiGo 教育</text>
        <text class="t2" x="142" y="176">需求发现 · 人才筛选 · 原型验证</text>
        <text class="t3" x="142" y="202">进入模块 →</text>
      </g>

      <!-- SophiMotion -->
      <g class="loop-node" data-route="#/sophimotion" role="button" tabindex="0" aria-label="进入 SophiMotion 汽车场景实验室">
        <rect class="node-box" x="800" y="110" width="300" height="116" stroke="#EA4335"></rect>
        <circle cx="844" cy="168" r="22" fill="#EA4335"></circle>
        <text x="844" y="169" text-anchor="middle" dominant-baseline="central" font-family="Material Symbols Outlined" font-size="22" fill="#fff">directions_car</text>
        <text class="t1" x="882" y="152">SophiMotion 实验室</text>
        <text class="t2" x="882" y="176">模拟器 · SophiCore · 核心商业品牌</text>
        <text class="t3" x="882" y="202">进入模块 →</text>
      </g>

      <!-- ProFabX -->
      <g class="loop-node" data-route="#/profabx" role="button" tabindex="0" aria-label="进入 ProFabX 工程模型">
        <rect class="node-box" x="430" y="340" width="300" height="116" stroke="#4285F4"></rect>
        <circle cx="474" cy="398" r="22" fill="#4285F4"></circle>
        <text x="474" y="399" text-anchor="middle" dominant-baseline="central" font-family="Material Symbols Outlined" font-size="22" fill="#fff">precision_manufacturing</text>
        <text class="t1" x="512" y="382">ProFabX 工程模型</text>
        <text class="t2" x="512" y="406">打样 · 小批制造 · 工艺 · 供应链</text>
        <text class="t3" x="512" y="432">进入模块 →</text>
      </g>

      <path class="loop-ext" d="M 580 456 L 580 478"></path>

      <!-- DSH 底座 -->
      <g class="loop-base">
        <rect class="base-box" x="60" y="480" width="1040" height="62"></rect>
        <text x="580" y="503" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)">DSH 底座 · DeepSeek Harness —— AI 助手 · 工作流 · 3D 报价 · 自动化 · 知识库（接口预留）</text>
        <text x="580" y="525" text-anchor="middle" font-size="12" fill="var(--muted)">SophiStudio · 内部工作流 —— 需求 → 配置 → 仿真 → 测试 → 文档 → 版本 → 交付（不对外的内部工作流）</text>
      </g>
    </svg>
    </div>
    <p class="small muted mt-8">模型口径取自 bp.html「解决方案」：SophiGo 输送需求、人才与原型验证；SophiMotion 回流标准套件、真实项目与科研内容；ProFabX 作为独立工程化供应商按市场化协议交付；学校 POC、社会 OPC 与行业伙伴承接场景扩张。</p>`;
  }

  function pipelineHtml() {
    const steps = D().pipeline;
    return `<div class="pipeline">
      ${steps.map((s, i) => `
      <div class="step ${s.tone}">
        <div class="p-dot">${i + 1}</div>
        <span class="p-owner">${esc(s.owner)}</span>
        <h4>${esc(s.title)}</h4>
        <p>${esc(s.desc)}</p>
      </div>`).join('')}
    </div>`;
  }

  /* ========================================================================
   * 视图 2 — SophiGo 教育
   * ====================================================================== */
  function renderSophigo() {
    const s = D().sophigo;
    return `
    ${moduleHead(s.eyebrow, s.title, s.tagline, 'green', 'school')}

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">${icon('radar', 'ms-fill')}定位</div>
        <p class="card-desc mt-8" style="font-size:14px;color:var(--text-2)">${esc(s.intro)}</p>
        <div class="card-foot">${chip('教育入口', 'green')}${chip('低风险原型验证', 'outline')}${chip('不与核心产品并列', 'gray')}</div>
      </div>
      <div class="card">
        <div class="card-title">${icon('account_tree', 'ms-fill')}人才漏斗</div>
        ${s.funnel.map((f, i) => `
        <div class="flex-between mt-12" style="border-bottom:1px solid var(--border);padding-bottom:10px">
          <div><b style="font-size:14px">${esc(f.k)}</b><div class="small muted">${esc(f.v)}</div></div>
          <span class="chip chip-outline">${esc(f.n)}</span>
        </div>`).join('')}
      </div>
    </div>

    <div class="section-head"><h2>课程体系</h2><span class="sub">课程是需求雷达 —— 只有产生信号才继续获得资源</span></div>
    <div class="grid grid-4">
      ${s.courses.map(c => `
      <div class="card module-card">
        <div class="mc-head">
          <div class="mc-ico green">${icon(c.icon, 'ms-fill')}</div>
          <div><h3 style="font-size:15px">${esc(c.name)}</h3><span class="mc-tag">COURSE</span></div>
        </div>
        <p>${esc(c.desc)}</p>
        <div class="flex wrap">${c.tags.map(t => chip(t, 'outline')).join('')}</div>
      </div>`).join('')}
    </div>

    <div class="section-head"><h2>需求雷达</h2><span class="sub">四种信号进入闭环的流向</span></div>
    <div class="grid grid-2">
      ${s.radar.map(r => `
      <div class="card flex-between">
        <div>
          <div class="card-title">${icon('track_changes')}${esc(r.signal)}</div>
          <p class="card-desc mt-8">${esc(r.desc)}</p>
        </div>
        <div style="text-align:right">
          <div class="chip chip-blue" style="white-space:normal">${esc(r.flow)}</div>
        </div>
      </div>`).join('')}
    </div>

    <div class="card mt-16">
      <div class="flex wrap">
        ${icon('swap_horiz', 'ms-fill')}
        <b>联动闭环</b>
        <span class="muted" style="flex:1;min-width:260px">${esc(s.linkage)}</span>
        <a class="btn btn-filled btn-sm" href="#/profabx">原型与报价 →</a>
        <a class="btn btn-outline btn-sm" href="#/sophimotion">回流与科研 →</a>
      </div>
    </div>`;
  }

  /* ========================================================================
   * 视图 3 — ProFabX 工程模型
   * ====================================================================== */
  function renderProFabx() {
    const p = D().profabx;
    return `
    ${moduleHead(p.eyebrow, p.title, p.tagline, 'blue', 'precision_manufacturing')}

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">${icon('layers')}工程复用分层</div>
        <p class="card-desc">${esc(p.intro)}</p>
      </div>
      <div class="card">
        <div class="card-title">${icon('build')}服务能力</div>
        ${p.services.map(sv => `
        <div class="flex-between mt-12" style="border-bottom:1px solid var(--border);padding-bottom:8px">
          <div><b style="font-size:13.5px">${esc(sv.name)}</b><div class="small muted">${esc(sv.desc)}</div></div>
        </div>`).join('')}
      </div>
    </div>

    <div class="section-head"><h2>工程分层 L0 → L3</h2><span class="sub">被两个真实项目以一致接口和测试方式复用，才进入清单</span></div>
    <div class="grid grid-4">
      ${p.layers.map((l, i) => `
      <div class="card" style="border-top:3px solid ${['#9AA0A6', '#4285F4', '#34A853', '#EA4335'][i]}">
        <div class="flex"><span class="chip ${['chip-gray', 'chip-blue', 'chip-green', 'chip-red'][i]}">${l.k}</span></div>
        <h3 class="mt-8" style="font-size:15px">${esc(l.name)}</h3>
        <p class="card-desc">${esc(l.desc)}</p>
      </div>`).join('')}
    </div>

    <div class="section-head"><h2>工艺能力</h2><span class="sub">数字制造 · 材料 · 后处理 · 测试</span></div>
    <div class="grid grid-3">
      ${p.processes.map(pr => `
      <div class="card flex" style="gap:12px">
        <div class="mc-ico ${pr.tone}" style="width:40px;height:40px;border-radius:12px">${icon(pr.icon, 'ms-fill')}</div>
        <div>
          <b style="font-size:14px">${esc(pr.name)}</b>
          <div class="small muted">${esc(pr.desc)}</div>
        </div>
      </div>`).join('')}
    </div>

    <div class="section-head">
      <h2>3D 报价工作台</h2>
      <span class="sub">承接 stlquote · 当前为接口演示，完整版见报价工作台</span>
    </div>
    <div class="card card-pad">
      <div class="grid grid-2">
        <div>
          <h3 style="font-size:16px">${icon('view_in_ar')}演示报价</h3>
          <p class="card-desc">选择工艺与材质生成一份演示报价单。接入 DSH 后由 quote.generate 服务完成正式估算、壁厚风险与导出。</p>
          <div class="grid grid-2 mt-16" style="gap:10px">
            <label class="small muted">工艺
              <select class="pfx-field" id="q-process">
                <option>SLA</option><option>FDM</option><option>SLM</option>
                <option>CNC</option><option>注塑</option><option>硅胶复模</option>
              </select>
            </label>
            <label class="small muted">材质
              <select class="pfx-field" id="q-material">
                <option>ABS-like</option><option>尼龙</option><option>铝合金</option>
                <option>不锈钢</option><option>硅胶</option>
              </select>
            </label>
            <label class="small muted">后处理
              <select class="pfx-field" id="q-finish">
                <option>无</option><option>打磨</option><option>喷砂</option>
                <option>喷漆</option><option>阳极氧化</option><option>电镀</option>
              </select>
            </label>
            <label class="small muted">数量
              <input class="pfx-field" id="q-count" type="number" min="1" max="100" value="3">
            </label>
          </div>
          <button class="btn btn-filled mt-16" id="quote-run">${icon('bolt')}生成演示报价</button>
          <div id="quote-result" class="mt-16"></div>
        </div>
        <div>
          <h3 style="font-size:16px">${icon('integration_instructions')}工作台能力</h3>
          <ul style="margin:12px 0 0 18px;color:var(--text-2);font-size:13px">
            <li>多格式导入：STL / OBJ 前端解析；STEP / IGES / F3D / F3Z 预留 CAD 转换服务</li>
            <li>装配关系编辑：固定 · 转动 · 直线 · 平面 · 球铰 · 轴向</li>
            <li>壁厚分析：启发式包围盒估计，后续可接网格射线厚度场</li>
            <li>报价分析：按体积、密度与工艺估算，导出 JSON / Excel</li>
            <li>多个零件按 Google 色系区分（与 ProFabX v2 一致）</li>
          </ul>
          <div class="card-foot mt-12">
            <a class="btn btn-outline btn-sm" href="https://profabx.com" target="_blank" rel="noopener noreferrer">ProFabX v1</a>
            <a class="btn btn-outline btn-sm" href="https://2026-gamma-one.vercel.app/" target="_blank" rel="noopener noreferrer">ProFabX v2 Dashboard</a>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="flex wrap">
        ${icon('swap_horiz', 'ms-fill')}
        <b>联动闭环</b>
        <span class="muted" style="flex:1;min-width:260px">${esc(p.linkage)}</span>
        <a class="btn btn-filled btn-sm" href="#/sophimotion">交付 SophiMotion →</a>
        <a class="btn btn-outline btn-sm" href="#/sophigo">承接 SophiGo →</a>
      </div>
    </div>`;
  }

  /* ========================================================================
   * 视图 4 — SophiMotion 汽车场景实验室
   * ====================================================================== */
  function renderSophimotion() {
    const m = D().sophimotion;
    return `
    ${moduleHead(m.eyebrow, m.title, m.tagline, 'red', 'directions_car')}

    <div class="grid grid-2">
      <div class="card">
        <div class="card-title">${icon('science')}定位</div>
        <p class="card-desc mt-8" style="font-size:14px;color:var(--text-2)">${esc(m.intro)}</p>
        <div class="card-foot">${chip('核心商业层', 'red')}${chip('滩头产品 · 模拟器', 'outline')}</div>
      </div>
      <div class="card">
        <div class="card-title">${icon('data_object')}关键指标</div>
        ${m.metrics.map(mt => `
        <div class="flex-between mt-12" style="border-bottom:1px solid var(--border);padding-bottom:8px">
          <b style="font-size:18px;font-variant-numeric:tabular-nums">${esc(mt.k)}</b>
          <span class="small muted" style="text-align:right">${esc(mt.v)}</span>
        </div>`).join('')}
      </div>
    </div>

    <div class="section-head"><h2>模拟器三档配置</h2><span class="sub">客户买的是一套能完成实验的能力</span></div>
    <div class="grid grid-3">
      ${m.tiers.map(t => `
      <div class="card">
        <div class="mc-tag">${esc(t.name)}</div>
        <h3 class="mt-8" style="font-size:17px">${esc(t.zh)}</h3>
        <p class="card-desc mt-8">${esc(t.desc)}</p>
        <div class="card-foot">${chip('目标定价 20–30 万/台', 'yellow')}</div>
      </div>`).join('')}
    </div>

    <div class="section-head"><h2>SophiCore · Open → Kit → Solution</h2><span class="sub">让开源成为入口，而不是收入幻觉</span></div>
    <div class="grid grid-3">
      ${m.corePath.map((c, i) => `
      <div class="card" style="position:relative">
        <div class="flex"><span class="chip ${['chip-gray', 'chip-blue', 'chip-green'][i]}">${c.k}</span>
        ${i < 2 ? `<span class="muted" style="margin-left:auto">${icon('arrow_forward')}</span>` : ''}</div>
        <h3 class="mt-8" style="font-size:15px">${esc(c.name)}</h3>
        <p class="card-desc">${esc(c.desc)}</p>
      </div>`).join('')}
    </div>

    <div class="section-head"><h2>滩头市场漏斗</h2><span class="sub">Bottom-up：不用虚假的大 TAM</span></div>
    <div class="card card-pad">
      <div class="grid grid-5" style="gap:10px">
        ${m.beachhead.map(b => `
        <div style="text-align:center;padding:10px">
          <div style="font-size:26px;font-weight:700;color:var(--c-blue);font-variant-numeric:tabular-nums">${esc(b.k)}</div>
          <div class="small muted">${esc(b.v)}</div>
        </div>`).join('')}
      </div>
      <div class="flex wrap mt-8" style="justify-content:center">
        ${m.capabilities.map(c => chip(c, 'outline')).join('')}
      </div>
    </div>

    <div class="section-head"><h2>场景边界</h2><span class="sub">只作为受门控的 POC / OPC 案例，不与核心产品并列</span></div>
    <div class="grid grid-4">
      ${m.scenes.map(sc => `
      <div class="card">
        <div class="flex-between">
          <b style="font-size:14px">${esc(sc.name)}</b>
          ${chip(sc.status, sc.status === '门控 POC' ? 'gray' : 'yellow')}
        </div>
        <p class="card-desc mt-8">${esc(sc.note)}</p>
      </div>`).join('')}
    </div>

    <div class="card mt-16">
      <div class="flex wrap">
        ${icon('swap_horiz', 'ms-fill')}
        <b>联动闭环</b>
        <span class="muted" style="flex:1;min-width:260px">${esc(m.linkage)}</span>
        <a class="btn btn-filled btn-sm" href="#/sophigo">回流 SophiGo →</a>
        <a class="btn btn-outline btn-sm" href="#/profabx">ProFabX 供货 →</a>
      </div>
    </div>`;
  }

  /* ========================================================================
   * 视图 5 — 团队协作（飞书）
   * ====================================================================== */
  function renderCollab() {
    const logged = window.Feishu && Feishu.isLoggedIn();
    const session = logged ? Feishu.getSession() : null;

    const feishuModules = D().feishuModules.map(fm => `
      <div class="card iface-card">
        <div class="if-head">
          <div class="if-ico">${icon(fm.icon)}</div>
          ${chip(fm.status === '演示可用' ? '演示可用' : '接口预留', fm.status === '演示可用' ? 'green' : 'gray')}
        </div>
        <h3 class="mt-12" style="font-size:15px">${esc(fm.name)}</h3>
        <p class="card-desc">${esc(fm.desc)}</p>
        <code>${esc(fm.api)}</code>
      </div>`).join('');

    if (!logged) {
      return `
      <section class="card card-pad hero">
        <div class="hero-eyebrow">${chip('团队协作', 'blue')}${chip('飞书 · 接口预留', 'outline')}</div>
        <h1>飞书团队协作</h1>
        <p class="hero-sub">面板对外公开，任何访客都能浏览三大模块与业务闭环。登录飞书后解锁：团队成员与角色、任务看板、群通知与文档入口。</p>
        <div class="login-logo">飞</div>
        <p class="login-note">登录即取飞书身份；演示环境提供本地演示账号，真实环境走飞书 OAuth 2.0 网页授权（见 README「飞书接入」）。</p>
        <div class="flex" style="justify-content:center">
          <button class="btn btn-filled" id="collab-login-btn" style="height:46px;padding:0 30px">${icon('login')}飞书登录</button>
        </div>
      </section>

      <div class="section-head"><h2>飞书协作套件</h2><span class="sub">登录后按团队成员权限启用</span></div>
      <div class="grid grid-3">${feishuModules}</div>

      <div class="card mt-16">
        <div class="card-title">${icon('info')}为什么是飞书？</div>
        <p class="card-desc mt-8">
          团队成员日常已在飞书：身份与通讯录是现成的组织数据源；云文档与多维表格适合冻结配置、客户漏斗与看板；
          群机器人与审批流适合“报价完成 / 看板推进 / 门控异常”的即时触达。控制台只做业务编排，协作底座复用飞书。
        </p>
      </div>`;
    }

    /* 已登录视图 */
    const members = D().team;
    const tasks = D().tasks;
    const cols = [
      { key: 'todo', label: '待处理', tone: 'chip-gray' },
      { key: 'doing', label: '进行中', tone: 'chip-blue' },
      { key: 'done', label: '已完成', tone: 'chip-green' }
    ];
    const history = Feishu.notifyHistory();

    return `
    <section class="card card-pad">
      <div class="flex wrap">
        ${avatar(session.name, session.avatarColor, true)}
        <div>
          <div class="flex" style="gap:8px">
            <h1 style="font-size:22px">你好，${esc(session.name)}</h1>
            ${chip(session.mode === 'oauth' ? '飞书 OAuth' : '演示身份', session.mode === 'oauth' ? 'green' : 'blue')}
          </div>
          <p class="small muted">${esc(session.feishuName || session.role)} · 团队：${esc(session.tenant || 'ProFabX · SophiCar 团队')}</p>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-outline btn-sm" id="collab-logout-btn">${icon('logout')}退出登录</button>
      </div>
      <p class="small muted mt-12">${icon('lock_open')} 协作面板已解锁：成员、看板与群通知。其他模块数据为公开演示口径。</p>
    </section>

    <div class="section-head"><h2>团队成员</h2><span class="sub">口径取自 bp.html 团队 · 飞书通讯录接入后自动同步</span></div>
    <div class="grid grid-3">
      ${members.map(m => `
      <div class="card flex" style="gap:12px">
        ${avatar(m.name, m.color, true)}
        <div style="min-width:0">
          <div class="flex wrap" style="gap:6px">
            <b style="font-size:14.5px">${esc(m.name)}</b>
            ${chip(m.time, 'outline')}
          </div>
          <div class="small muted">${esc(m.role)}</div>
          <p class="small muted mt-8" style="margin-top:6px">${esc(m.desc)}</p>
        </div>
      </div>`).join('')}
    </div>

    <div class="section-head">
      <h2>任务看板</h2>
      <span class="sub">推进任务会触发飞书群机器人（演示）</span>
    </div>
    <div class="kanban">
      ${cols.map(col => `
      <div class="kb-col">
        <h4>${chip(col.label, col.tone.split('-')[1])}<span class="kb-count">${tasks.filter(t => t.col === col.key).length}</span></h4>
        ${tasks.filter(t => t.col === col.key).map(t => `
        <div class="kb-card" data-task="${t.id}">
          <div class="t">${esc(t.title)}</div>
          <div class="m">
            ${avatar(t.owner, colorOf(t.owner), false)}<span>${esc(t.owner)}</span>
            ${ownerTag(t.tag)}
            <span class="spacer"></span><span>${esc(t.due)}</span>
          </div>
          <div class="kb-actions">
            ${t.col !== 'done'
              ? `<button class="btn btn-tonal btn-sm" data-advance="${t.id}">${icon('arrow_forward')}推进</button>`
              : chip('已完成', 'green')}
          </div>
        </div>`).join('') || '<div class="kb-empty">暂无任务</div>'}
      </div>`).join('')}
    </div>

    <div class="section-head"><h2>群通知</h2><span class="sub">自动化触发 · 飞书群机器人（演示推送，历史存本地）</span></div>
    <div class="card">
      <div class="flex wrap">
        <input class="pfx-field" id="notify-text" style="flex:1;min-width:220px" placeholder="输入要推送到团队群的消息…" value="报价单 Q-2026-003 已生成，请查收">
        <button class="btn btn-filled" id="notify-btn">${icon('send')}推送到群</button>
      </div>
      <div class="mt-16">
        ${history.length ? history.slice(0, 5).map(h => `
        <div class="feed-item">
          <div class="fi-ico">${icon('forum')}</div>
          <div class="fi-main">
            <div class="fi-t">${esc(h.text)}</div>
            <div class="fi-d">${esc(h.by)} · ${new Date(h.at).toLocaleString('zh-CN')}</div>
          </div>
        </div>`).join('') : '<p class="small muted">暂无推送记录</p>'}
      </div>
    </div>

    <div class="section-head"><h2>飞书集成模块</h2><span class="sub">接口清单见「日志」页</span></div>
    <div class="grid grid-3">${feishuModules}</div>`;

    function colorOf(name) {
      const m = D().team.find(x => x.name === name);
      return m ? m.color : 'av-blue';
    }
  }

  /* ========================================================================
   * 视图 6 — 日志（README + 版本日志 + 接口清单）
   * ====================================================================== */
  function renderLog() {
    const caps = DSH.statusOf();
    return `
    ${moduleHead('LOG · README', '日志', 'README、版本日志与接口清单 —— 接入 DeepSeek Harness 的施工图都在这里。', 'gray', 'article')}

    <div class="section-head"><h2>版本日志</h2><span class="sub">Changelog</span></div>
    <div class="card card-pad">
      <div class="timeline">
        ${D().changelog.map(c => `
        <div class="tl-item ${c.v === '0.1.0' ? 'done' : 'todo'}">
          <div class="flex" style="gap:10px">
            <b>v${esc(c.v)}</b>${chip(esc(c.date), 'outline')}
          </div>
          <ul style="margin:8px 0 0 18px;color:var(--text-2);font-size:13px">
            ${c.items.map(it => `<li>${esc(it)}</li>`).join('')}
          </ul>
        </div>`).join('')}
      </div>
    </div>

    <div class="section-head"><h2>README</h2><span class="sub">自动读取项目根目录 README.md</span></div>
    <div class="card card-pad md" id="readme-body">
      <div class="typing"><i></i><i></i><i></i><span class="small muted" style="margin-left:6px">正在加载 README.md…</span></div>
    </div>

    <div class="section-head"><h2>接口清单 · DSH</h2><span class="sub">能力统一经 DSH.call(capability, payload) 调用</span></div>
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>能力</th><th>capability</th><th>面板入口</th><th>网关端点（http 模式）</th><th>状态</th></tr></thead>
        <tbody>
          ${caps.map(c => `
          <tr>
            <td><b>${esc(c.label)}</b></td>
            <td><code>${esc(c.cap)}</code></td>
            <td>${esc(c.entry)}</td>
            <td><code>POST /api/dsh/${esc(c.cap.replace('.', '/'))}</code></td>
            <td>${chip(c.mode === 'mock' ? '演示' : '已接入', c.mode === 'mock' ? 'blue' : 'green')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="section-head"><h2>接口清单 · 飞书</h2><span class="sub">团队协作底座</span></div>
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr><th>端点</th><th>方法</th><th>用途</th><th>状态</th></tr></thead>
        <tbody>
          <tr><td><code>/api/auth/feishu/callback</code></td><td>POST</td><td>OAuth code 换会话（真实接入）</td><td>${chip('接口预留', 'gray')}</td></tr>
          <tr><td><code>/api/feishu/users/me</code></td><td>GET</td><td>当前登录用户</td><td>${chip('接口预留', 'gray')}</td></tr>
          <tr><td><code>/api/feishu/team/members</code></td><td>GET</td><td>团队成员（通讯录）</td><td>${chip('演示可用', 'green')}</td></tr>
          <tr><td><code>/api/feishu/team/tasks</code></td><td>GET</td><td>协作任务看板</td><td>${chip('演示可用', 'green')}</td></tr>
          <tr><td><code>/api/feishu/notify</code></td><td>POST</td><td>群机器人消息推送</td><td>${chip('演示可用', 'green')}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section-head"><h2>关联站点</h2></div>
    <div class="grid grid-4">
      ${linkCard('https://profabx.com', 'ProFabX v1', '教育 · 数字制造 · 汽车场景实验室官方站', 'language')}
      ${linkCard('https://2026-gamma-one.vercel.app/', 'ProFabX v2', 'Google 风格 Dashboard（本面板设计参照）', 'dashboard')}
      ${linkCard('https://sophicar.com', 'sophicar.com', 'SophiCar 官网', 'directions_car')}
      ${linkCard('#/log', '本地参考', 'bp.html / stlquote / online-vault v2（见 README）', 'folder_open')}
    </div>`;
  }

  function linkCard(href, title, desc, ic) {
    return `
    <a class="card card-click" href="${esc(href)}" ${href.startsWith('#') ? '' : 'target="_blank" rel="noopener noreferrer"'}>
      <div class="if-ico">${icon(ic)}</div>
      <h3 class="mt-12" style="font-size:15px">${esc(title)}</h3>
      <p class="card-desc">${esc(desc)}</p>
    </a>`;
  }

  window.PFXViews = { renderOverview, renderWorkflow, renderSophigo, renderProFabx, renderSophimotion, renderCollab, renderLog };
})();
