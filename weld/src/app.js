import {stationFrames,frameDefaults,validateFrames} from './control-frames.js';
import {isLine,LINE_STATIONS,stationFor,selectedStation,visibleTasks} from './line-data.js';
import {lineSelector,lineGuide} from './line-ui.js';
import {lineSummary} from './engineering.js';
import {ABB_SOURCE} from './abb-kinematics.js';
import {lineMotionAt,lineCheck} from './line-motion.js';
import {engineeringReport} from './report.js';
import {ENGINEERING_LIMITS,cycleSummary,isSpot,isLaser,isArc,energyValue,outcomeNames} from './engineering.js';
import {workflowSteps,workflowMarkup,guideMarkup,cycleCards,timelineMarkup,engineeringFields,sharedEngineeringFields,outcomeMarkup,checksMarkup} from './workflow-ui.js';
import {motionAt,envelopeReport} from './motion.js';
import {shell,icon,button} from './ui.js';
import {defaultProject,bracketProject,validateProject,heatInput,schedule,simulate,parseResultsCSV,csvFromSamples,escapeHTML as esc,limits} from './model.js';
import {WeldScene} from './scene.js';
import {beadProfile,assessRisks,thermalConstants,thermalCycle,processNames,weaveNames} from './process.js';
import {morphologyMarkup,curveSVG,resultMarkup,risksMarkup,currentSample} from './analysis-ui.js';
import {ControllerSimulator,stepBoundary} from './controller-sim.js';
import {studioMarkup,updateStudioLive,bindStudio} from './studio-ui.js';
import {bindDockResize} from './controller-dock.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let project={...defaultProject(),bodyModel:'zeekr-001'},selected='W01',activeTab='station',bottom='timeline',result=null,metric='temperature',time=0,playing=false,lastFrame=0,speed=2,dirty=false,toastTimer,scene,importKind='project';
let lineLoop=true,lap=0,sceneDrafts={},lastActivePoint=null;
let cachedPlan,checkReport=null,checking=false,revision=0;
const controller=new ControllerSimulator();
let studioOpen=false,studioCollapsed=false;let studioTab='jog',studioStation='OP10',studioRefresh=0,playUntil=null,savedPlaybackSpeed=null,contactView=false,lastControllerFault=0;
const logs=[{time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),message:'本地工作站已加载。外部求解器未连接。'}];
try{const saved=localStorage.getItem('sophi-weld-project-v2');if(saved)project=validateProject(JSON.parse(saved));}catch{logs.push({time:'--:--:--',message:'本地项目不可用，已加载默认工作站。'});}
try{if(isLine(project)&&!localStorage.getItem('sophi-zeekr-model-v1')){project.bodyModel='zeekr-001';project.params.thickness=Math.min(3,project.params.thickness);project.engineering.gunType='c';localStorage.setItem('sophi-zeekr-model-v1','1');localStorage.setItem('sophi-weld-project-v2',JSON.stringify(project));}}catch{}
selected=visibleTasks(project)[0].id;
document.getElementById('app').innerHTML=shell();
const sceneControls=$('#sceneControls');
const dockResize=bindDockResize($('.workspace'),$('#controllerSplitter'));
const compactMotion=matchMedia('(max-width:640px)');const collapseMotion=()=>{if(compactMotion.matches)$('#jointMonitor').open=false;};collapseMotion();compactMotion.addEventListener('change',collapseMotion);
$('#engineeringWorkflow').innerHTML=workflowMarkup();
$('#engineeringProcessFields').innerHTML=engineeringFields();
$('#engineeringSharedFields').innerHTML=sharedEngineeringFields();
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function log(message){logs.push({time:new Date().toLocaleTimeString('zh-CN',{hour12:false}),message});if(logs.length>80)logs.shift();$('#logCount').textContent=logs.length;if(bottom==='logs')renderBottom();}
function plan(){return cachedPlan??=schedule(project);}
function duration(){return result?.source==='imported'?Math.max(cycleSummary(project).duration,result.samples.at(-1).time):cycleSummary(project).duration;}
function fmt(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function strategyName(){return {balanced:'对称交替',sequential:'顺序连续',reverse:'反向焊接'}[project.strategy];}
function persist(silent=true){try{localStorage.setItem('sophi-weld-project-v2',JSON.stringify(project));dirty=false;$('#saveState').textContent='· 已保存';if(!silent)toast('项目已保存到本机浏览器');}catch{$('#saveState').textContent='· 尚未保存';if(!silent)toast('浏览器无法保存，请导出项目 JSON');}}
function invalidate(){if(contactView)setSceneView('iso',project.activeStation);pausePlayback();revision++;lap=0;lastActivePoint=null;checkReport=null;cachedPlan=schedule(project);result=null;time=0;dirty=true;$('#saveState').textContent='· 有修改';$('#statusText').textContent='参数已更新';scene?.setProject(project,plan());updatePlayback();renderChart();renderBottom();renderMorphology();refreshEngineering();persist();}
function selectSeam(id){if(!project.seams.find(s=>s.id===id))return;if(isLine(project)&&stationFor(id).id!==project.activeStation)selectStation(stationFor(id).id,false);selected=id;scene?.setSelected(id);$('#selectedLabel').textContent=id;$('#selectedLength').textContent=isSpot(project)?'单个焊点':project.seams.find(s=>s.id===id).length+' mm';renderSeams();renderBottom();}
function renderSeams(){const query=$('#treeSearch').value.trim().toLowerCase();$('#seamList').innerHTML=visibleTasks(project).filter(s=>`${s.id} ${s.name}`.toLowerCase().includes(query)).map(s=>`<div class="seam-row ${s.id===selected?'selected':''}" data-seam="${s.id}" role="button" tabindex="0" aria-label="选择焊缝 ${s.id}">${icon('Pencil')}<b>${s.id}</b><span>${esc(isLine(project)?s.name:isSpot(project)?({W01:'前排 · 左焊点',W02:'前排 · 右焊点',W03:'后排 · 左焊点',W04:'后排 · 右焊点'}[s.id]):s.name.replace(' · ',''))}</span><input class="seam-toggle" type="checkbox" data-seam-enable="${s.id}" aria-label="启用 ${s.id}" ${s.enabled?'checked':''}></div>`).join('')||'<p class="chart-empty" style="padding:15px">没有匹配的焊缝</p>';$('#inspectorTabs').innerHTML=visibleTasks(project).map(s=>`<button class="${s.id===selected?'active':''}" data-seam="${s.id}">${s.id}</button>`).join('');}
function refresh(){ refreshEngineering(); for(const key of ['process','weave','gas'])$('#'+key).value=project[key];renderMorphology();$('#projectName').textContent=project.name;$('#quickScene').title=project.name;$$('[data-param]').forEach(el=>el.value=project.params[el.dataset.param]);$('#material').value=project.material;$('#strategy').value=project.strategy;updateEnergy();$('.left-bottom>div>span').textContent=`${project.material} · ${project.params.thickness} mm · ${project.seams.filter(s=>s.enabled).length} 道焊缝`;$('#duration').textContent=fmt(duration());$('#sequenceSummary').textContent=`${project.seams.filter(s=>s.enabled).length} 道焊缝 · ${strategyName()}`;renderSeams();renderBottom();renderChart();scene?.setSelected(selected);refreshEngineering();}
function renderMorphology(){if($('#morphologyPreview'))$('#morphologyPreview').innerHTML=morphologyMarkup(project);}
function updateEnergy(){const energy=energyValue(project);$('#energyLabel').textContent=energy.label;$('#heatInput').innerHTML=`${energy.value.toFixed(isSpot(project)?1:3)} <small>${energy.unit}</small>`;$('#heatInput').title=energy.note;}
function refreshEngineering(){
 const spot=isSpot(project),arc=isArc(project),laser=isLaser(project),line=isLine(project);
 if($('#bodyModel')){$('#quickBody').value=project.bodyModel||'sheet-metal';$('#quickBody').hidden=!line;$('#bodyModel').value=project.bodyModel||'sheet-metal';$('#bodyModel').closest('.process-selector')?.classList.toggle('hidden',!line);}$('#contactInspector')?.classList.toggle('hidden',!line||!contactView);
 $('#robotModel').value=project.robotModel||'abb-irb6700';$('.robot-selector').classList.toggle('hidden',!line);$('#jointMonitor').classList.toggle('hidden',!line||project.robotModel==='illustrative');
 document.body.classList.toggle('biw-mode',line);sceneControls.hidden=!line;$('#sceneControlsStation').textContent=project.activeStation||'OP10';$('#quickScene').value=line?'biw-line':'bracket';$('#lineBar').classList.toggle('hidden',!line);if(line){$('#lineBar').innerHTML=lineSelector(project);const loop=$('[data-action="line-loop"]');loop.classList.toggle('active',lineLoop);loop.setAttribute('aria-pressed',lineLoop);}
 $('#lineHud').classList.toggle('hidden',!line);$('#phaseMeter').classList.toggle('hidden',!line);$('.canvas-breadcrumb>span').textContent=line?'BIW LINE':'Cell_01';$('#viewportTitle').textContent=line?'ABB 三工位点焊流水线':'焊接工作站';
 $('.tree-root>b').textContent=line?'BIW 三工位流水线':'机器人焊接工作站';$('.tree-cell>span').textContent=line?'OP10 → OP20 → OP30':'工作站 Cell_01';$('.tree-item[data-search^="六轴焊接机器人"]>div>span').textContent=line?'ABB IRB 6700 × 3':'六轴焊接机器人';$('.tree-item[data-search^="六轴焊接机器人"]>div>small').textContent=line?(project.robotModel==='illustrative'?'原版 · 示意机构':'235 / 2.65 · 六轴 FK / IK'):'参考 ABB 布局 · 简化机构';$('.tree-item[data-search^="工装夹具"]>div>small').textContent=line?'3 套夹具 · 同步移载':'Fixture_01';
 $('.line-cycle-fields').classList.toggle('hidden',!line);for(const key of ['loadTime','unloadTime','transfer'])$(`[data-engineering="${key}"]`).closest('label').classList.toggle('hidden',line);$('[data-param="coolDuration"]').closest('label').classList.toggle('hidden',line);$('[data-engineering="gunStroke"]').closest('label').querySelector('span').textContent=line?'开口行程':'开口行程（记录）';
 $('.playback .time').title=line?'播放一个稳态生产周期；可开启循环':'包含焊后观察，区别于生产节拍';$('[data-action="cool-stage"]').title=line?'查看本轮全部焊点完成':'查看焊后冷却';
 $('#cycleSummary').innerHTML=cycleCards(project);const cycle=cycleSummary(project);$('#cycleFoldSummary').textContent=`${line?'流水线':'工位'} ${cycle.station.toFixed(1)} s/台 · 目标 ${cycle.target.toFixed(1)} s/台`;$('#outcomePicker').innerHTML=outcomeMarkup(project);
 $('#processContext').textContent=line?(project.bodyModel==='zeekr-001'?'极氪 001 外形参考 · 非原厂 CAD / 焊点 · 无轮胎玻璃 · 三站示例':'白车身骨架 · 三站 / 12 个示例点 · 全线共用工艺参数'):spot?'搭接薄板 · 4 个焊点 · 定点加压通电':laser?'框架支架 · 4 条焊缝 · 激光焦点扫描':'框架支架 · 4 条焊缝 · 连续走枪';
 $('#spotFields').classList.toggle('hidden',!spot);$('#laserFields').classList.toggle('hidden',!laser);
 $$('[data-arc-only]').forEach(el=>el.classList.toggle('hidden',!arc));
 $('#jointType').textContent=spot?'搭接点焊':'角接焊缝';
 const precise=line&&project.bodyModel!=='legacy';$('#gunType').disabled=precise;$('#gunType').title=precise?'精细模型使用 C 型伺服焊枪；X 型请切换原版场景':'';$('#param-thickness').max=precise?'3':'30';$('#param-thickness').step=precise?'0.1':'0.5';$('#gunType').value=project.engineering.gunType;$('#gunType').closest('label').classList.toggle('hidden',!spot);
 for(const key of ['gunStroke'])$(`[data-engineering="${key}"]`).closest('label').classList.toggle('hidden',!spot);
 for(const key of ['weave','gas'])$('#'+key).closest('label').classList.toggle('hidden',key==='weave'?!arc:spot);
 for(const key of ['torchDistance','gasFlow','preflow','postflow'])$(`[data-param="${key}"]`).closest('label').classList.toggle('hidden',spot);
 $('[data-param="cooling"]').closest('label').classList.toggle('hidden',!arc);
 $$('[data-engineering]').forEach(el=>{if(document.activeElement!==el)el.value=project.engineering[el.dataset.engineering];});
 const mass=project.engineering.toolMass+project.engineering.adapterMass,exceeds=mass>project.engineering.payloadLimit;
 $('#payloadNote').textContent=`静态质量 ${mass} / ${project.engineering.payloadLimit} kg · ${exceeds?'超过额定质量，需重新选型':'质量未超额；动态负载仍待校核'}`;
 $('#payloadNote').classList.toggle('warning-text',exceeds);updateEnergy();
 $('.seam-heading h2').innerHTML=`${line?project.activeStation+' 焊点':spot?'焊点':'焊缝'}列表 <span>${visibleTasks(project).length}</span>`;
 $('.tree-item[data-search^="焊接支架"]>div>span').textContent=line?'白车身 × 3':spot?'搭接薄板':'焊接支架';
 $('.tree-item[data-search^="保护气体"]>div>small').textContent=spot?'点焊未使用':project.gas==='argon'?'纯氩 Ar':project.gas==='co2'?'CO₂':'Ar + CO₂';
 $('.left-bottom b').textContent=line?(project.bodyModel==='legacy'?'原版骨架 · 教学模型':project.bodyModel==='zeekr-001'?'极氪 001 · 外形参考':'钣金白车身 · 教学模型'):spot?'搭接薄板教学件':'框架支架';
 $('.left-bottom>div>span').textContent=`${project.material} · ${project.params.thickness} mm · ${project.seams.filter(s=>s.enabled).length} ${spot?'个焊点':'道焊缝'}`;
 $('#sequenceSummary').textContent=`${line?'三站 · ':''}${project.seams.filter(s=>s.enabled).length} 个任务 · ${strategyName()}`;
 $('#duration').textContent=fmt(duration());
}
function focusSettings(id){close();if(studioOpen)closeStudio();if(innerWidth<=640)document.body.classList.add('right-open');document.body.classList.remove('right-collapsed');const el=$('#'+id);if(el.tagName==='DETAILS')el.open=true;for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;el.scrollIntoView({block:'start',behavior:'smooth'});}
function selectStation(id,focus=true){
 if(!isLine(project)||!LINE_STATIONS.some(s=>s.id===id))return;
 project.activeStation=id;cachedPlan=schedule(project);selected=visibleTasks(project)[0].id;lastActivePoint=null;
 scene?.setSelected(selected);if(focus||contactView)setSceneView('iso',id);
 refresh();scene?.update(time,plan(),project);updatePlayback();persist();
 studioStation=id;controller.dispatch('select-station',{value:id});if(studioOpen)renderStudio();
}
function changeScene(kind,process){
 if(studioOpen)closeStudio();controller.dispatch('disconnect');
 sceneDrafts[isLine(project)?'biw-line':'bracket']=structuredClone(project);
 project=structuredClone(sceneDrafts[kind]||(kind==='biw-line'?{...defaultProject(),bodyModel:'zeekr-001'}:bracketProject()));
 if(process)project.process=process;if(kind==='biw-line')project.process='spot';
 selected=visibleTasks(project)[0].id;invalidate();refresh();setTab('station');setSceneView('iso');$('.inspector-scroll').scrollTop=0;
}
async function scanPath(){
 if(checking){toast('路径检查正在进行');return;}if(!project.seams.some(s=>s.enabled)){toast('请启用至少一个任务');return;}
 if(isLine(project)&&project.robotModel!=='illustrative'){
  checking=true;pausePlayback();const rev=revision,restore=time,line=lineSummary(project),times=new Set([0,line.duration]),report={model:project.robotModel,samples:0,hits:[],near:[],unreachable:0,limited:0,singular:0,speedExceeded:0,maximumTcpError:0,minimum:null,step:.05};
  for(let t=0;t<line.duration;t+=.05)times.add(+t.toFixed(6));for(const st of line.stations)for(const stage of st.stages){times.add(stage.start);times.add(Math.max(stage.start,stage.end-1e-6));}
  try{for(const t of [...times].sort((a,b)=>a-b)){if(rev!==revision)return;scene.update(t,plan(),project);const state=scene.getState(),check=state.collisionCheck;report.samples++;for(const robot of state.stations){report.unreachable+=!robot.reachable;report.limited+=robot.joints.some(j=>j.limited)?1:0;report.singular+=robot.singular?1:0;report.speedExceeded+=robot.joints.some(j=>j.speedExceeded)?1:0;report.maximumTcpError=Math.max(report.maximumTcpError,robot.positionError||0);}report.hits.push(...check.hits.map(h=>({...h,time:t})));report.near.push(...check.near.map(h=>({...h,time:t})));if(check.minimum!==null)report.minimum=report.minimum===null?check.minimum:Math.min(report.minimum,check.minimum);if(report.samples%20===0){$('#statusText').textContent=`检查三站 · ${Math.round(t/line.duration*100)}%`;await new Promise(requestAnimationFrame);}}
   checkReport=report;showBottom('checks');$('#statusText').textContent='三站六轴路径检查完成';log(`三站 ${report.samples} 个同步时刻：干涉 ${report.hits.length} 项、近碰 ${report.near.length} 项、不可达 ${report.unreachable}、越限 ${report.limited}、超速 ${report.speedExceeded}。`);
  }finally{checking=false;if(rev===revision){scene.update(restore,plan(),project);updatePlayback();}}
  return;
 }
 checking=true;pausePlayback();const scanRevision=revision,snapshot=structuredClone(project),tasks=plan(),line=isLine(snapshot)?lineSummary(snapshot):null,stages=line?line.stations.flatMap(st=>st.stages.map(stage=>({...stage,station:st}))):tasks.flatMap(s=>s.stages),report={samples:0,hits:[],near:[],unreachable:0,minimum:Infinity};
 $('#statusText').textContent='正在采样检查路径…';
 try{for(const stage of stages){const steps=Math.max(2,Math.ceil(stage.duration/.2));for(let i=0;i<=steps;i++){
  if(scanRevision!==revision){toast('参数已变化，请重新检查');return;}
  const t=stage.start+stage.duration*i/steps,pose=line?lineMotionAt(t,stage.station,snapshot,line):motionAt(t,tasks,snapshot),check=line?lineCheck(pose,snapshot.engineering.clearance):envelopeReport(pose,snapshot.engineering.clearance);
  report.samples++;if(!pose.reachable)report.unreachable++;report.minimum=Math.min(report.minimum,check.minimum);
  if(check.hits.length)report.hits.push({time:t,station:stage.station?.id,...check.hits[0]});if(check.near.length)report.near.push({time:t,station:stage.station?.id,...check.near[0]});
  if(report.samples%60===0)await new Promise(resolve=>requestAnimationFrame(resolve));
 }}checkReport=report;showBottom('checks');$('#statusText').textContent='示意路径检查完成';log(`检查 ${report.samples} 个姿态：${report.hits.length} 个碰撞采样，${report.near.length} 个近碰采样；真实六轴与动态负载未校核。`);
 }finally{checking=false;if(scanRevision!==revision)$('#statusText').textContent='参数已更新，检查结果失效';}
}
function setBottomExpanded(expanded){
 $('.bottom-panel').classList.toggle('is-collapsed',!expanded);
 $('#bottomContent').hidden=!expanded;
 $('#bottomToggle').setAttribute('aria-expanded',String(expanded));
 $('#bottomToggle').setAttribute('aria-label',expanded?'收起详情':'展开详情');
 $('#bottomToggle span').textContent=expanded?'收起':'展开';
}
function showBottom(name){bottom=name;setBottomExpanded(true);renderBottom();}
function renderBottom(){const p=plan(),d=duration();$('.bottom-panel').classList.toggle('expanded-analysis',bottom==='risks'||bottom==='results'||bottom==='checks');$$('[data-bottom]').forEach(el=>el.classList.toggle('active',el.dataset.bottom===bottom));if(bottom==='timeline'){$('#bottomContent').innerHTML=timelineMarkup(project,time,selected);}else if(bottom==='logs'){$('#bottomContent').innerHTML=`<div class="log-lines">${logs.slice().reverse().map(l=>`<div class="log-line"><time>${l.time}</time><i>INFO</i><span>${esc(l.message)}</span></div>`).join('')}</div>`;}else if(bottom==='checks'){$('#bottomContent').innerHTML=checksMarkup(checkReport,project);}else if(bottom==='risks'){$('#bottomContent').innerHTML=risksMarkup(project,result?.source==='imported');}else{$('#bottomContent').innerHTML=resultMarkup(result,project,metric,time);}}
function renderChart(){const names={temperature:['温度','°C'],stress:['应力','MPa'],displacement:['位移','mm']},[name,unit]=names[metric];$('#contourTitle').textContent=name+' / '+unit;$('#metric').value=metric;let max=metric==='temperature'?1500:metric==='stress'?400:1.2;let min=metric==='temperature'?20:0;if(result){max=Math.max(...result.samples.map(s=>s[metric]));min=Math.min(...result.samples.map(s=>s[metric]));}$('#scaleMin').textContent=min.toFixed(metric==='displacement'?2:0)+' '+unit;$('#scaleMax').textContent=max.toFixed(metric==='displacement'?2:0)+' '+unit;$('#contourKey small').innerHTML=`<span>${min.toFixed(0)}</span><span>${max.toFixed(metric==='displacement'?2:0)}</span>`;if(!result){$('#chart').innerHTML='<span class="chart-empty">运行仿真以生成趋势曲线</span>';$('#dataSource').innerHTML=icon('Info')+'运行后查看演示估算';return;}$('#chart').innerHTML=curveSVG(result,metric,time,232,100);$('#dataSource').innerHTML=icon('Info')+esc(result.source==='demo'?'演示估算 · 非有限元求解':`外部数据 · ${result.filename}`);}
function restorePlaybackSpeed(){if(savedPlaybackSpeed!==null){speed=savedPlaybackSpeed;savedPlaybackSpeed=null;$('#playSpeed').value=String(speed);}}
function pausePlayback(){playing=false;playUntil=null;restorePlaybackSpeed();controller.dispatch('pause');}
function startPlayback({reset=false,end=null,slow=false}={}){
 if(scene?.getState()?.stations?.some(s=>s.manual)){toast('请先在控制台点击“返回程序姿态”');return false;}
 if(checking){toast('路径检查进行中，请稍候');return false;}if(!duration()){toast('请启用至少一个焊点');return false;}
 controller.sync({project,sceneState:scene?.getState(),time});
 if(controller.connected){const response=controller.dispatch('run');if(!response.ok){toast(response.message);updateController(true);return false;}}
 playUntil=end;restorePlaybackSpeed();if(slow){savedPlaybackSpeed=speed;speed=.5;$('#playSpeed').value='0.5';}
 if(reset||time>=duration()){time=0;lap=0;lastActivePoint=null;}playing=true;scene?.update(time,plan(),project);updatePlayback();return true;
}
function seekPlayback(next){pausePlayback();scene?.biw?.clearManual();time=Math.max(0,Math.min(next,duration()));scene?.update(time,plan(),project);updatePlayback();renderBottom();renderChart();}
function setSceneView(kind,station){contactView=kind==='contact'&&isLine(project);document.body.classList.toggle('contact-mode',contactView);$('.canvas-container').scrollTop=0;$('#contactInspector')?.classList.toggle('hidden',!contactView);scene?.view(kind,station);}
function updateContact(st){
 const c=st?.contact,field=(key,value)=>$$(`[data-contact-value="${key}"]`).forEach(el=>el.textContent=value);
 field('phase',`${st?.seam||selected} · ${st?.phase||'等待定位'}${playing?'':' · 阶段快照'}`);
 field('stack',c?`${c.thickness.toFixed(2)} × 2 = ${c.stack.toFixed(2)} mm`:'—');field('opening',c?`${c.opening.toFixed(2)} mm`:'—');
 field('current',c?`${c.current.toFixed(1)} kA`:'—');field('force',c?`${c.force.toFixed(1)} kN`:'—');
 field('contact',c?(st?.kind==='retreat'?`焊后压痕 ${c.dentDepth.toFixed(3)} mm · 教学形貌`:c.seated?'双电极贴合板件':c.aligned?'电极对准 · 开合中':'接近 / 撤离中'):'原版示意模型');
 $$('[data-contact-stage]').forEach(el=>el.classList.toggle('active',el.dataset.contactStage===(st?.kind==='retreat'?'result':st?.kind)));
}
function contactTarget(){return plan().find(s=>s.id===selected)||plan()[0];}
function contactStage(kind){
 if(!isLine(project))return;const target=contactTarget();if(!target){toast('当前工位未启用焊点');return;}
 const stage=kind==='result'?target.stages.find(s=>s.kind==='retreat'):target.stages.find(s=>s.kind===kind);if(!stage)return;
 selected=target.id;scene?.setSelected(selected);seekPlayback(kind==='result'?stage.end-.001:(stage.start+stage.end)/2);setSceneView('contact',project.activeStation);
}
function playContact(){
 if(!isLine(project))return;const target=contactTarget();if(!target){toast('当前工位未启用焊点');return;}
 const start=target.stages.find(s=>s.kind==='approach')||target.stages[0],end=target.stages.find(s=>s.kind==='retreat')||target.stages.at(-1);
 pausePlayback();time=start.start;selected=target.id;scene?.setSelected(selected);scene?.update(time,plan(),project);setSceneView('contact',project.activeStation);
 if(startPlayback({end:end.end,slow:true})){$('#statusText').textContent=`${target.id} · 0.5× 工艺慢放`;renderBottom();}
}
function updateController(force=false){
 const snapshot=controller.sync({project,sceneState:scene?.getState(),time,playing});
 if(snapshot.execution==='faulted'&&playing){playing=false;playUntil=null;restorePlaybackSpeed();if(snapshot.events[0]?.id!==lastControllerFault){lastControllerFault=snapshot.events[0]?.id;toast(snapshot.faults[0]?.message||'模拟控制器故障停止');}}
 $('.integration-status')?.classList.toggle('sim-connected',snapshot.connected);
 $$('[data-controller-status]').forEach(el=>el.textContent=snapshot.connected?`本地模拟 · ${snapshot.motorsOn?'电机 ON':'电机 OFF'}`:'本地控制器模拟');
 if(studioOpen&&!studioCollapsed&&(force||performance.now()-studioRefresh>150)){updateStudioLive($('#controllerDock'),snapshot,project,scene?.getState());studioRefresh=performance.now();}
 return snapshot;
}
function renderStudio(){const snapshot=updateController(true);$('#sceneControlsHome').append(sceneControls);$('#controllerDock').innerHTML=studioMarkup(snapshot,project,scene?.getState(),{tab:studioTab,station:studioStation});$('#controllerDock [data-studio-scene-slot]').append(sceneControls);updateController(true);}
function syncStudioDock(){
 dockResize.cancel();
 $('#controllerDock').hidden=!studioOpen||studioCollapsed;
 $('#controllerSplitter').hidden=!studioOpen||studioCollapsed;
 $('#controllerRestore').hidden=!studioOpen||!studioCollapsed;
 document.body.classList.toggle('studio-docked',studioOpen);
 document.body.classList.toggle('studio-collapsed',studioOpen&&studioCollapsed);
 $('.integration-status').setAttribute('aria-expanded',String(studioOpen&&!studioCollapsed));
 dockResize.apply();
}
function collapseStudio(){studioCollapsed=true;syncStudioDock();$('#controllerRestore').focus();}
function closeStudio(){studioOpen=false;studioCollapsed=false;$('#sceneControlsHome').append(sceneControls);syncStudioDock();scene?.biw?.setControlVisible(false);$('.integration-status').focus();}
function openStudio(){
 if(!isLine(project)){toast('控制台用于 ABB 三工位；可用顶部场景菜单切换');return;}
 if(studioOpen){studioCollapsed=false;syncStudioDock();updateController(true);$('#controllerDock [data-studio-action="collapse"]').focus();return;}
 studioOpen=true;studioCollapsed=false;syncStudioDock();studioStation=project.activeStation;controller.dispatch('select-station',{value:studioStation});scene?.biw?.setControlVisible(true);renderStudio();if(!contactView)setSceneView('iso',studioStation);
}
function applyFrame(payload){
 if(playing||checking||project.robotModel==='illustrative'){toast('请暂停并选择 ABB 六轴模型后设置坐标');return;}
 const all=structuredClone(project.controlFrames||{}),frames=all[studioStation]=structuredClone(stationFrames(project,studioStation));
 if(payload.reset)all[studioStation]=frameDefaults();else frames[payload.kind][payload.axis]=payload.value;
 try{project.controlFrames=validateFrames(all);}catch(e){toast(e.message);return;}
 scene?.biw?.reconfigureFrames();checkReport=null;revision++;persist();updatePlayback();updateController(true);
}
function studioAction(action,payload={}){
 if(action==='close'){closeStudio();return;}
 if(action==='collapse'){collapseStudio();return;}
 if(action==='set-frame'){applyFrame(payload);return;}if(action==='frames-reset'){applyFrame({reset:true});renderStudio();return;}
 if(action==='target-preview'){const target=contactTarget(),stage=target?.stages.find(s=>s.kind==='weld');if(stage){seekPlayback((stage.start+stage.end)/2);setSceneView('weld',studioStation);}return;}
 if(action==='program-pose'){pausePlayback();scene?.biw?.clearManual();updatePlayback();toast('已返回当前时间的程序姿态');return;}if(checking&&['run','step'].includes(action)){toast('路径检查进行中，请稍候');return;}
 controller.sync({project,sceneState:scene?.getState(),time});
 if(action==='run'){startPlayback();updateController(true);return;}
 if(action==='step'&&time>=duration()&&duration()>0){time=0;scene?.update(time,plan(),project);}
 const response=controller.dispatch(action,payload);if(!response.ok){toast(response.message);updateController(true);return;}
 if(response.intent==='manual'){const result=scene.biw.manualCommand(studioStation,action==='jog'?payload:{opening:action==='gun-open'?1:0});if(!result.ok){controller.reject(result.message);toast(result.message);}updatePlayback();updateController(true);return;}
 if(action==='connect'){playing=false;playUntil=null;restorePlaybackSpeed();}
 if(response.intent==='step'){playUntil=stepBoundary(project,time,studioStation);playing=playUntil>time;restorePlaybackSpeed();if(!playing)controller.dispatch('pause');}
 if(response.intent==='pause'){playing=false;playUntil=null;restorePlaybackSpeed();}
 if(response.intent==='stop'){playing=false;playUntil=null;restorePlaybackSpeed();time=0;lap=0;lastActivePoint=null;scene?.biw?.clearManual();scene?.update(time,plan(),project);renderBottom();renderChart();}
 updatePlayback();updateController(true);
}
function updatePlayback(){const d=duration();time=Math.max(0,Math.min(time,d));$('#currentTime').textContent=fmt(time);$('#seek').value=d?time/d*1000:0;const btn=$('[data-action="play"]');btn.innerHTML=icon(playing?'Pause':'Play');btn.title=playing?'暂停轨迹播放':'播放焊接轨迹';btn.setAttribute('aria-label',btn.title);updateHud();updateController();}

function updateHud(){const st=scene?.getState();if(!st)return;updateContact(st);$('#phaseBadge').textContent=(st.seam?st.seam+' · ':'')+st.phase;$('#phaseBadge').classList.toggle('hot',st.energized);$('#arcState').textContent=isSpot(project)?(st.energized?'● 通电':'○ 未通电'):isLaser(project)?(st.energized?'● 激光开启':'○ 激光关闭'):(st.arc?'● 电弧开启':'○ 电弧关闭');$('#gasState').textContent=isSpot(project)?(st.gunOpening<.1?'● 电极闭合':'○ 电极打开'):(st.gas?'● 保护气开启':'○ 保护气关闭');let temp=project.params.preheat;if(result?.source==='demo')temp=currentSample(result,time)?.temperature||temp;else{const last=[...plan()].reverse().find(s=>time>=s.start);if(last)temp=thermalCycle(Math.max(0,time-last.end),project);}$('#liveTemp').innerHTML=Math.round(temp)+' <small>°C · 示意</small>';if(isLine(project)){
 $('#lineHud span').textContent=`${project.activeStation} · ABB IRB 6700`;$('#lineHud small').textContent=`夹具${st.clamp>.99?'锁紧':st.clamp<.01?'打开':'动作中'} · 完成 ${st.done.length} / ${plan().length}`;
 $('#phaseMeter i').style.width=st.phaseProgress*100+'%';$('#phaseMeter small').textContent=`${st.phaseElapsed.toFixed(2)} / ${st.phaseDuration.toFixed(2)} s`;
 for(const state of st.stations){const el=$(`[data-line-state="${state.station}"]`);if(el)el.textContent=`${state.seam?state.seam+' ':''}${state.phase} · ${state.done.length}/${lineSummary(project).stations.find(x=>x.id===state.station).tasks.length}`;}
 if(st.joints?.length){$('#jointValues').innerHTML=st.joints.map(j=>`<div class="axis-reading ${j.near||j.speedExceeded?'warning-text':''}" title="${j.axis} 限位余量 ${j.margin.toFixed(1)}° · 速度 ${j.velocity.toFixed(1)} / ${j.speedLimit} °/s"><span>${j.axis}</span><b>${j.degrees.toFixed(1)}°</b><i><em style="width:${Math.max(0,Math.min(100,(j.degrees-j.min)/(j.max-j.min)*100))}%"></em></i><small>${j.min}° ～ ${j.max}°</small></div>`).join('');const warning=!st.reachable?'不可达':st.joints.some(j=>j.limited)?'关节越限':st.joints.some(j=>j.speedExceeded)?'速度超限':st.singular?'腕部奇异邻域':st.joints.some(j=>j.near)?'接近限位':'限位内';$('#jointSummary').textContent=warning;$('#jointSummary').classList.toggle('warning-text',warning!=='限位内');$('#tcpResidual').textContent=st.manual?'六轴点动 · FK · 分段网格碰撞检查':st.motionType==='MoveJ'?'MoveJ · 关节插补 · 焊枪跟随法兰':`MoveL · 解算残差 ${st.positionError.toFixed(3)} mm · 姿态 ${(st.orientationError||0).toFixed(3)}°`;}
 if(st.seam&&st.seam!==lastActivePoint){lastActivePoint=st.seam;selected=st.seam;scene?.setSelected(selected);$('#selectedLabel').textContent=selected;$('#selectedLength').textContent='单个焊点';renderSeams();}
 }const real=isLine(project)&&project.robotModel!=='illustrative',hits=real?st.collisionCheck?.hits.length||0:st.collisions.length,near=real?st.collisionCheck?.near.length||0:0;$('#clearanceState').textContent=real?`三站网格 · ${hits?'干涉 '+hits:near?'近碰 '+near:'当前未检出'}`:st.collisions.length?'示意包络：发现干涉':'示意包络：当前未检出';$('#clearanceState').classList.toggle('collision',!!hits);}

function setTab(tab){if(tab!=='station'&&studioOpen)closeStudio();activeTab=tab;$$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('.workspace').classList.toggle('analysis-view',tab==='analysis');$('#viewportTitle').textContent=isLine(project)?'ABB 三工位点焊流水线':{station:'焊接工作站',strategy:'焊接策略预览',analysis:'仿真结果可视化'}[tab];if(tab==='analysis'){bottom='results';setBottomExpanded(true);$('#analysisPreview').open=true;setRender(metric);}else{bottom='timeline';setRender('solid');}if(tab==='strategy'){$('#strategyInspector').open=true;setBottomExpanded(true);$('#strategyInspector').scrollIntoView({block:'nearest',behavior:'smooth'});}renderBottom();}
function setRender(mode){scene?.setMode(mode);$$('[data-render]').forEach(b=>b.classList.toggle('active',b.dataset.render===mode));$('#contourKey').classList.toggle('hidden',!['temperature','stress','displacement'].includes(mode));if(['temperature','stress','displacement'].includes(mode)){metric=mode;renderChart();}}
function download(filename,text,type='application/json'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function modal(title,body){$('#dialogContent').innerHTML=`<div class="dialog-head"><h2>${title}</h2>${button('X','关闭对话框','close')}</div><div class="dialog-body">${body}</div>`;if(!$('#dialog').open)$('#dialog').showModal();}
function close(){$('#dialog').close();}
function connections(){openStudio();}
function exportJob(){const payload={schema:'sophi-weld-exchange/2',generatedAt:new Date().toISOString(),units:{length:'mm',time:'s',arcCurrent:'A',spotCurrent:'kA',voltage:'V',laserPower:'W',speed:'mm/s',mass:'kg',force:'kN'},purpose:'Neutral process exchange; requires a validated native application adapter.',connectedSolvers:[],controller:{kind:'local-simulator',connected:controller.connected,scope:'Browser simulation only; no RobotWare or ABB VC connected'},project:validateProject(project),energy:energyValue(project),cycle:cycleSummary(project),line:isLine(project)?lineSummary(project):null,checks:checkReport,robot:isLine(project)?{model:project.robotModel,source:project.robotModel!=='illustrative'?ABB_SOURCE:null,current:scene?.getState()}:null,unchecked:[...(isLine(project)&&project.robotModel!=='illustrative'?[]:['six_axis_limits','singularities']),'controller_validation','joint_acceleration','other_singularities','continuous_collision','electrode_contact','dynamic_payload','flexible_cables','weld_quality'],sequence:(isLine(project)?lineSummary(project).stations.flatMap(st=>st.tasks.map(s=>({...s,station:st.id}))):plan()).map(s=>({id:s.id,station:s.station||null,start_s:s.start,duration_s:s.duration,length_mm:isSpot(project)?null:s.length,stages:s.stages})),spatialCoordinates:isLine(project)&&project.robotModel!=='illustrative'?'Current joint angles in degrees and TCP in cell-local metres are included under robot.current. Teaching BIW and gun; controller calibration required.':'Viewport geometry and robot poses are illustrative.'};download('weld-process.json',JSON.stringify(payload,null,2));toast('中立工艺包已导出');log('已导出中立工艺 JSON；未生成机器人可执行程序。');}
async function run(){try{validateProject(project);if(!project.seams.some(s=>s.enabled))throw Error('请至少启用一个焊接任务');if(!startPlayback({reset:true}))return;result=simulate(project);setTab(isLine(project)?'station':'analysis');renderChart();renderBottom();$('#statusText').textContent=controller.connected?'本地控制器模拟运行中':'演示计算完成';log(`演示估算完成：${isLine(project)?lineSummary(project).taskCount:plan().length} 个任务，工艺能量指标 ${energyValue(project).value.toFixed(3)} ${energyValue(project).unit}；未调用外部求解器。`);toast('演示结果已生成，开始播放焊接轨迹');}catch(e){toast(e.message);}}
function save(){persist(false);}
function report(){if(!result){toast('请先运行演示计算或导入分析结果');return;}download('weld-report.html',engineeringReport(project,result,checkReport),'text/html');toast('含节拍与未校核项的工程报告已导出');}
const actions={
 'toggle-bottom':()=>setBottomExpanded($('#bottomContent').hidden),
 'line-info':()=>modal('白车身流水线 · 节拍与动作说明',lineGuide(project)),
 'weld-focus':()=>{setSceneView('weld',project.activeStation);$('#jointMonitor').open=false;},'line-overview':()=>setSceneView('iso'),'line-focus':()=>setSceneView('iso',project.activeStation),
 'line-loop':()=>{lineLoop=!lineLoop;const el=$('[data-action="line-loop"]');el.classList.toggle('active',lineLoop);el.setAttribute('aria-pressed',lineLoop);},
 'save':save,'run':run,'close':close,'connections':connections,'controller-studio':openStudio,
 'contact-focus':()=>contactStage('close'),'contact-play':playContact,
 'tool-settings':()=>focusSettings('toolSettings'),
 'strategy-settings':()=>focusSettings('strategyInspector'),
 'cycle-settings':()=>focusSettings('cycleSettings'),
 'checks':()=>{close();showBottom('checks');},'scan':scanPath,
 'mid-weld':()=>{close();if(!plan().length)return;const target=plan().find(s=>s.id===selected)||plan()[0];seekPlayback(target.start+target.duration*.55);},
 'cool-stage':()=>{close();if(!plan().length)return;if(!result)result=simulate(project);pausePlayback();time=isLine(project)?lineSummary(project).work-.001:cycleSummary(project).station+Math.min(35,project.params.coolDuration*.5);setTab(isLine(project)?'station':'analysis');scene?.update(time,plan(),project);updatePlayback();renderChart();renderBottom();},
 'clearance-info':()=>isLine(project)&&project.robotModel!=='illustrative'?modal('三站六轴网格检查',`<p>三站共用仿真时钟。真实连杆碰撞网格与教学枪臂、车身、活动夹具、输送线、围栏和控制柜进行 BVH 检查；包含非相邻自碰撞和跨工位机器人。点击工程校核可采样整轮路径，问题记录可定位到对应时刻。</p><p>关节轴与限位来源：<a href="${ABB_SOURCE}" target="_blank" rel="noopener">ROS-Industrial ABB IRB 6700-235/2.65</a>。显示六轴角度、速度与直线目标残差，J5 ±3° 提示腕部奇异邻域；MoveJ 穿越该邻域不等于关节速度发散。</p><div class="notice">排除相邻机械连接和电极帽接触区。不含柔性线缆、加速度 / 动态负载、其他奇异类型和连续碰撞证明；未连接 ABB 控制器。</div>`):modal('简化几何检查',`<p>腕部、枪体和手臂按每条焊缝的进枪方向定位；换道先抬枪，再横向移动。当前几何采用固定臂长的两连杆解析解，末端姿态沿接头法向调整。</p><p>检查范围：手臂、腕部、枪体、枪颈、喷嘴与工件、筋板、工作台和四个夹具的简化包络。当前结果：${(scene?.getState()?.stations?.some(st=>st.collisions.length)||scene?.getState()?.collisions.length)?'检出重叠':'未检出重叠'}。</p><div class="notice">这是本演示几何的间隙检查，不包含真实 ABB 关节限位、自碰撞、线缆碰撞或控制器验证。</div>`),
 'clearance':()=>{showBottom('checks');},
 'risk-method':()=>modal('风险提示的依据与边界',`<p>展示热输入、冷却速度、保护条件和走枪方式触发的规则化提示，不输出缺陷概率或合格结论。t₈/₅ 表示演示冷却模型从 800°C 到 500°C 所需时间。</p><p>残余应力、变形和纹理均为示意。裂纹判断仍需要碳当量、氢含量、真实约束条件及材料本构；内部气孔不能通过外观排除。</p><p><a href="https://www.twi-global.com/technical-knowledge/job-knowledge/defects-imperfections-in-welds-porosity-042" target="_blank" rel="noopener">TWI：气孔机理</a><br><a href="https://www.millerwelds.com/en-us/resources/knowledge-hub/mig-welding/how-to/troubleshooting-weld-defects" target="_blank" rel="noopener">Miller：速度、枪距与焊接缺陷</a></p>`),
 'about':()=>modal('SOPHI WELD',`<h3>焊接策略开发与仿真分析</h3><p>项目将机器人工作站布局、焊缝顺序与热力分析整合到同一工作台。参考 RobotStudio 工作站与 Simufact Welding 分析流程。</p><p>当前模型：${esc(project.part)}<br>材料：${esc(project.material)} · 板厚 ${project.params.thickness} mm<br>流程：工作站 → 焊接策略 → 仿真分析</p><div class="notice">当前为浏览器演示项目，使用简化几何与示意模型。已加入固定臂长运动与简化包络检查。真实机器人关节约束和有限元求解尚未接入。</div>`),
 'help':()=>modal('操作指南',`<p>上方八步工程导航和参数旁的问号说明各环节的输入、方法与当前能力。右侧切换焊接方式和成形示例，底部查看节拍、工程校核和结果曲线。</p><h3>01 / 配置工作站</h3><p>左键拖动旋转，右键拖动平移，滚轮缩放。左侧眼睛图标控制模型可见性；点击焊缝行选择对应路径。</p><h3>02 / 开发焊接策略</h3><p>编辑电流、电压、速度和板厚；选择焊接顺序及道间等待。勾选焊缝控制是否参与加工，底部时序随参数同步更新。当前参数作用于全部启用焊缝。</p><h3>03 / 分析与交换</h3><p>运行仿真生成明确标记的演示估算；切换温度、应力或位移查看趋势。可导入真实计算导出的 CSV 时程，或者导出工艺包、数据和 HTML 报告。</p><p>快捷键：<code>Space</code> 播放 / 暂停；<code>⌘ / Ctrl S</code> 保存；<code>⌘ / Ctrl K</code> 搜索。</p>`),
 'seam-info':()=>isLine(project)?modal('分站任务与焊点',lineGuide(project)):modal('焊缝与工艺设置',`<p>当前提供 4 个预定义任务：弧焊 / 激光焊对应四条焊缝，点焊对应四个搭接焊点。点击行切换高亮，右侧复选框启用或停用该焊缝。工艺参数对所有启用焊缝生效。</p><p>几何轨迹与长度为演示模型；实际工件需要 CAD 与工艺适配器重新映射。当前网页不增加未知几何上的焊缝。</p>`),
 'import':()=>modal('导入项目与分析数据',`<div class="import-options"><button class="import-option" data-action="import-project">${icon('FolderOpen')}<b>打开焊接项目</b><small>导入本工具导出的 JSON<br>恢复工艺参数和焊缝顺序</small></button><button class="import-option" data-action="import-results">${icon('Activity')}<b>导入分析结果</b><small>导入映射后的 CSV<br>温度、应力与位移时程</small></button></div><p class="form-note">CAD / STEP 修复尚未接入；项目 JSON 恢复的是本页教学模型与参数，不能替代真实数模导入。</p><h3>CSV 列名与单位</h3><code>time_s,temperature_c,stress_mpa,displacement_mm</code><p>时间须递增，场量须为有效数值。网页保留文件名作为数据来源；导入前需将原生软件数据转换到以上单位。</p><button class="button" data-action="sample-csv">${icon('Download')}下载格式示例</button>`),
 'import-project':()=>chooseFile('project'),'import-results':()=>chooseFile('results'),
 'sample-csv':()=>download('weld-results-example.csv',csvFromSamples(simulate(defaultProject()).samples),'text/csv'),
 'export':()=>modal('导出工程文件',`<div class="dialog-actions"><button class="button" data-action="export-project">${icon('Save')}项目 JSON</button><button class="button" data-action="export-job">${icon('Workflow')}中立工艺 JSON</button><button class="button" data-action="export-results" ${result?'':'disabled'}>${icon('Activity')}结果 CSV</button><button class="button" data-action="report" ${result?'':'disabled'}>${icon('FileText')}分析报告 HTML</button></div><p style="margin-top:19px">项目文件用于恢复本工作台；中立工艺包用于后续开发原生软件适配器。实际接入需在对应 Windows 软件环境中验证。</p>${result?`<div class="notice">当前结果：${esc(result.label)}</div>`:'<p>结果文件与报告在运行计算或导入数据后可用。</p>'}`),
 'export-project':()=>{download('weld-project.json',JSON.stringify(project,null,2));toast('项目 JSON 已导出');},'export-job':exportJob,
 'export-results':()=>{if(result){download(result.source==='demo'?'weld-demo-results.csv':'weld-imported-results.csv',csvFromSamples(result.samples),'text/csv');toast('结果 CSV 已导出');}},'report':report,
 'play':()=>{if(playing){pausePlayback();updatePlayback();}else startPlayback();},
 'rewind':()=>{lap=0;lastActivePoint=null;seekPlayback(0);},
 'end':()=>seekPlayback(duration()),
 'reset-view':()=>{setSceneView('iso');$('#viewSelect').value='iso';},'zoom-in':()=>scene?.zoom(.85),'zoom-out':()=>scene?.zoom(1.15),
 'grid':()=>scene?.toggle('grid'),'orbit':()=>toast('左键拖动旋转，右键拖动平移，滚轮缩放'),
 'select':()=>toast('点击焊缝路径或左侧焊缝行进行选择'),
 'snapshot':()=>{if(!scene){toast('三维视图不可用');return;}const a=document.createElement('a');a.download='weld-workstation.png';a.href=scene.snapshot();a.click();toast('工作站视图已保存');},
 'fullscreen':()=>document.body.classList.toggle('focus-scene'),
 'left':()=>{if(innerWidth<=920)document.body.classList.toggle('left-open');else document.body.classList.toggle('left-collapsed');},
 'right':()=>{if(innerWidth<=640)document.body.classList.toggle('right-open');else document.body.classList.toggle('right-collapsed');}
};
function chooseFile(kind){importKind=kind;const input=$('#fileInput');input.accept=kind==='project'?'.json':'.csv';input.value='';input.click();}
document.addEventListener('click',e=>{const contact=e.target.closest('[data-contact-stage]');if(contact){contactStage(contact.dataset.contactStage);return;}const station=e.target.closest('[data-station]');if(station){selectStation(station.dataset.station);return;}const step=e.target.closest('[data-step]');if(step){e.preventDefault();modal(workflowSteps[Number(step.dataset.step)].title,guideMarkup(Number(step.dataset.step)));return;}const outcome=e.target.closest('[data-outcome]');if(outcome){project.outcome=outcome.dataset.outcome;invalidate();refresh();toast('已切换结果教学示例；旧计算结果已清除');return;}const stage=e.target.closest('[data-stage-time]');if(stage){if(stage.dataset.lineStage&&stage.dataset.lineStage!==project.activeStation)selectStation(stage.dataset.lineStage,false);seekPlayback(Number(stage.dataset.stageTime));return;}const action=e.target.closest('[data-action]');if(action&&!action.disabled){actions[action.dataset.action]?.();return;}const inspect=e.target.closest('[data-inspect]');if(inspect){setInspector(inspect.dataset.inspect);return;}const tab=e.target.closest('[data-tab]');if(tab){setTab(tab.dataset.tab);return;}const btn=e.target.closest('[data-bottom]');if(btn){const expanded=$('#bottomContent').hidden||bottom!==btn.dataset.bottom;bottom=btn.dataset.bottom;setBottomExpanded(expanded);renderBottom();return;}const mode=e.target.closest('[data-render]');if(mode){setRender(mode.dataset.render);return;}const visible=e.target.closest('[data-visible]');if(visible){const on=scene?.toggle(visible.dataset.visible);visible.innerHTML=icon(on?'Eye':'EyeOff');visible.setAttribute('aria-pressed',!!on);visible.closest('.tree-item').dataset.hidden=!on;return;}const seam=e.target.closest('[data-seam]');if(seam&&!e.target.matches('input'))selectSeam(seam.dataset.seam);});
document.addEventListener('keydown',e=>{if(e.target.matches('[data-seam]')&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();selectSeam(e.target.dataset.seam);return;}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();return;}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(innerWidth<=920)document.body.classList.add('left-open');else document.body.classList.remove('left-collapsed');$('#treeSearch').focus();return;}if(e.code==='Space'&&!e.target.matches('input,select,textarea,button')&&!$('#dialog').open){e.preventDefault();actions.play();}});
$$('[data-param]').forEach(el=>{const apply=(final)=>{const key=el.dataset.param,value=Number(el.value);const [min,baseMax]=limits[key],max=key==='thickness'&&isLine(project)&&project.bodyModel!=='legacy'?3:baseMax;if(el.value.trim()===''||!Number.isFinite(value)||value<min||value>max){if(final){toast(`参数需在 ${min}–${max} 范围内`);el.value=project.params[key];}return;}if(project.params[key]===value)return;project.params[key]=value;$('#preset').value='custom';invalidate();updateEnergy();$('#duration').textContent=fmt(duration());$('.left-bottom>div>span').textContent=`${project.material} · ${project.params.thickness} mm · ${project.seams.filter(s=>s.enabled).length} 道焊缝`;$('.joint-diagram svg text:last-child').textContent=project.params.thickness+' mm';};el.addEventListener('input',()=>apply(false));el.addEventListener('change',()=>apply(true));});
function setInspector(name){$('#basicParams').classList.toggle('hidden',name!=='basic');$('#morphologyParams').classList.toggle('hidden',name!=='morphology');$$('[data-inspect]').forEach(b=>b.classList.toggle('active',b.dataset.inspect===name));}
$('#bodyModel')?.addEventListener('change',e=>{project.bodyModel=e.target.value;if(project.bodyModel!=='legacy'){project.engineering.gunType='c';if(project.params.thickness>3)project.params.thickness=1.2;}invalidate();refresh();setSceneView('iso',project.activeStation);toast(project.bodyModel==='legacy'?'已切换到原版车身场景':'已切换到钣金白车身场景');});
$('#robotModel').addEventListener('change',e=>{project.robotModel=e.target.value;invalidate();refresh();setSceneView('iso',project.activeStation);toast(project.robotModel==='illustrative'?'已切换到原版示意机械臂':'已切换到 ABB 六轴模型');});
for(const key of ['process','weave','gas'])$('#'+key).addEventListener('change',e=>{if(key==='process'&&isLine(project)&&e.target.value!=='spot'){changeScene('bracket',e.target.value);return;}project[key]=e.target.value;$('#preset').value='custom';if(key==='process'){if(['tig','laser'].includes(project.process))project.gas='argon';project.outcome='nominal';}invalidate();refresh();});
$('#preset').addEventListener('change',e=>{const id=e.target.value;if(id==='custom')return;const variants={standard:{process:'mag',weave:'straight',gas:'mix',params:{}},pulse:{process:'pulse',weave:'circle',gas:'mix',params:{current:190,speed:7,postflow:4}},weave:{process:'mag',weave:'zigzag',gas:'mix',params:{current:240,speed:5}},fast:{process:'mag',weave:'straight',gas:'mix',params:{current:160,speed:19}},poorGas:{process:'mag',weave:'straight',gas:'co2',params:{gasFlow:4,torchDistance:28,postflow:.5}}};const chosen=variants[id];project={...project,...chosen,params:{...bracketProject().params,...chosen.params}};project.outcome='nominal';invalidate();refresh();toast('已应用形貌示例，焊接状态已重置');});
$('#material').addEventListener('change',e=>{project.material=e.target.value;invalidate();refresh();});
$('#strategy').addEventListener('change',e=>{project.strategy=e.target.value;invalidate();refresh();log(`焊接顺序已更新：${plan().map(s=>s.id).join(' → ')}。`);});
document.addEventListener('change',e=>{if(e.target.matches('[data-result-metric]')){metric=e.target.value;setRender(metric);renderBottom();return;}if(e.target.matches('[data-seam-enable]')){project.seams.find(s=>s.id===e.target.dataset.seamEnable).enabled=e.target.checked;invalidate();refresh();}});
$('#seek').addEventListener('input',e=>seekPlayback(Number(e.target.value)/1000*duration()));
$('#playSpeed').addEventListener('change',e=>speed=Number(e.target.value));$('#viewSelect').addEventListener('change',e=>setSceneView(e.target.value));$('#metric').addEventListener('change',e=>{metric=e.target.value;renderChart();setRender(metric);renderBottom();});
$('#treeSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$$('[data-search]').forEach(el=>el.classList.toggle('hidden',!el.dataset.search.toLowerCase().includes(q)));renderSeams();});
$('#fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('文件超过 5 MB，请缩小后导入');const text=await file.text();if(importKind==='project'){const parsed=JSON.parse(text);project=validateProject(parsed.project||parsed);selected=visibleTasks(project)[0].id;invalidate();refresh();log(`已导入项目 ${file.name}。`);toast('项目已导入');}else{const samples=parseResultsCSV(text);result={source:'imported',filename:file.name,label:`外部 CSV · ${file.name}`,samples,createdAt:new Date().toISOString()};pausePlayback();setTab('analysis');renderChart();renderBottom();updatePlayback();$('#statusText').textContent='外部结果已载入';log(`已导入 ${file.name}：${samples.length} 个时间采样点。空间云图仍为示意分布。`);toast('外部分析时程已导入');}close();}catch(error){toast('导入失败：'+error.message);log('导入失败：'+error.message);}});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
$('#quickBody').addEventListener('change',e=>{$('#bodyModel').value=e.target.value;$('#bodyModel').dispatchEvent(new Event('change'));});
$('#quickScene').addEventListener('change',e=>changeScene(e.target.value));
bindStudio($('#controllerDock'),{onAction:studioAction,onTab:tab=>{studioTab=tab;renderStudio();},onStation:id=>{if(isLine(project))selectStation(id,true);}});
$('#playSpeed').value=String(speed);
try{scene=new WeldScene($('#viewport'),selectSeam);scene.setProject(project,plan());}catch(e){$('#viewport').innerHTML='<div class="fallback"><b>当前环境无法创建三维视图</b><p>请使用支持 WebGL 的 Chrome / Edge 浏览器。<br>工艺编辑、时序和结果分析仍可使用。</p></div>';log('WebGL 不可用：'+e.message);}
refresh();updatePlayback();
function tick(now){if(lastFrame&&playing){time+=Math.min((now-lastFrame)/1000,.15)*speed;
 if(playUntil!==null&&time>=playUntil){time=playUntil;pausePlayback();$('#statusText').textContent='工艺阶段播放完成';}
 else if(time>=duration()){if(isLine(project)&&lineLoop&&duration()>0){time%=duration();lap++;$('#statusText').textContent=`流水线第 ${lap+1} 轮 · 稳态连续生产`;lastActivePoint=null;}else{time=duration();pausePlayback();$('#statusText').textContent='轨迹播放完成';}}
 scene?.update(time,plan(),project);updatePlayback();if(Math.floor(now/250)!==Math.floor(lastFrame/250)){if(bottom==='timeline'||bottom==='results')renderBottom();if(result)renderChart();}
 if((scene?.getState()?.stations?.some(st=>st.collisions.length||!st.reachable||st.joints?.some(j=>j.limited))||scene?.getState()?.collisions.length)){if(controller.connected)controller.dispatch('fault',{code:'SIM_MOTION_FAULT',message:'模型检出碰撞、不可达或关节越限，模拟停止。'});pausePlayback();updateController(true);toast('当前姿态存在干涉或不可达 / 越限，播放已暂停');}
 }lastFrame=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
// Minimal read-only status for integration and browser QA, no simulated solver connection.
window.weldStatus=()=>({project:structuredClone(project),selected,time,playing,playbackSpeed:speed,lap,lineLoop,view:activeTab,resultSource:result?.source||null,sampleCount:result?.samples.length||0,webgl:!!scene,connectedSolvers:[],controller:controller.snapshot(),studioOpen,studioCollapsed,contactView,playUntil,scene:scene?.getState(),duration:duration(),cycle:cycleSummary(project),line:isLine(project)?lineSummary(project):null,checks:checkReport,plan:plan().map(s=>({id:s.id,start:s.start,end:s.end})),profile:beadProfile(project),risks:assessRisks(project)});

$$('[data-engineering]').forEach(el=>el.addEventListener('change',()=>{
 const key=el.dataset.engineering,value=Number(el.value),[min,max]=ENGINEERING_LIMITS[key];
 if(el.value.trim()===''||!Number.isFinite(value)||value<min||value>max){toast(`参数需在 ${min}–${max} 范围内`);el.value=project.engineering[key];return;}
 if(project.engineering[key]===value)return;project.engineering[key]=value;invalidate();refresh();
}));
$('#gunType').addEventListener('change',e=>{project.engineering.gunType=e.target.value;invalidate();refresh();});
