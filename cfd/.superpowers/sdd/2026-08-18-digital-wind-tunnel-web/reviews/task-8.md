# Task 8 审查 — Dashboard

## Spec Compliance

- **控制：** `ControlPanel` 提供 0–100、步长 1 的 range input 与同步数字输出、主启动/继续动作、仅 active phase 可用的暂停、仅 history 非空才确认的 reset，以及六种中英双语 phase 标签。确认框只在点击 handler 中读取，因此 render/SSR 不会访问 `window.confirm`。
- **遥测：** 四卡均使用要求的精确格式（`0/2/1/3` 位小数）、单位、quality、各卡 `SIMULATED` 和 inspect callback；压力标签精确为 `车底相对压力`，直接格式化原值，负号得以保留。
- **场选择 / 求解器：** 四个 field identifier 均写 store 并回调 evidence。solver 行为只读，且仅含 D2Q9 BGK、网格、格点入口速度、flow status 和 `二维教学近似`，没有 Cd/Cl。ARIA radio 的键盘契约不完整，见 Important 1。
- **History：** `mapHistoryToChartData` 是模块级纯函数，按 immutable history identity memoize，限制为 simulation time 最近 60 秒且最多 `MAX_HISTORY`（1,200）条。图中有四个 `Line`；legend 只切换本地 `hiddenSeries`；稳定段搜索和标记都不改 history；稳定窗动作为原生、键盘可达 button。但两个单位轴被隐藏，单个稳定点也会成为窗口，见 Important 2 与 Minor 2。
- **Runtime / evidence：** 每次 committed mount 由 `App` 唯一创建 simulation source/runtime，cleanup 时退订并停止，并在 lab reset 后同步 reset 自己拥有的 source。React StrictMode 的 setup/cleanup/setup 后只剩第二个 interval。稳定证据同时要求当前 command 与 emitted frame power 均为 30，使用 source 写入的 `quality === "stable"`，并只累加正 simulation-time delta；没有从 noisy RPM/风速/压力/载荷反推稳定性。sensor、field、hotspot 和 stable-window evidence 值均去重。
- **独立验证：** `npm run test:run -- src/features/dashboard src/App.test.tsx` 通过 11/11；全量 `npm run test:run` 通过 71/71；`npx tsc --noEmit` 与 `npm run lint` 均退出 0。生产 Vite build 写到 `/private/tmp/cfd-task8-review-build` 并退出 0（仅有既存 scene chunk >500 kB 警告）。实施报告中的 claim 未作为验证证据。

## Strengths

