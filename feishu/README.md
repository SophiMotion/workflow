# 飞书知识库自动化

入口：SophiStudio → 工作流 → 飞书知识库自动化，或打开 `feishu/feishu.html`。

## 启动

在 SophiStudio 目录执行：

```sh
python3 feishu/server.py
```

macOS 推荐在 Finder 中双击 `feishu/start.command`：自动启动或复用后台，确认服务就绪后在 **Microsoft Edge** 打开页面，随后可以关闭终端窗口。同步和文档阅读只需 Python 3.9 及以上；模型问答还需要 Node.js 22.21 及以上版本和依赖：在 `feishu` 目录执行 `npm ci --ignore-scripts`。

要在打开 HTML 时直接使用，先双击一次 `feishu/开启登录启动.command`。它会安装当前用户的 macOS 登录后台；登录 Mac 后自动启动，进程退出后自动恢复。之后直接在 Edge 打开 `feishu/feishu.html` 即可，不需要先打开终端。HTML 本身不能执行 Python，后台由 macOS 启动。登录时不会自动弹出浏览器。

如需取消，双击 `feishu/关闭登录启动.command`；同步运行时会提示等待本轮结束，以保护正在写入的文档。取消后保留文档与配置，仍可用 `start.command` 手动启动。

登录项位于 `~/Library/LaunchAgents/com.sophistudio.feishu.plist`，日志位于 `feishu/.state/launchagent.log`，配置中不含飞书密钥。若已有服务正在运行，登录后台会等待其退出后接管。移动项目目录后，需要先关闭旧登录启动，再在新目录重新开启。macOS 若要求访问“文稿”目录，需要允许本工具的 Python 进程访问项目所在目录。

如果日志提示 `Operation not permitted` 且系统“文件与文件夹”中没有 Python，可在明确同意扩大访问范围后，在“隐私与安全性 → 完全磁盘访问权限”中添加后台使用的 `Python.app`。完全磁盘访问也会影响通过此 Python 运行的其他脚本；本工具不会自动修改这项系统权限。关闭登录启动不会撤销它，如不再需要，请在系统设置中手动关闭 Python 的权限。

工作流中的飞书卡片直接指向 `http://127.0.0.1:8769/feishu/feishu.html`，从其他工具托管的 `/studio/` 页面进入时也使用同一后台地址。

打开 <http://127.0.0.1:8769/feishu/feishu.html>，或 `file:///Users/wubo/Documents/2026-2/sophistudio/feishu/feishu.html`。`file://` 页面读取服务生成的本机连接文件并访问本地 API；浏览器如限制本地网络访问，请使用 HTTP 入口。

旧的根目录 `feishu.html` 和 HTTP `/feishu.html` 入口会自动跳转到新页面。页面脚本、样式与本机连接文件均位于 `feishu/`，返回工作流的链接指向上级 `index.html#/workflow`。

1. 点击“知识库 ID 管理”，可添加 ID 或飞书链接、填写可选名称，并在列表中删除 ID；点击“保存配置”生效。同一面板下方填写真实的企业自建应用 App ID、App Secret，保存并检查连接。
2. 选择“全部可访问的知识库”，或取消该选项，按链接/数字 space_id 添加指定知识库。
3. 点击“初始化”，递归、分页下载整个知识库；可重复执行，会先比较本地内容。
4. 完成首次初始化后点击“自动化”。默认每 5 分钟检查，也可以设为每 1 / 15 / 30 分钟、每小时。

知识库链接会解析为其所属的**整个知识空间**，不是只下载该链接下面的子树。数字 space_id 可直接保存，首次同步时检查权限。移除知识库只是从后续同步范围移除，已经下载的文件仍会保留；启用“全部可访问”时列表只是维护清单，不限制范围。

选择仅同步 ID 列表时，可以删除最后一个 ID 并保存为空列表，此时自动化会暂停；之后添加 ID 再重新开启。重复 ID 会在页面提示，不会添加重复条目。

自动化由本地进程执行，关闭网页后继续；退出登录、关机或休眠时暂停。开关和间隔持久化，重新启动服务会恢复。点击“暂停自动化”会停止后续轮询，当前正在执行的一轮继续完成。登录启动只负责后台运行，是否定时下载仍由页面中的“自动化”开关控制。

## 凭据和飞书权限

读取顺序（后者优先）：上级 `2026/.env` → 项目 `.env` → 项目 `config/feishu.env` → 环境变量。

```dotenv
FEISHU_APP_ID=企业自建应用的真实AppID
FEISHU_APP_SECRET=企业自建应用的真实AppSecret
```

页面填写的新凭据写入 `config/feishu.env`（文件权限 0600，已忽略 Git），不回显 Secret，不放入 localStorage，不传给除飞书官方鉴权接口外的远端服务。示例占位值会被识别为未配置。环境变量优先级最高；如已经设置环境变量，修改后需重启服务。

