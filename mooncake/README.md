# Mooncake 月饼定制工坊

React + Three.js 月饼设计器，以及将同一份 JSON 转为月饼与配套手压模具的 Fusion 360 Python 加载项。

## 直接使用

双击 `mooncake/Mooncake.html`，使用支持 WebGL 2 的现代浏览器打开。脚本、样式和 Three.js 已内联，不依赖网络、Node.js、CDN 或字体服务。HTML 和 `mooncake.py` 保持在同一个目录。

- **界面语言**：页眉选择中文、English、Français 或日本語；切换后保留设计，语言偏好保存在本机。
- **尺寸**：底面直径 50–120 mm，饼身厚度 10–40 mm；默认 5° 脱模斜度（可调 0–8°），底面大、文字面小；经典花边、柔和波纹、简约圆形，花边数量可调。
- **正面**：10 款参数花纹：花好月圆、莲珠团花、重瓣莲华、繁花簇锦、菱锦团圆、八芒锦星、折扇流光、弦月花环、星月相映、涟漪团圆，可调整数量、直径和 0.5–3 mm 浮雕高度。花纹直径随饼身尺寸限制，文字大小也会联动约束。
- **参考图案**：本地上传 PNG / JPG / WebP，最大 10 MB。等比缩放、灰度采样后生成三层凸起浮雕；支持反相。以深色凸起为默认，建议使用清晰黑白图案。这里是确定性的灰度轮廓转换，不是生成式 AI，也不从照片推断物体深度。保留文字时会留出中心区域。
- **文字**：最多 2 个汉字或 5 个英文字母（A–Z / a–z），也可留空；不混用，不接受空格、数字或标点。支持宋体/黑体及大小调整；英文另可选择居中直排或沿内圈环形排列。直排按整组笔画的实际边界居中，文字整体适配内环，不受字体基线影响。导出时文字转为闭合轮廓，Fusion 不必安装相同字体。
- **预览**：拖动旋转、滚轮/按钮缩放、立体/正面视角。浏览器在本机自动保存草稿。
- **管理员**：导入已有设计、导出建模 JSON，或点击“导入 Fusion”直接创建月饼与模具。这是离线工具入口，没有账号鉴权；不能作为线上管理员权限控制。
- **模具**：管理员 → 导入 Fusion → 确认并导入 Fusion。默认径向间隙 0.3 mm、壁厚 3.5 mm、压片厚度 6 mm，可在确认窗口调整。浏览器会连接本机插件，Fusion 未启动时用已注册的 `fusion360://` 协议唤起应用；插件需已加入 Fusion 且设置“启动时运行”。成功后四个组件出现在 Fusion，新 F3D 和对应 JSON 自动保存到 `mooncake/exports/`，具体路径可在管理员工具中查看。
- **购买**：确认设计、数量和备注，下载包含完整设计的定制订单。没有配置商家、商城或支付接口，因此订单状态明确为“待商家确认 · 未付款”，不会提交订单或扣款。订单文件的 schema 是 `mooncake.order`，不能直接作为 Fusion 建模文件。

## Fusion 360 加载项

1. 在 Fusion 的设计工作区打开“实用程序 → 脚本和附加模块”（Shift+S）。
2. 点击 **+ → 来自设备的脚本或附加模块**，选择完整的 `mooncake` 子文件夹，里面应有 `mooncake.py`、`mooncake.manifest`、`Mooncake.html`、`design_data.py`、`mold_data.py`、`fusion_model.py`、`local_bridge.py`。
3. 运行名为 **mooncake** 的加载项，并启用 **启动时运行**。若之前已运行旧版本，先停止，再重新运行。
4. 在“附加模块”面板使用两个入口：
   - **导入月饼 JSON**：选择网页管理员导出的设计文件，确认后生成新文档中的月饼与三件模具，随后选择整套本地 `.f3d` 保存位置。取消保存会保留已创建的模型。
   - **设计月饼**：在 Fusion Palette 打开同目录 HTML；设计完成后进入“管理员 → 导入 Fusion”，核对后点击确认。图片、文字和参数都使用相同数据协议。管理员导出会使用 Fusion 的原生保存对话框。

