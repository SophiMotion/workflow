"""Concrete Autodesk Fusion adapter.

This module intentionally imports ``adsk`` only at runtime inside Fusion so the
domain and services remain testable with the system Python interpreter.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from ..lib.domain import (
    BomRecord,
    ComponentRecord,
    ComputeReport,
    DesignIdentity,
    DocumentSnapshot,
    ExportOptions,
    JointRecord,
    OccurrenceRecord,
    ParameterRecord,
    PhysicalRecord,
)
from ..lib.mesh import BodyMeshData, TriangleMeshData

from .conversions import (
    identity_matrix,
    inertia_kg_cm2_to_kg_m2,
    matrix_to_row_major_si,
    point_cm_to_m,
)
from .joints import degrees_of_freedom, joint_axis, joint_limits, joint_origin_matrix, joint_type


ATTRIBUTE_GROUP = "SophiCAD"


def _items(collection: Any) -> List[Any]:
    if collection is None:
        return []
    as_array = getattr(collection, "asArray", None)
    if callable(as_array):
        return list(as_array())
    if hasattr(collection, "count") and hasattr(collection, "item"):
        return [collection.item(index) for index in range(collection.count)]
    try:
        return list(collection)
    except TypeError:
        return []


def _safe_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    return text if text else None


def _property(object_: Any, name: str, default: Any = None) -> Any:
    try:
        return getattr(object_, name)
    except Exception:
        return default


def _model_parameter_value(value: Any) -> Optional[float]:
    """Read a Fusion numeric property that may be a ModelParameter object."""
    if value is None:
        return None
    raw = _property(value, "value", value)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _joint_position(joint: Any, kind: str) -> Optional[float]:
    """Return joint position in SI (radians or metres)."""
    if kind == "prismatic":
        offset = _model_parameter_value(_property(joint, "offset"))
        return offset * 0.01 if offset is not None else None
    angle = _model_parameter_value(_property(joint, "angle"))
    if angle is not None:
        return angle
    offset = _model_parameter_value(_property(joint, "offset"))
    return offset * 0.01 if offset is not None else None


class AutodeskFusionAdapter:
    """Read an active parametric design and apply safe user-parameter updates."""

    def __init__(self, app: Any = None):
        if app is None:
            import adsk.core  # type: ignore
            app = adsk.core.Application.get()
        self.app = app
        self.design = self._active_design()

    def _active_design(self) -> Any:
        import adsk.fusion  # type: ignore
        design = adsk.fusion.Design.cast(self.app.activeProduct)
        if design is None:
            raise RuntimeError("当前活动文档不是 Fusion Design。")
        return design

    def _attribute_id(self, entity: Any, key: str, seed: str) -> str:
        attributes = _property(entity, "attributes")
        if attributes is not None:
            try:
                existing = attributes.itemByName(ATTRIBUTE_GROUP, key)
                if existing and existing.value:
                    return str(existing.value)
            except Exception:
                pass

        # Entity tokens are Fusion's native persistent lookup identity. Derive
        # a namespaced UUID instead of writing an attribute during a read-only
        # export, which would dirty the source document.
        token = _safe_text(_property(entity, "entityToken")) or seed
        namespace = uuid.uuid5(uuid.NAMESPACE_URL, self._design_guid())
        return str(uuid.uuid5(namespace, "{}:{}".format(key, token)))

    def _design_guid(self) -> str:
        root = self.design.rootComponent
        attributes = root.attributes
        try:
            existing = attributes.itemByName(ATTRIBUTE_GROUP, "designGuid")
            if existing and existing.value:
                return str(existing.value)
        except Exception:
            pass

        # A Fusion data-file lineage ID survives closing and reopening the
        # document. Prefer a deterministic GUID derived from it so merely
        # exporting does not dirty the design by inserting an attribute.
        document = _property(self.app, "activeDocument")
        data_file = _property(document, "dataFile")
        data_file_id = _safe_text(_property(data_file, "id"))
        if data_file_id:
            return str(uuid.uuid5(
                uuid.NAMESPACE_URL,
                "autodesk-fusion-data-file:{}".format(data_file_id),
            ))

        full_file_name = _safe_text(_property(document, "fullFileName"))
        if full_file_name:
            return str(uuid.uuid5(
                uuid.NAMESPACE_URL,
                "autodesk-fusion-local-file:{}".format(full_file_name),
            ))

        value = str(uuid.uuid4())
        try:
            attributes.add(ATTRIBUTE_GROUP, "designGuid", value)
            return value
        except Exception:
            seed = "{}:{}".format(_property(document, "name", "FusionDesign"), _property(document, "creationId", ""))
            return str(uuid.uuid5(uuid.NAMESPACE_URL, seed))

    def active_design_identity(self) -> DesignIdentity:
        document = self.app.activeDocument
        data_file = _property(document, "dataFile")
        return DesignIdentity(
            design_guid=self._design_guid(),
            document_name=str(_property(document, "name", "Untitled")),
            data_file_id=_safe_text(_property(data_file, "id")),
            version_id=_safe_text(_property(data_file, "versionId")),
        )

    def _parameter_value_si(self, parameter: Any) -> Optional[float]:
        unit = str(_property(parameter, "unit", "")).strip().lower()
        manager = self.design.unitsManager
        value = _model_parameter_value(_property(parameter, "value"))
        if value is None:
            return None
        try:
            # Fusion stores every length internally in centimetres and every
            # angle in radians, regardless of the document/display unit.
            if unit in {"mm", "cm", "m", "in", "ft", "meter", "metre"}:
                return float(manager.convert(value, "cm", "m"))
            return value
        except Exception:
            if unit in {"mm", "cm", "m", "in", "ft", "meter", "metre"}:
                return value * 0.01
            return value

    def _parameter_dependencies(self, expression: str, names: Sequence[str], self_name: str) -> Tuple[str, ...]:
        tokens = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*", expression))
        return tuple(sorted(name for name in names if name != self_name and name in tokens))

    def _parameters(self) -> Tuple[Tuple[ParameterRecord, ...], Tuple[ParameterRecord, ...]]:
        users = _items(self.design.userParameters)
        all_parameters = _items(_property(self.design, "allParameters"))
        names = [str(item.name) for item in all_parameters]
        user_names = {str(item.name) for item in users}
        user_records = []
        for parameter in users:
            name = str(parameter.name)
            expression = str(parameter.expression)
            read_only = bool(_property(parameter, "isReadOnly", False))
            user_records.append(ParameterRecord(
                name=name,
                unit=str(_property(parameter, "unit", "")),
                expression=expression,
                value_si=self._parameter_value_si(parameter),
                dependencies=self._parameter_dependencies(expression, names, name),
                writable=not read_only,
                comment=_safe_text(_property(parameter, "comment")),
                favorite=_property(parameter, "isFavorite"),
                read_only_reason="Fusion parameter is read-only" if read_only else None,
            ))
        model_records = []
        for parameter in all_parameters:
            name = str(parameter.name)
            if name in user_names:
                continue
            expression = str(_property(parameter, "expression", str(_property(parameter, "value", 0))))
            created_by = _property(parameter, "createdBy")
            model_records.append(ParameterRecord(
                name=name,
                unit=str(_property(parameter, "unit", "")),
                expression=expression,
                value_si=self._parameter_value_si(parameter),
                dependencies=self._parameter_dependencies(expression, names, name),
                writable=False,
                created_by=_safe_text(_property(created_by, "name")),
            ))
        return tuple(user_records), tuple(model_records)

    def _component_id(self, component: Any) -> str:
        return self._attribute_id(component, "componentGuid", str(_property(component, "name", "component")))

    def _occurrence_id(self, occurrence: Any) -> str:
        return self._attribute_id(occurrence, "occurrenceGuid", str(_property(occurrence, "fullPathName", _property(occurrence, "name", "occurrence"))))

    def _body_id(self, body: Any) -> str:
        return self._attribute_id(body, "bodyGuid", str(_property(body, "name", "body")))

    def _base_color(self, body: Any, stable_id: str) -> Tuple[float, float, float, float]:
        appearance = _property(body, "appearance")
        properties = _items(_property(appearance, "appearanceProperties"))
        for prop in properties:
            value = _property(prop, "value")
            if all(hasattr(value, channel) for channel in ("red", "green", "blue")):
                alpha = float(_property(value, "opacity", 255)) / 255.0
                return (
                    float(value.red) / 255.0,
                    float(value.green) / 255.0,
                    float(value.blue) / 255.0,
                    alpha,
                )
        digest = hashlib.sha256(stable_id.encode("utf-8")).digest()
        return tuple(0.3 + channel / 255.0 * 0.5 for channel in digest[:3]) + (1.0,)  # type: ignore[return-value]

    def _mesh_body(self, body: Any, quality: str, stable_id: str) -> Optional[BodyMeshData]:
        triangle = None
        manager = _property(body, "meshManager")
        if manager is None:
            return None
        try:
            calculator = manager.createMeshCalculator()
            tolerances = {"low": 0.2, "medium": 0.05, "high": 0.01}
            calculator.surfaceTolerance = tolerances.get(quality, 0.05)
            triangle = calculator.calculate()
        except Exception:
            try:
                triangle = manager.displayMeshes.bestMesh
            except Exception:
                return None
        positions = tuple(float(value) for value in triangle.nodeCoordinatesAsDouble)
        indices = tuple(int(value) for value in triangle.nodeIndices)
        if not positions or not indices:
            return None
        return BodyMeshData(TriangleMeshData(positions, indices), self._base_color(body, stable_id))

    def _components(self, options: ExportOptions) -> Tuple[Tuple[ComponentRecord, ...], Mapping[str, Tuple[BodyMeshData, ...]]]:
        records = []
        meshes: Dict[str, Tuple[BodyMeshData, ...]] = {}
        for component in _items(self.design.allComponents):
            component_id = self._component_id(component)
            bodies = [body for body in _items(_property(component, "bRepBodies")) if options.include_hidden or bool(_property(body, "isVisible", True))]
            body_ids = tuple(self._body_id(body) for body in bodies)
            mesh_bodies = tuple(
                result for result in (
                    self._mesh_body(body, options.mesh_quality, body_id)
                    for body, body_id in zip(bodies, body_ids)
                ) if result is not None
            )
            if mesh_bodies:
                meshes[component_id] = mesh_bodies
            material = _property(component, "material")
            records.append(ComponentRecord(
                id=component_id,
                name=str(_property(component, "name", component_id)),
                part_number=_safe_text(_property(component, "partNumber")),
                description=_safe_text(_property(component, "description")),
                material=_safe_text(_property(material, "name")),
                body_ids=body_ids,
                appearance={"baseColor": list(mesh_bodies[0].base_color)} if mesh_bodies else None,
            ))
        return tuple(records), meshes

    def _occurrences(self, options: ExportOptions) -> Tuple[OccurrenceRecord, ...]:
        records = []
        for occurrence in _items(_property(self.design.rootComponent, "allOccurrences")):
            visible = bool(_property(occurrence, "isVisible", True))
            if not options.include_hidden and not visible:
                continue
            parent = _property(occurrence, "assemblyContext")
            referenced = bool(_property(occurrence, "isReferencedComponent", False))
            transform = _property(occurrence, "transform2", _property(occurrence, "transform"))
            records.append(OccurrenceRecord(
                id=self._occurrence_id(occurrence),
                component_id=self._component_id(occurrence.component),
                name=str(_property(occurrence, "name", "Occurrence")),
                full_path=str(_property(occurrence, "fullPathName", _property(occurrence, "name", "Occurrence"))),
                parent_occurrence_id=self._occurrence_id(parent) if parent is not None else None,
                entity_token=_safe_text(_property(occurrence, "entityToken")),
                transform=matrix_to_row_major_si(transform) if transform is not None else identity_matrix(),
                visible=visible,
                grounded=bool(_property(occurrence, "isGrounded", False)),
                read_only_reason="external-reference" if referenced else None,
            ))
        return tuple(records)

    def _joint_collections(self) -> List[Any]:
        root = self.design.rootComponent
        joints = _items(_property(root, "allJoints", _property(root, "joints")))
        joints.extend(_items(_property(root, "allAsBuiltJoints", _property(root, "asBuiltJoints"))))
        seen, unique = set(), []
        for joint in joints:
            token = _safe_text(_property(joint, "entityToken")) or str(id(joint))
            if token not in seen:
                unique.append(joint)
                seen.add(token)
        return unique

    def _joints(self) -> Tuple[JointRecord, ...]:
        records = []
        for joint in self._joint_collections():
            kind = joint_type(joint)
            one = _property(joint, "occurrenceOne")
            two = _property(joint, "occurrenceTwo")
            identifier = self._attribute_id(joint, "jointGuid", str(_property(joint, "name", "joint")))
            records.append(JointRecord(
                id=identifier,
                name=str(_property(joint, "name", identifier)),
                parent_occurrence_id=self._occurrence_id(one) if one is not None else None,
                child_occurrence_id=self._occurrence_id(two) if two is not None else None,
                type=kind,
                fusion_type=str(_property(joint, "jointType", kind)),
                origin=joint_origin_matrix(joint),
                axis=joint_axis(joint),
                degrees_of_freedom=degrees_of_freedom(kind),
                position=_joint_position(joint, kind),
                limit=joint_limits(joint, kind),
                suppressed=bool(_property(joint, "isSuppressed", False)),
                entity_token=_safe_text(_property(joint, "entityToken")),
                writeback={"limits": kind in ("revolute", "prismatic"), "type": False, "axis": False},
            ))
        return tuple(records)

    def _physical(self, occurrences: Sequence[OccurrenceRecord], options: ExportOptions) -> Tuple[PhysicalRecord, ...]:
        import adsk.fusion  # type: ignore
        accuracy_name = {
            "low": "LowCalculationAccuracy", "medium": "MediumCalculationAccuracy",
            "high": "HighCalculationAccuracy", "very-high": "VeryHighCalculationAccuracy",
        }.get(options.physical_accuracy, "VeryHighCalculationAccuracy")
        accuracy = getattr(adsk.fusion.CalculationAccuracy, accuracy_name)
        by_id = {self._occurrence_id(item): item for item in _items(self.design.rootComponent.allOccurrences)}
        result = []
        for record in occurrences:
            occurrence = by_id.get(record.id)
            if occurrence is None:
                continue
            try:
                props = occurrence.getPhysicalProperties(accuracy)
                ok, xx, yy, zz, xy, yz, xz = props.getXYZMomentsOfInertia()
                if not ok:
                    continue
                scale = inertia_kg_cm2_to_kg_m2
                result.append(PhysicalRecord(
                    entity_id=record.id,
                    mass_kg=float(props.mass),
                    volume_m3=float(props.volume) * 1e-6,
                    center_of_mass=point_cm_to_m(props.centerOfMass),
                    inertia_kg_m2=(
                        scale(xx), scale(xy), scale(xz),
                        scale(xy), scale(yy), scale(yz),
                        scale(xz), scale(yz), scale(zz),
                    ),
                    inertia_frame=identity_matrix(),
                    accuracy=options.physical_accuracy,
                ))
            except Exception:
                continue
        return tuple(result)

    def snapshot(self, options: ExportOptions) -> DocumentSnapshot:
        user_parameters, model_parameters = self._parameters()
        components, meshes = self._components(options)
        occurrences = self._occurrences(options)
        joints = self._joints()
        physical = self._physical(occurrences, options)
        groups: Dict[str, List[str]] = {}
        component_by_id = {item.id: item for item in components}
        for occurrence in occurrences:
            groups.setdefault(occurrence.component_id, []).append(occurrence.id)
        bom = tuple(
            BomRecord(
                component_id=component_id,
                quantity=len(ids),
                occurrence_ids=tuple(sorted(ids)),
                part_number=component_by_id[component_id].part_number,
                description=component_by_id[component_id].description,
                material=component_by_id[component_id].material,
            )
            for component_id, ids in sorted(groups.items())
            if component_id in component_by_id
        )
        root_id = options.root_occurrence_id
        if root_id is None:
            root_id = next((item.id for item in occurrences if item.grounded), occurrences[0].id if occurrences else None)
        overrides = self._read_robot_overrides()
        robot = {
            "name": re.sub(r"\.[^.]+$", "", self.active_design_identity().document_name),
            "rootOccurrenceId": root_id,
            "linkMappings": overrides.get("linkMappings", []),
            "jointOverrides": overrides.get("jointOverrides", []),
            **({"lockedTreeJointIds": overrides["lockedTreeJointIds"]} if "lockedTreeJointIds" in overrides else {}),
        }
        return DocumentSnapshot(
            identity=self.active_design_identity(),
            parameters=user_parameters,
            model_parameters=model_parameters,
            components=components,
            occurrences=occurrences,
            joints=joints,
            physical_properties=physical,
            bom=bom,
            robot=robot,
            component_meshes=meshes,
            document_length_unit=str(_property(self.design.unitsManager, "defaultLengthUnits", "mm")),
            document_angle_unit="deg",
        )

    def validate_expression(self, expression: str, unit: str) -> bool:
        try:
            return bool(self.design.unitsManager.isValidExpression(expression, unit))
        except Exception:
            try:
                self.design.unitsManager.evaluateExpression(expression, unit)
                return True
            except Exception:
                return False

    def current_parameter_expressions(self) -> Mapping[str, str]:
        return {str(item.name): str(item.expression) for item in _items(self.design.userParameters)}

    def set_user_parameter_expression(self, name: str, expression: str) -> None:
        parameter = self.design.userParameters.itemByName(name)
        if parameter is None:
            raise KeyError(name)
        parameter.expression = expression

    def compute_all(self) -> ComputeReport:
        completed = bool(self.design.computeAll())
        unhealthy = []
        timeline = _property(self.design, "timeline")
        for item in _items(timeline):
            entity = _property(item, "entity")
            state = str(_property(entity, "healthState", "")).lower()
            if "error" in state:
                unhealthy.append(str(_property(entity, "name", _property(item, "name", "timeline item"))))
        return ComputeReport(completed, tuple(unhealthy))

    def _read_robot_overrides(self) -> Mapping[str, Any]:
        try:
            attribute = self.design.rootComponent.attributes.itemByName(ATTRIBUTE_GROUP, "robotOverrides")
            if attribute and attribute.value:
                value = json.loads(attribute.value)
                return value if isinstance(value, dict) else {}
        except Exception:
            pass
        return {}

    def save_robot_overrides(self, robot_overrides: Sequence[Mapping[str, Any]], joint_changes: Sequence[Mapping[str, Any]], bom_overrides: Sequence[Mapping[str, Any]]) -> None:
        current = dict(self._read_robot_overrides())
        joint_override_values = []
        for item in robot_overrides:
            override = item.get("override", item)
            if isinstance(override, Mapping):
                joint_override_values.append(dict(override))
        current["jointOverrides"] = joint_override_values
        current["jointChanges"] = list(joint_changes)
        current["bomOverrides"] = list(bom_overrides)
        payload = json.dumps(current, ensure_ascii=False, separators=(",", ":"))
        attributes = self.design.rootComponent.attributes
        existing = attributes.itemByName(ATTRIBUTE_GROUP, "robotOverrides")
        if existing:
            existing.deleteMe()
        attributes.add(ATTRIBUTE_GROUP, "robotOverrides", payload)
