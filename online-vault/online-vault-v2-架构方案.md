# online-vault v2 架构方案：Obsidian + Claude Code 知识管理系统

> 文档版本：v1.0 | 适用场景：6412 条资料、4 个来源渠道、13 个主题分类
> 核心理念：**原始数据不移动、不删除、不改写；上层建立引用层和智能层**

---

## 一、总体架构：三层模型

```
┌─────────────────────────────────────────────────────────────┐
│                   第3层：智能层（Obsidian 工作库）              │
│  ┌──────────────┬──────────────┬───────────────────────┐    │
│  │ Dashboards   │ Canvas 图谱  │ Claude Code 批处理    │    │
│  │ Dataview 查询│ MOC 主题地图 │ AI 分析与内容生成     │    │
│  └──────────────┴──────────────┴───────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                   第2层：v2 主题引用层                       │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐       │
│  │AI工具│数字制│交通  │FabLab│社区  │...   │教育  │       │
│  │      │造    │工具  │      │      │      │      │       │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘       │
│  每个主题文件夹内：_index.md + 各渠道子文件夹 + 交叉引用       │
├─────────────────────────────────────────────────────────────┤
│                   第1层：原始数据层（不动）                    │
│  ┌──────────┬──────────┬──────────┬──────────┐            │
│  │wechat-   │web-vault │gemini-   │chatgpt-  │            │
│  │vault     │(1119)    │vault     │vault     │            │
│  │(2200)    │          │(2689)    │(404)     │            │
│  │MD + HTML │MD + HTML │HTML      │HTML      │            │
│  └──────────┴──────────┴──────────┴──────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 各层职责

| 层级 | 名称 | 可写？ | 用途 |
|------|------|--------|------|
| 第1层 | 原始数据层 | **只读，永不修改** | 源码仓库：保留采集时的原始 MD/HTML |
| 第2层 | v2 主题引用层 | 可写 | 按主题组织引用笔记，指向第1层原文 |
| 第3层 | Obsidian 工作库 | 可写 | 智能笔记、看板、图谱、AI 交互区 |

---

## 二、v2 文件夹结构设计

### 2.1 目录树

```
online-vault/
├── wechat-vault/              ← 第1层：原始数据（不动）
│   ├── md/AI工具/346篇.md
│   ├── md/数字制造/446篇.md
│   └── ...
├── web-vault/                 ← 第1层：原始数据（不动）
├── gemini-vault/              ← 第1层：原始数据（不动）
├── chatgpt-vault/             ← 第1层：原始数据（不动）
│
├── tools/                     ← 构建脚本
│
├── v2/                        ← ★ 第2层：主题引用层（新建）
│   ├── v2.html                ←   ★ 主入口：搜索页（浏览器打开）
│   ├── AI工具/
│   │   ├── _index.md          ←   主题 MOC（地图入口、关键资源）
│   │   ├── wechat-xxx.md      ←   索引笔记（直接放主题文件夹内）
│   │   ├── 精华精选/          ←   ★ 人工标注的重点文章
│   │   └── 待处理/            ←   ★ 待审阅队列
│   ├── 数字制造/
│   ├── 交通工具/
│   ├── FabLab/
│   ├── autodesk/
│   ├── 社区/
│   ├── UNNC/
│   ├── 团队管理/
│   ├── 产品分析/
│   ├── 工具/
│   ├── 政策/
│   ├── HIL/
│   └── 教育/
│
├── obsidian-workspace/        ← 第3层：Obsidian 工作库（可增量重建）
│   ├── .obsidian/             ← Obsidian 配置文件
│   ├── 00-Home.md             ← 工作台首页
│   ├── 01-Sources/            ← 精选资料卡（指向原始数据）
│   ├── 02-Wiki/               ← MOC 概念卡
│   ├── 03-Projects/           ← 项目页
│   ├── 04-Dashboards/         ← 看板
│   └── ...
│
├── index.html                 ← 统一搜索入口
└── online-vault-index.json    ← 全文索引
```

> **设计变更说明：** v2 主题文件夹不再按来源渠道（wechat/web/gemini/chatgpt）分子文件夹。所有索引笔记直接放在主题文件夹下，来源信息通过 frontmatter 中的 `source` / `channel` 字段标记。`v2.html` 是 v2 的主要入口——浏览器打开即可通过搜索和主题筛选查阅全库资料。

### 2.2 v2 核心设计原则

1. **v2 里不放原始文件副本**，只放「索引笔记」和「引用链接」
2. 每个主题一个文件夹，所有来源的索引笔记直接放在该文件夹下（不再按渠道分子文件夹），来源信息用 frontmatter 的 `source` / `channel` 字段标记
3. 每篇原始文章在 v2 中对应一个 `.md` 索引笔记（含 frontmatter + 原文链接）
4. 精华区（精选）和待处理区由人工 + Claude Code 共同维护
5. `v2.html` 是 v2 的主入口——浏览器打开即可通过搜索框 + 13 个主题导航栏查阅全库资料

### 2.3 索引笔记结构示例

每篇原始文章在 v2 中自动生成一条索引笔记：

```markdown
---
title: "这个 GitHub 有意思啊，Claude Code + Obsidian = 知识库王炸"
source: "wechat"
source_path: "../../wechat-vault/md/AI工具/0001-xxx.md"
html_path: "../../wechat-vault/html/AI工具/0001-xxx.html"
original_url: "https://mp.weixin.qq.com/s/xxx"
published_at: "2026-06-23"
collected_at: "2026-06-24"
account: "逛逛"
status: "triaged"       ← inbox → triaged → distilled → linked → used
relevance: ⭐⭐⭐
projects: ["OnlineVault"]
tags: ["obsidian", "claude-code", "知识库"]
---

