import { CircleCheck, Link2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UserParameterRecord } from '@sophicad/schema';

import { useWorkbenchStore } from '../../store/workbench-store';
import { normalizeParameterExpression, parameterPreviewValueSi } from './parameter-values';

function ParameterRow({ parameter }: { parameter: UserParameterRecord }) {
  const change = useWorkbenchStore((state) => state.changes.parameterChanges.find((item) => item.name === parameter.name));
  const setExpression = useWorkbenchStore((state) => state.setParameterExpression);
  const [draft, setDraft] = useState(change?.newExpression ?? parameter.expression);
  useEffect(() => setDraft(change?.newExpression ?? parameter.expression), [change?.newExpression, parameter.expression]);
  const changed = draft !== parameter.expression;
  const previewValue = parameterPreviewValueSi(parameter, change?.newExpression);
  const apply = () => {
    const expression = normalizeParameterExpression(draft, parameter.unit);
    setDraft(expression);
    setExpression(parameter.name, expression);
  };
  return (
    <tr className={change ? 'is-changed' : undefined}>
      <th scope="row">{parameter.name}</th>
      <td>
        <input
          aria-label={`${parameter.name} 表达式`}
          value={draft}
          disabled={!parameter.writable}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { if (changed) apply(); }}
          onKeyDown={(event) => { if (event.key === 'Enter') apply(); }}
        />
      </td>
      <td className="value-cell">{previewValue === null ? '—' : `${previewValue} SI`}</td>
      <td className="row-actions">
        {change ? <span className="stale-label">待重建</span> : <CircleCheck size={14} className="valid-icon" aria-label="有效" />}
        <button
          type="button"
          className="icon-button"
          aria-label={`应用 ${parameter.name} 修改`}
          disabled={!parameter.writable || (!changed && !change)}
          onClick={apply}
        ><Link2 size={14} /></button>
        {change ? <button type="button" className="icon-button" aria-label={`恢复 ${parameter.name}`} onClick={() => { setDraft(parameter.expression); setExpression(parameter.name, parameter.expression); }}><RotateCcw size={14} /></button> : null}
      </td>
    </tr>
  );
}

export function ParameterTable() {
  const parameters = useWorkbenchStore((state) => state.model?.parameters.user);
  const stale = useWorkbenchStore((state) => state.staleEntityIds.size > 0);
  if (!parameters) return <p className="empty-copy">导入后可编辑 Fusion 用户参数。</p>;
  return (
    <>
      <div className="section-caption">
        <span>用户参数</span>
        {stale ? <strong className="stale-banner">等待 Fusion 重建</strong> : <span className="muted">当前几何</span>}
      </div>
      <table className="data-table parameter-table">
        <thead><tr><th>名称</th><th>表达式</th><th>导出值</th><th>状态</th></tr></thead>
        <tbody>{parameters.map((parameter) => <ParameterRow key={parameter.name} parameter={parameter} />)}</tbody>
      </table>
      <div className="dependency-list">
        <h3>依赖关系</h3>
        {parameters.map((parameter) => (
          <div key={parameter.name}><code>{parameter.name}</code><span>→</span><span>{parameter.comment ?? (parameter.dependencies.join(', ') || '独立参数')}</span></div>
        ))}
      </div>
    </>
  );
}
