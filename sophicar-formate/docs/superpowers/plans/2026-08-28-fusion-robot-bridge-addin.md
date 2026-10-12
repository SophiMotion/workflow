# Fusion Robot Bridge Add-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建无需额外 pip 依赖的 Fusion 360 Python 插件，完成任意装配体导出、更新包预览、参数写回、全量重建、回滚与诊断。

**Architecture:** Autodesk API 只存在于薄适配器和 UI 命令层；导入/导出服务依赖 Protocol，可在系统 Python 中用 fake adapter 测试。插件用 Python 标准库生成 JSON、ZIP、SHA-256、二进制 STL 和最小 GLB。

**Tech Stack:** Fusion 360 Python API、Python 3 标准库、unittest、JSON/ZIP/GLB/STL

**Spec:** `docs/superpowers/specs/2026-08-28-fusion-threejs-urdf-bridge-design.md`

## Global Constraints

- 插件不得尝试离线解析 `.f3d`；只读取 Fusion 当前活动 Design。
- 不要求用户安装 pip 包。
- 导入必须验证设计 GUID、基础指纹、Schema 主版本和文件哈希。
- 用户参数是精确写回主路径；需要重新选择几何的 Joint 类型/轴修改只保存 robot override。
- 失败必须恢复原参数表达式并再次 `computeAll()`。
- 外部引用、派生组件和只读对象不得强制修改。
- 代码注释使用中英双语；UI 与报告使用中文主文案。

---

## File Structure

- `fusion_addin/SophiCADBridge.manifest`：Fusion 插件清单。
- `fusion_addin/SophiCADBridge.py`：Fusion `run/stop` 入口。
- `fusion_addin/lib/domain.py`：与 Schema 对齐的 Python 数据结构和序列化。
- `fusion_addin/lib/adapter.py`：`FusionAdapter` Protocol。
- `fusion_addin/lib/export_service.py`：通用导出编排。
- `fusion_addin/lib/import_service.py`：验证、预览、写回、重算和回滚。
- `fusion_addin/lib/package_io.py`：安全 ZIP、规范 JSON、哈希和指纹。
- `fusion_addin/lib/mesh.py`：TriangleMesh → GLB/STL。
- `fusion_addin/lib/diagnostics.py`：装配和物性诊断。
- `fusion_addin/fusion/fusion_adapter.py`：真实 Autodesk API 实现。
- `fusion_addin/fusion/commands.py`：三个 Fusion UI 命令。
- `tests/fusion_addin/`：标准库 unittest 与 fake adapter。

### Task 1: Python 领域模型与 Fusion 隔离边界

**Files:**
- Create: `fusion_addin/lib/domain.py`
- Create: `fusion_addin/lib/adapter.py`
- Create: `tests/fusion_addin/fakes.py`
- Test: `tests/fusion_addin/test_domain.py`

**Interfaces:**
- Produces: `FusionAdapter` Protocol
- Produces: `DocumentSnapshot`、`ParameterRecord`、`ComponentRecord`、`OccurrenceRecord`、`JointRecord`、`PhysicalRecord`

- [ ] **Step 1: 写规范序列化失败测试**

```python
class DomainSerializationTest(unittest.TestCase):
    def test_snapshot_serializes_si_values_and_original_expression(self):
        snapshot = make_snapshot(parameter_name="l1", expression="200 mm", value_si=0.2)
        payload = snapshot.to_model_dict()
        parameter = payload["parameters"]["user"][0]
        self.assertEqual(parameter["expression"], "200 mm")
        self.assertEqual(parameter["valueSi"], 0.2)
        self.assertEqual(payload["units"]["length"], "m")
```

- [ ] **Step 2: 运行测试确认模块缺失**

Run: `python3 -m unittest tests.fusion_addin.test_domain -v`

- [ ] **Step 3: 实现不可变 dataclass 与 Protocol**

```python
class FusionAdapter(Protocol):
    def active_design_identity(self) -> DesignIdentity: ...
    def snapshot(self, options: ExportOptions) -> DocumentSnapshot: ...
    def validate_expression(self, expression: str, unit: str) -> bool: ...
    def set_user_parameter_expression(self, name: str, expression: str) -> None: ...
    def compute_all(self) -> ComputeReport: ...
```

