"""Mooncake Fusion 360 加载项 / Offline designer + JSON-to-solid add-in."""
import json
from pathlib import Path
import traceback
import subprocess
import sys
import adsk.core
import adsk.fusion
from .design_data import load_design, parse_design, mold_settings
from .fusion_model import build_model, save_model
from .local_bridge import Bridge

_PREFIX = 'SophiStudio_Mooncake_'
_PALETTE = _PREFIX + 'Designer'
_BUILD_EVENT = _PREFIX + 'BuildEvent'
_WEB_EVENT = _PREFIX + 'WebImportEvent'
_PANEL = 'SolidScriptsAddinsPanel'
_COMMANDS = [('Import', '导入月饼 JSON', '选择设计 JSON，生成月饼、套筒、镜像凹纹压片及螺纹推杆。'), ('Design', '设计月饼', '打开同目录 Mooncake.html，确认后生成月饼与模具。')]
_handlers = []
_busy = False
_pending = None
_bridge = None


def _app():
    return adsk.core.Application.get()


def _bind(event, handler):
    if not event or not event.add(handler):
        raise RuntimeError('无法注册 Fusion 事件，请重新运行 Mooncake。')
    _handlers.append((event, handler))


def _error(exc):
    _app().log(traceback.format_exc())
    _app().userInterface.messageBox(str(exc), 'Mooncake')


def _queue_build(data, from_palette=False, web_job=None):
    global _busy, _pending
    if _busy:
        raise RuntimeError('已有建模任务正在进行，请稍候。')
    _busy = True
    _pending = (data, from_palette, web_job)
    # 自定义事件在命令事务结束后处理 / Defer document creation beyond command events.
    try:
        # Fusion 2026 macOS 实测返回 False 仍会派发；以回调为准 / A false return can still dispatch; await the callback.
        _app().fireCustomEvent(_BUILD_EVENT)
    except Exception:
        _busy = False
        _pending = None
        raise


