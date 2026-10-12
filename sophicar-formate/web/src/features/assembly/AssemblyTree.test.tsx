import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWorkbenchStore } from '../../store/workbench-store';
import { loadFourBarFixture } from '../../test/load-fixture';
import { AssemblyTree } from './AssemblyTree';

describe('AssemblyTree', () => {
  beforeEach(async () => { useWorkbenchStore.getState().reset(); await loadFourBarFixture(); });

  it('keeps reused components as independent selectable occurrences', async () => {
    render(<AssemblyTree />);
    await userEvent.click(screen.getByRole('treeitem', { name: /连杆1:2/ }));
    expect(useWorkbenchStore.getState().selectedEntityId).toBe('output');
    expect(screen.getAllByText(/连杆1:/)).toHaveLength(2);
  });
});
