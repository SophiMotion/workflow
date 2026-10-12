import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { generateUrdf, validateUrdfArtifacts } from '@sophicad/core';

import { assertPathMissing, readPackageFile } from '../io/files.js';
import { failure, success } from '../result.js';
import { rootFor } from './read-tools.js';

export async function generateUrdfBundle(input: {
  packagePath: string;
  outputDirectory: string;
  meshUriMode: 'relative' | 'package';
  packageName?: string;
}) {
  let temporary: string | undefined;
  try {
    if (!isAbsolute(input.outputDirectory)) throw Object.assign(new Error('输出目录必须是绝对路径。'), { code: 'absolute_path_required' });
    const output = resolve(input.outputDirectory);
    await assertPathMissing(output);
    const pkg = await readPackageFile(input.packagePath);
    const artifacts = generateUrdf(pkg.model, {
      rootOccurrenceId: rootFor(pkg.model),
      meshUriMode: input.meshUriMode,
      ...(input.packageName ? { packageName: input.packageName } : {}),
    });
    const validation = validateUrdfArtifacts(artifacts);
    const validationErrors = validation.filter((item) => item.severity === 'error');
    if (validationErrors.length) throw Object.assign(new Error('URDF 生成结果校验失败。'), { diagnostics: validationErrors });
    temporary = join(dirname(output), `.${crypto.randomUUID()}.sophicad-urdf`);
    await mkdir(temporary, { recursive: false });
    await writeFile(join(temporary, 'robot.urdf'), artifacts.urdfXml, { flag: 'wx' });
    await writeFile(join(temporary, 'constraints.json'), `${JSON.stringify(artifacts.constraints, null, 2)}\n`, { flag: 'wx' });
    for (const meshPath of artifacts.availableMeshPaths) {
      const bytes = pkg.files.get(meshPath);
      if (!bytes) throw Object.assign(new Error(`数据包缺少 URDF 引用的 mesh：${meshPath}`), { code: 'mesh_missing' });
      const destination = join(temporary, meshPath);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes, { flag: 'wx' });
    }
    await rename(temporary, output);
    temporary = undefined;
    return success('URDF/Isaac bundle 已生成。', {
      outputDirectory: output,
      linkCount: artifacts.links.length,
      jointCount: artifacts.joints.length,
      loopClosureCount: artifacts.constraints.loopClosures.length,
    }, [...artifacts.diagnostics, ...validation], ['在 ROS 2 或 Isaac Sim 中导入 robot.urdf。']);
  } catch (error) {
    if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
    return failure(error);
  }
}
