# Task 10 实施报告：容错、自适应质量、响应式与无障碍

## 结果

已完成 ErrorBoundary、Worker/Flow 恢复提示与重启、WebGL context loss 静态降级、自适应质量控制、按质量重建 Worker、窄屏三标签/移动端 bottom-sheet、reduced-motion、键盘焦点与触控尺寸。所有恢复和质量切换均保留遥测、教程本地状态与最后有效二维流场；未修改 LBM 数值算法、模拟公式或教程证据规则。

## TDD RED → GREEN

首轮定向 RED：

```text
npm run test:run -- src/features/shell/quality.test.ts src/features/shell/ErrorBoundary.test.tsx \
  src/features/flow/flowRuntime.test.ts src/features/scene/WindTunnelScene.test.tsx \
  src/features/dashboard/Dashboard.test.tsx

Test Files 5 failed
Tests      3 failed | 23 passed
```

失败均来自待实现行为：`quality`/`ErrorBoundary` 模块不存在；重复 `restart()` 实际调用 client 两次；WebGL recovery helper 不存在；ControlPanel 无 failure alert。最小实现后的同命令为 `5 passed / 33 tests passed`。

第二轮先加入 compact tabs、SVG 五模块标签与活动质量/网格测试，得到 `3 failed / 17 passed`；实现后为 `3 files passed / 20 tests passed`。App 另有恢复 callback 与 `1024 → 1440` Worker 重建保持状态的集成测试。

## Parked 项闭环

### Task 3：simulationRuntime 测试失败安全清理

- 根因：stop callback 与 `document.hidden` getter spy 只在断言后的正常路径手动清理；提前失败会遗留 interval、`visibilitychange` listener 和 getter spy。
- 修复：所有 runtime stop 在创建后立即登记；`afterEach` 逆序 stop、`vi.clearAllTimers()`、`vi.restoreAllMocks()`，最后恢复真实 timer。手动 stop 仍保留以继续验证生产 cleanup 的幂等行为。
- 定向结果：`simulationRuntime.test.ts` 5/5 通过。

### Task 6：快速重复 FlowRuntime.restart 竞态

- 根因：每次 re-entry 都启动独立 `client.restart()`，旧调用的 `catch/finally` 可在 newer success 后重新写 `failed=true` 或释放 newer owner 的 gate。
- 修复：runtime 维护唯一 shared restart promise；并发调用共享同一恢复操作，settle 后才释放句柄；失败后下一次用户 retry 可创建全新的恢复操作。generation 继续隔离旧 frame。
- 回归测试：快速双击只产生 1 次 client restart；第一次共享恢复 rejection 后，两名调用者观察相同失败；后续 retry 成功并由新 frame 把 store 恢复为 `ready`，共 8/8 通过。

## 容错与质量实现

- `ErrorBoundary` 包裹整个 Workbench，fallback 保留“2D TEACHING CFD / 二维教学近似”和“SIMULATED / 模拟数据”，提供“重新加载实验台”。
- flow failure 使用非 modal alert；遥测 runtime 不停止，旧 flow field 不清空，按钮调用当前 Task 6 runtime restart。
- `SceneFallback` 为 inline SVG `role="img"`，直接标注整流段、收缩段、透明测试段、模型台、风扇段，并持续显示教学免责声明。
- canvas 注册 `webglcontextlost/restored`；loss 调用 `preventDefault()`、隐藏但保留 canvas listener、展示静态 SVG、仅停止/销毁 flow session；telemetry 继续。restored 增加 scene key 并创建新 flow session。
- 质量精确为：reduced `160×64 / 0 / 5Hz`；low `160×64 / 300 / 5Hz`；medium `240×96 / 900 / 10Hz`；high `320×128 / 1400 / 10Hz`。
- 三秒窗口平均 frame duration 严格以 `> 41.7ms` 为慢；每个窗口只降一级 `high → medium → low`，变更后清窗，不提供实验中 auto-upgrade。场景只在档位变化时上报低频事件。
- App 按 profile 重建 Worker；旧 client/runtime cleanup 不调用 store reset，replacement `ready` 后才提交 active quality。定向 App 测试证明 telemetry、教程第 2 章状态和旧 flowField 对象保持不变。

