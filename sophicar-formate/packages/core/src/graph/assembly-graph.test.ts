import { describe, expect, it } from 'vitest';

import type { JointRecord, ModelDocument, OccurrenceRecord } from '@sophicad/schema';

import { analyzeAssemblyGraph, buildUrdfSpanningTree } from './assembly-graph.js';

const identity = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

function occurrence(id: string, grounded = false): OccurrenceRecord {
  return {
    id,
    componentId: `${id}-component`,
    name: id,
    fullPath: id,
    transform: [...identity],
    grounded,
  };
}

function joint(id: string, parent: string, child: string): JointRecord {
  return {
    id,
    name: id,
    parentOccurrenceId: parent,
    childOccurrenceId: child,
    type: 'revolute',
    fusionType: 'RevoluteJointType',
    origin: [...identity],
    axis: [0, 0, 1],
    degreesOfFreedom: 1,
    writeback: { limits: true, type: false, axis: false },
  };
}

function fourBarModel(): ModelDocument {
  const occurrences = [
    occurrence('ground', true),
    occurrence('input'),
    occurrence('coupler'),
    occurrence('output'),
  ];
  return {
    schemaVersion: '1.0.0',
    units: { length: 'm', mass: 'kg', angle: 'rad', inertia: 'kg*m^2' },
    parameters: { user: [], model: [] },
    components: occurrences.map((item) => ({ id: item.componentId, name: item.name })),
    occurrences,
    joints: [
      joint('j-ground-input', 'ground', 'input'),
      joint('j-input-coupler', 'input', 'coupler'),
      joint('j-coupler-output', 'coupler', 'output'),
      joint('j-output-ground', 'output', 'ground'),
    ],
    physicalProperties: [],
    bom: [],
    robot: { rootOccurrenceId: 'ground', linkMappings: [], jointOverrides: [] },
  };
}

describe('assembly graph', () => {
  it('keeps three joints and records one deterministic loop closure for a four bar', () => {
    const result = buildUrdfSpanningTree(fourBarModel(), 'ground');

    expect(result.treeJointIds).toEqual([
      'j-ground-input',
      'j-input-coupler',
      'j-coupler-output',
    ]);
    expect(result.loopJointIds).toEqual(['j-output-ground']);
    expect(result.rootOccurrenceId).toBe('ground');
  });

  it('selects the same tree when occurrence and joint arrays are reversed', () => {
    const model = fourBarModel();
    model.occurrences.reverse();
    model.joints.reverse();

    const result = buildUrdfSpanningTree(model, 'ground');

    expect(result.treeJointIds).toEqual([
      'j-ground-input',
      'j-input-coupler',
      'j-coupler-output',
    ]);
    expect(result.loopJointIds).toEqual(['j-output-ground']);
  });

  it('reports an isolated occurrence separately from the connected mechanism', () => {
    const model = fourBarModel();
    model.occurrences.push(occurrence('sensor'));

    const result = analyzeAssemblyGraph(model);

    expect(result.connectedComponents).toEqual([
      ['coupler', 'ground', 'input', 'output'],
      ['sensor'],
    ]);
    expect(result.orphanOccurrenceIds).toEqual(['sensor']);
  });

  it('reports a locked joint cycle instead of silently ignoring the conflict', () => {
    const model = fourBarModel();
    model.robot.lockedTreeJointIds = model.joints.map((item) => item.id);

    const result = buildUrdfSpanningTree(model, 'ground', model.robot.lockedTreeJointIds);

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'locked_joint_cycle',
      entityId: 'j-output-ground',
    }));
  });
});
