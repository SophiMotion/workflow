"""Fusion add-in entry point. / Fusion 插件入口。"""

import traceback


def _report_failure(operation, error_text):
    """Log startup errors even when a nested module cannot be imported."""
    import adsk.core  # type: ignore

    app = adsk.core.Application.get()
    message = "SophiCAD Bridge {}失败：\n{}".format(operation, error_text)
    try:
        app.log(
            message,
            adsk.core.LogLevels.ErrorLogLevel,
            adsk.core.LogTypes.FileLogType,
        )
    finally:
        app.userInterface.messageBox(message)


def run(context):
    try:
        # Keep the import inside the guarded block so Fusion can report package
        # import failures instead of silently leaving the add-in stopped.
        from .fusion.commands import install

        install()
    except Exception:
        _report_failure("启动", traceback.format_exc())


def stop(context):
    try:
        from .fusion.commands import uninstall

        uninstall()
    except Exception:
        _report_failure("停止", traceback.format_exc())
