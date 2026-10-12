import type {
  Diagnostic,
  JointLimit,
  JointRecord,
  Matrix4RowMajor,
  ModelDocument,
  PhysicalPropertiesRecord,
  Vector3,
} from '@sophicad/schema';

import { buildUrdfSpanningTree } from '../graph/assembly-graph.js';
import { sanitizeUrdfName, uniqueUrdfName } from './names.js';

export interface UrdfGenerationOptions {
  rootOccurrenceId: string;
  meshUriMode: 'relative' | 'package';
  packageName?: string;
}

export interface LoopClosureConstraint {
  sourceJointId: string;
  type: JointRecord['type'];
  parentOccurrenceId: string | null;
  childOccurrenceId: string | null;
  origin: Matrix4RowMajor;
  axis: Vector3;
  limit?: JointLimit;
}

export interface ConstraintsDocument {
  schemaVersion: '1.0.0';
  rootOccurrenceId: string;
  loopClosures: LoopClosureConstraint[];
}

export interface GeneratedLinkMetadata {
  name: string;
  occurrenceId?: string;
  meshPaths: string[];
  physicalProperties?: PhysicalPropertiesRecord;
}

export interface GeneratedJointMetadata {
  name: string;
  sourceJointId: string;
  type: 'fixed' | 'revolute' | 'continuous' | 'prismatic';
  parent: string;
  child: string;
}

export interface UrdfArtifacts {
  urdfXml: string;
  constraints: ConstraintsDocument;
  diagnostics: Diagnostic[];
  links: GeneratedLinkMetadata[];
  joints: GeneratedJointMetadata[];
  availableMeshPaths: Set<string>;
}

interface OrientedJoint {
  source: JointRecord;
  parentOccurrenceId: string;
  childOccurrenceId: string;
  origin: Matrix4RowMajor;
  axis: Vector3;
}

const identity: Matrix4RowMajor = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 1e-14 ? 0 : value;
  return Number.parseFloat(normalized.toPrecision(12)).toString();
}

function vector(value: readonly number[]): string {
  return value.map(formatNumber).join(' ');
}

function matrixToXyzRpy(matrix: Matrix4RowMajor): { xyz: Vector3; rpy: Vector3 } {
  const pitch = Math.asin(Math.max(-1, Math.min(1, -matrix[8])));
  const cosine = Math.cos(pitch);
  let roll: number;
  let yaw: number;
  if (Math.abs(cosine) > 1e-9) {
    roll = Math.atan2(matrix[9], matrix[10]);
    yaw = Math.atan2(matrix[4], matrix[0]);
  } else {
    roll = Math.atan2(-matrix[6], matrix[5]);
    yaw = 0;
  }
  return {
    xyz: [matrix[3], matrix[7], matrix[11]],
    rpy: [roll, pitch, yaw],
  };
}

function invertRigid(matrix: Matrix4RowMajor): Matrix4RowMajor {
  const tx = matrix[3];
  const ty = matrix[7];
  const tz = matrix[11];
  return [
    matrix[0], matrix[4], matrix[8], -(matrix[0] * tx + matrix[4] * ty + matrix[8] * tz),
    matrix[1], matrix[5], matrix[9], -(matrix[1] * tx + matrix[5] * ty + matrix[9] * tz),
    matrix[2], matrix[6], matrix[10], -(matrix[2] * tx + matrix[6] * ty + matrix[10] * tz),
    0, 0, 0, 1,
  ];
}

function meshUri(path: string, options: UrdfGenerationOptions): string {
  if (options.meshUriMode === 'relative') return path;
  const packageName = sanitizeUrdfName(options.packageName ?? 'robot_description', 'robot_description');
  return `package://${packageName}/${path}`;
}

function createLinkNames(model: ModelDocument): Map<string, string> {
  const configured = new Map(model.robot.linkMappings.map((item) => [item.occurrenceId, item.linkName]));
  const used = new Set<string>();
  const names = new Map<string, string>();
  for (const occurrence of [...model.occurrences].sort((left, right) => left.id.localeCompare(right.id))) {
    const desired = configured.get(occurrence.id) ?? occurrence.name;
    const safe = sanitizeUrdfName(desired, `link_${names.size + 1}`);
    names.set(occurrence.id, uniqueUrdfName(safe, used));
  }
  return names;
}

