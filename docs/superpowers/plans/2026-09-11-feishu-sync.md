# Feishu Sync Implementation Plan

**Goal:** 将可维护的飞书知识库同步工具接入 SophiStudio 工作流。
**Architecture:** 原生 HTML/CSS/JS + Python 本地 API；配置、飞书客户端、Markdown 转换、版本同步分别独立。
**Tech Stack:** Python 3.9+ 标准库、原生浏览器 API、unittest。
**Spec:** `docs/superpowers/specs/2026-09-11-feishu-sync-design.md`

## 执行步骤

- [x] 写 `feishu/tests/test_sync.py`，验证初始化、增量、冲突和失败保留；运行 `python3 -m unittest discover -s feishu/tests -v` 观察新模块缺失。
- [x] 实现 `feishu/storage.py`、`feishu/client.py`、`feishu/markdown.py`、`feishu/sync.py`。`FeishuClient.spaces()` / `nodes(space_id, parent)` 返回节点；`Exporter.export(node)` 返回 Markdown、素材和警告；`SyncEngine.run()` 返回本轮记录并持久化基线。
- [x] 实现 `feishu/server.py`：状态、配置、知识库发现、初始化、自动化、差异与冲突处理 API。为本机请求检查、私密文件隔离、持久化编写独立 API 测试。
- [x] 实现 `feishu.html`、`feishu/app.js`、`feishu/style.css`，工作流追加入口，保留用户已有工作台变更。页面从 API 获取真实状态，禁止演示数据冒充同步结果。
- [x] 提供 `feishu/start.command`、配置示例及使用文档。浏览器验证服务托管入口、主要按钮和 390px 手机布局；file:// 被内置浏览器访问策略限制，其跨域预检与本机连接密钥路径通过 API 测试验证。现有工作流回归通过。
- [x] 完成代码自审和真实鉴权探测。上级 `.env` 是示例占位值，鉴权返回 10003，现已在本地校验为未配置。真实知识库全量联调待用户在页面填写有效凭据并授权。
