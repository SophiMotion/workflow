# SophiCAD MCP 工具

所有工具都返回统一结构：`summary`、`data`、`errors`、`warnings`、`nextActions`。所有路径使用绝对路径。

| 工具 | 用途 | 是否写文件 |
|---|---|---|
| `inspect_assembly` | 装配数量、BOM、总质量、根节点和连通分量 | 否 |
| `list_parameters` | 按名称、文本和可写性过滤 Fusion 用户参数 | 否 |
| `propose_parameter_changes` | 校验旧表达式、可写性和参数依赖，返回受影响实体 | 否 |
| `create_update_package` | 重新校验后生成供 Fusion“导入并重建”的新更新包 | 是，新文件 |
| `analyze_kinematics` | 输出 URDF 生成树、闭环 Joint、断开 Joint 和自由度 | 否 |
| `generate_urdf` | 生成 `robot.urdf`、`constraints.json` 和引用 mesh | 是，新目录 |
| `validate_package` | 校验 ZIP、manifest、哈希、Schema、装配图和 URDF | 否 |
| `compare_versions` | 比较两次 Fusion 导出的参数、BOM、实例、Joint 与物理属性 | 否 |

## 参数修改示例

先调用 `propose_parameter_changes`：

```json
{
  "packagePath": "<absolute-package-path>",
  "parameterChanges": [
    { "name": "l1", "oldExpression": "200 mm", "newExpression": "220 mm" }
  ]
}
```

确认结果后调用 `create_update_package`，增加：

```json
{
  "outputPath": "<absolute-new-output-path>/four-bar-update.sophicad.zip"
}
```

最后由用户回到 Fusion 360，点击插件的“导入并重建”。MCP 不接管 Fusion UI。

## URDF / Isaac 示例

```json
{
  "packagePath": "<absolute-package-path>",
  "outputDirectory": "<absolute-new-output-directory>",
  "meshUriMode": "relative"
}
```

闭环机构不会被错误写成 URDF 环：生成树写入 `robot.urdf`，被切断的 Joint 写入 `constraints.json.loopClosures`，供 Isaac 或后处理模块恢复约束语义。
