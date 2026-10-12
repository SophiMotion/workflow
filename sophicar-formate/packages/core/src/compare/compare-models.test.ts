import type { ModelDocument } from '@sophicad/schema';
import { describe, expect, it } from 'vitest';

import { compareModels } from './compare-models.js';

function model(): ModelDocument {
  return {
    schemaVersion: '1.0.0', units: { length: 'm', mass: 'kg', angle: 'rad', inertia: 'kg*m^2' },
    parameters: { user: [{ name: 'l1', unit: 'mm', expression: '200 mm', valueSi: 0.2, dependencies: [], writable: true }], model: [] },
    components: [], occurrences: [], joints: [], physicalProperties: [], bom: [],
    robot: { rootOccurrenceId: null, linkMappings: [], jointOverrides: [] },
  };
}

describe('compareModels', () => {
  it('reports parameter expression changes with stable before/after values', () => {
    const before = model();
    const after = structuredClone(before);
    after.parameters.user[0]!.expression = '220 mm';
    after.parameters.user[0]!.valueSi = 0.22;
    expect(compareModels(before, after).parameters.changed).toEqual([
      { id: 'l1', before: '200 mm', after: '220 mm' },
    ]);
  });
});
