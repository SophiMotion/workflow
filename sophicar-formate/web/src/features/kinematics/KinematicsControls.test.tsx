import { fireEvent, render, screen } from '@testing-library/react';

import { useWorkbenchStore } from '../../store/workbench-store';
import { loadFourBarFixture } from '../../test/load-fixture';
import { KinematicsControls } from './KinematicsControls';

describe('KinematicsControls', () => {
  beforeEach(async () => { useWorkbenchStore.getState().reset(); await loadFourBarFixture(); });

  it('publishes the input angle and refreshes solved joint angles', () => {
    render(<KinematicsControls />);
    const before = screen.getByTestId('output-angle').textContent;

    fireEvent.change(screen.getByRole('slider', { name: '输入轴角度' }), { target: { value: '50' } });

    expect(useWorkbenchStore.getState().kinematicsInputAngleDeg).toBe(50);
    expect(screen.getByText('50°')).toBeVisible();
    expect(screen.getByTestId('output-angle').textContent).not.toBe(before);
  });
});
