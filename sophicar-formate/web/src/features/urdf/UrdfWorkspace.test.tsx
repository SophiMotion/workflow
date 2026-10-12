import { render, screen, within } from '@testing-library/react';

import { useWorkbenchStore } from '../../store/workbench-store';
import { loadFourBarFixture } from '../../test/load-fixture';
import { UrdfWorkspace } from './UrdfWorkspace';

vi.mock('../viewer/ModelCanvas', () => ({ ModelCanvas: () => <div aria-label="URDF 关节预览" /> }));

describe('UrdfWorkspace', () => {
  beforeEach(async () => { useWorkbenchStore.getState().reset(); await loadFourBarFixture(); });

  it('shows the cut four-bar joint only in loop closures, not the URDF tree', () => {
    render(<UrdfWorkspace />);
    expect(within(screen.getByTestId('urdf-tree')).queryByText('j-output-ground')).not.toBeInTheDocument();
    expect(screen.getByTestId('loop-closures')).toHaveTextContent('j-output-ground');
  });
});
