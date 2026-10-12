# REA 安装与证据记录

验证日期：2026-10-12（Asia/Shanghai）。

## 安装结果

已从用户指定的 Sophiteam/rea 源码副本构建 REA，项目目录：

`/Users/wubo/Documents/2026-2/sophistudio/weld/rea`

- 包内版本：`rea-agents 6.4.0`。这是所下载源码的版本声明，不等同于 npm 发布包字节身份。
- 现有运行环境：Node.js `22.22.3`、npm `10.9.8`；Node 版本符合项目 engines。未升级系统工具链。
- 依赖安装：`npm ci --ignore-scripts`，锁定依赖安装成功。
- 源码构建：`npm run build:cached`，3 个任务成功。构建过程有两条动态导入优化警告，不影响成功状态。
- CLI：`./rea/scripts/rea.mjs`（在 weld 目录运行），或 `node rea/scripts/rea.mjs`。
- Codex 注册：`/Users/wubo/.codex/config.toml`，执行源目录公开 launcher 并传入 `mcp`。
- 配置备份：`/Users/wubo/.codex/config.toml.rea.backup`。
- 技能：`/Users/wubo/.agents/skills/reverse-engineer-anything`，版本 `39`。

安装仅向 Codex 添加 REA 注册，并安装 REA 对应技能。原有配置保留。未安装 Hopper、Ghidra、IDA 或其他分析引擎。

## 验证记录

1. `rea setup --client codex --dry-run --json`：先检查精确变更路径与备份位置。
2. `rea setup --client codex --yes --json`：结果为 `ready`，应用 `configured_codex`、`installed_skill`。
3. `rea doctor --client codex --json`：所选 Codex 范围 `healthy: true`，注册与技能身份均 `aligned`；见 [rea-doctor.json](rea-doctor.json)。
4. `rea mcp doctor --json`：实际 production stdio 启动与握手成功；观察到 173 个工具、6 个 prompts；目标为空的 `binary_session` 请求成功；见 [rea-mcp-doctor.json](rea-mcp-doctor.json)。
5. 再次执行配置 dry-run：见 [rea-setup-verification.json](rea-setup-verification.json)。

`environment_healthy: false` 表示完整环境检查包含未配置的原生分析引擎与其他客户端；它不否定本次明确选择的 Codex 注册和独立 CLI 已验证可用。

Codex 当前聊天尚未自动重新加载新 MCP 注册。重连或重启后可由聊天调用；本项目可立即使用 CLI。源码目录是当前注册的安装位置，请勿移动或删除；若移动，应重新运行 scoped setup。

## 焊接项目的证据边界

用户提供了 RobotStudio 工作站截图，未提供 RobotStudio / Simufact Welding 的程序包、工程模型、许可证或可调用求解器。截图中的机器人工作站、变位机、黄色安全围栏、场景树与仿真工具布局作为交互界面重建参考。

本项目的策略开发、轨迹预览和热/力结果展示属于新建 Web 原型；未声称逆向了上述商业软件，也未声称接入真实机器人控制器或 Simufact 求解器。正式工程分析需要实际软件接口、标定热源、材料数据库和经验证的有限元模型。

REA 已用于本地原型的实际浏览器情景验证。完整 Evidence、scenario 输入和截图保存在 `docs/verification/`；详见 [浏览器验证记录](verification/rea-verification.md)。其结论只适用于实际执行过的场景。

## 可重复命令

在 weld 目录执行：

```sh
node rea/scripts/rea.mjs --version
node rea/scripts/rea.mjs doctor --client codex --json
node rea/scripts/rea.mjs mcp doctor --json
```
