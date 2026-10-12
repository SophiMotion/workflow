import { lazy, Suspense, useEffect } from 'react';

import { BottomStatus } from './BottomStatus';
import { TopBar } from './TopBar';
import { useWorkbenchStore } from '../store/workbench-store';

const ThreeWorkbench = lazy(() => import('./ThreeWorkbench').then((module) => ({ default: module.ThreeWorkbench })));
const UrdfWorkspace = lazy(() => import('../features/urdf/UrdfWorkspace').then((module) => ({ default: module.UrdfWorkspace })));
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export function App() {
  const mode = useWorkbenchStore((state) => state.mode);
  const source = useWorkbenchStore((state) => state.source);
  const loadPackage = useWorkbenchStore((state) => state.loadPackage);
  useEffect(() => {
    if (source || !new URLSearchParams(window.location.search).has('demo')) return;
    void fetch(publicAsset('four-bar.sophicad.zip'))
      .then((response) => response.arrayBuffer())
      .then((bytes) => loadPackage(new Uint8Array(bytes), { filename: 'four-bar.sophicad.zip' }));
  }, [loadPackage, source]);
  return (
    <div className="app-shell">
      <div className="narrow-screen" role="alert">请使用至少 1024 px 宽的桌面窗口打开工程工作台。</div>
      <TopBar />
      <div className="app-body">
        {source ? <Suspense fallback={<main className="empty-workbench"><p>正在加载工程视图…</p></main>}>{mode === 'three' ? <ThreeWorkbench /> : <UrdfWorkspace />}</Suspense> : (
          <main className="empty-workbench">
            <img src={publicAsset('assets/sophicad-mark.png')} alt="" />
            <h1>导入 Fusion 装配数据包</h1>
            <p>在本机浏览器中检查参数关系、装配、BOM、Three.js 几何和 URDF 闭环约束。</p>
            <p>点击右上角“导入数据包”开始；文件不会上传服务器。</p>
          </main>
        )}
      </div>
      <BottomStatus />
    </div>
  );
}
