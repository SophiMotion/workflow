"""Small deterministic URDF and loop-constraint exporter."""

from __future__ import annotations

import json
import math
import re
from typing import Any, Dict, List, Mapping, Sequence, Tuple
from xml.sax.saxutils import escape, quoteattr

from .domain import DocumentSnapshot, JointRecord


def _name(value: str, fallback: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_]", "_", value).strip("_")
    return clean or fallback


def _number(value: float) -> str:
    return "{:.12g}".format(value)


def _xyz(matrix: Sequence[float]) -> Tuple[float, float, float]:
    # Domain matrices are already normalized to SI metres at the Fusion boundary.
    return (float(matrix[3]), float(matrix[7]), float(matrix[11]))


def _rpy(matrix: Sequence[float]) -> Tuple[float, float, float]:
    sy = math.sqrt(matrix[0] * matrix[0] + matrix[4] * matrix[4])
    if sy > 1e-9:
        return (
            math.atan2(matrix[9], matrix[10]),
            math.atan2(-matrix[8], sy),
            math.atan2(matrix[4], matrix[0]),
        )
    return (math.atan2(-matrix[6], matrix[5]), math.atan2(-matrix[8], sy), 0.0)


def _vector(values: Sequence[float]) -> str:
    return " ".join(_number(float(value)) for value in values)


def _joint_type(value: str) -> str:
    if value in ("fixed", "revolute", "continuous", "prismatic"):
        return value
    return "fixed"


def _tree(snapshot: DocumentSnapshot, root: str) -> Tuple[List[Tuple[JointRecord, str, str]], List[JointRecord]]:
    valid = [
        joint for joint in snapshot.joints
        if not joint.suppressed and joint.parent_occurrence_id and joint.child_occurrence_id
    ]
    remaining = list(sorted(valid, key=lambda item: item.id))
    visited = {root}
    selected: List[Tuple[JointRecord, str, str]] = []
    progressed = True
    while progressed:
        progressed = False
        for joint in list(remaining):
            parent = joint.parent_occurrence_id
            child = joint.child_occurrence_id
            if parent in visited and child not in visited:
                selected.append((joint, parent, child))  # type: ignore[arg-type]
                visited.add(child)  # type: ignore[arg-type]
            elif child in visited and parent not in visited:
                selected.append((joint, child, parent))  # type: ignore[arg-type]
                visited.add(parent)  # type: ignore[arg-type]
            else:
                continue
            remaining.remove(joint)
            progressed = True
    selected_ids = {item[0].id for item in selected}
    closures = [joint for joint in valid if joint.id not in selected_ids]
    return selected, closures


