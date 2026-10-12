# Final fixes auxiliary report — I6 / I7 / M2

日期：2026-08-18
范围：最终审查 `I6`、`I7`、`M2`；未修改 `App`、report、store、plan、M1 transport，也未触碰 Git index/HEAD/branch/commit。

## 根因与修复

### I6 — particle count 与 buffer/mesh 不一致

- 根因：`FlowParticles` 只在首次 mount 时创建 `ParticleBuffers`，而 `count` 会随 viewport、reduced-motion 恢复和 adaptive quality 变化；`InstancedMesh.args` 收到新 count 后，热路径仍遍历旧 buffer count。
- 修复：`useLayoutEffect([count])` 在提交新 count 时仅在容量不同的情况下重建 positions/stalled buffer，并在首帧绘制前用同一 count 初始化全部矩阵；`writeParticleMatrices` 同步设置 `mesh.count`。`<instancedMesh key={count}>` 强制 R3F 在 count 变化时重建底层 Three 实例及其固定容量 `instanceMatrix`，因此 300→1400 不依赖仅能改变绘制数量的 `mesh.count`“伪扩容”。正常 `useFrame` 热路径没有新增分配。
- 回归：真实渲染组件测试只 mock 无 Canvas 时不可用的 R3F 帧调度器，验证 `300 → 1400` 与 `1400 → 900` 两个方向都发生 host 节点重建、恰好初始化新 count 个矩阵，最后写入索引为 `count - 1`，mesh count 与 buffer count 相等。

### I7 — reset 后无法复现实验

- 根因：固定 seed 只在构造 PRNG 时使用一次，`reset()` 没有恢复 PRNG state；随后调用 `step(0)` 还会生成噪声、消费四个随机数并把内部 sequence 推进到 1。
- 修复：`XorShift32` 保存规范化后的初始 state 并暴露内部 reset；simulation reset 恢复它以及全部物理/延迟状态，直接返回 exact zero telemetry frame，不执行采样、不消费随机数、不推进 sequence。
- 回归：同一个 source 执行 80 个固定 50 ms 帧后 reset，再执行相同 power/phase/time 命令，逐帧对象完全相等；另独立断言 reset frame 为无噪声的 sequence 0 零帧。

### M2 — 项目级 README

- 新增根 `README.md`，集中说明 Vite 8 对 Node 的要求、`npm ci`/dev/build/test/E2E 命令、Chromium 自动化覆盖和现代浏览器能力要求。
- 明确当前无 Arduino/真实传感器，遥测为固定种子的模拟数据，D2Q9 LBM 仅为二维教学近似，不得用于 Cd/Cl、车辆安全或工程验收。
- 明确只有 exact `VITE_E2E_TIME_SCALE=20` 才启用测试加速，日常/生产不得设置；记录 adaptive quality、solver/WebGL 恢复和 lazy Three scene >500 kB 已知非阻塞 warning。

## TDD 证据

### RED — I6

```text
npm run test:run -- src/features/scene/FlowParticles.test.tsx
Test Files  1 failed (1)
Tests       2 failed (2)
300 → 1400: expected setMatrixAt 1400 times, got 0
1400 → 900: expected setMatrixAt 900 times, got 0
```

在第一轮 buffer GREEN 后又新增底层容量回归并重新观察 RED：

```text
npm run test:run -- src/features/scene/FlowParticles.test.tsx
Test Files  1 failed (1)
Tests       2 failed (2)
两个方向均显示 resizedMesh 与 initialMesh 为同一对象
```

加入 `key={count}` 后相同命令恢复为 2/2 GREEN，证明 count 切换会实际重建 consumer host，而不只是改写 draw count。

生产变异覆盖：移除 `key={count}`、移除 `[count]` effect、遗漏 buffer rebuild、使用旧 count 或遗漏 mesh count 同步，至少一个断言失败。

### RED — I7

```text
npm run test:run -- src/features/experiment/SimulationSource.test.ts
Test Files  1 failed (1)
Tests       2 failed | 2 passed (4)
reset frame pressure/load 含噪；replay 从 sequence 1 开始且整段噪声序列不同
```

生产变异覆盖：遗漏 PRNG reset、保留 `step(0)`、遗漏任一物理或 delay queue reset，reset-frame 或逐帧 replay 断言失败。

## 新鲜 GREEN 验证

```text
npm run test:run -- src/features/scene/FlowParticles.test.tsx
Test Files  1 passed (1)
Tests       2 passed (2)

npm run test:run -- src/features/experiment/SimulationSource.test.ts
Test Files  1 passed (1)
Tests       4 passed (4)

npm run test:run -- src/features/scene/FlowParticles.test.tsx src/features/experiment/SimulationSource.test.ts
Test Files  2 passed (2)
Tests       6 passed (6)

npm run test:run -- src/features/scene
Test Files  6 passed (6)
Tests       14 passed (14)

./node_modules/.bin/eslint src/features/scene/FlowParticles.tsx src/features/scene/FlowParticles.test.tsx src/features/experiment/SimulationSource.ts src/features/experiment/SimulationSource.test.ts
exit 0；无输出

git diff --no-index --check /dev/null <每个本任务文件>
所有文件均为预期的 exit 1（存在新增内容），且 stdout 为空：无 whitespace error
```

共享目录中另一个 Agent 正在修改普通实验 runtime、教程 evidence 与报告链路，因此本辅助任务没有在其写入期间运行全量 test/build。根任务应在所有最终修复合流后执行统一的 full Vitest、lint、build 与 Playwright 门禁。

## 文件

- `src/features/scene/FlowParticles.tsx`
- `src/features/scene/FlowParticles.test.tsx`
- `src/features/experiment/SimulationSource.ts`
- `src/features/experiment/SimulationSource.test.ts`
- `README.md`

## Fix round — M2 Node.js engine 事实修正

复审发现初版 README 只引用了 Vite 的 Node.js engine，没有计算完整开发/测试依赖交集。依据当前 `package-lock.json` 与已安装包 metadata：

```text
vite@8.2.1   ^20.19.0 || >=22.12.0
jsdom@30.0.1 ^22.22.2 || ^24.15.0 || >=26.0.0
current      v22.22.3 / npm 10.9.8
```

因此 README 已将完整 workflow 前置要求修正为 `^22.22.2 || ^24.15.0 || >=26.0.0`，并记录当前验证版本 `22.22.3`。本轮只修改人类运行文档与本报告，没有改生产代码，也不需要新增代码测试。
