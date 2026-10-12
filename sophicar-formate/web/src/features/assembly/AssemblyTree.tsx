import { Anchor, Box, ChevronDown, Eye, Link2 } from 'lucide-react';

import { useWorkbenchStore } from '../../store/workbench-store';

export function AssemblyTree() {
  const model = useWorkbenchStore((state) => state.model);
  const selected = useWorkbenchStore((state) => state.selectedEntityId);
  const select = useWorkbenchStore((state) => state.selectEntity);
  if (!model) return <p className="empty-copy">导入数据包后显示装配结构。</p>;

  return (
    <div className="assembly-tree" role="tree" aria-label="装配树">
      <div className="tree-root"><ChevronDown size={15} /><Box size={15} /><span>{model.robot.name ?? 'Fusion 装配'}</span></div>
      {model.occurrences.map((occurrence) => (
        <button
          type="button"
          role="treeitem"
          aria-selected={selected === occurrence.id}
          className={`tree-row${selected === occurrence.id ? ' is-selected' : ''}`}
          key={occurrence.id}
          onClick={() => select(occurrence.id)}
        >
          <Eye size={14} aria-label={occurrence.visible === false ? '隐藏' : '可见'} />
          <Box size={14} />
          <span>{occurrence.name}</span>
          {occurrence.grounded ? <Anchor size={13} aria-label="地架" /> : null}
        </button>
      ))}
      <div className="tree-group-label"><Link2 size={13} />Joint</div>
      {model.joints.map((joint) => (
        <button
          type="button"
          role="treeitem"
          aria-selected={selected === joint.id}
          className={`tree-row tree-joint${selected === joint.id ? ' is-selected' : ''}`}
          key={joint.id}
          onClick={() => select(joint.id)}
        >
          <Link2 size={14} />
          <span>{joint.name}</span>
          {joint.loopClosure ? <span className="status-text warning">闭环</span> : null}
        </button>
      ))}
    </div>
  );
}
