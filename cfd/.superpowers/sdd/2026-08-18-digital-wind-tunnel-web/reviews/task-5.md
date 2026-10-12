# Task 5 审查：D2Q9 LBM 核心与程序化车辆遮罩

审查范围仅限 controller 提供的 Task 5 brief、实现报告与一次性 diff 快照；未修改源码、index 或 HEAD。先按规格静态核对实现，再对一个具体数值测试疑点运行了轻量只读对照实验，未全量重跑测试。

## Spec Compliance

- D2Q9 的 `CX`、`CY`、`WEIGHT`、`OPPOSITE` 与平衡态公式逐项等于 brief 指定值；BGK 使用 `f - (f - fEq) / tau`，并在迁移前由当前分布计算密度和速度。`src/features/flow/lbmSolver.ts:3-13`, `src/features/flow/lbmSolver.ts:143-160`
- 推式迁移对上/下边界外链及固体邻居执行源格点反弹；左右越界分布丢弃后，按规定顺序覆盖左侧平衡态入口、从倒数第二列复制到右侧零梯度出口，再交换双缓冲。`src/features/flow/lbmSolver.ts:162-185`, `src/features/flow/lbmSolver.ts:188-207`
- 构造函数分配两份 `Float32Array(cellCount * 9)` 分布缓冲区；迭代热路径只 `fill`、写入和交换引用，没有逐步数组分配。输出 frame 及五个字段数组也只构造一次并由 `snapshot()` 复用。`src/features/flow/lbmSolver.ts:51-64`, `src/features/flow/lbmSolver.ts:73-81`, `src/features/flow/lbmSolver.ts:133-185`
- 所有流体格点按密度 1、零速度平衡态初始化；`tau <= 0.5` 抛 `RangeError`，构造与 setter 的入口速度均经过 `[0, 0.08]` clamp。`src/features/flow/lbmSolver.ts:37-49`, `src/features/flow/lbmSolver.ts:69-70`, `src/features/flow/lbmSolver.ts:120-131`, `src/features/flow/lbmSolver.ts:243-245`
- `snapshot()` 输出并复用 `speed`、`pressure`、`vorticity`、`velocityX`、`velocityY`，provenance 精确为 `"2d-teaching-cfd"`；固体速度被置零，流体压力使用 `(density - 1) / 3`，涡量在内部用中心差分、边缘用单边差分。`src/features/flow/lbmSolver.ts:55-64`, `src/features/flow/lbmSolver.ts:81-117`, `src/features/flow/lbmSolver.ts:209-227`
- 五个输出字段逐格进行有限性检查；任一非有限值会抛出带 `code === "NON_FINITE_FIELD"` 的 `NumericalInstabilityError`。`src/features/flow/lbmSolver.ts:15-22`, `src/features/flow/lbmSolver.ts:229-240`
- 车辆遮罩使用归一化坐标组合圆角下车身、座舱、鼻部斜坡、后圆角及两个轮洞；全局门限把固体限制在 x=36%–66%、y=43%–66%，循环又明确避开四周 tunnel boundary。`src/features/flow/obstacleMask.ts:5-39`
- 零入口 20 步测试计算全场平均压力并以 6 位小数接近零，报告值 `2.48e-9` 满足 `< 1e-6`；固体速度、入口 clamp、tau、持续驱动有限性与类型化异常也有覆盖。`src/features/flow/lbmSolver.test.ts:4-10`, `src/features/flow/lbmSolver.test.ts:25-74`

## Strengths

- 碰撞、迁移、反弹、入口、出口和交换的次序与 brief 完全一致，写入目标分布槽位清楚，没有看到同一迁移阶段的非预期累加或覆盖。`src/features/flow/lbmSolver.ts:133-185`
- 分布与可视化输出均采用固定 TypedArray；`step()` 即使执行多次迭代也不会创建新 frame 或字段数组，符合浏览器交互热路径要求。`src/features/flow/lbmSolver.ts:51-64`, `src/features/flow/lbmSolver.ts:73-79`
- vorticity 的分母自然为内部 2、边缘 1，准确实现中心差分与单边差分，而非在边缘越界或硬编码为同一尺度。`src/features/flow/lbmSolver.ts:211-224`
- 非有限入口不会被静默传播成可视化结果；现有异常测试同时检查错误类与稳定 code。`src/features/flow/lbmSolver.test.ts:61-74`

## Issues

### Critical

- 无。

### Important

- **“车辆尾流更慢”测试不能证明尾流由车辆或反弹产生。** 用完全相同的 `96×40 / inlet=0.055 / tau=0.62 / 160 steps` 参数，把车辆遮罩替换为全零遮罩后，现有两个采样点仍得到 `upstream=0.036897`、`wake=0.033872`，同样满足 `wake < upstream`。这说明断言主要捕捉有限时间入口传播/边界造成的流向速度差；即使障碍物判断或固体反弹整体失效，该测试仍可能保持绿色。应至少与同参数空遮罩基线比较车辆后方的速度亏损，或比较车辆前后多个横截面/区域统计，使测试对障碍物作用具有判别力。`src/features/flow/lbmSolver.test.ts:13-22`

### Minor

- **遮罩测试只证明“存在某个固体且首末列为空”，没有保护完整几何契约。** 当前断言不会发现固体越出 y=43%–66%、触碰上/下壁，或座舱/鼻部/轮洞被删除；甚至任意单个内部固体格点都能通过。实现代码经静态核对符合范围，但建议补充所有固体格点的归一化包围盒、首末行以及两个轮洞代表点/区域的断言，避免程序化几何回归。`src/features/flow/obstacleMask.test.ts:3-11`

