# Final review fixes — I1–I7, M2

日期：2026-08-18  
范围：验证并修复 `reviews/final.md` 的七项 Important；补齐 M2；M1 仅做证据裁定。未修改 Git index、HEAD、branch 或 commit。

## 结论

逐项复核确认 I1–I7 均是当前实现中的真实行为缺口，不是仅靠代码风格或推测得出的建议。修复后，普通实验、教程证据、传感器说明、二维教学 CFD 代理、运行元数据、粒子质量切换与固定种子 reset 都有直接行为测试。最终统一门禁为 29 个 Vitest 文件、193 个测试全绿；完整 Chromium 矩阵通过真实 Worker、真实 UI、真实 WebGL 恢复和真实下载验证了控制、响应式布局与新 Cp/原因/逐样本 CSV 链路。

## 技术验证、根因与修复

### I1 — 普通实验生命周期

- 复核：成立。原 runtime 只产生 telemetry，普通实验缺少稳定/采样计时 owner，实际会停在 `ramping`。
- 根因：阶段 reducer 暴露转换，但没有任何 runtime 根据仿真帧质量和仿真时间调用这些转换。
- 修复：`simulationRuntime` 成为普通实验唯一阶段 owner；只接受有限、正向且不超过 1 s 的仿真 `dt`，依次执行稳定 2 s、采样 4 s。暂停和 hidden 期间不调度仿真步，也不补算墙钟时间；sampling 失稳回到 stabilizing 并清空连续窗。sweep 继续由独立 reducer 拥有，避免双 owner。
- 回归：覆盖完整 lifecycle、pause/resume、hidden、不补算、1.95 s 后 transient、3.95 s sampling transient、异常 timestamp。

### I2 — exact 30% 连续稳定证据

- 复核：成立。旧 evidence 只看下一帧，并会跨 transient、frame 间 30→31→30、reset 或新 run 拼接时间。
- 根因：证据没有 run revision，也没有把 previous/next 两端、phase、quality、command 和 `dt` 同时作为连续窗口条件。
- 修复：`manualRunRevision` 在新 run、实际功率变化和 reset 时递增；App 在 telemetry early-return 之前清 evidence。只有 previous 与 next 都是 active、stable、exact 30%，且 `0 < dt ≤ 1 s` 才累加；第一帧只建立 revision 窗口。普通实验和 sweep 的 sampling transient/功率错配同样清空 telemetry/proxy 连续窗。
- 回归：覆盖 active/paused retarget、1.95 s 失稳、3.95 s sampling 失稳/错功率、frame 间命令往返、reset、completed→new run、hidden/pause 与异常 timestamp。

### I3 — 传感器教学说明与 evidence 时机

- 复核：成立。原“查看”只写 evidence，没有可见说明内容。
- 根因：卡片按钮被当成一次性 tutorial event，而不是 disclosure 控件。
- 修复：四类卡片均使用原生 button、`aria-expanded`/`aria-controls` 和命名 region。展开内容包含定义、单位、20 Hz、模拟来源、固定种子噪声、延迟和漂移；仅从关闭变为打开时写 evidence，收起不重复写入。
- 回归：键盘 Enter 打开/收起、可访问 region、全部教学字段与回调次数均有组件断言。

### I4 — 真实且诚实的 CFD ↔ 虚拟传感器代理

