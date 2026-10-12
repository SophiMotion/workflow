import { describe, expect, it } from 'vitest';

import type { JointRecord, ModelDocument, OccurrenceRecord } from '@sophicad/schema';

import { generateUrdf } from './generate-urdf.js';
import { validateUrdfArtifacts } from './validate-urdf.js';

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

function joint(id: string, parent: string, child: string, type: JointRecord['type'] = 'revolute'): JointRecord {
  return {
    id,
    name: id,
    parentOccurrenceId: parent,
    childOccurrenceId: child,
    type,
    fusionType: `${type}-fusion`,
    origin: [...identity],
    axis: [0, 0, 1],
    degreesOfFreedom: type === 'cylindrical' ? 2 : 1,
    limit: { lower: -1.57, upper: 1.57, effort: 100, velocity: 2 },
    writeback: { limits: true, type: false, axis: false },
  };
}

function fourBarModel(): ModelDocument {
  const occurrences = [
    occurrence('ground', true), occurrence('input'), occurrence('coupler'), occurrence('output'),
  ];
  return {
    schemaVersion: '1.0.0',
    units: { length: 'm', mass: 'kg', angle: 'rad', inertia: 'kg*m^2' },
    parameters: { user: [], model: [] },
    components: occurrences.map((item) => ({
      id: item.componentId,
      name: item.name,
      visualMesh: `meshes/visual/${item.id}.glb`,
      collisionMesh: `meshes/collision/${item.id}.stl`,
    })),
    occurrences,
    joints: [
      joint('j-ground-input', 'ground', 'input'),
      joint('j-input-coupler', 'input', 'coupler'),
      joint('j-coupler-output', 'coupler', 'output'),
      joint('j-output-ground', 'output', 'ground'),
    ],
    physicalProperties: occurrences.map((item) => ({
      entityId: item.id,
      massKg: 1,
      volumeM3: 0.001,
      centerOfMass: [0, 0, 0],
      inertiaKgM2: [0.01, 0, 0, 0, 0.02, 0, 0, 0, 0.03],
      inertiaFrame: [...identity],
      accuracy: 'very-high',
    })),
    bom: [],
    robot: {
      name: 'four bar',
      rootOccurrenceId: 'ground',
      linkMappings: occurrences.map((item) => ({ occurrenceId: item.id, linkName: item.id })),
      jointOverrides: [],
    },
  };
}

describe('URDF generation', () => {
  it('emits a tree URDF and preserves the cut loop in constraints', () => {
    const result = generateUrdf(fourBarModel(), {
      rootOccurrenceId: 'ground',
      meshUriMode: 'relative',
    });

    expect(result.urdfXml).toContain('<robot name="four_bar">');
    expect(result.urdfXml.match(/<link /g)).toHaveLength(4);
    expect(result.urdfXml.match(/<joint /g)).toHaveLength(3);
    expect(result.constraints.loopClosures.map((item) => item.sourceJointId))
      .toEqual(['j-output-ground']);
    expect(validateUrdfArtifacts(result)).toEqual([]);
  });

  it('decomposes a cylindrical Fusion joint into revolute and prismatic joints', () => {
    const model = fourBarModel();
    model.occurrences = model.occurrences.slice(0, 2);
    model.components = model.components.slice(0, 2);
    model.physicalProperties = model.physicalProperties.slice(0, 2);
    model.joints = [joint('cylinder joint', 'ground', 'input', 'cylindrical')];

    const result = generateUrdf(model, { rootOccurrenceId: 'ground', meshUriMode: 'relative' });

    expect(result.urdfXml).toContain('name="cylinder_joint__rotate"');
    expect(result.urdfXml).toContain('name="cylinder_joint__slide"');
    expect(result.urdfXml.match(/<joint /g)).toHaveLength(2);
    expect(result.urdfXml).toContain('name="input__cylinder_joint_virtual_1"');
  });

  it('uses package URIs without changing model mesh paths', () => {
    const model = fourBarModel();
    const originalPath = model.components[0]?.collisionMesh;

    const result = generateUrdf(model, {
      rootOccurrenceId: 'ground',
      meshUriMode: 'package',
      packageName: 'four_bar_description',
    });

    expect(result.urdfXml).toContain('package://four_bar_description/meshes/collision/ground.stl');
    expect(model.components[0]?.collisionMesh).toBe(originalPath);
  });
});
