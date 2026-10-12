from dataclasses import replace
from pathlib import Path
import tempfile
import unittest

from fusion_addin.lib.domain import ComputeReport, ExportOptions
from fusion_addin.lib.import_service import ImportFailed, ImportService
from fusion_addin.lib.package_io import compute_source_fingerprint, write_package
from tests.fusion_addin.fakes import make_snapshot


class MutableAdapter:
    def __init__(self, snapshot, compute_results=()):
        self.base_snapshot = snapshot
        self.parameters = {item.name: item.expression for item in snapshot.parameters}
        self.compute_results = list(compute_results)
        self.compute_call_count = 0
        self.set_order = []

    def active_design_identity(self):
        return self.base_snapshot.identity

    def snapshot(self, options):
        parameters = tuple(
            replace(item, expression=self.parameters[item.name])
            for item in self.base_snapshot.parameters
        )
        return replace(self.base_snapshot, parameters=parameters)

    def validate_expression(self, expression, unit):
        return expression != "INVALID"

    def current_parameter_expressions(self):
        return dict(self.parameters)

    def set_user_parameter_expression(self, name, expression):
        self.set_order.append((name, expression))
        self.parameters[name] = expression

    def compute_all(self):
        self.compute_call_count += 1
        if self.compute_results:
            return self.compute_results.pop(0)
        return ComputeReport(True)


def two_parameter_snapshot():
    from fusion_addin.lib.domain import ParameterRecord

    base = make_snapshot()
    return replace(base, parameters=(
        ParameterRecord("l1", "mm", "200 mm", 0.2, (), True),
        ParameterRecord("l2", "mm", "l1 + 50 mm", 0.25, ("l1",), True),
    ))


def write_update(path, snapshot, changes, target_design_guid=None, base_fingerprint=None):
    fingerprint = base_fingerprint or compute_source_fingerprint(snapshot)
    manifest = {
        "schemaVersion": "1.0.0",
        "packageId": "base-package",
        "createdAt": "2026-08-28T00:00:00Z",
        "producer": "test",
        "producerVersion": "1",
        "source": {
            "designGuid": snapshot.identity.design_guid,
            "documentName": snapshot.identity.document_name,
            "dataFileId": None,
            "versionId": None,
            "fingerprint": fingerprint,
        },
        "coordinateSystem": {
            "frameName": "fusion_world",
            "convention": "x-forward-y-left-z-up",
            "sourceToRobot": list((1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)),
        },
    }
    change_set = {
        "schemaVersion": "1.0.0",
        "basePackageId": "base-package",
        "baseFingerprint": fingerprint,
        "targetDesignGuid": target_design_guid or snapshot.identity.design_guid,
        "createdAt": "2026-08-28T00:00:00Z",
        "parameterChanges": changes,
        "jointChanges": [],
        "robotOverrides": [],
        "bomOverrides": [],
    }
    write_package(path, manifest=manifest, model=snapshot.to_model_dict(), files={}, changes=change_set)


class ImportServiceTest(unittest.TestCase):
    def test_preview_is_read_only_and_apply_uses_dependency_order(self):
        snapshot = two_parameter_snapshot()
        adapter = MutableAdapter(snapshot)
        changes = [
            {"name": "l2", "oldExpression": "l1 + 50 mm", "newExpression": "l1 + 40 mm"},
            {"name": "l1", "oldExpression": "200 mm", "newExpression": "220 mm"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "update.sophicad.zip"
            write_update(path, snapshot, changes)
            preview = ImportService(adapter).preview(path)
            self.assertEqual(adapter.parameters["l1"], "200 mm")
            self.assertEqual([item.name for item in preview.parameter_changes], ["l1", "l2"])
            report = ImportService(adapter).apply(path)

        self.assertEqual(adapter.parameters, {"l1": "220 mm", "l2": "l1 + 40 mm"})
        self.assertEqual([item[0] for item in adapter.set_order], ["l1", "l2"])
        self.assertEqual(report.applied_parameter_count, 2)

    def test_design_mismatch_is_rejected_before_mutation(self):
        snapshot = two_parameter_snapshot()
        adapter = MutableAdapter(snapshot)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wrong.sophicad.zip"
            write_update(path, snapshot, [], target_design_guid="another-design")
            with self.assertRaisesRegex(ImportFailed, "design_guid_mismatch"):
                ImportService(adapter).apply(path)
        self.assertEqual(adapter.set_order, [])

    def test_compute_failure_restores_every_expression(self):
        snapshot = two_parameter_snapshot()
        adapter = MutableAdapter(snapshot, (
            ComputeReport(False, ("Extrude1",)),
            ComputeReport(True),
        ))
        changes = [
            {"name": "l1", "oldExpression": "200 mm", "newExpression": "220 mm"},
            {"name": "l2", "oldExpression": "l1 + 50 mm", "newExpression": "l1 + 40 mm"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "rollback.sophicad.zip"
            write_update(path, snapshot, changes)
            with self.assertRaisesRegex(ImportFailed, "compute_failed_rolled_back"):
                ImportService(adapter).apply(path)

        self.assertEqual(adapter.parameters, {"l1": "200 mm", "l2": "l1 + 50 mm"})
        self.assertEqual(adapter.compute_call_count, 2)


if __name__ == "__main__":
    unittest.main()
