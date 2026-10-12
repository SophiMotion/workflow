import { constants } from 'node:fs';
import { access, link, lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import { readSophiCadPackage, type SophiCadPackage } from '@sophicad/core';

export class FileGuardError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'FileGuardError';
  }
}

function absolutePath(path: string): string {
  if (!isAbsolute(path)) throw new FileGuardError('absolute_path_required', `必须使用绝对路径：${path}`);
  return resolve(path);
}

export function ensureDistinctPaths(inputPath: string, outputPath: string): void {
  if (absolutePath(inputPath) === absolutePath(outputPath)) {
    throw new FileGuardError('output_matches_input', '输出路径不能与输入数据包相同。');
  }
}

export async function readPackageFile(path: string): Promise<SophiCadPackage> {
  const requested = absolutePath(path);
  const canonical = await realpath(requested).catch(() => {
    throw new FileGuardError('input_not_found', `找不到输入数据包：${requested}`);
  });
  const stat = await lstat(canonical);
  if (!stat.isFile()) throw new FileGuardError('input_not_regular_file', `输入不是普通文件：${requested}`);
  return readSophiCadPackage(await readFile(canonical));
}

export async function assertPathMissing(path: string): Promise<void> {
  const requested = absolutePath(path);
  try {
    await lstat(requested);
    throw new FileGuardError('output_already_exists', `输出已存在，不会覆盖：${requested}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function writeNewFileAtomic(path: string, bytes: Uint8Array): Promise<void> {
  const output = absolutePath(path);
  await assertPathMissing(output);
  const parent = dirname(output);
  await access(parent, constants.W_OK);
  const temporary = `${output}.sophicad-${process.pid}-${crypto.randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporary, output);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new FileGuardError('output_already_exists', `输出已存在，不会覆盖：${output}`);
    }
    throw error;
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
