# Task 11 报告：浏览器集成、完整引导流程与最终验证

## 范围与裁决

- 已完整阅读 `briefs/task-11.md`、批准设计 spec 与最新 ledger；Task 3/6 的 parked 项均已由 Task 10 关闭。
- 未创建分支、未暂存、未提交；未触碰父仓库既有变更。
- E2E 加速严格为 `VITE_E2E_TIME_SCALE === "20" ? 20 : 1`。它只令每个 50 ms 墙钟 tick 执行 20 个原有 50 ms 固定步，未更改公式、单位、LBM 映射、教程证据、稳定判据、采样时长或状态机；生产/普通开发默认 1×。
- 未伪造 WebGL、Worker、遥测、扫描或报告结果。

## TDD：RED → GREEN

### 应用集成契约

1. 新增 `src/App.integration.test.tsx` 后运行：
   - `npm run test:run -- src/App.integration.test.tsx`
   - RED：2/2 失败；一项缺少“升速中”状态文案，另一项缺少第 4 章可操作判断题。
2. 最小接线：
   - 运行阶段显示“升速中 / RAMPING”；
   - 教程 rail 增加真实单选判断题并写入 `flowAnswerCorrect`；
   - App 将严格 E2E time scale 传入现有 fixed-step runtime。
3. 同命令复跑 GREEN：2/2 通过。

### 浏览器发现的报告精度缺陷

1. 最终 E2E 曾在第 6 章保持锁定；失败截图/trace 表明扫描 30/60/90 全部有效，但 UI 将内部不同的极小残差都显示成 `0.000 N`，用户无法从可见值选出系统采用的最大项。
2. 新增组件回归并先运行：
   - `npm run test:run -- src/features/report/ExperimentReport.test.tsx`
   - RED：期望 `0.00000 / 0.00004 / 0.00008 N`，实际均为 `0.000 N`。
3. 仅将残差列显示提高到 5 位；同命令 GREEN：10/10 通过。

### 测试边界缺陷

- 首次全量 Vitest 把 `e2e/*.spec.ts` 当作单元测试加载，得到 3 个 Playwright/Vitest runner 冲突套件。
- `vite.config.ts` 在 Vitest 官方默认 exclude 上追加 `e2e/**`；复跑全量 GREEN。

## 浏览器契约

- 安装：`npx playwright install chromium`，exit 0。
- 沙箱内第一次启动 Vite 得到最小复现 `listen EPERM 127.0.0.1:4173`；使用已批准的本地测试服务器权限后正常执行。
- 完整矩阵：`npm run test:e2e` → **5 passed (1.3m)**。
  - tutorial：真实完成五热点、30% 稳定、四传感器与稳定窗口、四场变量与判断题、30/60/90 扫描、最大残差、12+ 字结论、CSV 下载；filename 以 `.csv` 结尾。
  - free-lab：启动、暂停、继续、压力场切换、WebGL context lost/restored、确认重置；0 `pageerror`、0 console error。
  - responsive：1440×900、1024×768、390×844 均无水平溢出；窄屏 tabs 支持方向键且控件可达。
- 为让截图记录已加载场景，responsive 增加等待热点区域后 focused 复跑：**3 passed (23.2s)**。
- 教程与自由实验收集到 0 console error、0 pageerror、0 unhandled rejection；仅 Vite 输出 Three.js `Clock` deprecation warning，不是 console error。

## 截图与人工核对

- `test-results/responsive-desktop-has-no--4c554-controls-keyboard-reachable-chromium/desktop-1440x900.png`
- `test-results/responsive-tablet-has-no-h-e1a03-controls-keyboard-reachable-chromium/tablet-1024x768.png`
- `test-results/responsive-mobile-has-no-h-a3f20-controls-keyboard-reachable-chromium/mobile-390x844.png`
- 1440×900 已人工核对：深色实验台、米白/炭黑/功能红模块化风洞、透明测试舱、青色粒子流、左侧七章 rail、右侧控制/场/遥测、底部图表/报告、SIMULATED 与二维教学近似标签均存在。
- 截图时 HIGH 质量 Worker 曾进入受控 timeout 降级并显示“重新启动求解器”；完整 tutorial 合同仍取得实时场并走完报告。这符合批准 spec 的 Worker 失败冻结/遥测继续/显式恢复契约，不是伪造或未处理异常。
- 未发现相对批准设计的材料性缺失。

## 最终验证证据

- `npm run lint`：exit 0，0 errors。
- `npm run test:run`：26 files，150 tests passed，0 failed。
- `npm run build`：exit 0，Vite 1175 modules；仅既有 `WindTunnelScene` >500 kB chunk warning。
- `npm run test:e2e`：5 passed，0 failed；后续 responsive focused 3 passed。
- `git diff --check -- .`：exit 0，无输出。
- E2E 结束后 `lsof -nP -iTCP:4173 -sTCP:LISTEN` 无输出；无遗留 dev server。App cleanup 继续由 effect cleanup 关闭 simulation interval/visibility listener、flow interval、worker/client；CSV object URL 由下载实现 finally 回收，Three scene 随 React unmount 释放。

## 最终文件

