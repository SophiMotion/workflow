"""阴模配合与镜像关系回归 / Regression checks for fit and negative geometry."""
import copy
import math
import unittest
from pathlib import Path
from mooncake.design_data import load_design, mold_settings, validate_design, DesignError, signed_area
from mooncake.mold_data import mold_plan, mirror_loop


class MoldTests(unittest.TestCase):
    def setUp(self):
        self.data = load_design(Path(__file__).resolve().parents[1] / 'mooncake/examples/default-fu.json')

    def test_old_json_gets_defaults_and_invalid_settings_rejected(self):
        self.data.pop('mold', None)
        self.assertEqual(mold_settings(self.data)['radialClearance'], .3)
        for value in [None, {}, {**mold_settings(self.data), 'radialClearance': 0}, {**mold_settings(self.data), 'wallThickness': True}, {**mold_settings(self.data), 'stampThickness': float('nan')}]:
            with self.assertRaises(DesignError):
                validate_design({**self.data, 'mold': value})

    def test_cavity_matches_cake_and_stamp_has_radial_clearance(self):
        for gap in [.15, .3, .8]:
            data = copy.deepcopy(self.data)
            data['mold'] = {**mold_settings(data), 'radialClearance': gap}
            plan = mold_plan(data)
            self.assertEqual(plan['cavity'], data['geometry']['outline'])
            stamp = mirror_loop(plan['stampOutline'])
            for cavity, plate in zip(plan['topCavity'], stamp):
                self.assertAlmostEqual(math.hypot(*cavity) - math.hypot(*plate), gap)
            self.assertAlmostEqual(plan['guideRadius'] - plan['shaftRadius'], gap)

    def test_draft_cavity_and_ejection_clearance(self):
        for angle in [0, 5, 8]:
            data = copy.deepcopy(self.data)
            data['version'] = 2
            data['dimensions']['draftAngle'] = angle
            plan = mold_plan(data)
            inset = data['dimensions']['thickness'] * math.tan(math.radians(angle))
            stamp = mirror_loop(plan['stampOutline'])
            for base, top, plate in zip(plan['cavity'], plan['topCavity'], stamp):
                self.assertAlmostEqual(math.hypot(*base) - math.hypot(*top), inset)
                self.assertAlmostEqual(math.hypot(*top) - math.hypot(*plate), .3)
                for fraction in [0, .25, .5, .75, 1]:
                    self.assertGreaterEqual(math.hypot(*base) - inset * fraction - math.hypot(*plate), .3 - 1e-8)
            self.assertEqual(plan['cavityTaperHeight'], data['dimensions']['thickness'])

    def test_stamp_is_mirrored_negative_with_preserved_holes(self):
        plan = mold_plan(self.data)
        for original, groove in zip(sorted(self.data['geometry']['reliefs'], key=lambda r: r['height']), plan['grooves']):
            self.assertEqual(mirror_loop(groove['outer']), original['outer'])
            self.assertEqual([mirror_loop(h) for h in groove['holes']], original['holes'])
            self.assertEqual(groove['height'], original['height'])
            self.assertAlmostEqual(signed_area(groove['outer']), signed_area(original['outer']))
            self.assertGreaterEqual(plan['stampThickness'] - groove['height'], 1)

    def test_socket_and_rod_have_room_without_breaking_face(self):
        plan = mold_plan(self.data)
        self.assertGreater(plan['socketDepth'], plan['studLength'])
        self.assertGreater(plan['bossHeight'], plan['socketDepth'])
        self.assertLess(plan['bossRadius'], plan['guideRadius'])
        self.assertLessEqual(plan['stampThickness'], plan['guideHeight'])
        self.assertGreaterEqual(plan['ejectionTravel'], self.data['dimensions']['thickness'])

    def test_updated_hardware_and_legacy_upgrade(self):
        self.data['mold'] = {'type': 'hand_press', 'radialClearance': .3, 'wallThickness': 3.5, 'stampThickness': 6, 'connection': 'M8x1.25'}
        plan = mold_plan(self.data)
        self.assertEqual(plan['settings']['connection'], 'M20x2.5')
        for key, expected in {'baseThickness': 6, 'shaftRadius': 15, 'shaftLength': 40, 'studLength': 15, 'threadDiameter': 20, 'tapRadius': 8.75, 'handleRadius': 20, 'bossRadius': 15, 'socketDepth': 16, 'bossHeight': 18, 'guideRadius': 15.3, 'guideHeight': 6, 'ejectionTravel': 52}.items():
            self.assertEqual(plan[key], expected, key)
        self.data['mold']['wallThickness'] = 8
        self.assertEqual(mold_plan(self.data)['baseThickness'], 6)

    def test_cavity_height_tracks_cake_and_fit_is_checked_before_build(self):
        for thickness in [10, 26, 33, 40]:
            self.data['dimensions']['thickness'] = thickness
            plan = mold_plan(self.data)
            self.assertEqual(plan['cavityTaperHeight'], thickness)
            self.assertEqual(plan['sleeveHeight'], thickness + 6)
            self.assertGreaterEqual(plan['ejectionTravel'], thickness)
        self.data = load_design(Path(__file__).resolve().parents[1] / 'mooncake/examples/character-double-happiness.json')
        self.data['dimensions']['draftAngle'] = 8
        self.assertLess(mold_plan(self.data)['bossRadius'], 16)
        self.data['mold']['stampThickness'] = 8
        with self.assertRaisesRegex(DesignError, '6'):
            mold_plan(self.data)

    def test_v15_boss_upgrades_but_new_inconsistent_dimensions_fail(self):
        old = load_design(Path(__file__).resolve().parents[1] / 'mooncake/examples/m20-mold.json')
        old['mold']['bossDiameter'] = 40
        old['mold'].pop('guideHeight', None)
        settings = mold_settings(old)
        self.assertEqual(settings['bossDiameter'], 30)
        self.assertEqual(settings['guideHeight'], 6)
        self.assertEqual(settings['handleDiameter'], 40)
        old['mold']['guideHeight'] = 6
        with self.assertRaises(DesignError):
            mold_settings(old)


if __name__ == '__main__':
    unittest.main()
