# Task 9 实施报告：三工况自动扫频、对比与 CSV

## 结果

已把固定 30% → 60% → 90% 自动扫频接入既有 `labStore.acceptFrame` 遥测入口，并在底部实验工作区装配 `SweepPanel`、三工况统计卡、`ComparisonTable` 与 `ReportPanel`。实现只消费既有 `TelemetryFrame`、50 ms 仿真步进与 tutorial evidence；未复制求解器或物理公式，未接硬件/后端。

## TDD：RED → GREEN

### RED

首次运行：

```text
npm run test:run -- src/features/sweep src/features/report \
  src/features/experiment/labStore.test.ts \
  src/features/tutorial/tutorialProgress.test.ts

Test Files  6 failed (6)
Tests       2 failed | 8 passed
```

预期失败原因：`sweepRunner`、`experimentSummary`、`csv`、`ExperimentReport` 模块不存在；store 缺少 sweep actions；tutorial 证据错误接受乱序 `[90,60,30]`。

自审又分别用 RED 锁定并修复：RFC4180 字段内 CRLF、四指标卡片、自动扫频期间手动控件锁定、取消后保留 sweep 快照、取消后手动实验可恢复、无效摘要不得提交残差 evidence。

### GREEN

聚焦阶段通过：

```text
npm run test:run -- src/App.test.tsx src/features/report \
  src/features/sweep src/features/tutorial \
  src/features/experiment/labStore.test.ts

Test Files  8 passed (8)
Tests       31 passed (31)
```

最终 fresh verification：

```text
npm run test:run -- src/features/sweep src/features/report src/features/tutorial
Test Files  6 passed (6)  | Tests 24 passed (24)

npm run test:run
Test Files 21 passed (21) | Tests 93 passed (93)

npm run build
exit 0（仅现有 WindTunnelScene 大 chunk warning）

npm run lint
exit 0
```

## 行为与时序

- 固定且唯一工况顺序为 `30, 60, 90`；下一个工况命令通过 `commandPowerPct` 返回给 store。
- 只接受 `frame.fanPowerPct === commandedPowerPct` 的帧；前一工况尾帧完全不推进计时或采样。
- 连续稳定 2,000 ms 后进入 sampling；transient 会把 `stableMs` 归零。
- sampling 固定累计 4,000 ms，保留全部原始采样帧；汇总只过滤 stable 帧。
- 未进入 sampling 的工况在仿真时间 15,000 ms 失败；重试只清当前失败工况，保留已完成工况和其数组引用。
- reducer 只依赖显式 `dtMs`；fake timers 改变系统时间后结果仍完全相同。
- 取消把 sweep 标记为 idle 并保留已采样快照与 60 秒 history；重新运行创建全新 sweep，并清理 sweep/report tutorial evidence；全局 reset 清空 sweep/history。
- 自动扫频期间手动滑块与暂停按钮禁用，避免破坏固定命令；取消后普通实验仍可启动。

## 汇总、比较与证据

每个工况按 RPM、风速、压力、载荷输出 avg、population std、min、max；另含稳定样本数、最早/最晚仿真时间，以及稳定样本少于 20 时 `valid: false`。UI 卡片展示四指标，CSV 也输出完整统计。

比较表用 30% 稳定结果作为观测基线，展示载荷相对 `v²` 趋势的绝对残差；只有三个摘要有效时才允许选择。选中实际最大残差后写入既有 `selectedLargestResidual` evidence。扫频完成顺序和至少 12 字符结论分别写回已有 tutorial evidence。

## CSV 样例与验证

序列化结果以 UTF-8 BOM (`U+FEFF`) 开始，所有记录使用 CRLF；逗号、双引号、字段内换行按 RFC4180 引号规则处理，字段内换行也归一化为 CRLF。示例：

```csv
title,SophiFlow 三工况数字风洞实验
generatedTime,2026-08-18T01:02:03.000Z
provenance,simulated
solver,D2Q9 BGK teaching solver
gridSize,240 × 96
conclusion,"速度越高, ""载荷""越大"
disclaimer,SIMULATED / 模拟数据；2D TEACHING CFD / 二维教学近似
```

随后写出 units、十列原始帧区块，以及固定 30/60/90 三行完整汇总区块。下载名为 `sophiflow-cfd-sweep-YYYYMMDD-HHMMSS.csv`；测试验证 anchor click 后 `URL.revokeObjectURL` 必定执行。导出失败时 UI 保留已序列化的不可变字符串快照，显示“导出失败，实验数据仍保留”，重试不会读取后来变化的 store。

## 文件

新增：

- `src/features/sweep/sweepRunner.ts`
- `src/features/sweep/sweepRunner.test.ts`
- `src/features/report/experimentSummary.ts`
- `src/features/report/experimentSummary.test.ts`
- `src/features/report/csv.ts`
- `src/features/report/csv.test.ts`
- `src/features/report/ExperimentReport.tsx`
- `src/features/report/ExperimentReport.test.tsx`

