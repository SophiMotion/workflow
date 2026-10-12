# BOSS 招聘执行与记录

## 当前能力（2026-10-03 修复）

Codex 任务可以通过电脑使用工具在**内置浏览器**执行招聘操作。内置浏览器有独立登录会话；Edge 或 Chrome 已登录，不代表内置浏览器已登录。登录失效、安全验证、付费或额度限制时停止对应操作，保存真实进度。

此目录的本地控制台是另一个独立入口，**尚未接通可核验精确聊天的发送适配器**。它不会自动接管 Codex 内置浏览器，也不会因为端口可达或启动进程成功就宣称邀约完成。`node start.js` 当前会明确返回连接缺项，不发送消息。

原有独立浏览器采集入口保留，须另有已配置的专用本地连接。不会复制 Edge/Chrome 资料，不会自动启动或置前原生浏览器。Codex 对话中的实际网页操作使用 Codex 电脑工具，不运行此入口接管网页。

## 数据与岗位

权威数据目录：`/Users/wubo/Documents/2026-2/sophistudio/boss/boss-1/boss`。

读取 `recruitment-config.json` 的活动岗位和本任务最新明确授权。10 月 3 日最新四岗为 3D 打印、车辆结构、机器人导航算法、电控；历史人员保留。新增岗位、最新完整职责、话术确认必须有真实证据。

## 发送流程

1. 核验当前岗位的完整职责并记录 `requirementsVerifiedAt`，不能由本地旧职位名称代替。
2. 每岗位比较当天至少 100 个稳定候选人 ID 的已阅读资料。采集储备、摘要阅读、完整简历核查分别记录。
3. 为拟联系者核验完整简历、稳定身份及历史对话，保留职业匹配证据和待核实项。不要用年龄、性别、婚育、民族、照片等排序。
4. `comparisons` 保存当天比较的样本和入选记录；`selectedRecordIds` 只包含已核查拟联系者。
5. 发送之前调用 `beginSend`：重新读取共享记录、去重、检查不再联系/待核验/今日额度，并持久记录精确话术。
6. 正常网页操作发送后，核验正确候选人的聊天、岗位、精确消息和时间，再调用 `finishSend`。通用成功弹窗、推荐卡变化、列表新增都不能单独证明送达。
7. 中断或结果不明确时保留 `unknown` 和 `retryBlocked`。先核实原对话，禁止再次点击发送。
8. 每批阅读、每次发送后保存数据；复用原数据目录的同步脚本更新 Excel 和 HTML。原有记录及人工字段不覆盖。

每日两个时段共用 Asia/Shanghai 日期额度。当前先达到每岗 20 位不同且匹配的候选人；不足仍为未完成，不凑数。已归档或其他执行方的历史记录不删除，也不冒称本轮发送。

## 记账接口

`engine/safety.js` 为实际执行方提供 `beginSend`、`finishSend`、`checkSendEligibility`、`withExecutionLock`。这些函数只处理记录，不替代网页操作或产生真实页面证据。

入选记录需包含：稳定 `candidateId`（或已有稳定 `candidateKey`）、`identityVerified: true`、`reviewLevel: "详细"`、`detailedReviewedAt`、`evidence`、`fullResumeEvidence`。

`comparisons` 条目需包含 `roleId`、中国日期 `date`、`comparedAt`、本轮职责原文 `requirements`、`sampleRecordIds`、`selectedRecordIds`。样本记录各自按 `reviewedAt` 统计实际中国日期。

`finishSend` 的证据对象格式：

```js
{
  type: 'chat_message', candidateId, roleId, message,
  sourceUrl: 'https://www.zhipin.com/web/chat/index',
  sentAt, verifiedAt
}
```

所有字段均来自实际观察。不能用计划发送时间、配置话术或候选人姓名猜填证据。缺少可确认的消息时间或身份时仍保留待核验。

独立程序如需执行队列，必须向 `runPreparedQueue` 提供实际可验证的 `selectRole`、`prepareCandidate`、`sendApprovedGreeting`、`verifySentMessage`。当前没有生产适配器；测试中的假浏览器仅用于离线验证，不能证明线上已打通。

## 运行与检查

```bash
npm test                     # 离线回归测试，不操作真实网页、不发送消息
node start.js                # 当前明确报告发送连接尚缺，不点击发送
node start.js --dry-run       # 独立专用浏览器的采集测试，不发送、不写数据
node start.js --no-send       # 独立专用浏览器采集储备，不计为实际已阅读
node server.js               # http://127.0.0.1:8771/boss-workbuddy.html
```

付费发送入口不支持。独立浏览器存在多个 BOSS 标签时须明确 `BOSS_TARGET_ID`；不得随意选择第一个标签或其他网站。

## 并发与恢复

发送队列使用 `.recruitment-execution.lock`，每次数据事务使用 `.recruitment-data.lock`，同时检查已有同步/心跳锁。数据读取后有改变则停止写入。进程退出后遗留的锁不自动删除，须确认原执行方已停止并核查待发送记录。

旧版 WorkBuddy 或其他不遵守同一锁约定的程序仍可能并发操作。不要同时运行多个发送器；恢复前核查最新日志、`sendAttempts`、`uncertainSends` 和外部执行审计。锁不能替代跨执行方核对。

测试覆盖切岗残留列表、岗位名称歧义、错误标签页、登录失效误判、逐条发送记账、完整简历门槛、100 个不同样本、跨岗位去重、停止联系、未知发送、上海日期额度和执行锁。尚未完成真实账号的端到端发送验收；不承诺固定耗时或平台额度。
