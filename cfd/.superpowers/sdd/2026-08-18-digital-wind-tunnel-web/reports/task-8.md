# Task 8 实施报告：实验控制、遥测、场选择与历史曲线

## 结果

已完成右侧实验控制/场选择/四项遥测和底部 60 秒 Recharts 历史区，并装配到 `AppShell`。控制支持 0–100% 同步 slider、启动/暂停/继续、按历史条件确认重置和中英 phase；四张遥测卡使用固定格式、单位、quality 与各自 `SIMULATED`/查看按钮；压力标签为“车底相对压力”并保留负号。四项场变量通过语义 radiogroup 更新 Zustand store 与教程 evidence；求解器行只显示 D2Q9 BGK、活动网格、映射入口速度、flow status 和“二维教学近似”，不显示 Cd/Cl。

## TDD：RED → GREEN

首轮先创建 `Dashboard.test.tsx` 与确定性 `ResizeObserver` polyfill，未创建生产组件时运行：

```text
npm run test:run -- src/features/dashboard/Dashboard.test.tsx
Test Files  1 failed (1)
Error: Failed to resolve import "./ControlPanel"
```

失败来自 Task 8 模块缺失，符合预期。实现控制、格式、radiogroup、60 秒/1,200 点边界与稳定窗后聚焦 GREEN 为 6/6；随后为严格 evidence 规则开启第二个小循环，测试先因缺少 `./evidenceRecording` 得到 RED，再实现纯 reducer 并让 App 复用，同一聚焦命令最终 8/8。

brief 指定 shell 回归最终通过：

```text
npm run test:run -- src/features/dashboard src/App.test.tsx
Test Files  2 passed (2)
Tests       11 passed (11)
```

测试保护：四态控制/确认重置、四种字面格式与负压力、每卡 provenance/quality/inspect、四字段 store+callback、60 秒且不超过 1,200 点、稳定窗不改 history，以及 `stableSeconds` 仅在 command/frame 都为 30 且 source physical `quality === "stable"` 时按 simulation time 累计。测试特意给稳定 frame 一个极端 noisy RPM，证明 evidence 不从显示值反推稳定性。

## 实现要点

- `ControlPanel` 直接消费既有 `labStore` action；暂停仅 active phase 可用，paused 时 primary 变为“继续实验”，history 非空才调用确认框。
- `TelemetryCards` 以 `toFixed(0/2/1/3)` 固定 RPM、m/s、Pa、N；pressure 使用 `underbodyPressurePa` 原值，未做绝对值转换。
- `FieldSelector` 的四个 radio 均有 exact 中文 accessible name；每次选择同时 `selectField` 并回报 field id。状态行复用 `mapWindToLatticeVelocity`，无工程 Cd/Cl 暗示。
- `mapHistoryToChartData` 是独立模块级纯函数，先裁最近 60,000 ms，再硬限 `MAX_HISTORY=1,200`；组件以 `useMemo([history])` 保证同一 immutable history 不重复映射。
- 历史区保留四条 `Line`（风速、RPM、压力、载荷）和分组 unit y-axis；原生 legend buttons 只切换 `hide`，不删除 store history。稳定连续段用 `ReferenceArea` 标示，原生“标记稳定窗口”按钮键盘可达且只写 evidence。
- App 启动既有 50 ms fixed-step simulation runtime，并在 reset 时同步 reset source；sensor/field/stable-window 均通过纯 evidence reducer 去重写入真实 `TutorialEvidence`。

## 格式与无障碍自审

- 视觉基准已完整查看，只复用深色工程台的信息密度、青/黄/红数据语义；未嵌入位图，Task 8 UI 与 scene 背景均无 gradient、backdrop filter 或玻璃态。
- 右侧只保留三个功能 section；四个传感器采用共享网格边线而非四个浮动容器，无圆角/阴影卡片泛滥。
- slider 有显式 label/output/min/max/step；phase 使用 `aria-live`；场选择为 named radiogroup/radio；legend 有 `aria-pressed`；稳定窗为 exact-name 原生 button；所有交互均有 `:focus-visible`。
- exact 单位与来源断言通过；solver 行静态扫描确认无 Cd/Cl。

## 性能自审

