> 2026-10-03：`worldlabstestv2.html` 已支持直接双击打开，校园、车辆和原始 Marble 地图使用本地资源，无需先启动服务。请保留完整项目文件夹。见[直开说明](docs/direct-open.md)。

> 2026-10-02 最新场景：参考原图改为灰色沥青道路，增加至 11 栋主要建筑、51 处花坛，并加入接驳车、配送车、机器人、骑行者及人物。见[本次场景说明](docs/campus-street-life.md)。

> 2026-10-02 扩展版：基于用户校园参考图增加操场、湖泊、赛车环道和四种路面测试道路。见[扩展校园使用说明](docs/expanded-campus.md)。

> 2026-10-02：默认工作场景已重建为完整、平整的蓝色路网，Marble 原始世界保留为独立参考。详见[路网说明](docs/flat-road.md)。

2026-10-02 更新：默认使用 192 万点精细地图，已加入贴地道路示范、播放/暂停、调速、循环和跟车。详见 [建筑清晰度与小车运行](docs/clarity-and-driving.md)。

# Sophi Worlds / worldlabstest

2026-10-02 已完成：用户图片 → 四倍占地扩展图 → 实际 Marble 世界 → 默认 Spark 场景。详情见 [本次生成记录](docs/campus-fourfold.md)。

现在有两个入口：

- `worldlabstestv2.html`：真实 Sophicar 底盘 + Spark 地图装配、坐标校准、路径回放、场景归档。
- `worldlabstestv1.html`：课程项目表达、评估与项目库原型，顶部已链接到 v2。

## v2 快速启动

直接双击 `worldlabstestv2.html`，打开后点击「小车运行」。保留同目录的 `js/`、`assets/` 等项目文件夹，不要单独移动 HTML。

需要本机 API 查询或继续使用 HTTP 预览时，也可运行：

```sh
python3 tools/worldlabs_server.py --no-api
```

默认本地资产无需 API Key，打开 <http://127.0.0.1:8766/worldlabstestv2.html>。

直接双击模式使用已打包的本地三维资源，需要支持 WebGL2 的浏览器；校园查看和车辆运行不依赖服务或网络。HTTP 模式的三维依赖仍使用网络加载；不使用 API 时执行 `python3 tools/worldlabs_server.py --no-api`。远程 World Labs 查询需要本机服务，网页不接收或保存密钥。

已接入 Sophicar 线上原始底盘模型。默认地图为依据图片生成的概念校园，非真实浙大测绘。2026-10-02 使用 marble-1.1 生成一次，消耗 1,580 credits，生成后余额 5,420 credits。SPZ、碰撞网格和来源记录已本地归档。

详见 [场景装配与后续开发](docs/scene-composition.md)。可导入 `data/scene-starter.json` 恢复已验证的底盘 + 机器人初始装配。场景 JSON 不包含本地地图和自有 GLB 原文件；重新打开时需重选同名文件。路径播放是运动演示，不是物理或避障仿真。

---

# v1 说明（保留）

入口：`worldlabstestv1.html`。

为未来校园移动体课程制作的本地项目表达原型，同时预留 Sophicar / SophiStudio 案例与仿真接入。默认课程案例已关联本次 Marble 世界；v1 的二维任务动画仍为逻辑示意。

## 打开

在本目录执行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8765/worldlabstestv1.html>。本地图片与普通交互也可以直接双击 HTML；真实 3D 依赖 HTTP 服务、网络与 WebGL2。3D 模块按需从 Spark / jsDelivr 官方地址加载。

如需原课程页和 SophiStudio 相对链接可同时访问，在上一层 sophistudio 目录启动服务，打开 `/worldlabstest/worldlabstestv1.html`。

## 已有功能

