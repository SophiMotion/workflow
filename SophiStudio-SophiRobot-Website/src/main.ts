import './styles.css';
import {studioBrand,workflowButton,bindWorkflowNavigation} from './studio-navigation';
import {defaults,fields,validate,parseConfig,type Params,type Tab,type Key} from './parameters';
import {type Model,type Bounds} from './geometry';
import {ArmControls} from './arm-controls';
import {neutralLimbs,fixedModes,parseLimbConfig} from './limbs';
import {Viewer,type View} from './viewer';
import {icon} from './icons';
import {MotorControls} from './motor-controls';
import {defaultMotors,parseMotors} from './motors';
import {HeadControls} from './head-controls';
import {neutralHead,parseHeadConfig} from './head';
import {createFusionRequest} from './fusion-export';
import {WalkControls} from './walk-controls';

const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
let params:Params={...defaults},model:Model,viewer:Viewer,activeTab:Tab='Limbs';
const visibility:Record<string,boolean>={cover:true,grid:true,edges:true,axes:false,dimensions:false};
let valid=true,changed=false,toastTimer:number;
const fmt=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:2});
const button=(id:string,label:string,ico:string,cls='')=>`<button id="${id}" class="${cls}" title="${label}">${icon(ico)}<span>${label}</span></button>`;

