"""Preview and transaction-like parameter writeback for Fusion update packages."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Sequence, Tuple, Union

from .adapter import FusionAdapter
from .domain import ExportOptions
from .package_io import UpdatePackage, compute_source_fingerprint, read_update_package


class ImportFailed(Exception):
    def __init__(self, code: str, message: str, details: Sequence[str] = ()):
        super().__init__("{}: {}".format(code, message))
        self.code = code
        self.details = tuple(details)


@dataclass(frozen=True)
class ParameterChangePreview:
    name: str
    unit: str
    old_expression: str
    new_expression: str
    dependencies: Tuple[str, ...]


@dataclass(frozen=True)
class ImportPreview:
    target_design_guid: str
    base_fingerprint: str
    parameter_changes: Tuple[ParameterChangePreview, ...]
    joint_change_count: int
    robot_override_count: int
    bom_override_count: int


@dataclass(frozen=True)
class ImportReport:
    applied_parameter_count: int
    joint_change_count: int
    robot_override_count: int
    bom_override_count: int
    compute_completed: bool


def _parameter_metadata(package: UpdatePackage) -> Mapping[str, Mapping[str, Any]]:
    parameters = package.model.get("parameters", {})
    items = parameters.get("user", []) if isinstance(parameters, Mapping) else []
    return {
        item["name"]: item
        for item in items
        if isinstance(item, Mapping) and isinstance(item.get("name"), str)
    }


def _ordered_changes(
    changes: Sequence[Mapping[str, Any]], metadata: Mapping[str, Mapping[str, Any]]
) -> List[Mapping[str, Any]]:
    by_name: Dict[str, Mapping[str, Any]] = {}
    for change in changes:
        name = change.get("name")
        if not isinstance(name, str) or not name:
            raise ImportFailed("invalid_parameter_change", "参数变更缺少名称。")
        if name in by_name:
            raise ImportFailed("duplicate_parameter_change", "参数变更名称重复：{}".format(name))
        by_name[name] = change

    pending = set(by_name)
    ordered: List[Mapping[str, Any]] = []
    while pending:
        ready = sorted(
            name for name in pending
            if not (set(metadata.get(name, {}).get("dependencies", ())) & pending)
        )
        if not ready:
            raise ImportFailed(
                "parameter_dependency_cycle",
                "变更参数之间存在循环依赖。",
                tuple(sorted(pending)),
            )
        for name in ready:
            ordered.append(by_name[name])
            pending.remove(name)
    return ordered


class ImportService:
    def __init__(self, adapter: FusionAdapter):
        self._adapter = adapter

    def _read_and_validate(self, source: Union[str, Path, bytes, bytearray]) -> Tuple[UpdatePackage, List[Mapping[str, Any]], Mapping[str, Mapping[str, Any]]]:
        package = read_update_package(source)
        changes = package.changes
        identity = self._adapter.active_design_identity()
        target = changes.get("targetDesignGuid")
        if target != identity.design_guid:
            raise ImportFailed(
                "design_guid_mismatch",
                "更新包目标设计与当前 Fusion 文档不一致。",
            )

        current_snapshot = self._adapter.snapshot(ExportOptions())
        actual_fingerprint = compute_source_fingerprint(current_snapshot)
        expected_fingerprint = changes.get("baseFingerprint")
        if actual_fingerprint != expected_fingerprint:
            raise ImportFailed(
                "base_fingerprint_mismatch",
                "当前设计已偏离导出基线，请重新导出后再修改。",
            )

        raw_changes = changes.get("parameterChanges", [])
        if not isinstance(raw_changes, list):
            raise ImportFailed("invalid_parameter_changes", "parameterChanges 必须是数组。")
        metadata = _parameter_metadata(package)
        ordered = _ordered_changes(raw_changes, metadata)
        current = self._adapter.current_parameter_expressions()
        writable = {item.name: item.writable for item in current_snapshot.parameters}
        for change in ordered:
            name = str(change["name"])
            old = change.get("oldExpression")
            new = change.get("newExpression")
            if not isinstance(old, str) or not isinstance(new, str) or not old or not new:
                raise ImportFailed("invalid_parameter_change", "参数 {} 的表达式无效。".format(name))
            if name not in current:
                raise ImportFailed("parameter_not_found", "当前设计中没有用户参数 {}。".format(name))
            if not writable.get(name, False):
                raise ImportFailed("parameter_read_only", "用户参数 {} 不可写。".format(name))
            if current[name] != old:
                raise ImportFailed(
                    "old_expression_mismatch",
                    "参数 {} 的当前表达式与更新包基线不一致。".format(name),
                )
            unit = str(metadata.get(name, {}).get("unit", ""))
            if not self._adapter.validate_expression(new, unit):
                raise ImportFailed("invalid_expression", "参数 {} 的新表达式无法解析。".format(name))
        return package, ordered, metadata

    def preview(self, source: Union[str, Path, bytes, bytearray]) -> ImportPreview:
        package, ordered, metadata = self._read_and_validate(source)
        rows = tuple(
            ParameterChangePreview(
                name=str(change["name"]),
                unit=str(metadata.get(str(change["name"]), {}).get("unit", "")),
                old_expression=str(change["oldExpression"]),
                new_expression=str(change["newExpression"]),
                dependencies=tuple(metadata.get(str(change["name"]), {}).get("dependencies", ())),
            )
            for change in ordered
        )
        changes = package.changes
        return ImportPreview(
            target_design_guid=str(changes["targetDesignGuid"]),
            base_fingerprint=str(changes["baseFingerprint"]),
            parameter_changes=rows,
            joint_change_count=len(changes.get("jointChanges", [])),
            robot_override_count=len(changes.get("robotOverrides", [])),
            bom_override_count=len(changes.get("bomOverrides", [])),
        )

    def apply(self, source: Union[str, Path, bytes, bytearray]) -> ImportReport:
        package, ordered, _metadata = self._read_and_validate(source)
        original = self._adapter.current_parameter_expressions()
        applied: List[str] = []
        try:
            # Re-check immediately before mutation to close the preview/apply race.
            for change in ordered:
                name = str(change["name"])
                if self._adapter.current_parameter_expressions().get(name) != change["oldExpression"]:
                    raise ImportFailed(
                        "old_expression_mismatch",
                        "写回前参数 {} 已发生变化。".format(name),
                    )
            for change in ordered:
                name = str(change["name"])
                self._adapter.set_user_parameter_expression(name, str(change["newExpression"]))
                applied.append(name)
            compute = self._adapter.compute_all()
            if not compute.healthy:
                raise ImportFailed(
                    "compute_failed",
                    "Fusion 全量重建失败。",
                    compute.unhealthy_items,
                )
        except Exception as error:
            rollback_error = None
            try:
                for name in reversed(applied):
                    self._adapter.set_user_parameter_expression(name, original[name])
                rollback = self._adapter.compute_all()
                if not rollback.healthy:
                    rollback_error = "恢复表达式后的 Fusion 重建仍不健康。"
            except Exception as caught:  # pragma: no cover - defensive Fusion boundary
                rollback_error = str(caught)
            if rollback_error is not None:
                raise ImportFailed(
                    "rollback_failed",
                    rollback_error,
                    tuple("{}={}".format(name, original[name]) for name in applied),
                ) from error
            raise ImportFailed(
                "compute_failed_rolled_back",
                "更新失败，已恢复全部原参数并重新计算。",
                getattr(error, "details", ()),
            ) from error

        changes = package.changes
        # Robot-only overrides remain portable even when Fusion cannot alter topology.
        save_overrides = getattr(self._adapter, "save_robot_overrides", None)
        if callable(save_overrides):
            save_overrides(
                changes.get("robotOverrides", []),
                changes.get("jointChanges", []),
                changes.get("bomOverrides", []),
            )
        return ImportReport(
            applied_parameter_count=len(ordered),
            joint_change_count=len(changes.get("jointChanges", [])),
            robot_override_count=len(changes.get("robotOverrides", [])),
            bom_override_count=len(changes.get("bomOverrides", [])),
            compute_completed=True,
        )
