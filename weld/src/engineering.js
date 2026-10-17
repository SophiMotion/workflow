import {isLine,LINE_STATIONS,selectedStation} from './line-data.js';
// Explicit timing assumptions, not controller-derived cycle times.
// These inputs are estimates, not controller-derived cycle times.
export const ENGINEERING_DEFAULTS={targetJph:60,availability:100,loadTime:6,clampTime:2,unloadTime:4,transfer:2,approach:.8,retreat:.8,interlock:.2,dressTime:12,dressEvery:50,approachDistance:80,clearance:5,toolMass:80,adapterMass:8,payloadLimit:120,cogX:100,cogY:0,cogZ:250,inertia:.8,tcpX:0,tcpY:0,tcpZ:300,gunStroke:80,gunForce:3,spotCurrent:8,spotClose:.25,spotSqueeze:.15,spotWeld:.25,spotHold:.15,spotOpen:.25,laserPower:2000,laserSpeed:30,focalOffset:0,gunType:'c'};
export const ENGINEERING_LIMITS={targetJph:[1,600],availability:[1,100],loadTime:[0,120],clampTime:[0,30],unloadTime:[0,120],transfer:[.2,30],approach:[.1,10],retreat:[.1,10],interlock:[0,10],dressTime:[0,120],dressEvery:[1,1000],approachDistance:[30,120],clearance:[0,30],toolMass:[1,500],adapterMass:[0,100],payloadLimit:[1,1000],cogX:[-2000,2000],cogY:[-2000,2000],cogZ:[-2000,2000],inertia:[0,100],tcpX:[-2000,2000],tcpY:[-2000,2000],tcpZ:[-2000,2000],gunStroke:[10,250],gunForce:[.5,15],spotCurrent:[1,40],spotClose:[.05,5],spotSqueeze:[.05,5],spotWeld:[.05,3],spotHold:[.05,5],spotOpen:[.05,5],laserPower:[100,12000],laserSpeed:[1,200],focalOffset:[-10,10]};
export const phaseNames={load:'上件',clamp:'夹紧',transfer:'空行程',approach:'接近',preflow:'预送气',close:'闭枪',squeeze:'加压稳定',weld:'焊接',hold:'保压',open:'开枪',postflow:'后送气',retreat:'撤离',wait:'互锁等待',cooling:'道间等待',unload:'松夹 / 下件'};
export const phaseColors={load:'#a7b1bf',clamp:'#a7b1bf',transfer:'#8ca1ba',approach:'#6b8ab4',preflow:'#6ca7aa',close:'#a897c4',squeeze:'#947fba',weld:'#315cbd',hold:'#ab8bcb',open:'#c1b5d7',postflow:'#6ca7aa',retreat:'#6b8ab4',wait:'#c9b792',cooling:'#b9cbd5',unload:'#a7b1bf'};
export const outcomeNames={nominal:'均匀成形',under:'热输入不足',over:'过热 / 飞溅'};
export const isSpot=p=>p.process==='spot';
export const isLaser=p=>p.process==='laser';
export const isArc=p=>!isSpot(p)&&!isLaser(p);
Object.assign(ENGINEERING_DEFAULTS,{lineIndex:4,lineRelease:1.2,lineTransfer1:2,lineTransfer2:2.7,lineTransfer3:1.8});
Object.assign(ENGINEERING_LIMITS,{lineIndex:[1,30],lineRelease:[.1,10],lineTransfer1:[.5,15],lineTransfer2:[.5,15],lineTransfer3:[.5,15]});
Object.assign(phaseNames,{home:'回待机位',release:'松夹',sync:'等待其他工位',index:'统一移载'});
Object.assign(phaseColors,{home:'#8299b5',release:'#a7b1bf',sync:'#d7dde4',index:'#399788'});
export function energyValue(p){if(isSpot(p))return {value:p.engineering.spotCurrent,unit:'kA',label:'点焊电流',note:'单点通电时间独立设置；不使用弧焊线能量公式。'};if(isLaser(p))return {value:p.engineering.laserPower/p.engineering.laserSpeed/1000,unit:'kJ/mm',label:'入射线能量',note:'P / v；尚未计入材料吸收率。'};return {value:p.params.efficiency*p.params.voltage*p.params.current/p.params.speed/1000,unit:'kJ/mm',label:'有效线能量',note:'η × U × I / v / 1000'};}

