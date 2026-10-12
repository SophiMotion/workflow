# Task 7 实施报告：Three.js 数字风洞与流场可视化

## 结果

已实现原创、程序化、模块化 Three.js 数字风洞：气流沿 x = -6 → 6，包含 off-white 管体、charcoal 框架与双层实例化蜂窝、红色六叶风扇与模型台、透明测试段、程序化车辆、工程网格/灯光、流场切片与 900 个实例化粒子。场景消费 Task 3 Zustand store 及 Task 5/6 `FlowFieldFrame`，支持 `speed`、`pressure`、`vorticity`、`streamlines` 四模式；无 field 时显示示意流场，WebGL 不可用时显示纯 SVG 程序化回退，未嵌入视觉基准位图或复制 MakerWorld STL。

## TDD：RED

先创建 `flowSampling.test.ts` 与 `WindTunnelScene.test.tsx`，未创建生产模块时运行：

```text
npm run test:run -- src/features/scene
Test Files  2 failed (2)
Tests       no tests
```

两个 suite 分别因无法解析 `./flowSampling` 与 `./WindTunnelScene` 失败，证明失败来自功能缺失。测试以手算字面量保护双线性插值与边界钳制，并以真实 DOM 行为保护 WebGL 回退、五个 exact hotspot ID、选中态、剖视提示和教程 evidence callback；WebGL Canvas 本身未在 jsdom 中伪造。

## TDD：GREEN

实现纯采样、回退与可访问交互后，同一命令通过 4/4。完成 R3F 边界与 App lazy 集成后，指定聚焦回归通过：

```text
npm run test:run -- src/features/scene src/App.test.tsx
Test Files  3 passed (3)
Tests       7 passed (7)
```

mutation 自审：删除插值、删除 clamp、取消 `aria-pressed` 更新、漏调 callback 或不显示 test-section 剖视提示，均会触发对应断言；断言不依赖生产 helper 计算期望值。

## 实现要点

- `sampleFlowVelocity` 将归一化 u/v 钳制到 0–1，映射至网格单元并对两个速度分量双线性插值。
- 收缩/扩散段来自自建 `BufferGeometry`；蜂窝使用两个 `InstancedMesh` 六边形环面；所有风洞、车辆和模型台均由 Three.js 原语程序化组成。
- 五个 companion button 使用 exact ID：`straightener`、`contraction`、`test-section`、`model-stand`、`fan`。选中模块保持完整不透明度，其余淡化；再次点击取消。选中 `test-section` 打开剖视并保持车辆与中心流场可见；App callback 去重写入 `viewedHotspots` 教程 evidence。
- `FlowParticles` 默认 900 个实例，位置和停滞计时均放在 `Float32Array` ref；`useFrame` 只读取最新 field/phase/wind ref 并更新 instance matrices，没有 React/Zustand setter。粒子越界、回流或停滞超过 1.5 s 时从 x = -2.8 重置，`paused` 时冻结，OrbitControls 仍可检查。
- `FieldSlice` 仅在 frame 或 field mode 改变时生成 120 × 48 `DataTexture`；固定映射分别为深青→青→米白、蓝→灰→红、紫→灰→琥珀。streamlines 使用透明切片与 24 条青色路径。
- reduced-motion 下不挂载 `FlowParticles`，改为 24 条静态流线。无 field 时纹理使用明确标注的程序化“示意流场”。
- `React.lazy` + `Suspense` 延迟加载场景，shell 首屏 loading 文案为“正在初始化数字风洞…”。最终构建中基础 chunk 198.16 kB，Three 场景独立 lazy chunk 938.63 kB（gzip 251.52 kB）。

## 视觉自审

- 先完整查看 `docs/design/sophiflow-dashboard-concept.png`，仅借鉴深色工程控制台构图、off-white/charcoal/red/teal 色彩层级，不嵌入原图。
- 用 1600 × 1000 Chromium 实际渲染截图检查；首轮发现透明箱体遮挡车辆偏强，随后将玻璃材质改为低不透明度、关闭 depthWrite，并提高车辆主体辨识度。第二轮确认收缩段、透明段、红色模型台/车辆、风扇和青色流粒子均可辨识，DOM 热点不遮挡核心场景。
- 桌面和 900 px 以下均有响应式热点布局；按钮保留键盘 focus 与 `aria-pressed` 状态。

## 性能自审

- 900 粒子共享低面数球体几何与单个 instanced draw；蜂窝同样实例化，无逐粒子 React 元素更新。
- 每帧只修改 TypedArray/ref 与 instance matrix；场纹理不在 `useFrame` 中重建，车辆压力色带只在新 frame 到达时重新采样。
- Canvas DPR 上限 1.65，启用雾化控制远处开销；reduced-motion 路径完全不挂载动态粒子。
- Vite 对 lazy 场景给出 >500 kB 常规 warning，但 Three 已与 198 kB shell 分包；无 build error。

## 最终验证（fresh）

