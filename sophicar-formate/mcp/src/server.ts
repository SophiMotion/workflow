import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { ToolEnvelope } from './result.js';
import { compareVersions } from './tools/compare-versions.js';
import { createUpdatePackage } from './tools/create-update-package.js';
import { generateUrdfBundle } from './tools/generate-urdf.js';
import {
  analyzeKinematics,
  inspectAssembly,
  listParameters,
  proposeParameterChanges,
  validatePackage,
} from './tools/read-tools.js';

export const SOPHICAD_TOOL_NAMES = [
  'inspect_assembly', 'list_parameters', 'propose_parameter_changes', 'create_update_package',
  'analyze_kinematics', 'generate_urdf', 'validate_package', 'compare_versions',
] as const;

const packagePath = z.string().min(1).describe('SophiCAD 数据包绝对路径');
const parameterChange = z.object({
  name: z.string().min(1), oldExpression: z.string(), newExpression: z.string().min(1),
  expectedOldValueSi: z.number().nullable().optional(),
});

function cleanParameterChanges(values: z.infer<typeof parameterChange>[]) {
  return values.map((item) => ({
    name: item.name,
    oldExpression: item.oldExpression,
    newExpression: item.newExpression,
    ...(item.expectedOldValueSi !== undefined ? { expectedOldValueSi: item.expectedOldValueSi } : {}),
  }));
}

function toolResult(envelope: ToolEnvelope<unknown>) {
  return {
    content: [{ type: 'text' as const, text: envelope.summary }],
    structuredContent: envelope as unknown as Record<string, unknown>,
    isError: envelope.errors.length > 0,
  };
}

export function createSophiCadMcpServer(): McpServer {
  const server = new McpServer({ name: 'sophicad-mcp', version: '0.1.0' });
  server.registerTool('inspect_assembly', {
    description: '检查 Fusion 装配体、BOM、质量与连接拓扑。', inputSchema: { packagePath },
  }, async (input) => toolResult(await inspectAssembly(input)));
  server.registerTool('list_parameters', {
    description: '列出和过滤 Fusion 用户参数。',
    inputSchema: { packagePath, query: z.string().optional(), editableOnly: z.boolean().optional(), names: z.array(z.string()).optional() },
  }, async (input) => toolResult(await listParameters({
    packagePath: input.packagePath,
    ...(input.query !== undefined ? { query: input.query } : {}),
    ...(input.editableOnly !== undefined ? { editableOnly: input.editableOnly } : {}),
    ...(input.names !== undefined ? { names: input.names } : {}),
  })));
  server.registerTool('propose_parameter_changes', {
    description: '干运行校验参数修改，不写入文件。', inputSchema: { packagePath, parameterChanges: z.array(parameterChange).min(1) },
  }, async (input) => toolResult(await proposeParameterChanges({
    packagePath: input.packagePath,
    parameterChanges: cleanParameterChanges(input.parameterChanges),
  })));
  server.registerTool('create_update_package', {
    description: '在新路径生成由 Fusion 点击导入并重建的更新包。',
    inputSchema: { packagePath, outputPath: z.string().min(1), parameterChanges: z.array(parameterChange).min(1), note: z.string().optional() },
  }, async (input) => toolResult(await createUpdatePackage({
    packagePath: input.packagePath,
    outputPath: input.outputPath,
    parameterChanges: cleanParameterChanges(input.parameterChanges),
    ...(input.note !== undefined ? { note: input.note } : {}),
  })));
  server.registerTool('analyze_kinematics', {
    description: '分析 URDF 生成树、自由度和闭环约束。', inputSchema: { packagePath },
  }, async (input) => toolResult(await analyzeKinematics(input)));
  server.registerTool('generate_urdf', {
    description: '向不存在的新目录生成 ROS/Isaac URDF、闭环 sidecar 和 meshes。',
    inputSchema: {
      packagePath, outputDirectory: z.string().min(1), meshUriMode: z.enum(['relative', 'package']).default('relative'),
      packageName: z.string().optional(),
    },
  }, async (input) => toolResult(await generateUrdfBundle({
    packagePath: input.packagePath,
    outputDirectory: input.outputDirectory,
    meshUriMode: input.meshUriMode,
    ...(input.packageName !== undefined ? { packageName: input.packageName } : {}),
  })));
  server.registerTool('validate_package', {
    description: '校验包 Schema、哈希、装配图和 URDF。', inputSchema: { packagePath },
  }, async (input) => toolResult(await validatePackage(input)));
  server.registerTool('compare_versions', {
    description: '比较两次 Fusion 导出中的参数、BOM、实例、Joint 与物理属性。',
    inputSchema: { leftPackagePath: packagePath, rightPackagePath: packagePath },
  }, async (input) => toolResult(await compareVersions(input)));
  return server;
}
