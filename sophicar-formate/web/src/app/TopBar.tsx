import { CircleHelp, Settings } from 'lucide-react';

import { DownloadUpdatePackage } from '../features/export/DownloadUpdatePackage';
import { ImportDropzone } from '../features/import/ImportDropzone';
import { useWorkbenchStore } from '../store/workbench-store';

const brandMarkUrl = `${import.meta.env.BASE_URL}assets/sophistudio-logo.png`;

export function TopBar() {
  const mode = useWorkbenchStore((state) => state.mode);
  const setMode = useWorkbenchStore((state) => state.setMode);
  return (
    <header className="top-bar">
      <div className="brand"><img src={brandMarkUrl} alt="SophiStudio" /><strong>SophiCAD Bridge</strong></div>
      <nav className="mode-tabs" aria-label="工作模块">
        <button type="button" aria-current={mode === 'three' ? 'page' : undefined} onClick={() => setMode('three')}>Three.js 参数建模</button>
        <button type="button" aria-current={mode === 'urdf' ? 'page' : undefined} onClick={() => setMode('urdf')}>URDF / Isaac</button>
      </nav>
      <div className="top-actions"><ImportDropzone /><DownloadUpdatePackage /><button className="icon-button quiet" type="button" aria-label="帮助"><CircleHelp size={18} /></button><button className="icon-button quiet" type="button" aria-label="设置"><Settings size={18} /></button></div>
    </header>
  );
}
