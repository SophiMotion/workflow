"""Run from Fusion's Scripts and Add-Ins dialog with the native robot design active."""
import adsk.core,adsk.fusion
import json,os,importlib.util,traceback

FOLDER=os.path.dirname(os.path.realpath(__file__))
spec=importlib.util.spec_from_file_location('sophi_export_core',os.path.join(FOLDER,'export_core.py'))
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)

def read_json(path):
 with open(path,encoding='utf-8-sig') as f:return json.load(f)

def run(context):
 ui=None;temporary=None
 try:
  app=adsk.core.Application.get();ui=app.userInterface
  design=adsk.fusion.Design.cast(app.activeProduct)
  if not design:raise ValueError('Open the original parametric SophiRobot Fusion design first. A STEP import does not restore its parameter history.')
  if not hasattr(design,'modifyParameters'):raise ValueError('Update Fusion: this script requires the Design.modifyParameters API.')
  dialog=ui.createFileDialog();dialog.title='Select SophiRobot Fusion export request';dialog.filter='JSON files (*.json)'
  if dialog.showOpen()!=adsk.core.DialogResults.DialogOK:return
  request_path=dialog.filename
  if os.path.getsize(request_path)>100000:raise ValueError('Export request is too large.')
  request=read_json(request_path);schema=read_json(os.path.join(FOLDER,'schema.json'));mapping=read_json(os.path.join(FOLDER,'mapping.json'))
  plan=core.build_plan(request,schema,mapping,design.userParameters.itemByName,lambda p,e:design.unitsManager.isValidExpression(e,p.unit))
  if not any(c.bRepBodies.count for c in design.allComponents):raise ValueError('The active design has no BRep bodies to export.')
  # Preserve formulas, units and parameter dependencies using the atomic batch API.
  def apply(parameters,expressions):return design.modifyParameters(parameters,[adsk.core.ValueInput.createByString(e) for e in expressions])
  def compute():
   if not design.computeAll():return False
   for i in range(design.timeline.count):
    if design.timeline.item(i).healthState==adsk.fusion.FeatureHealthStates.ErrorFeatureHealthState:return False
   return True
  pose_text='Website angles will be applied through the mapped native angle parameters.' if request['fusionExport']['poseMode']=='website' else 'The CURRENT FUSION POSE will be kept. Website joint angles will NOT be applied.'
  preview='\n'.join(x['key']+' -> '+x['name']+' = '+x['expression'] for x in plan)
  message='Active design: '+app.activeDocument.name+'\n\n'+pose_text+'\n\n'+preview+'\n\nConfirm these parameters drive the intended robot geometry and use the same dimension definitions. All CAD components are exported, regardless of website cover visibility. Motor choices remain JSON metadata. Original parameter expressions will be restored afterward; the design is not saved automatically.\n\nContinue?'
  if ui.messageBox(message,'SophiRobot - Review Fusion mapping',adsk.core.MessageBoxButtonTypes.YesNoButtonType)!=adsk.core.DialogResults.DialogYes:return
  save=ui.createFileDialog();save.title='Save configured SophiRobot STEP';save.filter='STEP files (*.step)';save.initialFilename='SophiRobot-configured.step'
  if save.showSave()!=adsk.core.DialogResults.DialogOK:return
  output=save.filename
  if not output.lower().endswith(('.step','.stp')):output+='.step'
  metadata=output+'.json'
  if os.path.exists(output) or os.path.exists(metadata):raise ValueError('Choose a new filename so an existing STEP or metadata file is not overwritten.')
  pending_path=output+'.pending.step'
  if os.path.exists(pending_path):raise ValueError('A pending export already exists at that filename. Choose another filename.')
  temporary=pending_path
  def export():
   options=design.exportManager.createSTEPExportOptions(temporary,design.rootComponent)
   if not options or not design.exportManager.execute(options):raise RuntimeError('Fusion STEP translator reported failure.')
   if not os.path.isfile(temporary) or os.path.getsize(temporary)<100:raise RuntimeError('Fusion did not create a usable STEP file.')
   with open(temporary,'rb') as f:
    if b'ISO-10303-21' not in f.read(1024):raise RuntimeError('The generated file is not a STEP exchange file.')
  core.run_transaction(plan,apply,compute,export)
  report={'design':app.activeDocument.name,'request':request,'appliedParameters':[{k:v for k,v in x.items() if k!='parameter'} for x in plan],'mapping':mapping,'poseMode':request['fusionExport']['poseMode'],'motorPolicy':'metadata-only','geometryNote':'Native Fusion design; not a conversion of the website mesh.'}
  with open(metadata,'x',encoding='utf-8') as f:json.dump(report,f,indent=2,allow_nan=False)
  os.replace(temporary,output);temporary=None
  ui.messageBox('STEP exported:\n'+output+'\n\nConfiguration and motor metadata:\n'+metadata+'\n\nOriginal parameter expressions restored. Inspect the exported model in Fusion before downstream use.','SophiRobot export complete')
 except Exception as error:
  if ui:ui.messageBox(str(error),'SophiRobot export stopped')
  print(traceback.format_exc())
 finally:
  if temporary and os.path.isfile(temporary):
   try:os.remove(temporary)
   except OSError:pass
