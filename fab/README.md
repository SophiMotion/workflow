# Fab科技学习 V2.5.1

网站入口：`/fab/`（跳转到 `sophilabv2.html`）。同步首页、12 篇课程文章、12 份投屏课件、任务单、教师材料、轻量离线课程包、学校方案、作品 Wiki、比赛、系统方案阅读版与下载材料；保留原教学内容。来源校验记录见 `deployment-manifest.json`。

## 三维场景资源

首页嵌入 `../worldlabstest/fab-embed.html?embed=student`。“更多”和交通实验室链接使用同一入口的完整视图（不带 embed 参数）。该入口与原项目的学生视图一致，复用仓库已有 `worldlabstest/assets`、`data` 和 `vendor` 资源，避免重复发布约 350 MB 的同一套模型。Fab 专用脚本、学生视图样式和独立场景保存键保留在 `traffic-lab/`。没有修改现有交通工作台页面。

`traffic-lab/http-compat.js` 仅在浏览器缺少 `crypto.randomUUID` 时使用 `crypto.getRandomValues` 生成 UUID，兼容 HTTP 网站。原三维脚本和第三方许可保留在 bundle 与共享模型目录中。

本页“工具”、AE、焊接、CFD 和交通地图改用同站相对地址，预览与正式网站均可使用。课程及比赛外链保留原来源；本次接入未更改或重新核实其中政策、赛事内容。作品 Wiki 为公开索引的静态展示，没有新增提交或编辑后台。

2026-10-20 同步 V2.5.1：新版首页、六类课程、10 个交互课题及 19 对象三维车队控制。`courses/` 和 `课件/` 保留课程相对链接；离线 ZIP 中的三维场景链接使用公开网站地址，下载后无需本机 4187 服务。三维模型继续复用原目录，本次只更新 Fab 专用入口、bundle 和学生视图样式。
