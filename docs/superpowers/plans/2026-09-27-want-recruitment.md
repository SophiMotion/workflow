# Want Recruitment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在 SophiStudio 中交付可运行的招聘分类、复核、消息高亮、导出和 Codex 后台评估工作台。

**Architecture:** 同源本地 Node 服务提供记录查询和持久任务队列，读取原招聘 JSON，新增状态独立保存。Codex 仅评估职业资料，结果通过校验后写入；浏览器发送能力独立检查，未连接时明确阻碍。原招聘历史与人工 Excel 保留。

**Tech Stack:** Node.js 22 标准库、原生 HTML/CSS/JavaScript、Codex CLI、Python/openpyxl 导出 XLSX。

**Spec:** docs/superpowers/specs/2026-09-27-want-recruitment-design.md

## Global Constraints

- 默认只监听 127.0.0.1:8770；端口占用不杀进程。
- 四个当前岗位；3D 打印历史保留；统计按 Asia/Shanghai。
- 实际发送成功、待发送、结果不明独立显示；模型无法改写发送状态。
- 不直接控制 ChatGPT 窗口；Codex 使用本机登录，付费 API 不自动回退。
- 每批最多 20 份，初始单并发；复核不修改原始时间或增加新人员阅读数。
- 本地开发原址集成以保留未提交的 SophiStudio 改动和招聘数据；仅提交本次新功能源码，不能将人员资料或凭据纳入 Git。

## Review Focus

- 同名但身份不同：按记录 ID 展示，不自动合并。
- 跨日发送和记录时间缺失：成功数按 sentAt，不按 runId；未知时间保持未知。
- 原资料或职责改变：缓存和模型建议标记过期，不覆盖人工分类。
- 写入并发、服务中断和旧任务恢复：原子保存、锁和状态迁移，不将中断判成功。
- CSV 公式、HTML 标签和未核验消息：转义安全文本，只有核验成功才高亮。

## Task 1: 数据与复核

**Files:** want/store.mjs, want/model.mjs, tests/want.test.mjs.
**Interfaces:** `Store(root).snapshot()` 返回 config/data/state；`Store.mutate(fn)` 串行锁与原子写；`viewRecords(snapshot)`、`filterRecords(records,filters)`、`dashboard(snapshot,scope,now)`；`addReview(id,{category,note,expectedVersion})` 追加复核。

- [x] 写测试验证同名记录独立、上海日期、发送核验、复核不改原招聘 JSON、并发复核均保留、版本冲突被拒绝。
- [x] 运行 `node --test tests/want.test.mjs`，观察缺少模块/功能的失败。
- [x] 实现 sidecar 状态、分类视图、身份与原始状态保护、快照版本。
- [x] 重跑测试，要求上述情形通过。
- [x] 提交本任务源码，不提交人员数据。

## Task 2: Codex 评估队列

**Files:** want/codex.mjs, want/queue.mjs, tests/want-queue.test.mjs.
**Interfaces:** `CodexRunner.status()`；`run(batch,context,{signal,onEvent})`；`Queue.create(ids)`、`pause(id)`、`resume(id)`；结果 schema 为 `{items:[{id,category,evidence,gaps}]}`。

- [x] 测试未知 ID/重复 ID/少返回/过期输入拒收，重启后运行中任务转中断，重复排队不产生双重工作。
- [x] 运行队列测试，观察功能缺失的失败。
- [x] 以固定参数数组调用 Codex，限定为只读、无浏览器权限的评估任务；输出校验、事件持久化、缓存、暂停和恢复、限额阻碍。
- [x] 测试通过后，用少量真实职业资料执行一次 Codex 联调，保留真实状态。
- [x] 提交。

## Task 3: 导出与本地 HTTP

**Files:** want/export.mjs, want/export_xlsx.py, want/server.mjs, tests/want-http.test.mjs.
**Interfaces:** GET `/api/want/snapshot`、GET `/api/want/records`、POST `/api/want/reviews`、POST `/api/want/jobs`、POST `/api/want/jobs/:id/(pause|resume)`、POST `/api/want/export`、GET `/api/want/download/:name`。

- [x] 写测试验证外部 Origin、非法 Host、目录穿越、错误正文及 CSRF 被拒绝；当前筛选导出与页面一致。
- [x] 实现同源 API、请求令牌、大小限制、限定静态资源；HTML/CSV 转义，Excel 导出为新文件并高亮已核验正文。
- [x] 测试导出表格字段、时间、正文与状态对应，复核历史独立工作表；原 Excel 哈希不变。
- [x] 提交。

## Task 4: want.html 工作台

**Files:** want.html, want/public/app.js, want/public/style.css.
**Interfaces:** 仅使用 Task 3 同源接口；页码、筛选、勾选、详情与复核表单、任务队列、导出控件。

- [x] 实现浅色页面：四岗进度、分类摘要、分页列表、详情侧栏、复核历史、已发送正文高亮。
- [x] 显示归档岗位、全部/本轮/今日口径、能力状态；分析按钮明确是 Codex 评估，不表示 BOSS 已发送。
- [x] 浏览器验证筛选→详情→复核→筛选导出；检查桌面、窄屏与空状态。
- [x] 提交。

## Task 5: SophiStudio 集成与运维

**Files:** unit/js/views.js, index.html, tests/workflow-index.test.mjs, scripts/local-services.py, docs/local-services.md, want/README.md, .gitignore.

- [x] 增加工作流卡片，按真实模块数更新计数与缓存版本；扩展现有测试映射。
- [x] 加入 Want 本地服务及启动说明；仅安装本任务服务，不重启其他后台。
- [x] 可用后台 Edge 连接缺失时保存能力说明，不新建假发送执行器；原外部招聘工具仍可通过既有受核验流程继续。
- [x] 运行项目测试与新增测试；确认服务健康与工作流导航。
- [x] 提交本次差异，保留人工修改。

## Task 6: 联调与复核

- [x] 真实 Codex 小批次完成，结构化建议在网页可见；没有成功则报告准确阻碍。
- [x] 当前筛选导出实际可下载并复读；检查消息高亮与原历史保护。
- [x] 使用 frontend-testing-debugging 验证浏览器可见行为。
- [x] 由独立审阅者检查本次改动；修复重要问题并重跑相关测试。
- [x] 报告可运行入口、已验证功能及未连通的 BOSS 后台发送条件。

Execution note: task commits were consolidated into one new-module commit. Existing workflow and service integration edits remain in the working tree to avoid committing preexisting user changes. The final ledger records the file-protocol browser limitation and two deferred minor findings.
