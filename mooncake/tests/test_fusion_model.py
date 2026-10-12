"""API 编排回归测试；不替代 Fusion 几何内核实测 / Mock orchestration only."""
import importlib
import sys
import types
import unittest
from unittest.mock import MagicMock, patch
from pathlib import Path
from mooncake.design_data import load_design, DesignError

core, fusion = types.ModuleType('adsk.core'), types.ModuleType('adsk.fusion')
adsk = types.ModuleType('adsk')
adsk.core, adsk.fusion, adsk.doEvents = core, fusion, MagicMock()
for name in ['Application', 'Point3D', 'ValueInput', 'Matrix3D', 'DocumentTypes', 'Vector3D', 'ObjectCollection', 'Cylinder']:
    setattr(core, name, MagicMock())
for name in ['Design', 'FeatureOperations', 'DesignTypes', 'DesignIntentTypes', 'DistanceExtentDefinition', 'ExtentDirections']:
    setattr(fusion, name, MagicMock())
core.ValueInput.createByString.side_effect = lambda s: s
core.Point3D.create.side_effect = lambda *args: args
with patch.dict(sys.modules, {'adsk': adsk, 'adsk.core': core, 'adsk.fusion': fusion}):
    model = importlib.import_module('mooncake.fusion_model')


class ModelTests(unittest.TestCase):
    def setUp(self):
        self.app = MagicMock()
        core.Application.get.return_value = self.app
        self.design = MagicMock()
        fusion.Design.cast.return_value = self.design
        self.component = self.design.rootComponent.occurrences.addNewComponent.return_value.component
        self.design.rootComponent.occurrences.count = 4
        self.component.bRepBodies.count = 1
        self.component.bRepBodies.item.return_value.isSolid = True
        self.component.bRepBodies.item.return_value.volume = 10
        self.design.rootComponent.occurrences.item.return_value.component = self.component
        self.component.features.extrudeFeatures.addSimple.return_value.bodies.count = 1
        self.progress = self.app.userInterface.createProgressDialog.return_value
        self.progress.wasCancelled = False
        self.data = load_design(Path(__file__).resolve().parents[1] / 'mooncake/examples/cloud.json')
        self.data['version'] = 1
        self.data['dimensions'].pop('draftAngle', None)

    def test_hole_profile_selected_by_net_area(self):
        comp = MagicMock()
        sk = comp.sketches.add.return_value
        ring, hole = MagicMock(), MagicMock()
        ring.areaProperties.return_value.area = .64
        hole.areaProperties.return_value.area = .36
        sk.profiles.count = 2
        sk.profiles.item.side_effect = [hole, hole, ring, ring]
        region = {'outer': [[0,0],[10,0],[10,10],[0,10]], 'holes': [[[2,2],[8,2],[8,8],[2,8]]]}
        sketch, profile = model._sketch_region(comp, None, region, '字孔')
        self.assertIs(profile, ring)
        self.assertFalse(sketch.isComputeDeferred)
        self.assertEqual(sk.sketchCurves.sketchLines.addByTwoPoints.call_count, 8)

    def test_build_creates_isolated_document_and_joins_all_layers(self):
        with patch.object(model, '_sketch_region', return_value=(MagicMock(), MagicMock())), patch.object(model, '_layout'), patch.object(model, '_build_mold', return_value={'layoutPitch': 130}) as molds:
            result = model.build_model(self.data)
        self.assertIs(result, self.design.rootComponent)
        molds.assert_called_once_with(self.design.rootComponent, self.data, self.progress)
        self.app.documents.add.assert_called_once()
        self.assertEqual(self.component.features.extrudeFeatures.addSimple.call_count, 5)
        calls = self.component.features.extrudeFeatures.addSimple.call_args_list
        self.assertEqual(calls[0].args[1], '25 mm')
        self.assertAlmostEqual(float(calls[-1].args[1].split()[0]), 1.63)
        self.app.documents.add.return_value.close.assert_not_called()
        self.progress.hide.assert_called_once()

    def test_cancel_rolls_back_new_document(self):
        self.progress.wasCancelled = True
        with patch.object(model, '_sketch_region', return_value=(MagicMock(), MagicMock())):
            with self.assertRaises(DesignError):
                model.build_model(self.data)
        self.app.documents.add.return_value.close.assert_called_once_with(False)
        self.app.activeDocument.activate.assert_called_once()
        self.progress.hide.assert_called_once()

    def test_failed_extrusion_rolls_back(self):
        feature = MagicMock()
        feature.bodies.count = 1
        self.component.features.extrudeFeatures.addSimple.side_effect = [feature, None]
        with patch.object(model, '_sketch_region', return_value=(MagicMock(), MagicMock())):
            with self.assertRaises(RuntimeError):
                model.build_model(self.data)
        self.app.documents.add.return_value.close.assert_called_once_with(False)
        self.design.rootComponent.occurrences.addNewComponent.return_value.deleteMe.assert_called_once()

    def test_mold_cut_targets_only_its_own_body(self):
        comp, sketch, profile = MagicMock(), MagicMock(), MagicMock()
        comp.bRepBodies.count = 1
        model._extrude(comp, sketch, profile, 12, fusion.FeatureOperations.CutFeatureOperation, '模具内腔')
        value = comp.features.extrudeFeatures.createInput.return_value
        self.assertEqual(value.participantBodies, [comp.bRepBodies.item(0)])
        comp.features.extrudeFeatures.add.assert_called_once_with(value)
        comp.features.extrudeFeatures.addSimple.assert_not_called()

    def test_draft_loft_cut_targets_only_its_own_body(self):
        comp = MagicMock()
        comp.bRepBodies.count = 1
        with patch.object(model, '_plane'), patch.object(model, '_sketch_region', return_value=(MagicMock(), MagicMock())):
            model._loft_outline(comp, [[0,0],[10,0],[0,10]], [[0,0],[8,0],[0,8]], 0, 26, fusion.FeatureOperations.CutFeatureOperation, '斜度内腔')
        value = comp.features.loftFeatures.createInput.return_value
        self.assertEqual(value.participantBodies, [comp.bRepBodies.item(0)])
        self.assertTrue(value.isSolid)
        self.assertEqual(value.loftSections.add.call_count, 2)
        comp.features.loftFeatures.add.assert_called_once_with(value)

    def test_empty_solid_is_rejected(self):
        self.component.bRepBodies.item.return_value.volume = 0
        with self.assertRaises(RuntimeError):
            model._solid(self.component, '月饼')

    def test_layout_ungrounds_all_parts_before_any_move(self):
        events = []
        class Occurrence:
            def __init__(self, name):
                self.component = types.SimpleNamespace(name=name)
                self._grounded = True
                self.isGroundToParent = False
                self.transform2 = types.SimpleNamespace(translation=types.SimpleNamespace(asArray=lambda: [0, 0, 0]))
            @property
            def isGrounded(self):
                return self._grounded
            @isGrounded.setter
            def isGrounded(self, value):
                self._grounded = value
                events.append('release')
        parts = [Occurrence(name) for name in ['03_stamp', '01_cake', '04_rod', '02_sleeve']]
        root = types.SimpleNamespace(occurrences=parts, parentDesign=MagicMock())
        def place(occurrence, *position):
            events.append('move')
            occurrence.transform2.translation.asArray = lambda: [v / 10 for v in position]
        with patch.object(model, '_place', side_effect=place):
            model._layout(root, {'layoutPitch': 120, 'bossHeight': 12, 'studLength': 10})
        self.assertEqual(events, ['release'] * 4 + ['move'] * 4)
        self.assertEqual(parts[0].transform2.translation.asArray(), [-6, 6, 1.2])
        self.assertEqual(parts[1].transform2.translation.asArray(), [-6, -6, 0])


