import { Download } from 'lucide-react';
import { useState } from 'react';

import { useWorkbenchStore } from '../../store/workbench-store';
import { buildUpdateDownload, triggerDownload } from './download';

export function DownloadUpdatePackage() {
  const source = useWorkbenchStore((state) => state.source);
  const changeCount = useWorkbenchStore((state) => state.changes.parameterChanges.length + state.changes.jointChanges.length + state.changes.robotOverrides.length + state.changes.bomOverrides.length);
  const errorCount = useWorkbenchStore((state) => state.diagnostics.filter((item) => item.severity === 'error').length);
  const warningCount = useWorkbenchStore((state) => state.diagnostics.filter((item) => item.severity === 'warning').length);
  const [message, setMessage] = useState('');
  async function download() {
    if (warningCount > 0 && !window.confirm(`存在 ${warningCount} 个警告，仍要导出更新包吗？`)) return;
    try {
      const result = await buildUpdateDownload(useWorkbenchStore.getState());
      triggerDownload(result);
      setMessage(`已生成 ${result.filename}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败。');
    }
  }
  const disabled = !source || changeCount === 0 || errorCount > 0;
  return (
    <div className="download-control">
      <button className="button button-primary" type="button" disabled={disabled} title={disabled ? '需要至少一项有效修改' : '下载供 Fusion 导入的更新包'} onClick={() => void download()}>
        <Download aria-hidden="true" size={16} />导出更新包
      </button>
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}
