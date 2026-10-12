最新运行方式见 [建筑清晰度与小车运行](clarity-and-driving.md)：已接地面网格、高度采样、道路示范和跟车；下文初版的 Y=0 路线限制仅适用于没有地面网格的地图。

# 浙大地图 × Sophicar × Spark：场景装配 v2

初版：2026-10-01；默认校园更新：2026-10-02。入口：`worldlabstestv2.html`。v1 保留课程项目表达与评估入口。

## 本次实现和实际状态

- 已复用 [Sophicar 参数化建模页](https://sophicar.com/parametric-modeling) 线上真实的线控底盘生成模块、15 个原始 GLB 零件，约 20 MB。初始车架 2140 mm，整车包围盒约 1.63 × 0.83 × 2.14 m；平台宽度不等于含轮胎的整车宽度。
- 原始参数函数完整保留，只替换 React / R3F 的导入适配，输出独立 Three.js 对象。支持车架长度、平台宽度、轴距重建；其余默认配置记录在 `js/workbench-v2.js` 的 DEFAULT 中。不是实时接入 Sophicar 的登录、保存或制造下载服务。
- 可额外加入本机既有 SophiMotion / SophiStudio 概念机器人，或自有 GLB。概念机器人与 Sophicar 线上底盘是两个有区分的资产。
- Spark 2.3.0 与 Three.js 0.180.0 同一渲染器：环境 splats + 参数化车辆 meshes；SPZ / PLY / GLB 地图，本地文件与 HTTP(S) 资产地址均可。
- 地图尺度、地面偏移、轴向、平移、朝向；车辆选择、复制、移除、点选放置、参数重建；地面路径点选、回放、进度跳转；本地保存和 JSON 导入导出。
- 本地只读 API 代理已实现。独立 CLI 已完成一次图片生成，7,000 → 5,420 credits，默认地图已归档，无需 API 即可显示。详情见 [四倍校园生成记录](campus-fourfold.md)。
- **默认地图为用户参考图扩展后的概念校园，非真实浙大地理重建。**SPZ 含局部模糊、缺面与布局差异，支持参考图对照、清晰度与三个视角切换。默认底盘和机器人可独立编辑。真实校区资料和测绘尺度仍待接入。

## 启动

在 worldlabstest 目录运行：

```sh
python3 tools/worldlabs_server.py
```

按隐藏提示输入 API Key；不回显、不落盘，只存活于服务进程内。也支持既有 `WORLDLABS_API_KEY` 环境变量。打开 <http://127.0.0.1:8766/worldlabstestv2.html>。服务仅绑定本机，不用于公共部署。停止进程后密钥需重新提供。

只编辑已有本地资产，不接 API：

```sh
python3 tools/worldlabs_server.py --no-api
```

网页依赖网络加载 Three.js / Spark 模块；模型零件本身已存入本目录。不要用 `file://` 双击作为完整 3D 运行方式。

## 接入你已有的地图

1. 提供校区和地图来源。若是 Marble：粘贴世界分享 URL / World ID，点击“从 World API 读取”；若是网页端世界无法通过当前 API 查询，直接从 Marble 导出 SPZ，再点“本地 SPZ / PLY / GLB”。
2. 如果你已有的是 GLB 网格地图，直接载入即可，无需为了 Spark 再生成一个虚构校园。Spark 专门渲染 splats，GLB 由同一 Three.js 场景渲染。
3. 给地图命名；检查建筑朝向、地面、坡度、道路边界。默认不声明任何校区或测绘精度。
4. 校准尺度。GLB 默认以米解释；毫米地图可将“米 / 原始单位”设为 0.001。Marble API 资产优先读取 `semantics_metadata.metric_scale_factor`、`ground_plane_offset`，但仍要用已知长度核验。
5. 用道路宽度、建筑间距等已知尺寸和坐标基准校验，确认后勾选“已根据已知尺寸完成标定”。修改变换会清除此标记，防止沿用失效标定。
6. 选底盘 → 点选放置 / 输入 XYZ 与朝向 → 调整参数。自有 GLB 可选米或毫米；车辆对象原点取其几何最低点作为落地点。
7. 在俯视视角点选路径、回放，用于课程讲解。当前路点投影到 Y=0 平面，不贴合坡道或台阶；不计算碰撞、自动寻路、转向约束、轮速或传感器。
8. 保存到浏览器，并导出场景 JSON；把地图和自有 GLB 原文件一起归档。本地文件不会上传或嵌入 JSON，重新打开后按文件名重选即可恢复模型变换。远程 URL 可能过期，正式归档须复制资产到自己的存储。

## 坐标合同

统一场景单位米，Y 向上；车辆默认前向 −Z。Sophicar 原始几何以毫米生成，缩放 0.001 后按包围盒最低点落地；对象 scale 独立，通常保持 1。

Marble splats 的转换顺序：`p1 = raw × metric_scale_factor`，`p1.y -= ground_plane_offset`，可选绕 X 旋转 π，随后应用地图 yaw 与平移。保存的 ground offset 是旋转前的米制偏移，方向不要与最终场景中的 Y 平移混淆。GLB 默认不做 X 翻转。

v2 的 `sophi-worlds-scene` / `schema_version: 2` 记录：world（来源、文件名与变换）、objects（原始模型类型、参数与变换）、route（目标对象 ID、路点和速度）、camera。v1 的项目库 schema 1.0 仍用于案例摘要，两者用途不同，不混用导入。共享项目库后续可持有 scene manifest 的版本化引用。

## 文件与来源

- `js/workbench-v2.js`：地图、对象、路线、保存和 API 读取。
- `js/sophicar-adapter.js`：原始组件到 Three.js 的适配，几何单位转换。
- `vendor/sophicar/SkateChassis.original.js`：线上公开模块原始副本。
- `vendor/sophicar/SkateChassis.js`：仅修改依赖导入后的模块。
- `vendor/sophicar/source.json`：来源 URL、日期、SHA-256 与零件清单。
- `assets/sophicar/Linecontor/`：原始模型；按用户要求用于本地集成，不推定第三方再分发许可。
- `vendor/skatechassis/`：沿用本机已归档的概念机器人源码与来源。
- `tools/worldlabs_server.py`：静态文件 + 同源只读 API；不接受生成请求、不把密钥返回浏览器。
- `tools/worldlabs_client.py`：既有显式提交 CLI，兼容 `world_id` 与 `id` 返回字段。

## 下一阶段，按验证价值排序

1. **真实浙大场景基线**：先完成一个局部区域的导入、校区确认与两条已知距离标定，记录坐标变换和地图版本。整校区按区块切分、添加 LOD 与按视域加载，避免一次加载全分辨率 splats。
2. **案例目录**：让 SophiCar 保存参数后输出 `model.glb + vehicle.json`，包含尺寸、前向、轴距、轮距、碰撞外形、传感器挂点和版本；SophiStudio 输出 scene manifest、任务、证据与评价指标。减少对线上编译模块快照的长期依赖。
3. **场景编辑**：加入坐标 gizmo、贴地放置、碰撞网格预览、可通行区域、道路中心线、语义标注与镜头轨迹。静态场景外观和工程几何保持独立。
4. **任务验证**：课程先做参数化行为与事件回放；确需接触与碰撞时加入 Rapier 等物理层；交通流用 SUMO；车辆与传感器试验再接 CARLA / Isaac Sim。清理 collider mesh，补结构化路网，不能直接把 splats 当成物理真值。
5. **World Labs 深度开发**：把生成限制在已有测绘 / 校园地图之外的设想改造区域，保留原始区域对照；后端接媒体上传、异步 operation、失败恢复、显式预算与资产归档。当前 v2 只读代理不处理付费生成。
6. **共享部署**：账号、项目权限、对象存储、版本、任务队列和成本台账；服务器端持有密钥。当前 localhost 工具不是多用户公网后端。

## 参考资料

- [World API 入口](https://docs.worldlabs.ai/api)
- [世界列表](https://docs.worldlabs.ai/api/reference/worlds/list)（API 文档的接口索引为准）
- [渲染 SPZ 与尺度元数据](https://docs.worldlabs.ai/api/rendering-spz)
- [Spark 文档](https://sparkjs.dev/docs/)
- [交互世界示例](https://docs.worldlabs.ai/api/interactive-world-examples)
- [Sophicar 参数化建模](https://sophicar.com/parametric-modeling)