在[飞书开发者后台](https://open.feishu.cn/app)创建企业自建应用，启用机器人能力，开通只读权限并发布版本，同时将应用/机器人加入目标知识库成员。仅开 API 权限并不自动获得文档访问权。

| 内容 | 所需权限 |
| --- | --- |
| 知识空间与节点 | `wiki:wiki:readonly` |
| 新版文档 | `docx:document:readonly` |
| 图片与文档附件 | `docs:document.media:download` |
| 旧版文档（按需） | `docs:doc:readonly` |
| 电子表格（按需） | `sheets:spreadsheet:readonly`，或 API 调试台列出的对应读取权限 |
| 多维表格（按需） | `bitable:app:readonly` |
| 云空间原始文件（按需） | API 调试台列出的文件下载权限，例如 `drive:file:download` |

服务显示飞书返回的错误码和错误信息。权限名称可能随开放平台调整，以相应 API 的当前权限配置为准。`10003 / invalid param` 出现在令牌接口时，应先检查应用凭据；知识库列表为空时，应检查机器人是否被添加为知识库成员、应用是否已发布。自动化使用可续期的应用 tenant_access_token。

“保存并检查连接”会分别检查自动发现列表和每个已保存 ID 的名称、目录读取权限。自动发现为 0 不代表所有指定 ID 都无法读取；若某个 ID 检查通过但未被自动发现，取消勾选“全部知识库”并保存即可按 ID 同步。检查结果不保证所有正文和附件都有读取权限，具体文档的错误会在同步时显示。`131006 / wiki space permission denied` 表示应用缺少对应知识库的成员访问权限，重新填写同一个 ID 无法解决。

新版文档正文使用 `document_revision_id=-1` 读取最新内容，避免显式版本查询触发历史版本的编辑权限要求。分页读取完成后再次校验版本号；若期间发生修改，本轮保留已有本地文件并在后续同步重试。

## 本地文件与版本模型

```text
sophistudio/
  online-vault/
    feishu-vault/           # Markdown、原始文件、图片附件
      知识库名--稳定标识/
        页面名--稳定标识/
          index.md
          assets/内容哈希.png
          子页面名--稳定标识/index.md
  feishu/
    feishu.html            # 页面入口，代码与资源都在此目录
    .state/                # 私有状态，不通过 HTTP 公开
      manifest.json        # 每个节点的基线与当前状态
      objects/<sha256>.md  # 不可变 Markdown 快照
      history.json         # 最近 100 轮完整变化记录
      resolutions/         # 冲突决策及本地旧版本快照标识
    local-connection.js    # file:// 页面专用连接密钥，不通过 HTTP 公开
```

这是类似 Git 的“首次拉取 / 增量拉取 / 状态 / diff / 冲突”模型，**不创建或操作项目的 Git 仓库，不上传本地修改到飞书**。

- 新版文档检查 revision_id；其他节点比较更新时间和标识。文档未变化时不重新下载内容块。表格与嵌入表格每轮读取，防止遗漏独立变动。
- SHA-256 比较本地、上次基线、最新飞书内容。只有本地没有编辑时才自动写入新版本。
- 本地与飞书同时变化时标记冲突。点击“查看差异 / 处理冲突”，选择保留本地或采用飞书版本；操作前会备份本地内容。
- 云端不可见可能是删除或权限变化，因此只标记并保留本地。不会自动清空目录或删除无法确认的文件。
- 一个文档失败不会中断其他文档；节点扫描失败时不会把该知识库的其他节点判定为已删除。重复初始化可重试失败内容。
- 文件与图片内容以哈希命名，历史素材保留。文档层级调整后，已经无用的旧素材目录不会自动清理。
- `feishu/.state` 与 `online-vault/feishu-vault` 均已忽略 Git；需要迁移、备份或恢复时，请同时备份两个目录。历史 Markdown 可在 `.state/objects` 中按对应哈希找回，当前没有一键回滚界面。

当前 Markdown 与素材目录为 `/Users/wubo/Documents/2026-2/sophistudio/online-vault/feishu-vault`。2026-09-13 已将原 `feishu/vault` 的完整内容迁入，保留原文档层级和相对附件路径；`.state` 留在原处，版本记录无需重建。同步写入、文档阅读和问答检索共用新目录。

## 支持范围与保真度

新版文档支持标题、富文本、列表、待办、引用、代码、公式、表格、图片和附件；嵌入电子表格/多维表格会尝试转换。没有列和单元格的空表格保留占位说明，不影响其余正文下载。电子表格保存单元格显示值，多维表格保存数据表、字段与记录。图片和附件最大单个 100 MB。

旧版文档采用纯文本降级，Markdown 中会明确说明格式损失。画板、思维笔记、任务、第三方嵌入等不能完整表示的块保留结构数据并显示导出提示；文件节点保留 Markdown 入口及原始二进制。不同类型的复杂视觉布局、合并单元格、评论、公式计算关系、权限配置等无法无损转成 Markdown。不能完整导出的内容不会标成“无提示成功”。

## 阅读与专业问答

点击文档标题可阅读当前本地 Markdown，切换原始文本、下载 Markdown、载入已下载图片和下载附件。原文不会作为静态目录公开；阅读与附件均通过本机鉴权 API。远程图片不会自动加载，HTML 会经 DOMPurify 清理。阅读上限为单文档 4 MB、单附件 100 MB。

在“问问知识库”填写项目名称和具体问题，选择知识库范围。“先看检索依据”只运行本地检索，不调用模型。“获取专业建议”将问题和命中的片段送入三阶段流程：

1. OpenAI 分析国际工程实践、跨市场应用等维度。
2. DeepSeek 同时分析中国落地、供应链、成本等维度。
3. 两路均成功后，DeepSeek 对照原文综合，保留分歧并给出实施建议。

编排使用官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 `@deepseek-ai/dsh-llm` 与 `@deepseek-ai/dsh-llm-deepseek` 核心组件（版本锁定于 package-lock），OpenAI Responses 适配器在同一 LLM 服务中注册。该流程没有挂载代码执行、文件编辑或网页工具，不运行完整编程代理。国际/国内是任务维度，不代表模型固有立场。

“模型设置”可维护模型名和 API Key，并检查已保存的官方接口连接。默认 OpenAI `gpt-5.4`、DeepSeek `deepseek-v4-pro`。连接检查不产生文本生成费用，但不保证账户余额或所有生成请求都可用。ChatGPT 网页订阅不包含 OpenAI API 额度。

凭据依次读取：现有 `~/.dsh/.credentials.yaml` 的两个命名密钥 → `2026/.env` → 项目 `.env` → `config/feishu-ai.env` → 后台环境变量。示例占位值会跳过。页面保存文件权限为 0600，密钥不回传前端；留空保留。`OPENAI_MODEL`、`DEEPSEEK_MODEL` 可在独立配置中维护。模型地址固定为 `api.openai.com` 和 `api.deepseek.com`，不会使用继承配置中的替代 API 地址。Node 进程继承这台 Mac 已有的 HTTP/HTTPS 系统代理并启用 `NODE_USE_ENV_PROXY`，用于保持与 Python 一致的网络连通；不修改系统网络设置。

问答每次独立检索，历史问题不会自动作为新问题的上下文。SQLite FTS5 本地中英文词项检索随文件变化更新，最多选 10 个片段 / 16,000 字符，同一文档最多 3 段；当前不是语义向量检索。只索引可读的当前本地正文，排除云端不可见、导出失败和超限文档。图片、原始二进制附件、画板内容未做 OCR 或视觉理解；复杂内容的导出提示会传入模型。没有命中时不调用模型。

答案中的 `[S1]` 可打开对应原文、引用片段和行号。证据记录保存内容指纹；原文后来变化时会提示。引用检查只判断编号存在，不能自动验证模型的结论。当前无联网检索，标准、法规和价格的新近变化需另行核实。所有片段只来自选定本地范围，模型常识和推断须与知识库事实区分。

关闭页面不停止当前问答，可刷新恢复；“取消回答”结束模型子进程，已经发生的 API 用量仍计费。任一路失败不生成双模型综合答案，保留已完成的单路结果。后台重启后未完成任务标记中断，不自动重发付费请求。最近 20 次问答（包括引用原文与回答）保存在私有 `feishu/.state/consultations.json`，检索索引为 `knowledge.sqlite3`。这些文件与 `config/feishu-ai.env` 均忽略 Git。

## 验证

```sh
python3 -m unittest discover -s feishu/tests -v
node --test tests/workflow-index.test.mjs
node --check feishu/app.js
node --check feishu/knowledge.js
node --test feishu/tests/harness.test.mjs
```

Python 测试使用临时目录和模拟飞书数据，HTTP 测试只监听临时本机端口。覆盖同步、正文和附件边界、检索与增量索引、凭据覆盖、任务取消/中断、本机鉴权与私密文件隔离。Harness 测试通过真实核心组件路由模拟供应商响应，覆盖三阶段成功与部分失败，不产生模型费用。真实双模型验证仍需两个账户的有效 API 凭据和额度。

官方接口参考：[知识空间列表](https://open.feishu.cn/document/server-docs/docs/wiki-v2/space/list)、[子节点列表](https://open.feishu.cn/document/server-docs/docs/wiki-v2/space-node/list)、[文档内容块](https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/list)、[下载素材](https://open.feishu.cn/document/server-docs/docs/drive-v1/media/download)、[电子表格读取](https://open.feishu.cn/document/server-docs/docs/sheets-v3/data-operation/reading-a-single-range)、[多维表格记录](https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/list)。
