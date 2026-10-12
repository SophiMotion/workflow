# SophiFlow 数字风洞

这是一个浏览器端数字风洞教学 Web：React 负责实验控制与七章教程，Three.js 展示三维风洞，Web Worker 中的二维 LBM 场提供流速、压力、涡量和流线的教学可视化。当前版本**不连接 Arduino 或真实传感器**。

## 直接双击离线预览

仓库已经包含构建完成的 `dist/index.html`。它是一个约 1.6 MB 的自包含文件，CSS、React/Three.js、图表和 LBM Worker 均已内嵌；日常查看不需要启动服务：

1. 在 Finder 或资源管理器中进入 `dist/`。
2. 使用最新版 Chrome 或 Edge 双击打开 `index.html`。
3. 复制给其他电脑时只需复制这一个文件。

不要直接编辑生成后的 `dist/index.html`：其中的代码已经压缩。需要修改页面时编辑 `src/`，再执行一次 `npm run build` 刷新离线文件。

## 开发环境与启动

- Node.js `^22.22.2`、`^24.15.0` 或 `>=26.0.0`（完整开发/测试依赖的兼容交集；当前已在 `22.22.3` 验证）
- npm（随上述 Node.js 安装）
- 推荐最新版桌面 Chrome 或 Edge；现代 Firefox、Safari 需支持 WebGL 2、Web Worker 与 ES2022
- 自动端到端测试当前只覆盖 Chromium

```bash
npm ci
npm run dev
```

终端会显示开发访问地址。只有首次安装依赖或修改源码时才需要这些命令。生产构建会重新生成可双击运行的单文件：

```bash
npm run build
```

构建末尾会自动运行离线产物检查；也可以单独执行：

```bash
npm run verify:portable
```

## 验证命令

```bash
npm run lint
npm run test:run
npm run build
npx playwright install chromium   # 首次运行 E2E 时执行
npm run test:e2e
```

`playwright.config.ts` 会为 E2E 服务设置精确值 `VITE_E2E_TIME_SCALE=20`，用于把固定 50 ms 仿真步批量推进。该开关只在值**严格等于 `20`**时生效，仅用于测试；日常开发和生产构建不要设置它。

## 结果边界与数据来源

- 顶栏、三维 HUD、报告与 CSV 中的 `SIMULATED / 模拟数据` 表示 RPM、风速、压力和载荷均由固定种子的虚拟数据源生成，不是硬件读数。
- `2D TEACHING CFD / 二维教学近似` 是 D2Q9 LBM 中心截面趋势图，用来理解流动现象；它不是网格无关、经实验验证的工程级三维 CFD。
- 压力与载荷基于 `q = 0.5ρv²` 的教学模型并叠加确定性延迟、噪声和漂移。结果不能用于车辆安全判断、结构设计、Cd/Cl 认证或制造验收。

## 代码入口

- `src/App.tsx`：应用编排、运行时生命周期和质量档切换
- `src/styles/global.css`：整体布局、颜色、字体和响应式断点
- `src/features/experiment/`：虚拟遥测、实验状态与固定步进运行时
- `src/features/flow/`：二维 LBM Worker、客户端与故障恢复
- `src/features/scene/`：Three.js 风洞、场切片和粒子
- `src/features/dashboard/`：风扇控制、传感器卡片和曲线
- `src/features/tutorial/`：七章标题、目标和推进条件
- `src/features/report/`：扫频结果、报告和 CSV
- `e2e/`：Chromium 端到端场景

## 降级与已知提示

- 页面会根据视口、CPU 并发数和“减少动态效果”偏好选择质量档；持续慢帧或 Worker 超时会从 HIGH 依次降至 MEDIUM/LOW 并重建求解器。
- 数值场出现非有限值时，入口格点速度会降至 80% 并尝试一次受控重启；WebGL 不可用或上下文丢失时会显示二维结构示意并等待恢复。
- 离线版本为保证 `file://` 下没有模块跨源加载，将主应用、样式、懒加载模块和 Worker 合并到一个 HTML，因此文件体积约 1.6 MB。这是可移植性与首次解析体积之间的明确取舍。
- 如果以后新增 GLB、纹理、WASM 或 `public/` 文件，必须重新确认它们也被内嵌；`npm run verify:portable` 会阻止外部构建文件遗漏在 `dist/` 中。
