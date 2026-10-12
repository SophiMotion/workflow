# SophiCAD MCP Server

本地 stdio MCP 服务。它只读取和生成 `.sophicad.zip`、URDF bundle，不启动、不点击、也不远程控制 Fusion 360。

## 构建与运行

```bash
npm install
npm run build --workspace mcp
node mcp/dist/cli.js --help
node mcp/dist/cli.js
```

在支持 stdio MCP 的客户端中，将命令配置为本机 Node.js，并把绝对路径 `<project>/mcp/dist/cli.js` 作为参数。服务不监听网络端口，不需要 API 密钥。

## 安全边界

- 输入和输出必须使用绝对路径。
- 更新包输出文件必须不存在，且不能等于输入包；不会覆盖已有文件。
- URDF 输出目录必须不存在；失败只清理本次创建的临时目录。
- 包内路径、大小、SHA-256 与 Schema 由 Core 校验；不执行包内脚本或外部命令。
- `propose_parameter_changes` 是 dry-run；只有 `create_update_package` 与 `generate_urdf` 写入新路径。

完整工具参数见 [MCP 工具说明](../docs/mcp-tools.md)。
