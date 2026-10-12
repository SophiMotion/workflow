# Fusion Robot Bridge Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立版本化 SophiCAD 数据包、共享 TypeScript 核心、确定性 URDF/闭环算法和四连杆 fixture，作为 Fusion、Web 与 MCP 的共同基础。

**Architecture:** 使用 npm workspaces 管理 `packages/schema` 与 `packages/core`。Schema 只定义交换契约；Core 是不依赖 UI、Node 文件系统或 Fusion API 的纯逻辑层，通过 `Uint8Array` 读写安全 ZIP，并输出结构化诊断。

**Tech Stack:** TypeScript、npm workspaces、Vitest、Ajv、fflate、@noble/hashes、fast-xml-parser

**Spec:** `docs/superpowers/specs/2026-08-28-fusion-threejs-urdf-bridge-design.md`

## Global Constraints

- 交换计算单位固定为 m、kg、rad、kg·m²；Fusion 原始表达式原样保留。
- 矩阵固定为长度 16 的行主序数组。
- 包主版本不兼容、路径穿越、哈希错误和缺失权威文件必须阻止读取。
- `model.json` 与 `changes.json` 是往返权威数据；URDF 和报告可再生成。
- Core 不访问文件系统，不执行外部命令，不依赖 React 或 Autodesk API。
- 所有新增行为遵循先失败测试、后最小实现的 TDD 顺序。

---

## File Structure

- `package.json`：workspace、统一脚本和开发依赖。
- `tsconfig.base.json`：共享严格 TypeScript 配置。
- `packages/schema/src/types.ts`：交换类型。
- `packages/schema/src/schemas.ts`：JSON Schema。
- `packages/schema/src/validate.ts`：Ajv 验证入口。
- `packages/core/src/package/read-package.ts`：安全 ZIP 读取。
- `packages/core/src/package/write-package.ts`：确定性 ZIP 写入与哈希。
- `packages/core/src/graph/assembly-graph.ts`：root、闭环和主树算法。
- `packages/core/src/parameters/changes.ts`：参数依赖与补丁。
- `packages/core/src/physics/units.ts`：长度、角度、惯量转换。
- `packages/core/src/urdf/generate-urdf.ts`：URDF 与 constraints 生成。
- `packages/core/src/kinematics/four-bar.ts`：平面四连杆求解器。
- `fixtures/four-bar/`：可重复测试数据包内容与预期结果。

### Task 1: Workspace 与可验证 Schema

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`
- Create: `packages/schema/src/types.ts`
- Create: `packages/schema/src/schemas.ts`
- Create: `packages/schema/src/validate.ts`
- Test: `packages/schema/src/validate.test.ts`

**Interfaces:**
- Produces: `validateManifest(value): ValidationResult<PackageManifest>`
- Produces: `validateModel(value): ValidationResult<ModelDocument>`
- Produces: `validateChanges(value): ValidationResult<ChangesDocument>`

- [ ] **Step 1: 初始化 workspace 配置并安装精确依赖**

Run:

```bash
npm init -y
npm install -D typescript vitest @types/node
npm install ajv ajv-formats fflate @noble/hashes fast-xml-parser
```

将根 `package.json` 改为 private workspaces，并添加：

```json
{
  "private": true,
  "workspaces": ["packages/*", "web", "mcp"],
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -b --pretty false",
    "verify": "npm run typecheck && npm test"
  }
}
```

- [ ] **Step 2: 写 Schema 失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { validateManifest, validateModel } from './validate';

describe('SophiCAD schema', () => {
  it('rejects an unsupported package major version', () => {
    const result = validateManifest({ schemaVersion: '2.0.0' });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('unsupported_schema_major');
  });

  it('rejects a model whose matrix is not 16 row-major values', () => {
    const result = validateModel({
      units: { length: 'm', mass: 'kg', angle: 'rad' },
      parameters: { user: [], model: [] },
      components: [],
      occurrences: [{ id: 'o1', transform: [1, 0, 0] }],
      joints: [], physicalProperties: [], bom: [], robot: {},
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: 运行测试并确认因入口缺失失败**

Run: `npx vitest run packages/schema/src/validate.test.ts`

Expected: FAIL，提示无法解析 `./validate`。

- [ ] **Step 4: 实现最小交换类型、Schema 和验证入口**

关键类型必须固定：

```ts
export type Matrix4RowMajor = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
  entityId?: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; errors: Diagnostic[] };
