import {LINE_STATIONS} from './line-data.js';
import {lineSummary} from './engineering.js';

const EXECUTING=new Set(['running','stepping']);
const copy=value=>structuredClone(value);
const stationId=value=>LINE_STATIONS.some(s=>s.id===value)?value:'OP10';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export const CONTROLLER_TASKS=LINE_STATIONS.map((s,i)=>({station:s.id,task:`ROB_${i+1}`,name:s.name}));
export const CONTROLLER_SIGNALS=[
 {name:'diFixtureClosed',label:'夹具闭合到位',type:'DI',key:'fixtureClosed'},
 {name:'diGunOpen',label:'焊枪打开到位',type:'DI',key:'gunOpen'},
 {name:'diGunClosed',label:'电极夹紧到位',type:'DI',key:'gunClosed'},
 {name:'doWeldOn',label:'通电命令',type:'DO',key:'welding'},
 {name:'diHoldActive',label:'保压阶段',type:'DI',key:'hold'},
 {name:'diStationComplete',label:'工位加工完成',type:'DI',key:'complete'},
 {name:'diCollisionFree',label:'三工位当前无硬碰撞',type:'DI',key:'collisionFree'},
 {name:'diJointLimitsOK',label:'六轴在限位内',type:'DI',key:'limitsOK'},
 {name:'diElectrodeAligned',label:'电极位置与法向贴合',type:'DI',key:'aligned'},
 {name:'aiCurrent_kA',label:'模拟焊接电流',type:'AI',key:'current'},
 {name:'aiForce_kN',label:'模拟电极压力',type:'AI',key:'force'}
];

