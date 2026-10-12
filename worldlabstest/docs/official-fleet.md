# 交通场景实验室 · 多车与参考图试验车

2026-10-12 更新。当前项目位于 `sophistudio/workflow/worldlabstest`。最新修复与验证见 [道路、避碰与视频车辆更新](traffic-update-20261012.md)。

## 使用

打开 `worldlabstestv2.html`。点击「组建六车车队」可为六车重新分配六条不同路线，「全部运行」启动全部已分配路线的车辆。点击车队中的车型名称可近看；下方路线、速度、播放、暂停仅控制所选车辆。可选校园平路、赛车环道、综合测试路，也可以点选自定义路径。保存、导出会保留每辆车的路线和进度，重新打开时全部暂停。

初次升级会自动配置六车路线，并把原场景保存为浏览器备份 `sophi-worlds-composition-v2-before-official-fleet`。组建车队会重设这六类车型的示范路线，不删除自有对象。

## 模型

- Sophicar 线控底盘：现有官网参数化零件；保留长度、宽度、轴距编辑。
- SophiFusion、导航小车、教育小车：从 Sophicar 官网公开的生成组件和零件，在官网默认参数下生成 GLB，统一米制和前向。
- SophiCore 轮式机器人：从公开 `model.json` 的 506 个零件转换，完整静态装配姿态；合并为 8 个网格批次，保留两个驱动轮的旋转轴。
- **Sophi 开放式智能试验车**：按用户图片和视频进行程序化几何重建；深蓝框架、开放座舱、四座、玻璃、雷达与摄像头、灯带、四个带胎纹的车轮和悬架外观。尺寸为设计假设，成品包围范围约 **长 3.79 × 宽 2.04 × 高 2.41 米**。未从图片获得 CAD 或测量数据，未重建图中人物。
- 官网当前“轮边小车”组件只返回红色占位方块，未冒充完整车型加入车队。

新增五个 GLB 均在 `assets/fleet/`；图片试验车为 `reference-rover-video.glb`。可直接用 Three.js `GLTFLoader` 加载。其生成器为 `js/reference-rover.js`，导出 `buildReferenceRover()`，原点在路面，Y 向上，车头朝 -Z。车轮节点的 `userData.rollingRadius` 用于按行驶距离旋转。

来源：
- https://www.sophicar.com/parametric-modeling
- https://sophimotion.github.io/sophicore-robot-cle/

模块名称、下载时间、尺寸、顶点数和 SHA-256 记录在 `vendor/fleet/sources.json`。原始模型组件、零件、压缩的机器人几何保存在 `vendor/fleet/source/`，供本地复现；不据此主张第三方再分发许可。

## 技术范围

Three.js 负责车辆网格、校园道路和动画；Spark 保留 Marble 原始参考层。每辆车拥有独立路线、距离、速度、循环和暂停状态。新增车型按行驶距离驱动车轮；线控底盘目前整体沿路径移动。测试路根据轴距取前后轮接触高度，调整车身俯仰。

这是运动学路径演示，没有轮胎力、转向机构、独立悬架解算、传感器数据或车辆硬件控制。SophiCore 上身关节保持静态。已加入车辆之间的减速、让行与扫掠包围框避碰；自定义路径仍需避开建筑。校园尺度和参考图车辆均非实测。

静态模型按材质合并，未做几何减面。四款官网新增资产共约 41.5 MB；视频优化试验车约 3.52 MB / 29 个网格绘制批次（另有运行时接地阴影）。HTTP 预览及文件直开统一使用本地 Three.js / Spark 打包脚本，减少 CDN 和模块缓存影响；文件直开资产通过本地脚本包读取。

## 复建与验证

`node tools/rebuild-fleet.mjs` 从本地归档重新生成五个 GLB；随后用可用的 esbuild 运行 `node tools/build_offline.mjs`，或通过 `ESBUILD` 指定可执行文件路径。

`node --test tests/*.test.mjs` 验证道路平整、路径采样、独立车速与暂停、循环越界、终点停止、导入校验和本地资源。渲染检查与截图见同目录的测试记录。
