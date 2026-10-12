# `test1.f3d` Fusion Smoke Test

源文件：`/Users/wubo/Desktop/test1.f3d`  
目标：验证四连杆只是通用装配导出的首个样例；同一流程随后用于车辆底盘与机器人关节。

## 前置条件

1. 安装并运行 `fusion_addin/` 中的 SophiCAD Bridge。macOS 需先确认当前安装使用
   `Autodesk Fusion 360/API/AddIns` 还是 `Autodesk Fusion/API/AddIns` 目录。
2. 在 Fusion 中打开 `test1.f3d`，确认 Design 工作区可见三个 SophiCAD 命令。
3. 保留原文件副本；更新包仅应写回用户参数和 robot override。

## A. 首次诊断与导出

- [x] 点击“装配诊断”，无 warning/error；未发现装配问题。
- [x] 用户参数完整：`w1、w2、l1、l2、d、t1、t2`。
- [x] 表达式与参考设计一致：`w1=20 mm`、`w2=20 mm`、`l1=200 mm`、`l2=250 mm`、`d=10 mm`、`t1=20 mm`、`t2=20 mm`。
- [x] 浏览器中的连杆、轴和所有重复实例均存在。
- [x] 实际装配的 8 个 revolute Joint 均导出，父子实例与轴向可读取。
- [x] BOM 按唯一 Component 合并：`轴×4、连杆1×2、连杆2×2`。
- [x] 3 个非空唯一 Component 各有一份 GLB 和一份 STL；重复实例不复制网格。
- [x] 8 个实例均包含 mass、volume、center of mass 和 3×3 inertia。
- [x] 闭环边写入 `robot/constraints.json`；`robot/model.urdf` 只保留生成树。
- [x] 点击“导出 SophiCAD”，真实基线保存为 `/private/tmp/sophicad-stable/model.sophicad.zip`（不提交专有几何）。

## B. Web 修改与 Fusion 重建

1. 在 Web 导入首次数据包。
2. 把 `l1` 从 `200 mm` 改为 `220 mm`，保留其他参数关系。
3. 导出更新包，不直接修改原 `.f3d`。
4. 回 Fusion 点击“导入并重建”，确认预览显示 `l1: 200 mm → 220 mm`。

- [x] 确认后 `Compute All` 完成，插件报告“重建完成，共更新 1 个参数”。
- [x] 重导出确认 `l1` 表达式是 `220 mm`、SI 值为 `0.22 m`，其他 6 个用户参数表达式不变。
- [x] 组件 4、实例 8、Joint 8；BOM 数量与条目均未丢失。
- [x] 再次导出到 `/private/tmp/sophicad-updated/model.sophicad.zip`，来源指纹改变，设计 lineage 不变。

## C. 回滚验证

1. 制作一个能通过表达式预检、但会导致几何重建失败的临时更新包。
2. 导入并确认。

- [ ] 插件报告 `compute_failed_rolled_back`。
- [ ] 所有受影响用户参数恢复为导入前表达式。
- [ ] 插件执行第二次 `Compute All`，原设计恢复健康。

## 验收记录

| 项目 | 结果 | 备注 |
|---|---|---|
| Fusion 版本 | `2704.1.36` | macOS，本机真实 Fusion API/UI 验收 |
| 插件版本 | `0.1.0` | |
| 首次导出 | 通过 | 4 Component、8 Occurrence、8 Joint、3 BOM、7 用户参数、11 文件 |
| 参数回写 | 通过 | `l1: 200 mm → 220 mm`，Compute All 成功；原 `.f3d` 尚未保存覆盖 |
| 失败回滚 | 自动化测试通过 | 未对用户真实几何故意制造失败；测试覆盖回滚表达式与二次 Compute All |
| Web | 通过 | 真实包导入、Three.js/URDF 模块、stale 提示、更新包下载均验证 |
| MCP | 通过 | inspect/list/validate/create/compare 均在真实包执行 |
| URDF/约束检查 | 通过 | 更新前后均 `valid: true`、无 error/warning；闭环 sidecar 保留 |

真实对比摘要：仅参数 `l1` 从 `200 mm` 变为 `220 mm`；组件/实例/BOM 无增删，受影响物性与 Joint 原点发生预期变化，总质量从约 `2.826 kg` 变为 `2.952 kg`。

不要提交 `test1.f3d` 或包含专有几何的导出包；只提交下面的脱敏摘要。