领域模型不得 import `adsk`。`to_model_dict()` 输出字段必须匹配 Foundation Schema。

- [ ] **Step 4: 运行测试并提交**

```bash
python3 -m unittest tests.fusion_addin.test_domain -v
git add fusion_addin/lib/domain.py fusion_addin/lib/adapter.py tests/fusion_addin
git commit -m "feat: define Fusion add-in domain boundary"
```

### Task 2: 指纹与安全数据包写入

**Files:**
- Create: `fusion_addin/lib/package_io.py`
- Test: `tests/fusion_addin/test_package_io.py`

**Interfaces:**
- Produces: `canonical_json_bytes(value) -> bytes`
- Produces: `compute_source_fingerprint(snapshot) -> str`
- Produces: `write_package(output_path, package_input) -> PackageWriteResult`
- Produces: `read_update_package(path) -> UpdatePackage`

- [ ] **Step 1: 写确定性、原子写入与 zip-slip 失败测试**

```python
def test_fingerprint_is_stable_when_source_collections_are_reordered(self):
    self.assertEqual(compute_source_fingerprint(snapshot_a), compute_source_fingerprint(snapshot_b))

def test_update_reader_rejects_parent_path(self):
    archive = make_zip({"../escape": b"bad"})
    with self.assertRaisesRegex(PackageError, "unsafe_archive_path"):
        read_update_package(archive)
```

- [ ] **Step 2: 运行失败测试**

Run: `python3 -m unittest tests.fusion_addin.test_package_io -v`

- [ ] **Step 3: 实现规范 JSON、哈希清单和同目录临时文件替换**

规范 JSON 使用 `sort_keys=True`、`ensure_ascii=False`、`separators=(",", ":")`。输出先写 `<name>.tmp-<uuid>`，`fsync` 后 `os.replace` 到新路径；若目标已存在，服务层必须要求用户重新选择或显式确认。

- [ ] **Step 4: 对齐 Foundation 默认 ZIP 限制并通过测试**

Run: `python3 -m unittest tests.fusion_addin.test_package_io -v`

- [ ] **Step 5: 提交**

```bash
git add fusion_addin/lib/package_io.py tests/fusion_addin/test_package_io.py
git commit -m "feat: write validated Fusion exchange packages"
```

### Task 3: 无第三方依赖的组件网格导出

**Files:**
- Create: `fusion_addin/lib/mesh.py`
- Test: `tests/fusion_addin/test_mesh.py`

**Interfaces:**
- Produces: `write_binary_stl(mesh: TriangleMeshData) -> bytes`
- Produces: `write_glb(meshes: Sequence[BodyMeshData]) -> bytes`

- [ ] **Step 1: 写三角形 STL/GLB 结构失败测试**

```python
def test_glb_contains_valid_header_and_position_accessor(self):
    glb = write_glb([single_triangle_body()])
    self.assertEqual(glb[:4], b"glTF")
    self.assertEqual(struct.unpack_from("<I", glb, 4)[0], 2)
    document = parse_glb_json(glb)
    self.assertEqual(document["accessors"][0]["count"], 3)
```

- [ ] **Step 2: 运行失败测试**

Run: `python3 -m unittest tests.fusion_addin.test_mesh -v`

- [ ] **Step 3: 实现局部坐标、法线、索引、body material 的 GLB 2.0 writer**

位置写 FLOAT VEC3，索引根据顶点数使用 UNSIGNED_SHORT 或 UNSIGNED_INT。4 字节对齐，GLB 总长度和 chunk 长度必须正确；所有 cm 坐标在写入前乘以 `0.01` 变成 m。STL 同样输出 m，并在 `model.json` 中声明单位。

- [ ] **Step 4: 增加多 body、多材质、32 位索引和空组件测试**

Run: `python3 -m unittest tests.fusion_addin.test_mesh -v`

- [ ] **Step 5: 提交**

```bash
git add fusion_addin/lib/mesh.py tests/fusion_addin/test_mesh.py
git commit -m "feat: export component meshes as GLB and STL"
```

### Task 4: 通用装配导出服务

**Files:**
- Create: `fusion_addin/lib/export_service.py`
- Create: `fusion_addin/lib/diagnostics.py`
- Test: `tests/fusion_addin/test_export_service.py`

**Interfaces:**
- Consumes: `FusionAdapter.snapshot`、package IO、mesh writers
- Produces: `ExportService.export(options, output_path) -> ExportReport`

