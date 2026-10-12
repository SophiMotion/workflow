# 外观装配 Implementation Plan

**Goal:** 在现有工作台直接导入混元 GLB，进行尺寸对齐、真实平面分件、网格减面、刚性连杆绑定、动作预览、本地保存和 GLB 导出。

**Architecture:** 新增独立外观装配页，复用已有参数化机器人。几何编辑函数与 UI 分离；本体采用米、Z 向上，导入/导出转换 glTF 的 Y 向上。GLB 内嵌元数据保存外壳部件绑定，IndexedDB 按工程 ID 保存编辑结果与原始文件。外壳资产暂不加入共享 BOM 或 PRD 版本。

**Tech Stack:** 现有 React / React Three Fiber / Three.js / meshoptimizer / Node test。

**Spec:** 用户已确认本次会话中“导入、对齐、轻量化、手动分件、骨架适配、保存导出”的方案。

## Global Constraints

- 所有改动留在底盘机器人目录；不改动父仓库其他未提交项目，不对父仓库建分支或提交。
- 保持已有品牌样式；中文操作说明；代码注释中英双语。
- 不调用混元服务、不上传文件到外部服务器。外壳本地保存与共享工程版本明确区分。
- 切割生成真正三角网格、插值 UV 与法线；切口暂不自动封闭，不标为制造模型。
- 绑定硬甲使用刚性变换；工程坐标为 X 前、Y 左、Z 上。角度预览不写入工程配置。

## Task 1 — Geometry

Files: src/lib/armor-geometry.js, tests/armor-geometry.test.mjs.

Interfaces: splitGeometry(geometry, axis, position) -> {negative, positive}; simplifyGeometry(geometry, ratio) -> Promise<BufferGeometry>; countTriangles(geometry) -> number.

- [x] 编写并运行切割面积守恒、UV 插值、材质组和越界拒绝测试，确认缺失功能失败。
- [x] 实现三角形裁切、组保留和 MeshoptSimplifier 减面；操作返回新几何，原始几何不变。
- [x] 运行模块测试，审查属性、索引及内存处理。

## Task 2 — Asset and attachment model

Files: src/lib/armor-model.js, src/lib/armor-io.js, src/lib/armor-storage.js, tests/armor-model.test.mjs.

Interfaces: jointMatrices(bodies, angles), partMatrix(part, matrices), partsBounds(parts), partsFromScene(scene, config), loadArmorGlb(buffer, config), exportArmorGlb(parts, config, maxTextureSize), saveArmorDraft(key, record), loadArmorDraft(key).

- [x] 验证关节父子变换、绑定后零姿态不跳位、父关节运动传递、工程坐标/GLB 往返和 GLB 头校验。
- [x] 实现模型导入，只接受完整 GLB，拒绝外部资源和带蒙皮/变形目标资产，配置本地 Draco 与 Meshopt 解码器。
- [x] 实现元数据往返、原始文件保存、按工程隔离的本地草稿和错误提示。

## Task 3 — Workbench

Files: src/components/ArmorWorkbench.jsx, src/components/ArmorViewport.jsx, src/components/RobotScene.jsx, src/App.jsx, src/armor.css.

- [x] 新增外观装配 tab 和参数视图导入入口；演示模型明确为程序化样件。
- [x] 接入导入/拖放、部件选择/隐藏/改名、整体比例与方向、单件尺寸/位置、切割预览与执行、减面、撤销。
- [x] 建立连杆关节层级矩阵，绑定/解绑、平移到目标连杆和关节角度预览；提供半透明骨架与切面辅助线。
- [x] 接入本地保存、恢复原始文件、GLB 导出（纹理最大尺寸可选）、移动端可用布局。

## Task 4 — Verification and delivery

- [x] npm test 与 npm run build。
- [x] 浏览器验证进入页面、导入真实 GLB 格式测试资产、切割、减面、绑定与关节运动、保存刷新恢复、导出再导入、非法文件和窄屏布局。
- [x] 更新 README，明确内腔/封口/制造校验、AI 自动分件及共享资产的边界。
- [x] 代码审查并修复发现的问题；更新生产构建并打开页面。

## Progress

- 已核实用户授权与现有接口；几何任务交给独立子任务，主任务实现 UI 和资产流程。
- Browser plugin not available；使用本机已有 Playwright 运行时进行浏览器验证。


## Completed verification — 2026-09-09

- `npm test`: 45 / 45 passed, including 20 armor geometry and asset tests; all existing project, pricing, robot, Fusion and launcher tests passed.
- `npm run build`: passed. Production assets updated; local workstation service reloaded with the existing project data preserved.
- Browser workflow on an isolated test service: GLB import, 6 → 7 real cut parts, undo, mesh reduction, rigid link binding, posed edit lock, save/reload, export/reimport, malformed input recovery and 390 px layout passed; no page errors.
- Additional textured two-material fixture: background-worker cut, UV / textures / material groups and binding roundtrip, hidden-part persistence, visible-only export, shared texture disposal, and empty-draft clearing passed.
- Real production page at port 4173: import, worker cut / reduction, binding, tab switching and GLB export / reimport passed; no page errors. Draco WASM responds with `200 application/wasm`. This smoke check intercepted project APIs to avoid modifying server projects.
- Independent review fixes: glTF axis convention, multi-material metadata restoration, mirrored winding / tangent handling, large attribute-array reduction, undo-resource cleanup, recoverable save limits, and clearing all saved parts.
- Remaining scope boundaries are documented in README and UI: open cuts, no inner shell / thickness / automatic collision checks, manual segmentation, browser-local armor persistence. The user's actual Hunyuan-generated GLB has not yet been supplied; verification used procedural and textured GLB fixtures.
