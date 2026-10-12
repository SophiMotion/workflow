"""Dependency-free GLB and binary STL writers for Fusion mesh export.

Fusion 360 exposes geometry in centimetres.  The bridge package uses metres,
so conversion happens at this boundary instead of being repeated by readers.
"""

from dataclasses import dataclass
import json
import math
import struct
from typing import Iterable, Sequence, Tuple


@dataclass(frozen=True)
class TriangleMeshData:
    """Indexed triangle mesh using Fusion's centimetre coordinate convention."""

    positions_cm: Tuple[float, ...]
    indices: Tuple[int, ...]

    def __post_init__(self) -> None:
        if not self.positions_cm or len(self.positions_cm) % 3:
            raise ValueError("positions_cm must contain complete XYZ vertices")
        if not self.indices or len(self.indices) % 3:
            raise ValueError("indices must contain complete triangles")
        if not all(math.isfinite(value) for value in self.positions_cm):
            raise ValueError("mesh positions must be finite")
        vertex_count = len(self.positions_cm) // 3
        if any(index < 0 or index >= vertex_count for index in self.indices):
            raise ValueError("mesh index is outside the position buffer")


@dataclass(frozen=True)
class BodyMeshData:
    """A body mesh and its linear RGBA display colour."""

    mesh: TriangleMeshData
    base_color: Tuple[float, float, float, float]

    def __post_init__(self) -> None:
        if len(self.base_color) != 4:
            raise ValueError("base_color must be RGBA")
        if any(not math.isfinite(value) or value < 0.0 or value > 1.0 for value in self.base_color):
            raise ValueError("base_color channels must be finite values from 0 to 1")


def _align_four(buffer: bytearray, padding: int = 0) -> None:
    while len(buffer) % 4:
        buffer.append(padding)


def _positions_in_metres(mesh: TriangleMeshData) -> Tuple[float, ...]:
    return tuple(float(value) * 0.01 for value in mesh.positions_cm)


def write_glb(bodies: Sequence[BodyMeshData]) -> bytes:
    """Write one glTF mesh containing one primitive per Fusion body."""

    if not bodies:
        raise ValueError("at least one body mesh is required")

    binary = bytearray()
    buffer_views = []
    accessors = []
    materials = []
    primitives = []

    for body in bodies:
        positions = _positions_in_metres(body.mesh)
        position_offset = len(binary)
        binary.extend(struct.pack("<{}f".format(len(positions)), *positions))
        position_length = len(binary) - position_offset
        _align_four(binary)

        position_view = len(buffer_views)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": position_offset,
            "byteLength": position_length,
            "target": 34962,
        })
        xs = positions[0::3]
        ys = positions[1::3]
        zs = positions[2::3]
        position_accessor = len(accessors)
        accessors.append({
            "bufferView": position_view,
            "componentType": 5126,
            "count": len(positions) // 3,
            "type": "VEC3",
            "min": [min(xs), min(ys), min(zs)],
            "max": [max(xs), max(ys), max(zs)],
        })

        max_index = max(body.mesh.indices)
        index_component_type = 5123 if max_index <= 65535 else 5125
        index_format = "H" if index_component_type == 5123 else "I"
        index_offset = len(binary)
        binary.extend(struct.pack("<{}{}".format(len(body.mesh.indices), index_format), *body.mesh.indices))
        index_length = len(binary) - index_offset
        _align_four(binary)

        index_view = len(buffer_views)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": index_offset,
            "byteLength": index_length,
            "target": 34963,
        })
        index_accessor = len(accessors)
        accessors.append({
            "bufferView": index_view,
            "componentType": index_component_type,
            "count": len(body.mesh.indices),
            "type": "SCALAR",
            "min": [min(body.mesh.indices)],
            "max": [max_index],
        })

        material_index = len(materials)
        materials.append({
            "name": "Fusion body {}".format(material_index + 1),
            "pbrMetallicRoughness": {
                "baseColorFactor": list(body.base_color),
                "metallicFactor": 0.0,
                "roughnessFactor": 0.8,
            },
            "doubleSided": True,
        })
        primitives.append({
            "attributes": {"POSITION": position_accessor},
            "indices": index_accessor,
            "material": material_index,
            "mode": 4,
        })

    document = {
        "asset": {"version": "2.0", "generator": "SophiCAD Fusion Bridge"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "Fusion component"}],
        "meshes": [{"primitives": primitives}],
        "materials": materials,
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_chunk = bytearray(json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    _align_four(json_chunk, ord(" "))
    _align_four(binary)
    total_length = 12 + 8 + len(json_chunk) + 8 + len(binary)
    header = struct.pack("<4sII", b"glTF", 2, total_length)
    return b"".join((
        header,
        struct.pack("<II", len(json_chunk), 0x4E4F534A),
        bytes(json_chunk),
        struct.pack("<II", len(binary), 0x004E4942),
        bytes(binary),
    ))


def _normal(a: Sequence[float], b: Sequence[float], c: Sequence[float]) -> Tuple[float, float, float]:
    ab = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    ac = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
    cross = (
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
    )
    length = math.sqrt(sum(value * value for value in cross))
    if length == 0.0:
        return (0.0, 0.0, 0.0)
    return tuple(value / length for value in cross)  # type: ignore[return-value]


def write_binary_stl(mesh: TriangleMeshData) -> bytes:
    """Write a binary STL with metre-valued coordinates."""

    positions = _positions_in_metres(mesh)
    output = bytearray(b"SophiCAD Fusion Bridge".ljust(80, b"\x00"))
    output.extend(struct.pack("<I", len(mesh.indices) // 3))
    for offset in range(0, len(mesh.indices), 3):
        vertices = []
        for index in mesh.indices[offset:offset + 3]:
            start = index * 3
            vertices.append(positions[start:start + 3])
        output.extend(struct.pack("<3f", *_normal(*vertices)))
        for vertex in vertices:
            output.extend(struct.pack("<3f", *vertex))
        output.extend(struct.pack("<H", 0))
    return bytes(output)