def generate_robot_files(snapshot: DocumentSnapshot, model: Mapping[str, Any]) -> Tuple[bytes, bytes]:
    occurrences = list(snapshot.occurrences)
    if not occurrences:
        xml = '<?xml version="1.0"?>\n<robot name="empty"/>\n'
        constraints = {"schemaVersion": "1.0.0", "rootOccurrenceId": None, "loopClosures": []}
        return xml.encode("utf-8"), (json.dumps(constraints, indent=2) + "\n").encode("utf-8")

    requested_root = snapshot.robot.get("rootOccurrenceId")
    occurrence_ids = {item.id for item in occurrences}
    root = requested_root if requested_root in occurrence_ids else next(
        (item.id for item in occurrences if item.grounded), occurrences[0].id
    )
    link_names: Dict[str, str] = {}
    used = set()
    for index, occurrence in enumerate(occurrences):
        base = _name(occurrence.name, "link_{}".format(index + 1))
        candidate = base
        suffix = 2
        while candidate in used:
            candidate = "{}_{}".format(base, suffix)
            suffix += 1
        used.add(candidate)
        link_names[occurrence.id] = candidate

    components = {item["id"]: item for item in model.get("components", [])}
    physical = {item.entity_id: item for item in snapshot.physical_properties}
    robot_name = _name(str(snapshot.robot.get("name") or snapshot.identity.document_name), "fusion_robot")
    lines = ['<?xml version="1.0"?>', '<robot name={}>'.format(quoteattr(robot_name))]
    for occurrence in occurrences:
        lines.append('  <link name={}>'.format(quoteattr(link_names[occurrence.id])))
        properties = physical.get(occurrence.id) or physical.get(occurrence.component_id)
        if properties and properties.mass_kg > 0:
            inertia = properties.inertia_kg_m2
            lines.extend((
                "    <inertial>",
                '      <origin xyz="{}" rpy="0 0 0"/>'.format(_vector(properties.center_of_mass)),
                '      <mass value="{}"/>'.format(_number(properties.mass_kg)),
                '      <inertia ixx="{}" ixy="{}" ixz="{}" iyy="{}" iyz="{}" izz="{}"/>'.format(
                    _number(inertia[0]), _number(inertia[1]), _number(inertia[2]),
                    _number(inertia[4]), _number(inertia[5]), _number(inertia[8]),
                ),
                "    </inertial>",
            ))
        component = components.get(occurrence.component_id, {})
        visual = component.get("visualMesh")
        collision = component.get("collisionMesh")
        if visual:
            lines.extend((
                "    <visual>",
                "      <geometry><mesh filename={}/></geometry>".format(quoteattr(visual)),
                "    </visual>",
            ))
        if collision:
            lines.extend((
                "    <collision>",
                "      <geometry><mesh filename={}/></geometry>".format(quoteattr(collision)),
                "    </collision>",
            ))
        lines.append("  </link>")

    selected, closures = _tree(snapshot, root)
    connected = {root}
    for joint, parent, child in selected:
        connected.add(parent)
        connected.add(child)
        joint_type = _joint_type(joint.type)
        xyz = _xyz(joint.origin)
        rpy = _rpy(joint.origin)
        lines.append('  <joint name={} type={}>'.format(quoteattr(_name(joint.name, joint.id)), quoteattr(joint_type)))
        lines.append('    <parent link={}/>'.format(quoteattr(link_names[parent])))
        lines.append('    <child link={}/>'.format(quoteattr(link_names[child])))
        lines.append('    <origin xyz="{}" rpy="{}"/>'.format(_vector(xyz), _vector(rpy)))
        if joint_type in ("revolute", "continuous", "prismatic"):
            axis = joint.axis if parent == joint.parent_occurrence_id else tuple(-value for value in joint.axis)
            lines.append('    <axis xyz="{}"/>'.format(_vector(axis)))
        if joint_type in ("revolute", "prismatic"):
            limit = joint.limit or {}
            lines.append('    <limit lower="{}" upper="{}" effort="{}" velocity="{}"/>'.format(
                _number(limit.get("lower", 0.0)), _number(limit.get("upper", 0.0)),
                _number(limit.get("effort", 0.0)), _number(limit.get("velocity", 0.0)),
            ))
        lines.append("  </joint>")

    for occurrence in occurrences:
        if occurrence.id == root or occurrence.id in connected:
            continue
        synthetic = "sophicad_fixed_{}_{}".format(_name(root, "root"), _name(occurrence.id, "link"))
        lines.extend((
            '  <joint name={} type="fixed">'.format(quoteattr(synthetic)),
            '    <parent link={}/>'.format(quoteattr(link_names[root])),
            '    <child link={}/>'.format(quoteattr(link_names[occurrence.id])),
            '    <origin xyz="{}" rpy="{}"/>'.format(_vector(_xyz(occurrence.transform)), _vector(_rpy(occurrence.transform))),
            "  </joint>",
        ))
    lines.append("</robot>")

    loop_items = []
    for joint in closures:
        loop_items.append({
            "sourceJointId": joint.id,
            "type": joint.type,
            "parentOccurrenceId": joint.parent_occurrence_id,
            "childOccurrenceId": joint.child_occurrence_id,
            "origin": list(joint.origin),
            "axis": list(joint.axis),
            **({"limit": dict(joint.limit)} if joint.limit else {}),
        })
    constraints = {"schemaVersion": "1.0.0", "rootOccurrenceId": root, "loopClosures": loop_items}
    return (
        ("\n".join(lines) + "\n").encode("utf-8"),
        (json.dumps(constraints, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
    )
