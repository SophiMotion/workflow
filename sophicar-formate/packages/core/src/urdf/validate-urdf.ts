import { XMLValidator } from 'fast-xml-parser';

import type { Diagnostic } from '@sophicad/schema';

import { isPositiveDefiniteInertia } from '../physics/inertia.js';
import type { UrdfArtifacts } from './generate-urdf.js';

export function validateUrdfArtifacts(artifacts: UrdfArtifacts): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const xmlResult = XMLValidator.validate(artifacts.urdfXml);
  if (xmlResult !== true) {
    diagnostics.push({
      severity: 'error',
      code: 'urdf_xml_invalid',
      message: `URDF XML 无效：${xmlResult.err.msg}`,
    });
    return diagnostics;
  }

  const linkNames = new Set<string>();
  for (const link of artifacts.links) {
    if (linkNames.has(link.name)) {
      diagnostics.push({
        severity: 'error',
        code: 'urdf_duplicate_link',
        message: `URDF link 名称重复：${link.name}`,
        entityId: link.occurrenceId ?? link.name,
      });
    }
    linkNames.add(link.name);
    for (const path of link.meshPaths) {
      if (!artifacts.availableMeshPaths.has(path)) {
        diagnostics.push({
          severity: 'error',
          code: 'urdf_mesh_missing',
          message: `URDF mesh 不存在：${path}`,
          path,
        });
      }
    }
    const physical = link.physicalProperties;
    if (physical && (
      physical.massKg <= 0
      || !isPositiveDefiniteInertia(physical.inertiaKgM2)
    )) {
      diagnostics.push({
        severity: 'error',
        code: 'urdf_inertial_invalid',
        message: `link ${link.name} 的质量或惯量无效。`,
        entityId: link.occurrenceId ?? link.name,
      });
    }
  }

  const jointNames = new Set<string>();
  const childLinks = new Set<string>();
  for (const joint of artifacts.joints) {
    if (jointNames.has(joint.name)) {
      diagnostics.push({
        severity: 'error',
        code: 'urdf_duplicate_joint',
        message: `URDF joint 名称重复：${joint.name}`,
        entityId: joint.sourceJointId,
      });
    }
    jointNames.add(joint.name);
    if (!linkNames.has(joint.parent) || !linkNames.has(joint.child)) {
      diagnostics.push({
        severity: 'error',
        code: 'urdf_joint_link_missing',
        message: `Joint ${joint.name} 引用了不存在的 link。`,
        entityId: joint.sourceJointId,
      });
    }
    if (childLinks.has(joint.child)) {
      diagnostics.push({
        severity: 'error',
        code: 'urdf_multiple_parents',
        message: `link ${joint.child} 存在多个父 Joint。`,
        entityId: joint.sourceJointId,
      });
    }
    childLinks.add(joint.child);
  }

  const roots = [...linkNames].filter((name) => !childLinks.has(name));
  if (roots.length !== 1) {
    diagnostics.push({
      severity: 'error',
      code: 'urdf_root_count_invalid',
      message: `URDF 必须只有一个 root link，当前为 ${roots.length} 个。`,
    });
  }
  return diagnostics;
}
