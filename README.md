# SophiStudio Workflow

SophiMotion 的本地工程工具集合。打开根目录 `index.html` 进入工作流，10 张项目卡片使用各应用的真实界面截图。界面采用 Google 红、黄、绿，主蓝色为克莱因蓝 `#002FA7`；项目页统一使用 SophiStudio Logo。

导航：工作流、[SophiGo](https://sophigo.com)、[ProFabX](https://profabx.com)、[SophiMotion](https://sophicar.com)。

SkateChassis 入口位于 SophiRobot 工作台的页面导航中。

## 项目入口

| 项目 | 入口 |
| --- | --- |
| SkateChassis 机器人工作台 | `http://127.0.0.1:4173/` |
| SophiRobot 三维机器人工作台 | `http://127.0.0.1:4189/` |
| SophiCar V2 | `sophicarv2/index.html` |
| SophiCAD Bridge | `sophicar-formate/web/dist/index.html` |
| STL Quote | `stlquote/index.html` |
| CFD | `cfd/dist/index.html` |
| 交通场景实验室 | `worldlabstest/worldlabstestv2.html` |
| Mooncake 月饼定制工坊 | `mooncake/mooncake/Mooncake.html` |
| 三体漫游 | `santi/santi.html` |
| 机械臂焊接 | `weld/weld.html` |
| 点阵飞行 | `http://127.0.0.1:4188/` |

## 在线网站与本地预览

- 在线网站：[https://sophistudio.com/](https://sophistudio.com/)
- GitHub Pages 原地址：[https://sophimotion.github.io/workflow/](https://sophimotion.github.io/workflow/)（自动跳转至新域名）
- 本地预览：[http://127.0.0.1:4173/studio/index.html](http://127.0.0.1:4173/studio/index.html)

GitHub Pages 从 `main` 分支根目录自动发布；`.nojekyll` 保留各项目现有构建文件。每次修改后先构建对应子项目，再提交并推送，GitHub 会自动更新网站。线上 10 张卡片指向仓库内的静态入口，本地打开仍连接本机服务。

线上支持浏览器内的建模、仿真和文件导出。项目服务端协作、桌面 Fusion 联动及外部 API 仍需相应本机服务或用户自己的集成配置。

## 本地运行

需要 Node.js 22.12+ 和 Python 3.9+。仓库保留浏览器所需的构建文件、模型、离线资源与 Fusion 插件包。各模块的开发依赖按其锁文件安装；修改源码后在对应模块执行 `npm run build`。

macOS 可双击 `开启工作流自动启动.command`，或分别安装所需后台服务：

```sh
python3 scripts/local-services.py install --only skatechassis
python3 scripts/local-services.py install --only sophirobot
python3 scripts/local-services.py install --only drone
```

所有后台只监听本机。静态离线页面可直接打开；部分第三方库、在线集成或桌面导出功能仍需要网络、用户自己的授权及 Fusion 等桌面应用。详见 [本地服务说明](docs/local-services.md)。

原 `sophistudio/index.html#/workflow` 保持原有模块入口，引用此仓库资源。Media 位于同级的 `sophistudio/media/media/`，校园项目和已安装 Fusion 插件保留在原工作区；这些外部应用不包含在本仓库中。

## 资料与模型

知识库文章、附件、索引、招聘记录、密钥和运行状态不进入 Git。本机已有资料不受忽略规则影响，原服务仍可使用；新克隆的知识库和外部集成需要自行导入资料及配置授权。

SophiRobot 使用 `public/model.json` 进行浏览器装配预览，并保留 `source-model/Assembly testing website 4.step` 作为其 CAD 源文件。历史文件 `V2 Full assembly.step` 约 124.5 MiB，未被当前程序引用，已排除出提交；本机文件保留。

`底盘机器人/` 以普通文件快照纳入本仓库，克隆工作流不需要初始化子模块。

## 验证

根目录：`node --test tests/*.test.mjs`；本地服务配置：`python3 -m unittest discover -s tests -p 'test_*.py'`。迁移测试还会核对原工作区的外部入口，应在保留父级工作区的本机运行。子项目测试见各自 `package.json`。
