# SophiCAD Fusion Bridge

Fusion 360 Python 插件：把参数化装配导出为 `.sophicad.zip`，其中包含参数、装配树、Joint、BOM、物性、GLB/STL、URDF 和闭环约束；也可导入 Web 生成的更新包并重建当前设计。

## 安装

插件不需要 `pip`，只使用 Fusion 自带 Python 和标准库。

### macOS

1. 新建目录（不同 Fusion 安装渠道可能使用其中一种）：
   - `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/SophiCADBridge`
   - `~/Library/Application Support/Autodesk/Autodesk Fusion/API/AddIns/SophiCADBridge`
   优先选择同级目录中已经存在 `Scripts/` 或其他 Add-in 的路径。
2. 将本目录的**全部内容**复制进去。目标目录顶层必须直接包含：
   `SophiCADBridge.py` 和 `SophiCADBridge.manifest`。
3. 在 Fusion 中打开“实用工具 → 附加模块 → 脚本和附加模块”，进入“附加模块”页，选择 `SophiCADBridge` 并运行。

### Windows

1. 新建目录：
   `%APPDATA%\Autodesk\Autodesk Fusion\API\AddIns\SophiCADBridge`
2. 将本目录的全部内容复制进去，保持 `lib/` 和 `fusion/` 子目录。
3. 在 Fusion 的“脚本和附加模块”中加载 `SophiCADBridge`。

也可以在“脚本和附加模块”窗口点击 `+` → “来自设备的脚本或附加模块”，选择整个 `SophiCADBridge` 文件夹；不要只选择 `.py` 文件。安装方法遵循 Autodesk 的 [Python Add-in 模板](https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/PythonTemplate_UM.htm)。

## 使用

插件在 Design 工作区“实用工具/附加模块”面板增加三个命令：

- **导出 SophiCAD**：选择新文件名，生成完整数据包。为避免误覆盖，已存在的目标文件会被拒绝。
- **导入并重建**：选择 Web 导出的更新包，先预览表达式差异；确认后按依赖顺序写回用户参数并执行 `Compute All`。
- **装配诊断**：检查根节点、缺失引用、只读外部组件、闭环和非正质量。

导入具有事务式保护：设计 GUID、Schema 主版本、文件哈希、基础指纹、旧表达式和新表达式都必须通过预检。计算失败时插件恢复原表达式，再次执行 `Compute All`。需要重新选择几何的 Joint 类型或轴不会强改 Fusion 拓扑，而是保存为 robot override。

## 数据包关键文件

- `manifest.json`：来源设计、指纹、坐标系和每个文件的 SHA-256。
- `model.json`：参数、组件、Occurrence、Joint、物性、BOM 和机器人映射。
- `meshes/visual/*.glb`：Three.js 显示网格；同一组件多实例只存一份。
- `meshes/collision/*.stl`：URDF/仿真碰撞网格，单位为米。
- `robot/model.urdf`：机器人生成树。
- `robot/constraints.json`：URDF 无法表达的闭环边。
- `reports/validation.json`：稳定诊断 code 和中文说明。

## 开发验证

```bash
python3 -m unittest discover -s tests/fusion_addin -v
PYTHONPYCACHEPREFIX=/tmp/sophicad-pycache python3 -m compileall -q fusion_addin
```

真实 Fusion 验收步骤见 [fusion-smoke-test.md](../docs/fusion-smoke-test.md)。插件不会在 Fusion 外离线解析 `.f3d`。
