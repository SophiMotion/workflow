import unittest
from math import pi
from types import SimpleNamespace

from fusion_addin.fusion.conversions import (
    inertia_kg_cm2_to_kg_m2,
    matrix_to_row_major_si,
    point_cm_to_m,
)
from fusion_addin.fusion.fusion_adapter import AutodeskFusionAdapter, _joint_position


class FakeMatrix:
    def __init__(self, values):
        self.values = values

    def getCell(self, row, column):
        return self.values[row * 4 + column]


class ConversionTest(unittest.TestCase):
    def test_design_guid_is_stable_for_same_fusion_data_file_without_mutating_design(self):
        class Attributes:
            def __init__(self):
                self.added = []

            def itemByName(self, _group, _name):
                return None

            def add(self, group, name, value):
                self.added.append((group, name, value))

        def adapter_for_data_file(data_file_id):
            adapter = AutodeskFusionAdapter.__new__(AutodeskFusionAdapter)
            attributes = Attributes()
            adapter.design = SimpleNamespace(rootComponent=SimpleNamespace(attributes=attributes))
            adapter.app = SimpleNamespace(activeDocument=SimpleNamespace(
                name="test1 v2",
                dataFile=SimpleNamespace(id=data_file_id),
            ))
            return adapter, attributes

        first, first_attributes = adapter_for_data_file("urn:adsk.wipprod:dm.lineage:stable")
        reopened, reopened_attributes = adapter_for_data_file("urn:adsk.wipprod:dm.lineage:stable")

        self.assertEqual(first._design_guid(), reopened._design_guid())
        self.assertEqual(first_attributes.added, [])
        self.assertEqual(reopened_attributes.added, [])

    def test_entity_id_is_deterministic_without_writing_fusion_attributes(self):
        class Attributes:
            def __init__(self):
                self.added = []

            def itemByName(self, _group, _name):
                return None

            def add(self, group, name, value):
                self.added.append((group, name, value))

        adapter = AutodeskFusionAdapter.__new__(AutodeskFusionAdapter)
        root_attributes = Attributes()
        adapter.design = SimpleNamespace(rootComponent=SimpleNamespace(attributes=root_attributes))
        adapter.app = SimpleNamespace(activeDocument=SimpleNamespace(
            name="test1 v2",
            dataFile=SimpleNamespace(id="urn:adsk.wipprod:dm.lineage:stable"),
        ))
        first_attributes = Attributes()
        reopened_attributes = Attributes()
        first = SimpleNamespace(attributes=first_attributes, entityToken="stable-native-token")
        reopened = SimpleNamespace(attributes=reopened_attributes, entityToken="stable-native-token")

        self.assertEqual(
            adapter._attribute_id(first, "componentId", "fallback-1"),
            adapter._attribute_id(reopened, "componentId", "fallback-2"),
        )
        self.assertEqual(first_attributes.added, [])
        self.assertEqual(reopened_attributes.added, [])

    def test_parameter_value_converts_fusion_internal_centimetres_to_metres(self):
        class UnitsManager:
            def convert(self, value, from_unit, to_unit):
                self.last_conversion = (value, from_unit, to_unit)
                return value * 0.01

        manager = UnitsManager()
        adapter = AutodeskFusionAdapter.__new__(AutodeskFusionAdapter)
        adapter.design = SimpleNamespace(unitsManager=manager)
        parameter = SimpleNamespace(unit="mm", expression="20 mm", value=2.0)

        self.assertEqual(adapter._parameter_value_si(parameter), 0.02)
        self.assertEqual(manager.last_conversion, (2.0, "cm", "m"))

    def test_parameter_angle_value_is_already_internal_radians(self):
        adapter = AutodeskFusionAdapter.__new__(AutodeskFusionAdapter)
        adapter.design = SimpleNamespace(unitsManager=object())
        parameter = SimpleNamespace(unit="deg", expression="90 deg", value=pi / 2)

        self.assertEqual(adapter._parameter_value_si(parameter), pi / 2)

    def test_joint_position_reads_model_parameter_value(self):
        class ModelParameter:
            value = 1.25

        class RevoluteJoint:
            angle = ModelParameter()

        self.assertEqual(_joint_position(RevoluteJoint(), "revolute"), 1.25)

    def test_slider_joint_position_converts_fusion_centimetres_to_metres(self):
        class ModelParameter:
            value = 12.5

        class SliderJoint:
            offset = ModelParameter()

        self.assertEqual(_joint_position(SliderJoint(), "prismatic"), 0.125)

    def test_fusion_cm_transform_converts_translation_to_metres(self):
        matrix = FakeMatrix((
            1, 0, 0, 20,
            0, 1, 0, 0,
            0, 0, 1, 5,
            0, 0, 0, 1,
        ))

        result = matrix_to_row_major_si(matrix)

        self.assertEqual(result[3], 0.2)
        self.assertEqual(result[11], 0.05)

    def test_point_and_inertia_convert_fusion_database_units(self):
        class Point:
            x, y, z = 10, -20, 5

        self.assertEqual(point_cm_to_m(Point()), (0.1, -0.2, 0.05))
        self.assertEqual(inertia_kg_cm2_to_kg_m2(250), 0.025)


if __name__ == "__main__":
    unittest.main()