修改：

- `src/features/experiment/labStore.ts` / `.test.ts`
- `src/features/tutorial/tutorialProgress.ts` / `.test.ts`
- `src/features/dashboard/ControlPanel.tsx` / `Dashboard.test.tsx`
- `src/App.tsx` / `App.test.tsx`
- `src/styles/global.css`

## 自审

- 未改 D2Q9 求解器、physics、telemetry 格式逻辑或后端边界。
- 自动机与统计/CSV 均为纯函数；浏览器副作用只在 download helper 与 `window.print()`。
- 原始 sweep 样本不受 `MAX_HISTORY=1200` 截断；导出失败不清数据。
- 教学声明在页面与 CSV 中始终存在。
- 未创建分支、未 commit、未操作 Git index。
- build 的大 chunk 提示来自现有 3D chunk，未作为 Task 9 扩展处理。

## Fix round 1/5 — review findings

依据 `reviews/task-9.md` 的 5 个 Important 与 2 个 Minor finding，逐项执行了新的 RED→GREEN。

### I1：residual / evidence 全局门槛

- RED：仅 30% 有效、仅 30/60% 有效、三者有效但 sweep 仍 sampling，共 3 个测试失败；radio 被提前启用。
- GREEN：只在 `sweep.status === "completed"`、30/60/90 三摘要全部 valid 后建立 residual；任一结果非 finite 时三行 residual 全部归 `null`，radio/evidence 全部禁用。
- 三工况全部有效且完成时，既有 90% 最大残差交互测试继续通过。

### I2：store sweep ownership

- RED：直接调用 `pauseRun()` 改变了 active sweep 根 state；重复 `startSweep()` 会静默重建。
- GREEN：`startRun/pauseRun/resumeRun/advancePhase/startSweep` 与既有 `setFanPower` 统一在 active sweep 时返回完全相同的 state/reference。
- `cancelSweep/resetLab` 后手动 action 解锁；sweep 为 idle/failed/completed 时允许合法 restart。

### I3：spreadsheet formula injection

- RED：`= + - @`、前导空格和 tab 共 6 组危险结论均原样进入 CSV。
- GREEN：只对 string cell 检查忽略前导 whitespace 后的首字符，并在原字符串最前加 apostrophe；普通中文不变，number `-1` 不加前缀。
- RFC4180 的 BOM、CRLF、quote/comma/newline escaping 保持通过。

### I4：非有限、回退与超大 dt

- RED：runner 的 NaN 永久污染 timer，Infinity/6000 ms 一帧跨阶段，负 dt 被静默归零；store 接纳坏时间戳并污染 telemetry/history。
- GREEN 裁定：正确功率帧遇到 `NaN`、`±Infinity`、负 dt 或单步 `>1000 ms`，立即进入可 `retrySweep` 的 failed；所有 timer 保持原有限值。
- store 不接纳该坏帧，保留上一有效 telemetry/history，因此 retry 后可由下一个合法时间戳继续。错误功率且时间非法的尾帧整帧忽略并保持根 state 引用。

### I5：finite stable summary / residual

- RED：五个数值字段分别异常的 stable 帧仍计入 sampleCount；20 个全异常帧仍 valid；残差溢出仍启用 radio，共 7 个失败。
- GREEN：只有 simulationTime、RPM、wind、pressure、load 全部 finite 的 stable frame 参与统计；valid 以过滤后的数量 ≥20 且四组统计 finite 判定。
- residual 明确验证 baseline means、各工况 means 与最终绝对残差均 finite，任何失败都关闭整组比较。

### M1：object URL 生命周期

- RED：`document.createElement` setup 抛错后 revoke 调用数为 0。
- GREEN：`createObjectURL` 成功后立即进入 `try/finally`，anchor 创建、属性设置、click 全被覆盖；setup throw 与 click throw 都验证 revoke。

### M2：统一导出失败与不可变重试

- RED：注入 serializer throw 后没有 alert/重试入口，download 之外的失败未进入 UI。
- GREEN：serialization 与 download 共用“导出失败，实验数据仍保留”状态。导出时深拷贝每个 frame 形成 input snapshot；序列化失败重试同一 input，下载失败重试已生成的 CSV，均不重新读取后来变化的 sweep/结论/时间。

### Fix round 验证

```text
npm run test:run -- src/features/sweep src/features/report src/features/tutorial src/features/experiment/labStore.test.ts
Test Files 7 passed (7) | Tests 64 passed (64)

npm run test:run
Test Files 21 passed (21) | Tests 129 passed (129)

npm run lint
exit 0

npm run build
exit 0（仅现有 WindTunnelScene 大 chunk warning）
```