class _BuildEvent(adsk.core.CustomEventHandler):
    def notify(self, args):
        global _busy, _pending
        if _pending is None:
            return
        data, from_palette, web_job = _pending
        _pending = None
        reply = None
        try:
            data = {**data, 'mold': mold_settings(data)}
            component = build_model(data)
            if web_job:
                folder = Path(__file__).resolve().parent / 'exports'
                folder.mkdir(exist_ok=True)
                path = str(folder / ('Mooncake-{}mm-{}.f3d'.format(data['dimensions']['diameter'], web_job[:8])))
                manager = component.parentDesign.exportManager
                if not manager.execute(manager.createFusionArchiveExportOptions(path, component)):
                    raise RuntimeError('实体已创建，但 F3D 保存失败，请在 Fusion 中手动保存。')
                Path(path).with_suffix('.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            else:
                path = save_model(component)
            message = '月饼与三件模具已创建，装配文件已保存。' if path else '月饼、外套筒、镜像凹纹压片及螺纹推杆已创建，可分别导出。'
            reply = {'ok': True, 'message': message}
            if web_job:
                reply['filePath'] = path
            if not from_palette and not web_job:
                _app().userInterface.messageBox(message, 'Mooncake')
        except Exception as exc:
            reply = {'ok': False, 'error': str(exc)}
            _app().log(traceback.format_exc())
            if not from_palette and not web_job:
                _app().userInterface.messageBox(str(exc), 'Mooncake')
        finally:
            _busy = False
            if web_job and _bridge:
                _bridge.finish(web_job, reply)
            if from_palette and reply:
                palette = _app().userInterface.palettes.itemById(_PALETTE)
                if palette:
                    palette.sendInfoToHTML('buildFinished', json.dumps(reply, ensure_ascii=False))


class _WebImport(adsk.core.CustomEventHandler):
    def notify(self, args):
        task = _bridge.take() if _bridge else None
        if not task:
            return
        job_id, data = task
        try:
            _queue_build(data, web_job=job_id)
            # 网页确认后前置 Fusion / Bring Fusion forward after the web confirmation.
            if sys.platform == 'darwin':
                app_path = Path.home() / 'Library/Application Support/Autodesk/webdeploy/production/Autodesk Fusion.app'
                if app_path.is_dir():
                    subprocess.Popen(['/usr/bin/open', '-a', str(app_path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as exc:
            _bridge.finish(job_id, {'ok': False, 'error': str(exc)})


class _Execute(adsk.core.CommandEventHandler):
    def __init__(self, action):
        super().__init__()
        self.action = action

    def notify(self, args):
        try:
            if self.action == 'Design':
                _show_designer()
                return
            dialog = _app().userInterface.createFileDialog()
            dialog.title = '选择 Mooncake 设计 JSON'
            dialog.filter = 'Mooncake design (*.json)'
            if dialog.showOpen() == adsk.core.DialogResults.DialogOK:
                data = load_design(dialog.filename)
                message = '确认生成 {} × {} mm 月饼及对应模具？\n\n腔底厚 6 mm，内部直壁段 6 mm；套筒总高为月饼厚度加 12 mm。\n光杆 Ø30 × 40 mm，螺纹段 M20 × 2.5、长 15 mm；手柄 Ø40 mm，螺纹座 Ø30 mm。\n将创建月饼、外套筒、镜像凹纹压片、推杆与手柄四个组件。'.format(data['dimensions']['diameter'], data['dimensions']['thickness'])
                answer = _app().userInterface.messageBox(message, '确认月饼与模具', adsk.core.MessageBoxButtonTypes.YesNoButtonType)
                if answer == adsk.core.DialogResults.DialogYes:
                    _queue_build(data)
        except Exception as exc:
            _error(exc)


class _Created(adsk.core.CommandCreatedEventHandler):
    def __init__(self, action):
        super().__init__()
        self.action = action

    def notify(self, args):
        args.command.isExecutedWhenPreEmpted = False
        _bind(args.command.execute, _Execute(self.action))


class _Incoming(adsk.core.HTMLEventHandler):
    def notify(self, args):
        try:
            if args.action not in ('buildDesign', 'exportDesign'):
                raise ValueError('未知的设计器操作。')
            data = parse_design(args.data)
            if args.action == 'buildDesign':
                _queue_build(data, from_palette=True)
                args.returnData = json.dumps({'ok': True, 'pending': True, 'message': '正在 Fusion 中创建月饼与配套模具…'}, ensure_ascii=False)
                return
            else:
                dialog = _app().userInterface.createFileDialog()
                dialog.title = '导出月饼设计 JSON'
                dialog.filter = 'Mooncake design (*.json)'
                dialog.initialFilename = 'mooncake-{}mm.json'.format(data['dimensions']['diameter'])
                if dialog.showSave() != adsk.core.DialogResults.DialogOK:
                    args.returnData = json.dumps({'ok': True, 'message': '已取消导出。'})
                    return
                path = dialog.filename
                if not path.lower().endswith('.json'):
                    path += '.json'
                Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
                message = '设计 JSON 已保存。'
            args.returnData = json.dumps({'ok': True, 'message': message}, ensure_ascii=False)
        except Exception as exc:
            _app().log(traceback.format_exc())
            args.returnData = json.dumps({'ok': False, 'error': str(exc)}, ensure_ascii=False)


def _show_designer():
    ui = _app().userInterface
    html = Path(__file__).resolve().with_name('Mooncake.html')
    if not html.is_file():
        raise FileNotFoundError('请将 Mooncake.html 与 mooncake.py 放在同一个文件夹。')
    palette = ui.palettes.itemById(_PALETTE)
    if not palette:
        palette = ui.palettes.add(_PALETTE, 'Mooncake · 月饼定制工坊', html.as_uri(), True, True, True, 1220, 920, True)
        _bind(palette.incomingFromHTML, _Incoming())
    palette.isVisible = True


def run(context):
    global _bridge
    try:
        stop(context)
        ui = _app().userInterface
        _bind(_app().registerCustomEvent(_BUILD_EVENT), _BuildEvent())
        _bind(_app().registerCustomEvent(_WEB_EVENT), _WebImport())
        workspace = ui.workspaces.itemById('FusionSolidEnvironment')
        panel = workspace.toolbarPanels.itemById(_PANEL)
        if not panel:
            raise RuntimeError('请进入 Fusion 的设计工作区。')
        for action, name, description in _COMMANDS:
            definition = ui.commandDefinitions.addButtonDefinition(_PREFIX + action, name, description)
            _bind(definition.commandCreated, _Created(action))
            control = panel.controls.addCommand(definition)
            control.isPromoted = True
        app = _app()
        _bridge = Bridge(lambda: app.fireCustomEvent(_WEB_EVENT))
        _bridge.start()
    except Exception as exc:
        _error(exc)


def stop(context):
    global _handlers, _busy, _pending, _bridge
    if _bridge:
        _bridge.stop()
        _bridge = None
    _busy = False
    _pending = None
    ui = _app().userInterface
    for event, handler in _handlers:
        try:
            event.remove(handler)
        except Exception:
            pass
    _handlers = []
    try:
        _app().unregisterCustomEvent(_BUILD_EVENT)
        _app().unregisterCustomEvent(_WEB_EVENT)
    except Exception:
        pass
    palette = ui.palettes.itemById(_PALETTE)
    if palette:
        palette.deleteMe()
    workspace = ui.workspaces.itemById('FusionSolidEnvironment')
    panel = workspace.toolbarPanels.itemById(_PANEL) if workspace else None
    for action, _, _ in _COMMANDS:
        definition = ui.commandDefinitions.itemById(_PREFIX + action)
        control = panel.controls.itemById(_PREFIX + action) if panel else None
        if control:
            control.deleteMe()
        if definition:
            definition.deleteMe()
