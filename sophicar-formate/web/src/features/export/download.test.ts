import { useWorkbenchStore } from '../../store/workbench-store';
import { loadFourBarFixture } from '../../test/load-fixture';
import { buildUpdateDownload } from './download';

describe('buildUpdateDownload', () => {
  beforeEach(async () => { useWorkbenchStore.getState().reset(); await loadFourBarFixture(); });

  it('adds the update suffix and never overwrites the imported package name', async () => {
    useWorkbenchStore.getState().setParameterExpression('l1', '220 mm');
    const download = await buildUpdateDownload(useWorkbenchStore.getState());
    expect(download.filename).toBe('four-bar-update.sophicad.zip');
    expect(download.bytes.byteLength).toBeGreaterThan(0);
  });
});
