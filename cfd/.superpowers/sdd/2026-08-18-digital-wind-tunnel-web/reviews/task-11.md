# Task 11 Review — Browser Integration / E2E / Final Verification

## Spec Compliance

- **E2E 加速契约符合。** `src/App.tsx:67-70` 只在 `VITE_E2E_TIME_SCALE === "20"` 时传入 `20`，否则为 `1`；`src/features/experiment/simulationRuntime.ts:16-25` 仍逐次执行原有 `step(50)`，每个子步重新读取 store 的 power/phase，没有改公式、单位、LBM 映射或直接跳转状态机。`playwright.config.ts:12-16` 只给 Playwright web server 注入该值。
- **教程主链使用真实 UI 操作。** `e2e/tutorial.spec.ts:20-69` 没有 `page.evaluate` 写 store、Zustand mutation、测试后门或固定 `waitForTimeout`；五热点、30% 启动/稳定、四传感器、稳定窗口、四场变量、判断题、三工况 sweep、残差、结论和下载都通过面向用户的控件执行。
- **暂停/恢复/重置及三档响应式均有浏览器覆盖。** `e2e/free-lab.spec.ts:10-35` 覆盖启动、暂停、恢复、场切换和重置；`e2e/responsive.spec.ts:3-33` 覆盖 1440×900、1024×768、390×844，并验证窄屏 tab 方向键切换。
- **App 的生产 ownership 集中。** simulation source/runtime 由 `src/App.tsx:67-93` 的单一 effect 创建并停止；flow runtime/client 由 `src/App.tsx:112-127` 的单一 effect 持有，换质量、WebGL 丢失及卸载时依次 `runtime.stop()`、`client.dispose()`。未发现并行活跃的第二 owner。
- **但浏览器验收仍未完整兑现批准 spec。** CSV 内容、真实 WebGL loss/restore、默认质量下可用的实时流场、reset confirm 和控件键盘可达性没有被可靠验收；详见 Important issues。

## Strengths

- `tutorial.spec.ts:3-9` 与 `free-lab.spec.ts:4-8` 同时收集 `pageerror` 和 console error，且在流程末尾断言为空。
- 教程等待均绑定业务状态（稳定、下一章 enabled、sweep completed），没有任意 sleep；选择器大多使用 role/name，章节流程可读且抗 DOM 重排。
- `tutorial.spec.ts:52-59` 从用户可见的残差列计算最大值，配合五位显示精度，避免以前所有残差显示为 `0.000 N` 的假证据。
- 三视口测试实际生成了可审查截图；现有截图也帮助暴露了默认 HIGH 质量的 Worker timeout，而不是只留下“5 passed”的摘要。
- Playwright trace 采用 `retain-on-failure`，没有把每次成功运行都膨胀成 trace。

## Issues

### Critical

无。

### Important

1. **CSV E2E 只验证文件名，未验证下载内容，无法证明导出满足列名、三工况和样本数量契约。**
   - Finding: `e2e/tutorial.spec.ts:66-69`
   - 当前只等待 `download` 并检查 `.csv` 后缀。即使导出为空文件、缺少 telemetry header、只包含一个工况或样本数为 0，该测试仍会通过。这直接遗漏批准 spec `12.3` 的“检查列名、工况与样本数量”。应读取下载文件/stream，解析 CSV，至少断言 sample headers、30/60/90 summary rows、每档非零且符合稳定采样窗口的样本数量、metadata/conclusion/disclaimer。

2. **浏览器流程可以在二维 Worker 失败、没有真实流场时仍完成“四场变量”证据；现有 Task 11 产物已经展示这个假阳性。**
   - Findings: `src/features/dashboard/FieldSelector.tsx:33-35`, `e2e/tutorial.spec.ts:39-43`, `e2e/responsive.spec.ts:15-17`
   - `FieldSelector` 每次点击都会无条件记录教程 evidence，不要求 `flowStatus === "ready"` 或已有 `flowField`；tutorial E2E 也只检查 radio 点击，不检查 HUD 为“实时场”、solver 为 READY、场 buffer 已更新或无失败告警。现有 `test-results/responsive-desktop-has-no--4c554-controls-keyboard-reachable-chromium/desktop-1440x900.png` 明确显示默认 HIGH / 320×128 下 `Flow worker timed out` 和“求解失败 / FAILED”，但 responsive 用例仍通过，Task 11 报告也把它当作可接受结果。受控降级是错误处理契约，不应替代验收标准中“二维 LBM 在 Worker 中运行”和真实四场观察。至少一个 E2E 必须等待 READY/实时场并验证场切换；若 HIGH 初始化稳定超时，应修复 timeout/质量回退而非让教程用点击证据绕过。