```

`PackageManifest`、`ModelDocument`、`ChangesDocument` 的字段名必须逐项匹配设计文档第 5 节。Ajv 开启 `allErrors: true` 和 `strict: true`；主版本不是 `1` 时在 JSON Schema 校验前返回 `unsupported_schema_major`。

- [ ] **Step 5: 运行测试、类型检查并提交**

Run: `npx vitest run packages/schema/src/validate.test.ts && npm run typecheck`

Expected: PASS，0 个 TypeScript 错误。

```bash
git add package.json package-lock.json tsconfig.base.json packages/schema
git commit -m "feat: define SophiCAD package schema"
```

### Task 2: 安全且确定性的数据包读写

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/package/read-package.ts`
- Create: `packages/core/src/package/write-package.ts`
- Create: `packages/core/src/package/hash.ts`
- Test: `packages/core/src/package/package-io.test.ts`

**Interfaces:**
- Consumes: `validateManifest`、`validateModel`、`validateChanges`
- Produces: `readSophiCadPackage(bytes, limits?): Promise<SophiCadPackage>`
- Produces: `writeSophiCadPackage(input): Promise<Uint8Array>`

- [ ] **Step 1: 写路径穿越、大小限制和往返失败测试**

```ts
it('rejects zip-slip paths before exposing any file', async () => {
  const bytes = zipSync({ '../escape.txt': strToU8('bad') });
  await expect(readSophiCadPackage(bytes)).rejects.toMatchObject({
    code: 'unsafe_archive_path',
  });
});

it('round-trips authority documents and verifies hashes', async () => {
  const bytes = await writeSophiCadPackage(validInput);
  const result = await readSophiCadPackage(bytes);
  expect(result.model.occurrences).toEqual(validInput.model.occurrences);
  expect(result.diagnostics).toEqual([]);
});
```

- [ ] **Step 2: 运行测试并确认缺少读写函数失败**

Run: `npx vitest run packages/core/src/package/package-io.test.ts`

Expected: FAIL，提示 `readSophiCadPackage`/`writeSophiCadPackage` 不存在。

- [ ] **Step 3: 实现安全解压和确定性写包**

默认限制：最多 4096 个文件、单文件 128 MiB、总解压 1 GiB。路径必须是 POSIX 相对路径，拒绝空段、`.`、`..`、反斜杠、盘符和前导 `/`。写包时按路径字典序排列，JSON 使用两空格缩进与结尾换行；SHA-256 使用 `@noble/hashes`。

```ts
export interface PackageLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface SophiCadPackage {
  manifest: PackageManifest;
  model: ModelDocument;
  changes?: ChangesDocument;
  files: ReadonlyMap<string, Uint8Array>;
  diagnostics: Diagnostic[];
}
```

- [ ] **Step 4: 增加损坏哈希与缺文件用例并保持通过**

Run: `npx vitest run packages/core/src/package/package-io.test.ts`

Expected: 路径穿越、超限、损坏哈希、缺少 `manifest.json`/`model.json` 均被拒绝；正常往返通过。

- [ ] **Step 5: 提交**

```bash
git add packages/core
git commit -m "feat: add safe SophiCAD package IO"
```

### Task 3: 装配图、root 和闭环主树

**Files:**
- Create: `packages/core/src/graph/assembly-graph.ts`
- Test: `packages/core/src/graph/assembly-graph.test.ts`

**Interfaces:**
- Produces: `analyzeAssemblyGraph(model, options): AssemblyAnalysis`
- Produces: `buildUrdfSpanningTree(model, rootOccurrenceId, lockedJointIds?): SpanningTreeResult`

- [ ] **Step 1: 写四连杆确定性切边失败测试**

```ts
it('keeps three joints and records one loop closure for a four bar', () => {
  const result = buildUrdfSpanningTree(fourBarModel, 'ground');
  expect(result.treeJointIds).toEqual(['j-ground-input', 'j-input-coupler', 'j-coupler-output']);
  expect(result.loopJointIds).toEqual(['j-output-ground']);
  expect(result.rootOccurrenceId).toBe('ground');
});
```

- [ ] **Step 2: 运行测试并确认缺少算法失败**

Run: `npx vitest run packages/core/src/graph/assembly-graph.test.ts`

Expected: FAIL，函数未定义。

- [ ] **Step 3: 实现图分析与稳定排序**

算法使用 joint ID 作为最终稳定排序键。优先级依次为用户锁定、rigid、未抑制明确类型、距 root 更近。结果必须包含 roots、connectedComponents、degreesOfFreedom、treeJointIds、loopJointIds、orphanOccurrenceIds 和 diagnostics。

- [ ] **Step 4: 增加多 root、孤立实例、重复 Joint 和锁定切边冲突测试**

