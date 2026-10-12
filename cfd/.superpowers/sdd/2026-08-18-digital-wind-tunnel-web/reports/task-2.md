# Task 2 — 确定性遥测物理与实验状态机

## 实现

- 新增领域契约：`RunPhase`、`ActiveRunPhase`、`TelemetryFrame`、`SimulationConfig` 与 `TelemetrySource`。
- 新增动态压强和一阶响应公式。
- `createDefaultSimulationSource(seed)` 实现种子确定性的 xorshift32 噪声、功率 0–100 钳制、上/下坡响应、零点漂移、采集延迟和基于未噪声/未延迟物理状态的稳定性判定。
- 新增实验 reducer：只允许指定相位的 start/pause/resume/advance，reset 恒复位到 idle。

## TDD 记录

### RED

先添加任务书指定的 6 个测试；执行：

```text
npm run test:run -- src/features/experiment
Test Files 3 failed (3)
Failed to resolve import "./physics" / "./SimulationSource" / "./experimentMachine"
```

故障原因符合预期：三个生产模块尚不存在。

### GREEN

实现最小领域模块后，执行：

```text
npm run test:run -- src/features/experiment
Test Files 3 passed (3)
Tests 6 passed (6)
```

## 验证

```text
npm run test:run
Test Files 4 passed (4)
Tests 8 passed (8)

npm run build
tsc --noEmit && vite build  # passed

npm run lint
eslint .                    # passed, no output
```

## 文件清单

- `src/features/experiment/model.ts`
- `src/features/experiment/physics.ts`
- `src/features/experiment/physics.test.ts`
- `src/features/experiment/SimulationSource.ts`
- `src/features/experiment/SimulationSource.test.ts`
- `src/features/experiment/experimentMachine.ts`
- `src/features/experiment/experimentMachine.test.ts`
- `.superpowers/sdd/2026-08-18-digital-wind-tunnel-web/reports/task-2.md`

## 自审与顾虑

- 噪声只作用于测量帧；稳定性完全由当前未噪声、未延迟的 RPM 和风速变化计算，避免噪声阻止完成。
- RPM 无延迟、风速保留一帧、压力/载荷保留两帧；在任务书所示的 50 ms 调用下即为指定采集延迟。
- 工作树在任务开始前已包含大量任务外的未跟踪/改动；未修改、暂存或提交它们。`git diff` 无法读取仓库的基准对象（`fatal: unable to read 44ebbf...`），不影响 TypeScript/Vitest/build/lint 验证。
- Commit：`none (controller ruling)`。
