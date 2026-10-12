"""Duck-typed Joint extraction helpers, importable without Autodesk modules."""

from __future__ import annotations

from typing import Any, Dict, Mapping, Optional, Tuple

from .conversions import identity_matrix, matrix_to_row_major_si, point_cm_to_m, vector_xyz


JOINT_TYPE_NAMES = {
    0: "rigid",
    1: "revolute",
    2: "slider",
    3: "cylindrical",
    4: "pin-slot",
    5: "planar",
    6: "ball",
}


def joint_type(joint: Any) -> str:
    raw = getattr(joint, "jointType", None)
    text = str(raw).lower()
    if isinstance(raw, int):
        text = JOINT_TYPE_NAMES.get(raw, text)
    mappings = (
        ("rigid", "fixed"), ("revolute", "revolute"), ("slider", "prismatic"),
        ("cylindrical", "cylindrical"), ("pinslot", "pin-slot"),
        ("pin-slot", "pin-slot"), ("planar", "planar"), ("ball", "ball"),
        ("inferred", "inferred"),
    )
    for needle, result in mappings:
        if needle in text:
            return result
    motion_type = str(getattr(getattr(joint, "jointMotion", None), "objectType", "")).lower()
    for needle, result in mappings:
        if needle in motion_type:
            return result
    return "unknown"


def degrees_of_freedom(kind: str) -> int:
    return {
        "fixed": 0, "revolute": 1, "prismatic": 1, "continuous": 1,
        "cylindrical": 2, "pin-slot": 2, "planar": 3, "ball": 3,
    }.get(kind, 0)


def _motion_axis(motion: Any) -> Tuple[float, float, float]:
    for name in ("rotationAxisVector", "slideDirectionVector", "primarySlideDirectionVector", "normalDirectionVector"):
        value = getattr(motion, name, None)
        if value is not None:
            return vector_xyz(value)
    return (0.0, 0.0, 1.0)


def joint_axis(joint: Any) -> Tuple[float, float, float]:
    return _motion_axis(getattr(joint, "jointMotion", None))


def _geometry(joint: Any) -> Any:
    for name in ("geometryOrOriginOne", "geometryOne", "jointOrigin"):
        value = getattr(joint, name, None)
        if value is not None:
            return value
    return None


def joint_origin_matrix(joint: Any) -> Tuple[float, ...]:
    geometry = _geometry(joint)
    transform = getattr(geometry, "transform", None)
    if transform is not None:
        return matrix_to_row_major_si(transform)
    point = getattr(geometry, "origin", None)
    if point is None:
        return identity_matrix()
    xyz = point_cm_to_m(point)
    primary = getattr(geometry, "primaryAxisVector", None)
    secondary = getattr(geometry, "secondaryAxisVector", None)
    third = getattr(geometry, "thirdAxisVector", None)
    if primary is None or secondary is None or third is None:
        values = list(identity_matrix())
    else:
        x, y, z = vector_xyz(primary), vector_xyz(secondary), vector_xyz(third)
        values = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1]
    values[3], values[7], values[11] = xyz
    return tuple(values)


def joint_limits(joint: Any, kind: str) -> Optional[Mapping[str, float]]:
    motion = getattr(joint, "jointMotion", None)
    if motion is None:
        return None
    limits = getattr(motion, "rotationLimits" if kind == "revolute" else "slideLimits", None)
    if limits is None:
        return None
    scale = 0.01 if kind == "prismatic" else 1.0
    result: Dict[str, float] = {}
    if getattr(limits, "isMinimumValueEnabled", False):
        result["lower"] = float(limits.minimumValue) * scale
    if getattr(limits, "isMaximumValueEnabled", False):
        result["upper"] = float(limits.maximumValue) * scale
    if not result:
        return None
    result.setdefault("effort", 0.0)
    result.setdefault("velocity", 0.0)
    return result
