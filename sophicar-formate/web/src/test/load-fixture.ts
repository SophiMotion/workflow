import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { useWorkbenchStore } from '../store/workbench-store';

export async function loadFourBarFixture() {
  const bytes = readFileSync(resolve(process.cwd(), '../fixtures/generated/four-bar.sophicad.zip'));
  await useWorkbenchStore.getState().loadPackage(new Uint8Array(bytes), { filename: 'four-bar.sophicad.zip' });
}
