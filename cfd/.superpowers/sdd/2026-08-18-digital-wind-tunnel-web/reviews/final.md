# SophiFlow 数字风洞 Web — 最终全应用高级代码审查

- 审查日期：2026-08-18
- 审查范围：批准 spec、实施 plan、SDD ledger、Task 11 最终报告、完整源码/测试 snapshot diff 与当前对应文件
- 审查方式：只读跨模块静态审查；未修改实现、index 或 HEAD；未重跑 1.3 分钟 Playwright 矩阵
- 已采信 fresh 证据：Vitest 26 files / 154 tests、Playwright 5/5、lint/build/diff-check green、真实 WebGL context loss/restore、真实 CSV 内容、三视口、0 console error/pageerror/unhandled rejection、4173 无残留
- 额外定向证据：无写入 Node 探针确认两个分离的稳定窗口会被累加为 `stableSeconds = 2` 并解锁第 2 章

## Strengths

1. **CFD/遥测 provenance 清楚且未冒充工程级结论。** 顶栏、场景 HUD、报告和 CSV 均持续标注 `SIMULATED / 模拟数据` 与 `2D TEACHING CFD / 二维教学近似`；二维场被明确描述为中心截面趋势，不展示 Cd/Cl、Reynolds 相似或“3D CFD 已完成”。公式采用 `q = 0.5ρv²`，RPM、风速、压力、载荷单位和符号一致（`src/features/experiment/SimulationSource.ts:68-110`、`src/features/dashboard/TelemetryCards.tsx:17-21`、`src/features/scene/WindTunnelScene.tsx:125-130`）。
2. **Worker 与恢复所有权总体可靠。** `LbmWorkerClient` 用 generation 隔离陈旧消息，清理 request timeout 和 pending promises，并在 dispose 时解绑 listener、通知并 terminate worker（`src/features/flow/LbmWorkerClient.ts:49-62`、`src/features/flow/LbmWorkerClient.ts:103-121`、`src/features/flow/LbmWorkerClient.ts:124-155`、`src/features/flow/LbmWorkerClient.ts:208-255`）。`FlowRuntime` 防重叠、共享 restart promise、使用 generation 阻止旧请求回写，并保留最后有效场（`src/features/flow/flowRuntime.ts:21-84`、`src/features/flow/flowRuntime.ts:90-134`）。
3. **App effect cleanup 边界完整。** simulation interval/visibility listener、Zustand subscription、flow interval、client/worker、media/resize listener 均由所属 effect 对称释放；WebGL 丢失会暂停并销毁 flow owner，恢复后以新 scene key、flow epoch 和新 worker 重建，同时保留遥测、教程与最后场（`src/App.tsx:77-120`、`src/App.tsx:122-155`、`src/App.tsx:167-171`、`src/features/scene/WindTunnelScene.tsx:98-112`）。
4. **自动扫频、统计和导出防线扎实。** 30/60/90 条件严格按仿真时间推进，过滤跨工况尾帧、要求连续稳定、有限 dt 和至少 20 个有限稳定样本；残差只在三个 summary 都完整有效时开放（`src/features/sweep/sweepRunner.ts:43-109`、`src/features/report/experimentSummary.ts:32-51`、`src/features/report/ExperimentReport.tsx:234-267`）。导出对 spreadsheet formula injection、RFC4180 转义、BOM、失败重试和 immutable sample snapshot 均有实现与测试（`src/features/report/csv.ts:57-123`、`src/features/report/ExperimentReport.tsx:142-183`）。
5. **Three/R3F 热路径大体克制。** 粒子状态和 field reference 留在 refs 中，`useFrame` 不触发 React setState；DataTexture 只随新 frame/mode 重建并 dispose；WebGL 真实恢复 E2E 不是 mock（`src/features/scene/FlowParticles.tsx:70-116`、`src/features/scene/FieldSlice.tsx:114-127`、`e2e/free-lab.spec.ts:30-55`）。React 审查基线特别关注了高频 ref 状态与 prop-keyed 初始化，后者形成下述 I6。
6. **响应式与可访问性覆盖超出常规 MVP。** compact tabs 具备 tab/tabpanel、roving focus、`hidden`/`inert` 和进入当前 panel 的键盘路径；控制目标达到 44px，focus-visible、reduced motion、三视口 overflow 和实际键盘操作都有覆盖（`src/features/shell/AppShell.tsx:19-57`、`src/features/shell/AppShell.tsx:72-126`、`src/styles/global.css:1012-1025`、`e2e/responsive.spec.ts:9-61`）。
7. **安全边界良好。** 生产代码无网络、后端、密钥、动态 HTML、`eval`、外部模型或用户可控 DOM 注入；E2E 加速仅由 exact `VITE_E2E_TIME_SCALE === "20"` 激活，专用 server 不复用既有端口实例（`src/App.tsx:77-80`、`playwright.config.ts:12-17`）。

