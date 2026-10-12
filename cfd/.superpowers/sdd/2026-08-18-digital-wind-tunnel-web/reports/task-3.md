# Task 3 报告：Zustand Lab Store 与固定步长运行时

## 实现

- 新增 `src/features/experiment/labStore.ts`：基于 Zustand vanilla `createStore` 的可供非 React 运行时写入的实验状态；提供 `useLabStore(selector)` React selector hook、`MAX_HISTORY = 1200`、风机控制、状态机控制、字段选择与重置。
- `acceptFrame` 使用单次 `history.slice(-MAX_HISTORY + 1)` 后 append，历史数据始终最多保留 1200 帧（20 Hz 下 60 秒）。
- 新增 `src/features/experiment/simulationRuntime.ts`：按 wall-clock `tickMs` 调度，每次 source step 固定为 50 ms；默认每 tick 一步，支持 `stepsPerTick`。
- 每个固定步之前均从 store 读取并同步 `fanPowerPct` 与 `phase` 到 `TelemetrySource`；仅在 `ramping`、`stabilizing`、`sampling` 下步进。页面隐藏时清除定时器，重新可见时重新调度，不补偿隐藏期时间。
- Store 复用 Task 2 的 `TelemetryFrame`、`RunPhase`、`ActiveRunPhase`、`createDefaultSimulationSource` 与 `experimentReducer`，没有复制其业务逻辑。

## TDD 记录

### RED

先新增 `labStore.test.ts` 与 `simulationRuntime.test.ts`，然后执行：

```text
npm run test:run -- src/features/experiment/labStore.test.ts src/features/experiment/simulationRuntime.test.ts
```

结果：两个 suite 都因缺少 `./labStore`、`./simulationRuntime` 而失败，符合功能尚未实现的预期。

### GREEN

以最小 Store 和运行时实现后，重新执行相同命令：2 个测试文件、9 项测试通过。

覆盖行为：1200 帧上限、风机钳位、状态机转换、50 ms 固定步长、停止清理、每步控制同步、非活动 phase 跳过、隐藏/恢复不补帧。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm run test:run -- src/features/experiment` | 5 files / 15 tests passed |
| `npm run test:run` | 6 files / 17 tests passed |
| `npm run build` | passed (`tsc --noEmit` + Vite production build) |
| `npm run lint` | passed |

## 文件

- `src/features/experiment/labStore.ts`
- `src/features/experiment/labStore.test.ts`
- `src/features/experiment/simulationRuntime.ts`
- `src/features/experiment/simulationRuntime.test.ts`

## 自审

- [x] vanilla `createStore` 与 React selector hook 均已导出。
- [x] `MAX_HISTORY` 为 1200，append 路径只执行一个 slice 再追加一帧。
- [x] source 在每个 `step(50)` 前同步 power 和 phase。
- [x] inactive phases 不运行 source step；`stepsPerTick` 默认 1。
- [x] visibilitychange 清除/恢复 interval，未调用补帧逻辑。
- [x] 未修改任务范围外的产品文件；未创建分支、暂存或提交（commits: none）。