- [ ] **Step 1: 写组件复用、Occurrence 实例、BOM 和闭环测试**

```python
def test_reused_component_exports_one_mesh_and_two_occurrences(self):
    report = ExportService(fake_adapter_reusing_link()).export(options, output_path)
    package = open_package(output_path)
    self.assertEqual(len(package.model["components"]), 1)
    self.assertEqual(len(package.model["occurrences"]), 2)
    self.assertEqual(list_visual_meshes(package), ["meshes/visual/link.glb"])
    self.assertEqual(package.model["bom"][0]["quantity"], 2)
```

- [ ] **Step 2: 运行失败测试**

Run: `python3 -m unittest tests.fusion_addin.test_export_service -v`

- [ ] **Step 3: 实现快照规范化、BOM、诊断、指纹和包编排**

导出服务不得调用 `adsk`。对于无 grounded root、多 root、空质量、外部引用和闭环，生成稳定 code 的 diagnostics。任何 error 阻止写包；warning 写包但出现在 validation report。

- [ ] **Step 4: 运行导出服务测试并提交**

```bash
python3 -m unittest tests.fusion_addin.test_export_service -v
git add fusion_addin/lib/export_service.py fusion_addin/lib/diagnostics.py tests/fusion_addin/test_export_service.py
git commit -m "feat: export generic Fusion assemblies"
```

### Task 5: 参数导入、重建和回滚

**Files:**
- Create: `fusion_addin/lib/import_service.py`
- Test: `tests/fusion_addin/test_import_service.py`

**Interfaces:**
- Produces: `ImportService.preview(update_path) -> ImportPreview`
- Produces: `ImportService.apply(update_path) -> ImportReport`

- [ ] **Step 1: 写设计不匹配、排序应用、计算失败回滚测试**

```python
def test_compute_failure_restores_every_expression(self):
    adapter = fake_adapter(parameters={"l1": "200 mm", "l2": "l1 + 50 mm"}, compute_results=[failed_compute(), healthy_compute()])
    with self.assertRaises(ImportFailed):
        ImportService(adapter).apply(update_package(l1="220 mm", l2="l1 + 40 mm"))
    self.assertEqual(adapter.parameters, {"l1": "200 mm", "l2": "l1 + 50 mm"})
    self.assertEqual(adapter.compute_call_count, 2)
```

- [ ] **Step 2: 运行失败测试**

Run: `python3 -m unittest tests.fusion_addin.test_import_service -v`

- [ ] **Step 3: 实现预检、原值快照、依赖顺序、健康检查和恢复**

`preview` 不得改变 Fusion。`apply` 先再次读取当前指纹，验证每个 `oldExpression`，再写入。`compute_all()` 返回 false 或任一受影响 timeline item 为 error 都触发恢复。恢复失败时报告 `rollback_failed`，同时保留原值清单供人工恢复。

- [ ] **Step 4: 增加外部参数、只读参数、Joint override 与同类型限位测试**

Run: `python3 -m unittest tests.fusion_addin.test_import_service -v`

- [ ] **Step 5: 提交**

```bash
git add fusion_addin/lib/import_service.py tests/fusion_addin/test_import_service.py
git commit -m "feat: rebuild Fusion designs from update packages"
```

### Task 6: 真实 Autodesk Fusion API 适配器

**Files:**
- Create: `fusion_addin/fusion/fusion_adapter.py`
- Create: `fusion_addin/fusion/conversions.py`
- Create: `fusion_addin/fusion/joints.py`
- Test: `tests/fusion_addin/test_conversions.py`

**Interfaces:**
- Implements: `FusionAdapter`

- [ ] **Step 1: 写无 adsk 环境可运行的纯转换测试**

```python
def test_fusion_cm_transform_converts_translation_to_meters(self):
    matrix = fusion_matrix_with_translation(20, 0, 5)
    self.assertEqual(to_row_major_si(matrix)[3], 0.2)
    self.assertEqual(to_row_major_si(matrix)[11], 0.05)
```

- [ ] **Step 2: 运行失败测试并实现 conversions**

Run: `python3 -m unittest tests.fusion_addin.test_conversions -v`

- [ ] **Step 3: 实现真实遍历和读取**

