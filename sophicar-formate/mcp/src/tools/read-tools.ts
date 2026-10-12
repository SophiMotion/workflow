import {
  analyzeAssemblyGraph,
  applyChangesDocument,
  buildUrdfSpanningTree,
  validateUrdfArtifacts,
  generateUrdf,
} from '@sophicad/core';
import type { ParameterChange } from '@sophicad/schema';

import { readPackageFile } from '../io/files.js';
import { failure, success, type ToolEnvelope } from '../result.js';

export interface PackagePathInput { packagePath: string }

function rootFor(model: Awaited<ReturnType<typeof readPackageFile>>['model']): string {
  return model.robot.rootOccurrenceId
    ?? model.occurrences.find((item) => item.grounded)?.id
    ?? model.occurrences[0]?.id
    ?? '';
}

export async function inspectAssembly({ packagePath }: PackagePathInput): Promise<ToolEnvelope<{
  packageId: string; documentName: string; componentCount: number; occurrenceCount: number;
  jointCount: number; rootOccurrenceIds: string[]; connectedComponents: string[][];
  degreesOfFreedom: number; totalMassKg: number; bom: unknown[];
}>> {
  try {
    const pkg = await readPackageFile(packagePath);
    const graph = analyzeAssemblyGraph(pkg.model);
    return success('装配体检查完成。', {
      packageId: pkg.manifest.packageId,
      documentName: pkg.manifest.source.documentName,
      componentCount: pkg.model.components.length,
      occurrenceCount: pkg.model.occurrences.length,
      jointCount: pkg.model.joints.length,
      rootOccurrenceIds: graph.roots,
      connectedComponents: graph.connectedComponents,
      degreesOfFreedom: graph.degreesOfFreedom,
      totalMassKg: pkg.model.physicalProperties.reduce((sum, item) => sum + item.massKg, 0),
      bom: pkg.model.bom.slice(0, 500),
    }, graph.diagnostics.filter((item) => item.severity === 'warning'));
  } catch (error) { return failure(error, ['确认路径为有效的 .sophicad.zip 数据包。']); }
}

export async function listParameters(input: PackagePathInput & { query?: string; editableOnly?: boolean; names?: string[] }) {
  try {
    const pkg = await readPackageFile(input.packagePath);
    const names = input.names ? new Set(input.names) : undefined;
    const query = input.query?.trim().toLocaleLowerCase();
    const parameters = pkg.model.parameters.user.filter((item) =>
      (!input.editableOnly || item.writable)
      && (!names || names.has(item.name))
      && (!query || `${item.name} ${item.comment ?? ''}`.toLocaleLowerCase().includes(query)));
    return success(`返回 ${parameters.length} 个用户参数。`, { parameters });
  } catch (error) { return failure(error); }
}

export async function analyzeKinematics({ packagePath }: PackagePathInput) {
  try {
    const pkg = await readPackageFile(packagePath);
    const rootOccurrenceId = rootFor(pkg.model);
    const tree = buildUrdfSpanningTree(pkg.model, rootOccurrenceId);
    return success('运动学拓扑分析完成。', {
      rootOccurrenceId,
      urdfTreeJointIds: tree.treeJointIds,
      loopJointIds: tree.loopJointIds,
      disconnectedJointIds: tree.disconnectedJointIds,
      degreesOfFreedom: analyzeAssemblyGraph(pkg.model).degreesOfFreedom,
    }, tree.diagnostics.filter((item) => item.severity === 'warning'));
  } catch (error) { return failure(error); }
}

export async function validatePackage({ packagePath }: PackagePathInput) {
  try {
    const pkg = await readPackageFile(packagePath);
    const rootOccurrenceId = rootFor(pkg.model);
    const graph = analyzeAssemblyGraph(pkg.model);
    const urdf = generateUrdf(pkg.model, { rootOccurrenceId, meshUriMode: 'relative' });
    const diagnostics = [...graph.diagnostics, ...urdf.diagnostics, ...validateUrdfArtifacts(urdf)];
    const errors = diagnostics.filter((item) => item.severity === 'error');
    const warnings = diagnostics.filter((item) => item.severity === 'warning').slice(0, 100);
    return {
      summary: errors.length ? `校验发现 ${errors.length} 个错误。` : '数据包校验通过。',
      data: { valid: errors.length === 0, fileCount: pkg.files.size, packageId: pkg.manifest.packageId },
      errors: errors.slice(0, 100), warnings, nextActions: errors.length ? ['回到 Fusion 运行“诊断并导出”。'] : [],
    };
  } catch (error) { return failure(error); }
}

export async function proposeParameterChanges(input: PackagePathInput & { parameterChanges: ParameterChange[] }) {
  try {
    const pkg = await readPackageFile(input.packagePath);
    const changes = {
      schemaVersion: '1.0.0',
      basePackageId: pkg.manifest.packageId,
      baseFingerprint: pkg.manifest.source.fingerprint,
      targetDesignGuid: pkg.manifest.source.designGuid,
      createdAt: new Date().toISOString(),
      parameterChanges: input.parameterChanges,
      jointChanges: [], robotOverrides: [], bomOverrides: [],
    };
    const patched = applyChangesDocument(pkg.model, changes);
    return success('参数修改提案校验通过；尚未写入文件。', {
      normalizedChanges: changes.parameterChanges,
      changedEntityIds: patched.changedEntityIds,
    }, patched.diagnostics, ['调用 create_update_package 并指定一个不存在的输出路径。']);
  } catch (error) { return failure(error, ['重新读取参数当前表达式后再提交提案。']); }
}

export { rootFor };
