# Fusion Robot Bridge MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供本地 stdio MCP Server，让 Codex 等 Agent 安全检查 SophiCAD 数据包、分析运动学、提出参数修改、生成更新包和 URDF，而不直接控制 Fusion。

**Architecture:** MCP 层只做参数验证、文件 I/O 和工具结果整形；数据包解析、图、参数、URDF 和比较全部复用 `@sophicad/core`。读工具不修改文件，写工具要求显式不同输出路径并使用原子新文件写入。

**Tech Stack:** Node.js、TypeScript、Model Context Protocol TypeScript SDK、Zod、Vitest

**Spec:** `docs/superpowers/specs/2026-08-28-fusion-threejs-urdf-bridge-design.md`

## Global Constraints

- 只通过 stdio 提供服务，不监听网络端口。
- 不启动、点击或远程控制 Fusion 360。
- 不覆盖输入数据包或输出目录中的现有文件。
- 不执行包内脚本、mesh 路径或外部命令。
- 所有工具返回 `summary`、`data`、`errors`、`warnings`、`nextActions`。
- 文件路径在 Node 适配层解析；Core 保持无文件系统依赖。
- 写工具先构建并校验完整字节，再原子写入新路径。

---

## File Structure

- `mcp/package.json`：server 包与 bin。
- `mcp/src/server.ts`：MCP server 和工具注册。
- `mcp/src/io/files.ts`：安全读取与原子新文件写入。
- `mcp/src/result.ts`：统一结构化结果。
- `mcp/src/tools/inspect-assembly.ts`
- `mcp/src/tools/list-parameters.ts`
- `mcp/src/tools/propose-parameter-changes.ts`
- `mcp/src/tools/create-update-package.ts`
- `mcp/src/tools/analyze-kinematics.ts`
- `mcp/src/tools/generate-urdf.ts`
- `mcp/src/tools/validate-package.ts`
- `mcp/src/tools/compare-versions.ts`
- `mcp/src/cli.ts`：stdio 入口。
- `mcp/tests/`：工具级和 server 协议测试。

### Task 1: MCP Server 骨架与统一结果

**Files:**
- Create: `mcp/package.json`
- Create: `mcp/tsconfig.json`
- Create: `mcp/src/result.ts`
- Create: `mcp/src/server.ts`
- Create: `mcp/src/cli.ts`
- Test: `mcp/tests/server.test.ts`

**Interfaces:**
- Produces: `createSophiCadMcpServer(deps): McpServer`
- Produces: `ToolEnvelope<T>`

- [ ] **Step 1: 安装 MCP SDK 与 Zod**

先创建 `mcp/package.json`，名称固定为 `@sophicad/mcp`，设置 `private: true`、`type: module` 和 `bin.sophicad-mcp: dist/cli.js`。然后运行：

```bash
npm install --workspace mcp @modelcontextprotocol/sdk zod
```

- [ ] **Step 2: 写工具列表和统一 envelope 失败测试**

```ts
it('advertises the eight SophiCAD tools', async () => {
  const client = await connectInMemory(createSophiCadMcpServer(testDeps));
  const result = await client.listTools();
  expect(result.tools.map(tool => tool.name).sort()).toEqual([
    'analyze_kinematics', 'compare_versions', 'create_update_package',
    'generate_urdf', 'inspect_assembly', 'list_parameters',
    'propose_parameter_changes', 'validate_package',
  ]);
});
```

- [ ] **Step 3: 运行测试并确认 server 缺失**

Run: `npm test -- mcp/tests/server.test.ts`

- [ ] **Step 4: 实现 server、stdio CLI 和结果类型**

```ts
export interface ToolEnvelope<T> {
  summary: string;
  data: T | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  nextActions: string[];
}
```

工具错误使用 `isError`，同时 text content 包含精简中文摘要，structured content 包含完整 envelope。

- [ ] **Step 5: 运行测试并提交**

```bash
npm test -- mcp/tests/server.test.ts
git add mcp package.json package-lock.json
git commit -m "feat: add SophiCAD MCP server"
```

### Task 2: 安全文件 I/O

**Files:**
- Create: `mcp/src/io/files.ts`
- Test: `mcp/tests/files.test.ts`

**Interfaces:**
- Produces: `readPackageFile(path): Promise<SophiCadPackage>`
- Produces: `writeNewFileAtomic(path, bytes): Promise<void>`
- Produces: `ensureDistinctPaths(input, output): void`

