import { compareModels } from '@sophicad/core';

import { readPackageFile } from '../io/files.js';
import { failure, success } from '../result.js';

export async function compareVersions(input: { leftPackagePath: string; rightPackagePath: string }) {
  try {
    const [left, right] = await Promise.all([
      readPackageFile(input.leftPackagePath),
      readPackageFile(input.rightPackagePath),
    ]);
    const comparison = compareModels(left.model, right.model);
    return success('两个 Fusion 数据包的结构化比较已完成。', {
      leftPackageId: left.manifest.packageId,
      rightPackageId: right.manifest.packageId,
      comparison,
      sourceFingerprintChanged: left.manifest.source.fingerprint !== right.manifest.source.fingerprint,
    });
  } catch (error) { return failure(error); }
}
