import unittest
from types import SimpleNamespace

from fusion_addin.fusion.commands import _resolve_panel, _save_dialog, build_import_preview_view
from fusion_addin.lib.import_service import ImportPreview, ParameterChangePreview


class CommandPresenterTest(unittest.TestCase):
    def test_save_dialog_uses_mac_safe_compound_extension(self):
        class Dialog:
            filename = "/private/tmp/model.sophicad"

            def showSave(self):
                return 1

        dialog = Dialog()

        class Ui:
            def createFileDialog(self):
                return dialog

        adsk = SimpleNamespace(
            core=SimpleNamespace(DialogResults=SimpleNamespace(DialogOK=1))
        )

        result = _save_dialog(Ui(), adsk)

        self.assertEqual(dialog.initialFilename, "model.sophicad")
        self.assertEqual(dialog.filter, "SophiCAD Package (*.zip)")
        self.assertEqual(str(result), "/private/tmp/model.sophicad.zip")

    def test_panel_resolution_falls_back_for_newer_fusion_ui(self):
        fallback = object()

        class Panels:
            def itemById(self, panel_id):
                return fallback if panel_id == "SolidUtilitiesPanel" else None

        class Workspace:
            toolbarPanels = Panels()

        self.assertIs(_resolve_panel(Workspace()), fallback)

    def test_panel_resolution_reports_missing_workspace(self):
        with self.assertRaisesRegex(RuntimeError, "设计工作区"):
            _resolve_panel(None)

    def test_import_preview_lists_new_expression_and_requires_confirmation_for_robot_changes(self):
        preview = ImportPreview(
            target_design_guid="design-1",
            base_fingerprint="a" * 64,
            parameter_changes=(ParameterChangePreview("l1", "mm", "200 mm", "220 mm", ()),),
            joint_change_count=1,
            robot_override_count=0,
            bom_override_count=0,
        )

        view = build_import_preview_view(preview)

        self.assertTrue(view.requires_confirmation)
        self.assertEqual(view.parameter_rows[0].new_expression, "220 mm")
        self.assertIn("1 个参数", view.summary)
        self.assertIn("机器人", view.warning)


if __name__ == "__main__":
    unittest.main()
