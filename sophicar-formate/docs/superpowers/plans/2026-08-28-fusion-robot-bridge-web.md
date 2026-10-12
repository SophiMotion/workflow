# Fusion Robot Bridge Web Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建本地优先的工程 Web 工作台，完成 SophiCAD 包导入、Three.js 装配/四连杆运动、参数编辑、URDF/Isaac 编辑验证和更新包下载。

**Architecture:** React 只负责界面和交互，SophiCAD 数据、图、URDF 和运动学来自共享 Core。Zustand store 保存当前基础包与字段级 changes；Three 场景按唯一 component 加载 geometry，再按 occurrence 实例化。所有文件操作通过浏览器 File API，不上传服务器。

**Tech Stack:** React、TypeScript、Vite、Three.js、@react-three/fiber、@react-three/drei、Zustand、Vitest、Testing Library、Playwright

**Spec:** `docs/superpowers/specs/2026-08-28-fusion-threejs-urdf-bridge-design.md`

## Global Constraints

- 使用 `build-web-apps:frontend-app-builder` 实施 UI，并在完成前使用 `build-web-apps:frontend-testing-debugging` 验证真实渲染。
- Web 为静态应用，不含模型上传、登录、数据库或后台 API。
- 桌面工程工作流优先，最小可用宽度 1024 px；窄屏显示明确提示而不是损坏布局。
- 参数影响权威几何后必须标记 stale；代理预览不得伪装为 Fusion 精确重建。
- 顶部始终展示模型、源版本、未保存状态、stale 状态和诊断计数。
- Three.js 与 URDF 选择状态必须双向联动。
- 关键操作键盘可达，颜色不是唯一状态提示。

---

## File Structure

- `web/src/app/App.tsx`：应用 shell 与模块路由。
- `web/src/store/workbench-store.ts`：基础模型、changes、选择和诊断。
- `web/src/features/import/`：拖放与本地包读取。
- `web/src/features/assembly/`：装配树与属性面板。
- `web/src/features/viewer/`：Three canvas、geometry cache、occurrence scene。
- `web/src/features/parameters/`：参数表、表达式修改、依赖与 stale。
- `web/src/features/kinematics/`：Joint controls 和四连杆播放。
- `web/src/features/urdf/`：运动树、link/joint editor、XML/constraints。
- `web/src/features/export/`：更新包下载。
- `web/src/styles/`：设计 token 和工程界面样式。
- `web/e2e/`：Playwright 端到端测试。

### Task 1: Web Shell、导入与状态模型