- [ ] **Step 1: 写相同路径、已存在输出和临时清理测试**

```ts
it('refuses to overwrite the input package', async () => {
  await expect(writeUpdate(inputPath, inputPath, bytes)).rejects.toMatchObject({
    code: 'output_matches_input',
  });
});

it('refuses an existing output file', async () => {
  await expect(writeNewFileAtomic(existingPath, bytes)).rejects.toMatchObject({
    code: 'output_already_exists',
  });
});
```

- [ ] **Step 2: 运行失败测试并实现 realpath/resolve 检查**

Run: `npm test -- mcp/tests/files.test.ts`

输入必须是普通文件；输出父目录必须存在且可写。临时文件位于输出同目录，成功使用 rename，失败清理本次临时文件。

- [ ] **Step 3: 运行测试并提交**

```bash
npm test -- mcp/tests/files.test.ts
git add mcp/src/io mcp/tests/files.test.ts
git commit -m "feat: guard MCP package file access"
```

### Task 3: 只读检查工具

**Files:**
- Create: `mcp/src/tools/inspect-assembly.ts`
- Create: `mcp/src/tools/list-parameters.ts`
- Create: `mcp/src/tools/analyze-kinematics.ts`
- Create: `mcp/src/tools/validate-package.ts`
- Test: `mcp/tests/read-tools.test.ts`

**Interfaces:**
- Produces: four read-only tool handlers accepting `packagePath`

- [ ] **Step 1: 写四连杆摘要、过滤参数和闭环输出测试**

```ts
it('reports one loop closure for the four-bar fixture', async () => {
  const result = await analyzeKinematics({ packagePath: fixturePath });
  expect(result.errors).toEqual([]);
  expect(result.data?.loopJointIds).toEqual(['j-output-ground']);
  expect(result.data?.urdfTreeJointIds).toHaveLength(3);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- mcp/tests/read-tools.test.ts`

- [ ] **Step 3: 实现工具输入 Schema 与 Core 调用**

`list_parameters` 支持 `query`、`editableOnly` 和 `names`，但不接受正则表达式执行。`inspect_assembly` 返回计数、root、BOM、总质量和最多 100 个诊断；完整数据通过 `data` 中的分页字段返回。

- [ ] **Step 4: 运行测试并提交**

```bash
npm test -- mcp/tests/read-tools.test.ts
git add mcp/src/tools mcp/tests/read-tools.test.ts
git commit -m "feat: inspect SophiCAD packages over MCP"
```

### Task 4: 参数提案与更新包工具

**Files:**
- Create: `mcp/src/tools/propose-parameter-changes.ts`
- Create: `mcp/src/tools/create-update-package.ts`
- Test: `mcp/tests/change-tools.test.ts`

**Interfaces:**
- Produces: dry-run proposal and explicit output writer

- [ ] **Step 1: 写 dry-run 不写文件、旧值冲突和 `l1=220 mm` 更新测试**

```ts
it('creates a validated update package without modifying its source', async () => {
  const before = await readFile(fixturePath);
  const result = await createUpdatePackage({
    packagePath: fixturePath,
    outputPath,
    parameterChanges: [{ name: 'l1', oldExpression: '200 mm', newExpression: '220 mm' }],
  });
  expect(result.errors).toEqual([]);
  expect(await readFile(fixturePath)).toEqual(before);
  expect((await readPackageFile(outputPath)).changes?.parameterChanges[0].newExpression).toBe('220 mm');
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- mcp/tests/change-tools.test.ts`

- [ ] **Step 3: 实现 proposal、白名单补丁和新包生成**

提案只返回 normalized changes、受影响实体、errors 和 warnings。生成工具再次校验 source fingerprint、旧表达式、依赖环和完整输出包，不信任之前提案结果。

- [ ] **Step 4: 运行测试并提交**

```bash
npm test -- mcp/tests/change-tools.test.ts
git add mcp/src/tools/propose-parameter-changes.ts mcp/src/tools/create-update-package.ts mcp/tests/change-tools.test.ts
git commit -m "feat: create Fusion update packages over MCP"
```

### Task 5: URDF 生成工具

**Files:**
- Create: `mcp/src/tools/generate-urdf.ts`
- Create: `mcp/src/io/write-urdf-bundle.ts`
- Test: `mcp/tests/generate-urdf.test.ts`

