import { describe, expect, it } from 'vitest';

import { validateManifest, validateModel } from './validate.js';

describe('SophiCAD schema', () => {
  it('rejects an unsupported package major version', () => {
    const result = validateManifest({ schemaVersion: '2.0.0' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('unsupported_schema_major');
    }
  });

  it('rejects an occurrence transform that is not a 16-value row-major matrix', () => {
    const result = validateModel({
      schemaVersion: '1.0.0',
      units: { length: 'm', mass: 'kg', angle: 'rad', inertia: 'kg*m^2' },
      parameters: { user: [], model: [] },
      components: [],
      occurrences: [
        {
          id: 'occurrence-1',
          componentId: 'component-1',
          name: 'Link:1',
          fullPath: 'Link:1',
          transform: [1, 0, 0],
        },
      ],
      joints: [],
      physicalProperties: [],
      bom: [],
      robot: { rootOccurrenceId: null, linkMappings: [], jointOverrides: [] },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.path?.includes('transform'))).toBe(true);
    }
  });
});
