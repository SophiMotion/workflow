import io
import json
import tempfile
import unittest
import zipfile
from dataclasses import replace
from pathlib import Path

from fusion_addin.lib.package_io import (
    PackageError,
    canonical_json_bytes,
    compute_source_fingerprint,
    read_update_package,
    write_package,
)
from tests.fusion_addin.fakes import make_snapshot


def malicious_zip():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("../escape", b"bad")
    return output.getvalue()


class PackageIoTest(unittest.TestCase):
    def test_fingerprint_is_stable_when_source_collections_are_reordered(self):
        snapshot = make_snapshot()
        reversed_snapshot = replace(
            snapshot,
            parameters=tuple(reversed(snapshot.parameters)),
            components=tuple(reversed(snapshot.components)),
            occurrences=tuple(reversed(snapshot.occurrences)),
        )

        self.assertEqual(
            compute_source_fingerprint(snapshot),
            compute_source_fingerprint(reversed_snapshot),
        )

    def test_update_reader_rejects_parent_path(self):
        with self.assertRaises(PackageError) as raised:
            read_update_package(malicious_zip())

        self.assertEqual(raised.exception.code, "unsafe_archive_path")

    def test_writer_creates_a_new_hash_verified_package(self):
        snapshot = make_snapshot()
        manifest = {
            "schemaVersion": "1.0.0",
            "packageId": "package-1",
            "createdAt": "2026-08-28T00:00:00.000Z",
            "producer": "test",
            "producerVersion": "0.1.0",
            "source": {
                "designGuid": "design-1",
                "documentName": "test1.f3d",
                "dataFileId": None,
                "versionId": None,
                "fingerprint": compute_source_fingerprint(snapshot),
            },
            "coordinateSystem": {
                "frameName": "root",
                "convention": "x-forward-y-left-z-up",
                "sourceToRobot": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            },
            "files": [],
        }
        changes = {
            "schemaVersion": "1.0.0",
            "basePackageId": "package-1",
            "baseFingerprint": manifest["source"]["fingerprint"],
            "targetDesignGuid": "design-1",
            "createdAt": "2026-08-28T00:00:00.000Z",
            "parameterChanges": [],
            "jointChanges": [],
            "robotOverrides": [],
            "bomOverrides": [],
        }

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "update.sophicad.zip"
            write_package(
                output,
                manifest=manifest,
                model=snapshot.to_model_dict(),
                files={"robot/robot.urdf": b"<robot name=\"test\"/>\n"},
                changes=changes,
            )
            package = read_update_package(output)

            self.assertEqual(package.changes["targetDesignGuid"], "design-1")
            self.assertEqual(package.files["robot/robot.urdf"], b"<robot name=\"test\"/>\n")
            with zipfile.ZipFile(output) as archive:
                saved_manifest = json.loads(archive.read("manifest.json"))
            self.assertEqual(
                [entry["path"] for entry in saved_manifest["files"]],
                ["changes.json", "model.json", "robot/robot.urdf"],
            )

    def test_writer_refuses_to_overwrite_an_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "existing.zip"
            output.write_bytes(b"keep")
            with self.assertRaises(PackageError) as raised:
                write_package(output, manifest={}, model={}, files={})
            self.assertEqual(raised.exception.code, "output_already_exists")
            self.assertEqual(output.read_bytes(), b"keep")


if __name__ == "__main__":
    unittest.main()
