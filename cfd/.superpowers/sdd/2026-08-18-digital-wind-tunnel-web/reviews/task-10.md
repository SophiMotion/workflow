# Task 10 Review — Resilience / Adaptive Quality / Responsive / A11y

## Spec Compliance

本审查严格限定 Task 10，以 `briefs/task-10.md` 与 ledger 中 Task 3 / Task 6 两个 parked 项为意图源，以 `diffs/task-10.diff` 的 current snapshots 和当前对应源文件为实现证据；未修改实现、Git index 或 HEAD。

| 规格面 | 结论 | 实现证据 / 说明 |
|---|---|---|
| Task 3 failure-safe test cleanup | 符合 | `src/features/experiment/simulationRuntime.test.ts:38-55` 在 runtime 创建后立即登记，`afterEach` 逆序 stop、清 timers、restore mocks，最后恢复真实 timer；提前断言失败也能回收 interval、listener 与 getter spy。 |
| Task 6 duplicate restart ownership / failed retry | 运行时符合；UI rejection 有缺口 | `src/features/flow/flowRuntime.ts:99-132` 以单一 `restartPromise` 合并重复调用，generation 隔离旧请求，settle 后释放 owner，失败后的下一次调用可新建 retry；`flowRuntime.test.ts:204-233` 覆盖 shared rejection 与后续成功。ControlPanel 丢弃 rejected promise，见 I1。 |
| ErrorBoundary / reload / statements | 符合 | `src/App.tsx:50-52` 包裹整个 Workbench；`src/features/shell/ErrorBoundary.tsx:22-35` 提供 alert、教学/模拟声明及用户触发 reload，无自动 reload 循环。 |
| Flow failure 保留 telemetry / tutorial / last field 并重启当前 runtime | 符合 | `src/features/flow/flowRuntime.ts:71-77,99-132` 失败/重启只写 flow status/error，不清 field/telemetry；`src/App.tsx:66-91,127-129,173-178` telemetry runtime 与教程 local state 独立，恢复按钮始终读取当前 runtime ref。 |
| WebGL loss / restore | 符合 | `src/features/scene/webglContextRecovery.ts:6-15` loss 调用 `preventDefault()` 并成对回收 listeners；`WindTunnelScene.tsx:93-107,121-153` 隐藏但保留旧 canvas listener、显示带 live fault 的 SVG，restore 增 scene key；`App.tsx:110-125,137-141` loss 停止/销毁 flow，telemetry effect 不受影响，restore 创建新 flow session。未发现 listener leak 或 restore stale closure。 |
| 精确质量档位 | 符合 | `src/features/shell/quality.ts:14-32` 精确实现 reduced `160×64/0/5`、low `160×64/300/5`、medium `240×96/900/10`、high `320×128/1400/10` 及选择阈值。 |
| 3 s adaptive controller | 符合 | `src/features/shell/quality.ts:39-86` 非 React state 累积 rolling window，严格 `averageMs > 41.7`，每窗只降 `high→medium→low` 一步、变更后清窗、无 upgrade 路径；`WindTunnelScene.tsx:57-72` 只在档位变化时回调。`App.tsx:93-108` 在 active experiment 阻止环境 auto-upgrade。 |
| Worker rebuild 保留旧状态并 ready 后 commit | 符合 | `src/App.tsx:110-125` quality/grid 变化替换 client/runtime，cleanup 不 reset store；旧 `flowField` 保留，`client.ready()` 且 effect owner 仍 current 才提交 `activeQuality`。教程/telemetry effects不重建。 |
| 1100 / 600 responsive、移动 sheet、无横向溢出 | 主布局符合 | `src/styles/global.css:949-1020,1022-1147` 提供三 tab compact 布局、52 px topbar、48 vh scene、单列卡与可滚动 panel。390×844 Chromium 实测 `scrollWidth === innerWidth === 390`，inactive panel 为 `display:none`，未发现 hidden-but-focusable pane；tabpanel 语义与 touch target 见 I2/I5。 |
| Reduced motion / focus / live semantics / canvas keyboard parity | 部分不符合 | reduced motion 与 `--flow` focus ring 已实现（`global.css:933-947`），高频 telemetry 没有 live region；但 canvas camera 无 DOM 键盘等价控制、live regions 超出 phase/fault、range hit target 不足，见 I3–I5。 |

## Strengths