- 复核：成立。旧表格只把虚拟载荷与自己的 `v²` 基线比较，没有消费 LBM 场，也没有偏差原因。
- 计划修订：实施计划新增 authoritative final-review amendment，并更新 TutorialEvidence、HUD 与 report/CSV 章节；旧 `selectedLargestResidual: boolean` 和 `v² baseline` 说明不再是交付合同。
- 代理定义：固定参考窗 `u=[0.15,0.30), v=[0.70,0.85)`，固定车底窗 `u=[0.40,0.65), v=[0.70,0.85)`；`Δp_lu = mean(p_under)-mean(p_ref)`；`Cp_CFD = ΣΔp_lu / Σ(0.5·u_actual²)`；`Cp_sensor = Σp_underbody_Pa / Σ(0.5·1.225·v²)`；残差 `|Cp_sensor-Cp_CFD|`，并报告相对 `|Cp_sensor|` 的归一化百分比。
- 诚实边界：CFD 侧使用格点单位、传感器侧使用 Pa；先各自无量纲化，绝不直接相减 lu 与 Pa；文案明确它是二维固定窗口教学 proxy，不是载荷 N、Cd/Cl 或三维工程预测。
- 配对：flow request 时冻结 telemetry sequence、sweep revision 与 condition；response 在 `acceptFlowFrame` 原子接收时从当前/history 精确取 request-time telemetry 并立即捕获。later `acceptFrame` 不再合成代理。只接受同 run、同 condition、sampling、stable、exact power、fresh flow id；start/cancel/reset/retry 使旧 async response 失效。
- 样本门槛：每档至少五个独立 solver 帧。4 s telemetry 窗不足时继续等待真实帧，sampling-local 15 s 才失败；不复用、不伪造、不降低门槛。聚焦 E2E 曾暴露“慢 ramp 消耗 proxy 等待预算”，新增 unit RED 后将等待上限从总 condition 时间改为 sampling-local 时间。
- 教程/报告：第 6 章解释 Cp/单位/归一化；必须选择实际最大残差并填写非空原因才完成/导出。报告可打印，CSV 冻结公式、reason、selected/computed power、summary 与 raw proxy numerators/denominators。

### I5 — 实际 runtime metadata 单一来源

- 复核：成立。旧 HUD 从请求 profile 猜网格/入口，CSV 默认写 240×96；这会误报 timeout 降档和 NON_FINITE 0.8 recovery。
- 修复：client 暴露真实 generation/config identity；store 以单次原子写入接受 flow frame 与 metadata：accepted id、generation、frame grid、tau、requested/actual inlet、velocity scale、numerical recovery、rebuild reason、request telemetry sequence/power、sweep revision/condition 和 provenance。
- 恢复原因：记录 `initial`、environment/performance/timeout downgrade、context restore、manual restart 与 non-finite restart。HUD/报告读取最后 accepted metadata，不从 activeQuality 反推。
- sweep 真实性：每个 raw proxy sample 冻结实际 runtime configuration。summary 只以 generation/grid/tau/scale/recovery/rebuild reason 判断 mixed；逐帧自然变化的 requested/actual inlet 不会误判 mixed，而是独立报告 min/max range。
- CSV：top-level grid/generation/scale/recovery/rebuild 从整次 raw proxy 判断 single/mixed；`latestAccepted*` 另列，避免用最终帧冒充前面工况。`CFD_PROXY_SAMPLES` 区段逐行导出 flow id、时间、工况、两个 numerator/denominator、generation/grid/tau/requested/actual inlet/scale/recovery/rebuild reason，因此可复算 Cp 并审计降档。

### I6 — 粒子 count 原子一致

- 复核：成立。首次 mount 的 buffers 不会随 count 改变，R3F host 的固定 instance capacity 也不能靠 `mesh.count` 扩容。
- 修复：count 变化时在 layout effect 中重建 positions/stalled buffers、同步 matrices 和 `mesh.count`；`key={count}` 重建底层 host capacity。正常 `useFrame` 热路径不新增分配。
- 回归：300→1400 与 1400→900 均验证 host 重建、恰好写入新 count 个矩阵及最后索引。详细 RED/GREEN 见 `final-fixes-aux.md`。

### I7 — reset 的固定 PRNG 初态

- 复核：成立。旧 reset 未恢复 PRNG，并通过 `step(0)` 消耗四次随机数、推进 sequence。
- 修复：PRNG 保存规范化 initial state 并显式 reset；simulation reset 同时恢复物理状态和 delay queues，直接返回无噪声 sequence-0 零帧，不调用采样。
- 回归：同 source 运行 80 帧、reset、重复同命令后逐帧对象完全相等；另断言 exact zero reset frame。详细 RED/GREEN 见 `final-fixes-aux.md`。

### M2 — README；M1 — 性能裁定

