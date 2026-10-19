# HIL 车辆硬件在环检测

SophiStudio 工作流中的 HIL 子项目。`hil.html` 为原项目构建的单文件交付，内嵌三维引擎、车辆模型、场景、界面与动力学代码，发布时保持原文件内容不变。来源校验记录见 `deployment-manifest.json`，模型署名与许可证见 `THIRD-PARTY-NOTICES.txt`。

- 网站入口：<http://sophistudio.com/hil/hil.html>
- 本地工具入口：<http://127.0.0.1:8247/hil.html>，先在 HIL 源码目录运行 `python3 bridge.py --port 8247`。
- 默认显示区域总览；点击顶部「HIL 实验室」进入三维场景，支持车辆切换、驾驶输入、试验任务、遥测与 CSV 导出。

网站提供浏览器仿真与实验室展示，未连接真实 ECU / CAN 或硬实时系统。SQLite、Python 与 MATLAB 工作区连接需要原项目的本机桥接服务；工作流在 localhost / file 预览时保留该本地入口。桥接访问限制保持原样，不对公共网站开放。WebXR 需要 HTTPS 或 localhost，以及兼容设备。

## 更新

在原 HIL 源码目录构建并验证后，将 `hil.html` 与许可证同步到本目录，更新校验记录及工作流截图。不要复制运行数据库、采样记录、缓存或源码压缩包。工作流链接回归检查：

```sh
node --test tests/workflow-pages.test.mjs
```
