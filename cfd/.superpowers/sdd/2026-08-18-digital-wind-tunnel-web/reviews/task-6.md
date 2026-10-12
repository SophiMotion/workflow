# Task 6 Review — Restartable LBM Worker and Flow Runtime

## Spec Compliance

结论：**部分符合，需修改后通过**。

- Worker protocol 的 discriminated union、全生命周期单调递增 request ID、generation 隔离、正常 error/restart/dispose 的 pending rejection 与 listener 清理均已实现。
- Worker 在 `init` 后创建车辆 mask；client 默认请求 4 次迭代；输出复制并 transfer 五个 `Float32Array.buffer`，因此 solver 自身数组可继续复用；frame provenance 保持为 `"2d-teaching-cfd"`。
- Runtime 使用 100 ms interval，正常稳态会跳过 pending/hidden tick；首次 `NON_FINITE_FIELD` 保留最后一帧、写入二维教学 CFD event log、以 0.8 倍速度重启并重试；第二次数值异常或其他错误进入 failed；手动 restart 不清空 flow field、telemetry 或教程状态。
- Store 已包含并重置 `flowField`、`flowStatus`、`flowError`、`eventLog`，且 flow frame 的 provenance 在类型层固定。
- 但手动 restart 的并发窗口破坏 no-overlap，request 的 1,500 ms timeout 不覆盖 ready 等待阶段，spawn/init 同步异常还会遗留永不 settle 的 ready promise 与 listener。上述均属于本任务明确要求的生命周期保证。

## Strengths

- `src/features/flow/LbmWorkerClient.ts:3-19` 的 request/response union 与 `WorkerLike` 边界清晰，error code 没有被字符串化丢失；`src/features/flow/LbmWorkerClient.ts:81-95` 在正常路径中正确关联 ID、promise 与 timeout。
- `src/features/flow/LbmWorkerClient.ts:133-151` 用 generation 与 worker identity 双重检查屏蔽旧 worker 消息；`src/features/flow/LbmWorkerClient.ts:186-198` 在正常 restart/dispose/error 路径清 timer、拒绝 pending、移除 listener 并 terminate。
- `src/features/flow/lbm.worker.ts:25-35` 正确在 worker 内创建 mask；`src/features/flow/lbm.worker.ts:49-59` 使用请求迭代数并保留 request ID；`src/features/flow/lbm.worker.ts:64-84` 复制并 transfer 五个独立 buffer，避免 transfer 使 solver 内部复用数组 detached；`src/features/flow/lbm.worker.ts:87-101` 保留数值异常 code。
- `src/features/flow/flowRuntime.ts:41-76` 的自动恢复主路径保留 last field，并正确区分一次降速重试与最终失败；`src/features/flow/flowRuntime.ts:102-106` 的手动恢复没有重置 store 中的 telemetry、教程进度或最后有效场。
- `src/features/experiment/labStore.ts:10-20`、`src/features/experiment/labStore.ts:33-64` 的 flow state、event log 与 reset 语义完整；`src/features/flow/types.ts:9-17` 在数据模型中固定教学 CFD provenance。
- brief 指定回归命令 `npm run test:run -- src/features/flow src/features/experiment` 当前通过：9 files、36 tests。

## Issues

### Critical

无。

### Important

1. **手动 restart 期间会重新打开并发请求窗口，违反 10 Hz no-overlap，并允许帧倒序覆盖。**

   - 规格意图：上一 frame promise 未结束时必须跳过 tick；手动 restart 后再恢复请求。
   - 实现证据：`src/features/flow/flowRuntime.ts:31-44` 只用一个 `pending` gate；`src/features/flow/flowRuntime.ts:102-118` 开始 restart 时没有设置 restart/pending gate，却在 `await client.restart()` 完成后的 `finally` 无条件写 `pending = false`；与此同时 `src/features/flow/flowRuntime.ts:84-86` 的 interval 始终继续运行。
   - 具体失败序列：replacement 尚未 ready 时 interval tick 进入并把 `pending` 设为 true，`requestFrame()` 等待同一个 ready；ready resolve 后，runtime restart 的 `finally` 先把 `pending` 清为 false，而该 frame 仍未返回。下一 tick 随即发送第二个请求。两个结果若逆序返回，旧帧还可覆盖新帧。
   - 定向验证：使用延迟完成的 fake `client.restart()` 和永不完成的首个 post-restart frame，restart 完成后再触发一个 tick，观测到 `requestFrame` 调用数从 1 变为 2。
   - 建议：增加独立 `restarting` gate，或让 restart/tick 使用带 owner/generation 的 in-flight token；只有拥有该 token 的操作才能清除 gate。补充“restart 超过 100 ms，首个恢复 frame 未完成时后续 tick 仍被跳过”的测试。

2. **1,500 ms request timeout 不覆盖等待 worker ready 的阶段，`requestFrame()` 可永久不 settle。**

   - 规格意图：frame request 在 1,500 ms 后以 `Flow worker timed out` 拒绝，同时 `requestFrame` 在发送前等待 ready。
   - 实现证据：`src/features/flow/LbmWorkerClient.ts:72-73` 先无期限 `await this.ready()`；timeout 直到 `src/features/flow/LbmWorkerClient.ts:81-89` 才创建。若 worker 成功构造但既不发 `ready`/`error` 也不触发 `onerror`，计时器永远不会启动。
   - 定向验证：对不发送任何事件的 `WorkerLike` 调用 `requestFrame(0.04)`，1,650 ms 后 promise 仍为 pending，而不是按规格以 `Flow worker timed out` 拒绝。
   - 建议：从 `requestFrame()` 调用时开始覆盖 ready+frame 的单一 1,500 ms deadline，或给 initialization 明确 timeout 并确保所有等待 request 同步拒绝；补充“request-before-ready 超时”的测试。

