import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { readSophiCadPackage } from './read-package.js';

describe('generated four-bar SophiCAD package', () => {
  it('is a validated package containing parameters, meshes, URDF and constraints', async () => {
    const bytes = await readFile(new URL('../../../../fixtures/generated/four-bar.sophicad.zip', import.meta.url));

    const packageData = await readSophiCadPackage(bytes);

    expect(packageData.model.parameters.user.map((parameter) => parameter.name)).toEqual([
      'w1', 'w2', 'l1', 'l2', 'd', 't1', 't2',
    ]);
    expect(packageData.files.has('robot/robot.urdf')).toBe(true);
    expect(packageData.files.has('robot/constraints.json')).toBe(true);
    expect(packageData.files.has('meshes/collision/ground.stl')).toBe(true);
    expect(packageData.changes).toBeUndefined();
  });
});