## Breakpoint 与无障碍自审

在本机 Chromium 逐档实测（首次 sandbox Mach-port 拒绝后按审批以同一脚本重跑成功）：

| Viewport | document/body 宽 | Topbar | Scene | Tabs |
|---|---:|---:|---:|---|
| 1440×900 | 1440 / 1440 | 72.19 px | 480 px | hidden |
| 1024×768 | 1024 / 1024 | 72.19 px | 445.44 px | grid |
| 390×844 | 390 / 390 | 52 px | 405.11 px（48vh） | grid/sticky |

390 px 宽度实际检查：模式按钮 `49.5×44`，三个 tab `130×46`，控制 tab 内启动/暂停/重置均约 `118×44`；slider 可见且可操作；两条顶部声明 bounding rect 均在 viewport 内；截图为 `/private/tmp/task10-390.png`。1024/390 下教程、控制、曲线使用语义 tablist 与 roving tabindex/方向键/Home/End；390 下 panel 为可滚动 bottom sheet，telemetry/condition cards 单列。

全局 `:focus-visible` 使用 `3px --flow`，主操作及 canvas 的所有 DOM 控制至少 44 px 高；高频 telemetry 数值没有 live region。`aria-live="polite"` 用于 phase、flow fault 与 context fault；reduced-motion 关闭粒子并压缩 CSS animation/transition duration。文本/媒体设有 max-width，三档均满足 `document.documentElement.scrollWidth <= innerWidth`。

## 最终验证

```text
npm run test:run
Test Files 24 passed (24)
Tests      143 passed (143)

npm run build
exit 0（仅保留 Vite 既有 >500 kB lazy scene chunk 建议）

npm run lint
exit 0
```

## 文件

- 新增：`src/features/shell/ErrorBoundary.tsx`、`ErrorBoundary.test.tsx`、`quality.ts`、`quality.test.ts`、`AppShell.test.tsx`、`src/features/scene/webglContextRecovery.ts`
- 修改：`src/App.tsx`、`src/App.test.tsx`、`src/features/shell/AppShell.tsx`
- 修改：`src/features/flow/flowRuntime.ts`、`flowRuntime.test.ts`、`src/features/experiment/simulationRuntime.test.ts`
- 修改：`src/features/scene/WindTunnelScene.tsx`、`WindTunnelScene.test.tsx`、`SceneFallback.tsx`
- 修改：`src/features/dashboard/ControlPanel.tsx`、`FieldSelector.tsx`、`HistoryChart.tsx`、`Dashboard.test.tsx`
- 修改：`src/styles/global.css`

未 branch、commit、stage/index；未接硬件；未更改数值算法或证据判定。

---

## Fix Round 1/5 — 5 个 Important 闭环

完整读取 `reviews/task-10.md` 后逐项验证，5 条 finding 均与当前实现一致，按 I1→I5 分别完成 RED→GREEN，未扩展数值、证据或额外场景功能。

### I1 — restart rejection 被 UI 消费并允许 retry

- RED：`ControlPanel` 的第一次 restart mock rejection 被 Vitest 明确报告为 `Unhandled Rejection: replacement init failed`，虽然 16 个断言本身通过，测试进程仍有 1 error。
- GREEN：`restartFlow` 对预期 rejection 使用 `catch` 消费，flow store 的既有 `failed/flowError` 继续作为可见错误源，`finally` 恢复按钮。
- 测试：第一次 rejection 后 store fault 原样保留、按钮重新启用、无 `unhandledrejection`；第二次 resolved retry 被调用。`Dashboard.test.tsx` 最终 17/17。

### I2 — compact tabs 与 tabpanel 双向语义

