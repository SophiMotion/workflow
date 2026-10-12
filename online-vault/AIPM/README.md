# AI 产品经理本地知识库

在本机浏览器中阅读、搜索与浏览原飞书目录。已保存 **226 篇公开教材、798 张配图、42 个视频文件**，整理 **21 个原库栏目**；其中 5 个栏目已有部分正文，另外 **16 个栏目只有目录，未导入正文**。这不是飞书知识库的完整镜像。

## 打开

推荐直接打开 SophiStudio 根目录的 `index.html`，点击「工作流 → AIPM」。首次设置自动后台时，双击根目录的 `开启工作流自动启动.command`；此后 macOS 登录时自动运行，无需保留终端窗口。

也可以直接访问：

http://127.0.0.1:4174

当前项目目录为 `online-vault/AIPM`（完整路径：`/Users/wubo/Documents/2026-2/sophistudio/online-vault/AIPM`）。默认端口为 4174。未启用自动后台时，也可双击本目录的 `启动知识库.command` 或运行 `npm start`，并保留终端窗口；按 Ctrl+C 停止手动服务。需要 Node.js 18 或以上。服务仅监听 127.0.0.1。自动后台已运行时无需重复手动启动；需要另开实例时，可运行 `PORT=4175 npm start`。

已经生成好的 `site/` 可直接使用，不需要重新安装依赖或联网。阅读正文、查看配图、全文搜索均使用本机文件；点击飞书、公开项目 和正文中的外部链接仍需要网络。请通过本地服务打开，不要直接双击 index.html。

## 使用

SophiStudio「工作流 → 知识与研究 → AIPM」直接连接自动运行的本地服务。启用自动后台后，重启电脑也无需手动启动。管理与日志位置见根目录的 `docs/local-services.md`。

- 左侧目录进入栏目，首页分四部分列出 15 章课程。
- 顶部搜索框搜索中文或英文标题、主题与正文；多个关键词用空格分隔，按 Esc 退出搜索。
- 文章右侧目录可跳转小节，文末可切换上一章、下一章。
- 手机窄屏使用左上角按钮打开目录。
- 「仅目录」表示本地没有该栏目正文。收录说明页面列出实际范围、来源和版本。

## 来源与许可

目录来自用户提供的「两光年的 AI 产品经理知识库」：
https://rcnjy4vfjycy.feishu.cn/wiki/D2xDww7ROigma0kroY1c1Zkan7d

正文来自与原库目录相对应的五个公开项目（Datawhale 与 Gitconomy），采用固定版本并保留署名与许可：

| 项目 | 正文 | 图片 | 视频 | 许可 | 固定版本 |
|---|---:|---:|---:|---|---|
| Hello-Agents | 15 章 | 205 | 0 | CC BY-NC-SA 4.0 | `5caceca4e4c9a3d25cd14627881436953f4d6912` |
| All-in-RAG | 28 篇 | 60 | 0 | CC BY-NC-SA 4.0 | `583a61b09869bc3afc4552289171f6ec188f2c76` |
| Happy-LLM | 7 章 | 50 | 0 | CC BY-NC-SA 4.0 | `1e0b3a1e6f8936b8ba4bbd0673e8e2227d196c96` |
| Every-Embodied | 160 篇 | 423 | 42 | CC BY 4.0 | `a282b23edb17a776f02b7e23342155dfd57423c2` |
| Git4GenThinking 智能体工程 | 16 章 | 60 | 0 | CC BY-SA 4.0 | `e5896e81d25eab71a39a6a78bb09e3a222aaa3e1` |

Hello-Agents 作者为陈思州、孙韬及项目贡献者；All-in-RAG 为 dalvqw 及贡献者；Happy-LLM 为宋志学、邹雨衡及贡献者；Every-Embodied 的各文作者署名保留在正文中。Git4GenThinking 智能体工程作者为 Gitconomy Research · 郭晧及课程贡献者，采用课程内容的 CC BY-SA 4.0，不以仓库根目录的 MIT 代替课程许可。原始 README、许可证和逐篇来源清单保存在各 `content/项目名/` 目录；站点的「来源与收录说明」可打开各项目许可。

Happy-LLM 的七个飞书章节链接已逐项核实，并抽查第一章开头。Every-Embodied 的前十二个分组与飞书目录一致，抽查了「机器人发展历史与背景」。采用公开仓库当前固定版本，可能包含飞书副本之后的更新；没有逐篇逐字比对，不代表飞书原件的完整镜像。

收录范围：All-in-RAG 主教程和环境部署补充，排除规划第十章及 Extra-chapter；Happy-LLM 前七章；Every-Embodied 第 01–12 组的教程，排除代码维护说明、面试草稿及第 13 组以后扩展。正文引用的完整代码项目、数据集、其他网页和附件不等于已经本地保存。

Every-Embodied 有 **53 个外部图片引用无法取得**（HTTP 400 或 403），正文中显示缺失提示。仓库内的 44 个视频引用已去重保存为 **42 个文件**，可在本地播放或通过正文链接打开。其余栏目尚未取得可完整收录的同源材料；原库文章总数未知，不能计算全库迁移完成率。

智能体工程四个阶段共 16 章的飞书链接已逐项核实，第一章开头与原课程匹配；未逐字比对全部正文。保存完整章节 Markdown 与 60 张仓库内配图，外部视频、音频、完整实验程序和附件不计入已迁移范围。一处原稿图片路径笔误通过映射修正，原始 Markdown 保留。

进行了 Markdown 转 HTML、排版、公式与代码渲染、图片与视频本地化、内部链接调整。未修改飞书文档、权限或下载设置。

## 文件与维护

- `content/catalog.json`：原库栏目、15 章对应飞书链接和主题别名。
- `content/hello-agents/`、`content/all-in-rag/`、`content/happy-llm/`、`content/every-embodied/`、`content/git4gen-agent-engineering/`：教材 Markdown、原始许可、配图及来源清单。
- `content/public-collections.json`：已核实的其他公开原始教材项目配置。
- `content/feishu/migration-ledger.json`：原库盘点、34 个尚无本地正文的文章链接及访问阻碍。
- `site/`：可运行的静态站点、文章、配图、搜索索引及本地字体。
- `scripts/import_public.py`：Hello-Agents 导入器。
- `python3 scripts/import_collection.py all-in-rag`：All-in-RAG 导入；断点续传、固定版本、图片去重。其他项目可使用同样命令更换项目 ID；随后运行 `python3 scripts/import_media.py every-embodied` 保存仓库内视频。导入需要 Python 3、Node.js、curl 和网络。
- `python3 scripts/import_git_collection.py . /path/to/pinned/git/checkout git4gen-agent-engineering`：从已核实的固定 Git 版本读取章节与配图，校验远程来源、版本和逐章许可；不执行源项目程序。
- `scripts/build.mjs`：从已保存内容构建网站，使用 marked、sanitize-html、KaTeX 和 highlight.js。
- `docs/migration-report.md`：验收记录及未完成范围。

重新构建（依赖已安装时无须联网）：

```sh
npm ci
npm run build
npm test
npm start
```

`npm ci` 仅在依赖未安装或需要重装时运行。新增内容时应同时更新正文文件、来源、许可和清单；不能只增加目录名称就计为已导入文章。
