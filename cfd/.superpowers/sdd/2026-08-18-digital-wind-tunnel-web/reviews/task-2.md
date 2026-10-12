# Task 2 审查：确定性遥测物理与实验状态机

审查范围：仅审阅任务 brief 与 Task 2 新文件快照 diff（Base/Head：none，按 controller ruling）。未依赖实现报告中的断言，未重跑测试。

## Spec Compliance

- 公开领域契约完整且与 brief 一致：`RunPhase`、`ActiveRunPhase`、`TelemetryFrame`、`SimulationConfig`、`TelemetrySource`、`ExperimentEvent` 均已定义/导出；遥测帧的 `provenance` 仅允许且实际始终为 `"simulated"`。[`src/features/experiment/model.ts:1`](../../../../../../src/features/experiment/model.ts#L1) [`src/features/experiment/experimentMachine.ts:5`](../../../../../../src/features/experiment/experimentMachine.ts#L5) [`src/features/experiment/SimulationSource.ts:117`](../../../../../../src/features/experiment/SimulationSource.ts#L117)
- 动态压强和一阶响应公式符合指定数学表达式。[`src/features/experiment/physics.ts:1`](../../../../../../src/features/experiment/physics.ts#L1)
- 默认配置逐字段匹配 brief；功率经 `Math.max(0, ...)` / `Math.min(100, ...)` 严格钳制到 0–100。[`src/features/experiment/SimulationSource.ts:4`](../../../../../../src/features/experiment/SimulationSource.ts#L4) [`src/features/experiment/SimulationSource.ts:59`](../../../../../../src/features/experiment/SimulationSource.ts#L59)
- `xorshift32` 由 seed 驱动；RPM、风速、压力、载荷分别施加 0.35%、0.5%、0.8 Pa、0.015 N 的指定振幅；压力和载荷有两条指定正弦零漂。[`src/features/experiment/SimulationSource.ts:28`](../../../../../../src/features/experiment/SimulationSource.ts#L28) [`src/features/experiment/SimulationSource.ts:108`](../../../../../../src/features/experiment/SimulationSource.ts#L108)
- 采集时 RPM 使用当前值，风速由单元素队列滞后一帧，压力/载荷由双元素队列滞后两帧。[`src/features/experiment/SimulationSource.ts:43`](../../../../../../src/features/experiment/SimulationSource.ts#L43) [`src/features/experiment/SimulationSource.ts:97`](../../../../../../src/features/experiment/SimulationSource.ts#L97) [`src/features/experiment/SimulationSource.ts:133`](../../../../../../src/features/experiment/SimulationSource.ts#L133)
- 稳定性只在写入噪声/延迟之前，基于未噪声、未延迟的 RPM 与当前步风速变化判定；因此测量噪声不会影响完成条件。[`src/features/experiment/SimulationSource.ts:82`](../../../../../../src/features/experiment/SimulationSource.ts#L82)
- reducer 限制 `start`、`pause`、`resume` 的合法来源，`advance` 按 ramping → stabilizing → sampling → completed 推进，`reset` 恒回初始 idle 状态。[`src/features/experiment/experimentMachine.ts:15`](../../../../../../src/features/experiment/experimentMachine.ts#L15) [`src/features/experiment/experimentMachine.ts:23`](../../../../../../src/features/experiment/experimentMachine.ts#L23)

## Strengths

- 延迟在物理态计算之后、噪声在测量帧生成时才注入，数据生成链条清晰地保留了物理态与观测态的分离。[`src/features/experiment/SimulationSource.ts:89`](../../../../../../src/features/experiment/SimulationSource.ts#L89)
- pause/resume 将被暂停的活动相位显式保存在 `resumePhase`，能精确恢复而不会意外推进状态机。[`src/features/experiment/experimentMachine.ts:29`](../../../../../../src/features/experiment/experimentMachine.ts#L29)
- 包含公式、确定性回放、provenance 和状态机基本转移的针对性单元测试。[`src/features/experiment/physics.test.ts:4`](../../../../../../src/features/experiment/physics.test.ts#L4) [`src/features/experiment/SimulationSource.test.ts:5`](../../../../../../src/features/experiment/SimulationSource.test.ts#L5) [`src/features/experiment/experimentMachine.test.ts:5`](../../../../../../src/features/experiment/experimentMachine.test.ts#L5)

## Issues

### Critical

无。

### Important

无。

### Minor

无。

## Assessment

**Approved** — 该新文件快照满足 Task 2 brief 的绑定领域契约、确定性物理模型、延迟/噪声语义、稳定性判定与 reducer 转移规则。
