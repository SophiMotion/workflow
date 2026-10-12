# ProFabX · SophiCar 控制台

**SophiGo 教育 × ProFabX 工程模型 × SophiMotion 汽车场景实验室** 一体化控制面板。

> 教育发现问题，核心产品完成交付，场景伙伴负责复制 —— 一个控制台看全三块业务的联动闭环、客户漏斗与工程资产。

- **外部公开**：访客无需登录即可浏览全部业务视图（总览 / 教育 / 工程 / 实验室 / 日志）
- **飞书团队协作**：登录后解锁团队成员、任务看板、群通知（接口预留，演示模式开箱即用）
- **DSH 接口预留**：AI 助手、工作流、3D 报价、自动化、知识库统一经 `DSH.call()` 调用，后端就绪后零改动接入
- **风格**：Google / Material 3 配色与布局（参照 [ProFabX v2 Dashboard](https://2026-gamma-one.vercel.app/)）

## 快速开始

```bash
# 方式一：本地服务器（推荐，支持 README 读取与 mock API 联调）
python3 server.py          # → http://127.0.0.1:8000/

# 方式二：任意静态服务器
npx serve .                # 或直接部署到 nginx / Vercel / 飞书云文档挂载

# 方式三：直接双击 index.html（部分功能受限：README fetch 在 file:// 下不可用）
```

## 目录结构

```
ProFabX@sophicar/
├── index.html          # 页面骨架（应用栏、导航、对话框）
├── css/style.css       # Google 风格设计系统（含暗色模式）
├── js/
│   ├── config.js       # ★ 唯一配置入口：飞书 + DSH + 演示账号
│   ├── data.js         # 演示数据（KPI、管线、课程、工艺、团队、看板…）
│   ├── dsh.js          # ★ DSH 能力接口层（mock / http 双模式）
│   ├── feishu.js       # ★ 飞书登录与协作（mock / oauth 双模式）
│   ├── markdown.js     # 迷你 Markdown 渲染器（日志页）
│   ├── views.js        # 六个视图模板
│   └── app.js          # 路由、交互、AI 命令面板
├── server.py           # 静态服务器 + /api/dsh/*、/api/feishu/* mock 网关
└── README.md           # 本文档（导航「日志」页会自动渲染）
```

## 六大视图

| 视图 | 内容 |
|------|------|
| **总览** | 业务联动环（SVG 交互图）、KPI、六步联动管线、DSH 能力卡、最近动态 |
| **SophiGo 教育** | 课程体系（Fab 教育 / AI 基础 / 底盘实验室 / Hackathon）、需求雷达、人才漏斗 |
| **ProFabX 工程** | 工程分层 L0–L3、工艺能力（3D 打印 / CNC / 复模 / 钣金 / 后处理 / CMF）、3D 报价演示 |
| **SophiMotion 实验室** | 模拟器三档、SophiCore Open→Kit→Solution、滩头漏斗、场景边界、关键指标 |
| **团队协作** | 飞书登录、团队成员、任务看板、群通知、飞书集成模块 |
| **日志** | 版本日志 + 自动渲染本 README + DSH/飞书接口清单 + 关联站点 |

## 三大模块联动模型

口径取自 `bp.html`「解决方案」章节（业务架构图 v14）：

```
 SophiGo 教育 ──①需求·人才·原型验证──▶ SophiMotion 实验室（核心商业品牌）
      ▲ ◀──②标准套件·真实项目·科研回流──┘        │
      │③原型·打样需求                            │④套件·工艺·小批交付
      └──────────▶ ProFabX 工程模型 ◀───────────┘
                         ▲
       DSH 底座（AI · 工作流 · 报价 · 自动化 · 知识库，接口预留）
       SophiStudio 内部工作流（需求→配置→仿真→测试→文档→版本→交付）
       外部：学校 POC · 社会 OPC · 行业伙伴 —— 承接场景扩张
```

- **SophiGo** 输送需求、人才与原型验证；**SophiMotion** 回流标准套件、真实项目与科研内容
- **ProFabX** 是独立工程化供应商，按市场化报价、质量与交付协议提供打样、小批制造、工艺与供应链
- 复用纪律：只有被至少两个真实项目以一致接口和测试方式使用的模块，才进入复用清单

## 飞书接入

配置集中在 `js/config.js` 的 `feishu` 段：

| 字段 | 说明 |
|------|------|
| `mode` | `mock`（演示账号，默认）/ `oauth`（真实飞书授权） |
| `appId` | 飞书企业自建应用 App ID（oauth 模式必填） |
| `redirectUri` | OAuth 重定向地址，默认取当前站点 + `#/collab?feishu=callback` |
| `endpoints` | 后端协作接口路径（通讯录 / 任务 / 群通知） |

真实接入步骤：

1. [open.feishu.cn](https://open.feishu.cn) 创建企业自建应用，开通所需权限（通讯录、消息、云文档等）
2. 安全设置 → 重定向 URL 配置为 `<部署地址>/#/collab?feishu=callback`
3. `js/config.js` 中 `feishu.mode = 'oauth'`、填入 `appId`
4. 后端实现 `POST /api/auth/feishu/callback`：用 `code` 调飞书接口换取 `user_access_token`，返回会话对象（格式见 `feishu.js` 的 `handleCallback`）

协作接口（`server.py` 已提供 mock 实现）：

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/auth/feishu/callback` | POST | OAuth code 换会话 |
| `/api/feishu/users/me` | GET | 当前用户 |
| `/api/feishu/team/members` | GET | 团队成员（通讯录） |
| `/api/feishu/team/tasks` | GET | 协作任务看板 |
| `/api/feishu/notify` | POST | 群机器人推送 |

## DeepSeek Harness（DSH）接口预留

面板所有 AI 能力统一封装在 `js/dsh.js`：`DSH.call(capability, payload)`，双模式：

- `mock`：前端内置演示实现（默认，静态部署即可用）
- `http`：`POST <apiBase>/<capability>`，可带 Bearer token（`server.py` 已提供同路径 mock 网关）

| 能力 | capability | 面板入口 | 预期 DSH 侧实现 |
|------|-----------|----------|-----------------|
| AI 助手 | `ai.chat` | 全局 ⌘K 命令面板 / 总览命令条 | DSH 模型 Tool 或会话接口，结合知识库回答 |
| 工作流 | `workflow.run` | 联动管线 / 看板推进联动 | DSH 工作流编排（多步骤、可回调） |
| 3D 报价 | `quote.generate` | ProFabX 报价工作台 | 承接 stlquote：STL/STEP 解析 + 工艺价目 + 壁厚风险 |
| 自动化 | `automation.trigger` | 看板推进 / 群通知 | DSH 自动化触发器（飞书机器人、审批） |
| 知识库 | `kb.search` | AI 面板 / 日志 | 承接 online-vault v2：多来源检索带引用 |

接入 DSH 的两种方式（任选其一）：

1. **网关转发**：DSH Host 暴露 HTTP 网关，把 `/api/dsh/*` 转发到对应 Tool/服务，前端 `dsh.mode = 'http'`
2. **人机共治**：DSH 会话直接读写本面板的 `js/data.js` / `js/config.js`（均为纯 JSON 数据层），页面自动生效

## 演示账号（mock 登录）

吴波（商业与产品 · DRI）、佟怡姗（项目与交付 · DRI）、Clement（结构与工程化）、金邦明（软件与集成）、慕帅杰（内部工作流）。点击右上角「飞书登录」选择即可。

## 参考来源

| 参考 | 路径 / 地址 |
|------|------------|
| 商业计划（解决方案模型） | `/Users/wubo/Documents/2026-2/SophiCar/web/sophiv30808/0803/bp.html` |
| ProFabX v1 | https://profabx.com |
| ProFabX v2 Dashboard | https://2026-gamma-one.vercel.app/ |
| sophicar.com | https://sophicar.com |
| AI 知识库 v2 | `/Users/wubo/Documents/2026-2/socialMedia/online-vault/v2/v2.html` |
| 3D 报价工作台 | `/Users/wubo/Documents/2026-2/workflow/profabx/stlquote/index.html` |

> 页面所有数字为演示口径（取自 bp.html 商业计划），接入后端后以 API 数据为准。

## 版本日志

### v0.1.0（2026-08-18）

- 六视图控制台：总览 / SophiGo / ProFabX / SophiMotion / 团队协作 / 日志
- 业务联动环 SVG 交互图 + 六步联动管线
- 飞书协作：演示登录、团队面板、看板推进、群机器人模拟推送（接口预留）
- DSH 接口层：AI / 工作流 / 报价 / 自动化 / 知识库统一封装（mock + http 双模式）
- `server.py` mock API 网关；README 自动渲染进「日志」页

### 计划中

- 接入 DeepSeek Harness：模型工具、工作流编排、报价服务、自动化与知识库
- 飞书真实 OAuth 登录与通讯录 / 多维表格 / 审批接入
- 报价工作台与 stlquote 深度集成；知识库与 online-vault v2 打通
