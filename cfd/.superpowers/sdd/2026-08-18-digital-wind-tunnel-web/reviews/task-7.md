# Task 7 Review — Three.js Digital Tunnel and Flow Visualization

## Spec Compliance

| 规格项 | 结论 | 证据 / 备注 |
|---|---|---|
| x = -6 → 6、原创模块、透明测试段、车辆/模型台、工程网格 | 基本符合 | 风洞由 Three.js 原语与自建 `BufferGeometry` 组成；地台覆盖 x = -6…6，主模块沿 x 轴布置，透明段、车辆、红色台架、网格和坐标轴均存在。风扇格栅颜色不符合“红色格栅”，见 Minor。 |
| 消费 `FlowFieldFrame` / `selectedField` / 遥测 | 符合 | `WindTunnelScene.tsx:42-45` 分别订阅 frame、field mode、phase 和 wind speed，并传给切片、车辆和粒子。 |
| 双线性采样 | 算法符合，空间映射不符合 | `flowSampling.ts:13-35` 正确 clamp 并对 X/Y 分量双线性插值；单测覆盖中心点和边界。但 scene-y 到 solver-v 的映射没有与渲染车辆对齐，见 Important。 |
| 900 refs instancing；`useFrame` 无 React/Zustand setter | 符合 | `FlowParticles.tsx:30-90` 默认 900 实例，位置/停滞时间保存在 TypedArray ref；`useFrame` 只改 ref 和 instance matrix。仍有明显热路径临时分配，见 Important/Minor。 |
| `DataTexture` 120 × 48，仅 frame/mode 更新 | 符合 | `FieldSlice.tsx:15-16,98-99` 通过 `[frame, mode]` memo 重建，并在 effect cleanup 中 dispose。颜色生成有过量对象分配，见 Important。 |
| 四模式与无场示意 | 符合 | speed / pressure / vorticity 颜色映射存在；streamlines 隐藏切片并显示 24 条青色路径；无 frame 时生成低透明度示意场，HUD 明确标注“示意流场”。 |
| 粒子 reset / paused | 符合 | `FlowParticles.tsx:55-80` 在 paused 直接冻结；越界、回流或停滞超过 1.5 s 后从 x = -2.8 重置。OrbitControls 仍挂载。 |
| reduced-motion | 符合 | `WindTunnelScene.tsx:46,66` 不挂载动态粒子；`FieldSlice.tsx:109` 显示 24 条静态流线。 |
| exact 5 hotspot、选择/解释/剖视/evidence | 部分符合 | ID 集合、按钮、说明卡、test-section 剖视及 callback 均存在；`model-stand` 选择时车辆没有被 dim，见 Important。 |
| WebGL fallback | 部分符合 | 显式 false 与 Canvas fallback 都有程序化 SVG；但默认能力探测在每次 render 创建新 WebGL context，可能让真正的 Canvas 丢失 context，见 Critical。 |
| lazy App integration / accessibility | 符合 | `App.tsx:7,31-36` 使用 `React.lazy` + `Suspense` 与语义 loading status；fallback SVG 有 img role/name，热点为键盘可用 button 并暴露 `aria-pressed`。 |

## Strengths

- 场景没有嵌入视觉基准图或外部 STL，模块、车体、蜂窝和渐缩段均为原创程序化几何；整体配色和工程控制台层级合理借鉴了基准而非像素复制。
- 900 粒子和两层蜂窝都采用 instancing；暂停只冻结粒子，保留相机巡检，符合交互目标。
- `FieldSlice` 的纹理生命周期有明确 cleanup；模式配色、无场示意、streamlines 和 reduced-motion 分支都清晰可读。
- 五个 hotspot identifier 精确且只有五个；说明卡、`aria-live`、切换态和 evidence callback 的数据路径明确。
- WebGL 不可用时仍保留完整的教学 HUD、程序化结构图和可访问热点，不是空白画布。

## Issues

### Critical

1. **默认 WebGL 探测在每次 scene render 都创建一个新的 WebGL context，可能很快触发真实场景 context loss。** `WindTunnelScene` 把 `detectWebgl()` 放在默认参数中（`src/features/scene/WindTunnelScene.tsx:18-25,40`）；App 没传该 prop，而组件又订阅 10 Hz 更新的 flow frame 和 telemetry（`src/features/scene/WindTunnelScene.tsx:42,45`），所以每次 store render 都会创建 canvas 并调用 `getContext("webgl2"/"webgl")`。这些探测 context 没有缓存，也没有通过 `WEBGL_lose_context` 释放；浏览器活跃 context 数有上限，旧 context（包括 R3F Canvas）可能被回收/丢失。能力探测应只执行一次并缓存稳定结果，而不是作为 render-time 默认值。