## Assessment

生产实现按静态代码证据满足 Task 5 的绑定规格：D2Q9 常量和平衡态准确，BGK/迁移/反弹/入口/出口顺序正确，tau 与入口处理、TypedArray 双缓冲和快照复用、压力/涡量/provenance、固体零速度及非有限异常均已落实；未发现 Critical 级实现缺陷。

但核心“车辆造成较慢尾流”的数值测试存在 Important 判别力缺口，空遮罩也能通过，因此报告中的尾流数值不能作为障碍物物理作用的独立验证。结论：**实现基本通过，数值验收证据需补强；建议在接受 Task 5 前增加空遮罩基线或区域速度亏损回归。**

---

# Fix round 1 范围复审

本轮只复核原审查的两项 finding 与 controller 提供的测试快照；不重审生产实现，未全量重跑测试。

## 1. 尾流测试在空遮罩也通过 — ADDRESSED

修复后的测试以完全相同的网格、入口、tau 和 160 步分别运行车辆遮罩与空遮罩，并对车辆后方 x=68–82、y=18–23 的 90 个单元求区域均速；断言同时要求空风洞确有流动且车辆场至少产生 8% 速度亏损。若车辆遮罩被移除或障碍物作用失效，两场相等，第二个断言会失败。报告记录的 RED 也确实以两个空遮罩得到相等均速 `0.0337432` 并失败，GREEN 的车辆/空场比值约 `0.842`，相对阈值有合理余量。`src/features/flow/lbmSolver.test.ts:13-36`

## 2. 遮罩测试未保护范围、四边、轮洞/组成 — NOT ADDRESSED（部分修复）

归一化 x/y 包围范围、四条边、两个轮洞 3×3 区域以及座舱代表点现已有直接断言，这些子项已修复。`src/features/flow/obstacleMask.test.ts:9-44`

但所谓鼻部代表点 `(0.62, 0.56)` 不是鼻部独占点：在当前 `160×64` 网格上实际格心为约 `(0.621875, 0.554688)`，它同时满足圆角下车身的椭圆条件。因此即使整个 `noseRamp` 被删除，行 45 仍由 `roundedBody` 置为固体，测试继续通过，原 finding 中“鼻部组成被删除应被发现”的要求尚未闭环。应选择一个仅由鼻部斜坡覆盖、而不被圆角车身/座舱覆盖的代表格点（例如先按离散格心验证约 `(0.65, 0.55)` 的候选），或对鼻部独占区域作集合断言。`src/features/flow/obstacleMask.test.ts:45`, `src/features/flow/obstacleMask.ts:17-29`

## New Breakage

- 未发现。修复仅增强测试；尾流测试使用两个独立 solver/frame，区域索引均位于 `96×40` 范围内，遮罩测试的 3×3 轮洞索引也远离数组边界。`src/features/flow/lbmSolver.test.ts:14-35`, `src/features/flow/obstacleMask.test.ts:30-42`

## Out-of-Scope

- 未重新评价生产求解器、边界条件、车辆几何实现或其他 Task 5 规格。
- 未独立重跑聚焦、全量、build 或 lint；本轮只核对报告中的 RED/GREEN 证据及当前测试快照。

## Verdict

**NOT PASS（1/2 findings 完全解决）。** 尾流负对照已具备障碍物判别力；遮罩范围、四边、轮洞和座舱覆盖已补齐，但鼻部断言仍与圆角车身重叠，无法捕获鼻部组成被删除。将鼻部断言改为独占区域后即可再次复审。

---

# Fix round 2 范围复审

本轮仅验证 fix round 1 残留的鼻部独占断言，不重新审查其他测试或生产实现。

## 鼻部断言必须由 noseRamp 独占 — ADDRESSED

鼻部断言现改为 `cellAt(0.65, 0.52)`。在测试使用的 `160×64` 网格上，它映射到 `(x=104, y=33)`，实际格心为 `(0.653125, 0.5234375)`：x 严格大于 `roundedBody` 的显式上限 `0.65`，也位于 cabin、rearCorner 与两个 wheel cutout 之外；同时 noseRamp 在该 x 的下缘为 `0.50959375`，该格心 y 位于下缘与 `0.64` 上限之间。因此此格点只能由 noseRamp 置为固体。`src/features/flow/obstacleMask.test.ts:30-32`, `src/features/flow/obstacleMask.test.ts:45`, `src/features/flow/obstacleMask.ts:17-33`

报告提供了直接 mutation 证据：仅临时禁用 `noseRamp` 后，行 45 从期望 1 得到 0，聚焦测试按预期 RED；恢复生产表达式后聚焦、全量、build 与 lint 均恢复通过。这正面证明该断言会捕获 noseRamp 被删除，而不再由重叠几何代偿。`src/features/flow/obstacleMask.test.ts:45`

## New Breakage

- 未发现。持久测试变更只替换一个代表坐标；新坐标仍在声明的整体 x/y 范围内，索引合法，且比旧点提供更强而非更宽松的组成判别。`src/features/flow/obstacleMask.test.ts:45`

## Verdict

**PASS。** 残留 finding 已解决；结合 fix round 1，Task 5 的两项原始审查 finding 现均已闭环。
