"""Adapter protocol for Autodesk Fusion. / Autodesk Fusion 适配器协议。"""

from __future__ import annotations

from typing import Mapping, Protocol

from .domain import ComputeReport, DesignIdentity, DocumentSnapshot, ExportOptions


class FusionAdapter(Protocol):
    def active_design_identity(self) -> DesignIdentity:
        ...

    def snapshot(self, options: ExportOptions) -> DocumentSnapshot:
        ...

    def validate_expression(self, expression: str, unit: str) -> bool:
        ...

    def current_parameter_expressions(self) -> Mapping[str, str]:
        ...

    def set_user_parameter_expression(self, name: str, expression: str) -> None:
        ...

    def compute_all(self) -> ComputeReport:
        ...
