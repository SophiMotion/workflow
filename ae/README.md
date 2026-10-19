# AE · Auto Engineering

SophiStudio 子项目入口：`/ae/`。指定示例：`/ae/?project=public-sophicore-wave`。

此目录完整保留 [SophiMotion/AE](https://github.com/SophiMotion/AE) 的 `docs/` 公开静态构建，来源提交见 `upstream.json`。资源使用相对路径，可部署到自定义域名或 GitHub Pages 子路径。

功能与上游公开体验版一致：浏览器草稿、模型预览、历史结果和模拟部署。真实 AI 后台、编译、硬件烧录和设备控制仍由上游本地版本提供。

更新时从上游已验证提交复制完整 `docs/`（包含示例 ZIP、worker、模型和第三方许可文件），保留本说明并重新生成 `upstream.json` 文件哈希；不要只替换 `index.html` 或引入 `foldbot-console-local.html`。然后运行 `node --test tests/ae-pages.test.mjs tests/workflow-pages.test.mjs`，在 `/ae/` 和带项目参数的入口验证后发布。
