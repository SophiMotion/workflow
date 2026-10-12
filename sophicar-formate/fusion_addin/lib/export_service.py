"""Generic Fusion assembly export orchestration."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Mapping, Sequence, Union

from .adapter import FusionAdapter
from .diagnostics import Diagnostic, diagnose
from .domain import BomRecord, DocumentSnapshot, ExportOptions
from .mesh import BodyMeshData, TriangleMeshData, write_binary_stl, write_glb
from .package_io import PackageWriteResult, compute_source_fingerprint, write_package
from .urdf import generate_robot_files


class ExportFailed(Exception):
    def __init__(self, diagnostics: Sequence[Diagnostic]):
        super().__init__("装配诊断包含错误，导出已停止。")
        self.diagnostics = tuple(diagnostics)


@dataclass(frozen=True)
class ExportReport:
    output_path: Path
    package_id: str
    source_fingerprint: str
    component_count: int
    occurrence_count: int
    joint_count: int
    diagnostics: Sequence[Diagnostic]
    byte_count: int


def _slug(value: str) -> str:
    result = re.sub(r"[^A-Za-z0-9_-]", "_", value).strip("_")
    return result or "component"


def _combined_mesh(bodies: Sequence[BodyMeshData]) -> TriangleMeshData:
    positions: List[float] = []
    indices: List[int] = []
    for body in bodies:
        vertex_offset = len(positions) // 3
        positions.extend(body.mesh.positions_cm)
        indices.extend(index + vertex_offset for index in body.mesh.indices)
    return TriangleMeshData(tuple(positions), tuple(indices))


def _bom(snapshot: DocumentSnapshot) -> List[Dict[str, Any]]:
    if snapshot.bom:
        return [item.to_dict() for item in snapshot.bom]
    components = {item.id: item for item in snapshot.components}
    groups: Dict[str, List[str]] = {}
    for occurrence in snapshot.occurrences:
        groups.setdefault(occurrence.component_id, []).append(occurrence.id)
    result = []
    for component_id in sorted(groups):
        component = components.get(component_id)
        if component is None:
            continue
        result.append(BomRecord(
            component_id=component_id,
            quantity=len(groups[component_id]),
            occurrence_ids=tuple(sorted(groups[component_id])),
            part_number=component.part_number,
            description=component.description,
            material=component.material,
        ).to_dict())
    return result


class ExportService:
    def __init__(self, adapter: FusionAdapter):
        self._adapter = adapter

    def export(self, options: ExportOptions, output_path: Union[str, Path]) -> ExportReport:
        snapshot = self._adapter.snapshot(options)
        findings = diagnose(snapshot)
        errors = [item for item in findings if item.severity == "error"]
        if errors:
            raise ExportFailed(findings)

        model = snapshot.to_model_dict()
        model["bom"] = _bom(snapshot)
        files: Dict[str, bytes] = {}
        used_paths = set()
        component_payloads = {item["id"]: item for item in model["components"]}
        for component in snapshot.components:
            bodies = tuple(snapshot.component_meshes.get(component.id, ()))
            if not bodies:
                continue
            if any(not isinstance(body, BodyMeshData) for body in bodies):
                raise TypeError("component_meshes values must contain BodyMeshData")
            base = _slug(component.id)
            candidate = base
            suffix = 2
            while candidate in used_paths:
                candidate = "{}_{}".format(base, suffix)
                suffix += 1
            used_paths.add(candidate)
            visual_path = "meshes/visual/{}.glb".format(candidate)
            collision_path = "meshes/collision/{}.stl".format(candidate)
            files[visual_path] = write_glb(bodies)
            files[collision_path] = write_binary_stl(_combined_mesh(bodies))
            component_payloads[component.id]["visualMesh"] = visual_path
            component_payloads[component.id]["collisionMesh"] = collision_path

        urdf, constraints = generate_robot_files(snapshot, model)
        files["robot/model.urdf"] = urdf
        files["robot/constraints.json"] = constraints
        validation = {
            "schemaVersion": "1.0.0",
            "errors": [item.to_dict() for item in findings if item.severity == "error"],
            "warnings": [item.to_dict() for item in findings if item.severity == "warning"],
            "summary": {
                "components": len(snapshot.components),
                "occurrences": len(snapshot.occurrences),
                "joints": len(snapshot.joints),
            },
        }
        files["reports/validation.json"] = (json.dumps(validation, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

        package_id = str(uuid.uuid4())
        fingerprint = compute_source_fingerprint(snapshot)
        identity = snapshot.identity
        manifest = {
            "schemaVersion": "1.0.0",
            "packageId": package_id,
            "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "producer": "SophiCAD Fusion Bridge",
            "producerVersion": "0.1.0",
            "source": {
                "designGuid": identity.design_guid,
                "documentName": identity.document_name,
                "dataFileId": identity.data_file_id,
                "versionId": identity.version_id,
                "fingerprint": fingerprint,
            },
            "coordinateSystem": {
                "frameName": "fusion_world",
                "convention": "x-forward-y-left-z-up",
                "sourceToRobot": [
                    1, 0, 0, 0,
                    0, 1, 0, 0,
                    0, 0, 1, 0,
                    0, 0, 0, 1,
                ],
            },
        }
        result: PackageWriteResult = write_package(
            output_path, manifest=manifest, model=model, files=files
        )
        return ExportReport(
            output_path=result.output_path,
            package_id=package_id,
            source_fingerprint=fingerprint,
            component_count=len(snapshot.components),
            occurrence_count=len(snapshot.occurrences),
            joint_count=len(snapshot.joints),
            diagnostics=findings,
            byte_count=result.byte_count,
        )
