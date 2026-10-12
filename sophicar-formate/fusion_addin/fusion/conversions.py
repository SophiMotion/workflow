"""Pure conversion helpers for Fusion database units."""

from typing import Any, Sequence, Tuple


def _matrix_values(matrix: Any) -> Tuple[float, ...]:
    if hasattr(matrix, "getCell"):
        return tuple(float(matrix.getCell(row, column)) for row in range(4) for column in range(4))
    source = getattr(matrix, "asArray", matrix)
    if callable(source):
        source = source()
    values = tuple(float(value) for value in source)
    if len(values) != 16:
        raise ValueError("Fusion transform must have 16 values")
    return values


def matrix_to_row_major_si(matrix: Any) -> Tuple[float, ...]:
    """Convert Fusion Matrix3D cm translation to row-major metre translation."""

    values = list(_matrix_values(matrix))
    for index in (3, 7, 11):
        values[index] *= 0.01
    return tuple(values)


def point_cm_to_m(point: Any) -> Tuple[float, float, float]:
    return (float(point.x) * 0.01, float(point.y) * 0.01, float(point.z) * 0.01)


def vector_xyz(vector: Any) -> Tuple[float, float, float]:
    return (float(vector.x), float(vector.y), float(vector.z))


def inertia_kg_cm2_to_kg_m2(value: float) -> float:
    return float(value) * 0.0001


def identity_matrix() -> Tuple[float, ...]:
    return (
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    )