- Store 自身和 chart mapping 双重限制 1,200 点/最近 60 秒；所有 Line 关闭动画和点标记，稳定段搜索线性且只对 memoized data 执行。
- legend 隐藏不复制/清除 history；稳定窗 evidence 不触发 store history mutation。
- Recharts 通过 `React.lazy` 独立为 356.91 kB chunk，基础 chunk 从集成前约 567.94 kB 降为 209.69 kB；测试初始尺寸避免 jsdom 0×0 警告，浏览器仍由 ResponsiveContainer/ResizeObserver 响应布局。
- build 仅保留既有 `WindTunnelScene` lazy chunk >500 kB 的非阻塞提示，Task 8 的基础和 chart chunk 均低于 500 kB。

## 最终验证（fresh）

```text
npm run test:run
Test Files  17 passed (17)
Tests       71 passed (71)

npm run build
tsc --noEmit + vite build: exit 0
base 209.69 kB; HistoryChart 356.91 kB

npm run lint
eslint .: exit 0
```

## 文件

- `src/features/dashboard/ControlPanel.tsx`
- `src/features/dashboard/TelemetryCards.tsx`
- `src/features/dashboard/FieldSelector.tsx`
- `src/features/dashboard/HistoryChart.tsx`
- `src/features/dashboard/historyMapping.ts`
- `src/features/dashboard/evidenceRecording.ts`
- `src/features/dashboard/Dashboard.test.tsx`
- `src/App.tsx`
- `src/styles/global.css`
- `src/test/setup.ts`
- `.superpowers/sdd/2026-08-18-digital-wind-tunnel-web/reports/task-8.md`

## 范围与完整性

只修改 Task 8 dashboard、App 装配、所需样式/测试垫片与本报告；未启动、修改或引用 Task 9 sweep。未创建分支，未 stage、commit 或触碰 git index；未派生子 Agent。

## Fix round 1 — Radio 键盘契约、四轴布局与点击时边界

完整读取 `reviews/task-8.md` 后，先加入四个用户可观察的定向用例：render 后同批到达 frame 再 reset、四方向键循环选择与 roving tabindex、四个可见且位置不同的单位轴、单个 stable sample 不出现标记。首次聚焦 RED 为 `4 failed / 8 passed`：confirm 0 次、四个 radio 的 tabIndex 均为 0、仅渲染 2 个 y-axis、单点错误显示 0.10–0.10 s 标记。轴用例最初被 jsdom 0×0 容器遮蔽，因此只完善测试 ResizeObserver 为确定性的 320 × 140 回调；重新运行后明确得到 `expected 4 / received 2`，证明失败来自隐藏轴而非测试环境。

修复采用局部实现且不改变任务外接口：

- Field radio 现只有选中项 `tabIndex=0`，其余为 -1；ArrowLeft/Right/Up/Down 循环聚焦并立即选择/回报 evidence，另支持 Home/End。定向测试完整走过四种方向键、首尾回环、focus、store 与 callback 序列。
- velocity/RPM 两轴均在左，pressure/load 两轴均在右；四者不再 `hide`，各自保留 38 px 布局宽度、三档小字号刻度与 m/s、RPM、Pa、N 单位标签。同侧 axis 由独立 yAxisId/width 参与 Recharts offset 计算；320 px 测试尺寸下四条 axis line 的 x 坐标仍各不相同。
- reset handler 不再捕获 render-time boolean，而是在 click handler 内读取 `labStore.getState().history.length`。frame 与 native click 同一 React batch 的回归现会调用 confirm。
- `findStableWindow` 仅在 bestEnd > bestStart 且 end time > start time 时返回窗口；单点和同时间零时长段均不会提供教程 evidence 按钮。

Fix round 最终验证（fresh）：

```text
npm run test:run -- src/features/dashboard src/App.test.tsx
Test Files  2 passed (2)
Tests       15 passed (15)

npm run test:run
Test Files  17 passed (17)
Tests       75 passed (75)

npm run build
tsc --noEmit + vite build: exit 0

npm run lint
eslint .: exit 0
```

build 仍仅有既存 `WindTunnelScene` lazy chunk >500 kB 的非阻塞 warning。未触碰 Task 9、分支、index、stage 或 commit。