**Interfaces:**
- Produces: explicit new directory containing URDF, constraints and copied meshes

- [ ] **Step 1: 写目录已存在拒绝、ROS/Isaac URI 和闭环 sidecar 测试**

```ts
it('writes an Isaac-relative URDF bundle with the loop sidecar', async () => {
  const result = await generateUrdfTool({ packagePath: fixturePath, outputDirectory, meshUriMode: 'relative' });
  expect(result.errors).toEqual([]);
  expect(await readFile(join(outputDirectory, 'robot.urdf'), 'utf8')).toContain('meshes/collision/');
  expect(JSON.parse(await readFile(join(outputDirectory, 'constraints.json'), 'utf8')).loopClosures).toHaveLength(1);
});
```

- [ ] **Step 2: 运行失败测试并实现 bundle writer**

Run: `npm test -- mcp/tests/generate-urdf.test.ts`

输出目录必须不存在；先写 sibling 临时目录，验证全部引用，再 rename。失败清理临时目录，不删除用户已有目录。

- [ ] **Step 3: 运行测试并提交**

```bash
npm test -- mcp/tests/generate-urdf.test.ts
git add mcp/src/tools/generate-urdf.ts mcp/src/io/write-urdf-bundle.ts mcp/tests/generate-urdf.test.ts
git commit -m "feat: generate ROS and Isaac robot bundles"
```

### Task 6: 版本比较工具

**Files:**
- Create: `packages/core/src/compare/compare-models.ts`
- Create: `mcp/src/tools/compare-versions.ts`
- Test: `packages/core/src/compare/compare-models.test.ts`
- Test: `mcp/tests/compare-versions.test.ts`

**Interfaces:**
- Produces: `compareModels(left, right): ModelComparison`
- Produces: MCP wrapper accepting two package paths

- [ ] **Step 1: 写参数、BOM、质量、实例、Joint 和 mesh hash 变化测试**

```ts
it('reports l1 and mass changes while preserving BOM quantity', () => {
  const result = compareModels(beforeModel, rebuiltModel);
  expect(result.parameters.changed).toContainEqual(expect.objectContaining({ name: 'l1' }));
  expect(result.physicalProperties.changed.length).toBeGreaterThan(0);
  expect(result.bom.changed).toEqual([]);
});
```

- [ ] **Step 2: 运行失败测试并实现稳定分类 diff**

Run: `npm test -- packages/core/src/compare mcp/tests/compare-versions.test.ts`

数值比较使用字段对应公差，默认长度 `1e-9 m`、质量 `1e-9 kg`、惯量 `1e-12 kg·m²`；不通过 JSON 字符串整体比较浮点对象。

- [ ] **Step 3: 运行测试并提交**

```bash
npm test -- packages/core/src/compare mcp/tests/compare-versions.test.ts
git add packages/core/src/compare mcp/src/tools/compare-versions.ts mcp/tests/compare-versions.test.ts
git commit -m "feat: compare Fusion rebuild packages"
```

### Task 7: MCP 配置、协议 E2E 与文档

**Files:**
- Create: `mcp/tests/protocol-e2e.test.ts`
- Create: `mcp/README.md`
- Create: `docs/mcp-tools.md`

**Interfaces:**
- Verifies: real stdio server from compatible MCP client.

- [ ] **Step 1: 写启动子进程、list tools、call tool 和 shutdown E2E**

测试启动构建后的 `mcp/dist/cli.js`，调用 `inspect_assembly` 和 `propose_parameter_changes`，验证进程关闭后无临时文件。

- [ ] **Step 2: 运行 E2E 并确认失败点**

Run: `npm test -- mcp/tests/protocol-e2e.test.ts`

- [ ] **Step 3: 编写安装、Codex MCP 配置和八个工具示例**

文档使用占位路径 `<absolute-package-path>`，不写用户密钥。明确 MCP 不控制 Fusion，用户仍需在 Fusion 点击“导入并重建”。

- [ ] **Step 4: 执行新鲜完整验证**

Run:

```bash
npm run typecheck
npm test
npm run build --workspace mcp
node mcp/dist/cli.js --help
```

Expected: 0 type errors、0 test failures、build exit 0，CLI 输出用法后 exit 0。

- [ ] **Step 5: 提交**

```bash
git diff --check
git add mcp/tests/protocol-e2e.test.ts mcp/README.md docs/mcp-tools.md
git commit -m "docs: document SophiCAD MCP tools"
```
