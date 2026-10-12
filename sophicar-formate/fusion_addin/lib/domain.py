"""Fusion-independent exchange records. / 与 Fusion API 隔离的交换数据。"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple


Matrix4 = Tuple[float, ...]
Vector3 = Tuple[float, float, float]


def _compact(value: Any) -> Any:
    """Remove None recursively while preserving False and zero. / 递归移除空字段。"""
    if isinstance(value, dict):
        return {key: _compact(item) for key, item in value.items() if item is not None}
    if isinstance(value, (tuple, list)):
        return [_compact(item) for item in value]
    return value


@dataclass(frozen=True)
class DesignIdentity:
    design_guid: str
    document_name: str
    data_file_id: Optional[str]
    version_id: Optional[str]


@dataclass(frozen=True)
class ParameterRecord:
    name: str
    unit: str
    expression: str
    value_si: Optional[float]
    dependencies: Tuple[str, ...]
    writable: bool
    text_value: Optional[str] = None
    comment: Optional[str] = None
    favorite: Optional[bool] = None
    read_only_reason: Optional[str] = None
    created_by: Optional[str] = None

    def to_user_dict(self) -> Dict[str, Any]:
        return _compact({
            "name": self.name,
            "unit": self.unit,
            "expression": self.expression,
            "valueSi": self.value_si,
            "textValue": self.text_value,
            "comment": self.comment,
            "favorite": self.favorite,
            "dependencies": self.dependencies,
            "writable": self.writable,
            "readOnlyReason": self.read_only_reason,
        })

    def to_model_dict(self) -> Dict[str, Any]:
        return _compact({
            "name": self.name,
            "unit": self.unit,
            "expression": self.expression,
            "valueSi": self.value_si,
            "createdBy": self.created_by,
            "dependencies": self.dependencies,
        })


@dataclass(frozen=True)
class ComponentRecord:
    id: str
    name: str
    part_number: Optional[str] = None
    description: Optional[str] = None
    material: Optional[str] = None
    body_ids: Tuple[str, ...] = ()
    appearance: Optional[Mapping[str, Any]] = None
    visual_mesh: Optional[str] = None
    collision_mesh: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return _compact({
            "id": self.id,
            "name": self.name,
            "partNumber": self.part_number,
            "description": self.description,
            "material": self.material,
            "bodyIds": self.body_ids or None,
            "appearance": dict(self.appearance) if self.appearance else None,
            "visualMesh": self.visual_mesh,
            "collisionMesh": self.collision_mesh,
        })


@dataclass(frozen=True)
class OccurrenceRecord:
    id: str
    component_id: str
    name: str
    full_path: str
    transform: Matrix4
    parent_occurrence_id: Optional[str] = None
    entity_token: Optional[str] = None
    visible: bool = True
    grounded: bool = False
    read_only_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return _compact({
            "id": self.id,
            "componentId": self.component_id,
            "name": self.name,
            "fullPath": self.full_path,
            "parentOccurrenceId": self.parent_occurrence_id,
            "entityToken": self.entity_token,
            "transform": self.transform,
            "visible": self.visible,
            "grounded": self.grounded,
            "readOnlyReason": self.read_only_reason,
        })


@dataclass(frozen=True)
class JointRecord:
    id: str
    name: str
    parent_occurrence_id: Optional[str]
    child_occurrence_id: Optional[str]
    type: str
    fusion_type: str
    origin: Matrix4
    axis: Vector3
    degrees_of_freedom: int
    position: Optional[float] = None
    limit: Optional[Mapping[str, float]] = None
    suppressed: bool = False
    loop_closure: bool = False
    entity_token: Optional[str] = None
    writeback: Mapping[str, bool] = field(
        default_factory=lambda: {"limits": False, "type": False, "axis": False}
    )

    def to_dict(self) -> Dict[str, Any]:
        return _compact({
            "id": self.id,
            "name": self.name,
            "parentOccurrenceId": self.parent_occurrence_id,
            "childOccurrenceId": self.child_occurrence_id,
            "type": self.type,
            "fusionType": self.fusion_type,
            "origin": self.origin,
            "axis": self.axis,
            "degreesOfFreedom": self.degrees_of_freedom,
            "position": self.position,
            "limit": dict(self.limit) if self.limit else None,
            "suppressed": self.suppressed,
            "loopClosure": self.loop_closure,
            "entityToken": self.entity_token,
            "writeback": dict(self.writeback),
        })


@dataclass(frozen=True)
class PhysicalRecord:
    entity_id: str
    mass_kg: float
    volume_m3: float
    center_of_mass: Vector3
    inertia_kg_m2: Tuple[float, ...]
    inertia_frame: Matrix4
    accuracy: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entityId": self.entity_id,
            "massKg": self.mass_kg,
            "volumeM3": self.volume_m3,
            "centerOfMass": list(self.center_of_mass),
            "inertiaKgM2": list(self.inertia_kg_m2),
            "inertiaFrame": list(self.inertia_frame),
            "accuracy": self.accuracy,
        }


@dataclass(frozen=True)
class BomRecord:
    component_id: str
    quantity: int
    occurrence_ids: Tuple[str, ...]
    part_number: Optional[str] = None
    description: Optional[str] = None
    material: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return _compact({
            "componentId": self.component_id,
            "partNumber": self.part_number,
            "description": self.description,
            "material": self.material,
            "quantity": self.quantity,
            "occurrenceIds": self.occurrence_ids,
        })


@dataclass(frozen=True)
class DocumentSnapshot:
    identity: DesignIdentity
    parameters: Tuple[ParameterRecord, ...]
    model_parameters: Tuple[ParameterRecord, ...]
    components: Tuple[ComponentRecord, ...]
    occurrences: Tuple[OccurrenceRecord, ...]
    joints: Tuple[JointRecord, ...]
    physical_properties: Tuple[PhysicalRecord, ...]
    bom: Tuple[BomRecord, ...]
    robot: Mapping[str, Any]
    component_meshes: Mapping[str, Any]
    document_length_unit: str = "mm"
    document_angle_unit: str = "deg"

    def to_model_dict(self) -> Dict[str, Any]:
        return {
            "schemaVersion": "1.0.0",
            "units": {
                "length": "m",
                "mass": "kg",
                "angle": "rad",
                "inertia": "kg*m^2",
                "fusionDocumentLength": self.document_length_unit,
                "fusionDocumentAngle": self.document_angle_unit,
            },
            "parameters": {
                "user": [item.to_user_dict() for item in self.parameters],
                "model": [item.to_model_dict() for item in self.model_parameters],
            },
            "components": [item.to_dict() for item in self.components],
            "occurrences": [item.to_dict() for item in self.occurrences],
            "joints": [item.to_dict() for item in self.joints],
            "physicalProperties": [item.to_dict() for item in self.physical_properties],
            "bom": [item.to_dict() for item in self.bom],
            "robot": _compact(dict(self.robot)),
        }


@dataclass(frozen=True)
class ExportOptions:
    root_occurrence_id: Optional[str] = None
    include_hidden: bool = False
    mesh_quality: str = "medium"
    physical_accuracy: str = "very-high"


@dataclass(frozen=True)
class ComputeReport:
    completed: bool
    unhealthy_items: Tuple[str, ...] = ()

    @property
    def healthy(self) -> bool:
        return self.completed and not self.unhealthy_items