- 新增：`playwright.config.ts`
- 新增：`e2e/tutorial.spec.ts`
- 新增：`e2e/free-lab.spec.ts`
- 新增：`e2e/responsive.spec.ts`
- 新增：`src/App.integration.test.tsx`
- 新增：本报告
- 修改：`src/App.tsx`
- 修改：`src/features/dashboard/ControlPanel.tsx`
- 修改：`src/features/tutorial/TutorialRail.tsx`
- 修改：`src/features/tutorial/tutorialProgress.ts`
- 修改：`src/features/report/ExperimentReport.tsx`
- 修改：`src/features/report/ExperimentReport.test.tsx`
- 修改：`src/styles/global.css`
- 修改：`vite.config.ts`
- `package.json`、`src/main.tsx` 已在前序任务具备正确 Playwright 脚本/依赖与 StrictMode 挂载，无需制造无意义差异。

---

## Fix round 1/5（review 六项 Important + 两项 Minor）

### I1：CSV 浏览器内容合同

- 新增 `e2e/csvParser.ts`，tutorial E2E 通过 Playwright download path 读取真实文件。
- 已断言 UTF-8 BOM、SIMULATED 与 2D TEACHING CFD 免责声明、完整 telemetry header、用户结论。
- 已解析 30/60/90 三档 raw rows：每档均不少于 20 个 `stable + simulated` 样本；三条 summary 均为 `valid=true` 且 `sampleCount >= 20`。
- focused tutorial：1/1 PASS；最终并发矩阵中的同一合同亦 PASS。

### I2：真实流场 evidence 与 timeout 降档

- RED：新增 Dashboard 组件测试证明 flow 未 READY/无 field 时四个 radio 仍可点击并写 evidence。
- GREEN：`FieldSelector` 现在仅在 `flowStatus === "ready" && flowField !== null` 时启用；否则禁用并明确提示“等待真实二维流场后可记录观察证据”。focused Dashboard 18/18 PASS。
- RED：App 定向测试得到 HIGH timeout 后只创建 HIGH client。
- GREEN：flow owner 订阅 timeout，按 HIGH → MEDIUM → LOW 受控降档并重建，记录每次日志；保留 telemetry、最后 flow field、教程章节与 evidence。定向测试连续让 HIGH、MEDIUM timeout，LOW 返回真实 frame，PASS。
- tutorial E2E 在四场切换前必须看到 `流场就绪 / READY` 和 HUD `实时场`，因此不能用示意场/失败场推进。
- 并发首轮曾 RED：在 React state updater 内写 Zustand 导致 console error；根因修为订阅回调先记录日志，再执行纯 `setQuality(next)`。最终并发矩阵无 console error。

### I3：App runtime ownership / cleanup

- RED：新增 integration lifecycle test 时，注入的 source/runtime factories 调用数均为 0。
- GREEN：App 支持注入 simulation source、simulation runtime、flow runtime factories，生产默认仍是原实现。
- 合同证明每 mount 各启动一次；真实受控 50 ms frame 进入 history；unmount 调用 simulation stop、flow stop、client dispose，Vitest timer count 回到 0。
- focused `App.integration.test.tsx` 3/3 PASS。

### I4：真实 WebGL context loss / recovery

- free-lab 不再允许缺 canvas 静默通过：必须存在唯一 canvas。
- Chromium 实测 `WEBGL_lose_context` 扩展可用，本轮未 skip；调用真实 `loseContext()` / `restoreContext()`。
- 已验证 context-loss fallback、原 canvas 断开、新 canvas 建立、flow 重回 READY/实时场，并可继续切换压力场。
- focused free-lab 1/1 PASS（28.3s）。

### I5：responsive 键盘路径

- RED：AppShell 组件测试证明 compact 控制 tab 后按 Tab 会落入 DOM 中间的场景按钮。
- GREEN：激活 compact tab 的正向 Tab 会进入对应 panel 第一个可用控件；focused AppShell 2/2 PASS。
- 1024×768 与 390×844：从控制 tab 依次验证 slider、start、pause、reset 焦点，并通过键盘改变 slider、启动与暂停；切换控制/曲线 panel 后分别重验 overflow。
- 1440×900：从页面自然 Tab 顺序到达 slider 和 start，并通过键盘改变功率；重验 overflow。
- focused responsive 3/3 PASS；最终矩阵同样 PASS。

### I6：free-lab 实际遥测、运行中改功率与 reset dialog

- 启动后等待 `T+0.00 s` 变化，记录真实 RPM；暂停/继续后把功率改为 65%，断言 output 与 RPM 继续增长。
- reset 使用 `waitForEvent("dialog")`，精确断言提示“停止实验并清除当前 60 秒遥测历史？”，accept 后验证 idle、0% 与 history reset。
- 与真实 WebGL recovery 合同一起 focused 1/1 PASS。

### M1/M2：产物与专用服务器

- 新增项目 `.gitignore`：`node_modules/`、`dist/`、`playwright-report/`、`test-results/`；`git check-ignore -v` 四项均命中，源码与设计图未忽略。
- `reuseExistingServer: false`，每轮 E2E 必须启动带 exact-20 环境的新 4173 server，不复用错误配置实例。
- E2E 完成后 4173 无监听。

### Fix round 1 最终矩阵

- `npm run test:e2e`：5 passed（1.3m），0 failed；Chromium WebGL extension 未 skip。
- `npm run test:run`：26 files、154 tests passed，0 failed。
- `npm run lint`：exit 0；E2E 文件也已纳入 ESLint。
- `npm run build`：exit 0；TypeScript 现同时检查 `src` 与 `e2e`；仅保留既有大 chunk warning。
- `git diff --check -- .`：exit 0，无输出。
- 仅存在 Three.js Clock 与隐藏/切换期 Recharts zero-size console warning；没有 console error、pageerror、unhandled rejection 或 dev-server 泄漏。
- 未 branch、未 stage、未 commit。
