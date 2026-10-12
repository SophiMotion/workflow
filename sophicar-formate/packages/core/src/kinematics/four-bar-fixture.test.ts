import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { validateModel, type ModelDocument } from '@sophicad/schema';

import { generateUrdf } from '../urdf/generate-urdf.js';

async function fixtureText(path: string): Promise<string> {
  return readFile(new URL(`../../../../fixtures/four-bar/${path}`, import.meta.url), 'utf8');
}

describe('four-bar reference fixture', () => {
  it('contains the seven Fusion user parameters from test1.f3d', async () => {
    const modelValue: unknown = JSON.parse(await fixtureText('model.json'));
    const validation = validateModel(modelValue);

    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.value.parameters.user.map((parameter) => parameter.name)).toEqual([
      'w1', 'w2', 'l1', 'l2', 'd', 't1', 't2',
    ]);
    expect(validation.value.parameters.user.map((parameter) => parameter.expression)).toEqual([
      '20 mm', '20 mm', '200 mm', '250 mm', '10 mm', '20 mm', '20 mm',
    ]);
  });

  it('generates the checked-in URDF and loop constraint artifacts', async () => {
    const model = JSON.parse(await fixtureText('model.json')) as ModelDocument;
    const generated = generateUrdf(model, { rootOccurrenceId: 'ground', meshUriMode: 'relative' });

    expect(generated.urdfXml).toBe(await fixtureText('robot/expected.urdf'));
    expect(`${JSON.stringify(generated.constraints, null, 2)}\n`)
      .toBe(await fixtureText('robot/expected.constraints.json'));
  });
});
