import { solvePlanarFourBar } from '@sophicad/core';
import type { ModelDocument } from '@sophicad/schema';
import * as THREE from 'three';

import { parameterPreviewValueSi } from '../parameters/parameter-values';

export function buildFourBarPreview(
  model: ModelDocument,
  changedExpressions: ReadonlyMap<string, string>,
  inputAngleDeg: number,
): Map<string, THREE.Matrix4> | undefined {
  if (model.occurrences.length !== 4 || !model.joints.some((joint) => joint.loopClosure)) return undefined;
  const parameters = new Map(model.parameters.user.map((item) => [item.name, item]));
  const value = (name: string, fallback: number) => {
    const parameter = parameters.get(name);
    return parameter ? (parameterPreviewValueSi(parameter, changedExpressions.get(name)) ?? fallback) : fallback;
  };
  const dimensions = {
    l1: value('l1', 0.2), l2: value('l2', 0.25),
    w1: value('w1', 0.02), w2: value('w2', 0.02),
    t1: value('t1', 0.02), t2: value('t2', 0.02),
  };
  const solution = solvePlanarFourBar({
    ground: dimensions.l2,
    input: dimensions.l1,
    coupler: dimensions.l2,
    output: dimensions.l1,
    inputAngle: inputAngleDeg * Math.PI / 180,
    branch: 'open',
  });
  if (!solution.ok) return undefined;

  const roleByOccurrence = new Map(model.robot.linkMappings.map((item) => [item.occurrenceId, item.linkName.toLowerCase()]));
  const matrices = new Map<string, THREE.Matrix4>();
  const build = (x: number, y: number, angle: number, scale: readonly [number, number, number]) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, 0),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle),
    new THREE.Vector3(...scale),
  );
  const link1Scale: [number, number, number] = [dimensions.l1 / 0.2, dimensions.w1 / 0.02, dimensions.t1 / 0.02];
  const link2Scale: [number, number, number] = [dimensions.l2 / 0.25, dimensions.w2 / 0.02, dimensions.t2 / 0.02];

  for (const occurrence of model.occurrences) {
    const role = roleByOccurrence.get(occurrence.id) ?? occurrence.id.toLowerCase();
    if (role.includes('ground')) matrices.set(occurrence.id, build(0, 0, 0, link2Scale));
    else if (role.includes('input')) matrices.set(occurrence.id, build(0, 0, solution.inputAngle, link1Scale));
    else if (role.includes('coupler')) matrices.set(occurrence.id, build(solution.pivots.inputCoupler[0], solution.pivots.inputCoupler[1], solution.couplerAngle, link2Scale));
    else if (role.includes('output')) matrices.set(occurrence.id, build(solution.pivots.groundOutput[0], solution.pivots.groundOutput[1], solution.outputAngle, link1Scale));
  }
  return matrices;
}
