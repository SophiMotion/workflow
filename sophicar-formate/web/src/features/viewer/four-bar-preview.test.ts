import * as THREE from 'three';

import { useWorkbenchStore } from '../../store/workbench-store';
import { loadFourBarFixture } from '../../test/load-fixture';
import { buildFourBarPreview } from './four-bar-preview';

describe('four-bar proxy preview', () => {
  beforeEach(async () => { useWorkbenchStore.getState().reset(); await loadFourBarFixture(); });

  it('changes the input-link transform when the input shaft angle changes', () => {
    const model = useWorkbenchStore.getState().model!;
    const at28 = buildFourBarPreview(model, new Map(), 28)?.get('input');
    const at50 = buildFourBarPreview(model, new Map(), 50)?.get('input');

    expect(at28?.elements).not.toEqual(at50?.elements);
  });

  it('doubles the link-1 proxy width for w1 = 40 mm', () => {
    const model = useWorkbenchStore.getState().model!;
    const matrix = buildFourBarPreview(model, new Map([['w1', '40 mm']]), 28)?.get('input');
    const scale = new THREE.Vector3();
    matrix?.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

    expect(scale.y).toBeCloseTo(2, 6);
  });
});
