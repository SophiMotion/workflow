import { useEffect } from 'react';

import { useWorkbenchStore } from '../../store/workbench-store';

export function JointEditor() {
  const model = useWorkbenchStore((state) => state.model);
  const selected = useWorkbenchStore((state) => state.selectedEntityId);
  const select = useWorkbenchStore((state) => state.selectEntity);
  const setLimit = useWorkbenchStore((state) => state.setJointLimit);
  const joint = model?.joints.find((item) => item.id === selected) ?? model?.joints[0];
  useEffect(() => { if (joint && !selected) select(joint.id); }, [joint, select, selected]);
  if (!joint) return <p className="empty-copy">没有 Joint。</p>;
  const occurrenceName = (id: string | null) => model?.occurrences.find((item) => item.id === id)?.name ?? 'world';
  return (
    <div className="joint-editor">
      <label>选择的关节
        <select value={joint.id} onChange={(event) => select(event.target.value)}>
          {model?.joints.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
        </select>
      </label>
      <dl className="property-grid">
        <dt>类型</dt><dd>{joint.type}</dd>
        <dt>父 Link</dt><dd>{occurrenceName(joint.parentOccurrenceId)}</dd>
        <dt>子 Link</dt><dd>{occurrenceName(joint.childOccurrenceId)}</dd>
        <dt>轴</dt><dd>{joint.axis.map((value) => value.toFixed(2)).join('  ')}</dd>
        {(['lower', 'upper', 'effort', 'velocity'] as const).map((field) => (
          <div className="property-pair" key={`${joint.id}-${field}`}>
            <dt>{{ lower: '下限', upper: '上限', effort: 'Effort', velocity: 'Velocity' }[field]}</dt>
            <dd><input type="number" step="0.01" aria-label={`${joint.id} ${field}`} defaultValue={joint.limit?.[field] ?? 0} onBlur={(event) => setLimit(joint.id, field, Number(event.target.value))} /></dd>
          </div>
        ))}
      </dl>
      {joint.loopClosure ? <p className="loop-notice">此 Joint 属于闭环约束，不写入 URDF 生成树。</p> : null}
    </div>
  );
}
