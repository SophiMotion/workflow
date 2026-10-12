# Finder 直接打开工作流

完成一次自动启动设置后，在 Finder 双击根目录 `index.html`，再点击“工作流”即可使用现有工具。无需打开 Codex、启动预览或保留终端窗口。Mac 登录后由 launchd 启动服务，服务意外退出时会自动恢复；登录时不会自动打开浏览器。

首次设置或移动目录后，双击 `开启工作流自动启动.command`。关闭后台用 `关闭工作流自动启动.command`，不会删除项目文件和数据。HTML 本身不能启动本机进程，因此请保留 macOS 的后台运行许可。

| 工具 | 本机入口 | 自动启动名称 |
| --- | --- | --- |
| AIPM | http://127.0.0.1:4174/ | aipm |
| 点阵飞行 | http://127.0.0.1:4188/ | drone |
| SophiRobot | http://127.0.0.1:4189/ | sophirobot |
| SkateChassis | http://127.0.0.1:4173/ | skatechassis |
| SophiCAD | http://127.0.0.1:4173/studio/sophicar-formate/web/dist/index.html | 使用 SkateChassis 的静态文件服务 |
| Want 招聘 | http://127.0.0.1:8770/want.html | want |
| 飞书知识库 | http://127.0.0.1:8769/feishu/feishu.html | feishu |
| 内容工作台 | http://127.0.0.1:8741/ | media |

Want 的实际文件现位于 `boss/boss-1/want/`。设置脚本会安全迁移本项目的旧 Want 登录项。内容工作台使用本地执行服务，保留原静态页面；浏览器的 file:// 与 HTTP 存储相互独立，如原页面保存过创作配置，可使用页面的导出/导入 JSON 迁移。

其他已完成的静态工具继续通过本地文件打开。Paper、STL → F3D 和声音模块仍为规划项。AI 执行需要已有账号登录，飞书同步需要已配置的授权，Fusion 建模需要 Fusion 及相应插件；自动启动不替代这些依赖，也不会主动执行创作、招聘评估或发送消息。

所有后台只监听 `127.0.0.1`，未部署到 GitHub 或公网。登录项在 `~/Library/LaunchAgents/com.sophistudio.<名称>.plist`，日志在 `~/Library/Logs/SophiStudio/<名称>.log`。

可单独管理一个工具：

```sh
/usr/bin/python3 scripts/local-services.py install --only media
/usr/bin/python3 scripts/local-services.py disable --only media
```

需要 Node.js（SophiRobot 建议 22.12 或更新版本）和 Python 3.9 或更新版本。端口被其他程序占用时会报告冲突，不会结束其他进程。若 macOS 提示访问“文稿”目录，需允许相应 Node/Python 访问项目目录。更换电脑、移动项目、删除后台项或禁止后台运行后，需重新运行开启脚本。

## 2026-10-12 目录迁移

工作流根目录为 `sophistudio/workflow/`。直接打开该目录的 `index.html` 即可进入工作流；原 `sophistudio/index.html` 共用此处资源。Media 服务仍从 `sophistudio/media/media/` 启动。既有端口不变，配置与数据随各模块目录一起移动；未创建备份。