3. **所谓 App integration tests 不能证明 Task 11 的 runtime ownership 或 cleanup，删除核心 effects 后仍会通过。**
   - Finding: `src/App.integration.test.tsx:9-18`
   - 第一项测试在点击后只断言 reducer 立即产生的“升速中”和静态 provenance 文本；它不等待任何 simulation frame，不断言 `simulationTimeMs/history` 前进，也不注入/计数 source、runtime、flow client，更不 unmount 检查 interval、visibility listener、worker/client cleanup。第二项只证明判断题 wiring。`src/App.test.tsx:83-119` 覆盖质量变化时旧 flow client 被 dispose，但同样没有最终 unmount cleanup，也没有 simulation lifecycle。Task 11 Step 3 的“一个 owner + 全清理”目前主要靠实现目检而非回归契约。

4. **WebGL recovery E2E 既可静默跳过，也没有造成真实 context loss。**
   - Finding: `e2e/free-lab.spec.ts:24-30`
   - `if (await canvas.count())` 使没有 WebGL canvas 的环境直接跳过整个恢复合同却仍 PASS；`dispatchEvent("webglcontextlost")` / `dispatchEvent("webglcontextrestored")` 只是合成 DOM 事件，不会让浏览器 GL context 真正丢失，也无法证明 renderer/资源能重建。应在缺少 canvas 时显式失败或建立单独 fallback 合同，并通过 `WEBGL_lose_context.loseContext()/restoreContext()` 驱动真实浏览器恢复后验证新 canvas、READY/实时场和可交互控制。

5. **responsive 用例标题声称“controls keyboard-reachable”，断言却只证明 tab 可用和控件可见。**
   - Finding: `e2e/responsive.spec.ts:19-30`
   - 窄屏部分验证的是 tab 自身的 ArrowRight 焦点/自动激活；随后只用 `toBeVisible()` 检查“启动实验”。桌面分支也只检查可见。若控件被错误设为 `tabindex=-1`、焦点顺序绕过整个 panel、焦点被 sticky tab/scroll container 困住，该测试仍通过。应从选中的“控制”tab 使用 `Tab` 前进到 slider/start/pause/reset，断言焦点并用键盘触发至少一个安全动作；同时在控制和曲线 panel 激活后各重测 overflow，而不只测初始教程 panel。

6. **free-lab 没有证明 reset confirmation 真正出现，也没有覆盖批准 spec 要求的运行中修改功率。**
   - Finding: `e2e/free-lab.spec.ts:12-19`, `e2e/free-lab.spec.ts:32-35`
   - 功率只在启动前填入 42；启动后没有修改。`page.once("dialog", ...)` 会在没有 dialog 时同样让测试通过，而此前动作很快，测试也未先断言 history 非空，因此无法证明“有历史才确认”的分支。应等待至少一个真实 frame/history 的可见结果，使用 dialog promise 断言提示文本并 accept，再验证 reset；另在 resumed 状态修改功率并验证 output/遥测继续响应。

### Minor

1. **Playwright/Vite 生成物未被忽略，工作区留下约 1.2 MiB 报告与截图。**
   - Findings: `playwright.config.ts:5-10`, `e2e/responsive.spec.ts:33`
   - 当前 `playwright-report/`、`test-results/`、`dist/` 均未被 `git check-ignore` 命中；其中 report 约 508 KiB、test-results 约 664 KiB。虽然精确 `git add` 不会自动提交它们，但它们持续污染状态并增加误提交风险。应在项目适用的 `.gitignore` 中排除构建/Playwright 产物，只保留需要交付的审查证据路径。

2. **`reuseExistingServer: true` 让 E2E 的 exact-20 环境依赖本机端口状态。**
   - Finding: `playwright.config.ts:12-16`
   - 若 4173 已有非 E2E Vite server，Playwright 会复用它而不会应用这里的 `VITE_E2E_TIME_SCALE=20`，导致本地运行超时或使用错误配置。建议 CI 始终禁用复用，本地也至少通过专用端口/健康标记确认被复用的是同配置 server。

## Assessment

**Changes requested / Task 11 暂不应记为 complete。**

实现本身对 exact E2E scale、固定子步和集中 cleanup 的处理方向正确，教程也确实通过正常 UI 路径推进；没有发现 store mutation 或计时器硬跳证据。但当前全绿矩阵存在材料性假阳性：它没有读取 CSV、可以在默认桌面 Worker 已 FAILED 时完成“四场变量”教程、WebGL 恢复可完全跳过、integration test 不约束 runtime 生命周期，且 responsive/free-lab 的键盘与确认合同仅由“可见/挂 handler”代替。应先补上述 Important 回归并修复它们暴露的 HIGH 质量 flow 初始化问题，再重新运行 focused E2E 与最终矩阵。

本轮为只读审查；除本 review 文件外未修改实现、未触碰 index/HEAD，且未重复运行已有 1.3 分钟 E2E 矩阵。

---

## Fix Round 1 Re-review

### Original Findings

1. **I1 CSV content — ADDRESSED.**
   - Evidence: `e2e/tutorial.spec.ts:71-99`, `e2e/csvParser.ts:1-44`
   - E2E 现在读取 Playwright 实际下载路径，验证 BOM、免责声明、结论、完整 telemetry header；随后解析 raw rows 和 summary rows，逐档断言 30/60/90 均有至少 20 个 `stable + simulated` 样本，summary 为 `valid=true` 且 sampleCount 非零。原先“空/残缺 CSV 仍通过”的假阳性已关闭。

