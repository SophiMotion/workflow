"""Fusion toolbar commands plus testable Chinese presenters."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import traceback
from typing import Any, Optional, Tuple

from ..lib.diagnostics import diagnose
from ..lib.domain import ExportOptions
from ..lib.export_service import ExportReport, ExportService
from ..lib.import_service import ImportPreview, ImportService, ParameterChangePreview

from .event_handlers import clear, keep
from .fusion_adapter import AutodeskFusionAdapter


COMMANDS = (
    ("sophicad_export", "导出 SophiCAD", "导出参数、装配、BOM、网格、URDF 与闭环约束"),
    ("sophicad_import", "导入并重建", "预览更新包，写回用户参数并全量重建"),
    ("sophicad_diagnose", "装配诊断", "检查根节点、闭环、只读引用和物性"),
)
WORKSPACE_ID = "FusionSolidEnvironment"
PANEL_IDS = ("SolidScriptsAddinsPanel", "SolidUtilitiesPanel")


@dataclass(frozen=True)
class ImportPreviewView:
    summary: str
    parameter_rows: Tuple[ParameterChangePreview, ...]
    warning: str
    requires_confirmation: bool


def build_import_preview_view(preview: ImportPreview) -> ImportPreviewView:
    robot_changes = preview.joint_change_count + preview.robot_override_count
    warning = ""
    if robot_changes or preview.bom_override_count:
        warning = "包含机器人/URDF 或 BOM 覆盖；拓扑类修改会保存为 robot override。"
    summary = "将更新 {} 个参数、{} 个 Joint/机器人设置、{} 个 BOM 设置。".format(
        len(preview.parameter_changes), robot_changes, preview.bom_override_count
    )
    return ImportPreviewView(
        summary=summary,
        parameter_rows=preview.parameter_changes,
        warning=warning,
        requires_confirmation=bool(preview.parameter_changes or robot_changes or preview.bom_override_count),
    )


def _preview_text(view: ImportPreviewView) -> str:
    lines = [view.summary]
    for row in view.parameter_rows:
        lines.append("• {}: {} → {}".format(row.name, row.old_expression, row.new_expression))
    if view.warning:
        lines.extend(("", "注意：" + view.warning))
    return "\n".join(lines)


def _export_text(report: ExportReport) -> str:
    warnings = sum(item.severity == "warning" for item in report.diagnostics)
    return (
        "导出完成。\n\n组件：{}\n实例：{}\nJoint：{}\n警告：{}\n文件：{}"
        .format(report.component_count, report.occurrence_count, report.joint_count, warnings, report.output_path)
    )


def _resolve_panel(workspace: Any, panel_ids: Tuple[str, ...] = PANEL_IDS) -> Any:
    """Return the first available toolbar panel across Fusion UI versions."""
    if workspace is None:
        raise RuntimeError("找不到 Fusion 设计工作区：{}".format(WORKSPACE_ID))
    for panel_id in panel_ids:
        panel = workspace.toolbarPanels.itemById(panel_id)
        if panel is not None:
            return panel
    raise RuntimeError("找不到可用工具栏面板：{}".format(", ".join(panel_ids)))


def _log(app: Any, adsk: Any, message: str) -> None:
    app.log(
        "[SophiCADBridge] " + message,
        adsk.core.LogLevels.InfoLogLevel,
        adsk.core.LogTypes.FileLogType,
    )


def _save_dialog(ui: Any, adsk: Any) -> Optional[Path]:
    dialog = ui.createFileDialog()
    dialog.title = "导出 SophiCAD 数据包"
    # macOS appends the final extension automatically. Using the compound
    # suffix in both fields makes Fusion produce `.sophicad.zip.zip`.
    dialog.filter = "SophiCAD Package (*.zip)"
    dialog.initialFilename = "model.sophicad"
    if dialog.showSave() != adsk.core.DialogResults.DialogOK:
        return None
    path = Path(dialog.filename)
    if str(path).endswith(".sophicad"):
        path = Path(str(path) + ".zip")
    elif not str(path).endswith(".sophicad.zip"):
        path = Path(str(path) + ".sophicad.zip")
    return path


def _open_dialog(ui: Any, adsk: Any) -> Optional[Path]:
    dialog = ui.createFileDialog()
    dialog.title = "选择 Web 生成的更新包"
    dialog.filter = "SophiCAD Update (*.sophicad.zip);;ZIP (*.zip)"
    if dialog.showOpen() != adsk.core.DialogResults.DialogOK:
        return None
    return Path(dialog.filename)


def _execute(command_id: str, app: Any, ui: Any, adsk: Any) -> None:
    adapter = AutodeskFusionAdapter(app)
    if command_id == "sophicad_export":
        path = _save_dialog(ui, adsk)
        if path is None:
            return
        report = ExportService(adapter).export(ExportOptions(), path)
        ui.messageBox(_export_text(report), "SophiCAD")
        return
    if command_id == "sophicad_import":
        path = _open_dialog(ui, adsk)
        if path is None:
            return
        service = ImportService(adapter)
        preview = service.preview(path)
        view = build_import_preview_view(preview)
        result = ui.messageBox(
            _preview_text(view) + "\n\n确认写回并执行 Compute All？",
            "导入并重建",
            adsk.core.MessageBoxButtonTypes.OKCancelButtonType,
            adsk.core.MessageBoxIconTypes.QuestionIconType,
        )
        if result != adsk.core.DialogResults.DialogOK:
            return
        report = service.apply(path)
        ui.messageBox("重建完成，共更新 {} 个参数。".format(report.applied_parameter_count), "SophiCAD")
        return
    snapshot = adapter.snapshot(ExportOptions())
    findings = diagnose(snapshot)
    if not findings:
        text = "未发现装配问题。"
    else:
        text = "\n".join("[{}] {} — {}".format(item.severity.upper(), item.code, item.message) for item in findings)
    ui.messageBox(text, "SophiCAD 装配诊断")


def install(app: Any = None) -> None:
    import adsk.core  # type: ignore
    adsk = __import__("adsk")
    app = app or adsk.core.Application.get()
    ui = app.userInterface
    workspace = ui.workspaces.itemById(WORKSPACE_ID)
    panel = _resolve_panel(workspace)
    _log(app, adsk, "install start; panel={}".format(panel.id))

    for command_id, name, description in COMMANDS:
        existing_control = panel.controls.itemById(command_id)
        if existing_control:
            existing_control.deleteMe()
        definition = ui.commandDefinitions.itemById(command_id)
        if definition is None:
            definition = ui.commandDefinitions.addButtonDefinition(command_id, name, description)

        class ExecuteHandler(adsk.core.CommandEventHandler):
            def __init__(self, current_id: str):
                super().__init__()
                self.current_id = current_id

            def notify(self, args: Any) -> None:
                try:
                    _execute(self.current_id, app, ui, adsk)
                except Exception:
                    ui.messageBox("SophiCAD 命令失败：\n{}".format(traceback.format_exc()), "SophiCAD")

        class CreatedHandler(adsk.core.CommandCreatedEventHandler):
            def __init__(self, current_id: str):
                super().__init__()
                self.current_id = current_id

            def notify(self, args: Any) -> None:
                handler = keep(ExecuteHandler(self.current_id))
                args.command.execute.add(handler)

        created = keep(CreatedHandler(command_id))
        definition.commandCreated.add(created)
        panel.controls.addCommand(definition)
    _log(app, adsk, "install complete; commands={}".format(len(COMMANDS)))


def uninstall(app: Any = None) -> None:
    import adsk.core  # type: ignore
    app = app or adsk.core.Application.get()
    ui = app.userInterface
    workspace = ui.workspaces.itemById(WORKSPACE_ID)
    try:
        panel = _resolve_panel(workspace)
    except RuntimeError:
        panel = None
    for command_id, _name, _description in COMMANDS:
        control = panel.controls.itemById(command_id) if panel else None
        if control:
            control.deleteMe()
        definition = ui.commandDefinitions.itemById(command_id)
        if definition:
            definition.deleteMe()
    clear()
