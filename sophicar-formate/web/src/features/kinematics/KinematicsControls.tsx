import { solvePlanarFourBar } from '@sophicad/core';
import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useWorkbenchStore } from '../../store/workbench-store';
import { parameterPreviewValueSi } from '../parameters/parameter-values';

export function KinematicsControls() {
  const model = useWorkbenchStore((state) => state.model);
  const changes = useWorkbenchStore((state) => state.changes.parameterChanges);
  const angle = useWorkbenchStore((state) => state.kinematicsInputAngleDeg);
  const setAngle = useWorkbenchStore((state) => state.setKinematicsInputAngle);
  const [playing, setPlaying] = useState(false);
  const values = useMemo(() => {
    const changed = new Map(changes.map((item) => [item.name, item.newExpression]));
    return new Map(model?.parameters.user.map((item) => [item.name, parameterPreviewValueSi(item, changed.get(item.name)) ?? 0]) ?? []);
  }, [changes, model]);
  const solution = solvePlanarFourBar({
    ground: values.get('l2') ?? 0.25,
    input: values.get('l1') ?? 0.2,
    coupler: values.get('l2') ?? 0.25,
    output: values.get('l1') ?? 0.2,
    inputAngle: angle * Math.PI / 180,
    branch: 'open',
  });
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setAngle(angle >= 80 ? -80 : angle + 1), 40);
    return () => window.clearInterval(timer);
  }, [angle, playing, setAngle]);
  if (!model) return null;
  const degrees = (radians: number) => `${(radians * 180 / Math.PI).toFixed(1)}°`;
  return (
    <div className="kinematics-panel">
      <div className="section-caption"><span>运动学预览</span><strong className={solution.ok ? 'valid-text' : 'error-text'}>{solution.ok ? '闭环已求解' : solution.diagnostic.code}</strong></div>
      <label htmlFor="joint-angle">输入轴角度 <output>{angle}°</output></label>
      <div className="slider-row">
        <button type="button" className="icon-button" aria-label={playing ? '暂停运动' : '播放运动'} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
        <input id="joint-angle" aria-label="输入轴角度" type="range" min={-80} max={80} value={angle} onChange={(event) => setAngle(Number(event.target.value))} />
      </div>
      {solution.ok ? (
        <dl className="kinematics-values" aria-label="关节求解数据">
          <div><dt>输入</dt><dd>{degrees(solution.inputAngle)}</dd></div>
          <div><dt>耦合</dt><dd>{degrees(solution.couplerAngle)}</dd></div>
          <div><dt>输出</dt><dd data-testid="output-angle">{degrees(solution.outputAngle)}</dd></div>
        </dl>
      ) : null}
      <p>这是瞬态运动预览，不会作为 Fusion 参数写回。</p>
    </div>
  );
}