适配器读取 `Design.userParameters`、`Design.allComponents`、`rootComponent.allOccurrences`、普通 Joint、As-Built Joint、`Occurrence.getPhysicalProperties(VeryHighCalculationAccuracy)`、component part number/description/material、entity token 和完整路径。参数表达式验证使用 UnitsManager；重算使用 `Design.computeAll()` 并遍历 timeline health。

- [ ] **Step 4: 实现 MeshManager 三角化和组件局部坐标转换**

每个唯一组件只三角化一次。appearance 解析失败时使用稳定的组件 ID 颜色并生成 warning。

- [ ] **Step 5: 运行纯 Python 测试和 Fusion 文件语法检查**

Run: `python3 -m unittest discover -s tests/fusion_addin -v && python3 -m compileall -q fusion_addin`

- [ ] **Step 6: 提交**

```bash
git add fusion_addin/fusion tests/fusion_addin/test_conversions.py
git commit -m "feat: connect exporter to Fusion API"
```

### Task 7: Fusion UI 命令与插件生命周期

**Files:**
- Create: `fusion_addin/SophiCADBridge.manifest`
- Create: `fusion_addin/SophiCADBridge.py`
- Create: `fusion_addin/fusion/commands.py`
- Create: `fusion_addin/fusion/event_handlers.py`
- Test: `tests/fusion_addin/test_command_presenters.py`

**Interfaces:**
- Produces: Fusion commands `sophicad_export`、`sophicad_import`、`sophicad_diagnose`

- [ ] **Step 1: 写 presenter 状态和中文摘要测试**

```python
def test_import_preview_requires_confirmation_for_warnings(self):
    view = build_import_preview_view(preview_with_warnings())
    self.assertTrue(view.requires_confirmation)
    self.assertIn("220 mm", view.parameter_rows[0].new_expression)
```

- [ ] **Step 2: 运行失败测试并实现与 adsk 无关的 presenter**

Run: `python3 -m unittest tests.fusion_addin.test_command_presenters -v`

- [ ] **Step 3: 实现 run/stop、面板按钮、文件对话框和 handler 生命周期**

所有 handler 保存在模块级列表，`stop` 删除 command definition、controls 并清空 handler，避免插件重新加载后重复按钮。诊断列表选择项通过 adapter 找回 entity token 并在 Fusion 中选中/缩放定位；找回失败显示 `entity_not_found`，不得定位到同名对象。

- [ ] **Step 4: 运行测试与 compileall 并提交**

```bash
python3 -m unittest discover -s tests/fusion_addin -v
python3 -m compileall -q fusion_addin
git add fusion_addin tests/fusion_addin/test_command_presenters.py
git commit -m "feat: add Fusion export import and diagnose commands"
```

### Task 8: 安装文档与 `test1.f3d` smoke test

**Files:**
- Create: `fusion_addin/README.md`
- Create: `docs/fusion-smoke-test.md`
- Create: `fixtures/four-bar/expected-export-summary.json`

**Interfaces:**
- Produces: 可复现的 Fusion 内验收记录模板。

- [ ] **Step 1: 写 smoke test 检查脚本/清单**

清单必须检查 `w1、w2、l1、l2、d、t1、t2`，四连杆/轴实例、四个旋转 Joint、BOM、闭环、网格和物性；然后测试 `l1: 200 mm → 220 mm` 的导入与重新导出。

- [ ] **Step 2: 记录 macOS 与 Windows 插件安装路径和 Fusion 加载步骤**

README 给出复制目录和 Fusion“脚本和附加模块”加载方式，不要求修改 `.env`。

- [ ] **Step 3: 运行所有可自动验证项**

Run: `python3 -m unittest discover -s tests/fusion_addin -v && python3 -m compileall -q fusion_addin`

Expected: 0 failures，0 syntax errors。

- [ ] **Step 4: 在 Fusion 中打开 `/Users/wubo/Desktop/test1.f3d` 执行 smoke test**

保存导出包到 `fixtures/generated/test1.sophicad.zip`，但只提交去除专有几何的摘要 JSON；不提交用户原始 `.f3d`。

- [ ] **Step 5: 提交**

```bash
git add fusion_addin/README.md docs/fusion-smoke-test.md fixtures/four-bar/expected-export-summary.json
git commit -m "docs: add Fusion bridge installation and smoke test"
```