function orientTreeJoints(
  model: ModelDocument,
  rootOccurrenceId: string,
  treeJointIds: readonly string[],
): OrientedJoint[] {
  const joints = new Map(model.joints.map((item) => [item.id, item]));
  const remaining = treeJointIds.map((id) => joints.get(id)).filter((item): item is JointRecord => item !== undefined);
  const visited = new Set([rootOccurrenceId]);
  const oriented: OrientedJoint[] = [];

  while (remaining.length > 0) {
    const index = remaining.findIndex((joint) =>
      (joint.parentOccurrenceId !== null && visited.has(joint.parentOccurrenceId))
      || (joint.childOccurrenceId !== null && visited.has(joint.childOccurrenceId)));
    if (index < 0) break;
    const joint = remaining.splice(index, 1)[0]!;
    const sourceParentIsVisited = joint.parentOccurrenceId !== null && visited.has(joint.parentOccurrenceId);
    const parent = sourceParentIsVisited ? joint.parentOccurrenceId : joint.childOccurrenceId;
    const child = sourceParentIsVisited ? joint.childOccurrenceId : joint.parentOccurrenceId;
    if (!parent || !child || visited.has(child)) continue;
    oriented.push({
      source: joint,
      parentOccurrenceId: parent,
      childOccurrenceId: child,
      origin: sourceParentIsVisited ? joint.origin : invertRigid(joint.origin),
      axis: sourceParentIsVisited ? joint.axis : [-joint.axis[0], -joint.axis[1], -joint.axis[2]],
    });
    visited.add(child);
  }
  return oriented;
}

function limitXml(limit: JointLimit | undefined): string {
  const lower = limit?.lower ?? 0;
  const upper = limit?.upper ?? 0;
  const effort = limit?.effort ?? 0;
  const velocity = limit?.velocity ?? 0;
  return `    <limit lower="${formatNumber(lower)}" upper="${formatNumber(upper)}" effort="${formatNumber(effort)}" velocity="${formatNumber(velocity)}"/>`;
}

function jointXml(
  metadata: GeneratedJointMetadata,
  origin: Matrix4RowMajor,
  axis: Vector3,
  limit: JointLimit | undefined,
): string[] {
  const pose = matrixToXyzRpy(origin);
  const lines = [
    `  <joint name="${xmlEscape(metadata.name)}" type="${metadata.type}">`,
    `    <parent link="${xmlEscape(metadata.parent)}"/>`,
    `    <child link="${xmlEscape(metadata.child)}"/>`,
    `    <origin xyz="${vector(pose.xyz)}" rpy="${vector(pose.rpy)}"/>`,
  ];
  if (metadata.type !== 'fixed') {
    lines.push(`    <axis xyz="${vector(axis)}"/>`);
  }
  if (metadata.type === 'revolute' || metadata.type === 'prismatic') {
    lines.push(limitXml(limit));
  }
  lines.push('  </joint>');
  return lines;
}

function directType(type: JointRecord['type']): GeneratedJointMetadata['type'] | undefined {
  if (type === 'fixed') return 'fixed';
  if (type === 'revolute') return 'revolute';
  if (type === 'continuous') return 'continuous';
  if (type === 'prismatic') return 'prismatic';
  return undefined;
}