## Issues

### Critical

无。

### Important

#### I1 — 普通实验生命周期永久停在 `ramping`

- 类型：**计划问题 + 实现问题**；不属于 ledger 已裁定风险。
- 位置：`docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md:140-143`；`src/features/experiment/labStore.ts:86-89`；`src/features/experiment/simulationRuntime.ts:16-25`
- 问题：批准 spec 要求 `idle → ramping → stabilizing → sampling → completed`。store 暴露 `advancePhase()`，但生产代码没有任何调用者；runtime 只同步 power/phase、step 并 accept frame。自动 sweep 有自己的阶段机，但普通/自由实验启动后会无限显示 `升速中 / RAMPING`，暂停后也只恢复到 ramping，永远没有普通实验的稳定、采样、完成阶段。
- 影响：自由实验的状态语义不真实，基线实验无法形成完整生命周期，phase 字段、状态 badge 与导出语义不能作为可信实验记录。现有 E2E 只断言启动后为 ramping，因此没有发现这一缺口。
- 建议：在 plan 中明确普通 ExperimentController 的阶段 owner 与确定性转换条件，再实现并测试完整生命周期、暂停/恢复与隐藏页不补算；不要复用 sweep 状态机来隐式掩盖。

#### I2 — 第 2 章“连续稳定 2 秒”可由断续窗口拼接完成

- 类型：**实现问题**；Task 4 的 ledger Ruling（由 Task 8 producer 执行）架构上可接受，但 producer 没有执行“连续”语义。
- 位置：`docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md:92-96`；`src/features/dashboard/evidenceRecording.ts:6-20`；`src/features/tutorial/tutorialProgress.ts:66-72`
- 问题：`recordStableTelemetry()` 只在当前 frame 稳定且 30% 时累加；遇到 transient、改功率、停止或 reset 时返回原 evidence，未把 `stableSeconds` 清零。定向探针确认“稳定 1 秒 → transient → 稳定 1 秒”会得到 2 秒并解锁章节。
- 影响：教程的核心 evidence gate 可以被不连续行为绕过，与 spec、教学文案和 sweep 自身正确实现的连续稳定规则不一致。
- 建议：不满足 exact 30% + stable + positive finite dt 时将连续计数清零；对异常/过大 dt 也拒绝；新增断续稳定、改功率、reset、跨 run 回归测试。

#### I3 — 第 3 章按钮只写 evidence，没有生产任何传感器说明

- 类型：**实现问题**；Task 4 writeback 延期 Ruling 的 owner 选择正确，但最终 producer 语义不完整。
- 位置：`docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md:98-102`；`docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md:184-192`；`src/features/dashboard/TelemetryCards.tsx:10-21`；`src/features/dashboard/TelemetryCards.tsx:43-56`；`e2e/tutorial.spec.ts:33-38`
- 问题：四个“查看…说明”按钮只调用 `onInspect(item.id)`；组件没有展开说明、tooltip/dialog，也没有定义、20 Hz 采样频率、模拟方式、一阶响应、延迟、噪声或零漂内容。E2E 仅依次 click 四个按钮，就把 evidence 记满。
- 影响：第 3 章能形式过关却没有完成批准的学习交互，也没有解释 spec 明确要求教学说明的模拟误差来源。
- 建议：每卡提供可键盘触发且可见的说明 panel（定义、单位、20 Hz、数据来源/延迟/噪声）；只有 panel 实际打开后记录 evidence，并让 E2E 断言内容而非仅断言 callback。

#### I4 — 第 6 章被 plan 降级成“虚拟载荷对 v² 基线”，没有 CFD↔传感器残差，也不能记录原因

- 类型：**计划问题，继而成为实现问题**；不属于 ledger 已裁定风险。
- 位置：`docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md:116-120`；`docs/superpowers/plans/2026-08-18-digital-wind-tunnel-web.md:543-556`；`docs/superpowers/plans/2026-08-18-digital-wind-tunnel-web.md:1169-1183`；`src/features/report/ExperimentReport.tsx:111-138`；`src/features/report/ExperimentReport.tsx:234-267`；`src/features/tutorial/tutorialProgress.ts:5-14`；`src/features/tutorial/tutorialProgress.ts:77-83`
- 问题：spec 要求理解“CFD 预测与虚拟传感器”的偏差、查看残差并记录原因。plan 把 evidence 简化为 `selectedLargestResidual: boolean`，实现的 residual 是 `baselineLoad * (wind / baselineWind)^2` 与同一虚拟载荷的差，不消费任何 LBM/flow 派生预测；UI 也没有“原因”输入，选择正确 radio 即完成第 6 章。
- 影响：实现没有误称这是工程 CFD，provenance 仍诚实；但第 6 章最关键的跨数据源比较学习目标并未交付，七章完成声明因此过强。
- 建议：先修订 plan：定义可解释的二维教学 CFD proxy（例如固定采样区压差/尾迹指标）及其与虚拟传感器的单位/归一化关系；新增 reason evidence（非空、可打印/导出）。若不准备实现，应把批准 spec 和章节文案改成“v² 规律残差”，不能继续声称 CFD↔传感器比较。