$('#app').innerHTML=`
 <header class="header">${studioBrand()}<div class="project-title">SophiRobot</div><div class="header-actions">${button('reset','Reset','reset')}${button('import','Load configuration','upload','icon-button')}${button('save','Save configuration','save','primary')}</div></header>
 <nav class="project-navigation" aria-label="Project pages"><a href="./" aria-current="page">Configurator</a><a id="open-bom" href="./bom.html" target="_blank" rel="noopener" aria-label="Bill of materials (opens in a new window)">Bill of materials <span aria-hidden="true">↗</span></a>${workflowButton()}</nav>
 <main class="workspace">
  <aside class="sidebar" aria-label="Assembly parameters"><div class="panel-heading"><h1>Parameters</h1><p>Dimensions in millimeters</p></div>
   <div class="tabs" role="tablist" aria-label="Parameter groups">${(['Base','Wheels','Body','Limbs','Head','Motors'] as Tab[]).map(t=>`<button role="tab" id="tab-${t}" aria-controls="fields" aria-selected="${t===activeTab}" data-tab="${t}">${t}</button>`).join('')}</div>
   <div class="panel-scroll"><div id="walk-controls"></div><div id="fields" role="tabpanel" aria-labelledby="tab-Base"></div>
    <div id="validation" role="alert" hidden></div>
    <div id="arm-controls"></div><div id="head-controls" hidden></div>
    <section class="visibility"><h2>Visibility</h2>${Object.entries({cover:'Top metal cover',grid:'Grid',edges:'Edges',axes:'Axes',dimensions:'Bounding dimensions'}).map(([id,label])=>`<label class="switch-row" for="show-${id}"><span>${label}</span><input id="show-${id}" type="checkbox" role="switch" ${visibility[id]?'checked':''}><span class="switch" aria-hidden="true"></span></label>`).join('')}</section>
    <details class="derived"><summary>Derived dimensions ${icon('chevron')}</summary><dl id="derived"></dl></details>
    <button id="download-step" class="source-button">${icon('save')}<span>Download STEP</span>${icon('chevron')}</button>
    <p class="step-note">Current model · faceted geometry</p><p id="step-progress" class="step-note" role="status" hidden></p><button id="cancel-step" hidden>Cancel export</button><a id="step-file" class="step-file" download="SophiRobot-preview.step" hidden>Save STEP file</a>
    <button id="fusion-export" class="source-button">${icon('save')}<span>Export via Fusion 360</span>${icon('chevron')}</button>
    <button id="source" class="source-button">${icon('info')}<span>Source & parameter notes</span>${icon('chevron')}</button>
   </div>
  </aside>
  <section class="viewport" aria-label="Assembly preview"><div id="canvas"></div>
   <div class="viewport-heading"><h2>Assembly</h2><p>STEP reference <span>·</span> Parametric preview</p><button id="arm-shortcut" class="arm-status">Limbs fixed · Open joints</button></div>
   <div class="camera-toolbar" aria-label="Camera views"><div class="segments">${(['ISO','Top','Front','Rear','Side'] as View[]).map(v=>`<button data-view="${v}" aria-pressed="${v==='ISO'}">${v}</button>`).join('')}</div><button id="fit" class="icon-button" title="Fit to model" aria-label="Fit to model">${icon('fit')}</button></div>
   <div class="tools" aria-label="Inspection tools"><button id="cover-quick" class="icon-button" title="Hide / show top metal cover" aria-label="Toggle top metal cover" aria-pressed="true">${icon('layers')}</button><button id="measure" class="icon-button" title="Measure between two surface points" aria-label="Measure" aria-pressed="false">${icon('ruler')}</button><button id="snapshot" class="icon-button" title="Download viewport image" aria-label="Download viewport image">${icon('camera')}</button></div>
   <div id="loading" class="loading"><div class="spinner"></div><h3>Loading assembly</h3><p>Preparing your CAD reference…</p></div>
   <div id="selection" class="selection" hidden></div><div id="measurement" class="measurement" aria-live="polite" hidden></div><div id="greeting-caption" class="greeting-caption" role="status" hidden>👋 Hi! I’m SophiRobot.</div>
   <div class="readouts" aria-label="Measured assembly dimensions"><div><strong id="read-length">900 <small>mm</small></strong><span>Length</span></div><div><strong id="read-width">850 <small>mm</small></strong><span>Width</span></div><div><strong id="read-height">1,640 <small>mm</small></strong><span>Height</span></div></div>
   <div class="orbit-hint">${icon('mouse')}<span>Drag to orbit <b>·</b> Right-drag to pan <b>·</b> Scroll to zoom</span></div>
  </section>
 </main>
 <footer class="statusbar"><div><span id="status-dot" class="status-dot"></span><span id="status">Loading model</span><span class="footer-separator">/</span><span id="count">Loading components</span></div><div><span class="source-filename">Assembly testing website 4.step</span><span class="footer-separator">/</span><span>mm <b>·</b> Z up</span></div></footer>
 <div id="toast" role="status" hidden></div><input id="file-input" type="file" accept=".json,application/json" hidden>
 <dialog id="source-dialog"><div class="dialog-heading"><div><h2>Source & parameter notes</h2><p>Mobile humanoid with AGV platform</p></div><button id="close-dialog" class="icon-button" aria-label="Close source notes">${icon('close')}</button></div><div class="dialog-body" id="source-content"></div></dialog>
 <dialog id="fusion-dialog" aria-labelledby="fusion-title"><div class="dialog-heading"><div><h2 id="fusion-title">Export via Fusion 360</h2><p>Create STEP from your native robot design</p></div><button id="close-fusion" class="icon-button" aria-label="Close Fusion export">${icon('close')}</button></div><div class="dialog-body fusion-body"><ol><li>Open the original parametric SophiRobot design in Fusion 360. A STEP import alone does not contain its parameter history.</li><li><a href="${import.meta.env.BASE_URL}fusion/SophiRobot-Fusion-Export.zip" download>Download the Fusion script ZIP</a>, extract it, and review <code>mapping.json</code> against your native parameter names.</li><li>Download the request below. In Fusion, open <strong>Scripts and Add-Ins</strong>, add the extracted <strong>SophiRobotExport</strong> folder, and run its script.</li><li>Select the request JSON, review the mapping, and choose a new STEP filename.</li></ol><label class="fusion-pose-label" for="fusion-pose">Joint pose for STEP</label><select id="fusion-pose"><option value="fusion">Keep the current Fusion pose</option><option value="website">Apply the website pose (requires angle mappings)</option></select><p class="tab-note">Dimensions are applied in both modes. The first option keeps Fusion's joint positions, even if the website pose differs. Website pose mode requires all 18 native angle parameter mappings, including the head.</p><p class="tab-note">Exports the complete CAD assembly. Website cover visibility is not applied. Motor choices are saved in accompanying JSON; they do not replace CAD parts. Missing mappings or a failed rebuild stop export.</p><button id="download-fusion" class="primary">Download Fusion export request</button><p id="fusion-result" role="status"></p><p><a href="${import.meta.env.BASE_URL}fusion/README.md" download>Download setup and mapping instructions</a></p></div></dialog>`;

bindWorkflowNavigation();