export function singleCycleSummary(p){
 const ids=p.seams.map(s=>s.id).sort(),e={...ENGINEERING_DEFAULTS,...p.engineering},spot=isSpot(p),order=p.strategy==='balanced'?[ids[0],ids[1],ids[3],ids[2]]:p.strategy==='reverse'?[...ids].reverse():ids;
 const enabled=order.map(id=>p.seams.find(s=>s.id===id)).filter(s=>s?.enabled),stages=[],tasks=[];let t=0;
 const add=(kind,duration,id=null,previousId=null)=>{if(!duration)return null;const stage={kind,label:kind==='weld'?(spot?'通电':isLaser(p)?'激光扫描':'弧焊'):phaseNames[kind],duration,start:t,end:t+duration,id,previousId};stages.push(stage);t+=duration;return stage;};
 if(enabled.length){add('load',e.loadTime);add('clamp',e.clampTime);}
 enabled.forEach((s,i)=>{
  const begin=stages.length,previousId=enabled[i-1]?.id||null;
  const phase=(kind,duration)=>add(kind,duration,s.id,previousId);
  phase('transfer',e.transfer);phase('approach',e.approach);
  if(spot){phase('close',e.spotClose);phase('squeeze',e.spotSqueeze);}else phase('preflow',p.params.preflow);
  const duration=spot?e.spotWeld:s.length/(isLaser(p)?e.laserSpeed:p.params.speed),weld=phase('weld',duration);
  if(spot){phase('hold',e.spotHold);phase('open',e.spotOpen);}else phase('postflow',p.params.postflow);
  phase('retreat',e.retreat);phase('wait',e.interlock);
  if(i<enabled.length-1&&isArc(p))phase('cooling',p.params.cooling);
  tasks.push({...s,start:weld.start,end:weld.end,duration,stages:stages.slice(begin)});
 });
 if(enabled.length)add('unload',e.unloadTime);
 const maintenance=enabled.length?e.dressTime/e.dressEvery:0,average=t+maintenance,target=3600/e.targetJph,budget=target*e.availability/100;
 return {tasks,stages,station:t,maintenance,average,target,budget,capacity:average?3600/average*e.availability/100:0,observation:enabled.length?p.params.coolDuration:0,duration:enabled.length?t+p.params.coolDuration:0,margin:budget-average,totals:stages.reduce((a,s)=>({...a,[s.kind]:(a[s.kind]||0)+s.duration}),{})};
}

export function lineSummary(p){
 const e={...ENGINEERING_DEFAULTS,...p.engineering};
 const stations=LINE_STATIONS.map(st=>{
  const local={...p,seams:p.seams.filter(s=>st.ids.includes(s.id)),engineering:{...e,loadTime:0,unloadTime:0,transfer:e[st.transferKey]}};
  const c=singleCycleSummary(local),stages=[...c.stages];let end=c.station;
  const add=(kind,d)=>{stages.push({kind,label:phaseNames[kind],start:end,end:end+d,duration:d,id:null});end+=d;};
  if(c.tasks.length){add('home',e[st.transferKey]);add('release',e.lineRelease);}
  return {...st,tasks:c.tasks,stages,work:end,maintenance:c.maintenance};
 });
 const active=stations.filter(s=>s.tasks.length),bottleneck=active.reduce((a,b)=>!a||b.work>a.work?b:a,null),work=bottleneck?.work||0;
 const index=active.length?e.lineIndex:0,station=work+index,maintenance=Math.max(0,...stations.map(s=>s.maintenance));
 for(const s of stations){
  s.idle=work-s.work;
  if(s.idle>0)s.stages.push({kind:'sync',label:phaseNames.sync,start:s.work,end:work,duration:s.idle,id:null});
  if(index)s.stages.push({kind:'index',label:phaseNames.index,start:work,end:station,duration:index,id:null});
 }
 const average=station+maintenance,target=3600/e.targetJph,budget=target*e.availability/100;
 return {stations,bottleneck:bottleneck?.id||null,work,index,station,maintenance,average,target,budget,capacity:average?3600/average*e.availability/100:0,margin:budget-average,observation:0,duration:station,taskCount:active.reduce((n,s)=>n+s.tasks.length,0),residence:station*3};
}

export function cycleSummary(p){
 if(!isLine(p))return singleCycleSummary(p);
 const line=lineSummary(p),s=line.stations.find(x=>x.id===selectedStation(p).id);
 return {...line,tasks:s.tasks,stages:s.stages,selectedStation:s.id,totals:s.stages.reduce((a,x)=>({...a,[x.kind]:(a[x.kind]||0)+x.duration}),{})};
}
