import { writeSophiCadPackage } from '@sophicad/core';

import { useWorkbenchStore } from '../../store/workbench-store';

type WorkbenchSnapshot = ReturnType<typeof useWorkbenchStore.getState>;

export interface UpdateDownload {
  filename: string;
  bytes: Uint8Array;
}

function outputName(input?: string): string {
  const source = input ?? 'fusion-model.sophicad.zip';
  const stem = source.replace(/\.sophicad\.zip$/i, '').replace(/\.zip$/i, '');
  return `${stem}-update.sophicad.zip`;
}

export async function buildUpdateDownload(state: WorkbenchSnapshot): Promise<UpdateDownload> {
  if (!state.source || !state.model || !state.urdf) throw new Error('请先导入有效数据包。');
  const hasChanges = state.changes.parameterChanges.length + state.changes.jointChanges.length + state.changes.robotOverrides.length + state.changes.bomOverrides.length > 0;
  if (!hasChanges) throw new Error('当前没有需要导出的修改。');
  const files = new Map<string, Uint8Array>();
  for (const [path, bytes] of state.source.files) {
    if (path === 'manifest.json' || path === 'model.json' || path === 'changes.json') continue;
    if (path.startsWith('robot/') && (path.endsWith('.urdf') || path.endsWith('constraints.json'))) continue;
    files.set(path, bytes);
  }
  const encoder = new TextEncoder();
  files.set('robot/model.urdf', encoder.encode(state.urdf.urdfXml));
  files.set('robot/constraints.json', encoder.encode(`${JSON.stringify(state.urdf.constraints, null, 2)}\n`));
  const packageId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `web-${Date.now()}`;
  const bytes = await writeSophiCadPackage({
    manifest: {
      ...state.source.manifest,
      packageId,
      createdAt: new Date().toISOString(),
      producer: 'SophiCAD Web Workbench',
      producerVersion: '0.1.0',
      files: [],
    },
    model: state.model,
    changes: { ...state.changes, createdAt: new Date().toISOString() },
    files,
  });
  return { filename: outputName(state.sourceFilename ?? state.source.manifest.source.documentName), bytes };
}

export function triggerDownload(download: UpdateDownload): void {
  const blob = new Blob([download.bytes as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = download.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