- 三类课程任务、播放/暂停/重置、拖动进度、路口阻挡与解除。
- 场景热点、项目表达评估、开发路线与官方资料。
- 项目搜索、来源筛选、新增、JSON 导入导出（schema_version 1.0）。
- 同 ID 导入时保留现有记录，提示跳过数量；修改须编辑归档 JSON 并使用新 ID。
- 保存 Marble 分享链接；导入 HTTPS SPZ/PLY 或浏览器本地 SPZ/PLY，在 Spark 中旋转、平移、缩放与重置。
- 原始 Marble 资产的尺度/地面/轴转换入口。默认 1/0 仅为查看值，不是标定。

项目元信息存在当前浏览器 localStorage。新增、关联后请导出 JSON 归档；未建立后端或团队同步。本地 SPZ 只由浏览器读取，不上传，也不会嵌入导出 JSON，重新打开时需要再次选择文件。切换项目时释放 3D 资源。

## 第一次使用 World Labs

1. 打开 <https://marble.worldlabs.ai/>；账号与套餐由使用者自行完成。
2. 在 Marble 用 `prompts/campus-transfer.txt` 做一个交接区草稿。它生成全尺寸、无车辆的概念环境；现有 `assets/campus-concept.png` 是沙盘式 AI 图，适合另一类表达试验，不是 360° 全景。
3. 检查空间连续性、路面、交接点与镜头。按账号权限导出低分辨率 SPZ；先不要把高精度 mesh 当成工程 CAD。
4. 在页面“接入 World Labs”中保存分享链接，或加载 SPZ 资产。
5. 后续导入独立车辆、标定道路，再开发行为/仿真层。现阶段 3D 查看模式会关闭未经标定的二维任务回放。

## API 起步工具

`tools/worldlabs_client.py` 仅用 Python 3 标准库。先预览请求，不联网也不收费：

```sh
python3 tools/worldlabs_client.py --request data/world-request.json
```

如选择 API 路线，先在 <https://platform.worldlabs.ai/> 配置额度并生成密钥。将 `WORLDLABS_API_KEY` 设为本机环境变量，避免写入 HTML、JSON、截图或仓库。网页订阅额度不等于 API 额度。

以下为**用户后续手动执行的另一种付费生成命令**；本次图片作业使用 worldlabs_image_job.py，详见生成记录：

```sh
python3 tools/worldlabs_client.py --request data/world-request.json --submit --out runs/campus-draft-01
```

命令只提交一次并保存 `operation.json`。输出目录必须是新目录，防止覆盖旧作业。恢复查询时复用已有 operation ID：

```sh
python3 tools/worldlabs_client.py --operation YOUR_OPERATION_ID --out runs/campus-draft-01
python3 tools/worldlabs_client.py --world YOUR_WORLD_ID --out runs/campus-existing
python3 tools/worldlabs_client.py --credits
```

可加 `--wait-seconds 300` 在一个终端命令内轮询。超时不会重新提交。成功后保存完整 `world.json` 和 `project-import.json`，后者可以导入页面。工具不会自动下载大文件、创建 HQ mesh 或开启自动充值。提交网络超时须先查控制台，不要盲目重试付费 POST。

## 文件说明

- `worldlabstestv1.html`：界面、样式、项目库与交互。
- `assets/campus-concept.png`：沿用课程 AI 概念图，非真实校园/学生成果/World Labs 输出。
- `docs/assessment-and-development.md`：完整评估、架构、数据合同、试验与预算。
- `docs/design.md` / `interface-concept.png`：页面视觉设计与实现边界。
- `prompts/campus-transfer.txt`：全尺寸交接区生成提示词。
- `data/world-request.json`：显式选择 draft 的文本生成请求。
- `data/project-template.json`：项目导入模板。
- `tools/worldlabs_client.py`：提交、查询、恢复与清单导出。
- `docs/verification.md`：本次检查和未验证项。

## 后续开发

先做一个真实世界 + 一辆独立车辆 + 一个任务。再建立服务端作业队列、对象存储、权限和版本。只有需要交通流/传感/动力学结论时，才引入对应引擎。完整路线见开发文档。

本地概念原型不是数字孪生、自动驾驶测试平台或生产案例库。当前未集成 Sophicar API、Mosaico、ROS、CARLA、SUMO 或 Isaac Sim，也未修改线上站点。