- M2 已补根 README：完整依赖 engine 交集 `^22.22.2 || ^24.15.0 || >=26.0.0`、npm 命令、浏览器/E2E 范围、无硬件声明、模拟/二维教学边界、exact E2E 倍率、降档与已知 chunk warning。
- M1 保持 parked：没有测量证据支持在最终修复轮重写 transport 或 Three 热路径。I6 修复仍保持 `useFrame` 无 React setter/新增分配。build 的 `WindTunnelScene` >500 kB warning 是已记录的非阻塞后续性能项。

## TDD RED → GREEN 证据

| 范围 | RED（先运行） | GREEN |
|---|---|---|
| I1/I2 manual runtime/evidence | 新 lifecycle/late-transient/abnormal-dt/command-revision 测试分别出现 `expected stabilizing/completed` 但仍为 `ramping`、旧 stableSeconds 未清零 | runtime、store、dashboard 与 App 聚焦套件全绿；最终全量包含这些回归 |
| I3 disclosure | 查询命名 sensor explanation region 失败，evidence 在没有说明内容时已写入 | Dashboard 聚焦测试通过，键盘 disclosure 与 open-only callback 受保护 |
| I4 request-time pairing + continuous sweep | `npm test -- --run src/features/experiment/labStore.test.ts src/features/sweep/sweepRunner.test.ts`：4 failed / 27 passed；立即配对为空、旧 run revision 未变化、transient 误完成、4 个 proxy 样本误完成 | 同组及 flow runtime 后续 39/39 通过；最终 sweep/store 32/32 通过 |
| I4 Cp proxy/config | proxy 首次 RED：mixed configuration 字段为 undefined；第二轮 RED：仅 inlet 变化被误判 mixed | `cfdSensorProxy.test.ts` 5/5 通过，真实 config change 与 inlet range 语义分离 |
| I4 report/export | `ExperimentReport.cfd.test.tsx` 2/2 failed：找不到 Cp 公式/列，export input 缺 reason/flow；raw proxy 第二轮也按预期缺失 | report/CSV 聚焦 24/24 通过，含 immutable raw sample/config snapshot 与正确选择门槛 |
| I5 rebuild reason | `flowRuntime + App`：2 failed / 14 passed，metadata 的 initial/timeout reason 均为 undefined | I5 聚焦组合 59/59 通过；HIGH→MEDIUM→LOW 最终帧为 `timeout-downgrade` |
| E2E real cadence | 首轮 tutorial：60% 报“未获得足够同步 CFD 样本”；unit mutation 显示 slow ramp 后 4 s/4 frames 被总 condition timeout 错杀 | sampling-local timeout 修复后 unit 13/13；真实 Chromium tutorial 1/1，59.5 s |
| I6/I7 | I6 两轮均 2/2 RED（旧 buffer、未重建 host）；I7 2 failed / 2 passed（噪声 reset frame、replay 不同） | I6 2/2、I7 4/4；见辅助报告原始输出 |

## 最终验证

```text
npm test -- --run
Test Files  29 passed (29)
Tests       193 passed (193)

npm run lint
eslint .
exit 0

npm run build
tsc --noEmit && vite build
exit 0
备注：仅保留已知的 Three/WindTunnelScene >500 kB 非阻塞 warning

npx playwright test e2e/tutorial.spec.ts --project=chromium
1 passed (1.1m)，测试主体 59.5s

npm run test:e2e
6 passed (2.3m)，使用 1 worker；完整 controls/context/desktop/tablet/mobile/tutorial 矩阵

git diff --check -- .
exit 0；无输出
```

第一次在受限 sandbox 启动 Playwright server 得到 `listen EPERM 127.0.0.1:4173`；按权限流程在允许本地 server 的环境重跑后通过。这是执行环境限制，不是产品失败。

## 改动文件