```text
npm run test:run
Test Files  14 passed (14)
Tests       57 passed (57)

npm run build
tsc --noEmit + vite build: exit 0
WindTunnelScene lazy chunk: 938.63 kB / gzip 251.52 kB

npm run lint
eslint .: exit 0
```

## 文件

- `src/features/scene/flowSampling.ts`
- `src/features/scene/flowSampling.test.ts`
- `src/features/scene/WindTunnelGeometry.tsx`
- `src/features/scene/VehicleModel.tsx`
- `src/features/scene/FlowParticles.tsx`
- `src/features/scene/FieldSlice.tsx`
- `src/features/scene/Hotspots.tsx`
- `src/features/scene/hotspotTypes.ts`
- `src/features/scene/SceneFallback.tsx`
- `src/features/scene/WindTunnelScene.tsx`
- `src/features/scene/WindTunnelScene.test.tsx`
- `src/App.tsx`
- `src/styles/global.css`
- `.superpowers/sdd/2026-08-18-digital-wind-tunnel-web/reports/task-7.md`

## 范围与完整性

- 只修改 Task 7 场景、App 挂载、场景样式与本报告；复用既有 store/types，没有修改 Task 3/5/6 实现。
- 未创建分支，未 stage，未 commit，未触碰 git index；未派生子 Agent。

## Fix round 1 — WebGL 稳定性、坐标一致性与热路径分配

### 定向 RED

完整读取 `reviews/task-7.md` 后，先加入 WebGL rerender、solver/scene 坐标、模块可见性和 into 采样测试：

```text
npm run test:run -- src/features/scene
Test Files  4 failed (4)
Tests       2 failed | 4 passed
```

- 默认 scene 连续 3 次 render 调用了 `getContext` 6 次，期望一次探针的固定 2 次能力尝试；
- `sampleFlowVelocityInto` 不存在；
- `sceneCoordinates` 与 `sceneVisibility` 不存在，两个 suite 无法解析。

失败分别直接对应 review 的 Critical 与 Important 项，不是测试环境或断言误差。

### 修复与 GREEN

- WebGL 默认探测改为模块级稳定缓存；显式 `webglAvailable` prop 完全绕过探测，保留 jsdom 边界测试。真实探测只创建一个 canvas，成功后主动调用 `WEBGL_lose_context` 释放探针 context，避免与 R3F Canvas 争夺浏览器 context 配额。
- 新增统一 `sceneCoordinates`：field 平面中心 y = -0.58、高 1.8；solver 障碍包络 y = 0.43…0.66 的中心 v = 0.545 精确映射到可见主车身中心 y = -0.499。`FieldSlice`、`FlowParticles`、静态流线、车辆位置和压力采样共同消费该映射。
- `vehicleModuleOpacities` 拆分 `stand` / `car`：选择 `model-stand` 得到 `{ stand: 1, car: 0.2 }`；选择 `test-section` 得到 `{ stand: 0.2, car: 1 }`，保留剖视教学特例。
- 新增 `sampleFlowVelocityInto`：单次计算索引/权重，直接索引 TypedArray，无 `at` closure，复用调用方输出；原 `sampleFlowVelocity` 保持兼容。
- 粒子 buffers 通过 `useState(() => createParticleBuffers(count))` 真正惰性创建一次，再存入 ref。每帧复用同一个 velocity 输出和 `THREE.Object3D` transform；fallback 分支也原位写入，不再为每个粒子创建对象。
- FieldSlice 在模块加载时预建四套 256 色 RGB LUT；纹理热循环只做数字索引与 byte copy，不再逐 texel `new/clone THREE.Color`。
- 风扇 wireframe 格栅由 charcoal 修正为 red。

定向 GREEN：

```text
npm run test:run -- src/features/scene
Test Files  4 passed (4)
Tests       10 passed (10)
```

### 视觉与性能复核

用已安装 Chromium 重新截取 1600 × 1000 实际渲染。粒子/场域垂直带现围绕可见车辆中心，不再围绕原先的 scene y ≈ 0 幽灵位置；车辆、红色模型台与红色风扇格栅均保持清晰。热点高亮隔离由纯映射测试验证，未在修复轮扩大视觉功能。

热循环每粒子每帧现为零 velocity/closure/transform 对象分配；120 × 48 纹理每 texel 现为 LUT 查表，只有新 frame/mode 才分配目标 DataTexture buffer。900 粒子 TypedArray、停滞数组、复用输出与 transform 均只在首次 mount 惰性创建。

### 最终验证（fresh）

```text
npm run test:run
Test Files  16 passed (16)
Tests       63 passed (63)

npm run build
tsc --noEmit + vite build: exit 0
WindTunnelScene lazy chunk: 939.48 kB / gzip 251.94 kB

npm run lint
eslint .: exit 0
```

Vite 仍仅报告 lazy Three chunk 大于 500 kB 的已知非阻塞 warning；shell chunk 维持 198.16 kB，Three 仍独立 lazy 分包。未 commit、未 stage、未改 index、未派生 Agent。
