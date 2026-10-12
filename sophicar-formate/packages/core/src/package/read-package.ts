import { strFromU8, unzipSync } from 'fflate';

import {
  validateChanges,
  validateManifest,
  validateModel,
  type ChangesDocument,
  type Diagnostic,
  type ModelDocument,
  type PackageManifest,
} from '@sophicad/schema';

import { sha256Hex } from './hash.js';

export interface PackageLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface SophiCadPackage {
  manifest: PackageManifest;
  model: ModelDocument;
  changes?: ChangesDocument;
  files: ReadonlyMap<string, Uint8Array>;
  diagnostics: Diagnostic[];
}

export const DEFAULT_PACKAGE_LIMITS: PackageLimits = {
  maxFiles: 4096,
  maxFileBytes: 128 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
};

export class PackageError extends Error {
  readonly code: string;
  readonly path: string | undefined;
  readonly diagnostics: Diagnostic[];

  constructor(code: string, message: string, options: { path?: string; diagnostics?: Diagnostic[] } = {}) {
    super(message);
    this.name = 'PackageError';
    this.code = code;
    this.path = options.path;
    this.diagnostics = options.diagnostics ?? [];
  }
}

function validateArchivePath(path: string): { directory: boolean } {
  if (path.length === 0 || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    throw new PackageError('unsafe_archive_path', `不安全的数据包路径：${path}`, { path });
  }

  const directory = path.endsWith('/');
  const value = directory ? path.slice(0, -1) : path;
  const parts = value.split('/');
  if (value.length === 0 || parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new PackageError('unsafe_archive_path', `不安全的数据包路径：${path}`, { path });
  }

  return { directory };
}

function requiredFile(files: ReadonlyMap<string, Uint8Array>, path: string): Uint8Array {
  const bytes = files.get(path);
  if (!bytes) {
    throw new PackageError('required_file_missing', `数据包缺少 ${path}`, { path });
  }
  return bytes;
}

function parseJson(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes));
  } catch (error) {
    throw new PackageError('invalid_json', `${path} 不是有效 JSON`, { path });
  }
}

export async function readSophiCadPackage(
  bytes: Uint8Array,
  limits: PackageLimits = DEFAULT_PACKAGE_LIMITS,
): Promise<SophiCadPackage> {
  let fileCount = 0;
  let totalBytes = 0;

  const unzipped = unzipSync(bytes, {
    filter(info) {
      const { directory } = validateArchivePath(info.name);
      if (directory) {
        return false;
      }

      fileCount += 1;
      totalBytes += info.originalSize;
      if (fileCount > limits.maxFiles) {
        throw new PackageError('archive_file_limit_exceeded', `数据包文件数超过 ${limits.maxFiles}`);
      }
      if (info.originalSize > limits.maxFileBytes) {
        throw new PackageError('archive_file_size_exceeded', `${info.name} 超过单文件限制`, { path: info.name });
      }
      if (totalBytes > limits.maxTotalBytes) {
        throw new PackageError('archive_total_size_exceeded', '数据包解压总大小超过限制');
      }
      return true;
    },
  });

  const files = new Map<string, Uint8Array>(Object.entries(unzipped));
  const manifestValue = parseJson(requiredFile(files, 'manifest.json'), 'manifest.json');
  const manifestResult = validateManifest(manifestValue);
  if (!manifestResult.ok) {
    throw new PackageError('invalid_manifest', 'manifest.json 校验失败', {
      path: 'manifest.json',
      diagnostics: manifestResult.errors,
    });
  }

  const declaredPaths = new Set<string>();
  for (const entry of manifestResult.value.files) {
    validateArchivePath(entry.path);
    if (entry.path === 'manifest.json' || declaredPaths.has(entry.path)) {
      throw new PackageError('duplicate_manifest_path', `manifest 中存在重复或保留路径：${entry.path}`, {
        path: entry.path,
      });
    }
    declaredPaths.add(entry.path);
    const payload = requiredFile(files, entry.path);
    if (payload.byteLength !== entry.bytes) {
      throw new PackageError('file_size_mismatch', `${entry.path} 大小与 manifest 不一致`, { path: entry.path });
    }
    if (sha256Hex(payload) !== entry.sha256) {
      throw new PackageError('file_hash_mismatch', `${entry.path} 哈希与 manifest 不一致`, { path: entry.path });
    }
  }

  for (const path of files.keys()) {
    if (path !== 'manifest.json' && !declaredPaths.has(path)) {
      throw new PackageError('undeclared_file', `数据包包含 manifest 未声明的文件：${path}`, { path });
    }
  }

  const modelValue = parseJson(requiredFile(files, 'model.json'), 'model.json');
  const modelResult = validateModel(modelValue);
  if (!modelResult.ok) {
    throw new PackageError('invalid_model', 'model.json 校验失败', {
      path: 'model.json',
      diagnostics: modelResult.errors,
    });
  }

  let changes: ChangesDocument | undefined;
  const changesBytes = files.get('changes.json');
  if (changesBytes) {
    const changesResult = validateChanges(parseJson(changesBytes, 'changes.json'));
    if (!changesResult.ok) {
      throw new PackageError('invalid_changes', 'changes.json 校验失败', {
        path: 'changes.json',
        diagnostics: changesResult.errors,
      });
    }
    changes = changesResult.value;
  }

  return {
    manifest: manifestResult.value,
    model: modelResult.value,
    ...(changes ? { changes } : {}),
    files,
    diagnostics: [],
  };
}
