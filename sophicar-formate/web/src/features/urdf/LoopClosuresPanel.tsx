import { Box, Link2 } from 'lucide-react';

import { useWorkbenchStore } from '../../store/workbench-store';

export function LoopClosuresPanel() {
  const closures = useWorkbenchStore((state) => state.urdf?.constraints.loopClosures ?? []);
  const selected = useWorkbenchStore((state) => state.selectedEntityId);
  const select = useWorkbenchStore((state) => state.selectEntity);
  return (
    <div data-testid="loop-closures" className="loop-list">
      {closures.length === 0 ? <p className="empty-copy">没有闭环约束。</p> : closures.map((closure) => (
        <button key={closure.sourceJointId} type="button" className={selected === closure.sourceJointId ? 'is-selected' : undefined} onClick={() => select(closure.sourceJointId)}>
          <span className="loop-line" /><Link2 size={14} />
          <strong>{closure.sourceJointId}</strong>
          <small>{closure.type}</small>
          <span><Box size={12} />{closure.parentOccurrenceId} ↔ {closure.childOccurrenceId}</span>
        </button>
      ))}
    </div>
  );
}
