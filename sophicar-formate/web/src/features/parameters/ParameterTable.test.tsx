import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWorkbenchStore } from '../../store/workbench-store';
import { loadFourBarFixture } from '../../test/load-fixture';
import { ParameterTable } from './ParameterTable';

describe('ParameterTable', () => {
  beforeEach(async () => { useWorkbenchStore.getState().reset(); await loadFourBarFixture(); });

  it('records l1 expression changes and marks authoritative geometry stale', async () => {
    render(<ParameterTable />);
    const input = screen.getByLabelText('l1 表达式');
    await userEvent.clear(input);
    await userEvent.type(input, '220 mm');
    await userEvent.click(screen.getByRole('button', { name: '应用 l1 修改' }));

    expect(useWorkbenchStore.getState().changes.parameterChanges[0]?.newExpression).toBe('220 mm');
    expect(useWorkbenchStore.getState().staleEntityIds.has('input-component')).toBe(true);
    expect(screen.getByText('等待 Fusion 重建')).toBeVisible();
  });

  it('interprets a unitless width using the Fusion parameter unit and updates the preview value', async () => {
    render(<ParameterTable />);
    const input = screen.getByLabelText('w1 表达式');
    const row = input.closest('tr');
    expect(row).not.toBeNull();

    await userEvent.clear(input);
    await userEvent.type(input, '40');
    await userEvent.click(screen.getByRole('button', { name: '应用 w1 修改' }));

    expect(useWorkbenchStore.getState().changes.parameterChanges[0]?.newExpression).toBe('40 mm');
    expect(input).toHaveValue('40 mm');
    expect(within(row!).getByText('0.04 SI')).toBeVisible();
  });
});
