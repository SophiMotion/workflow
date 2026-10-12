# Task 5 — D2Q9 LBM 核心与程序化车辆遮罩

## 结果

已按 brief 实现纯 TypeScript 的 D2Q9 BGK 教学求解器与程序化车辆侧面遮罩。求解器只定位为浏览器中的二维教学近似，不代表工程级 CFD 精度。

## TDD 记录

### RED

先创建 brief 指定的 `obstacleMask.test.ts`、`lbmSolver.test.ts`，并额外加入持续入口流的全字段有限性回归，然后运行：

```text
npm run test:run -- src/features/flow/obstacleMask.test.ts src/features/flow/lbmSolver.test.ts
```

结果：2 个 suite 失败、0 个测试执行；最小失败原因为 Vite 无法解析尚未存在的 `./obstacleMask` 与 `./lbmSolver`，与 brief 的预期 RED 一致。

### GREEN

实现后同一聚焦命令通过：

```text
Test Files  2 passed (2)
Tests       7 passed (7)
```

除 brief 的 4 个指定用例外，覆盖了：

- 入口速度上下界 clamp 与 `tau <= 0.5` 的 `RangeError`；
- 持续入口流下 speed、pressure、vorticity、velocityX、velocityY 全部有限；
- 非有限场抛出 `NumericalInstabilityError`，且 `code === "NON_FINITE_FIELD"`。

## 实现摘要

- 使用 brief 精确给定的 D2Q9 `CX`、`CY`、`WEIGHT`、`OPPOSITE` 与平衡态公式。
- 构造时分配并复用两个 `Float32Array(width * height * 9)` 分布缓冲区；迭代循环内不分配数组。
- 每次迭代依次执行宏观量计算、BGK 松弛、推式迁移、上下壁面/障碍物反弹、左侧平衡态入口、右侧零梯度教学出口、缓冲区交换。
- `snapshot()` 复用固定输出 TypedArray，输出速度、压力、涡量、二维速度及 `provenance: "2d-teaching-cfd"`；固体速度严格为零。
- 车辆遮罩由圆角下车身、座舱、前鼻斜坡、后圆角及两个轮洞组合，严格限制于归一化 x=36%–66%、y=43%–66%，入口和出口保持流体。

## 数值验证

使用 brief 参数直接采样：

| 检查 | 结果 |
|---|---:|
| 48×24、零入口、20 步最大速度 | `0` |
| 48×24、零入口、20 步平均压力漂移 | `2.4835269396561444e-9`（小于 `1e-6`） |
| 96×40、入口 0.055、160 步上游速度 | `0.030530624091625214` |
| 同场尾流速度 | `0.027966588735580444`（小于上游） |
| 同场峰值速度 | `0.055000003427267075` |
| 80×32 遮罩固体单元数 | `115` |

## 完整验证

```text
npm run test:run
Test Files  10 passed (10)
Tests       34 passed (34)

npm run build
tsc --noEmit && vite build: PASS

npm run lint
eslint .: PASS
```

## 文件

- `src/features/flow/types.ts`
- `src/features/flow/obstacleMask.ts`
- `src/features/flow/obstacleMask.test.ts`
- `src/features/flow/lbmSolver.ts`
- `src/features/flow/lbmSolver.test.ts`
- `.superpowers/sdd/2026-08-18-digital-wind-tunnel-web/reports/task-5.md`

## 自审

- 接口、数组形状、D2Q9 常量、边界次序、入口 clamp、异常类型和 provenance 均逐项对照 brief。
- 无 DOM/React 依赖，无 API 密钥或环境文件改动，无任务外源码修改。
- 迭代热路径只有预分配 TypedArray 的清零、写入与引用交换；输出数组也跨 snapshot 复用。
- 遮罩首末列明确保持为 0；测试确认存在固体且入口/出口未阻塞。
- 未执行 git add、commit 或创建分支，符合 controller ruling。

## Fix round 1/5 — 尾流判别与遮罩几何证据

### RED（空遮罩负对照）

将新尾流测试中的“车辆场”暂时校准为与基线相同的空遮罩，并以 x=68–82、y=18–23 的 90 个单元区域均速作比较：

```text
Test Files  1 failed | 1 passed (2)
Tests       1 failed | 6 passed (7)
vehicleWake = 0.03374322516222795
emptyTunnel = 0.03374322516222795
期望 vehicleWake < emptyTunnel * 0.92，按预期失败
```

这证明新断言在车辆遮罩被移除或失效时会失败，不再仅由入口传播或边界条件满足。

### GREEN（真实车辆遮罩）

把车辆场接回 `createCarProfileMask(width, height)` 后，同一区域、同一入口速度、松弛时间和 160 步演化得到：

| 场景 | 尾流区域均速 |
|---|---:|
| 空风洞 | `0.03374322516222795` |
| 车辆遮罩 | `0.028409936320450573` |
| 车辆/空风洞比值 | `0.8419448995720942` |
| 相对速度亏损 | `15.80551004279058%` |

最终阈值要求至少 `8%` 的相对亏损，实测约 `15.8%`，未紧贴浮点噪声。聚焦测试恢复为 2 files / 7 tests 全部通过。

### 遮罩几何回归增强

- 遍历全部固体单元，验证中心归一化坐标均落在 x=`[0.36, 0.66]`、y=`[0.43, 0.66]`。
- 验证首末行及首末列全部为流体。
- 在两个轮洞中心各验证 3×3 代表区域保持流体。
- 验证座舱代表点 `(0.50, 0.48)` 与鼻部代表点 `(0.62, 0.56)` 为固体。

### Fix round 1 完整验证

```text
聚焦测试: 2 files / 7 tests PASS
全量测试: 10 files / 34 tests PASS
npm run build: PASS
npm run lint: PASS
```

本轮仅增强 `obstacleMask.test.ts`、`lbmSolver.test.ts` 与本报告；生产实现和生产接口均未修改，未执行 git add/commit。

## Fix round 2/5 — noseRamp 独占点 mutation 证据

将鼻部代表点由会与 `roundedBody` 重叠的 `(0.62, 0.56)` 改为 `cellAt(0.65, 0.52)`。在 160×64 网格上，该单元中心的实际归一化坐标为：

```text
x = (104 + 0.5) / 160 = 0.653125
y = (33 + 0.5) / 64 = 0.5234375
```

该点满足 `noseRamp`：x 落在 `[0.57, 0.66]`，y 高于此 x 对应的鼻部下缘 `0.50959375` 且低于 `0.64`；同时 x 已大于 `roundedBody` 的显式上限 `0.65`，也不属于 cabin、rearCorner 或两个 wheel cutout，因此是 noseRamp 独占点。

### RED（临时禁用 noseRamp）

临时把生产表达式改为 `false && normalizedX >= 0.57 ...`，未改变其他几何分量。聚焦测试结果：

```text
Test Files  1 failed | 1 passed (2)
Tests       1 failed | 6 passed (7)
obstacleMask.test.ts:45
expected mask[cellAt(0.65, 0.52)] to be 1, received 0
```

### GREEN（完整恢复生产实现）

恢复 noseRamp 原始表达式后：

```text
聚焦测试: 2 files / 7 tests PASS
全量测试: 10 files / 34 tests PASS
npm run build: PASS
npm run lint: PASS
```

最终生产几何与接口没有变化；本轮持久修改仅为 `obstacleMask.test.ts` 的独占鼻部断言及本报告。未执行 git add/commit。
