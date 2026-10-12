import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from fusion_addin.lib.domain import (
    ComponentRecord,
    DesignIdentity,
    DocumentSnapshot,
    ExportOptions,
    OccurrenceRecord,
    ParameterRecord,
)
from fusion_addin.lib.export_service import ExportService
from fusion_addin.lib.mesh import BodyMeshData, TriangleMeshData
from tests.fusion_addin.fakes import IDENTITY


class SnapshotAdapter:
    def __init__(self, snapshot):
        self._snapshot = snapshot

    def snapshot(self, options):
        return self._snapshot


def reused_link_snapshot():
    mesh = TriangleMeshData(
        positions_cm=(0, 0, 0, 10, 0, 0, 0, 2, 0),
        indices=(0, 1, 2),
    )
    return DocumentSnapshot(
        identity=DesignIdentity("design-reuse", "reuse.f3d", None, None),
        parameters=(ParameterRecord("length", "mm", "100 mm", 0.1, (), True),),
        model_parameters=(),
        components=(ComponentRecord(id="link", name="Reusable Link"),),
        occurrences=(
            OccurrenceRecord("link:1", "link", "Link:1", "Link:1", IDENTITY, grounded=True),
            OccurrenceRecord("link:2", "link", "Link:2", "Link:2", IDENTITY),
        ),
        joints=(),
        physical_properties=(),
        bom=(),
        robot={"name": "reuse", "rootOccurrenceId": "link:1", "linkMappings": [], "jointOverrides": []},
        component_meshes={"link": (BodyMeshData(mesh, (0.5, 0.5, 0.5, 1.0)),)},
    )


def read_archive(path):
    with zipfile.ZipFile(path) as archive:
        return {
            name: archive.read(name)
            for name in archive.namelist()
        }


class ExportServiceTest(unittest.TestCase):
    def test_reused_component_exports_one_mesh_two_occurrences_and_bom(self):
        snapshot = reused_link_snapshot()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "reuse.sophicad.zip"
            report = ExportService(SnapshotAdapter(snapshot)).export(ExportOptions(), output)
            files = read_archive(output)

        model = json.loads(files["model.json"])
        visual_meshes = sorted(name for name in files if name.startswith("meshes/visual/"))
        self.assertEqual(len(model["components"]), 1)
        self.assertEqual(len(model["occurrences"]), 2)
        self.assertEqual(visual_meshes, ["meshes/visual/link.glb"])
        self.assertEqual(model["components"][0]["visualMesh"], visual_meshes[0])
        self.assertEqual(model["bom"][0]["quantity"], 2)
        self.assertEqual(report.component_count, 1)

    def test_export_includes_urdf_constraints_and_validation_report(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "reuse.sophicad.zip"
            ExportService(SnapshotAdapter(reused_link_snapshot())).export(ExportOptions(), output)
            files = read_archive(output)

        self.assertIn("robot/model.urdf", files)
        self.assertIn("robot/constraints.json", files)
        self.assertIn("reports/validation.json", files)
        validation = json.loads(files["reports/validation.json"])
        self.assertEqual(validation["errors"], [])


if __name__ == "__main__":
    unittest.main()
