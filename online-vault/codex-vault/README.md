# Codex 历史线程索引

更新时间：2026-06-26

本目录用于记录原 `web-valut` 和 `wechat- valut` 项目下的 Codex 历史对话索引。文件数据已经统一移动到当前项目：

- Web 资料库：`/Users/wubo/Documents/2026-2/Social media/online-vault/web-vault`
- WeChat 资料库：`/Users/wubo/Documents/2026-2/Social media/online-vault/wechat-vault`

说明：Codex 当前可读历史线程、重命名、归档、fork 或发送后续消息，但没有直接把旧线程从侧边栏旧项目重新归属到 `online-vault` 的工具。因此后续统一在当前 `online-vault` 线程沟通，本文件作为旧线程导航。

## 主线线程

### Web 书签与网页归档

- 线程 ID：`019ebc7a-635c-7241-8bc3-bfb569cd703d`
- 原 cwd：`/Users/wubo/Documents/2026-2/Social media/web-valut`
- 标题：`整理书签为MD和HTML`
- 当前数据位置：`web-vault/`

关键结果：

- 从 `bookmarks_2026_6_12.html` 整理浏览器书签。
- 1539 条原始书签合并为 1119 个唯一 URL。
- 已按 13 个主题生成 Markdown 与 HTML：社区、数字制造、交通工具、UNNC、团队管理、工具、产品分析、FabLab、autodesk、HIL、AI工具、政策、教育。
- 已生成图文资料卡、分类封面、摘要、原文链接、目录层级、标签和来源信息。
- 已抓取并保存 1119 个网页正文本地副本，抓不到正文的页面也保留本地占位、原文链接和失败原因。
- 重要入口：
  - `web-vault/md/README.md`
  - `web-vault/html/index.html`
  - `web-vault/html/WEB_PAGES_ARCHIVE.html`
  - `web-vault/web_pages_archive_manifest.csv`
  - `web-vault/archive_web_pages.py`

当前文件侧核验：

- `web-vault/web_pages_archive_manifest.csv` 为 1120 行，约等于 1119 条记录加表头。
- `web-vault/md` 与 `web-vault/html` 内包含主题索引、文章页和归档页，文件数会多于 1119。

### WeChat 收藏采集与归档

- 线程 ID：`019ef98f-e43a-7b71-bec8-4b3879a6a827`
- 原 cwd：`/Users/wubo/Documents/2026-2/Social media/wechat- valut`
- 标题：微信收藏全量采集与实时查漏
- 当前数据位置：`wechat-vault/`

关键结果：

- 目标是从微信「收藏/全部收藏」逐篇打开公众号文章，生成 Markdown 与 HTML，按同一套 13 个主题归档。
- 早期成果只有约 124 篇，范围约为 2025-12-11 到 2026-06-12；后来补强为实时采集、查漏和离线处理流水线。
- 新增实时脚本：`wechat-vault/wechat-favorites-exporter/realtime_wechat_pipeline.py`
- 新增查漏台账：
  - `wechat-vault/logs/realtime/state.json`
  - `wechat-vault/logs/realtime/visible.csv`
  - `wechat-vault/logs/realtime/events.jsonl`
- 新增/升级网页看板：
  - `wechat-vault/html/index.html`
  - 每个主题下有二级页面。
- 新增 SOP：
  - `wechat-vault/README-实时采集与查漏.md`
  - `wechat-vault/README-导出微信收藏.md`

当前文件侧核验：

- `wechat-vault/logs/realtime/state.json` 显示链接采集阶段：
  - `loaded_existing`: 367
  - `new_links`: 210
  - `collected`: 217
  - `visible`: 231
  - 最后可见记录已经到 2014-05-20。
- `wechat-vault/logs/realtime/offline_state.json` 显示离线处理阶段：
  - `processed`: 1833
  - `manifest_count`: 2200
  - `pending`: 0
  - `failed`: 0
  - `fallback`: 16
- `wechat-vault/logs/realtime/offline_failed.csv` 有 17 行，约等于 16 条 fallback/失败明细加表头。

注意事项：

- 部分状态文件里的绝对路径仍记录旧目录 `wechat- valut`，这是移动目录前写入的历史路径。后续使用时应把它映射到当前路径 `online-vault/wechat-vault`。
- 后续如继续采集，应先读取 `wechat-vault/logs/realtime/state.json`、`visible.csv`、`offline_state.json` 和 `favorites_registry.csv`，不要从头盲跑。

## 其他旧线程

### Claude 账号申诉草稿

- 线程 ID：`019f0440-67df-7d02-9a01-1bb1d111a614`
- 原 cwd：`/Users/wubo/Documents/2026-2/Social media/web-valut`
- 标题：图片线程
- 内容：根据截图写了一版 Anthropic/Claude 账号申诉英文草稿。
- 与 `online-vault` 数据主线无关，可忽略。

### Isaac 云端转本地部署评估

- 线程 ID：`019f02c3-916a-7153-b0f9-00003fc4c84e`
- 原 cwd：`/Users/wubo/Documents/2026-2/Social media/web-valut`
- 标题：`评估 Isaac 云端转本地部署`
- 内容：讨论 NVIDIA Isaac Sim 是否适合先在阿里云或算力服务器用 Docker 跑，再迁回本地服务器。
- 与 `online-vault` 数据主线无关，但可作为机器人/仿真部署参考。

## 后续沟通约定

- 以后关于 Web/WeChat/ChatGPT/Gemini 在线资料库的沟通，统一在 `online-vault` 项目下进行。
- 旧项目名拼写：
  - `web-valut` -> `online-vault/web-vault`
  - `wechat- valut` -> `online-vault/wechat-vault`
- 如需继续旧线程的上下文，先从本索引取线程 ID，再用 Codex 的线程读取工具查看历史摘要。