// This local state machine does not talk to RobotWare, RWS, or an ABB virtual controller.
// The host owns the scene clock. dispatch returns intentions; sync reads that same clock.
export class ControllerSimulator {
 constructor(options={}){
  this.name=String(options.name||'BIW_LOCAL_SIM').slice(0,40);this.connected=false;this.motorsOn=false;
  this.mode='automatic';this.execution='stopped';this.selectedStation=stationId(options.station);
  this.faults=[];this.events=[];this.sequence=0;this.time=0;this.project=null;this.sceneState=null;
  this.log('info','LOCAL_READY','本地控制器模拟器已就绪；未连接 ABB / RobotStudio。');
 }
 log(level,code,message){this.events.unshift({id:++this.sequence,time:this.time,level,code,message});this.events.length=Math.min(100,this.events.length);}
 reject(message){this.log('warning','COMMAND_REJECTED',message);return {ok:false,message};}
 dispatch(action,payload={}){
  const value=typeof payload==='string'?payload:payload.value;
  switch(action){
   case 'connect':
    if(!this.connected){this.connected=true;this.execution='stopped';this.log('info','LOCAL_CONNECTED','本地模拟连接成功；执行引擎为网页仿真。');}
    return {ok:true,message:'已连接本地模拟器'};
   case 'disconnect':
    this.connected=false;this.motorsOn=false;this.execution='stopped';this.log('info','LOCAL_DISCONNECTED','已断开本地模拟，运行与通电输出停止。');
    return {ok:true,intent:'pause',message:'已断开本地模拟器'};
   case 'motors-on':
    if(!this.connected)return this.reject('请先连接本地模拟器。');
    if(this.faults.length)return this.reject('请先排除并复位模拟故障。');
    this.motorsOn=true;this.log('info','MOTORS_ON','模拟电机已上电。');return {ok:true,message:'模拟电机已上电'};
   case 'motors-off':
    this.motorsOn=false;this.execution='stopped';this.log('info','MOTORS_OFF','模拟电机已下电；运行停止。');return {ok:true,intent:'pause',message:'模拟电机已下电'};
   case 'set-mode':
    if(!['automatic','manual'].includes(value))return this.reject('模式必须为自动或手动。');
    this.mode=value;this.execution='stopped';this.log('info','MODE_CHANGED',`切换为${value==='automatic'?'自动':'手动'}模式；程序已停止。`);return {ok:true,intent:'pause'};
   case 'set-name': {
    const name=String(value??'').trim();if(!name||name.length>40)return this.reject('模拟器名称需为 1–40 个字符。');
    this.name=name;this.log('info','NAME_CHANGED','已更新本地模拟器名称。');return {ok:true};
   }
   case 'select-station':
    if(!CONTROLLER_TASKS.some(s=>s.station===value))return this.reject('任务必须为 OP10、OP20 或 OP30。');
    this.selectedStation=value;return {ok:true};
   case 'jog':
   case 'gun-open':
   case 'gun-close':
    if(!this.connected||!this.motorsOn)return this.reject('请先连接模拟器并给模拟电机上电。');
    if(this.mode!=='manual'||EXECUTING.has(this.execution))return this.reject('请暂停并切换手动模式后点动。');
    if(this.faults.length)return this.reject('请先复位模拟故障。');
    if(this.project?.scene!=='biw-line'||this.project.robotModel==='illustrative')return this.reject('点动需要白车身场景中的 ABB 真实六轴模型。');
    if(action==='jog'&&(!Number.isInteger(payload.axis)||payload.axis<0||payload.axis>5||!finite(payload.delta)||Math.abs(payload.delta)>5))return this.reject('点动参数无效。');
    this.execution='paused';return {ok:true,intent:'manual'};
   case 'run':
   case 'step':
    if(!this.connected)return this.reject('请先连接本地模拟器。');
    if(!this.motorsOn)return this.reject('请先给模拟电机上电。');
    if(this.faults.length)return this.reject('请先排除并复位模拟故障。');
    if(this.project?.scene!=='biw-line'||this.project.process!=='spot')return this.reject('控制器模拟适用于白车身点焊流水线。');
    if(!this.project.seams.some(s=>s.enabled))return this.reject('请至少启用一个焊点。');
    if(action==='run'&&this.mode!=='automatic')return this.reject('连续运行需要自动模式；手动模式可使用单步。');
    if(action==='step'&&EXECUTING.has(this.execution))return this.reject('请先暂停，再单步执行。');
    if(this.sceneState?.stations?.some(s=>s.manual))return this.reject('请先点击“返回程序姿态”，再执行程序。');
    this.execution=action==='step'?'stepping':'running';this.log('info',action==='step'?'STEP_STARTED':'RUN_STARTED',action==='step'?'单步执行至当前工艺阶段末端。':'三工位模拟开始同步运行。');
    return {ok:true,intent:action,message:action==='step'?'执行一个工艺阶段':'模拟运行中'};
   case 'pause':
    if(EXECUTING.has(this.execution)){this.execution='paused';this.log('info','RUN_PAUSED','模拟已暂停；通电命令关闭。');}
    return {ok:true,intent:'pause'};
   case 'stop':
    this.execution='stopped';this.log('info','RUN_STOPPED','模拟已停止，程序指针返回周期起点。');return {ok:true,intent:'stop'};
   case 'fault': {
    const fault={code:String(payload.code||'SIM_TEST_FAULT'),message:String(payload.message||'手动触发的模拟故障，用于验证停止与复位流程。')};
    if(!this.faults.some(f=>f.code===fault.code)){this.faults.push(fault);this.log('error',fault.code,fault.message);}
    this.execution='faulted';this.motorsOn=false;return {ok:true,intent:'pause',message:fault.message};
   }
   case 'reset':
    if(!this.connected)return this.reject('请先连接本地模拟器。');
    this.faults=[];this.execution='stopped';this.motorsOn=false;this.log('info','FAULT_RESET','模拟故障已复位；请重新上电。');return {ok:true,intent:'pause',message:'已复位，请重新上电'};
   default:return this.reject('未知模拟控制指令。');
  }
 }
 sync({project=this.project,sceneState=this.sceneState,time=this.time,playing}={}){
  this.project=project;this.sceneState=sceneState;this.time=finite(time)?Math.max(0,time):this.time;
  if(playing===false&&EXECUTING.has(this.execution))this.dispatch('pause');
  if(this.connected&&EXECUTING.has(this.execution)){
   const states=sceneState?.stations||[];
   const invalid=states.find(s=>s.reachable===false||s.collisions?.length||s.joints?.some(j=>j.limited));
   if(invalid)this.dispatch('fault',{code:'SIM_MOTION_FAULT',message:`${invalid.station} 检出${invalid.collisions?.length?'模型碰撞':invalid.reachable===false?'不可达姿态':'关节越限'}，模拟停止。`});
  }
  return this.snapshot();
 }
 snapshot(){
  const executing=this.connected&&this.motorsOn&&!this.faults.length&&EXECUTING.has(this.execution);
  const states=this.sceneState?.stations||[];
  const stations=CONTROLLER_TASKS.map(task=>{
   const pose=states.find(s=>s.station===task.station),available=!!(this.connected&&pose&&this.project?.scene==='biw-line');
   const enabled=this.project?.seams?.filter(s=>s.enabled&&LINE_STATIONS.find(st=>st.id===task.station).ids.includes(s.id))||[];
   const gunClosed=available&&(pose.contact?pose.contact.seated===true:finite(pose.gunOpening)&&pose.gunOpening<=.0001);
   const pressure=gunClosed&&['squeeze','weld','hold','manual-close'].includes(pose.kind);
   const welding=available&&executing&&gunClosed&&pose.energized===true;
   const signals=available?{
    fixtureClosed:finite(pose.clamp)?pose.clamp>=.98:null,
    gunOpen:finite(pose.gunOpening)?pose.gunOpening>=.98:null,
    gunClosed:finite(pose.gunOpening)?gunClosed:null,welding,hold:pose.kind==='hold'&&gunClosed,
    complete:enabled.length>0&&enabled.every(s=>pose.done?.includes(s.id))&&['sync','index','idle'].includes(pose.kind),
    collisionFree:!states.some(s=>s.collisions?.length),limitsOK:!!pose.joints?.length&&!pose.joints.some(j=>j.limited),aligned:pose.contact?.aligned??false,
    current:welding?(finite(pose.contact?.current)?pose.contact.current:this.project.engineering.spotCurrent):0,
    force:pressure?(finite(pose.contact?.force)?pose.contact.force:this.project.engineering.gunForce):0
   }:Object.fromEntries(CONTROLLER_SIGNALS.map(s=>[s.key,null]));
   return {...task,available,phase:available?pose.phase:'无实时信号',kind:available?pose.kind:null,seam:available?pose.seam:null,
    joints:available?copy(pose.joints||[]):[],tcp:available&&Array.isArray(pose.tip)?pose.tip.map(v=>v*1000):null,
    phaseProgress:available?pose.phaseProgress:0,signals,completed:available?enabled.filter(s=>pose.done?.includes(s.id)).length:null,total:enabled.length};
  });
  return {name:this.name,kind:'local-simulator',engine:'网页运动学 / 工艺时间轴',connected:this.connected,motorsOn:this.motorsOn,
   mode:this.mode,execution:this.execution,executing,selectedStation:this.selectedStation,time:this.time,stations,
   faults:copy(this.faults),events:copy(this.events),scope:'本地模拟 · 未连接 ABB 控制器或 RobotStudio 虚拟控制器'};
 }
}

