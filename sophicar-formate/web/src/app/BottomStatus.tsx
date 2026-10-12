import { CheckCircle2, Link2, TriangleAlert } from 'lucide-react';

import { useWorkbenchStore } from '../store/workbench-store';

export function BottomStatus() {
  const schema = useWorkbenchStore((state) => state.model?.schemaVersion ?? '1.0.0');
  const loops = useWorkbenchStore((state) => state.urdf?.constraints.loopClosures.length ?? 0);
  const errors = useWorkbenchStore((state) => state.diagnostics.filter((item) => item.severity === 'error').length);
  const warnings = useWorkbenchStore((state) => state.diagnostics.filter((item) => item.severity === 'warning').length);
  const changed = useWorkbenchStore((state) => state.changes.parameterChanges.length + state.changes.jointChanges.length);
  return (
    <footer className="bottom-status">
      <span>Schema {schema}</span>
      <span><Link2 size={14} />闭环约束 {loops}</span>
      <span>{changed > 0 ? `${changed} 项未保存修改` : '无未保存修改'}</span>
      <span className={errors ? 'error-text' : warnings ? 'warning-text' : 'valid-text'}>
        {errors ? <TriangleAlert size={15} /> : <CheckCircle2 size={15} />}
        {errors ? `${errors} 个错误` : warnings ? `验证通过 · ${warnings} 个警告` : '验证通过'}
      </span>
    </footer>
  );
}