#### I5 — 实际 solver 配置没有端到端进入 HUD/CSV provenance

- 类型：**实现问题**；plan 已要求 CSV grid metadata。
- 位置：`src/features/flow/flowRuntime.ts:40-61`；`src/features/dashboard/FieldSelector.tsx:88-94`；`src/features/report/csv.ts:57-65`；`src/features/report/ExperimentReport.tsx:173-183`；`src/App.tsx:204-220`
- 问题：CSV 在未传 `gridSize` 时固定写 `240 × 96`，但真实 profile 可为 160×64、240×96 或 320×128，且 timeout 会 HIGH→MEDIUM→LOW 降档；App 导出时完全没有传 active grid。另在 `NON_FINITE_FIELD` 恢复后 runtime 将 lattice velocity 乘 0.8，solver status 仍显示未缩放的 `mapWindToLatticeVelocity(windSpeedMps)`。
- 影响：下载报告和 HUD 可能错误陈述真实运行配置，直接削弱“可复现实验记录”和 solver provenance；Task 11 的真实 CSV test 检查了免责声明/样本，却未核对 grid 与运行时一致。
- 建议：把实际 runtime config（ready generation、grid、tau、velocity scale/actual inlet）作为只读 flow metadata 写入 store；HUD 和 immutable export snapshot 只消费该 metadata，不使用默认猜测。

#### I6 — 质量档变化后粒子 buffer 与 InstancedMesh `count` 脱节

- 类型：**实现问题**；不属于 ledger 已裁定风险。
- 位置：`src/features/scene/FlowParticles.tsx:70-82`；`src/features/scene/FlowParticles.tsx:84-116`；`src/features/scene/FlowParticles.tsx:118-123`；`src/App.tsx:105-120`；`src/App.tsx:160-166`
- 问题：`particleBuffersRef` 通过 `useState(() => createParticleBuffers(count))` 只按首次 count 初始化；profile 随 resize、reduced-motion 恢复或 adaptive downgrade 改变时，组件没有 key/remount，也没有按 count 重建 buffers，而 InstancedMesh 的 `args` 使用新 count。由 300→1400 会留下大量默认矩阵/原点粒子；由 1400→900 会继续循环并尝试写 1400 个矩阵，造成无效热路径工作和视觉异常。
- 影响：正好破坏质量降档本应保护的 Three/WebGL 性能，并可能在 resize/恢复后生成原点粒子团；现有 quality test 只测 profile 数值，未测 renderer consumer。
- 建议：用 `key={quality.name}` 明确 remount `FlowParticles`，或在 count 改变时原子重建 buffers 并重写全部矩阵；增加 300↔1400 与 1400→900 的 R3F/纯 buffer 回归。

#### I7 — `reset()` 没有重置固定种子 PRNG，重复实验不可复现

- 类型：**实现问题**；不属于 ledger 已裁定风险。
- 位置：`docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md:165-166`；`src/features/experiment/SimulationSource.ts:23-37`；`src/features/experiment/SimulationSource.ts:40-55`；`src/features/experiment/SimulationSource.ts:115-125`；`src/App.tsx:77-85`
- 问题：PRNG 只在 constructor 以 seed 创建一次，`reset()` 重置物理量、时间和 delay queue，却不恢复 PRNG state；它还调用 `step(0)`，额外消费一组随机数。App 在全局 reset 后复用同一个 source。因此相同功率/时序的第二次实验与第一次使用不同噪声序列。现有测试只比较两个新 source，不覆盖同一 source reset 后 replay。
- 影响：公式趋势仍确定，但用户执行重复工况无法得到 spec 承诺的同配置可复现模拟；这也会改变 residual 和 CSV summary。
- 建议：保存初始 seed/state，reset 时恢复 PRNG 并避免为未使用的 reset frame 消费噪声，或明确采用 run seed 并写入报告 metadata；新增 reset replay 等值测试。

### Minor

#### M1 — Worker 仍以全网格复制并传输五个场，未实现 spec 的降采样 transport