- FlowRuntime 的 shared promise 与 generation owner 组合正确关闭了 parked 的“旧 rejection 覆盖新 success”竞态；失败 settle 后不会永久锁住 retry。
- WebGL loss 不卸载带 restoration listener 的 canvas，而是隐藏它并显示静态 SVG；restore 后同时 remount R3F scene 与重建 flow session，生命周期闭环清楚。
- Adaptive controller 不使用 React 高频 state；window 清理与 profile 同步避免每帧事件、降档连跳和 profile update loop。
- Worker 替换通过 effect owner flag 防止旧 client 的迟到 `ready()` 提交 stale active profile；last field、telemetry 与 tutorial evidence 没有 reset 路径。
- 四档参数、硬件/视口选择、实验中禁止 auto-upgrade、phase/fault live 与 reduced-motion 粒子关闭均直接可从实现验证。
- 390 px 实测三 tabs 为 `130×46`、模式按钮约 `49.5×44`、主实验按钮约 `118×44`，且没有 document/body 横向溢出。

## Issues

### Critical

无。

### Important

#### I1. Worker restart 失败会从点击处理器泄漏未处理的 Promise rejection

- **Finding:** `src/features/dashboard/ControlPanel.tsx:45-52` 只用 `try/finally` 恢复 `restartingFlow`，没有消费 `onRestartFlow()` 的 rejection；`ControlPanel.tsx:69-70` 又用 `void restartFlow()` 丢弃返回 Promise。
- **Intent:** Task 6 parked 项要求 shared failure 后用户可可靠 retry；Task 10 将这个 rejected runtime API 暴露为恢复按钮。
- **Reality / impact:** `FlowRuntime.restart()` 在 worker respawn/init 失败时按设计 reject。store 会保持 failed、按钮也会重新启用，但浏览器同时收到 unhandled rejection；这可触发全局错误上报/测试失败，并把一个已由 flow fault UI 表达的可恢复错误再次升级成未处理异常。React ErrorBoundary 不捕获异步事件 rejection。
- **Fix:** 在 `restartFlow` 内捕获预期 rejection（由 store 的 `flowStatus/flowError` 继续呈现），再在 finally 释放按钮；新增 `mockRejectedValueOnce` 后第二次 resolve 的 UI retry 测试，并监听 `unhandledrejection` 证明没有泄漏。

#### I2. 三个窄屏 tabs 没有关联语义 tabpanel

- **Finding:** `src/features/shell/AppShell.tsx:53-69` 的 tabs 设置了 `aria-controls`，但其目标 `AppShell.tsx:71-89` 仍只是 `nav` / `aside` / `section`，均缺 `role="tabpanel"` 与对应 `aria-labelledby="compact-tab-*"`。
- **Intent:** `<1100 px` 要提供语义正确、键盘可操作的三 tab panel。
- **Reality / impact:** 390 px Chromium 实测三个目标的 `role` 与 `aria-labelledby` 都是 `null`。视觉切换和 roving tabindex 正常，inactive panels 也确为 `display:none`，但辅助技术无法把当前内容识别为所选 tab 的 panel；当前测试只断言 complementary/data attribute，未覆盖这条关系。
- **Fix:** 为三个内容容器补 `role="tabpanel"` 与 `aria-labelledby`，在 compact 模式同步隐藏语义；如果要保留桌面 landmarks，可在容器内增加专用 tabpanel wrapper，避免冲突。测试每个 tab 的 controls → panel → labelledby 双向关系及切换后的不可达性。

#### I3. Orbit camera 是 pointer-only canvas function，没有键盘可达 DOM 等价控制

- **Finding:** `src/features/scene/WindTunnelScene.tsx:144` 启用 `OrbitControls` 的旋转、缩放和阻尼视角，但 scene 周围只有 hotspot/field DOM controls；没有“左/右旋转、放大/缩小、重置视角”等按钮，也没有可聚焦 canvas keyboard mapping。
- **Intent:** Brief 明确要求 every canvas function 都有 keyboard-accessible DOM control。
- **Reality / impact:** 键盘或 switch 用户可以选择 hotspot 与 field，却不能执行鼠标拖拽/滚轮提供的相机视角操作；功能等价性不完整。
- **Fix:** 提供至少重置视角、定步旋转和缩放的 44×44 DOM buttons（最好操作同一 camera/control ref 并带清晰 accessible name），或移除非必要的 pointer-only camera affordance；增加纯键盘测试验证 camera state 变化。

#### I4. Polite live regions 超出“仅 phase / fault changes”的范围

