# SOPHI WELD · 焊接仿真工作台

参考提供的 RobotStudio 截图构建的可交互演示项目，整合机器人工作站、焊接策略和分析结果工作流。主交付文件为 **weld.html**，约 650 KB，内置样式、程序、图标与 Three.js，运行不依赖 CDN。

## 打开

直接用 Chrome / Edge / Safari 打开 `weld.html`，或在此目录运行：

```sh
npm start
```

访问 `http://127.0.0.1:8765/weld.html`。本次预览服务已启动在该端口。浏览器需支持 WebGL；不支持时仍可编辑工艺与处理结果数据。

## 已实现

- 三维工作站：细化机械臂关节、壳体、线缆、喷嘴、工装、气瓶、送丝机、控制柜与黄色安全围栏；旋转、平移、缩放、显隐和图片导出。
- 倾斜进枪、固定臂长、抬枪换道；喷嘴与手臂对工件、筋板、夹具和台面的简化包络检查。
- 4 条预定义焊缝：选择、启用/停用、顺序连续/对称交替/反向策略、道间等待、时序图。
- 工艺参数：MAG / 脉冲 MAG / TIG，直线 / 横向摆动 / 环形鱼鳞，保护气体、流量、喷嘴距离、预送气 / 后送气、目标熔池温度、冷却观察时长，以及电流、电压、速度、效率、板厚、材料、预热。线能量公式为 `η × U × I / v / 1000`，单位 kJ/mm。
- 同步过程：焊枪、电弧、熔池、飞溅、保护气、逐段堆积焊道与温度扩散共用时间轴；焊前无堆积，焊后由热色过渡到金属色 / 氧化色，支持暂停、跳转和回拖。
- 焊道形貌：标准、脉冲鱼鳞、宽幅摆动、高速窄焊道、保护不足五个预设；三维焊道宽高、纹理间距与颜色随参数变化。
- 分析：241 个演示采样点，独立焊后冷却段，温度 / 应力 / 位移曲线、t₈/₅、统计值、示意云图；热应力、快速冷却、气孔 / 氧化、未熔合 / 咬边、过热 / 烧穿五类规则提示。
- 本地存储、项目 JSON 导入/导出、中立工艺 JSON、结果 CSV 导入/导出、HTML 报告。
- 桌面三栏与手机抽屉布局；键盘快捷键见界面“操作指南”。

## 快速体验

1. 点播放条的“跳到焊接中段”，观察斜向喷嘴、电弧与未完成焊道；实体模式可观察堆积和颜色。
2. 打开右侧“焊道与保护”，切换形貌预设；参数变化会清除旧结果并回到焊前。
3. 点“查看焊后冷却”，查看降温与 t₈/₅；在“分析物理量”中切换应力和位移。
4. 点底部“焊后风险”，展开每一行查看依据和建议；点“依据与限制”了解示意边界。

## 数据交换

`examples/weld-project.json` 可恢复默认工作站。`examples/weld-demo-results.csv` 是演示数据，**不是商业求解器输出**。

结果 CSV 表头：

```csv
time_s,temperature_c,stress_mpa,displacement_mm
0,20,0,0
10,830,210,0.24
```

时间严格递增；数据列需要数值。当前格式为本项目定义的中立交换格式，不能直接读取 `.rspag` 或 Simufact 原生工程。导入结果保留文件名；修改工艺参数会使当前结果失效，以避免混用不同工况。

中立工艺 JSON 包含参数、单位、焊缝长度和时序，不包含可执行 RAPID 或真实机器人位姿。正式接入需要在 Windows 原生软件端实现经验证的专用适配器。

## REA

已下载并构建用户指定的 `https://github.com/Sophiteam/rea`，并为 Codex 添加了 MCP 注册和对应技能。

```sh
node rea/scripts/rea.mjs --version
node rea/scripts/rea.mjs doctor --client codex --json
node rea/scripts/rea.mjs mcp doctor --json
```

新注册需重连/重启 Codex 聊天后加载；本次通过 CLI 实际调用了 REA 浏览器情景捕获，验证该网页的界面与交互。安装详情见 `docs/rea-installation.md`，运行证据见 `docs/verification/rea-verification.md`。

## 实现与验证

```sh
npm install
npm run build
npm test
```

源文件：`src/app.js` 交互与数据流；`src/scene.js` 场景与云图；`src/robot.js` 机械臂造型；`src/motion.js` 轨迹与包络检查；`src/effects.js` 电弧与逐段焊道；`src/process.js` 形貌、热循环与风险规则；`src/analysis-ui.js` 曲线与风险展示；`src/model.js` 参数校验、时序与演示计算；`src/ui.js` 界面结构；`src/style.css` 设计与响应式样式。`scripts/build.mjs` 将全部内容内联到 `weld.html`。

已验证 1600×1000 桌面与 390×844 手机；参数/线能量/时序联动、策略切换、运行、暂停、云图、CSV 导入和 JSON 导出。15 个自动测试覆盖线能量、时序、参数 / CSV 校验、旧项目迁移、冷却、焊前 / 焊中 / 焊后 / 回拖的实际三维实例数量和颜色、纹理间距、四条焊缝和三种顺序的几何间隙、枪距边界与摆动，以及最终 HTML 语法和离线依赖。历史 REA 验证文档描述首版；本次升级证据保存在临时目录 `/tmp/weld-v2-rea`。

## 演示边界

RobotStudio 与 Simufact Welding 当前均未连接。REA 没有接收到这两款软件的程序或工程，因此未对它们进行原生逆向分析。机器人几何和运动是演示模型；含两连杆解析运动学和针对本模型的简化包络检查，但不包含 ABB 原生六轴逆解、关节限位、自碰撞、线缆 / 围栏碰撞或控制器仿真。温度、应力、位移为简化示意估算，材料仅影响少量示意系数，不是材料数据库。热循环使用指数冷却，纹理与风险阈值为未标定的教学规则；云图不是有限元热传导解。几何比例与焊缝长度属于示意映射，焊道预览不等于实测熔深或合格焊脚。导入的时程图属于真实读取的数据，但空间云图仍为示意。正式工艺需要真实 CAD、热源标定、材料数据库和原生求解器验证。

接口资料：
- ABB RobotStudio SDK: https://developercenter.robotstudio.com/api/robotstudio/
- ABB PC SDK: https://developercenter.robotstudio.com/api/pcsdk/articles/Manual/Run-time-environment/Overview.html
- Hexagon Simufact Welding: https://hexagon.com/products/simufact-welding

定性机理参考：[TWI 气孔机理](https://www.twi-global.com/technical-knowledge/job-knowledge/defects-imperfections-in-welds-porosity-042)、[Miller 焊接缺陷排查](https://www.millerwelds.com/en-us/resources/knowledge-hub/mig-welding/how-to/troubleshooting-weld-defects)。本工具的数值系数和风险分级并非来源中的合格工艺阈值。