### Important

1. **二维 CFD 障碍物与 Three.js 车辆的垂直坐标不对齐，速度切片和粒子会围绕“幽灵车位”流动。** 粒子把 scene y 通过 `(y + 0.9) / 1.8` 直接映射到 solver v（`src/features/scene/FlowParticles.tsx:66`），切片也把 source v 直接铺满居中平面（`src/features/scene/FieldSlice.tsx:60-62,105`）。既有 solver 车辆障碍位于 normalized y = 0.43…0.66（`src/features/flow/obstacleMask.ts:9,13`），在当前映射中约对应 scene y = -0.13…0.29；渲染车辆却整体平移到 y = -0.58，主车身中心约为 -0.50（`src/features/scene/VehicleModel.tsx:39,46`）。因此尾迹、停滞区和压力图不会贴合可见车体。应让可见车辆姿态与 solver mask 使用同一显式坐标变换。

2. **选择 `model-stand` 时没有 dim 车辆，未满足“选中模块保持、其他对象淡化”的交互要求。** `VehicleModel` 为台架和整车共用同一个 opacity，并把 `model-stand` 与 `test-section` 都列为整组全不透明（`src/features/scene/VehicleModel.tsx:22,39-76`）。test-section 保持车辆可见是规格特例；model-stand 不是。当前点击模型台时，车辆与台架一起保持高亮，说明卡虽正确但视觉选择不精确。应拆出台架/车辆 opacity，只有 test-section cutaway 才保留车辆。

3. **实例化避免了 React state 更新，但关键热路径仍制造大量短命对象，存在持续 GC 抖动风险。** 每个粒子每帧调用一次采样；`bilinear` 每次创建 `at` closure，X/Y 两个分量各一次，`sampleFlowVelocity` 再返回新对象（`src/features/scene/flowSampling.ts:25,31-35`; `src/features/scene/FlowParticles.tsx:66`），即约每秒 54,000 velocity 对象和 108,000 closure（900 × 60 FPS）。此外每个 120 × 48 texel 的 `rampColor` 都构造并 clone 多个 `THREE.Color`（`src/features/scene/FieldSlice.tsx:22-32,54-65`）；10 Hz frame 下约每秒 57,600 texel 次调用。应在 hot loop 中用索引直接采样/复用输出和预建色标或 LUT，保持零/低分配。

### Minor

1. **ref 初始值表达式在每次 React render 都重新计算，虽然结果会被 `useRef` 丢弃。** `useRef(createPositions(count))` 和 `useRef(new Float32Array(count))`（`src/features/scene/FlowParticles.tsx:35-36`）会在每次 frame prop 导致的 render 中重新执行，反复做 900 粒子的 seeded `Math.sin` 和 TypedArray 分配。应采用惰性 `ref.current` 初始化，或使粒子组件不随 frame prop render。

2. **风扇“格栅”是 charcoal，而规格要求红色格栅。** `src/features/scene/WindTunnelGeometry.tsx:132` 的 wireframe grille 使用 `CHARCOAL`；红色只用于轮毂和六片叶片。这是小的材质偏差，但报告所称红色风扇格栅没有代码证据。

## Assessment

**Changes requested / 当前不建议验收。** 架构覆盖面较完整，双线性采样、四模式、900 instancing、paused/reduced-motion、精确 hotspot IDs、fallback 和 lazy integration 均有直接代码证据；视觉方向也与基准一致且保持原创。但 render-time WebGL context 探测会威胁整个核心场景的稳定性，CFD/车辆坐标错位会直接破坏教学可视化的可信度，需先修复。热点 dim 和热路径分配也应在验收前处理。

本审查按要求只读取 frozen diff、brief、实施报告、必要的既有 flow 类型/坐标定义及视觉基准；未运行可能写入缓存/构建产物的测试、lint 或 build。因此实施报告中的 fresh test/build 数字不作为独立验证证据。

---

## Fix Round 1 Re-review

### Original Findings

