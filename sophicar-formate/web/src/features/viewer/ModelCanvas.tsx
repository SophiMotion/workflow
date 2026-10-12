import { GizmoHelper, GizmoViewport, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { BoxSelect, Focus, Maximize2, MousePointer2, Ruler, ScanLine } from 'lucide-react';
import { Suspense } from 'react';

import { OccurrenceScene } from './OccurrenceScene';
import { useWorkbenchStore } from '../../store/workbench-store';

const tools = [
  [MousePointer2, '选择'], [Focus, '旋转视图'], [BoxSelect, '平移'],
  [Maximize2, '适合窗口'], [ScanLine, '剖切'], [Ruler, '测量'],
] as const;

export function ModelCanvas({ showJointAxes = false, title = '四连杆装配' }: { showJointAxes?: boolean; title?: string }) {
  const stale = useWorkbenchStore((state) => state.staleEntityIds.size > 0);
  return (
    <section className="viewport-panel" aria-label={title}>
      <div className="viewport-heading"><h2>{title}</h2></div>
      <div className="viewer-toolbar" role="toolbar" aria-label="三维视图工具">
        {tools.map(([Icon, label], index) => <button className={`tool-button${index === 0 ? ' is-active' : ''}`} type="button" aria-label={label} title={label} key={label}><Icon size={17} /></button>)}
      </div>
      <div className="canvas-wrap">
        <Canvas
          shadows
          dpr={[1, 1.6]}
          camera={{ position: [0.42, -0.46, 0.35], fov: 38, near: 0.01, far: 100, up: [0, 0, 1] }}
          onPointerMissed={() => undefined}
        >
          <color attach="background" args={['#F8F9FA']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[1, -1, 2]} intensity={2.1} castShadow />
          <gridHelper args={[2, 40, '#BDC1C6', '#E8EAED']} rotation={[Math.PI / 2, 0, 0]} />
          <axesHelper args={[0.09]} />
          <Suspense fallback={null}><OccurrenceScene showJointAxes={showJointAxes} /></Suspense>
          <OrbitControls makeDefault target={[0.12, 0.06, 0]} enableDamping dampingFactor={0.08} />
          <GizmoHelper alignment="bottom-right" margin={[64, 64]}><GizmoViewport axisColors={['#EA4335', '#34A853', '#002FA7']} labelColor="white" /></GizmoHelper>
        </Canvas>
        <span className={`canvas-watermark${stale ? ' is-stale' : ''}`}>{stale ? '代理预览 · 等待 Fusion 重建' : 'Three.js · 本地渲染'}</span>
      </div>
    </section>
  );
}