- 类型：**计划问题 + 实现问题**；当前自适应质量使其暂不阻塞发布。
- 位置：`docs/superpowers/specs/2026-08-18-digital-wind-tunnel-web-design.md:148-150`；`src/features/flow/lbm.worker.ts:49-84`；`src/features/scene/FieldSlice.tsx:22-23`；`src/features/scene/FieldSlice.tsx:57-95`
- 问题：HIGH 320×128 每帧复制并 transfer 五个 Float32 场，约 0.78 MiB/frame；10 Hz 约 7.8 MiB/s 的新 buffer churn，而 FieldSlice 最终只使用 120×48。传输会正确 detach，未见资源泄漏，但与“接收降采样场”设计不符。
- 建议：保留粒子需要的 velocity 采样分辨率与 UI texture 分辨率之间的明确协议；至少采用 worker 侧 downsample/packed fields 或可复用双缓冲，并以性能测量决定是否保留全场。

#### M2 — 缺少项目级运行/交付 README（非阻塞）

- 类型：**交付文档问题**。
- 位置：`package.json:5-12`；`playwright.config.ts:12-17`
- 问题：项目根没有 README。脚本可从 package.json 推断，但没有集中说明 Node/npm 前置、`npm ci`/`npm run dev`、支持浏览器、教学 CFD 边界、E2E exact-20 环境、构建产物与已知 Three chunk warning。
- 影响：不阻塞当前内部交付或 fresh 验证；会增加下一位维护者误用 E2E 环境或误解教学结果的风险。
- 建议：补一页简洁 README，不复制 spec，只提供 quick start、验证命令、架构入口、provenance/非目标和故障降级说明。

## Rulings audit

| Ledger Ruling | 审计结论 | 依据 / 当前风险 |
|---|---|---|
| 在当前 writable `cfd`、`master` 实施 | **仍可接受（临时）** | 用户授权范围与 sandbox 一致；父仓库缺失对象和大量无关状态仍使 worktree 操作危险。产品文件当前未形成隔离 commit，后续发布前仍应迁移到修复后的专用 branch/worktree。 |
| 不创建 per-task commits / commit-range review package | **仍可接受（临时）** | 没有触碰父仓库 index/HEAD；完整 filesystem snapshot、逐 Task report、ledger 与 final review 提供了替代证据。代价是 rollback/作者追踪弱，不能把它当作长期 Git 流程。 |
| SDD workspace 放在 `cfd/.superpowers/sdd/…` | **可接受** | 路径在任务作用域、可写且资料完整；本 final review 也按用户指定写入该处。 |
| Task 3 测试 cleanup 延后到 Task 10 | **已关闭，裁决仍可接受** | `simulationRuntime.test.ts` 现在用 tracked stops，`afterEach` 逆序 stop、clear timers、restore mocks、恢复 real timers（`src/features/experiment/simulationRuntime.test.ts:37-55`）。未发现遗留 timer/listener/getter spy 风险。 |
| Task 4 App evidence writeback 延后到 Tasks 7–9/11 | **架构裁决可接受；语义只部分闭环** | hotspot、sensor、field、stable-window、sweep、report producer 均已接线，教程可完成；但 sensor producer 只记 click、不生成说明（I3），Chapter 6 plan 本身缺 CFD↔sensor/reason evidence（I4）。这不是“延期 owner 错误”，而是最终 producer/plan 不足。 |
| Task 4 用 `stableSeconds` 契约，由 Task 8 producer 强制 exact 30% | **契约裁决可接受；实现未闭环** | exact 30% 和 stable quality 已在 producer 检查，但连续性没有 reset（I2）。无需新增 tutorial 字段也能修复；producer 应维护 consecutive counter。 |
| Task 6 duplicate `FlowRuntime.restart()` 延后到 Task 10 | **已关闭，裁决仍可接受** | runtime 通过 `restartPromise` coalesce、generation owner 和 finally 清理解决旧 rejection 覆盖新成功的问题（`src/features/flow/flowRuntime.ts:29-30`、`src/features/flow/flowRuntime.ts:99-132`）；针对 rejection 后 retry 的测试存在（`src/features/flow/flowRuntime.test.ts:204-233`）。 |

## Recommendations

1. **发布门禁第一组：** 修复 I1、I2、I3、I4。它们决定“七章教程/普通实验已完整交付”这一核心声明是否成立；每项先补失败测试，再改生产代码。
2. **发布门禁第二组：** 建立实际 solver metadata 单一来源并修复 I5；报告必须记录真实 grid、actual lattice inlet/scale、seed/run id，保证 CSV 可复现且不误述。
3. **渲染稳定性：** 修复 I6，并加入 profile 切换的 renderer consumer 测试；随后用 focused browser case 验证 resize、adaptive downgrade、reduced-motion on/off 后无原点粒子团、无额外 console error。
4. **确定性：** 修复 I7 并新增“同 source reset 后相同命令序列完全相等”的测试；明确 reset 是重放同 seed，还是生成并记录新 run seed。
5. **性能后续：** M1 先测量再优化，不要在没有 profile 数据时重写 solver；优先减少 worker→main 的全场 allocation/transfer，保持 Web Worker 与 UI no-overlap 契约不变。
6. **验证策略：** 上述修复后先跑对应 focused Vitest/Playwright；最后再运行一次完整 154+ / 5-browser fresh matrix。当前无理由重复已报告的长矩阵。
7. **交付文档：** M2 不阻塞本轮修复，但在交给非作者使用前补 README；同时记录既有大 chunk warning与教学 CFD 边界。

