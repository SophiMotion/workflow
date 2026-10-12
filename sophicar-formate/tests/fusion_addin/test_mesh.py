import json
import struct
import unittest

from fusion_addin.lib.mesh import (
    BodyMeshData,
    TriangleMeshData,
    write_binary_stl,
    write_glb,
)


def single_triangle():
    return TriangleMeshData(
        positions_cm=(0, 0, 0, 1, 0, 0, 0, 1, 0),
        indices=(0, 1, 2),
    )


def parse_glb_json(glb):
    json_length, json_type = struct.unpack_from("<II", glb, 12)
    assert json_type == 0x4E4F534A
    return json.loads(glb[20:20 + json_length].decode("utf-8").rstrip(" \x00"))


class MeshWriterTest(unittest.TestCase):
    def test_glb_contains_valid_header_and_position_accessor(self):
        glb = write_glb([BodyMeshData(single_triangle(), (0.2, 0.4, 0.8, 1.0))])

        self.assertEqual(glb[:4], b"glTF")
        self.assertEqual(struct.unpack_from("<I", glb, 4)[0], 2)
        self.assertEqual(struct.unpack_from("<I", glb, 8)[0], len(glb))
        document = parse_glb_json(glb)
        self.assertEqual(document["accessors"][0]["count"], 3)
        self.assertEqual(document["accessors"][0]["max"], [0.01, 0.01, 0.0])
        self.assertEqual(document["materials"][0]["pbrMetallicRoughness"]["baseColorFactor"], [0.2, 0.4, 0.8, 1.0])

    def test_stl_writes_triangle_vertices_in_meters(self):
        stl = write_binary_stl(single_triangle())

        self.assertEqual(struct.unpack_from("<I", stl, 80)[0], 1)
        second_vertex = struct.unpack_from("<fff", stl, 84 + 12 + 12)
        self.assertAlmostEqual(second_vertex[0], 0.01)

    def test_glb_uses_unsigned_int_indices_above_65535(self):
        positions = (0.0,) * (65537 * 3)
        mesh = TriangleMeshData(positions_cm=positions, indices=(0, 65536, 1))

        document = parse_glb_json(write_glb([BodyMeshData(mesh, (1, 1, 1, 1))]))

        self.assertEqual(document["accessors"][1]["componentType"], 5125)

    def test_empty_mesh_is_rejected(self):
        with self.assertRaises(ValueError):
            write_glb([])


if __name__ == "__main__":
    unittest.main()
