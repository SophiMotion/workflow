"""SophiStudio Fusion add-in. Only local JSON data crosses the bridge.

Worker thread watches files; all Fusion UI/model operations use a main-thread event.
后台仅检查本地文件，Fusion 操作统一交给主线程事件。
"""
import adsk.core
import json
import os
import threading
import time
import traceback
from .payload import load_payload, validate_payload
from .modeling import build_model, save_f3d

FOLDER=os.path.dirname(os.path.realpath(__file__))
EVENT='SophiStudio.SkateChassis20260906.Request'
COMMAND='SophiStudio.SkateChassis20260906.Open'
PALETTE='SophiStudio.SkateChassis20260906.Panel'
_handlers=[]
_app=None
_bridge=None
_stop=None
_thread=None
_payload=None
_design=None
_request_id=None
_message='从网页发送配置，或选择已下载的 JSON 文件。'
_busy=False
_seen=set()

def atomic(file,data):
    temporary=file+'.tmp'
    with open(temporary,'w',encoding='utf-8') as stream: json.dump(data,stream,ensure_ascii=False)
    os.replace(temporary,file)

def report(state,message):
    global _message
    _message=message
    if _request_id and _bridge:
        atomic(os.path.join(_bridge,'reply.json'),{'id':_request_id,'state':state,'message':message,'at':int(time.time()*1000)})
    update_panel()

def update_panel():
    panel=_app.userInterface.palettes.itemById(PALETTE)
    if panel:
        panel.sendInfoToHTML('state',json.dumps({'payload':_payload,'message':_message,'busy':_busy,
            'hasModel':bool(_design and _design.isValid)},ensure_ascii=False))

def show_panel():
    ui=_app.userInterface
    panel=ui.palettes.itemById(PALETTE)
    if not panel:
        panel=ui.palettes.add(PALETTE,'SophiStudio · SkateChassis',os.path.join(FOLDER,'palette.html'),True,True,True,390,610)
        handler=HtmlHandler();panel.incomingFromHTML.add(handler);_handlers.append(handler)
        panel.dockingState=adsk.core.PaletteDockingStates.PaletteDockStateRight
    panel.isVisible=True
    update_panel()

def import_file():
    global _payload,_request_id
    dialog=_app.userInterface.createFileDialog()
    dialog.title='导入 SkateChassis 配置'
    dialog.filter='SkateChassis JSON (*.json)'
    if dialog.showOpen()!=adsk.core.DialogResults.DialogOK: return
    value=load_payload(dialog.filename)
    _payload=value
    _request_id=None
    report('opened','配置已导入。点击“生成新模型”开始建模。')

class HtmlHandler(adsk.core.HTMLEventHandler):
    def notify(self,args):
        global _busy,_design
        try:
            action=args.action
            args.returnData='OK'
            if action=='ready': update_panel();return
            if _busy: return
            if action=='import': import_file()
            elif action=='generate':
                if not _payload: raise ValueError('请先导入配置')
                _busy=True;report('building','正在创建参数化模型…')
                _design=build_model(validate_payload(_payload))
                report('generated','已生成 '+str(len(_payload['bodies']))+' 个组件，可继续修改参数或保存 F3D。')
            elif action=='save':
                if not _design or not _design.isValid: raise ValueError('请先生成模型；关闭的模型请从 Fusion 文件菜单保存')
                _busy=True
                destination=save_f3d(_design)
                if destination: report('saved','F3D 已保存：'+destination)
        except Exception as error:
            report('error',str(error))
            _app.log(traceback.format_exc())
        finally:
            _busy=False;update_panel()

class RequestHandler(adsk.core.CustomEventHandler):
    def notify(self,args):
        global _payload,_request_id
        try:
            item=json.loads(args.additionalInfo)
            _payload=validate_payload(item['payload']);_request_id=item['id']
            show_panel();report('opened','已接收网页配置。点击“生成新模型”，在新文档中建模。')
        except Exception as error:
            report('error',str(error));_app.log(traceback.format_exc())

class ExecuteHandler(adsk.core.CommandEventHandler):
    def notify(self,args): show_panel()

class CreatedHandler(adsk.core.CommandCreatedEventHandler):
    def notify(self,args):
        handler=ExecuteHandler();args.command.execute.add(handler);_handlers.append(handler)

def watch_requests(stop_event):
    while not stop_event.is_set():
        try:
            atomic(os.path.join(_bridge,'heartbeat.json'),{'running':True,'at':int(time.time()*1000)})
            file=os.path.join(_bridge,'request.json')
            if os.path.isfile(file) and os.path.getsize(file)<=1024*1024:
                with open(file,encoding='utf-8') as stream: item=json.load(stream)
                ident=item.get('id')
                if ident and ident not in _seen and time.time()*1000-item.get('createdAt',0)<300000:
                    validate_payload(item['payload'])
                    if not _busy:
                        _seen.add(ident)
                        _app.fireCustomEvent(EVENT,json.dumps(item,ensure_ascii=False))
        except (OSError,ValueError,KeyError): pass
        stop_event.wait(1)

def run(context):
    global _app,_bridge,_stop,_thread
    _app=adsk.core.Application.get()
    try:
        settings=os.path.join(FOLDER,'bridge.json')
        if os.path.isfile(settings):
            with open(settings,encoding='utf-8') as stream: _bridge=json.load(stream)['directory']
        else:
            _bridge=os.path.abspath(os.path.join(FOLDER,'..','..','底盘机器人','data','fusion'))
        os.makedirs(_bridge,exist_ok=True)
        event=_app.registerCustomEvent(EVENT)
        handler=RequestHandler();event.add(handler);_handlers.append(handler)
        ui=_app.userInterface
        definition=ui.commandDefinitions.itemById(COMMAND) or ui.commandDefinitions.addButtonDefinition(COMMAND,'SkateChassis','打开 SophiStudio 机器人参数建模插件')
        handler=CreatedHandler();definition.commandCreated.add(handler);_handlers.append(handler)
        panel=ui.allToolbarPanels.itemById('SolidScriptsAddinsPanel')
        if panel and not panel.controls.itemById(COMMAND): panel.controls.addCommand(definition)
        _stop=threading.Event();_thread=threading.Thread(target=watch_requests,args=(_stop,),daemon=True);_thread.start()
        # Toolbar opens manually; a web request also brings this panel into view.
        if not isinstance(context,dict) or not context.get('IsApplicationStartup',False): show_panel()
    except Exception:
        _app.userInterface.messageBox('SkateChassis 插件启动失败：\n'+traceback.format_exc())

def stop(context):
    if _stop: _stop.set()
    if _thread: _thread.join(timeout=2)
    if not _app: return
    if _bridge: atomic(os.path.join(_bridge,'heartbeat.json'),{'running':False,'at':int(time.time()*1000)})
    ui=_app.userInterface
    palette=ui.palettes.itemById(PALETTE)
    if palette: palette.deleteMe()
    panel=ui.allToolbarPanels.itemById('SolidScriptsAddinsPanel')
    if panel:
        control=panel.controls.itemById(COMMAND)
        if control: control.deleteMe()
    definition=ui.commandDefinitions.itemById(COMMAND)
    if definition: definition.deleteMe()
    _app.unregisterCustomEvent(EVENT)
    _handlers.clear();_seen.clear()
