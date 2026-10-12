# SophiCAD 数据包规范 1.x

`.sophicad.zip` 是 Fusion 插件、Web 工作台和 MCP Server 之间的本地交换格式。扩展名是 `.zip`；包内只能包含声明过的相对路径文件。

## 目录

```text
manifest.json
model.json
changes.json                  # 更新包才有
meshes/
  visual/<component-id>.glb
  collision/<component-id>.stl
robot/
  robot.urdf
  constraints.json
reports/
  validation.json
```

`model.json` 与 `changes.json` 是权威数据。URDF、constraints 和报告可由 Core 重新生成。为避免自引用哈希，`manifest.files` 声明并校验除 `manifest.json` 自身之外的全部文件；任何未声明文件都会被拒绝。

## 单位和坐标

- 交换长度：m
- 交换质量：kg
- 交换角度：rad
- 交换惯量：kg·m²
- 机器人坐标：X 前、Y 左、Z 上
- 4×4 变换：长度 16、行主序

Fusion 原始参数表达式和显示单位另外保存。例如 `l1` 同时保存 `expression: "200 mm"` 与 `valueSi: 0.2`。Web 不重新解释完整 Fusion 表达式语言。

## 最小更新文件

```json
{
  "schemaVersion": "1.0.0",
  "basePackageId": "package-uuid",
  "baseFingerprint": "64-character-lowercase-sha256",
  "targetDesignGuid": "persistent-fusion-design-guid",
  "createdAt": "2026-08-28T00:00:00.000Z",
  "parameterChanges": [
    {
      "name": "l1",
      "oldExpression": "200 mm",
      "newExpression": "220 mm",
      "expectedOldValueSi": 0.2
    }
  ],
  "jointChanges": [],
  "robotOverrides": [],
  "bomOverrides": []
}
```

Fusion 导入器必须验证 `targetDesignGuid`、基础指纹和旧表达式，之后才允许写回和 `Compute All`。

## URDF 与闭环

URDF 只能表达一棵运动树。Core 从选择的 root 开始生成确定性 spanning tree；形成环的 Joint 不进入 URDF，而是完整写入 `robot/constraints.json`。四连杆 fixture 保留三个 URDF Joint，`j-output-ground` 作为 loop closure。

球、圆柱、平面和 pin-slot Joint 使用虚拟 link/joint 分解。无法可靠表达的类型降级为 fixed，并产生结构化 warning；不得静默丢弃。

## ZIP 安全限制

默认读取限制：

- 最多 4096 个文件；
- 单文件解压后最多 128 MiB；
- 总解压大小最多 1 GiB；
- 拒绝绝对路径、盘符、反斜杠、空路径段、`.` 和 `..`；
- 拒绝哈希、字节数、Schema 或必需文件不匹配；
- 拒绝 `manifest.files` 未声明的额外文件。

写包按路径排序，JSON 使用两个空格缩进和结尾换行，ZIP 时间戳固定，以便测试和版本比较获得稳定结果。

## 兼容策略

- 读取器支持 Schema `1.x`。
- 未识别的主版本立即返回 `unsupported_schema_major`。
- 1.x 新增可选字段可以向后兼容。
- 删除字段、改变单位、改变矩阵布局或改变字段语义必须升级主版本。
