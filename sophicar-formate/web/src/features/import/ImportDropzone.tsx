import { FileUp, ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';

import { useWorkbenchStore } from '../../store/workbench-store';

function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('无法读取本地文件。'));
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(file);
  });
}

export function ImportDropzone() {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const loadPackage = useWorkbenchStore((state) => state.loadPackage);
  const loading = useWorkbenchStore((state) => state.loading);
  const error = useWorkbenchStore((state) => state.error);
  const source = useWorkbenchStore((state) => state.source);

  async function load(file?: File) {
    if (!file) return;
    await loadPackage(await readFileBytes(file), { filename: file.name });
  }

  return (
    <div
      className={`import-control${dragging ? ' is-dragging' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void load(event.dataTransfer.files[0]);
      }}
    >
      <input
        id={inputId}
        className="visually-hidden"
        type="file"
        accept=".zip,.sophicad.zip,application/zip"
        aria-label="导入 SophiCAD 数据包"
        onChange={(event) => void load(event.target.files?.[0])}
      />
      <label className="button button-secondary" htmlFor={inputId}>
        <FileUp aria-hidden="true" size={16} />
        {loading ? '正在校验…' : '导入数据包'}
      </label>
      <span className="privacy-copy"><ShieldCheck aria-hidden="true" size={14} />文件仅在本机浏览器中处理</span>
      {source ? <span className="source-name">{source.manifest.source.documentName}</span> : null}
      {error ? <span className="inline-error" role="alert">{error}</span> : null}
    </div>
  );
}