2. **I2 READY + real-field evidence / HIGH timeout controlled degrade — ADDRESSED.**
   - Evidence: `src/features/dashboard/FieldSelector.tsx:27-39`, `src/features/dashboard/FieldSelector.tsx:68-87`, `src/App.tsx:122-155`, `e2e/tutorial.spec.ts:39-47`, `src/App.test.tsx:124-186`
   - 场变量控件现在要求 `flowStatus === "ready" && flowField !== null`，未就绪时禁用且不会调用 evidence callback。tutorial E2E 在四场操作前必须看到 READY 和 HUD“实时场”。App 对 `Flow worker timed out` 依次 HIGH→MEDIUM→LOW 重建 owner；定向测试证明两次 timeout 后 LOW 写入真实 field，旧 client 均 dispose，telemetry/教程状态保留。原截图所示 HIGH timeout 不再能被当成教程成功证据。

3. **I3 runtime ownership / unmount cleanup tests — ADDRESSED.**
   - Evidence: `src/App.integration.test.tsx:52-100`, `src/App.tsx:41-45`, `src/App.tsx:77-103`, `src/App.tsx:122-155`
   - integration test 注入 source、simulation runtime、flow client/runtime，断言单次创建/启动、真实 50 ms frame 进入 history；unmount 后断言 simulation stop、flow stop、client dispose 各一次且 fake timer 数归零。该测试现在会在移除核心 effect、重复 runtime owner 或遗漏最终 cleanup 时失败。

4. **I4 real `WEBGL_lose_context` / no silent skip — ADDRESSED.**
   - Evidence: `e2e/free-lab.spec.ts:30-55`
   - canvas 必须唯一存在；测试从真实 WebGL context 取得 `WEBGL_lose_context` 并调用 `loseContext()/restoreContext()`，验证 loss fallback、旧 canvas 断开、新 canvas 建立、flow 重回 READY/实时场及恢复后场切换。扩展缺失会显示明确 skip 原因，不再像原来的 `if (canvas.count())` 一样静默 PASS；Fix round 报告记录本轮 Chromium 实际未 skip。

5. **I5 responsive keyboard paths / overflow per panel — ADDRESSED.**
   - Evidence: `src/features/shell/AppShell.tsx:49-57`, `e2e/responsive.spec.ts:19-57`, `src/features/shell/AppShell.test.tsx:60-80`
   - compact tab 的正向 Tab 现在显式进入活动 panel 的首个可用控件。tablet/mobile E2E 真实聚焦 slider/start/pause/reset，并用键盘改变功率、启动和暂停；控制与曲线 panel 激活后分别重测 overflow。desktop 从自然 Tab 顺序到达 slider/start 并改变功率，再重测 overflow。原先仅 `toBeVisible()` 的断言已被真实 focus/action 路径替代。

6. **I6 running power change + real reset dialog — ADDRESSED.**
   - Evidence: `e2e/free-lab.spec.ts:12-25`, `e2e/free-lab.spec.ts:57-65`
   - 用例先等待 T+ 时间前进并记录 RPM，resume 后将运行中功率改为 65%，断言 output 及 RPM 增长。reset 使用实际 dialog event promise，精确断言提示文本、accept 并等待 click 完成，再验证 IDLE 与 0%。原先“handler 挂了但 dialog 可不出现”的假阳性已关闭。

7. **M1 ignore generated artifacts — ADDRESSED.**
   - Evidence: `.gitignore:1-4`
   - `node_modules/`、`dist/`、`playwright-report/`、`test-results/` 已全部由项目 `.gitignore` 命中；源码与设计图未被忽略。当前 scoped `git status` 也不再列出这些生成目录。

8. **M2 no server reuse — ADDRESSED.**
   - Evidence: `playwright.config.ts:12-16`
   - `reuseExistingServer: false`，每轮 E2E 必须由该配置启动注入 exact-20 环境的专用 4173 server，不再复用未知本地实例。

### New Breakage

未发现由本轮八项修复引入的新 breakage。定向复跑：

- `npm run test:run -- src/App.integration.test.tsx src/App.test.tsx src/features/dashboard/Dashboard.test.tsx src/features/shell/AppShell.test.tsx`
- Result: **4 files / 31 tests passed**。

未重复运行完整 1.3 分钟 Playwright 矩阵；I1/I4/I5/I6 的浏览器证据采用 fix report 中已记录的 focused/full PASS，并逐行复核其断言完整性。

### Out-of-Scope

无。本轮改动均直接服务于原 I1–I6、M1–M2：E2E parser/contracts、App lifecycle/timeout 降档、FieldSelector evidence gate、compact keyboard routing、测试与忽略/服务器配置；未发现无关产品扩展。

### Verdict

**APPROVED — Fix round 1 已完整关闭原 8 项 findings。**

Task 11 可依据本轮修复证据记为 complete；本次复审未修改实现、未触碰 index/HEAD，也未派生其他任务。
