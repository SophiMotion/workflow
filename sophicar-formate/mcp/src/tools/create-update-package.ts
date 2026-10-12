import { strToU8 } from 'fflate';

import { applyChangesDocument, generateUrdf, readSophiCadPackage, writeSophiCadPackage } from '@sophicad/core';
import type { ParameterChange } from '@sophicad/schema';

import { ensureDistinctPaths, readPackageFile, writeNewFileAtomic } from '../io/files.js';
import { failure, success } from '../result.js';
import { rootFor } from './read-tools.js';

export async function createUpdatePackage(input: {
  packagePath: string;
  outputPath: string;
  parameterChanges: ParameterChange[];
  note?: string;
}) {
  try {
    ensureDistinctPaths(input.packagePath, input.outputPath);
    const pkg = await readPackageFile(input.packagePath);
    const changes = {
      schemaVersion: '1.0.0',
      basePackageId: pkg.manifest.packageId,
      baseFingerprint: pkg.manifest.source.fingerprint,
      targetDesignGuid: pkg.manifest.source.designGuid,
      createdAt: new Date().toISOString(),
      ...(input.note ? { note: input.note } : {}),
      parameterChanges: input.parameterChanges,
      jointChanges: [], robotOverrides: [], bomOverrides: [],
    };
    const patched = applyChangesDocument(pkg.model, changes);
    const urdf = generateUrdf(patched.model, { rootOccurrenceId: rootFor(patched.model), meshUriMode: 'relative' });
    const files = new Map<string, Uint8Array>();
    for (const [path, bytes] of pkg.files) {
      if (path === 'manifest.json' || path === 'model.json' || path === 'changes.json') continue;
      if (path.startsWith('robot/') && (path.endsWith('.urdf') || path.endsWith('constraints.json'))) continue;
      files.set(path, bytes);
    }
    files.set('robot/model.urdf', strToU8(urdf.urdfXml));
    files.set('robot/constraints.json', strToU8(`${JSON.stringify(urdf.constraints, null, 2)}\n`));
    const bytes = await writeSophiCadPackage({
      manifest: {
        ...pkg.manifest,
        packageId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        producer: 'SophiCAD MCP',
        producerVersion: '0.1.0',
        files: [],
      },
      model: pkg.model,
      changes,
      files,
    });
    await readSophiCadPackage(bytes);
    await writeNewFileAtomic(input.outputPath, bytes);
    return success('更新包已生成，源数据包未修改。', {
      outputPath: input.outputPath,
      changedEntityIds: patched.changedEntityIds,
      packageBytes: bytes.byteLength,
    }, urdf.diagnostics, ['在 Fusion 360 中点击“导入并重建”。']);
  } catch (error) { return failure(error); }
}
