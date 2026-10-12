import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { readSophiCadPackage } from '@sophicad/core';
import { describe, expect, it } from 'vitest';

import { createUpdatePackage } from '../src/tools/create-update-package.js';
import { generateUrdfBundle } from '../src/tools/generate-urdf.js';

const fixturePath = resolve(import.meta.dirname, '../../fixtures/generated/four-bar.sophicad.zip');

describe('write tools', () => {
  it('creates a validated update package without modifying its source', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sophicad-update-'));
    const outputPath = join(directory, 'four-bar-update.sophicad.zip');
    const before = await readFile(fixturePath);
    const result = await createUpdatePackage({
      packagePath: fixturePath,
      outputPath,
      parameterChanges: [{ name: 'l1', oldExpression: '200 mm', newExpression: '220 mm' }],
    });
    expect(result.errors).toEqual([]);
    expect(await readFile(fixturePath)).toEqual(before);
    const output = await readSophiCadPackage(await readFile(outputPath));
    expect(output.changes?.parameterChanges[0]?.newExpression).toBe('220 mm');
  });

  it('writes a relative URDF bundle and refuses an existing directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sophicad-urdf-'));
    const outputDirectory = join(directory, 'robot-output');
    const result = await generateUrdfBundle({
      packagePath: fixturePath,
      outputDirectory,
      meshUriMode: 'relative',
    });
    expect(result.errors).toEqual([]);
    expect(await readFile(join(outputDirectory, 'robot.urdf'), 'utf8')).toContain('meshes/collision/');
    expect(JSON.parse(await readFile(join(outputDirectory, 'constraints.json'), 'utf8').then(String)).loopClosures).toHaveLength(1);
    await expect(generateUrdfBundle({ packagePath: fixturePath, outputDirectory, meshUriMode: 'relative' }))
      .resolves.toMatchObject({ errors: [expect.objectContaining({ code: 'output_already_exists' })] });
    await expect(access(join(outputDirectory, 'robot.urdf'))).resolves.toBeUndefined();
  });
});
