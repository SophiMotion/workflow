import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';

import type { ModelDocument, PackageManifest } from '@sophicad/schema';

import { PackageError, readSophiCadPackage } from './read-package.js';
import { writeSophiCadPackage } from './write-package.js';

const identity = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

function validManifest(): PackageManifest {
  return {
    schemaVersion: '1.0.0',
    packageId: 'package-1',
    createdAt: '2026-08-28T00:00:00.000Z',
    producer: 'test',
    producerVersion: '0.1.0',
    source: {
      designGuid: 'design-1',
      documentName: 'test1.f3d',
      dataFileId: null,
      versionId: null,
      fingerprint: 'a'.repeat(64),
    },
    coordinateSystem: {
      frameName: 'root',
      convention: 'x-forward-y-left-z-up',
      sourceToRobot: [...identity],
    },
    files: [],
  };
}

function validModel(): ModelDocument {
  return {
    schemaVersion: '1.0.0',
    units: { length: 'm', mass: 'kg', angle: 'rad', inertia: 'kg*m^2' },
    parameters: { user: [], model: [] },
    components: [{ id: 'component-1', name: 'Link' }],
    occurrences: [{
      id: 'occurrence-1',
      componentId: 'component-1',
      name: 'Link:1',
      fullPath: 'Link:1',
      transform: [...identity],
    }],
    joints: [],
    physicalProperties: [],
    bom: [{ componentId: 'component-1', quantity: 1, occurrenceIds: ['occurrence-1'] }],
    robot: { rootOccurrenceId: 'occurrence-1', linkMappings: [], jointOverrides: [] },
  };
}

describe('SophiCAD package IO', () => {
  it('rejects zip-slip paths before exposing any file', async () => {
    const bytes = zipSync({ '../escape.txt': strToU8('bad') });

    await expect(readSophiCadPackage(bytes)).rejects.toMatchObject({
      code: 'unsafe_archive_path',
    });
  });

  it('round-trips authority documents and verifies hashes', async () => {
    const bytes = await writeSophiCadPackage({
      manifest: validManifest(),
      model: validModel(),
      files: new Map([['meshes/collision/link.stl', strToU8('solid link')]]),
    });

    const result = await readSophiCadPackage(bytes);

    expect(result.model.occurrences).toEqual(validModel().occurrences);
    expect(result.files.get('meshes/collision/link.stl')).toEqual(strToU8('solid link'));
    expect(result.diagnostics).toEqual([]);
  });

  it('rejects a payload whose bytes no longer match the manifest hash', async () => {
    const original = await writeSophiCadPackage({
      manifest: validManifest(),
      model: validModel(),
      files: new Map(),
    });
    const files = unzipSync(original);
    const modelBytes = files['model.json'];
    if (!modelBytes) throw new Error('test fixture missing model.json');
    const tamperedModel = modelBytes.slice();
    tamperedModel[0] = tamperedModel[0] === 0x7b ? 0x5b : 0x7b;
    files['model.json'] = tamperedModel;
    const tampered = zipSync(files);

    await expect(readSophiCadPackage(tampered)).rejects.toMatchObject({
      code: 'file_hash_mismatch',
      path: 'model.json',
    });
  });

  it('rejects an archive without model.json', async () => {
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify(validManifest())),
    });

    await expect(readSophiCadPackage(archive)).rejects.toBeInstanceOf(PackageError);
    await expect(readSophiCadPackage(archive)).rejects.toMatchObject({
      code: 'required_file_missing',
      path: 'model.json',
    });
  });
});
