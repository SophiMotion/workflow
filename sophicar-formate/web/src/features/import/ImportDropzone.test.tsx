import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWorkbenchStore } from '../../store/workbench-store';
import { ImportDropzone } from './ImportDropzone';

describe('ImportDropzone', () => {
  beforeEach(() => useWorkbenchStore.getState().reset());

  it('loads a local package and preserves the local-only privacy boundary', async () => {
    const bytes = readFileSync(resolve(process.cwd(), '../fixtures/generated/four-bar.sophicad.zip'));
    const file = new File([bytes], 'four-bar.sophicad.zip', { type: 'application/zip' });
    render(<ImportDropzone />);

    await userEvent.upload(screen.getByLabelText('导入 SophiCAD 数据包'), file);

    expect(await screen.findByText('test1.f3d')).toBeVisible();
    expect(screen.getByText('文件仅在本机浏览器中处理')).toBeVisible();
    expect(useWorkbenchStore.getState().model?.parameters.user).toHaveLength(7);
  });
});
