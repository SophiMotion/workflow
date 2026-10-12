import copy
import json
from pathlib import Path
import unittest
from mooncake.design_data import load_design, parse_design, validate_design, DesignError

EXAMPLES = Path(__file__).resolve().parents[1] / 'mooncake' / 'examples'


class ValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load_design(EXAMPLES / 'petals.json')

    def test_cross_runtime_examples(self):
        for file in EXAMPLES.glob('*.json'):
            with self.subTest(file=file.name):
                self.assertEqual(load_design(file)['units'], 'mm')

    def reject(self, update):
        data = copy.deepcopy(self.data)
        update(data)
        with self.assertRaises(DesignError):
            validate_design(data)

    def test_units_and_version(self):
        self.reject(lambda d: d.update(units='cm'))
        self.reject(lambda d: d.update(version=True))

    def test_finite_numbers_and_bounds(self):
        for value in [True, '80', float('nan'), float('inf'), 49, 121]:
            self.reject(lambda d: d['dimensions'].update(diameter=value))

    def test_text(self):
        for value in ['团圆福', '<', 'ABCDEF', '福A', 'a b', 'é', '123', None]:
            self.reject(lambda d: d['text'].update(character=value))
        for value in ['', '福', '囍', '𠮷', '团圆', '𠮷福', 'A', 'aBcDe']:
            d = copy.deepcopy(self.data)
            d['text']['character'] = value
            validate_design(d)

    def test_text_layout(self):
        self.reject(lambda d: d['text'].update(character='团圆', layout='circular'))
        self.reject(lambda d: d['text'].update(character='A', layout='unknown'))
        for text in [{'character': 'HELLO', 'layout': 'circular'}, {'character': '团圆'}]:
            data = copy.deepcopy(self.data)
            data['text'].pop('layout', None)
            data['text'].update(text)
            validate_design(data)

    def test_v2_draft_and_top_outline(self):
        from mooncake.design_data import top_outline
        data = copy.deepcopy(self.data)
        data['version'] = 2
        data['dimensions']['draftAngle'] = 5
        data['geometry']['topOutline'] = top_outline(data)
        validate_design(data)
        for value in [-1, 9, None, True, float('nan')]:
            broken = copy.deepcopy(data)
            broken['dimensions']['draftAngle'] = value
            with self.assertRaises(DesignError):
                validate_design(broken)
        for change in ['missing', 'mismatch']:
            broken = copy.deepcopy(data)
            if change == 'missing':
                broken['geometry'].pop('topOutline')
            else:
                broken['geometry']['topOutline'][0][0] += 1
            with self.assertRaises(DesignError):
                validate_design(broken)

    def test_outlines_must_match_dimensions(self):
        self.reject(lambda d: d['geometry']['outline'][0].__setitem__(0, 30))

    def test_self_intersection(self):
        self.reject(lambda d: d['geometry']['reliefs'].append({'outer': [[-2,-2],[3,2],[-2,3],[2,-2]], 'holes': [], 'height': 1}))

    def test_hole_outside_and_overlapping(self):
        self.reject(lambda d: d['geometry']['reliefs'][0]['holes'].append([[0,0],[1,0],[1,1],[0,1]]))

    def test_relief_height_and_outside(self):
        self.reject(lambda d: d['geometry']['reliefs'][0].update(height=9))
        self.reject(lambda d: d['geometry']['reliefs'][0]['outer'][0].__setitem__(0, 40))

    def test_complexity_limits(self):
        self.reject(lambda d: d['geometry'].update(reliefs=d['geometry']['reliefs']*30))

    def test_image_missing(self):
        self.reject(lambda d: d['front'].update(mode='image', image=None))

    def test_invalid_json(self):
        for raw in ['null', '{', '[]', '"x"', 'x' * (4*1024*1024+1)]:
            with self.assertRaises(DesignError):
                parse_design(raw)


if __name__ == '__main__':
    unittest.main()