- RED：测试在 compact viewport 下查询 `role="tabpanel"`，得到 `Unable to find an element with the role "tabpanel"`。
- GREEN：保留桌面 `nav/aside/section` landmarks，在内部增加 compact-only `role="tabpanel"` wrapper；每个 tab 的 `aria-controls` 指向 panel id，panel 的 `aria-labelledby` 回指 tab id。
- inactive panel 同时拥有 `hidden` 与 `inert`，因此内容不可见、不可聚焦；active panel 两者均无。方向键/Home/End roving tabindex 行为保持。
- 定向结果：`AppShell.test.tsx + App.test.tsx` 7/7。

### I3 — Orbit camera 键盘 DOM 等价控制

- RED：新增 camera keyboard test 后无法解析 `CameraControlBar`，证明 DOM bridge 尚不存在。
- GREEN：仅增加 5 个必要的 44×44 控制：重置、左转 15°、右转 15°、放大、缩小；清晰 accessible name 为“重置/向左/向右/放大/缩小三维视角”。
- `WindTunnelScene` 以 refs 保存 R3F `PerspectiveCamera` 与同一个 `OrbitControls`；按钮命令直接更新 camera position、controls target、projection 与 `controls.update()`，未把相机高频状态写入 React。
- 键盘测试聚焦“向右旋转三维视角”后按 Enter，确认原 camera position 改变；click 放大确认 target distance 下降；reset 恢复 `[7.8, 4.6, 10.4]` / `[0, -0.05, 0]`。scene 定向 5/5。

### I4 — live semantics 仅 phase / fault

- RED：全 App DOM 枚举 `[aria-live], [role=status]` 得到 5 个越界节点：教程进度、教程提示、scene Suspense、phase 与正常 sweep；期望只有 phase。
- GREEN：移除 Hotspots、TutorialRail、正常 SweepPanel 和两个 Suspense fallback 的显式/隐式 status。保留 phase badge、flow fault、WebGL context fault 与 ErrorBoundary fault；sweep/export error 仍为 fault alert。
- 全 App allowlist test 最终只得到 `待机 / IDLE` phase announcer；App、scene、tutorial、report 聚焦 50/50。

### I5 — 390 px 触控命中区

- RED：DOM 测试证明 slider 直属 fan-control section，缺少专用 hit wrapper；原 Chromium 证据为 slider `366×16`、telemetry 查看约 `27×44`。
- GREEN：range 嵌入与其关联的 `.fan-slider-hit-area` label，wrapper `display:flex; align-items:center; min-height:44px`，轨道保持垂直居中；所有 button 全局 `min-width:44px`，既有 min-height 规则保留。
- 390×844 Chromium fix-round 实测：document/body width 均 `390`；range 可命中 wrapper rect `366×44`；4 个 telemetry 查看按钮均 `44×44`；5 个 camera 按钮均 `44×44`；field buttons 约 `87.9×45.5`；三个 tabs `130×46`。
- Chromium 遍历教程/控制/曲线三个 panel 的全部可见 enabled button/input/textarea/a：button 与 range effective hit target 均不小于 44×44；inactive panel 实测 `hidden=true, inert=true`，active 控制 panel 两者均 false。
- 实际截图：`/private/tmp/task10-fix-390.png`。

### Fix Round 1 最终验证

```text
npm run test:run -- src/features/shell src/features/scene src/features/dashboard \
  src/features/tutorial src/features/report src/App.test.tsx
Test Files 15 passed (15)
Tests      83 passed (83)

npm run test:run
Test Files 25 passed (25)
Tests      147 passed (147)

npm run build
exit 0（仅既有 WindTunnelScene lazy chunk >500 kB 建议）

npm run lint
exit 0
```

Fix-round 新增文件：`src/features/scene/CameraControlBar.tsx`、`cameraCommands.ts`、`CameraControls.test.tsx`。其余修改限于 `ControlPanel`/dashboard test、`AppShell`/test、`WindTunnelScene`、Hotspots、TutorialRail、ExperimentReport、App live allowlist test 与 touch CSS。未 commit、stage/index 或派生 branch。
