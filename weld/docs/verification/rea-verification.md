# REA 浏览器验证

2026-10-12，目标：`http://127.0.0.1:8765/weld.html`。

所有下列浏览器证据由安装的 REA 公开 CLI `capture-browser-scenario` 产生。REA 启动独立临时 Chrome 配置，完成后关闭自己启动的浏览器。浏览器为 Chromium `155.0.8059.39`。首次在工具沙盒中启动失败，允许启动本机 Chrome 后成功；未修改产品以规避失败。

## 最终界面

| 场景 | Evidence ID | 完整证据 | 截图 |
|---|---|---|---|
| 桌面 1600 × 1000 | `ev_eda66ee1863f3f1055fc46dfc03d0a7a47b18a1f2410c29b5f00943b2a8749b0` | [JSON](rea-final-desktop-evidence.json) | [PNG](rea-desktop.png) |
| 手机 390 × 844 | `ev_a2bd726fa1072761a0a9e0e75005e3ada6ac0cd51b8af55793cddd691cbf9e64` | [JSON](rea-portrait-mobile-evidence.json) | [PNG](rea-mobile.png) |
| 运行、播放、暂停、温度结果 | `ev_7d2959ac7c29a5aee7ee8773977b2e4f9153295218ff373bc29e1f96da7ece4c` | [JSON](rea-final-analysis-evidence.json) | [PNG](rea-analysis.png) |

以上三个场景中，所有步骤 `completed`，请求的捕获内容 `complete`。观察窗口内无 console 或 page-error 事件，`events.dropped = 0`。初次版本发现的 favicon 404 已修复，上表为修正后的捕获。

直接观察到桌面与手机均有可见三维 canvas。截图可辨识机器人、工件、工装、气瓶和黄色围栏；温度结果截图显示工件着色和图例，底部显示数值结果与来源说明。手机宽度下侧边栏收起，保留场景、运行、播放和底部结果入口。最终手机截图已在竖屏相机视野修正后重新捕获。

## 交互证据

[参数与结果场景](rea-interaction-scenario.json) 对应 [完整 Evidence](rea-interaction-evidence.json)：

`ev_145acecb8d992a9283bf079809d9d7f8efbdf9587eda4b51752f5490b3f24eeb`

- 电流改为 260 A 并离开输入框后，可访问性文本显示 260 A、0.663 kJ/mm。
- 速度改为 10 mm/s 后，文本显示 10 mm/s、0.530 kJ/mm。
- 策略切换为顺序连续后，选中项和时序摘要更新为顺序连续。
- 点击运行后显示 101 个演示采样点与峰值统计，播放按钮变为暂停。
- 点击暂停后恢复播放按钮。
- 应力选项选中后，图例与曲线单位更新为 MPa。

该交互记录来自 favicon 修复前版本，因此包含单条 favicon 404；无 page-error。最新运行及温度捕获见上表。

## 结论范围

页面明确显示“演示估算 · 非有限元求解”“空间分布为演示示意”“演示模式 · 未连接外部求解器”。以上测试验证交互和渲染，不建立 RobotStudio 控制器或 Simufact 求解器连接，也不验证数值用于实际焊接工程的准确性。

REA 原始 Evidence 自带来源、场景摘要、步骤结果、截图 SHA-256 和限制。由于本次浏览器观察没有绑定静态制品，REA 报告 `Artifact identity is unavailable for this observation`；不得把观察推广到未经执行的版本、输入或功能。证据不含完整网络内容捕获，网络时序和控制台观察仅覆盖所执行窗口。

## 重复执行

先在项目目录启动本地静态服务器，再执行：

```sh
node rea/scripts/rea.mjs capture-browser-scenario docs/verification/rea-desktop-scenario.json --json
node rea/scripts/rea.mjs capture-browser-scenario docs/verification/rea-mobile-scenario.json --json
node rea/scripts/rea.mjs capture-browser-scenario docs/verification/rea-final-analysis-scenario.json --json
```

场景中的 Chrome 路径为本机已安装位置；在其他电脑上需要改为其实际浏览器路径。

## 移动端抽屉复核

额外场景 [rea-mobile-drawer-scenario.json](rea-mobile-drawer-scenario.json) 观察到：打开参数面板成功，再次点击原来的参数切换按钮被面板遮挡而超时。Evidence：`ev_73cc0710f8b49cb75618e6194c94e3c1596dbf8efe3d8e8771f14a474d44e9f3`，见 [完整证据](rea-mobile-drawer-evidence.json)。问题已修复：手机参数面板标题区新增“关闭参数面板”按钮。修复后定向场景依次打开面板、点击关闭按钮，并等待 `body:not(.right-open)` 状态下的原入口可见，全部步骤完成。

修复验证 Evidence：`ev_95f343f1d5bf97c27b64554b8eb5fe5560475705db35a168c1e744bc901d0445`，见 [完整证据](rea-mobile-drawer-fixed-evidence.json)、[场景输入](rea-mobile-drawer-fixed-scenario.json)、[打开时截图](rea-mobile-drawer-fixed.png)、[关闭后截图](rea-mobile-drawer-closed.png)。本次无 console/page-error 事件，捕获完整。原失败场景保留用于说明问题来源，不作为当前版本的通过证据。