# 这个 GitHub 有意思啊，Claude Code + Obsidian = 知识库王炸

**摘要：** 用 Claude Code 给 Obsidian 装 AI 大脑，实现自动整理待办、热点和选题。

**原文链接：** [查看原文](https://mp.weixin.qq.com/s/xxx)
**本地 Markdown：** [打开原始笔记](<../../wechat-vault/md/AI工具/0001-xxx.md>)
**本地 HTML：** [打开 HTML 版](<../../wechat-vault/html/AI工具/0001-xxx.html>)

**关联笔记：** [[AI工具/_index]] | [[MOC - Obsidian工作流]]
```

---

## 三、Obsidian 配置与最佳实践

### 3.1 必需插件清单

| 插件 | 作用 | 为什么必须 |
|------|------|-----------|
| **Dataview** | 用 SQL-like 语法查询笔记属性 | 替代手动维护表格，动态聚合资料 |
| **Canvas** | 可视化知识图谱 | 内置，无需安装，用于主题地图 |
| **Templater** | 高级模板引擎 | 一键生成索引笔记、MOC |
| **HTML Reader** | 在 Obsidian 中渲染 HTML 文件 | ★ 直接在 Obsidian 内打开 Gemini/ChatGPT HTML |
| **Advanced URI** | 从外部或脚本打开 Obsidian 笔记 | 配合 Claude Code 自动跳转 |
| **Tag Wrangler** | 批量管理标签 | 6412 条数据的标签必须批处理 |
| **Quick Add** | 快速捕获想法 | 日常收件箱录入 |
| **Excalidraw** | 手绘风格图示 | 知识关系可视化 |
| **Note Refactor** | 将笔记拆分/合并 | 处理长文本，提炼概念卡 |

### 3.2 内置功能利用策略

| Obsidian 功能 | 最佳用途 | 在本项目中的用法 |
|--------------|---------|----------------|
| **Graph View** | 全局知识网络 | 查看跨主题关联，发现知识孤岛 |
| **Local Graph** | 单篇笔记关联 | 每篇索引笔记显示上下文 |
| **Backlinks** | 反向链接 | 从任意笔记追溯引用来源 |
| **Properties** | 结构化元数据 | status / projects / relevance / tags |
| **Command Palette** | 快速操作 | `Cmd+P` 搜索一切 |
| **Quick Switcher** | 快速跳转 | `Cmd+O` 跨 6412 条笔记搜索 |
| **Bookmarks** | 标记重要位置 | 标记「待精读」「已输出」 |
| **Bases** | 动态看板（官方插件） | 替代 Dataview 做简单聚合 |

### 3.3 使用 Properties 统一管理状态

每篇 v2 索引笔记统一使用以下 frontmatter：

```yaml
---
title: "笔记标题"
source: "wechat|web|gemini|chatgpt"
source_path: "相对路径指向原始文件"
html_path: "相对路径指向原始 HTML（如果有）"
original_url: "原文链接"
published_at: "发布时间"
collected_at: "采集时间"
theme: "AI工具"           ← 13 个主题之一
status: "triaged"         ← inbox→triaged→distilled→linked→used→archived
priority: "medium"        ← high / medium / low
projects: ["OnlineVault"] ← 关联项目
tags: ["tag1", "tag2"]
summary: "一句话摘要"
---
```

#### 状态流转图

```
inbox ──→ triaged ──→ distilled ──→ linked ──→ used
                         │                        │
                         └──→ archived (弃用/过期) ←─┘
```

---

## 四、HTML 查阅方案

这是你的核心需求之一：Gemini（2689 篇）和 ChatGPT（404 篇）都是 HTML 格式，Obsidian 原生不渲染 HTML。以下是四种方案：

### 方案 0：v2.html 统一搜索入口（★ 新推荐）

`v2/v2.html` 是 v2 层的主入口，在浏览器中打开即可：

- 顶部导航栏：13 个主题按钮，点击即可按主题筛选
- 中央搜索框：输入关键词，全库全文检索，结果按相关度排序
- 结果卡片：每个结果包含标题（带关键词高亮）、来源渠道、主题、日期、摘要、原文链接、本地文件链接
- 自动加载 `online-vault-index.js`（37MB 全量索引），直接在浏览器中完成搜索

**推荐理由：** 不需要 Obsidian、不需要插件，浏览器打开即用。搜索速度极快（浏览器内存中匹配），同时支持打开本地 HTML 文件或跳转原始链接。

### 方案 A：HTML Reader 插件（Obsidian 内打开 HTML 文件）

```
[HTML Reader](https://github.com/nickmilo/HTML-Reader) 插件
让 Obsidian 直接在编辑器中渲染 .html 文件

操作：Obsidian → 设置 → 社区插件 → 搜索 HTML Reader → 安装 → 启用
之后在 Obsidian 里点击 .html 文件会自动渲染出内容
```

**优点：** 最简单，零配置
**缺点：** 部分复杂 HTML（含 JS 交互的）可能渲染不完整

### 方案 B：预览模式下嵌入 iframe（备用方案）

Gemini/ChatGPT 的 HTML 结构简单（纯文本对话），可以用 Obsidian 的 `iframe` 嵌入：

```markdown
<iframe src="../../gemini-vault/html/items/gemini-0015bd1f726e.html" width="100%" height="600px"></iframe>
```

**优点：** 不依赖第三方插件
**缺点：** 每次都要写 iframe 标签

### 方案 C：Claude Code 批量转换精华 HTML→MD

```bash
# 由 Claude Code 执行：对 Gemini/ChatGPT 会话批量提取摘要
# 生成 MD 摘要笔记存入 v2 对应主题
# 原始 HTML 不动，只创建引用
```

**流程：**
1. 保留原始 HTML 在第1层（不动）
2. 在 v2 主题文件夹中生成 `.md` 摘要笔记，`html_path` 指向原始 HTML
3. Obsidian 中看 MD 摘要，需要细节时用 HTML Reader 打开原始 HTML

### 方案 D：一键用默认浏览器打开

在 Obsidian 的索引笔记中，值为 URL 格式的链接会自动可点击：

```markdown
[在浏览器中打开](<file:///absolute/path/to/xxx.html>)
```

### 我的推荐：方案 A + C 组合

| 使用场景 | 推荐方式 |
|---------|---------|
| 日常浏览全量 HTML | 方案 A：HTML Reader 插件 |
| 重点会话精读 | 方案 C：Claude Code 提取摘要转为 MD |
| 偶尔查原始文件 | 点击 `html_path` 属性值直接打开 |

---

## 五、Claude Code + Obsidian 深度集成

### 5.1 工作模式

```
┌──────────────┐          ┌──────────────┐
│   Obsidian   │ ◄──────► │  Claude Code │
│  （GUI/浏览） │  文件系统  │  （AI 引擎）  │
│  图谱/编辑   │  同目录    │  批处理/分析  │
└──────────────┘          └──────────────┘
       │                        │
       │  打开同一文件夹          │  读取/写入 .md
       ▼                        ▼
   ┌────────────────────────────────────┐
   │      online-vault/ (同一个目录)       │
   │    v2/ + obsidian-workspace/       │
   └────────────────────────────────────┘
```

**原理：** Claude Code 和 Obsidian 操作的是同一个文件系统。Claude Code 读取/写入 `.md` 文件，Obsidian 自动检测变化并刷新。

### 5.2 Claude Code 的 8 大任务场景

| # | 场景 | 命令/提示词 | 频率 |
|---|------|------------|------|
| 1 | **批量建 v2 索引** | 遍历 13 主题 × 4 渠道，为每篇文章在 `v2/主题/渠道/` 下建索引笔记 | 一次性 |
| 2 | **HTML→MD 摘要** | 读取 Gemini/ChatGPT 的 HTML，用 AI 提炼摘要为 MD | 按需批量 |
| 3 | **跨主题交叉引用** | 检测内容相似的文章，在 `related` 字段加双向链接 | 每周 |
| 4 | **主题 MOC 维护** | 更新 `v2/AI工具/_index.md` 的统计、趋势、新收录 | 每周 |
| 5 | **智能搜索问答** | "从交通工具中找出和 ROS 机器人相关的文章" | 随时 |
| 6 | **内容复用** | 提取某主题精华，生成公众号选题/卡片/文案 | 按需 |
| 7 | **健康检查** | 检查 v2 中有无断链、状态异常、缺失字段 | 每月 |
| 8 | **知识图谱分析** | 分析各主题之间的关联密度，发现知识盲区 | 每月 |

### 5.3 具体操作示例

**任务1：批量生成 v2 索引笔记**

```bash
# Claude Code 执行（在 online-vault 目录下）
# 读取 wechat-vault/md/AI工具/ 下的所有 MD
# 为每篇在 v2/AI工具/wechat/ 生成索引笔记
# 保留原始文件不变
```

**任务2：跨主题智能搜索**

```
用户："从所有渠道找出和 Obsidian 工作流相关的内容"
Claude Code：
  → 搜索 v2/**/*.md 中 title/summary/tags 含 "Obsidian" 的笔记
  → 按 source 分组，输出汇总列表
  → 分析分布：WeChat 3篇、Web 2篇、Gemini 1篇
  → 建议：将这些笔记关联到 _index.md 的「工具链」板块
```

**任务3：精选提炼**

```
用户："从 AI工具/ 中选 5 篇最值得读的"
Claude Code：
  → 扫描 v2/AI工具/**/*.md
  → 按 relevance、source 质量、时效性排序
  → 推荐 top 5，生成简介卡片
  → 更新 _index.md 的「精华推荐」板块
```

---

## 六、日常知识管理工作流

### 6.1 每日工作流（15 分钟）

```
1. 打开 Obsidian → 打开 online-vault 工作库
2. 查看 00-Home.md 看板 → 关注「待处理队列」
3. 快速浏览 3-5 篇新收录资料的摘要
4. 标记 high/medium/low 优先级
5. 如果发现精华内容，拖入「精华精选」文件夹

Obsidian 操作：Quick Switcher (Cmd+O) → 搜索 → 修改 Properties
```

### 6.2 每周工作流（30-60 分钟）

```
周一早上：
1. 运行 Claude Code 健康检查
2. 处理上周新增资料的 v2 索引
3. 更新 13 个主题的 _index.md（新收录 + 统计变化）
4. 检查状态流转（inbox → triaged → ...）
5. 生成「本周关注」清单

周五下午：
1. 回顾本周标注的精华
2. Claude Code 生成周报草稿
3. 清理待处理队列
4. 更新 Canvas 图谱
```

### 6.3 月度工作流（1-2 小时）

```
1. 全库状态审计（Claude Code 执行）
   - 断链检查
   - 孤儿笔记检测
   - 各主题增长统计
   - 精华率分析（精华/总数）

2. 知识图谱优化
   - 补充缺失的交叉引用
   - 合并重复/相似主题
   - 调整标签体系

3. 项目关联审计
   - 更新 Projects 页面
   - 标记已输出内容
```

---

## 七、实施路线图

### 第一阶段：基建（一次性，1-2 天）

```
□ 确认 13 个主题的最终列表
□ 创建 v2/ 目录结构（13 个主题文件夹 + 4 个渠道子文件夹）
□ 安装 Obsidian 必需插件
□ 配置 .obsidian 核心设置
□ Claude Code 扫描全库，生成 v2 索引笔记
□ 测试 HTML Reader 插件打开 Gemini/ChatGPT HTML
```

### 第二阶段：首批内容整理（批量，2-3 天）

```
□ 为 6412 条资料建立统一 frontmatter（Claude Code 批量执行）
□ 生成 13 个 _index.md 主题入口
□ 生成 13 个 _dashboard.canvas 图谱
□ 标注首批精华内容（~100 篇高价值资料）
□ 建立跨主题交叉引用
```

### 第三阶段：工作流上线（持续）

```
□ 建立每日/每周处理节奏
□ 配置 Claude Code 调度任务（如每周自动更新 MOC）
□ 优化知识图谱和标签体系
□ 开始内容复用输出
□ 每月健康检查与优化
```

---

## 八、技术要点与注意事项

### 8.1 路径问题

Obsidian 使用**相对路径**时要注意：
- Obsidian 工作库路径默认基于 `.obsidian` 所在目录
- 如果 `v2/` 和原始 `wechat-vault/` 在同一层级，相对路径可用 `../wechat-vault/xxx`
- 更好的方式：将 `v2/` 和原始 vaults 放在同一个 Obsidian vault 中

**推荐做法：** 将整个 `online-vault` 目录（包含 v2 和原始 vaults）设为 Obsidian vault。这样所有文件都在一个 vault 内，图谱、搜索、引用全部跨目录可用。

### 8.2 .obsidianignore 配置

如果不需要索引原始 HTML 文件夹（提高性能），可以配置：

```
# .obsidianignore
wechat-vault/html/
web-vault/html/
gemini-vault/html/
chatgpt-vault/html/
```

只索引 `.md` 文件和 `v2/` 目录。

### 8.3 性能优化

6412 条数据的 obsidian 工作库需要注意：

- 关闭「自动更新图谱动画」（设置 → 图谱 → 动画）
- 将 HTML 文件夹加入 `.obsidianignore`
- 按主题分批打开 Canvas，不要一次性加载全库
- 使用 Properties 搜索替代全文搜索（更快）

### 8.4 v2 与 obsidian-workspace 的关系

| 对比项 | v2/ | obsidian-workspace/ |
|-------|-----|-------------------|
| 定位 | 全量索引层 | 智能精选层 |
| 覆盖范围 | 全部 6412 条 | ~90 条精选（可扩展） |
| 数据结构 | 统一的轻量索引笔记 | 深度加工的笔记 + 看板 |
| 维护方式 | Claude Code 批量维护 | 人工 + Claude Code |
| 是否必需 | 是（新的整理替代方案） | 已有，可继续使用或废弃 |

---

## 九、获取最大效能的 5 个关键建议

### ⭐ 建议 1：让 Obsidian 管浏览，Claude Code 管处理

不要试图在 Obsidian 里完成所有操作。Obsidian 擅长**看**和**连**，Claude Code 擅长**批**和**搜**。两者分工：

| 操作 | 用谁 |
|------|-----|
| 浏览知识图谱 | Obsidian |
| 查看笔记内容 | Obsidian |
| 手动加链接 | Obsidian |
| 批量生成索引 | Claude Code |
| 跨主题搜索 | Claude Code |
| 内容提炼 | Claude Code |
| 健康检查 | Claude Code |

### ⭐ 建议 2：善用 Properties 而非文件夹

13 个主题用**文件夹**分，但跨主题属性（status、priority、project）用 **Properties** 标记。这样 Dataview 可以按任何维度查询。

### ⭐ 建议 3：建立「精华精选」通道

6412 条文章中，真正高价值的大约 5-10%。建立筛选通道：
```
原始采集 → 自动分类 → AI 初筛 → 人工精选 → 精华区 → 输出复用
```
每篇进入精华区的文章都值得写一段摘要 + 关联项目。

### ⭐ 建议 4：用 Canvas 替代传统目录

Obsidian Canvas 是比文件夹更好的知识导航方式。为每个主题建一个 Canvas：

- 中心节点：主题入口
- 环绕节点：子话题、关键文章、关联项目
- 连线标签：关系类型（"引用"、"延伸"、"对比"、"输出"）

### ⭐ 建议 5：HTML 用「摘要笔记 + 原文引用」双通道

不要期望在 Obsidian 里完美渲染 HTML。最佳实践：
1. 保留原始 HTML 在源目录
2. 在 v2/ 里创建 MD 摘要笔记
3. 摘要笔记的 Properties 里存 `html_path`
4. Obsidian 里看摘要 + HTML Reader 打开原文件
