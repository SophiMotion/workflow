# Task 6 实施报告：可重启 LBM Worker 与 Flow Runtime

## 结果

已实现可重启的 LBM Web Worker、严格的 discriminated-message 协议、1,500 ms 请求超时、generation 隔离、transferable buffer 生命周期，以及 10 Hz 无重叠 flow runtime。Zustand store 现提供 `flowField`、`flowStatus`、`flowError`、`eventLog`；所有流场继续带 `provenance: "2d-teaching-cfd"`，异常恢复日志明确标为“二维教学 CFD”。

## TDD：RED

先创建 `LbmWorkerClient.test.ts` 与 `flowRuntime.test.ts`，未创建生产模块时运行：

```text
npm run test:run -- src/features/flow/LbmWorkerClient.test.ts src/features/flow/flowRuntime.test.ts
Test Files  2 failed (2)
Tests       no tests
```

失败原因分别是无法解析 `./lbm.worker`、`./LbmWorkerClient`，与待实现功能缺失完全一致，不是测试语法或环境错误。

## TDD：GREEN 与 mutation 验证

实现后同一聚焦命令通过 13/13；补充 Worker 自身数值错误映射测试后，client/protocol 文件为 8/8。

对 `postFailure` 做受控 mutation，把 `NON_FINITE_FIELD` 临时错映射为 `WORKER_FAILURE`，新用例按预期失败并显示 code 差异；恢复实现后重新运行 8/8 通过。该用例确实保护 Worker error protocol，而非只验证 fake。

逐条复核 restart 语义时，先加入“手动 restart 只清 flowError、不改 flowStatus”的断言；它以 `expected failed / received loading` 得到 RED。删除额外 status 写入后该文件 6/6 GREEN，确保恢复不重置额外 store 状态。

## 实现要点

- `LbmWorkerClient` 构造即发送无 obstacle mask 的 `init`；request id 全生命周期单调递增，默认每帧 4 次迭代。
- 每个 worker listener 捕获 generation；restart/dispose 后，即便旧 listener 被外部保留并再次触发，其 ready/frame/error 也会被丢弃。
- dispose 发送协议消息、清空 listener、terminate，并拒绝全部 pending；worker error 令 client failed、拒绝全部 pending，restart 可创建 replacement 并复用持久配置。
- Worker 在 init 后用 `createCarProfileMask` 构建 mask。每次 frame 从复用的 solver frame 复制五个输出数组，再 transfer 五个副本 buffer；真实 `structuredClone(..., { transfer })` 测试连续请求，证明 transfer 分离副本不会破坏 solver 内部复用数组。
- Runtime 以 100 ms interval 调度；pending 或 `document.hidden` 时跳过。成功只更新教学流场/status，不干扰遥测。
- 首次数值异常保留最后有效帧、追加二维教学 CFD 日志、速度乘 0.8、重启并重试；再次异常或其他错误进入 failed。手动 restart 保留流场与遥测，只清理 flow failure 状态并恢复调度。

## 最终验证（fresh）

```text
npm run test:run
Test Files  12 passed (12)
Tests       48 passed (48)

npm run build
tsc --noEmit + vite build: exit 0

npm run lint
eslint .: exit 0
```

brief 指定回归 `npm run test:run -- src/features/flow src/features/experiment` 亦通过：9 files、35 tests。

## 文件

- `src/features/flow/lbm.worker.ts`
- `src/features/flow/LbmWorkerClient.ts`
- `src/features/flow/LbmWorkerClient.test.ts`
- `src/features/flow/flowRuntime.ts`
- `src/features/flow/flowRuntime.test.ts`
- `src/features/experiment/labStore.ts`
- `.superpowers/sdd/2026-08-18-digital-wind-tunnel-web/reports/task-6.md`

## 自审

- Worker 构造使用 `new Worker(new URL("./lbm.worker.ts", import.meta.url), { type: "module" })`；仅 worker 文件顶部含 Web Worker lib reference。
- 未复制或修改 Task 5 solver/types；Worker 直接复用已审查通过的 `LbmSolver`、mask 与类型。
- 没有把 Worker 实例放入 Zustand；runtime/client ownership 可由后续 App 组合层清理。
- 未创建分支、未 stage、未 commit；未触碰任务范围外文件。

## Fix round 1 — 并发、deadline 与同步 spawn 失败

### 定向 RED

先加入 4 个失败断言并运行两个聚焦文件，得到 `4 failed / 14 passed`：

- replacement restart 延迟 250 ms 时，interval 在 ready 前错误发送了 1 个 frame（期望 0）；
- request-before-ready 经过 1,500 ms 后 rejection 仍为 `undefined`；
- factory 同步抛出 `factory failed` 时异常逸出构造函数；
- replacement 的 init post 抛出 `init post failed` 时异常逸出 `restart()`，未进入可等待的失败状态。

### 修复

- Runtime 增加独立 `restarting` gate。手动 restart 开始即阻止 interval tick；完成后才释放 gate，首个恢复 frame 仍由原 `pending` ownership 保证无重叠。
- `requestFrame()` 调用时立即分配单调 request ID、注册 pending 和唯一 1,500 ms deadline；异步等待 ready 后先检查 pending ownership，超时请求不会在迟到 ready 后发送。
- resolve、protocol/worker reject、restart、dispose 均通过统一 pending 清理路径 clear timer；定向 fake-timer 测试逐条验证 `vi.getTimerCount() === 0`。
- `spawnWorker()` 捕获 factory、listener 安装、init post 的全部同步异常，规范化为 `FlowWorkerError("WORKER_FAILURE", ...)`，reject ready/pending，并对已创建 replacement 清 listener、terminate。
- 首次 factory 失败后 client 仍可 restart 到 replacement 并收到 ready；init-post 失败的 replacement 可观测为 terminated 且两个 listener 均为 null。

### GREEN 与回归

```text
npm run test:run -- src/features/flow/LbmWorkerClient.test.ts src/features/flow/flowRuntime.test.ts
Test Files  2 passed (2)
Tests       19 passed (19)

npm run test:run -- src/features/flow src/features/experiment
Test Files  9 passed (9)
Tests       41 passed (41)

npm run build   # exit 0
npm run lint    # exit 0
```
