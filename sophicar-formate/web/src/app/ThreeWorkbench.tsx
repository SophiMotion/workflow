import { AssemblyTree } from '../features/assembly/AssemblyTree';
import { BomTable } from '../features/assembly/BomTable';
import { KinematicsControls } from '../features/kinematics/KinematicsControls';
import { ParameterTable } from '../features/parameters/ParameterTable';
import { ModelCanvas } from '../features/viewer/ModelCanvas';

export function ThreeWorkbench() {
  return (
    <div className="workbench-grid">
      <aside className="left-rail">
        <section className="rail-section tree-section"><header><h2>装配树</h2></header><AssemblyTree /></section>
        <section className="rail-section bom-section"><header><h2>BOM</h2></header><BomTable /></section>
      </aside>
      <main className="center-workspace"><ModelCanvas /></main>
      <aside className="right-rail">
        <section className="rail-section parameter-section"><header><h2>参数检查器</h2></header><ParameterTable /></section>
        <section className="rail-section kinematics-section"><KinematicsControls /></section>
      </aside>
    </div>
  );
}