- **Finding:** 除 phase/fault 外，`src/features/scene/Hotspots.tsx:37` 把 hotspot 说明设为 status + polite live，`src/features/tutorial/TutorialRail.tsx:21` 把教程进度设为 polite live，`src/features/report/ExperimentReport.tsx:87` 把 sweep 常规状态设为 status + polite live；另外若按 ARIA 隐式语义计算，其他 `role="status"` 也会成为 polite live region。
- **Intent:** Task 10 明确限定 `aria-live="polite"` only for phase/fault changes，并避免不必要的重复播报；高频 telemetry 本身虽已正确排除，但范围仍不精确。
- **Reality / impact:** hotspot 点击、教程 evidence 变化和 sweep 正常进度都会排队播报，与 phase badge 的播报叠加；扫频时 phase 与 sweep status 还可能对同一过程重复报读。
- **Fix:** 只保留 phase 与 fault 的 live semantics；其他内容保持普通文本，并依靠触发按钮的 label/focus context，或在确有必要时合并到单一、去重的低频 phase announcer。加入 DOM 断言确保允许列表外没有显式/隐式 live region。

#### I5. 390 px 下主 range 控件的实际触控高度只有 16 px

- **Finding:** `src/features/dashboard/ControlPanel.tsx:79-89` 的风扇功率 range 是核心实验输入；`src/styles/global.css:402-405` 只设置 width/margin/accent，没有 44 px hit-area。相邻小型 telemetry 查看按钮也只受 `global.css:433-440,603-605` 的 `min-height` 约束，没有 `min-width`。
- **Intent:** 移动端 primary targets 至少 `44×44 px`，并严格核查 390 px 实际尺寸。
- **Reality / impact:** 390×844 Chromium、切到“控制”tab 后实测 `.fan-slider` 为 `366×16`；四个 `.telemetry-quality button` 为约 `27×44`。主 slider 的垂直命中面积明显低于要求，触控与运动障碍用户较难操作。
- **Fix:** 给 range 本体或可命中的 wrapper 提供至少 44 px block-size，并垂直居中轨道；对所有小 icon/text buttons 同时设置 `min-width:44px`。用真实浏览器在 390 px 遍历可交互元素并断言 hit rect。

### Minor

无。

## Assessment

**结论：Needs changes。** Task 10 的 load-bearing resilience 主线实现扎实：Task 3 cleanup parked 项已关闭，Task 6 shared restart owner / rejected 后 retry 正确，flow failure 与 WebGL loss 都保留 telemetry/tutorial/last field，四档质量与 3 s 单级降档精确，worker replacement 也在 `ready` 后才提交 active profile；未发现 cleanup race、stale ready commit、context listener leak、profile loop、ErrorBoundary 自动 reload loop 或横向溢出。

合入前应修复 I1 的恢复 rejection 泄漏，以及 I2–I5 的 tabpanel、canvas keyboard parity、live-region scope 与移动 touch target。定向验证结果：8 个相关 test files / 47 tests 全部通过；`npm run build` exit 0（仅已有 scene chunk >500 kB warning）；`npm run lint` exit 0。

---

## Fix Round 1 Review

本轮严格限定原 I1–I5，以 `diffs/task-10-fix-1.diff` 的 current snapshots 为实现证据；未重新审查其他 resilience、quality、worker、WebGL 或 responsive 行为，未修改实现、Git index 或 HEAD。

### Original Findings

#### I1 — ADDRESSED

- `src/features/dashboard/ControlPanel.tsx:45-54` 在 `await onRestartFlow()` 外增加 `catch`，由既有 flow store 继续承担可见 fault，`finally` 无论成功/失败都会释放 `restartingFlow`；点击处理器不再留下 rejected promise。
- `src/features/dashboard/Dashboard.test.tsx:89-117` 覆盖第一次 rejection 后错误状态原样保留、按钮重新启用、未触发 `unhandledrejection`，以及第二次 resolved retry 确实再次调用 callback。
- 未发现 catch 吞掉 retry gate 或按钮永久 disabled 的新路径。

#### I2 — ADDRESSED

