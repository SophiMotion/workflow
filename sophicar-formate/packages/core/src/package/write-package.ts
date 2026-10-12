import { strToU8, zipSync, type Zippable } from 'fflate';

import type {
  ChangesDocument,
  ModelDocument,
  PackageFileEntry,
  PackageManifest,
} from '@sophicad/schema';

import { sha256Hex } from './hash.js';
import { PackageError } from './read-package.js';

export interface SophiCadPackageInput {
  manifest: PackageManifest;
  model: ModelDocument;
  changes?: ChangesDocument;
  files: ReadonlyMap<string, Uint8Array>;
}

const ZIP_TIMESTAMP = new Date('1980-01-01T00:00:00.000Z');

function jsonBytes(value: unknown): Uint8Array {
  return strToU8(`${JSON.stringify(value, null, 2)}\n`);
}

function purposeFor(path: string): PackageFileEntry['purpose'] {
  if (path === 'model.json' || path === 'changes.json') return 'authority';
  if (path.startsWith('meshes/visual/')) return 'visual-mesh';
  if (path.startsWith('meshes/collision/')) return 'collision-mesh';
  if (path.startsWith('robot/')) return 'robot';
  if (path.startsWith('reports/')) return 'report';
  return 'other';
}

function assertWritablePayloadPath(path: string): void {
  if (
    path.length === 0
    || path === 'manifest.json'
    || path === 'model.json'
    || path === 'changes.json'
    || path.includes('\\')
    || path.startsWith('/')
    || /^[A-Za-z]:/.test(path)
    || path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new PackageError('unsafe_archive_path', `不能写入数据包路径：${path}`, { path });
  }
}

export async function writeSophiCadPackage(input: SophiCadPackageInput): Promise<Uint8Array> {
  const payloads = new Map<string, Uint8Array>();
  payloads.set('model.json', jsonBytes(input.model));
  if (input.changes) {
    payloads.set('changes.json', jsonBytes(input.changes));
  }

  for (const [path, bytes] of input.files) {
    assertWritablePayloadPath(path);
    if (payloads.has(path)) {
      throw new PackageError('duplicate_package_path', `重复的数据包路径：${path}`, { path });
    }
    payloads.set(path, bytes);
  }

  const entries = [...payloads.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, bytes]): PackageFileEntry => ({
      path,
      purpose: purposeFor(path),
      bytes: bytes.byteLength,
      sha256: sha256Hex(bytes),
    }));

  const manifest: PackageManifest = {
    ...input.manifest,
    files: entries,
  };

  const zippable: Zippable = {};
  zippable['manifest.json'] = [jsonBytes(manifest), { level: 6, mtime: ZIP_TIMESTAMP }];
  for (const [path, bytes] of [...payloads.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    zippable[path] = [bytes, { level: 6, mtime: ZIP_TIMESTAMP }];
  }

  return zipSync(zippable);
}