**Files:**
- Create: `web/package.json`
- Create: `web/index.html`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/src/main.tsx`
- Create: `web/src/app/App.tsx`
- Create: `web/src/store/workbench-store.ts`
- Create: `web/src/features/import/ImportDropzone.tsx`
- Test: `web/src/features/import/ImportDropzone.test.tsx`

**Interfaces:**
- Consumes: `readSophiCadPackage(bytes)`
- Produces: `useWorkbenchStore` with `loadPackage`、`selectedEntityId`、`changes`、`diagnostics`

- [ ] **Step 1: 创建 Vite React TypeScript workspace 并安装依赖**

Run:

```bash
npm create vite@latest web -- --template react-ts
npm install --workspace web three @types/three @react-three/fiber @react-three/drei zustand
npm install -D --workspace web @testing-library/react @testing-library/jest-dom jsdom playwright
```

- [ ] **Step 2: 写导入成功、错误和本地隐私文案失败测试**

```tsx
it('loads a local package and shows its source version', async () => {
  render(<App />);
  await userEvent.upload(screen.getByLabelText('导入 SophiCAD 数据包'), validPackageFile);
  expect(await screen.findByText('test1.f3d')).toBeVisible();
  expect(screen.getByText('Fusion v1')).toBeVisible();
  expect(screen.getByText('文件仅在本机浏览器中处理')).toBeVisible();
});
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm test -- web/src/features/import/ImportDropzone.test.tsx`

- [ ] **Step 4: 实现 store、拖放、文件选择和错误状态**

Store 的最小接口：

```ts
interface WorkbenchState {
  source?: SophiCadPackage;
  model?: ModelDocument;
  changes: ChangesDocument;
  diagnostics: Diagnostic[];
  selectedEntityId?: string;
  staleEntityIds: Set<string>;
  loadPackage(bytes: Uint8Array): Promise<void>;
  selectEntity(id?: string): void;
  reset(): void;
}
```

- [ ] **Step 5: 运行测试、类型检查并提交**

```bash
npm test -- web/src/features/import/ImportDropzone.test.tsx
npm run typecheck
git add web package.json package-lock.json
git commit -m "feat: add local SophiCAD web workbench"
```

### Task 2: 工程布局、状态栏和装配树

**Files:**
- Create: `web/src/app/TopStatusBar.tsx`
- Create: `web/src/app/WorkbenchLayout.tsx`
- Create: `web/src/features/assembly/AssemblyTree.tsx`
- Create: `web/src/features/assembly/EntityInspector.tsx`
- Create: `web/src/features/assembly/BomTable.tsx`
- Create: `web/src/styles/tokens.css`
- Create: `web/src/styles/workbench.css`
- Test: `web/src/features/assembly/AssemblyTree.test.tsx`

**Interfaces:**
- Consumes: `model.occurrences`、selection store
- Produces: linked selection and visibility override state

- [ ] **Step 1: 写层级、复用组件、选择和状态标记测试**

```tsx
it('renders occurrence hierarchy without collapsing reused components', async () => {
  renderWithFourBar(<AssemblyTree />);
  expect(screen.getAllByText('连杆1')).toHaveLength(2);
  await userEvent.click(screen.getByRole('treeitem', { name: /连杆1:2/ }));
  expect(useWorkbenchStore.getState().selectedEntityId).toBe('link1-occ-2');
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- web/src/features/assembly/AssemblyTree.test.tsx`

- [ ] **Step 3: 实现四区工程布局与 token**

视觉语言：深石墨背景、温和灰白面板、青蓝结构色、琥珀 warning、红色 error；避免大面积渐变和营销卡片。树使用 ARIA `tree/treeitem`，折叠不丢 selection。

- [ ] **Step 4: 实现顶部模型/源版本/修改/stale/诊断状态**

顶部主按钮固定为“下载更新包”；无修改时 disabled，并解释原因。右侧 BOM tab 展示零件号、描述、材料、数量、质量与全部实例路径；数量始终只读，业务描述 override 与 Fusion 原值并排显示。

- [ ] **Step 5: 运行测试并提交**

```bash
npm test -- web/src/features/assembly/AssemblyTree.test.tsx
git add web/src/app web/src/features/assembly web/src/styles
git commit -m "feat: add engineering workbench layout"
```

### Task 3: Three.js 组件缓存与 Occurrence 场景

**Files:**
- Create: `web/src/features/viewer/ModelCanvas.tsx`
- Create: `web/src/features/viewer/OccurrenceScene.tsx`
- Create: `web/src/features/viewer/geometry-cache.ts`
- Create: `web/src/features/viewer/measurement.ts`
- Create: `web/src/features/viewer/SectionPlane.tsx`
- Create: `web/src/features/viewer/ViewerToolbar.tsx`
- Test: `web/src/features/viewer/geometry-cache.test.ts`
- Test: `web/src/features/viewer/measurement.test.ts`
- Test: `web/src/features/viewer/OccurrenceScene.test.tsx`

**Interfaces:**
- Produces: `loadComponentGeometry(package, component): Promise<BufferGeometry[]>`
- Consumes: occurrence row-major transforms and component mesh refs

- [ ] **Step 1: 写同组件只解析一次、实例变换和选择测试**

```ts
it('caches one GLB parse for repeated component occurrences', async () => {
  await Promise.all([
    cache.get('link-component', loader),
    cache.get('link-component', loader),
  ]);
  expect(loader).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- web/src/features/viewer`

- [ ] **Step 3: 实现 GLB/STL 加载、矩阵转换和资源释放**

每个 component geometry 缓存一次；每个 occurrence 使用独立 `Group` 应用 transform。加载新包时 dispose geometry/material/blob URLs。若 GLB 缺失但 STL 存在，降级加载 STL 并产生 warning。

- [ ] **Step 4: 实现选择、高亮、隔离、透明、视角、剖切和测量**

选择从 canvas 写回 store；树选择驱动画布 outline/材质高亮。剖切使用 renderer clipping planes 并在离开模式时恢复材质；测量在模型坐标中计算两点距离并按用户显示单位格式化。工具栏按钮含文本 tooltip 和 `aria-label`。

- [ ] **Step 5: 运行测试与构建并提交**

```bash
npm test -- web/src/features/viewer
npm run build --workspace web
git add web/src/features/viewer
git commit -m "feat: render Fusion occurrences in Three.js"
```

### Task 4: 参数编辑、依赖和 stale 传播

**Files:**
- Create: `web/src/features/parameters/ParameterTable.tsx`
- Create: `web/src/features/parameters/ParameterEditor.tsx`
- Create: `web/src/features/parameters/ProxyDriverEditor.tsx`
- Create: `web/src/features/parameters/proxy-drivers.ts`
- Create: `web/src/features/parameters/stale.ts`
- Test: `web/src/features/parameters/ParameterEditor.test.tsx`
- Test: `web/src/features/parameters/proxy-drivers.test.ts`
- Test: `web/src/features/parameters/stale.test.ts`

**Interfaces:**
- Consumes: `applyChangesDocument`、parameter dependencies
- Produces: `setParameterExpression(name, expression)` store action

- [ ] **Step 1: 写 `l1` 编辑、依赖显示、恢复和 stale 传播测试**

```tsx
it('records an expression change and marks affected geometry stale', async () => {
  renderWithFourBar(<ParameterEditor parameterName="l1" />);
  await userEvent.clear(screen.getByLabelText('表达式'));
  await userEvent.type(screen.getByLabelText('表达式'), '220 mm');
  await userEvent.click(screen.getByRole('button', { name: '应用修改' }));
  expect(useWorkbenchStore.getState().changes.parameterChanges[0].newExpression).toBe('220 mm');
  expect(useWorkbenchStore.getState().staleEntityIds.has('link1-component')).toBe(true);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- web/src/features/parameters`

- [ ] **Step 3: 实现可编辑/只读分离、表达式差异和 stale 图传播**

Web 不求值完整 Fusion 表达式；显示导出值并把新表达式标记为“待 Fusion 验证”。明显空表达式、未知参数引用和依赖环在下载前阻止。

- [ ] **Step 4: 实现显式代理驱动映射**

用户可以把一个可编辑长度参数映射到连杆局部 X/Y/Z 尺寸，或把直径参数映射到圆柱半径。映射只产生带“代理预览”水印的临时 geometry scale，不修改 source mesh、Joint origin 或权威物性。删除映射立即恢复 source mesh。

```ts
it('labels a length-driven preview as approximate and leaves source geometry unchanged', () => {
  const source = unitBoxGeometrySnapshot();
  const result = applyProxyDriver(source, { parameterName: 'l1', kind: 'length', axis: 'x', valueSi: 0.22 });
  expect(result.approximate).toBe(true);
  expect(result.label).toBe('代理预览');
  expect(unitBoxGeometrySnapshot()).toEqual(source);
});
```

- [ ] **Step 5: 运行测试并提交**

```bash
npm test -- web/src/features/parameters
git add web/src/features/parameters web/src/store/workbench-store.ts
git commit -m "feat: edit Fusion parameters with stale tracking"
```

### Task 5: Joint 控制和四连杆闭环运动

**Files:**
- Create: `web/src/features/kinematics/JointControls.tsx`
- Create: `web/src/features/kinematics/KinematicsPlayer.tsx`
- Create: `web/src/features/kinematics/apply-poses.ts`
- Test: `web/src/features/kinematics/JointControls.test.tsx`
- Test: `web/src/features/kinematics/apply-poses.test.ts`

**Interfaces:**
- Consumes: `solvePlanarFourBar` and assembly analysis
- Produces: transient occurrence pose overrides, never persisted as Fusion parameters

- [ ] **Step 1: 写限位、播放停止和四连杆闭合测试**

```tsx
it('clamps a revolute joint at its upper limit', async () => {
  renderWithFourBar(<JointControls />);
  fireEvent.change(screen.getByLabelText('输入轴角度'), { target: { value: '200' } });
  expect(screen.getByText('已到达上限')).toBeVisible();
  expect(currentJointAngle()).toBeCloseTo(Math.PI / 2);
});
```

- [ ] **Step 2: 运行失败测试并实现 fixed/revolute/prismatic 位姿**

Run: `npm test -- web/src/features/kinematics`

- [ ] **Step 3: 接入四连杆 solver 和动画播放器**

使用 `requestAnimationFrame` 的 delta time；暂停/卸载时取消 frame。不可达角度停止在最后有效解并显示 `four_bar_unreachable`，不产生 NaN matrix。

- [ ] **Step 4: 运行测试并提交**

```bash
npm test -- web/src/features/kinematics
git add web/src/features/kinematics
git commit -m "feat: animate robot joints and four-bar loop"
```

### Task 6: URDF / Isaac 编辑模块

**Files:**
- Create: `web/src/features/urdf/UrdfWorkspace.tsx`
- Create: `web/src/features/urdf/KinematicTree.tsx`
- Create: `web/src/features/urdf/JointEditor.tsx`
- Create: `web/src/features/urdf/LinkEditor.tsx`
- Create: `web/src/features/urdf/UrdfPreview.tsx`
- Create: `web/src/features/urdf/LoopClosuresPanel.tsx`
- Test: `web/src/features/urdf/UrdfWorkspace.test.tsx`

**Interfaces:**
- Consumes: `generateUrdf`、`validateUrdfArtifacts`
- Produces: robot overrides in changes document

- [ ] **Step 1: 写树联动、惯量错误和 loop closure 显示测试**

```tsx
it('shows the cut four-bar joint without putting it into the URDF tree', () => {
  renderWithFourBar(<UrdfWorkspace />);
  expect(screen.getByRole('tree')).not.toHaveTextContent('j-output-ground');
  expect(screen.getByTestId('loop-closures')).toHaveTextContent('j-output-ground');
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- web/src/features/urdf/UrdfWorkspace.test.tsx`

- [ ] **Step 3: 实现 link/joint 编辑、验证、XML 和 constraints 预览**

原始 Fusion 值与 override 并排显示。质量 ≤ 0、非正定惯量、重复名称、缺 parent/child 和 mesh 缺失是 error；被分解或降级的复合 Joint 是 warning。

- [ ] **Step 4: 实现 ROS package URI 与 Isaac relative URI 切换**

切换只影响生成产物，不改 `model.json` mesh refs。

- [ ] **Step 5: 运行测试并提交**

```bash
npm test -- web/src/features/urdf/UrdfWorkspace.test.tsx
git add web/src/features/urdf
git commit -m "feat: edit and validate URDF artifacts"
```

### Task 7: 更新包与独立 URDF 下载

**Files:**
- Create: `web/src/features/export/DownloadUpdatePackage.tsx`
- Create: `web/src/features/export/download.ts`
- Test: `web/src/features/export/download.test.ts`

**Interfaces:**
- Consumes: `writeSophiCadPackage`、current changes and generated URDF
- Produces: `<source>-update.sophicad.zip` and URDF bundle Blob

- [ ] **Step 1: 写无修改禁用、错误阻止和文件名测试**

```ts
it('never overwrites the imported name and adds update suffix', async () => {
  const download = await buildUpdateDownload(workbenchWithL1Change());
  expect(download.filename).toBe('test1-update.sophicad.zip');
  expect(download.bytes).not.toEqual(sourceBytes);
});
```

- [ ] **Step 2: 运行失败测试并实现更新包构建**

Run: `npm test -- web/src/features/export/download.test.ts`

- [ ] **Step 3: 下载前执行完整验证并呈现 warning 确认**

error 阻止；warning 使用可取消的确认对话框。下载成功后仍保留 changes，直到用户明确“标记为已下载”或导入新包。

- [ ] **Step 4: 运行测试并提交**

```bash
npm test -- web/src/features/export/download.test.ts
git add web/src/features/export
git commit -m "feat: download Fusion update and URDF packages"
```

### Task 8: Playwright 端到端与真实渲染验证

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/e2e/four-bar-roundtrip.spec.ts`
- Create: `web/e2e/urdf-workspace.spec.ts`
- Create: `web/README.md`

**Interfaces:**
- Verifies: 用户可见的完整 Web 链路。

- [ ] **Step 1: 写四连杆导入→选择→修改→运动→下载 E2E**

```ts
test('edits l1 and downloads an update package', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('导入 SophiCAD 数据包').setInputFiles('fixtures/generated/four-bar.sophicad.zip');
  await page.getByRole('row', { name: /l1/ }).click();
  await page.getByLabel('表达式').fill('220 mm');
  await page.getByRole('button', { name: '应用修改' }).click();
  await expect(page.getByText('等待 Fusion 重建')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载更新包' }).click();
  expect((await download).suggestedFilename()).toBe('test1-update.sophicad.zip');
});
```

- [ ] **Step 2: 运行 E2E 并确认尚未满足的失败点**

Run: `npx playwright test --config web/playwright.config.ts`

- [ ] **Step 3: 修复真实浏览器中的尺寸、Three canvas、焦点和下载问题**

不得通过放宽断言隐藏真实问题。使用 1440×900 主视口，再检查 1024×768；窄于 1024 显示“请使用桌面宽度”。

- [ ] **Step 4: 执行完整验证**

Run:

```bash
npm run typecheck
npm test
npm run build --workspace web
npx playwright test --config web/playwright.config.ts
```

Expected: 0 type errors、0 test failures、production build exit 0。

- [ ] **Step 5: 提交**

```bash
git diff --check
git add web/playwright.config.ts web/e2e web/README.md
git commit -m "test: verify four-bar web workflow"
```