每次建模创建独立文档，带有基体草图、上下截面放样和各层浮雕拉伸；0° 时基体使用直壁拉伸。取消建模或建模失败会清理本次新文档。所有长度在 JSON 中为毫米，传入 Fusion 点坐标时转换为厘米。Fusion 2026 使用 Hybrid 设计意图以允许创建子组件。文档创建和关闭通过自定义事件安排，避免在按钮命令事务内调用。

生成结果可通过 Fusion 的“导出”继续输出 STEP，或“另存为网格”输出 STL。曲线、中文字形和图片由折线近似；图片是三层台阶浮雕。参数是设计快照，不会创建全套草图尺寸约束；整体更改尺寸建议回网页调整后重新生成。每次输出四个独立组件，按展开位置排列，便于检查和分别输出 STL：

1. **月饼实体**：保持标称底径、厚度及正向凸起图案；文字面按脱模斜度收小。
2. **外套筒**：成形内腔匹配月饼的上小下大轮廓，上方保持小端等径导向通道，带双侧握耳及顶部推杆导向孔；下端开口，带孔腔底厚度固定为 6 mm，独立于侧壁厚度。
3. **可更换压片**：外缘相对内腔小端径向缩小所设间隙，可向下方大端推出。正面朝上展示镜像凹纹，字孔保留，凹纹深度与月饼浮雕高度对应；背面带直径 30 mm、高 18 mm 的独立螺纹座和 M20 × 2.5 盲孔（深 16 mm）。
4. **推杆与手柄**：直径 30 mm、长 40 mm 的光杆，M20 × 2.5、长 15 mm 的螺柱及直径 40 mm 手柄。内外螺纹均为实际建模螺纹，不是装饰标注。

装配时翻转压片，让凹纹朝下，从套筒下口放入；推杆从顶部导向孔穿入，旋入压片背面。图案接触面翻转后与月饼正向凸纹吻合。手动推压、抬套筒脱模，不含弹簧。间隙按径向定义，花边陡坡处的法向间隙会更小；螺纹使用 ISO 标准配合，没有额外打印补偿，首次制作应先试装。零件按自由组件输出，未添加装配运动约束。

## M20 模具尺寸（v1.6）

- 压片背面螺纹座外径从 Ø40 改为 **Ø30 mm**，保留高度 18 mm 与 M20 × 2.5 盲孔深 16 mm。
- 套筒成形段后的内部直壁段从 25 改为 **6 mm**，带孔腔底也为 6 mm。因此套筒总高度为 **月饼厚度 + 12 mm**；成形段继续匹配月饼的高度与脱模斜度。
- Ø30 螺纹座与 Ø30 光杆可连续穿过默认 Ø30.6 导向孔，压片厚度可调 4–6 mm。旧设计若压片超过 6 mm，导入前会提示调整。
- 光杆 Ø30 × 40 mm、M20 × 2.5 螺纹段长 15 mm、手柄 Ø40 × 7 mm。有效顶出行程为 50–52 mm（随压片厚度），支持全部 10–40 mm 月饼厚度，取消旧版 33 mm 限制。
- 旧 M8 文件和 v1.5 的 Ø40 螺纹座数据会自动升级；现行 JSON 记录 `bossDiameter: 30`、`guideHeight: 6`。已生成的旧 F3D 需重新生成才能采用新尺寸。

本机 Fusion 已用 61 × 18 mm「白」字设计重新生成：螺纹座实测 Ø30 mm，内部直壁边长 6 mm，腔底 6 mm，套筒总高 30 mm。四个封闭实体、M20 内外实体螺纹、顶出位移 0/9/18 mm 的干涉检查及 F3D 重新打开均通过。模型为 `mooncake/exports/Mooncake-61mm-cd78a939.f3d`，可导入样例为 `mooncake/examples/compact-mold.json`，数值记录见 `docs/fusion-v1.6-verification.json`。

