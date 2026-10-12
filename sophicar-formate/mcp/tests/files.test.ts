import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ensureDistinctPaths, writeNewFileAtomic } from '../src/io/files.js';

describe('safe MCP file I/O', () => {
  it('refuses to overwrite the input package', () => {
    expect(() => ensureDistinctPaths('/tmp/input.sophicad.zip', '/tmp/input.sophicad.zip'))
      .toThrowError(expect.objectContaining({ code: 'output_matches_input' }));
  });

  it('refuses an existing output and preserves its bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sophicad-files-'));
    const output = join(directory, 'existing.zip');
    await writeFile(output, 'owner-data');
    await expect(writeNewFileAtomic(output, new TextEncoder().encode('new-data')))
      .rejects.toMatchObject({ code: 'output_already_exists' });
    expect(await readFile(output, 'utf8')).toBe('owner-data');
  });
});
