import unittest

from tests.fusion_addin.fakes import make_snapshot


class DomainSerializationTest(unittest.TestCase):
    def test_snapshot_serializes_si_values_and_original_expression(self):
        snapshot = make_snapshot(
            parameter_name="l1",
            expression="200 mm",
            value_si=0.2,
        )

        payload = snapshot.to_model_dict()
        parameter = payload["parameters"]["user"][0]

        self.assertEqual(parameter["expression"], "200 mm")
        self.assertEqual(parameter["valueSi"], 0.2)
        self.assertEqual(payload["units"]["length"], "m")

    def test_occurrence_references_a_component_without_copying_component_fields(self):
        payload = make_snapshot().to_model_dict()

        self.assertEqual(payload["components"][0]["id"], "link")
        self.assertEqual(payload["occurrences"][0]["componentId"], "link")
        self.assertNotIn("partNumber", payload["occurrences"][0])


if __name__ == "__main__":
    unittest.main()