## 本机连接与花纹来源

本机核对的插件目录为 `/Users/wubo/Documents/2026-2/sophistudio/mooncake/mooncake`；`mooncak` 是缺少末尾 `e` 的路径。不要把父级工程目录加入插件管理器。

`local_bridge.py` 随 Fusion 加载项运行，仅监听 `127.0.0.1:19876`。允许 `file://` 离线页面和 `localhost/127.0.0.1` 的 5173、4173 端口；会验证网页来源、Host、会话令牌、4 MB 大小上限与全部几何数据。CAD 工作通过自定义事件在 Fusion 主线程执行。重复请求使用同一任务编号，不会重复生成实体；同时只接收一份建模任务。停止插件会关闭连接。若插件被手动停止、首次未安装或启动超过等待时间，网页显示明确说明，可重新运行插件后重试，也可继续导出 JSON 手工导入。公开网站需要另行配置明确允许的来源，目前不提供远程建模服务。

十款为 MakerWorld 公开作品中的花卉、圆形装饰与几何方向筛选后，独立绘制的参数化纹样；并非平台销量或下载量前十榜单，也不是原模型文件的下载或复刻。每款在网页中有“灵感参考”链接。完整来源、选用理由和差异见 [花纹参考目录](docs/pattern-references.md)。缩略图、Three.js 与 Fusion 使用同一套闭合轮廓。

## 脱模斜度

斜度相对竖直方向计算：`文字面直径 = 底面直径 − 2 × 饼身厚度 × tan(斜度)`。底径 68 mm、厚度 26 mm、斜度 5° 时，文字面直径约 63.45 mm。花边采用相同角位置的径向内缩，上下截面顶点对应连接；因此 5° 是径向截面的名义斜度，花边各折面法向的角度会略有不同。文字和浮雕本身保持原高度与直壁；花纹直径会自动限制在缩小后的文字面内。

网页预览、JSON、Fusion 月饼实体及模具内腔共用这些截面。5° 样例为 `mooncake/examples/draft-5deg.json`。

## JSON 格式

```json
{
  "schema": "mooncake.design",
  "version": 2,
  "units": "mm",
  "dimensions": { "diameter": 80, "thickness": 25, "draftAngle": 5 },
  "side": { "pattern": "scallop", "count": 24 },
  "front": {
    "mode": "parametric", "pattern": "petals", "diameter": 68,
    "relief": 1.6, "petals": 16, "invert": false, "image": null
  },
  "text": { "character": "团圆", "size": 23, "font": "serif", "layout": "straight" },
  "mold": { "type": "hand_press", "radialClearance": 0.3, "wallThickness": 3.5, "stampThickness": 6, "connection": "M20x2.5", "baseThickness": 6, "shaftDiameter": 30, "shaftLength": 40, "studLength": 15, "handleDiameter": 40, "bossDiameter": 30, "guideHeight": 6 },
  "geometry": {
    "outline": "底面 384 个 [x,y] 顶点，实际为数组",
    "topOutline": "对应顶面 384 个 [x,y] 顶点，实际为数组",
    "reliefs": "多个 {outer, holes, height, label} 对象，实际为数组"
  }
}
```

新导出使用 v2，要求 `dimensions.draftAngle`（角度）和 `geometry.topOutline`；新版插件会验证上下截面与角度一致。仍可导入旧 v1，按 0° 直壁保持原形。浏览器中旧的自动保存草稿会迁移为默认 5°；手动导入旧文件则保留 0°，可在尺寸面板修改。旧插件不支持 v2，需更新整个插件目录并重新运行。