1. **ADDRESSED — Critical：WebGL probe per render。** 默认 prop 不再直接调用探测函数；`getWebglAvailability` 通过模块级 cache 固定首次结果（`src/features/scene/WindTunnelScene.tsx:32-36,52`）。成功探测后还主动调用 `WEBGL_lose_context` 释放临时 context（`src/features/scene/WindTunnelScene.tsx:18-25`），显式 `webglAvailable={false}` 会通过 nullish short-circuit 完全绕过探测。连续 rerender 的定向回归测试位于 `src/features/scene/WindTunnelScene.test.tsx:30-40`。

2. **ADDRESSED — Important：CFD / vehicle coordinate alignment。** 新的统一坐标层定义 flow plane、solver↔scene 变换及 solver 车辆包络中心（`src/features/scene/sceneCoordinates.ts:1-30`）。FieldSlice 使用同一中心和高度（`src/features/scene/FieldSlice.tsx:121-122`），粒子采样/重置使用同一双向变换（`src/features/scene/FlowParticles.tsx:31,95,107`），静态流线使用 `solverVToSceneY`（`src/features/scene/FieldSlice.tsx:99-106`），可见车身中心及压力采样也引用相同常量（`src/features/scene/VehicleModel.tsx:24,35,41`）。因此原先 scene y≈0 的“幽灵车位”已被消除。

3. **ADDRESSED — Important：`model-stand` dim isolation。** `vehicleModuleOpacities` 明确返回 stand/car 两路 opacity：选中 model-stand 为 `{ stand: 1, car: 0.2 }`，test-section 特例为 `{ stand: 0.2, car: 1 }`（`src/features/scene/sceneVisibility.ts:3-8`）。VehicleModel 将台架材质绑定 standOpacity、整车材质绑定 carOpacity（`src/features/scene/VehicleModel.tsx:24,43-74`）；定向映射测试在 `src/features/scene/sceneVisibility.test.ts:3-8`。

4. **ADDRESSED — Important：hot-loop allocations。** 粒子路径改用 caller-owned output 的 `sampleFlowVelocityInto`，一次计算索引/权重并直接索引数组，不再创建 `at` closure 或每粒子 velocity object（`src/features/scene/flowSampling.ts:13-50`; `src/features/scene/FlowParticles.tsx:89-99`）。matrix 写入复用同一 `THREE.Object3D` transform（`src/features/scene/FlowParticles.tsx:45-68`）。FieldSlice 的四套 256 色 LUT 在模块加载时预建，texel loop 只做数值索引和 byte copy（`src/features/scene/FieldSlice.tsx:26-48,60,81-85`）。原 public `sampleFlowVelocity` 仍保留兼容返回值（`src/features/scene/flowSampling.ts:53-55`）。

5. **ADDRESSED — Minor：lazy ref initialization。** 粒子 positions、stalledFor、复用 velocity 和 transform 统一由 lazy state initializer 创建一次，再保存到 ref（`src/features/scene/FlowParticles.tsx:45-53,75-76`）；React rerender 不再重新执行 900 粒子 seeded 初始化或丢弃 TypedArray。

6. **ADDRESSED — Minor：red grille。** 风扇 wireframe grille 已从 charcoal 改为 `RED`（`src/features/scene/WindTunnelGeometry.tsx:132`）。

### New Breakage

**None found within the scoped fix snapshot.** 六项修复之间的数据路径一致：坐标常量没有绕过原有 bilinear sampler；zero-allocation API 保留旧 API 兼容；stand/car dim 拆分仍保留 test-section cutaway 的车辆可见性；WebGL cache 不影响显式 fallback prop。

### Out-of-Scope

- 未重新审查 Task 7 的其他原始功能，也未扩展到 App shell、worker/runtime、教程或其他任务。
- 未把实施报告中的 test/build/lint 数字当作证据；本轮按只读要求只核对 brief、报告末尾和 `task-7-fix-1.diff`，未独立运行可能产生写入的命令。
- `count` 动态变更、SSR/HMR 生命周期及既有非目标资源管理不属于本轮六项 finding 的修复范围，未作验收判断。

### Verdict

**FIX ROUND 1 ACCEPTED — 6/6 findings ADDRESSED，0 scoped new breakage。** Task 7 可从本轮修复复审角度通过；该结论仅覆盖上述六项，不代表对整个 Task 7 或全应用重新验收。