export function stepBoundary(project,time,station='OP10'){
 if(project?.scene!=='biw-line')return time;
 const line=lineSummary(project),current=line.stations.find(s=>s.id===station)||line.stations[0];
 return current.stages.find(s=>s.end>time+1e-6)?.end??line.duration;
}

export function rapidPreview(project,station='OP10'){
 const line=project?.scene==='biw-line'?lineSummary(project):null,plan=line?.stations.find(s=>s.id===station);
 const lines=[{text:'! RAPID 风格工艺顺序预览；不是可执行控制器程序',kind:'comment'},{text:'! 点位 / tooldata / wobjdata / I/O 映射需在实际系统中配置',kind:'comment'},{text:`MODULE ${station}_Preview`,kind:'module'},{text:'  PROC main()',kind:'module'}];
 if(!plan)lines.push({text:'    ! 请切换到白车身点焊流水线',kind:'comment'});
 for(const task of plan?.tasks||[]){
  lines.push({text:`    ! ${task.id} · ${task.name||'电阻点焊'}`,seam:task.id,kind:'comment'});
  for(const stage of task.stages){
   const commands={transfer:`MoveJ p_${task.id}_approach, vTransfer, z10, tGun;`,approach:`MoveL p_${task.id}, vApproach, fine, tGun;`,close:'Set doGunClose;',squeeze:`WaitTime ${stage.duration.toFixed(2)}; ! 加压`,weld:`Set doWeldOn; ! 通电 ${stage.duration.toFixed(2)} s`,hold:`Reset doWeldOn; ! 保压 ${stage.duration.toFixed(2)} s`,open:'Reset doGunClose;',retreat:`MoveL p_${task.id}_retreat, vApproach, z10, tGun;`,wait:`WaitTime ${stage.duration.toFixed(2)};`};
   lines.push({text:`    ${commands[stage.kind]||`! ${stage.label} ${stage.duration.toFixed(2)} s`}`,seam:task.id,phase:stage.kind,start:stage.start,end:stage.end});
  }
 }
 lines.push({text:'  ENDPROC',kind:'module'},{text:'ENDMODULE',kind:'module'});return lines;
}