## Assessment

**Ready to ship? With fixes.**

没有 Critical，也没有工程级 CFD 误称、安全/XSS/密钥泄漏、worker 泄漏、restart race 或 CSV 注入等发布阻断风险；Task 11 的 fresh 验证证据可信且覆盖真实 WebGL、真实 Worker 场、真实 CSV 和三视口。

但当前不能无条件宣称“批准 spec 的完整七章数字风洞已交付”：普通实验阶段机未运行（I1），第 2/3/6 章 evidence 存在实质缺口（I2–I4），solver 配置报告可能失真（I5），质量切换会让粒子 buffer 脱节（I6），reset 后也不满足重复实验可复现承诺（I7）。修复 I1–I7 并完成一次新的 focused→full 验证后，可升级为 **Yes**。

---

## Fix-round scoped re-review — 2026-08-18

### Scope and evidence

- 本轮只读复审原 I1–I7 与 M2，以及这些修复可能引入的回归；M1 按要求保持 parked，未扩展 transport/Three 性能重写。
- 完整复读了本报告原结论、`reports/final-fixes.md`、`reports/final-fixes-aux.md`、plan 的 authoritative final-review amendment，以及当前对应生产代码和测试。未修改源码、Git index、HEAD 或 branch，未重跑长 Playwright；采信修复报告中真实 Chromium 教程/Worker/CSV 证据。
- 新鲜 focused 验证：10 个相关 Vitest 文件、100 个测试全部通过（3.39 s）。这证明当前回归基线为绿，但现有测试没有覆盖下面两个缺口，不能把“绿”替代为契约符合性。

### Strengths

1. 普通实验现在确有单一 runtime owner：有限正向仿真 `dt` 驱动 `ramping → stabilizing → sampling → completed`，瞬态清窗，pause/hidden 不计墙钟时间（`src/features/experiment/simulationRuntime.ts:19-88`、`src/features/experiment/simulationRuntime.ts:92-117`）。
2. CFD proxy 链路已从同源 `v²` 基线改为真实接收的二维压力场固定窗；request 时冻结 telemetry/revision/condition，response 接收时校验并捕获，至少五个 fresh flow id 后才可完成（`src/features/flow/flowRuntime.ts:44-93`、`src/features/experiment/labStore.ts:115-143`、`src/features/flow/cfdSensorProxy.ts:50-155`、`src/features/sweep/sweepRunner.ts:81-102`）。
3. 报告/CSV 现在以无量纲 Cp 比较，要求实际最大残差选择和非空原因，并冻结 raw numerator/denominator 与每样本 runtime config；混合 grid/generation/scale/recovery、requested/actual inlet range 和 rebuild reason 均可审计（`src/features/report/ExperimentReport.tsx:113-171`、`src/features/report/ExperimentReport.tsx:176-264`、`src/features/report/csv.ts:81-232`）。
4. HUD 消费 accepted metadata 而不是 profile 猜测；粒子底层 capacity 与 CPU buffers 同步重建；PRNG reset 可重放；README 的 Node engine 交集和教学边界与当前锁文件/报告一致（`src/features/dashboard/FieldSelector.tsx:87-109`、`src/features/scene/FlowParticles.tsx:71-128`、`src/features/experiment/SimulationSource.ts:23-43`、`src/features/experiment/SimulationSource.ts:121-143`、`README.md:5-39`）。

### Issues

#### Critical

无。

#### Important

##### FR-I2 — pause 与异常 timestamp 没有打断第 2 章连续证据窗

