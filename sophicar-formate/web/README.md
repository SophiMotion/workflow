# SophiCAD Web Workbench

本地优先的 React + Three.js 工程工作台。数据包在浏览器内读取、校验和修改，不上传服务器。

## 启动

```bash
npm install
npm run dev --workspace web
```

打开 `http://127.0.0.1:4173/`，导入 Fusion 插件生成的 `.sophicad.zip`。开发演示可打开 `http://127.0.0.1:4173/?demo=1` 自动加载仓库中的脱敏四连杆样例。

## 工作流

1. 导入并校验 manifest、Schema、SHA-256 和权威 `model.json`。
2. 在 Three.js 模块选择 Occurrence、查看 BOM、修改可写用户参数和预览四连杆运动。
3. 参数修改只产生代理预览并明确标记“等待 Fusion 重建”；不会把浏览器缩放伪装为精确 B-Rep 重建。
4. 在 URDF / Isaac 模块检查生成树、闭环约束、Joint 限位、质量/惯量诊断和 Isaac 配置。
5. 下载 `*-update.sophicad.zip`，回 Fusion 点击“导入并重建”。

## 验证

```bash
npm test --workspace web
npm run typecheck --workspace web
npm run build --workspace web
npx playwright test --config web/playwright.config.ts
```

桌面最小宽度为 1024px；更窄时显示保护提示，避免工程面板被压坏。