class QueueTests(unittest.TestCase):
    def setUp(self):
        for name in ['CommandEventHandler', 'CommandCreatedEventHandler', 'HTMLEventHandler', 'CustomEventHandler']:
            setattr(core, name, type(name, (), {}))
        with patch.dict(sys.modules, {'adsk': adsk, 'adsk.core': core, 'adsk.fusion': fusion}):
            self.plugin = importlib.import_module('mooncake.mooncake')
        self.plugin._busy = False
        self.plugin._pending = None
        self.app = MagicMock()
        core.Application.get.return_value = self.app
        self.app.fireCustomEvent.return_value = True

    def test_build_is_deferred_until_custom_event(self):
        with patch.object(self.plugin, 'build_model') as build, patch.object(self.plugin, 'save_model', return_value=None):
            self.plugin._queue_build({'test': True}, from_palette=True)
            build.assert_not_called()
            self.assertTrue(self.plugin._busy)
            with self.assertRaises(RuntimeError):
                self.plugin._queue_build({'second': True})
            self.plugin._BuildEvent().notify(None)
            from mooncake.design_data import MOLD_DEFAULT
            build.assert_called_once_with({'test': True, 'mold': MOLD_DEFAULT})
            self.assertFalse(self.plugin._busy)
            self.app.userInterface.palettes.itemById.return_value.sendInfoToHTML.assert_called_once()

    def test_queue_failure_does_not_lock_future_builds(self):
        self.app.fireCustomEvent.side_effect = RuntimeError('event error')
        with self.assertRaises(RuntimeError):
            self.plugin._queue_build({})
        self.assertFalse(self.plugin._busy)
        self.assertIsNone(self.plugin._pending)

    def test_false_return_still_waits_for_dispatched_event(self):
        self.app.fireCustomEvent.return_value = False
        with patch.object(self.plugin, 'build_model') as build, patch.object(self.plugin, 'save_model', return_value=None):
            self.plugin._queue_build({'test': True}, from_palette=True)
            self.assertTrue(self.plugin._busy)
            self.plugin._BuildEvent().notify(None)
            build.assert_called_once()
            self.assertFalse(self.plugin._busy)

if __name__ == '__main__':
    unittest.main()