export function generateUrdf(model: ModelDocument, options: UrdfGenerationOptions): UrdfArtifacts {
  const tree = buildUrdfSpanningTree(model, options.rootOccurrenceId);
  const diagnostics = [...tree.diagnostics];
  const linkNames = createLinkNames(model);
  const componentById = new Map(model.components.map((item) => [item.id, item]));
  const physicalByEntity = new Map(model.physicalProperties.map((item) => [item.entityId, item]));
  const usedJointNames = new Set<string>();
  const usedLinkNames = new Set(linkNames.values());
  const links: GeneratedLinkMetadata[] = [];
  const joints: GeneratedJointMetadata[] = [];
  const availableMeshPaths = new Set<string>();
  const linkXml: string[] = [];
  const jointXmlLines: string[] = [];

  for (const occurrence of model.occurrences) {
    const name = linkNames.get(occurrence.id)!;
    const component = componentById.get(occurrence.componentId);
    const physical = physicalByEntity.get(occurrence.id) ?? physicalByEntity.get(occurrence.componentId);
    const meshPath = component?.collisionMesh;
    const meshPaths = meshPath ? [meshPath] : [];
    if (meshPath) availableMeshPaths.add(meshPath);
    links.push({
      name,
      occurrenceId: occurrence.id,
      meshPaths,
      ...(physical ? { physicalProperties: physical } : {}),
    });
    linkXml.push(`  <link name="${xmlEscape(name)}">`);
    if (physical) {
      const inertialPose = matrixToXyzRpy(physical.inertiaFrame);
      linkXml.push(
        '    <inertial>',
        `      <origin xyz="${vector(physical.centerOfMass)}" rpy="${vector(inertialPose.rpy)}"/>`,
        `      <mass value="${formatNumber(physical.massKg)}"/>`,
        `      <inertia ixx="${formatNumber(physical.inertiaKgM2[0])}" ixy="${formatNumber(physical.inertiaKgM2[1])}" ixz="${formatNumber(physical.inertiaKgM2[2])}" iyy="${formatNumber(physical.inertiaKgM2[4])}" iyz="${formatNumber(physical.inertiaKgM2[5])}" izz="${formatNumber(physical.inertiaKgM2[8])}"/>`,
        '    </inertial>',
      );
    }
    if (meshPath) {
      const uri = xmlEscape(meshUri(meshPath, options));
      linkXml.push(
        '    <visual>',
        `      <geometry><mesh filename="${uri}"/></geometry>`,
        '    </visual>',
        '    <collision>',
        `      <geometry><mesh filename="${uri}"/></geometry>`,
        '    </collision>',
      );
    }
    linkXml.push('  </link>');
  }

  for (const item of orientTreeJoints(model, options.rootOccurrenceId, tree.treeJointIds)) {
    const parent = linkNames.get(item.parentOccurrenceId)!;
    const child = linkNames.get(item.childOccurrenceId)!;
    const sourceName = /[A-Za-z_]/.test(item.source.name) ? item.source.name : item.source.id;
    const baseName = sanitizeUrdfName(sourceName, `joint_${joints.length + 1}`);
    const mapped = directType(item.source.type);
    if (mapped) {
      const metadata: GeneratedJointMetadata = {
        name: uniqueUrdfName(baseName, usedJointNames),
        sourceJointId: item.source.id,
        type: mapped,
        parent,
        child,
      };
      joints.push(metadata);
      jointXmlLines.push(...jointXml(metadata, item.origin, item.axis, item.source.limit));
      continue;
    }

    const decomposition = item.source.type === 'ball'
      ? (['revolute', 'revolute', 'revolute'] as const)
      : item.source.type === 'planar'
        ? (['prismatic', 'prismatic', 'revolute'] as const)
        : item.source.type === 'cylindrical' || item.source.type === 'pin-slot'
          ? (['revolute', 'prismatic'] as const)
          : (['fixed'] as const);
    const axes: Vector3[] = item.source.type === 'ball'
      ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
      : item.source.type === 'planar'
        ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        : decomposition.length === 2
          ? [item.axis, item.axis]
          : [item.axis];
    const suffixes = item.source.type === 'cylindrical' || item.source.type === 'pin-slot'
      ? ['rotate', 'slide']
      : decomposition.map((_, index) => `dof_${index + 1}`);

    let currentParent = parent;
    decomposition.forEach((type, index) => {
      const final = index === decomposition.length - 1;
      const virtualName = final
        ? child
        : uniqueUrdfName(`${child}__${baseName}_virtual_${index + 1}`, usedLinkNames);
      if (!final) {
        links.push({ name: virtualName, meshPaths: [] });
        linkXml.push(`  <link name="${xmlEscape(virtualName)}"/>`);
      }
      const metadata: GeneratedJointMetadata = {
        name: uniqueUrdfName(`${baseName}__${suffixes[index]}`, usedJointNames),
        sourceJointId: item.source.id,
        type,
        parent: currentParent,
        child: virtualName,
      };
      joints.push(metadata);
      jointXmlLines.push(...jointXml(
        metadata,
        index === 0 ? item.origin : identity,
        axes[index] ?? item.axis,
        item.source.limit,
      ));
      currentParent = virtualName;
    });
    diagnostics.push({
      severity: 'warning',
      code: decomposition[0] === 'fixed' ? 'joint_degraded_to_fixed' : 'joint_decomposed',
      message: `Fusion Joint ${item.source.id} 已转换为 ${decomposition.length} 个 URDF Joint。`,
      entityId: item.source.id,
    });
  }

  const loopJointMap = new Map(model.joints.map((item) => [item.id, item]));
  const loopClosures = tree.loopJointIds
    .map((id) => loopJointMap.get(id))
    .filter((item): item is JointRecord => item !== undefined)
    .map((joint): LoopClosureConstraint => ({
      sourceJointId: joint.id,
      type: joint.type,
      parentOccurrenceId: joint.parentOccurrenceId,
      childOccurrenceId: joint.childOccurrenceId,
      origin: joint.origin,
      axis: joint.axis,
      ...(joint.limit ? { limit: joint.limit } : {}),
    }));

  const robotName = sanitizeUrdfName(model.robot.name ?? 'robot', 'robot');
  return {
    urdfXml: [
      '<?xml version="1.0"?>',
      `<robot name="${xmlEscape(robotName)}">`,
      ...linkXml,
      ...jointXmlLines,
      '</robot>',
      '',
    ].join('\n'),
    constraints: {
      schemaVersion: '1.0.0',
      rootOccurrenceId: options.rootOccurrenceId,
      loopClosures,
    },
    diagnostics,
    links,
    joints,
    availableMeshPaths,
  };
}