const motorControls=new MotorControls(()=>{$('#save').toggleAttribute('disabled',!valid||!armControls.valid||!motorControls.valid||!headControls.valid||!model);});
function renderFields(){
 const selected=fields.filter(f=>f.tab===activeTab);let section='';
 $('#fields').setAttribute('aria-labelledby',`tab-${activeTab}`);
 $('#arm-controls').hidden=activeTab!=='Limbs';
 $('#head-controls').hidden=activeTab!=='Head';
 if(activeTab==='Head'){$('#fields').innerHTML='';return;}
 if(activeTab==='Motors'){motorControls.render($('#fields'));return;}
 $('#fields').innerHTML=selected.map(f=>{const heading=section!==f.section?`${section?'</section>':''}<section class="field-section"><h2>${f.section}</h2>`:'';section=f.section;
 return `${heading}<div class="field-row"><label for="${f.key}" title="${f.help}">${f.label}</label><div class="number-input"><input id="${f.key}" name="${f.key}" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${params[f.key]}" ${f.key==='structural_sheet'?'disabled':''} aria-describedby="help-${f.key}" inputmode="decimal"><span>${f.unit}</span></div><span class="field-help" id="help-${f.key}">${f.help}</span></div>`;}).join('')+'</section>'+ (activeTab==='Wheels'?'<p class="tab-note">Track is measured between wheel centers. The source track is 600 mm; tire width stays 50 mm.</p>':activeTab==='Body'?'<p class="tab-note">Hip position is above the base deck. Total height includes the head in the neutral pose.</p>':activeTab==='Limbs'?'<p class="tab-note">Shared tube settings: outside diameter and radial wall thickness. Tube settings apply to both arms and both legs. Select each limb below to move it independently.</p>':'');
 $('#fields').querySelectorAll<HTMLInputElement>('input[name]').forEach(input=>input.addEventListener('input',applyInputs));
 if(activeTab==='Base'){const host=document.createElement('div');host.id='base-motors';$('#fields').append(host);motorControls.render(host,true);}
}
function applyInputs(){
 const candidate={...params};$('#fields').querySelectorAll<HTMLInputElement>('input[name]').forEach(i=>candidate[i.name as Key]=i.value===''?NaN:Number(i.value));
 const errors=validate(candidate);valid=errors.length===0;
 $('#validation').hidden=valid;$('#validation').textContent=errors.join(' ');
 $('#fields').querySelectorAll<HTMLInputElement>('input[name]').forEach(i=>i.setAttribute('aria-invalid',String(!Number.isFinite(candidate[i.name as Key])||candidate[i.name as Key]<Number(i.min)||candidate[i.name as Key]>Number(i.max))));
 $('#save').toggleAttribute('disabled',!valid||!armControls.valid||!motorControls.valid||!headControls.valid||!model);
 if(!valid){$('#status').textContent='Last valid model retained';$('#status-dot').classList.add('warning');return;}
 params=candidate;update();
}
function update(){
 if(!viewer||!model)return;const bounds=viewer.update(params);
 updateReadouts(bounds);
 changed=fields.some(f=>params[f.key]!==defaults[f.key]);$('#status').textContent=changed?'Configuration updated':'Model ready';$('#status-dot').classList.remove('warning');$('#count').textContent=`${viewer.visibleCount} / ${model.meshes.length} components`;
 $('#derived').innerHTML=Object.entries({'Tube inner diameter':params.tube_diameter-2*params.tube_thickness,'Rim diameter':params.od_tire-params.tire_thickness,'Radial tire wall':params.tire_thickness/2,'Drive axle height':params.od_tire/2,'Base deck height':50+params.base_height,'Hip above ground':50+params.base_height+params.hip_position,'Ground clearance':50,'Frame profile':40}).map(([k,v])=>`<div><dt>${k}</dt><dd>${fmt(v)} mm</dd></div>`).join('');
 $('#selection').hidden=true;
}
function updateReadouts(bounds:Bounds){
 for(const [id,v] of [['length',bounds.size[1]],['width',bounds.size[0]],['height',bounds.size[2]]] as const)$(`#read-${id}`).innerHTML=`${fmt(v)} <small>mm</small>`;
}
const armControls=new ArmControls($('#arm-controls'),(pose,movable,armValid)=>{
 $('#arm-shortcut').textContent=Object.values(movable).some(Boolean)?'Limbs movable · Open joints':'Limbs fixed · Open joints';
 $('#save').toggleAttribute('disabled',!valid||!armValid||!motorControls.valid||!headControls.valid||!model);
 if(model&&viewer&&armValid){updateReadouts(viewer.setPose(pose));$('#selection').hidden=true;}
});
const headControls=new HeadControls($('#head-controls'),(pose,headValid)=>{
 $('#save').toggleAttribute('disabled',!valid||!armControls.valid||!motorControls.valid||!headValid||!model);
 if(model&&viewer&&headValid){updateReadouts(viewer.setHeadPose(pose));$('#selection').hidden=true;}
});
const walkControls=new WalkControls($('#walk-controls'),()=>{
 if(!model||!valid||!armControls.valid||!headControls.valid||!motorControls.valid){toast('Load the model and correct invalid values before playing.');return null;}
 viewer.measure(false);$('#measure').setAttribute('aria-pressed','false');$('#measurement').hidden=true;$('#selection').hidden=true;
 return armControls.pose;
},(pose,preview)=>{
 const bounds=viewer.setPose(pose,!preview);
 if(!preview)updateReadouts(bounds);
},visible=>{$('#greeting-caption').hidden=!visible;});
// Restore the configured pose before edits, snapshots, measurements or exports.
for(const event of ['click','input','change'])$('#app').addEventListener(event,e=>{
 const target=e.target as HTMLElement;
 if(!target.closest('#walk-controls')&&target.closest('.sidebar,.header-actions,#snapshot,#measure,#open-bom'))walkControls.stop();
},true);
function toast(message:string){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=window.setTimeout(()=>$('#toast').hidden=true,3800);}
function download(url:string,name:string){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
function sourceContent(){
 $('#source-content').innerHTML=`<section><h3>Original assembly</h3><dl class="source-data"><div><dt>File</dt><dd>${model.metadata.source}</dd></div><div><dt>Source bodies</dt><dd>${model.meshes.length}</dd></div><div><dt>Axes</dt><dd>X width · Y length · Z height</dd></div><div><dt>Neutral envelope</dt><dd>${[model.metadata.bounds.size[1],model.metadata.bounds.size[0],model.metadata.bounds.size[2]].map(fmt).join(' × ')} mm</dd></div></dl><p class="hash-label">SHA-256</p><code>${model.metadata.sha256}</code></section>
 <section><h3>Tube frame and arm joints</h3><p>The supplied assembly contains two arms and two legs with eight hollow tubes. L identifies +X and R identifies −X, with the robot facing +Y. Each limb has its own pose and Fixed/Movable mode. Tube outside diameter starts at 50 mm, radial wall thickness at 2 mm, upper tube length at 200 mm, and lower tube length at 300 mm. The inner diameter is outside diameter − 2 × wall thickness.</p><p>Increasing upper-arm length moves the elbow actuators and lower arm together. Lower-arm length changes from its upper attachment end. Thigh and lower-leg lengths start at 250 mm and apply to both legs. The thigh top stays fixed; changing thigh length moves the knee and lower leg. Lower-leg length extends from the knee attachment. Shoulder width and total height move the complete arm with the shoulder. Actuator bodies remain rigid.</p><p>Movable mode unlocks six arm joints or two leg joints for the selected limb. Fixed mode locks the current pose. Reset selected limb returns only its angles to zero. Joint axes are inferred from shaft geometry, not imported Fusion joints. Preview angle ranges are not verified mechanical limits; poses are not collision-checked.</p><p>Model 4 includes motor covers, bearings, joint brackets, a head assembly and grippers. These follow their owning components. Each gripper has independent wrist rotation (−90° to +90°) and clamping (0° to 45°) preview controls. Limits are provisional, not verified servo specifications. Clamping rotates one driven jaw toward the fixed jaw; overlap is possible near the maximum. The Head tab controls rotation (−90° to +90°) and look-up/down tilt (−30° to +30°), independently of the limbs. Positive tilt looks up; zero restores the source pose. The right arm mounting is about 30 mm lower than the left below the shoulder; the source asymmetry is preserved. Tube-size changes may require new adapters.</p></section>
 <section><h3>Reference dimensions</h3><p>The new assembly measures 1,875.75 mm to the top of the head. The shoulder beam top is at 1,744 mm, its underside at 1,704 mm. The main spine section is now 80 × 80 mm. Total height controls the neutral assembly; moving the arm may change the measured envelope shown below the viewport. Wheel centers remain 600 mm apart.</p><p>The hip span is 400 mm. Hip position is measured from the base deck to the lower hip face: 800 + 250 = 1,050 mm above ground. “Middle length” is the vertical straight section between the folded end ramps. Thin sheet starts at 2 mm. The former structural sheet mounts are absent, so their 5 mm field is read-only. The source has one hip motor axis per side, so the former hip-swing control is unavailable; hip lift and knee bend remain independent.</p></section>
 <section><h3>How the controls work</h3><p>Each update starts with an immutable copy of the original mesh. Wheels, hubs and motors translate together; tires and rims adapt around the fixed hub. Shoulder and hip beams extend along their extrusion axes. Both cover bodies follow the base envelope and hide together.</p><p>The screenshot defines tire thickness as a diameter difference: rim diameter = tire OD − tire thickness. Actual radial rubber thickness is half this value. Wheel width remains 50 mm and the frame profile remains 40 mm.</p></section>
 <section><h3>Preview limits</h3><p>This STEP contains static solids, without the original Fusion parameter equations or assembly joints. Adjustments here are mesh-based design previews. Base folds, bend radii and holes use interpolated deformation; changing thickness does not reconstruct exact sheet-metal offsets. Purchased components retain their shape, except the explicitly adjustable tire and rim.</p><p>The source does not provide separate drive-to-frame mounting brackets. Wheel spacing and diameter changes therefore need a mounting design review. Validation checks known envelope clearances, not full collision, strength or manufacturability.</p><p>Download STEP directly exports the current displayed model as faceted surface geometry, including dimensions, pose and top-cover visibility. It does not contain smooth analytic solids or a feature timeline. Export via Fusion 360 downloads a configuration request for the companion Fusion script. STEP is generated from the original native design after parameter mapping and rebuild checks. It requires the original Fusion design; it does not convert this mesh preview into a parametric solid. Save configuration downloads JSON; the camera button exports a preview image.</p></section>
 <section><h3>Assembly contents</h3><ul class="part-list">${model.meshes.map(m=>`<li><span>${m.name}</span><small>#${String(m.id+1).padStart(2,'0')}</small></li>`).join('')}</ul></section>`;
}

document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 if(!valid||!armControls.valid||!motorControls.valid||!headControls.valid){toast('Correct the highlighted parameter values before changing tabs.');return;}
 activeTab=b.dataset.tab as Tab;document.querySelectorAll('[data-tab]').forEach(t=>t.setAttribute('aria-selected',String(t===b)));renderFields();$('.panel-scroll').scrollTop=0;
}));
$('.tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tab]'));let i=tabs.indexOf(document.activeElement as HTMLButtonElement);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[i].click();tabs[i].focus();});
$('#arm-shortcut').addEventListener('click',()=>{$('#tab-Limbs').click();if(activeTab==='Limbs')$('#arm-controls').scrollIntoView({block:'nearest'});});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(!model)return;viewer.setView(b.dataset.view as View);document.querySelectorAll('[data-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)))}));
function setVisibility(key:string,value:boolean){visibility[key]=value;$<HTMLInputElement>(`#show-${key}`).checked=value;viewer?.toggle(key,value);if(key==='cover')$('#cover-quick').setAttribute('aria-pressed',String(value));if(model)$('#count').textContent=`${viewer.visibleCount} / ${model.meshes.length} components`;}
for(const key of Object.keys(visibility))$<HTMLInputElement>(`#show-${key}`).addEventListener('change',e=>setVisibility(key,(e.target as HTMLInputElement).checked));
$('#cover-quick').addEventListener('click',()=>setVisibility('cover',!visibility.cover));
$('#fit').addEventListener('click',()=>viewer?.fit());
$('#reset').addEventListener('click',()=>{params={...defaults};valid=true;motorControls.load(defaultMotors());headControls.load(neutralHead(),false);armControls.load(neutralLimbs(),fixedModes());$('#validation').hidden=true;$('#save').toggleAttribute('disabled',!model);renderFields();update();viewer?.fit();toast('Dimensions, poses and motor choices reset.');});
$('#save').addEventListener('click',()=>{if(!model||!valid||!armControls.valid||!motorControls.valid||!headControls.valid)return;const data={version:1,source:model.metadata.source,sourceSha256:model.metadata.sha256,parameters:params,limbs:{pose:armControls.pose,movable:armControls.movable},head:{pose:headControls.pose,movable:headControls.movable},motors:motorControls.state};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));download(url,'SophiRobot-configuration.json');setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Configuration, limb poses and motor selections saved as JSON.');});
$('#import').addEventListener('click',()=>$<HTMLInputElement>('#file-input').click());
$('#file-input').addEventListener('change',async()=>{const input=$<HTMLInputElement>('#file-input');const file=input.files?.[0];if(!file||!model)return;try{if(file.size>100000)throw new Error('Configuration file is too large. Use a saved parameter JSON file.');const data=JSON.parse(await file.text()),nextParams=parseConfig(data,model.metadata.sha256),arm=parseLimbConfig(data.limbs),motors=parseMotors(data.motors),head=parseHeadConfig(data.head);motorControls.load(motors);headControls.load(head.pose,head.movable);params=nextParams;valid=true;armControls.load(arm.pose,arm.movable);$('#validation').hidden=true;$('#save').removeAttribute('disabled');renderFields();update();viewer.fit();toast('Configuration, limb poses and motor selections loaded.');}catch(e){toast(e instanceof Error?e.message:'Unable to load configuration.');}input.value='';});
$('#measure').addEventListener('click',()=>{if(!model)return;const state=$('#measure').getAttribute('aria-pressed')!=='true';$('#measure').setAttribute('aria-pressed',String(state));$('#measurement').hidden=!state;viewer.measure(state);});
$('#snapshot').addEventListener('click',()=>{if(model){download(viewer.screenshot(),'SophiRobot-preview.png');toast('Viewport image saved.');}});
let stepWorker:Worker|undefined,stepUrl:string|undefined;
const finishStep=()=>{stepWorker?.terminate();stepWorker=undefined;$('#download-step').removeAttribute('disabled');$('#cancel-step').hidden=true;};
$('#download-step').addEventListener('click',()=>{
 if(!model||!valid||!armControls.valid||!motorControls.valid||!headControls.valid){toast('Load the model and correct invalid values before exporting.');return;}
 if(stepWorker)return;
 if(stepUrl){URL.revokeObjectURL(stepUrl);stepUrl=undefined;}$('#step-file').hidden=true;
 $('#download-step').setAttribute('disabled','');$('#cancel-step').hidden=false;$('#step-progress').hidden=false;$('#step-progress').textContent='Preparing STEP from the current model…';
 try{
  stepWorker=new Worker(new URL('./step-worker.ts',import.meta.url),{type:'module'});
  stepWorker.onmessage=event=>{
   const data=event.data;
   if(data.type==='progress')$('#step-progress').textContent=`Creating STEP: ${Math.round(data.done/data.total*100)}% (${data.done}/${data.total} parts)`;
   else if(data.type==='complete'){
    stepUrl=URL.createObjectURL(data.blob);const link=$<HTMLAnchorElement>('#step-file');link.href=stepUrl;link.hidden=false;
    $('#step-progress').textContent=`STEP ready · ${data.bodyCount} parts · ${(data.blob.size/1048576).toFixed(1)} MB. Faceted surfaces; large CAD imports may take time.`;
    finishStep();link.click();
   }else{finishStep();$('#step-progress').textContent=data.message||'STEP export failed.';}
  };
  stepWorker.onerror=()=>{finishStep();$('#step-progress').textContent='STEP export failed. Reload and try again, or use the Fusion export.';};
  const config={version:1,sourceSha256:model.metadata.sha256,parameters:params,limbs:{pose:armControls.pose,movable:armControls.movable},head:{pose:headControls.pose,movable:headControls.movable}};
  stepWorker.postMessage({modelUrl:new URL(`${import.meta.env.BASE_URL}model.json`,location.href).href,config,cover:visibility.cover});
 }catch(error){finishStep();$('#step-progress').textContent=error instanceof Error?error.message:'Unable to start STEP export.';}
});
$('#cancel-step').addEventListener('click',()=>{finishStep();$('#step-progress').textContent='Export cancelled.';});
$('#fusion-export').addEventListener('click',()=>{
 if(!model||!valid||!armControls.valid||!motorControls.valid||!headControls.valid){toast('Load the model and correct invalid values before exporting.');return;}
 $('#fusion-result').textContent='';$<HTMLDialogElement>('#fusion-dialog').showModal();
});
$('#close-fusion').addEventListener('click',()=>$<HTMLDialogElement>('#fusion-dialog').close());
$('#fusion-dialog').addEventListener('click',e=>{if(e.target===$('#fusion-dialog'))$<HTMLDialogElement>('#fusion-dialog').close();});
$('#download-fusion').addEventListener('click',()=>{
 try{
  if(!model||!valid||!armControls.valid||!motorControls.valid||!headControls.valid)throw new Error('Correct invalid values before exporting.');
  const config={version:1,source:model.metadata.source,sourceSha256:model.metadata.sha256,parameters:params,limbs:{pose:armControls.pose,movable:armControls.movable},head:{pose:headControls.pose,movable:headControls.movable},motors:motorControls.state};
  const request=createFusionRequest(config,model.metadata.sha256,$<HTMLSelectElement>('#fusion-pose').value as 'fusion'|'website');
  const url=URL.createObjectURL(new Blob([JSON.stringify(request,null,2)],{type:'application/json'}));download(url,'SophiRobot-fusion-request.json');setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('#fusion-result').textContent='Request downloaded. Run the companion script in Fusion to create the STEP file.';
 }catch(error){$('#fusion-result').textContent=error instanceof Error?error.message:'Unable to prepare the export request.';}
});
$('#open-bom').addEventListener('click',event=>{
 if(!valid||!motorControls.valid){event.preventDefault();toast('Correct the dimensions and motor specifications before opening the BOM.');return;}
 const link=$<HTMLAnchorElement>('#open-bom'),url=new URL('./bom.html',location.href),token=crypto.randomUUID();
 try{localStorage.setItem('sophi-bom-source:'+token,JSON.stringify({version:1,sourceSha256:model?.metadata.sha256||'example',parameters:params,motors:motorControls.state}));url.hash=token;}catch{}
 link.href=url.href;
 const popup=window.open(url.href,'_blank','popup=yes,width=1440,height=960');
 if(popup){popup.opener=null;event.preventDefault();}
});
$('#source').addEventListener('click',()=>{if(model)$<HTMLDialogElement>('#source-dialog').showModal();});
$('#close-dialog').addEventListener('click',()=>$<HTMLDialogElement>('#source-dialog').close());
$('#source-dialog').addEventListener('click',e=>{if(e.target===$('#source-dialog'))$<HTMLDialogElement>('#source-dialog').close();});
renderFields();
$('#save').setAttribute('disabled','');
async function boot(){
 try{
  viewer=new Viewer($('#canvas'));viewer.onSelect=(name,size)=>{const el=$('#selection');el.hidden=!name;el.replaceChildren();if(name){const strong=document.createElement('strong');strong.textContent=name;const small=document.createElement('span');small.textContent=`${size.map(fmt).join(' × ')} mm · X / Y / Z`;el.append(strong,small);}};
  viewer.onMeasure=text=>{$('#measurement').textContent=text;};
  const response=await fetch(`${import.meta.env.BASE_URL}model.json`);if(!response.ok)throw new Error(`Model asset unavailable (HTTP ${response.status}).`);model=await response.json();viewer.load(model,params);for(const key of Object.keys(visibility))viewer.toggle(key,visibility[key]);update();sourceContent();$('#loading').hidden=true;$('#save').toggleAttribute('disabled',!valid||!armControls.valid||!motorControls.valid||!headControls.valid);
 }catch(error){$('#loading').replaceChildren();const title=document.createElement('h3');title.textContent='Unable to load the 3D assembly';const detail=document.createElement('p');detail.textContent=error instanceof Error?error.message:'Unknown loading error.';const help=document.createElement('p');help.textContent='Use Launch Website.cmd and a browser with WebGL enabled, then reload.';$('#loading').append(title,detail,help);$('#status').textContent='Model unavailable';$('#status-dot').classList.add('warning');}
}
boot();
