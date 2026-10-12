"""Fusion-independent assembly diagnostics. / 与 Fusion 解耦的装配诊断。"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from .domain import DocumentSnapshot


@dataclass(frozen=True)
class Diagnostic:
    severity: str
    code: str
    message: str
    entity_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"severity": self.severity, "code": self.code, "message": self.message}
        if self.entity_id is not None:
            result["entityId"] = self.entity_id
        return result


def diagnose(snapshot: DocumentSnapshot) -> Tuple[Diagnostic, ...]:
    """Return stable diagnostic codes suitable for UI and automation."""

    findings: List[Diagnostic] = []
    component_ids = {item.id for item in snapshot.components}
    occurrence_ids = {item.id for item in snapshot.occurrences}

    for occurrence in snapshot.occurrences:
        if occurrence.component_id not in component_ids:
            findings.append(Diagnostic(
                "error", "missing_component_reference",
                "实例引用了不存在的组件。", occurrence.id,
            ))
        if occurrence.read_only_reason:
            findings.append(Diagnostic(
                "warning", "read_only_occurrence",
                "实例只读，Web 修改不会写回其几何关系。", occurrence.id,
            ))

    grounded = [item for item in snapshot.occurrences if item.grounded]
    if not grounded and snapshot.occurrences:
        findings.append(Diagnostic(
            "warning", "root_not_grounded",
            "装配中没有固定实例，将使用 robot root 或首个实例作为根。",
        ))
    elif len(grounded) > 1:
        findings.append(Diagnostic(
            "warning", "multiple_grounded_roots",
            "检测到多个固定实例，URDF 将选择一个根并生成单棵树。",
        ))

    for joint in snapshot.joints:
        for entity_id in (joint.parent_occurrence_id, joint.child_occurrence_id):
            if entity_id is not None and entity_id not in occurrence_ids:
                findings.append(Diagnostic(
                    "error", "missing_joint_occurrence",
                    "Joint 引用了不存在的实例。", joint.id,
                ))
                break
        if joint.loop_closure:
            findings.append(Diagnostic(
                "warning", "closed_loop_constraint",
                "闭环 Joint 将写入 constraints.json，URDF 仅保留生成树。", joint.id,
            ))

    for physical in snapshot.physical_properties:
        if physical.mass_kg <= 0:
            findings.append(Diagnostic(
                "warning", "non_positive_mass",
                "质量为空或非正值，机器人仿真前需要补充。", physical.entity_id,
            ))
    return tuple(findings)
