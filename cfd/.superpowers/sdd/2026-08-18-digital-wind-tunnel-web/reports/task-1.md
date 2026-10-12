# Task 1 — 项目基础与无障碍应用壳层

## Status

完成。未创建分支、未暂存、未提交；`commits: none (controller ruling)`。

## 实现内容

- 建立 TypeScript + Vite + React + Vitest 项目基础，并安装 brief 指定依赖；`package.json` 含指定脚本，`package-lock.json` 已生成。
- 配置严格 TypeScript（含 `noUncheckedIndexedAccess`、Bundler 解析、要求的 libs/types）、Vitest jsdom 测试环境及 CSS 加载。
- 配置 ESLint 的 TypeScript、React Hooks（含 `rules-of-hooks` 与 `exhaustive-deps`）和 React Refresh 规则，并区分浏览器与 Node 全局变量。
- 创建 `AppShellProps` 和壳层：顶部 banner、教学章节导航、数字风洞主区、实验控制补充区、实验曲线区域，均带指定可访问名称。
- 创建四区域网格：240 px 左轨、弹性场景、320 px 右轨和 220 px 底部抽屉；定义全部指定 CSS tokens，未使用渐变，也未嵌入视觉概念位图。

## TDD 记录

测试保护的行为：若任一工作台区域缺失、语义角色或可访问名称错误，或 banner 未显示产品名，测试必须失败。

### RED

命令：

```bash
npm run test:run -- src/App.test.tsx
```

关键输出：

```text
FAIL  src/App.test.tsx
Error: Failed to resolve import "./App" from "src/App.test.tsx". Does the file exist?
Test Files  1 failed (1)
Tests  no tests
```

这符合 brief 预期：`./App` 与命名工作台区域均尚不存在。

### GREEN

在新增 `AppShell`、`App`、入口和样式后，第一次运行暴露 Vitest 未启用 globals（`ReferenceError: it is not defined`）；这是测试 harness 配置问题，已在 `vite.config.ts` 加入 `globals: true`，没有修改测试断言或削弱行为。

命令：

```bash
npm run test:run -- src/App.test.tsx
```

关键输出：

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

## 验证结果

```text
npm run test:run     PASS — 1 file, 1 test
npm run build        PASS — tsc --noEmit + Vite production build，生成 dist/
npm run lint         PASS
```

## 文件清单

- `package.json`
- `package-lock.json`
- `index.html`
- `tsconfig.json`
- `vite.config.ts`
- `eslint.config.js`
- `src/main.tsx`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/test/setup.ts`
- `src/styles/global.css`
- `src/features/shell/AppShell.tsx`
- `.superpowers/sdd/2026-08-18-digital-wind-tunnel-web/reports/task-1.md`

## 自审与顾虑

- 核对过五个区域的 HTML landmark 角色和中文 accessible name，均与 brief 一致；顶部也含 `SophiFlow Lab`。
- CSS token 值、网格尺寸、文件路径和公开 `AppShellProps` 合约均与 brief 一致；`lbm.worker.ts` 尚未存在，因此未添加 Web Worker reference directive。
- 概念图片只作为样式参考，未被应用引用；界面完全由 React/CSS 实现。
- 无功能性顾虑。当前内容是后续任务注入场景、控制器和图表的最小占位壳层；没有 Playwright 规格或 `playwright.config.ts`，故未运行 `test:e2e`。

## Fix round 1 — 二维教学 CFD 限定标识

审查 finding：`src/features/shell/AppShell.tsx:15` 应在公共壳层加入并测试 `2D TEACHING CFD / 二维教学近似`，以满足全局 CFD 限定硬约束。

### 变更

- 在公共顶栏的 `topbar-actions` 中新增可见的 `model-scope-badge`，文本严格为 `2D TEACHING CFD / 二维教学近似`。
- 新增独立行为测试 `identifies the CFD model as a two-dimensional teaching approximation`；保留原有五区域断言不变。
- 为标识添加 `--muted` 色彩、字号、粗细及字距样式，未引入渐变。

### RED

命令：

```bash
npm run test:run -- src/App.test.tsx
```

关键输出：

```text
FAIL  src/App.test.tsx > identifies the CFD model as a two-dimensional teaching approximation
TestingLibraryElementError: Unable to find an element with the text: 2D TEACHING CFD / 二维教学近似.
Test Files  1 failed (1)
Tests  1 failed | 1 passed (2)
```

失败原因是限定标识尚未实现，符合预期。

### GREEN 与回归验证

```text
npm run test:run -- src/App.test.tsx  PASS — 1 file, 2 tests
npm run test:run                     PASS — 1 file, 2 tests
npm run build                        PASS — tsc --noEmit + Vite build
npm run lint                         PASS
```

未暂存、未提交、未修改 Git index；`commits: none (controller ruling)`。
