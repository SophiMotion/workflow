import { Box, ChevronDown, Link2 } from 'lucide-react';

import { useWorkbenchStore } from '../../store/workbench-store';

export function KinematicTree() {
  const urdf = useWorkbenchStore((state) => state.urdf);
  const selected = useWorkbenchStore((state) => state.selectedEntityId);
  const select = useWorkbenchStore((state) => state.selectEntity);
  if (!urdf) return <p className="empty-copy">没有可用 URDF 树。</p>;
  return (
    <div role="tree" aria-label="机器人树" data-testid="urdf-tree" className="assembly-tree urdf-tree">
      <div className="tree-root"><ChevronDown size={15} /><Box size={15} /><span>{urdf.links[0]?.name ?? 'robot'}</span></div>
      {urdf.joints.map((joint) => (
        <button
          key={`${joint.sourceJointId}:${joint.name}`}
          type="button"
          role="treeitem"
          aria-selected={selected === joint.sourceJointId}
          className={`tree-row tree-joint${selected === joint.sourceJointId ? ' is-selected' : ''}`}
          onClick={() => select(joint.sourceJointId)}
        >
          <Link2 size={14} /><span>{joint.name}</span><small>{joint.type}</small>
        </button>
      ))}
    </div>
  );
}