上面只是字段说明。可直接导入的完整文件在 `mooncake/examples`；推荐先用 `default-fu.json`，另有 `character-double-happiness.json` 和 `uploaded-relief.json` 检查字孔与图片浮雕；`two-chinese-characters.json` 是“团圆”居中样例，`english-circular.json` 是“HELLO”环排样例。`text.layout` 为 `straight` 或 `circular`，后者仅用于英文字母；旧 v1 文件缺少该字段时按居中直排处理。界面语言不会改变刻字、JSON 单位、字段名或几何。旧文件缺少 `mold` 字段或使用 M8 连接时，网页和新版插件会升级至当前 M20 硬件，保留原有间隙、侧壁厚度和压片厚度；如使用此前导出的偏下文字，请在新版网页导入并重新导出，以更新居中轮廓。所有环不重复首点。`height` 从饼身顶面起算，三层图片浮雕从低到高与基体合并。导入器校验 schema、版本、单位、数值范围、有限数、轮廓顶点、自相交、内孔包含关系和复杂度；文件最大 4 MB，浮雕区域最多 400 个、总浮雕顶点最多 10,000 个。

## 开发与验证

```sh
cd web
npm ci
npm run dev
npm run build    # 更新 ../mooncake/Mooncake.html
npm test
cd ..
python3 -B -m unittest discover -s tests -v
node web/tests/browser.mjs
node web/tests/centering.mjs
node web/tests/languages.mjs
node web/tests/text-edge-cases.mjs
```

浏览器测试使用 Playwright 与本机 Google Chrome；如不在 macOS，可在测试脚本中设置本机浏览器路径。构建命令不需要 Python 或 Fusion。

当前验证：11 项 JavaScript 几何/文字测试（覆盖全部 10 款纹样）、39 项 Python 数据/API 调度、本机连接和模具配合测试；Chromium 实测四语言桌面/手机、双汉字/五英文字母与环形排列验证、参数联动、图片上传、真实 JSON 下载与导入、订单下载、草稿恢复，以及完全阻断 HTTP 请求后的单文件 HTML。Fusion Palette 的排队/结果回调使用模拟宿主测试；普通浏览器的本机传输另有真实 Fusion 端到端验证脚本 `web/tests/fusion-live.mjs`（会实际创建模型和 F3D）。

**宿主实测：**已在本机 Fusion 中使用 `centered-gold-with-mold.json` 生成并导出 `output/Mooncake-金-68mm-月饼与模具.f3d`。实测四个组件各含一个封闭、有正体积的 BRep 实体；月饼外径 68 mm、饼身 26 mm、总高 27.6 mm（含 1.6 mm 浮雕）；压片直径 67.4 mm，内外 M8 实体螺纹各一个。文字居中另以 5 个汉字 × 2 种字体 × 3 种尺寸验证，轮廓中心偏差小于 0.0001 mm。暂未完成实物打印、装配和食品压制测试。

**5° 宿主实测（v1.4）：**底面 68 mm、厚度 26 mm、文字面 63.45065 mm；原生侧壁径向斜度 5°，模具小端 63.45065 mm，压片外径 62.85065 mm，对应每侧 0.3 mm 间隙。四个封闭实体及两处 M8 实体螺纹通过检查，重新打开导出的 F3D 后尺寸、体积和位置一致。详细记录见 `docs/fusion-v1.4-verification.json`。

## 目录

- `web/src/`：React 组件、Three.js 场景、几何与图案逻辑。
- `web/scripts/build.mjs`：单文件离线打包。
- `mooncake/`：可交付的 Fusion 插件与 HTML。
- `tests/`：JSON 校验、实体调用和事务调度测试。
- `docs/`：设计参考、实际页面截图与验证记录。

原有 `mooncake/commands` 和 `mooncake/lib` 模板保留，但新入口不再加载示例命令。

API 依据：[Palettes.add](https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/core_Palettes_add.htm)、[ExtrudeFeatures.addSimple](https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/fusion_ExtrudeFeatures_addSimple.htm)，并对照本机安装版本的 `adsk.core` / `adsk.fusion` API 文档检查文档事务和设计意图。
