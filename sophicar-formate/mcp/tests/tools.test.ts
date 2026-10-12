import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  analyzeKinematics,
  inspectAssembly,
  listParameters,
  proposeParameterChanges,
  validatePackage,
} from '../src/tools/read-tools.js';

const fixturePath = resolve(import.meta.dirname, '../../fixtures/generated/four-bar.sophicad.zip');

describe('read-only and proposal tools', () => {
  it('summarizes the generic assembly and BOM', async () => {
    const result = await inspectAssembly({ packagePath: fixturePath });
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({ componentCount: 4, occurrenceCount: 4, jointCount: 4 });
    expect(result.data?.bom).toHaveLength(4);
  });

  it('filters writable parameters without regex execution', async () => {
    const result = await listParameters({ packagePath: fixturePath, editableOnly: true, names: ['l1', 'missing'] });
    expect(result.data?.parameters.map((item) => item.name)).toEqual(['l1']);
  });

  it('reports one loop closure outside the URDF tree', async () => {
    const result = await analyzeKinematics({ packagePath: fixturePath });
    expect(result.errors).toEqual([]);
    expect(result.data?.loopJointIds).toEqual(['j-output-ground']);
    expect(result.data?.urdfTreeJointIds).toHaveLength(3);
  });

  it('validates a fixture without changing it', async () => {
    const before = await readFile(fixturePath);
    const result = await validatePackage({ packagePath: fixturePath });
    expect(result.errors).toEqual([]);
    expect(result.data?.valid).toBe(true);
    expect(await readFile(fixturePath)).toEqual(before);
  });

  it('proposes l1=220 mm as a dry-run and detects stale old expressions', async () => {
    const good = await proposeParameterChanges({
      packagePath: fixturePath,
      parameterChanges: [{ name: 'l1', oldExpression: '200 mm', newExpression: '220 mm' }],
    });
    expect(good.errors).toEqual([]);
    expect(good.data?.changedEntityIds).toContain('l1');
    const stale = await proposeParameterChanges({
      packagePath: fixturePath,
      parameterChanges: [{ name: 'l1', oldExpression: '199 mm', newExpression: '220 mm' }],
    });
    expect(stale.errors[0]?.code).toBe('parameter_precondition_failed');
  });
});