Run: `npx vitest run packages/core/src/graph/assembly-graph.test.ts`

Expected: 全部 PASS，输出顺序在输入数组乱序后保持一致。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/graph
git commit -m "feat: analyze assembly loops and URDF tree"
```

### Task 4: 参数依赖与更新补丁

**Files:**
- Create: `packages/core/src/parameters/dependencies.ts`
- Create: `packages/core/src/parameters/changes.ts`
- Test: `packages/core/src/parameters/changes.test.ts`

**Interfaces:**
- Produces: `sortParameterChanges(model, changes): SortedParameterChangeResult`
- Produces: `applyChangesDocument(model, changes): PatchedModelResult`

- [ ] **Step 1: 写依赖排序、旧值冲突和循环失败测试**

```ts
it('orders base dimensions before dependent expressions', () => {
  const result = sortParameterChanges(model, [changeL2, changeL1]);
  expect(result.ordered.map(change => change.name)).toEqual(['l1', 'l2']);
});

it('rejects a stale expected expression', () => {
  expect(() => applyChangesDocument(model, staleChangeSet)).toThrowErrorMatchingObject({
    code: 'parameter_precondition_failed',
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run packages/core/src/parameters/changes.test.ts`

- [ ] **Step 3: 实现基于已导出 dependency 列表的拓扑排序和字段白名单补丁**

不得在 TypeScript 中重新解释完整 Fusion 表达式语言；依赖来自插件导出。允许修改字段仅包括用户参数表达式、支持的 Joint 限位、robot overrides 和非数量 BOM 元数据。

- [ ] **Step 4: 运行测试并提交**

Run: `npx vitest run packages/core/src/parameters/changes.test.ts`

```bash
git add packages/core/src/parameters
git commit -m "feat: validate parameter update patches"
```

### Task 5: 单位、位姿和惯量

**Files:**
- Create: `packages/core/src/physics/units.ts`
- Create: `packages/core/src/physics/inertia.ts`
- Test: `packages/core/src/physics/physics.test.ts`

**Interfaces:**
- Produces: `convertLength(value, from, to)`、`convertAngle(...)`
- Produces: `transformInertia(properties, transform): PhysicalProperties`
- Produces: `isPositiveDefiniteInertia(tensor): boolean`

- [ ] **Step 1: 写 cm→m、kg/cm²→kg·m²、平行轴定理和非正定惯量测试**

```ts
it('converts Fusion kg/cm² to kg·m²', () => {
  expect(convertInertia(250, 'kg*cm^2', 'kg*m^2')).toBeCloseTo(0.025, 12);
});

it('rejects a physically impossible tensor', () => {
  expect(isPositiveDefiniteInertia([[1, 2, 0], [2, 1, 0], [0, 0, -1]])).toBe(false);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npx vitest run packages/core/src/physics/physics.test.ts`

- [ ] **Step 3: 实现明确单位表、旋转惯量和重心平移**

仅支持 Schema 声明的单位；未知单位返回 `unsupported_unit`，不得猜测。矩阵运算使用独立纯函数并检查有限数。

- [ ] **Step 4: 运行测试并提交**

```bash
npx vitest run packages/core/src/physics/physics.test.ts
git add packages/core/src/physics
git commit -m "feat: normalize poses and inertial data"
```

### Task 6: URDF 与 constraints 生成

**Files:**
- Create: `packages/core/src/urdf/names.ts`
- Create: `packages/core/src/urdf/generate-urdf.ts`
- Create: `packages/core/src/urdf/validate-urdf.ts`
- Test: `packages/core/src/urdf/generate-urdf.test.ts`

**Interfaces:**
- Consumes: `buildUrdfSpanningTree`、physics utilities
- Produces: `generateUrdf(model, options): UrdfArtifacts`
- Produces: `validateUrdfArtifacts(artifacts): Diagnostic[]`

- [ ] **Step 1: 写单根树、唯一安全名称、mesh 引用和闭环 sidecar 测试**

```ts
it('emits a tree URDF and preserves the cut loop in constraints', () => {
  const result = generateUrdf(fourBarModel, { rootOccurrenceId: 'ground', meshUriMode: 'relative' });
  expect(result.urdfXml).toContain('<robot name="four_bar">');
  expect(result.urdfXml.match(/<joint /g)).toHaveLength(3);
  expect(result.constraints.loopClosures.map(item => item.sourceJointId))
    .toEqual(['j-output-ground']);
  expect(validateUrdfArtifacts(result)).toEqual([]);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `npx vitest run packages/core/src/urdf/generate-urdf.test.ts`

- [ ] **Step 3: 实现固定、旋转、连续、移动和复合 Joint 映射**

球、圆柱、平面和 pin-slot 通过确定性虚拟 link/joint 名称分解；无法可靠分解时使用用户选择的 fixed 降级并生成 warning。XML 属性必须转义，数值使用稳定的最多 12 位有效数字格式。

- [ ] **Step 4: 解析生成 XML 并验证所有父子、质量、惯量与 mesh**

Run: `npx vitest run packages/core/src/urdf/generate-urdf.test.ts`

Expected: 生成 XML 可由 `fast-xml-parser` 严格解析，所有引用闭合。

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/urdf
git commit -m "feat: generate URDF with loop constraints"
```

### Task 7: 四连杆 fixture 与闭环求解器

**Files:**
- Create: `fixtures/four-bar/model.json`
- Create: `fixtures/four-bar/manifest.template.json`
- Create: `fixtures/four-bar/robot/expected.urdf`
- Create: `fixtures/four-bar/robot/expected.constraints.json`
- Create: `packages/core/src/kinematics/four-bar.ts`
- Test: `packages/core/src/kinematics/four-bar.test.ts`

**Interfaces:**
- Produces: `solvePlanarFourBar(input): FourBarSolution`

- [ ] **Step 1: 建立与截图一致的 fixture 数据**

用户参数必须包含：`w1=20 mm`、`w2=20 mm`、`l1=200 mm`、`l2=250 mm`、`d=10 mm`、`t1=20 mm`、`t2=20 mm`。fixture 包含四个连杆 occurrence、四个旋转 Joint、一个闭环和稳定 ID。

- [ ] **Step 2: 写两个装配分支、不可达构型和连续角测试**

```ts
it('solves the open branch and closes both moving pivots', () => {
  const result = solvePlanarFourBar({ ground: 0.25, input: 0.2, coupler: 0.25, output: 0.2, inputAngle: 0.7, branch: 'open' });
  expect(distance(result.couplerPoint, result.outputPoint)).toBeCloseTo(0.25, 8);
});

it('reports an unreachable linkage without NaN coordinates', () => {
  const result = solvePlanarFourBar({ ground: 0.5, input: 0.02, coupler: 0.02, output: 0.02, inputAngle: 0, branch: 'open' });
  expect(result.ok).toBe(false);
  expect(result.diagnostic.code).toBe('four_bar_unreachable');
});
```

- [ ] **Step 3: 运行失败测试并实现圆交点闭环求解**

Run: `npx vitest run packages/core/src/kinematics/four-bar.test.ts`

实现必须显式处理相切、无交点和输入角跨 ±π 的连续性。

- [ ] **Step 4: 生成 fixture 预期 URDF/constraints 并验证**

Run: `npx vitest run packages/core/src/kinematics/four-bar.test.ts packages/core/src/urdf/generate-urdf.test.ts`

- [ ] **Step 5: 提交**

```bash
git add fixtures/four-bar packages/core/src/kinematics
git commit -m "test: add four-bar reference model"
```

### Task 8: Foundation 文档和全量验证

**Files:**
- Create: `README.md`
- Create: `docs/data-package.md`
- Create: `packages/core/src/index.ts`
- Create: `packages/schema/src/index.ts`

**Interfaces:**
- Produces: public exports consumed by Fusion fixture generation, Web and MCP plans.

- [ ] **Step 1: 写公共导出 smoke test**

```ts
import { generateUrdf, readSophiCadPackage } from '@sophicad/core';
import { validateModel } from '@sophicad/schema';

it('exposes the supported foundation API', () => {
  expect(generateUrdf).toBeTypeOf('function');
  expect(readSophiCadPackage).toBeTypeOf('function');
  expect(validateModel).toBeTypeOf('function');
});
```

- [ ] **Step 2: 运行失败测试，补齐 index exports 与 workspace paths**

Run: `npm test -- packages/core/src/index.test.ts`

- [ ] **Step 3: 记录包结构、字段、单位、坐标、闭环和兼容策略**

`docs/data-package.md` 必须包含完整目录示例、读写安全限制、主版本策略和最小 `changes.json` 示例，不复制设计文档中的产品背景。

- [ ] **Step 4: 运行新鲜全量验证**

Run: `npm run verify`

Expected: TypeScript 0 errors，Vitest 0 failures。

- [ ] **Step 5: 检查变更并提交**

```bash
git diff --check
git add README.md docs/data-package.md packages/core/src/index.ts packages/schema/src/index.ts
git commit -m "docs: document SophiCAD foundation"
```