- 裁定：**I2 NOT ADDRESSED**（command、new-run、reset、transient、stop 路径已修；pause boundary 与 abnormal timestamp 仍不符合 authoritative amendment）。
- 位置：`docs/superpowers/plans/2026-08-18-digital-wind-tunnel-web.md:30-31`；`src/features/experiment/labStore.ts:145-156`；`src/App.tsx:85-104`；`src/features/experiment/simulationRuntime.ts:43-52`；`src/features/dashboard/evidenceRecording.ts:13-38`
- 问题：`pauseRun()`/`resumeRun()` 只改变 phase，均不增加 `manualRunRevision`，且不改变 telemetry object。App subscription 因 `state.telemetry === previous.telemetry` 在 `src/App.tsx:97` 提前返回，因此已累积的 `stableSeconds` 穿过 pause 保留。恢复后的下一帧把 pause 前的 active/stable telemetry 当作 previous endpoint；只要仿真 `dt ≤ 1 s`，`recordStableTelemetry()` 会继续累加。异常 timestamp 也只让 runtime 把 phase 改为 `ramping` 并写日志，不更新 telemetry/revision；若 source 随后给出相对最后 accepted telemetry 的合法时间戳，证据同样能跨越已拒绝的异常帧继续累加。
- mutation/state-trace 证据：从 `{ stableSeconds: 1, stableRunRevision: R }` 开始，`pauseRun()` 产生 `{ phase: "paused", manualRunRevision: R, telemetry: T }`，App 不执行 evidence reducer；`resumeRun()` 仍保持 revision `R` 与 telemetry `T`；下一 accepted stable 30% frame `T+50 ms` 同时满足 `previousActive`、`activePhase` 和 `0 < dt ≤ 1`，把计数改成 `1.05`，之后 0.95 s 即可错误解锁。异常 timestamp 路径在 `simulationRuntime.ts:47-51` 具有同一“不触碰 revision/telemetry”的 mutation。现有 pause 测试只断言 phase/step count（`src/features/experiment/simulationRuntime.test.ts:195-214`），异常测试只断言 phase/history/log（`src/features/experiment/simulationRuntime.test.ts:255-266`），均不会杀死这个 mutation。
- 影响：用户可用两个被 pause 或异常 source frame 分隔的窗口满足“严格连续 2 秒”，修复报告 `final-fixes.md:24` 所称 pause/abnormal 回归覆盖并不成立。
- 建议：为教程连续窗引入显式 discontinuity/revision（pause 时递增或单独 evidence epoch）；runtime 拒绝异常 timestamp 时也必须发布同一 discontinuity。新增 App/store 集成测试，断言 pause/resume 与 recoverable rollback/oversized timestamp 后 `stableSeconds` 立即归零且第一帧只重建窗口。不要把 hidden wall time计入，但 plan 未要求仅因 hidden 本身清掉已接受的仿真时间证据。

#### Minor

##### FR-I3 — RPM 与风速 disclosure 未说明其漂移行为

- 裁定：**I3 NOT ADDRESSED**（“仅展开后写 evidence”及可访问 disclosure 已修；每项说明必须覆盖 drift behavior 的 amendment 仍有两项缺口）。
- 位置：`docs/superpowers/plans/2026-08-18-digital-wind-tunnel-web.md:32`；`src/features/dashboard/TelemetryCards.tsx:20-52`；`src/features/dashboard/TelemetryCards.tsx:65-69`；`src/features/dashboard/TelemetryCards.tsx:103-115`；`src/features/dashboard/Dashboard.test.tsx:196-216`
- 问题：RPM 文案说明“无固定采集延迟”和确定性噪声，风速文案说明 50 ms 延迟与确定性噪声，但二者都没有声明漂移为“无”；只有压力和载荷说明了有界零漂。authoritative amendment 要求每个 explanation 都陈述 delay **和 drift** behavior。open-only evidence 时机本身正确：只有 `opening === true` 才调用 `onInspect`。
- mutation/test-gap 证据：当前键盘 disclosure 测试断言定义、RPM、20 Hz、一阶惯性和确定性噪声，却没有 drift 断言（`Dashboard.test.tsx:205-211`）；因此从任一说明移除/遗漏 drift 文案仍为 100/100 green，正是本次静态复审观察到的状态。
- 影响：不再能“无内容点击过关”，所以严重度降为 Minor；但修复报告 `final-fixes.md:30-31` 对“四类卡片均包含漂移”的陈述不准确。
- 建议：RPM、风速分别明确“无额外零点漂移”，并让参数化测试逐卡断言定义、单位、20 Hz、模拟来源、noise、delay、drift 与 `SIMULATED`，避免只深测 RPM、只浅测最后一张卡。

### Per-finding disposition

