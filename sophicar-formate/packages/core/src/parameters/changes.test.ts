import { describe, expect, it } from 'vitest';

import type { ChangesDocument, ModelDocument, ParameterChange } from '@sophicad/schema';

import { ChangeError, applyChangesDocument, sortParameterChanges } from './changes.js';

function modelWithParameters(): ModelDocument {
  return {
    schemaVersion: '1.0.0',
    units: { length: 'm', mass: 'kg', angle: 'rad', inertia: 'kg*m^2' },
    parameters: {
      user: [
        {
          name: 'l1', unit: 'mm', expression: '200 mm', valueSi: 0.2,
          dependencies: [], writable: true,
        },
        {
          name: 'l2', unit: 'mm', expression: 'l1 + 50 mm', valueSi: 0.25,
          dependencies: ['l1'], writable: true,
        },
      ],
      model: [],
    },
    components: [{ id: 'link', name: 'Link', description: 'Original' }],
    occurrences: [],
    joints: [],
    physicalProperties: [],
    bom: [{ componentId: 'link', description: 'Original', quantity: 2, occurrenceIds: ['a', 'b'] }],
    robot: { rootOccurrenceId: null, linkMappings: [], jointOverrides: [] },
  };
}

function change(name: string, oldExpression: string, newExpression: string): ParameterChange {
  return { name, oldExpression, newExpression };
}

function changesDocument(parameterChanges: ParameterChange[]): ChangesDocument {
  return {
    schemaVersion: '1.0.0',
    basePackageId: 'package-1',
    baseFingerprint: 'a'.repeat(64),
    targetDesignGuid: 'design-1',
    createdAt: '2026-08-28T00:00:00.000Z',
    parameterChanges,
    jointChanges: [],
    robotOverrides: [],
    bomOverrides: [],
  };
}

describe('parameter changes', () => {
  it('orders base dimensions before dependent expressions', () => {
    const result = sortParameterChanges(modelWithParameters(), [
      change('l2', 'l1 + 50 mm', 'l1 + 40 mm'),
      change('l1', '200 mm', '220 mm'),
    ]);

    expect(result.ordered.map((item) => item.name)).toEqual(['l1', 'l2']);
  });

  it('rejects a stale expected expression', () => {
    expect(() => applyChangesDocument(
      modelWithParameters(),
      changesDocument([change('l1', '190 mm', '220 mm')]),
    )).toThrowError(ChangeError);

    try {
      applyChangesDocument(
        modelWithParameters(),
        changesDocument([change('l1', '190 mm', '220 mm')]),
      );
    } catch (error) {
      expect(error).toMatchObject({ code: 'parameter_precondition_failed', entityId: 'l1' });
    }
  });

  it('rejects a dependency cycle before producing an ordered patch', () => {
    const model = modelWithParameters();
    model.parameters.user[0]!.dependencies = ['l2'];

    expect(() => sortParameterChanges(model, [
      change('l1', '200 mm', '220 mm'),
      change('l2', 'l1 + 50 mm', 'l1 + 40 mm'),
    ])).toThrowError(ChangeError);
  });

  it('applies allowed metadata without changing computed BOM quantity', () => {
    const changes = changesDocument([change('l1', '200 mm', '220 mm')]);
    changes.bomOverrides.push({ componentId: 'link', description: 'Updated' });

    const result = applyChangesDocument(modelWithParameters(), changes);

    expect(result.model.parameters.user[0]?.expression).toBe('220 mm');
    expect(result.model.bom[0]).toMatchObject({ description: 'Updated', quantity: 2 });
    expect(result.changedEntityIds).toEqual(['l1', 'link']);
  });
});
