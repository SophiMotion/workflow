import { Code2 } from 'lucide-react';
import { useState } from 'react';

import { ModelCanvas } from '../viewer/ModelCanvas';
import { IsaacConfig } from './IsaacConfig';
import { JointEditor } from './JointEditor';
import { KinematicTree } from './KinematicTree';
import { LoopClosuresPanel } from './LoopClosuresPanel';
import { useWorkbenchStore } from '../../store/workbench-store';

export function UrdfWorkspace() {
  const [showXml, setShowXml] = useState(false);
  const xml = useWorkbenchStore((state) => state.urdf?.urdfXml);
  return (
    <div className="workbench-grid urdf-workbench">
      <aside className="left-rail">
        <section className="rail-section tree-section"><header><h2>机器人树</h2></header><KinematicTree /></section>
        <section className="rail-section loop-section"><header><h2>闭环约束</h2></header><LoopClosuresPanel /></section>
      </aside>
      <main className="center-workspace">
        <ModelCanvas title="URDF 关节预览" showJointAxes />
        {showXml ? <pre className="xml-preview">{xml}</pre> : null}
        <button type="button" className="xml-toggle" aria-pressed={showXml} onClick={() => setShowXml((value) => !value)}><Code2 size={15} />{showXml ? '关闭 XML' : '预览 XML'}</button>
      </main>
      <aside className="right-rail">
        <section className="rail-section inspector-section"><header><h2>Joint 检查器</h2></header><JointEditor /></section>
        <section className="rail-section isaac-section"><header><h2>Isaac 配置</h2></header><IsaacConfig /></section>
      </aside>
    </div>
  );
}