3. **replacement 创建/初始化的同步异常绕过 failed 状态与清理，留下 pending ready promise 和 listener leak。**

   - 规格意图：worker failure 应拒绝等待、进入 failed，随后仍可安全 restart；replacement 的生命周期也应可清理。
   - 实现证据：`src/features/flow/LbmWorkerClient.ts:129-153` 先创建新的 `readyDeferred` 并设为 `starting`，但 `workerFactory()`、listener 安装和 init `postMessage()` 外没有异常边界。任一步同步抛错都会直接逸出 `restart()`，没有调用 `fail()`；若 init post 抛错，replacement 已保存且两个 listener 已安装，却未 terminate。
   - 定向验证：让 replacement 的 init `postMessage()` 抛出 `init post failed`；`restart()` 抛错后，`client.ready()` 仍为 pending，replacement 未 terminate，`onmessage`/`onerror` 均仍非 null。
   - 建议：让 `spawnWorker()` 对 factory 与 init post 建立完整 try/catch；失败时将 client 置为 failed、拒绝新 `readyDeferred` 和 pending，并对已创建 worker 清 listener/terminate。补充 factory-throw 与 init-post-throw 两个测试。

### Minor

无。

## Assessment

**Request changes。** 正常协议、transfer ownership、数值异常恢复和 store preservation 的实现质量较好，现有回归也全部通过；但三个 Important 问题分别破坏 no-overlap、1.5 秒 request 上界和 restart failure cleanup，正落在本任务最关键的并发生命周期约束上。修复并增加对应 race/timeout/spawn-failure 测试后再通过。

---

## Fix Round 1 Verification

### Finding 1 — ADDRESSED

**Manual restart race / no-overlap / stale overwrite：已修复原报告中的单次 restart 失败序列。**

- `src/features/flow/flowRuntime.ts:24` 新增独立 `restarting` gate；`src/features/flow/flowRuntime.ts:32-35` 在 tick 入口跳过 restart 期间的 interval。
- `src/features/flow/flowRuntime.ts:103-120` 在调用 `client.restart()` 前先持有 gate，并在 restart settle 后才释放。replacement 等待 ready 时不再排队 frame；释放后首个 frame 由原有 `pending` ownership 继续保证 no-overlap，因此不存在原报告所述的两个同 generation frame 逆序写回窗口。
- `src/features/flow/flowRuntime.test.ts:185-201` 覆盖 restart 延迟 250 ms、ready 前零请求、ready 后首帧未完成时后续 400 ms 不重叠。

### Finding 2 — ADDRESSED

**1,500 ms timeout 覆盖 ready 等待：已修复。**

- `src/features/flow/LbmWorkerClient.ts:72-87` 在 `requestFrame()` 入口立即分配 request ID、注册 pending 与 1,500 ms timer，然后才异步等待 ready。
- `src/features/flow/LbmWorkerClient.ts:157-191` 在 ready 迟到、restart、failed 或 timeout 后均检查 pending ownership；已经超时的 request 不会在迟到 ready 后发送 frame。
- `src/features/flow/LbmWorkerClient.ts:208-239` 在 frame resolve、批量 rejection 与单 request rejection 路径清除 deadline。
- `src/features/flow/LbmWorkerClient.test.ts:219-244` 验证 request-before-ready 在 1,500 ms 准时以 `Flow worker timed out` 拒绝，且未迟发 frame；`src/features/flow/LbmWorkerClient.test.ts:298-353` 验证 resolve/error/restart/dispose 后 timer 均归零。

### Finding 3 — ADDRESSED

**factory/init post 同步异常 cleanup、failed 与 ready settle：已修复。**

- `src/features/flow/LbmWorkerClient.ts:124-154` 将 factory、listener 安装及 init post 包在同一异常边界；异常统一映射为 `WORKER_FAILURE`，调用 cleanup 后进入 `fail()`。
- `src/features/flow/LbmWorkerClient.ts:217-229` 明确 reject ready 与全部 pending；`src/features/flow/LbmWorkerClient.ts:242-255` 清空两个 listener、terminate 已创建 worker，并清除 client worker 引用。
- `src/features/flow/LbmWorkerClient.test.ts:246-271` 验证首次 factory throw 不逸出 constructor、ready/request 均 reject，随后可 restart；`src/features/flow/LbmWorkerClient.test.ts:274-296` 验证 init-post throw 后 ready reject、replacement terminated 且 listener 均为 null。

### New Breakage

在三个 finding 的修复路径及其当前测试中未发现新回归。聚焦命令：

```text
npm run test:run -- src/features/flow/LbmWorkerClient.test.ts src/features/flow/flowRuntime.test.ts
Test Files  2 passed (2)
Tests       19 passed (19)
```

### Out-of-Scope

- 本轮按要求未重新审查 Worker 数值实现、store、provenance 或其他生产代码。
- `FlowRuntime.restart()` 的**重复并发调用语义**不在原三个 finding 的最小序列中，且不是 fix round 1 引入：`src/features/flow/flowRuntime.ts:98-121` 没有合并/拒绝重入。定向实验中，第一次 restart 被第二次 supersede 后 reject、第二次成功，但旧调用的 catch 留下 `failed=true`，后续 tick 不恢复。若恢复按钮可能并发触发，建议后续用共享 restart promise 或 generation owner 守卫 catch/finally；本观察不用于否定本轮三个原 finding 的修复。

### Verdict

**PASS（fix round 1 范围内）。** 三个原始 Important finding 均有直接生产代码修复与针对性回归覆盖；原报告中的阻塞项可关闭。重复并发 restart 语义建议另建后续项。