- lifecycle/evidence/store：`src/App.tsx`、`src/features/experiment/labStore.ts`、`simulationRuntime.ts`、`src/features/dashboard/evidenceRecording.ts` 及对应测试。
- sensor/HUD：`TelemetryCards.tsx`、`FieldSelector.tsx`、`Dashboard.test.tsx`、`src/styles/global.css`。
- CFD runtime/proxy：`flow/types.ts`、`LbmWorkerClient.ts`、`flowRuntime.ts`、新增 `cfdSensorProxy.ts` 及对应测试。
- sweep/report/export：`sweepRunner.ts`、`ExperimentReport.tsx`、`csv.ts`、对应 focused 测试与 `e2e/tutorial.spec.ts`。
- tutorial/plan：`tutorialProgress.ts`、`lessonDefinitions.ts`、`TutorialRail.test.tsx`、`docs/superpowers/plans/2026-08-18-digital-wind-tunnel-web.md`。
- I6/I7/M2：`FlowParticles.tsx`、`SimulationSource.ts` 及测试、根 `README.md`；详见 `final-fixes-aux.md`。
- ledger/report：本 progress ledger 与本报告。

## 残留

- 无未解决的 I1–I7 或 M2 finding。
- M1 继续作为需先测量再决策的性能后续；当前仅有已知 build chunk warning。
- 完整 Chromium E2E 验收矩阵已在下述稳定性收口后通过。

## E2E 稳定性收口与最终浏览器门禁

### 复现与根因

- 默认 `npm run test:e2e` 在未限制 workers 时使用三个并发页面，RED 为 2 failed / 3 passed。失败会在 free-lab context recovery、desktop 全页截图和 tablet focus 之间移动；desktop 单独运行仍需约 24.7 s。每个页面同时初始化 WebGL renderer 与 LBM Worker，三实例争用 GPU/CPU 是并发矩阵不稳定的直接条件，而产品实际只运行单实例。
- `VITE_E2E_TIME_SCALE=20` 会让普通实验约 0.5 s 墙钟时间完成。原 free-lab / responsive 测试在 Start 后执行多次等待或重新遍历焦点，偶尔已进入 `COMPLETED` 才点击 Pause；测试现于真实 transient phase 内立即暂停，仍明确断言 start/resume 的“升速中”、暂停/恢复、RPM、采样时间和键盘焦点。
- 场选择 trace 显示质量降档重建期间 pressure radio 会短暂 enabled→disabled→enabled，单次 click 可被丢弃。重试逻辑每次都要求真实按钮 enabled，执行真实 click，并最终要求 `aria-checked=true`；没有绕过业务状态或降低最终断言。
- context restore trace 还发现一个产品缺口：新 canvas 已插入且旧 canvas 已断开后，旧 R3F Canvas dispose/`forceContextLoss` 仍可经残留 listener 再触发 lost，导致恢复 overlay 重新出现。专属单元测试先同步注入 stale old-canvas loss，得到预期 RED：1 failed / 3 passed，`onLost` 实际调用 2 次。

### 最小修复与 GREEN

- `playwright.config.ts` 固定 `workers: 1`，与单实例产品契约一致；保持原 30 s test timeout、120 s suite timeout 和全部行为断言。
- free-lab 拆为 controls 与真实 context recovery 两个独立验收场景，并统一捕获 console error / pageerror；仍使用真实 `WEBGL_lose_context`、canvas 替换、READY/live field 与 reset 对话框。
- `webglContextRecovery` 的 restore handler 在调用 `onRestored` 前一次性失活并移除旧 canvas listeners。随后旧 canvas 的 stale loss 不再可达；focused Vitest GREEN 为 4/4。
- focused browser GREEN：controls 1/1（21.0 s）；context restore 1/1（12.3 s）。
- 最终完整 GREEN：`npm run test:e2e` 使用一个 worker，6/6 通过（2.3 min）：controls 20.4 s、context restore 11.6 s、desktop 24.7 s、tablet 11.9 s、mobile 8.4 s、tutorial 58.4 s。
- 完整门禁后的 build 额外抓到 test-only 类型 RED：Playwright locator callback 的参数是 `HTMLElement | SVGElement`，不能无条件调用 `.click()`。增加真实 `HTMLButtonElement` guard 后 build GREEN；受影响 controls 浏览器用例再次 1/1 通过（20.3 s，测试主体 15.1 s）。

本轮没有抬高 timeout、删除真实 WebGL 操作、伪造 store 数据或弱化 READY/canvas/keyboard/responsive/tutorial/CSV 断言。一次中间 tutorial 失败发生在其他最终修复源码仍通过 Vite HMR 写入时；工作区静止后的完整矩阵为上述 6/6 结果。