| 原 finding | 裁定 | 复审依据 |
|---|---|---|
| I1 普通 lifecycle | **ADDRESSED** | runtime 以 accepted simulation time 完成 2 s stabilize + 4 s sample；transient/command revision 清 timer，pause/hidden 不补墙钟；focused lifecycle tests green。 |
| I2 30% 连续证据 | **NOT ADDRESSED** | exact command、active/stable endpoints、run/reset/transient 已修；pause 与异常 timestamp 不产生 evidence discontinuity，见 FR-I2。 |
| I3 sensor explanation | **NOT ADDRESSED** | disclosure 与 open-only writeback 已修；RPM/风速未声明 drift behavior，见 FR-I3。 |
| I4 CFD↔sensor comparison | **ADDRESSED** | 固定窗、正确单位内 ratio-of-sums Cp、五帧门槛、request-time sequence + sweep revision/condition/power 配对、实际最大项与非空原因均落地。 |
| I5 actual solver provenance | **ADDRESSED** | accepted metadata 原子随 field 存储；HUD/report/CSV 显示 actual inlet、mixed config/range、scale/recovery/rebuild reason，raw proxy 可复算。 |
| I6 particle capacity | **ADDRESSED** | `[count]` layout effect 重建 CPU buffers，`key={count}` 重建固定容量 host，`mesh.count` 同步；300↔1400 双向回归 green。 |
| I7 PRNG reset | **ADDRESSED** | PRNG 恢复 initial state，reset 直接返回无噪零帧且不消费随机数，same-source replay 等值测试 green。 |
| M2 README | **ADDRESSED** | quick start、验证命令、浏览器/E2E 隔离、CFD 边界、降级与准确 engine 交集均已记录。 |

### New Breakage

未发现修复引入的独立新回归。FR-I2 与 FR-I3 都是对应原 finding 的不完整闭环，而不是 I4–I7/M2 修复造成的旁路破坏。M1 的全场 Worker transport 和已知 Three chunk warning维持原 parked 裁定，本轮未重新定级。

### Recommendations

1. 先用两个 focused RED 测试锁住 FR-I2：pause/resume 断窗，以及可恢复异常 timestamp 断窗；再用最小 epoch/revision 变更修复，避免改变普通 lifecycle 对 pause/hidden 的仿真计时语义。
2. 参数化补齐四种 sensor explanation 的完整字段断言，并为 RPM/风速加入“无漂移”说明。
3. 上述两项修完后运行相关 Vitest、lint/build；真实教程 E2E 已有可信基线，只需在证据链改动影响教程解锁时运行该 focused Chromium case，无需重跑三视口长矩阵。

### Assessment

**Ready to ship? With fixes.**

I1、I4–I7、M2 已实质闭环，未发现 Critical、新的 CFD provenance/单位错误、proxy pairing 污染、CSV snapshot 失真、HUD metadata 猜测、粒子容量回归或 PRNG/README 问题。当前发布门禁只剩一项 Important（第 2 章 pause/异常 timestamp 连续窗可拼接）和一项 Minor（两张 sensor 卡未声明无漂移）；修复并通过 focused 验证后可升级为 **Yes**。

---

## Fix-round 2 ultra-narrow re-review — 2026-08-18

### Scope and fresh evidence

- 本轮只复审三条链路：FR-I2 的 pause/abnormal/hidden evidence 边界；FR-I3 四张传感器 disclosure；WebGL restore 旧 canvas listener 与 Playwright `workers: 1` 的测试完整性。
- 未修改源码、E2E、Git index 或 HEAD，未启动 Playwright。采信 `reports/final-fixes.md:125-143` 已记录的真实 Chromium 6/6、真实 `WEBGL_lose_context`、canvas replacement、READY/live field 与 browser error capture 证据。
- 新鲜最小 Vitest：`App.test.tsx`、`App.integration.test.tsx`、`labStore.test.ts`、`simulationRuntime.test.ts`、`Dashboard.test.tsx`、`WindTunnelScene.test.tsx`，合计 **6 files / 77 tests passed**；两次命令均 exit 0。

### Disposition