- `src/features/shell/AppShell.tsx:21-31` 用与 CSS 同阈值的 media query 跟踪 compact layout 并成对 cleanup listener；`AppShell.tsx:63-114` 保留桌面 landmarks，同时在内部为三 tab 建立唯一 `role="tabpanel"` wrapper。
- 每个 tab 的 `aria-controls` 指向 panel id，panel 的 `aria-labelledby` 回指对应 tab；compact inactive panel 同时设置 `hidden` 与 `inert`，active panel 两者均移除。桌面退出 compact 后三 panel 恢复普通内容而不伪装成隐藏 tabpanel。
- `src/features/shell/AppShell.test.tsx:38-57` 验证三组双向关系与切换后的 hidden 状态。390 px Chromium 独立复测确认 inactive tutorial/charts 均 `hidden=true, inert=true`，即使脚本直接调用后代 `.focus()` 也无法令焦点进入；active controls 为 `hidden=false, inert=false`。

#### I3 — ADDRESSED

- `src/features/scene/CameraControlBar.tsx:8-30` 提供重置、左右旋转、放大、缩小五个原生 DOM buttons，均有明确 accessible name，可由 Tab + Enter/Space 激活。
- `src/features/scene/WindTunnelScene.tsx:91-92,118-123,139-158,168-171` 保存实际 R3F camera 与同一个 `OrbitControls` refs，DOM 命令操作的不是复制状态；WebGL 不可用/context lost 时按钮禁用。
- `src/features/scene/cameraCommands.ts:20-40` 对共同 target 执行定步旋转、clamped zoom 与 reset，并调用 `lookAt`、projection update 和 `controls.update()`；未引入 React 高频 camera state。
- `src/features/scene/CameraControls.test.tsx:8-35` 以键盘 Enter 验证 position 改变，并验证 zoom distance、reset position/target 与 controls update。390 px 实测五个按钮均为 `44×44` 且 enabled。

#### I4 — ADDRESSED

- `src/features/scene/Hotspots.tsx:37-47` 的说明卡已是普通文本；`src/features/tutorial/TutorialRail.tsx:21,46-49` 的进度/提示已移除 live/status；`src/features/report/ExperimentReport.tsx:83-96` 的正常 sweep 状态已是普通文本，仅失败保留 alert。
- 当前生产 DOM 的显式/隐式 live 来源限定为 phase 与 fault：`src/features/dashboard/ControlPanel.tsx:64-68`（phase/flow fault）、`src/features/scene/SceneFallback.tsx:54-55`（仅 context fault announce）、`src/features/shell/ErrorBoundary.tsx:26`（render fault）；sweep/export 的 `role="alert"` 也只在 fault 出现。
- `src/App.test.tsx:38-46` 等待 lazy scene/chart 完成后枚举 `[aria-live], [role='status']`，正常状态只允许 phase announcer。390 px Chromium 独立复测结果同样只有 `待机 / IDLE`。

#### I5 — ADDRESSED

- `src/features/dashboard/ControlPanel.tsx:81-93` 将 range 放入关联 label `.fan-slider-hit-area`；`src/styles/global.css:431-444` 给这个可命中 wrapper `min-height:44px` 并垂直居中轨道。
- `src/styles/global.css:41-43` 为 buttons 提供全局 `min-width:44px`，原有各类主按钮 `min-height:44px` 保留；camera buttons 在 `global.css:183-200` 明确固定为 `44×44`。
- 390×844 Chromium 独立实测：range effective label `366×44`；四个 telemetry 查看按钮全部 `44×44`；五个 camera buttons 全部 `44×44`；document `scrollWidth === innerWidth === 390`。原两个不足尺寸均已关闭。

### New Breakage

未在原 I1–I5 的限定修复边界内发现新破坏。Media-query listener 有 cleanup，inactive panels 不可聚焦，camera commands 操作实际 refs，fault live 仍保留，44 px 扩展未在 390 px 造成横向溢出。

### Out-of-Scope

- 未重新审查 Task 10 的 ErrorBoundary、FlowRuntime generation/shared ownership 内部、WebGL loss/restore、quality profiles/adaptive controller、worker ready commit 或其他 responsive 内容。
- 未重新审查 Task 1–9 的数值、教程 evidence、sweep/report/CSV 或状态机行为。
- 未修改实现、测试、Git index 或 HEAD。

### Verdict

**PASS — 5/5 original findings ADDRESSED。** I1 restart rejection、I2 tab/tabpanel、I3 camera keyboard parity、I4 live allowlist、I5 390 px touch targets 均已关闭；限定范围内无阻塞项。独立验证：10 个相关 test files / 69 tests 通过，`npm run build` exit 0（仅既有 lazy scene chunk >500 kB warning），`npm run lint` exit 0；390 px Chromium 实测语义、focus exclusion、live region、hit targets 与横向宽度均符合。