- evidence reducer 在 producer 边界建立了 Task 4 的 load-bearing 30% 不变量，没有信任显示值或调用方断言。[`src/features/dashboard/evidenceRecording.ts:6`](../../../../src/features/dashboard/evidenceRecording.ts#L6)
- history 转换纯净、同时受时间与数量约束并在组件边界 memoize；legend state 和 stable-window evidence 都不重写 store history。[`src/features/dashboard/historyMapping.ts:15`](../../../../src/features/dashboard/historyMapping.ts#L15) [`src/features/dashboard/HistoryChart.tsx:28`](../../../../src/features/dashboard/HistoryChart.tsx#L28)
- runtime ownership 集中；本任务引入的 store subscription、interval 与 visibility listener 都通过 cleanup 完整终止。[`src/App.tsx:28`](../../../../src/App.tsx#L28) [`src/features/experiment/simulationRuntime.ts:47`](../../../../src/features/experiment/simulationRuntime.ts#L47)
- telemetry provenance、quality、精度、单位与负压力均由生产 markup 实现，不只存在于实施报告的声明中。[`src/features/dashboard/TelemetryCards.tsx:17`](../../../../src/features/dashboard/TelemetryCards.tsx#L17)

## Issues

### Critical

无。

### Important

1. **自定义 radiogroup 没有实现 radio-group 键盘行为。** 每项是被覆写为 `role="radio"` 的原生 button，但四项都保留在 tab order，且没有 roving `tabIndex` 或 ArrowLeft/ArrowRight/ArrowUp/ArrowDown handler。键盘用户必须逐个 Tab，不能用 radio group 规定的方向键移动/选择。应改用原生 radio input，或实现单一可 Tab radio 与循环方向键选中/聚焦。[`src/features/dashboard/FieldSelector.tsx:46`](../../../../src/features/dashboard/FieldSelector.tsx#L46)

2. **四个 unit-specific chart axis 中有两个被显式隐藏。** RPM 与 load line 虽分别绑定 `rpm`、`load` y-axis ID，但对应 axis 设置了 `hide`；用户能看到曲线和 legend 单位，却看不到 RPM/N 刻度。这不满足要求的左侧 velocity/RPM、右侧 pressure/load 可见单位轴分组。应为 secondary axis 设置独立位置/offset，而不是隐藏。[`src/features/dashboard/HistoryChart.tsx:71`](../../../../src/features/dashboard/HistoryChart.tsx#L71)

### Minor

1. **Reset confirmation 使用 render 时捕获的 history flag，而不是激活时的 store。** 若第一帧在该 handler 所属 render 后、click 处理前到达，`hasHistory` 仍可能为 false，使非空 history 被无确认清除。应在 `reset` 内查询 `labStore.getState().history.length`，让 destructive guard 使用 click-time state。[`src/features/dashboard/ControlPanel.tsx:20`](../../../../src/features/dashboard/ControlPanel.tsx#L20) [`src/features/dashboard/ControlPanel.tsx:31`](../../../../src/features/dashboard/ControlPanel.tsx#L31)

2. **单个 stable sample 会被暴露为可标记的“stable window”。** `findStableWindow` 接受首个稳定点，得到相同 start/end、零宽 `ReferenceArea`，从而在尚无非零稳定段时就可写教程证据。应至少要求两个连续稳定 sample（或正 start/end duration）才渲染 marker。[`src/features/dashboard/HistoryChart.tsx:109`](../../../../src/features/dashboard/HistoryChart.tsx#L109)

## Assessment

**Needs changes。** 核心行为、bounded history、simulation-time evidence、runtime cleanup/reset、telemetry semantics 与验证均可靠。在 radiogroup 具备标准键盘交互、四个单位刻度全部可见前，不应判定完全合规；两项 Minor 是局部且易修的边界问题。

---

## Fix Round 1 Review

### Finding Resolution

1. **ADDRESSED — radiogroup roving tabindex / arrows。** 当前选中项为唯一 `tabIndex=0`，其余为 `-1`；四个方向键均循环移动、聚焦、写入 store 并回调 evidence，另覆盖 Home/End。[`src/features/dashboard/FieldSelector.tsx:39`](../../../../src/features/dashboard/FieldSelector.tsx#L39) [`src/features/dashboard/FieldSelector.tsx:66`](../../../../src/features/dashboard/FieldSelector.tsx#L66) 定向测试验证首尾循环、focus、store、callback 与 roving tab order。[`src/features/dashboard/Dashboard.test.tsx:118`](../../../../src/features/dashboard/Dashboard.test.tsx#L118)

2. **ADDRESSED — 四轴 visible / offset。** velocity、RPM、pressure、load 四轴均不再设置 `hide`，分别保留单位标签与独立 `yAxisId`；同侧双轴由 Recharts 根据 orientation/width 分配不同位置。[`src/features/dashboard/HistoryChart.tsx:71`](../../../../src/features/dashboard/HistoryChart.tsx#L71) 定向测试确认四个 `.recharts-yAxis`、四个单位文本及四个不同 axis-line x 坐标。[`src/features/dashboard/Dashboard.test.tsx:168`](../../../../src/features/dashboard/Dashboard.test.tsx#L168)

3. **ADDRESSED — reset 使用 click-time history。** handler 现在于激活时直接读取 `labStore.getState().history.length`，不再依赖 render-captured boolean。[`src/features/dashboard/ControlPanel.tsx:30`](../../../../src/features/dashboard/ControlPanel.tsx#L30) 回归测试把 frame 写入与 native click 放入同一 batch，确认仍调用 confirm。[`src/features/dashboard/Dashboard.test.tsx:61`](../../../../src/features/dashboard/Dashboard.test.tsx#L61)

4. **ADDRESSED — stable window 至少两点且正时长。** 只有 `bestEnd > bestStart` 且 `end > start` 才返回窗口；单点及同时间双点均不能生成 marker。[`src/features/dashboard/HistoryChart.tsx:121`](../../../../src/features/dashboard/HistoryChart.tsx#L121) 单 stable sample 回归测试确认按钮不存在。[`src/features/dashboard/Dashboard.test.tsx:185`](../../../../src/features/dashboard/Dashboard.test.tsx#L185)

### New Breakage

未在本轮四项修复范围内发现新破坏。独立运行 `npm run test:run -- src/features/dashboard/Dashboard.test.tsx`，12/12 通过。

### Out-of-Scope

按复审指令，本轮未重新审查 Task 8 其他代码、runtime/evidence 既有结论或 Task 9+ 集成，也未把实施报告声明视为证据。

### Verdict

**APPROVED — 原 4 findings 全部关闭。**