| 检查项 | 裁定 | 依据 |
|---|---|---|
| FR-I2 — pause/resume 打断 App `stableSeconds` | **ADDRESSED** | `pauseRun()` 仅在真实进入 paused 时增加 `manualRunRevision`（`src/features/experiment/labStore.ts:150-154`）；App 在 telemetry early-return 之前同步排队清空 evidence（`src/App.tsx:85-97`），下一 telemetry 又以新 revision 只建立窗口（`src/App.tsx:98-104`、`src/features/dashboard/evidenceRecording.ts:13-15`）。runtime 在 resume 后看到 revision 变化并同时清 manual lifecycle timers（`src/features/experiment/simulationRuntime.ts:21-30`）。 |
| FR-I2 — abnormal timestamp 打断 App `stableSeconds` | **ADDRESSED** | 非有限、非正向或大于 1 s 的 `dt` 进入同一 invalid 分支；该分支不 accept frame、清 lifecycle timers，并增加 `manualRunRevision`（`src/features/experiment/simulationRuntime.ts:43-53`），所以 App 即使 telemetry identity 未变也会先清 evidence。可恢复零步长路径随后必须重新累积完整 2 s（`src/features/experiment/simulationRuntime.test.ts:272-299`）。 |
| FR-I2 — hidden 仍冻结 | **ADDRESSED** | hidden 只 unschedule，恢复只重新 schedule，不改变 revision、telemetry 或 timer credit（`src/features/experiment/simulationRuntime.ts:93-118`）；测试明确断言隐藏期间无 step、恢复后仅一步且 revision 不变（`src/features/experiment/simulationRuntime.test.ts:163-177`）。 |
| FR-I3 — 四卡完整说明 | **ADDRESSED** | 四卡均在实际展开 region 中给出非空 definition、对应 unit、20 Hz、模拟来源、noise、delay、drift（包括 RPM/风速“无额外零点漂移”）及 `SIMULATED` disclaimer（`src/features/dashboard/TelemetryCards.tsx:20-52`、`src/features/dashboard/TelemetryCards.tsx:103-115`）；evidence 仍仅在 closed→open 时写入（`src/features/dashboard/TelemetryCards.tsx:65-69`）。 |
| WebGL restore stale old-canvas loss | **ADDRESSED** | restore handler 先调用幂等 `remove()`，同步把 active 置 false并移除 lost/restored listeners，之后才调用 `onRestored` 重建场景（`src/features/scene/webglContextRecovery.ts:6-23`）。因此旧 R3F canvas dispose/force-loss 已无 listener 可达。 |
| Playwright `workers: 1` | **ACCEPTABLE / NO MATERIAL WEAKENING** | 配置只把浏览器用例串行化（`playwright.config.ts:3-19`），没有复用 server、mock store、提高单测 timeout 或移除 assertions。context case 仍调用真实 `WEBGL_lose_context`、要求 loss overlay、旧 canvas disconnected、READY/live field 与零 browser errors（`e2e/free-lab.spec.ts:67-100`）。controls 中的原生 button click 仍进入生产 handler；pressure 的重试每轮先要求 enabled，最后要求真实 `aria-checked=true`（`e2e/free-lab.spec.ts:18-64`）。单 worker 移除了不符合单实例产品契约的跨页面 GPU/CPU 争用，没有降低单页面行为合同。 |

### Mutation-sensitivity audit

- **FR-I2 targeted mutations：PASS。** 删除 pause revision bump 会同时被 store revision test（`src/features/experiment/labStore.test.ts:84-99`）和 App 防拼接测试（`src/App.test.tsx:65-141`）杀死；删除 invalid 分支 revision bump 会被 recoverable bad-timestamp test（`src/features/experiment/simulationRuntime.test.ts:272-299`）杀死；误让 hidden bump revision 会被 hidden freeze test（`simulationRuntime.test.ts:163-177`）杀死。删除 App 的 revision-before-telemetry 清理还会被“命令/reset 在 telemetry 不变时立即重新锁章”集成测试杀死（`src/App.integration.test.tsx:104-160`）。
- **FR-I3 targeted mutations：PASS。** 四卡参数化断言逐项固定 unit、20 Hz、noise、delay、drift 和 `SIMULATED`；删除任一卡本轮新增的 drift 文案或 disclosure region 会失败（`src/features/dashboard/Dashboard.test.tsx:219-242`）。open-only callback 另由键盘开/关测试保护（`Dashboard.test.tsx:196-217`）。
- **WebGL targeted mutation：PASS。** 若把 listener removal 移到 `onRestored` 之后或遗漏旧 lost listener，测试在 `onRestored` 内同步派发的 stale old-canvas loss 会令 `onLost` 第二次调用并失败；cleanup 后再派 restored 也必须不可达（`src/features/scene/WindTunnelScene.test.tsx:48-69`）。
- **非阻塞测试加固点：** 参数化 sensor test 对 `定义：` 与 `模拟来源：` 只检查标题；若仅清空 `item.definition`，或删除 wind/pressure/load 的来源机制子句但保留 delay/noise/drift，当前断言可能仍绿（`Dashboard.test.tsx:233-239`）。生产文案当前非空且正确，故这不是 FR-I3 行为缺口；建议后续把每卡 expected definition/source 也纳入参数表。

### Issues

#### Critical

无。

#### Important

无。

#### Minor

无发布阻塞 Minor。仅有上述 regression-test 精度加固建议；它没有对应当前生产错误。

### New Breakage

**未发现。** pause revision 同时重置 tutorial 与普通 lifecycle 连续 timer，但仍恢复原 phase；hidden 不被误当作新 run。WebGL helper 的 listener 自失活是幂等的，不影响 effect cleanup。`workers: 1` 不进入生产 bundle，也不改变任一单页面 E2E 的真实 Worker/WebGL/UI 数据路径。

### Assessment

**Ready to ship? Yes.**

FR-I2 与 FR-I3 现已闭环；stale old-canvas context loss 也在重建前失活，Playwright 串行化没有以 mock、store 注入或删除最终状态断言换取绿色。本轮没有发现新的 Critical、Important、运行时 Minor 或 E2E 语义弱化。四卡 definition/source 的更强 mutation 断言可作为非阻塞测试维护项。
