/* ==========================================================================
 * data.js — 面板演示数据（静态内容层）
 * 接入后端后，可让 DSH 工作流 / 飞书接口覆写本文件数据，页面无需改动。
 * ========================================================================== */
(function () {
  'use strict';

  window.PFX_DATA = {

    /* ---------- 总览 KPI ---------- */
    kpis: [
      { icon: 'school', label: '滩头目标账户', value: '60', unit: '个课题组/中心', note: '30 所学校 · 具名账户', status: '目标', tone: 'blue' },
      { icon: 'request_quote', label: '正式报价目标', value: '3+', unit: '份', note: '漏斗 60 → 15+ → 5+ → 3+ → 1', status: '目标', tone: 'green' },
      { icon: 'groups', label: '等效核心产能', value: '4', unit: 'FTE', note: '3 全职 + 2 名 ≈50% 成员', status: '已验证', tone: 'red' },
      { icon: 'directions_car', label: '模拟器 V2 目标定价', value: '20–30', unit: '万元/台', note: '目标区间，非已验证成交均价', status: '目标', tone: 'yellow' }
    ],

    /* ---------- 联动管线（六步闭环） ---------- */
    pipeline: [
      { owner: 'SophiGo 教育', tone: 'green', title: '需求雷达', desc: '课程与实验室发现预算线索、实验需求、可复用资产与候选人才' },
      { owner: 'ProFabX 工程', tone: 'blue', title: '原型与报价', desc: '3D 报价、打样、工艺与 DFM/CMF 分析，降低试错成本' },
      { owner: 'SophiStudio', tone: 'gray', title: '冻结与定价', desc: '三档配置、范围冻结、报价与定金节点（内部工作流）' },
      { owner: 'SophiMotion 实验室', tone: 'red', title: '交付与验收', desc: '模拟器 / SophiCore 交付、安装培训、一次验收' },
      { owner: '场景伙伴', tone: 'yellow', title: '场景复制', desc: '学校 POC、社会 OPC、行业伙伴承接场景扩张与转介绍' },
      { owner: 'DSH 知识库', tone: 'blue', title: '资产回流', desc: 'BOM、接口、测试与实验内容沉淀，回流课程与后续报价' }
    ],

    /* ---------- DSH 能力卡（总览） ---------- */
    dshCards: [
      { cap: 'ai.chat', icon: 'auto_awesome', title: 'AI 助手', desc: '全局 ⌘K 命令面板：问联动状态、客户漏斗、快速估价。接入 DSH 模型工具后升级为真实会话。', action: '试试 ⌘K' },
      { cap: 'workflow.run', icon: 'account_tree', title: '工作流', desc: '联动管线六步闭环 + 看板推进事件，均可编排为 DSH 工作流自动执行。', action: '查看管线' },
      { cap: 'quote.generate', icon: 'view_in_ar', title: '3D 报价', desc: '承接 stlquote：STL/OBJ/STEP 导入、工艺与后处理、壁厚风险、装配编辑与报价分析。', action: '打开报价台' },
      { cap: 'automation.trigger', icon: 'bolt', title: '自动化', desc: '飞书群机器人、审批流、通知推送：看板推进 / 报价完成时自动触发。', action: '模拟触发' },
      { cap: 'kb.search', icon: 'menu_book', title: '知识库', desc: '承接 online-vault v2：资料、课程、案例统一检索，回复带来源引用。', action: '检索示例' }
    ],

    /* ---------- 最近动态 ---------- */
    activities: [
      { icon: 'request_quote', title: '报价单 Q-2026-003 已生成', desc: '底盘场景实验室套件 · SLA + CNC · 预估 ¥6,400（演示数据）', time: '10 分钟前', cap: 'quote.generate' },
      { icon: 'school', title: '新课程线索：智能座舱实验需求', desc: 'SophiGo 课程雷达命中「预算相关」线索，已进入漏斗访谈', time: '2 小时前', cap: 'workflow.run' },
      { icon: 'bolt', title: '自动化：看板任务推进通知', desc: '「冻结三档配置」任务由佟怡姗推进至进行中，飞书群机器人已模拟推送', time: '昨天', cap: 'automation.trigger' },
      { icon: 'menu_book', title: '知识库新增：Fab Academy 课程资料', desc: 'online-vault v2 同步 3 份文档，AI 检索已索引（演示数据）', time: '2 天前', cap: 'kb.search' },
      { icon: 'auto_awesome', title: 'AI 助手完成一次联动状态问答', desc: '演示模式返回三块业务联动摘要（接口预留：DSH ai.chat）', time: '3 天前', cap: 'ai.chat' }
    ],

    /* ---------- SophiGo 教育 ---------- */
    sophigo: {
      eyebrow: 'EDUCATION · DEMAND RADAR',
      title: 'SophiGo 教育',
      tagline: '教育发现问题，人才与原型从这里进入闭环。',
      intro: 'SophiGo 是教育、需求发现、人才筛选和低风险原型验证业务。它把课程变成需求雷达：只有产生预算线索、实验需求、可复用资产或候选人才的课程，才继续获得资源。',
      courses: [
        { icon: 'build', name: 'Fab 教育', desc: 'MIT Fab Academy 本土化：网页搭建、CAD、数字制造、嵌入式、IoT 到 AI 辅助设计开发。', tags: ['NexMaker Academy', 'Fab 实验室', 'Hackathon'] },
        { icon: 'smart_toy', name: 'AI 基础教育', desc: 'AI 生成式设计、算法与工具链入门，面向跨学科学生与教师培训。', tags: ['生成式设计', '教师培训'] },
        { icon: 'directions_car', name: '底盘场景实验室', desc: '智能小车套件 + Fusion360 参数化工具，教育端车辆载体的落地场景。', tags: ['智能小车套件', '参数化设计'] },
        { icon: 'workspace_premium', name: '竞赛与 Hackathon', desc: '在高校组织 Hackathon，让学生在真实工程环境下解决问题、进入人才视野。', tags: ['真实工程', '人才筛选'] }
      ],
      radar: [
        { signal: '预算线索', desc: '课程反馈中出现的预算、负责人与采购窗口信号', flow: '→ ProFabX 原型与报价' },
        { signal: '实验需求', desc: '教师提出的实验任务、数据与验收诉求', flow: '→ SophiMotion 模拟器 / SophiCore' },
        { signal: '可复用资产', desc: '课程产出的模块、接口与测试，被两个真实项目复用后入库', flow: '→ DSH 知识库' },
        { signal: '候选人才', desc: 'Hackathon 与课程中筛选的学生与专家', flow: '→ 杠杆层（专家 + 学生团队）' }
      ],
      funnel: [
        { k: '课程与实验室', v: 'Fab 教育 / AI 基础 / 底盘实验室', n: '获客与使用' },
        { k: '人才筛选', v: 'Hackathon + 真实项目', n: '不替代全职交付责任' },
        { k: '原型验证', v: '低风险、受控范围', n: 'ProFabX 承接打样' }
      ],
      linkage: 'SophiGo 输送需求、人才与原型验证 → ProFabX 完成打样与工艺验证 → SophiMotion 以标准套件、真实项目与科研内容回流，反哺下一轮课程。'
    },

    /* ---------- ProFabX 工程模型 ---------- */
    profabx: {
      eyebrow: 'ENGINEERING · SUPPLY LAYER',
      title: 'ProFabX 工程模型',
      tagline: '独立工程化供应商：把想法变成可制造、可报价、可复用的交付。',
      intro: 'ProFabX 按市场化报价、质量和交付协议，提供打样、小批制造、工艺与供应链能力。工程复用从底层采购件向场景工艺逐层收敛，只有被至少两个真实项目以一致接口和测试方式使用的部分，才进入复用清单。',
      layers: [
        { k: 'L0', name: '采购件', desc: '电机、电池、传感器、计算平台与基础设施；以替代料与供应商 SLA 管理' },
        { k: 'L1', name: '可复用模块', desc: '电源、通信、控制、安全、数据、日志、标准机械与软件接口' },
        { k: 'L2', name: '产品平台', desc: '模拟器与 SophiCore 的标准配置、BOM、测试、报价与验收模板' },
        { k: 'L3', name: '场景工艺', desc: '盛菜、取书、巡检等末端与运营能力，由场景伙伴承担主要责任' }
      ],
      processes: [
        { name: '3D 打印', desc: 'SLA · LCD · FDM · MJF · SLM', icon: 'view_in_ar', tone: 'blue' },
        { name: 'CNC 加工', desc: '金属 / 塑料精密加工', icon: 'precision_manufacturing', tone: 'green' },
        { name: '硅胶复模', desc: '小批量快速复模', icon: 'inventory_2', tone: 'red' },
        { name: '钣金加工', desc: '结构件与外壳', icon: 'architecture', tone: 'yellow' },
        { name: '后处理', desc: '打磨 · 喷砂 · 喷漆 · 阳极氧化 · 电镀', icon: 'auto_fix_high', tone: 'blue' },
        { name: 'CMF / DFM', desc: '色彩 · 材料 · 表面处理 · 可制造性', icon: 'palette', tone: 'green' }
      ],
      services: [
        { name: '设计生产优化', desc: '从设计后期到批量生产前的可行性分析、轻量化设计' },
        { name: '样品生产与测试', desc: '塑料、金属全工艺打样与测试' },
        { name: '开源项目开发调试', desc: '简单项目快速开发与调试支持' },
        { name: '3D 报价工作台', desc: '多格式导入 · 装配编辑 · 壁厚风险 · 报价分析一体化（承接 stlquote）' }
      ],
      linkage: 'ProFabX 承接 SophiGo 的原型验证与 SophiMotion 的套件、打样需求；报价与工艺数据回流 DSH，形成可复用报价能力。'
    },

    /* ---------- SophiMotion 汽车场景实验室 ---------- */
    sophimotion: {
      eyebrow: 'CORE BRAND · SCENE LAB',
      title: 'SophiMotion 汽车场景实验室',
      tagline: '客户买的不是一辆车，而是一套能完成实验的能力。',
      intro: 'SophiMotion 是项目与核心商业品牌，包含模拟器与 SophiCore。面向人因工程、车辆控制、智能驾驶、工业设计和运动仿真任务，交付机械运动系统、控制与数据接口、实验内容、安全边界、安装培训和验收。',
      tiers: [
        { name: 'Research Base', zh: '基础研究包', desc: '标准硬件、控制、数据接口、基础实验和操作培训' },
        { name: 'Teaching Lab', zh: '教学实验包', desc: '基础包 + 实验指导书、教师手册、多人工位和培训' },
        { name: 'Co-Research', zh: '联合研究包', desc: '课题传感器、算法、仿真接口与有限定制，变更单独收费' }
      ],
      corePath: [
        { k: 'OPEN', name: '开放学习入口', desc: '基础驱动、接口、仿真、课程与样例，降低学习和试用门槛' },
        { k: 'KIT', name: '标准套件', desc: '装配、校准、测试、文档与质保，用真实付费验证需求（约 ¥5,000/台 低价验证）' },
        { k: 'SOLUTION', name: '整体方案', desc: 'Kit + 传感器/上身/末端模块 + 安装验收，围绕明确任务交付' }
      ],
      capabilities: ['人因工程', '车辆控制', '智能驾驶', '控制 · 数据 · 仿真', '安全 · 测试 · 验收'],
      beachhead: [
        { k: '60', v: '具名目标账户' },
        { k: '15+', v: '预算相关访谈' },
        { k: '5+', v: '合格机会' },
        { k: '3+', v: '正式报价' },
        { k: '1', v: '第二客户合同 + 定金' }
      ],
      scenes: [
        { name: 'SophiFold', status: '门控 POC', note: '只作为受门控的 POC 案例，不与核心产品并列' },
        { name: '盛菜', status: '门控 POC', note: '场景伙伴承担主要责任' },
        { name: '图书馆', status: '门控 POC', note: '预算、任务书、验收、IP、安全、责任六门控' },
        { name: '滑板底盘', status: '展示中', note: 'Fab 课程与工程样机开发在交通领域的交汇点' }
      ],
      metrics: [
        { k: '20–30 万元/台', v: '模拟器 V2 目标定价' },
        { k: '>50%', v: '18 个月核心模块复用率目标' },
        { k: '85%', v: '核心产能服务模拟器主线' },
        { k: '≤10%', v: '其他场景实验合计资源上限' }
      ],
      linkage: 'SophiMotion 向 SophiGo 回流标准套件、真实项目与科研内容；由 ProFabX 按市场化协议供货；学校 POC、社会 OPC 与行业伙伴承接场景扩张。'
    },

    /* ---------- 团队（bp.html 口径） ---------- */
    team: [
      { id: 'wu-bo', name: '吴波', role: '商业与产品 · DRI', time: '全职', color: 'av-blue', desc: '客户选择、产品定义、定价、合同、回款与前 10 个客户周期' },
      { id: 'tong-yishan', name: '佟怡姗', role: '项目与交付 · DRI', time: '全职', color: 'av-green', desc: '需求冻结、排期、接口、测试、验收和变更控制' },
      { id: 'clement', name: 'Clement', role: '结构与工程化', time: '全职', color: 'av-red', desc: '结构、CAE、BOM、工程设计、测试验证和制造接口' },
      { id: 'jin-bangming', name: '金邦明', role: '软件与集成', time: '≈50%', color: 'av-yellow', desc: '软件、数据、部署和系统集成，按周里程碑验收' },
      { id: 'mu-shuaijie', name: '慕帅杰', role: '内部工作流', time: '≈50%', color: 'av-purple', desc: 'SophiStudio、参数化与交付衔接' },
      { id: 'leverage', name: '专家 + 学生', role: '杠杆层', time: '按项目', color: 'av-teal', desc: '专家定义问题与评审；学生完成受控原型' }
    ],

    /* ---------- 协作看板（演示任务） ---------- */
    tasks: [
      { id: 't1', col: 'todo', title: '第二客户：预算相关访谈排期', owner: '吴波', tag: 'SophiMotion', due: '本周' },
      { id: 't2', col: 'todo', title: '模拟器三档配置文档评审', owner: '佟怡姗', tag: 'SophiStudio', due: '下周' },
      { id: 't3', col: 'todo', title: '滑板底盘对外展示物料', owner: 'Clement', tag: 'SophiMotion', due: '2 周后' },
      { id: 't4', col: 'doing', title: '冻结三档配置、BOM、验收脚本', owner: '佟怡姗', tag: 'SophiStudio', due: '进行中' },
      { id: 't5', col: 'doing', title: '知识库检索接入 DSH 网关', owner: '金邦明', tag: 'DSH', due: '进行中' },
      { id: 't6', col: 'doing', title: '课程雷达线索 → 3D 报价打样', owner: '慕帅杰', tag: 'ProFabX', due: '进行中' },
      { id: 't7', col: 'done', title: 'bp.html 商业计划 v14 定稿', owner: '吴波', tag: 'SophiStudio', due: '已完成' },
      { id: 't8', col: 'done', title: '3D 报价工作台（stlquote）上线', owner: 'Clement', tag: 'ProFabX', due: '已完成' }
    ],

    /* ---------- 飞书集成模块 ---------- */
    feishuModules: [
      { icon: 'badge', name: '通讯录与身份', desc: '团队登录即取飞书身份，成员、部门与角色同步到协作面板。', api: 'GET /api/feishu/team/members', status: '接口预留' },
      { icon: 'description', name: '云文档', desc: '三档配置、验收清单等文档沉淀在飞书云文档，面板内直达。', api: 'docs:doc', status: '接口预留' },
      { icon: 'table_chart', name: '多维表格', desc: '客户漏斗、报价单、看板任务可双向同步到飞书多维表格。', api: 'bitable:v1', status: '接口预留' },
      { icon: 'forum', name: '群机器人', desc: '看板推进、报价完成、风险提醒自动推送到团队群。', api: 'POST /api/feishu/notify', status: '演示可用' },
      { icon: 'approval', name: '审批流', desc: '报价、变更与门控场景接入飞书审批，留痕可审计。', api: 'approval:v4', status: '接口预留' }
    ],

    /* ---------- 版本日志 ---------- */
    changelog: [
      { v: '0.1.0', date: '2026-08-18', items: [
        '控制台首个版本：总览 / SophiGo / ProFabX / SophiMotion / 团队协作 / 日志 六视图',
        '业务联动环：SophiGo 教育 × ProFabX 工程模型 × SophiMotion 汽车场景实验室闭环',
        '飞书协作：演示登录、团队面板、看板、群机器人模拟推送（接口预留）',
        'DSH 接口层：AI 助手 / 工作流 / 3D 报价 / 自动化 / 知识库 统一调用封装',
        'server.py：静态服务 + mock API，可切换 http 模式联调'
      ] },
      { v: '计划中', date: '—', items: [
        '接入 DeepSeek Harness：模型工具、工作流编排、报价服务、自动化与知识库',
        '飞书真实 OAuth 登录与通讯录 / 多维表格 / 审批接入',
        '报价工作台与 stlquote 深度集成，知识库与 online-vault v2 打通'
      ] }
    ],

    /* ---------- README 加载失败时的内嵌回退 ---------- */
    readmeFallback: '# README\n\nREADME.md 加载失败（file:// 协议下静态读取受限）。请使用 `python3 server.py` 或任意静态服务器预览完整文档。\n\n核心要点：\n\n- 面板六视图：总览 / SophiGo 教育 / ProFabX 工程 / SophiMotion 实验室 / 团队协作 / 日志\n- 接口配置集中在 `js/config.js`（飞书 + DSH），演示数据在 `js/data.js`\n- DSH 能力：AI 助手、工作流、3D 报价、自动化、知识库\n- 团队协作：飞书登录（mock / oauth 两模式）\n'
  };
})();
