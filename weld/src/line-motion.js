import {Vector3,Box3} from 'three';
import {BIW_POINTS,bodyPoints,LINE_PITCH} from './line-data.js';
const V=a=>new Vector3(...a),N=new Vector3(0,0,1),UP=new Vector3(0,1,0);
const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const LINE_SHOULDER=[0,1.15,2.65],LINE_HOME=[0,2.05,1.75];
export const ARM_LENGTHS=[1.35,1.5];

function solve(root,tangent){
 const normal=N.clone(),wrist=root.clone().addScaledVector(tangent,.28).addScaledVector(normal,.48),shoulder=V(LINE_SHOULDER),d=wrist.clone().sub(shoulder),distance=d.length(),[l1,l2]=ARM_LENGTHS;
 const reachable=distance<l1+l2&&distance>Math.abs(l1-l2);d.normalize();
 const bend=UP.clone().addScaledVector(d,-UP.dot(d)).normalize(),a=(l1*l1-l2*l2+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,l1*l1-a*a));
 const elbow=shoulder.clone().addScaledVector(d,a).addScaledVector(bend,h);
 return {root,normal,tangent,wrist,shoulder,elbow,tip:root.clone(),reachable};
}
function target(id,away=0,clearanceScale=1,points=BIW_POINTS){const point=points[id];return {root:V(point.p).addScaledVector(V(point.t),away).addScaledVector(N,Math.max(0,away-.12)*clearanceScale),tangent:V(point.t)};}
function home(){return {root:V(LINE_HOME),tangent:UP.clone()};}
const mix=(a,b,f)=>({root:a.root.clone().lerp(b.root,f),tangent:a.tangent.clone().lerp(b.tangent,f).normalize()});

export function lineMotionAt(time,station,p,line){
 const pointTarget=(id,away)=>target(id,away,p.robotModel==='abb-irb6700'?2.2:1,bodyPoints(p));
 const e=p.engineering,stages=station.stages,stage=stages.find(s=>time>=s.start&&time<s.end)||stages.at(-1);
 const distance=e.approachDistance/1000+.20; // approach allowance plus gun clearance
 const f=stage?clamp((time-stage.start)/stage.duration):0,u=smooth(f),kind=stage?.kind||'idle';
 let point=home(),id=stage?.id||null,opening=1;
 if(id){
  const task=station.tasks.find(t=>t.id===id),previous=station.tasks[station.tasks.indexOf(task)-1];
  if(kind==='transfer')point=mix(previous?pointTarget(previous.id,distance):home(),pointTarget(id,distance),u);
  else if(kind==='approach')point=pointTarget(id,distance*(1-u));
  else if(kind==='retreat')point=pointTarget(id,distance*u);
  else if(kind==='wait')point=pointTarget(id,distance);
  else point=pointTarget(id);
  opening=kind==='close'?1-u:kind==='open'?u:['squeeze','weld','hold'].includes(kind)?0:1;
 }else if(kind==='home'&&station.tasks.length)point=mix(pointTarget(station.tasks.at(-1).id,distance),home(),u);
 let fixture=0;
 if(kind==='clamp')fixture=u;
 else if(kind==='release')fixture=1-u;
 else if(!['index','sync','idle'].includes(kind))fixture=1;
 const indexFraction=line.index?clamp((time-line.work)/line.index):0;
 return {...solve(point.root,point.tangent),process:'spot',id,station:station.id,phase:stage?.label||'待机',kind,phaseProgress:f,phaseElapsed:stage?Math.max(0,Math.min(stage.duration,time-stage.start)):0,phaseDuration:stage?.duration||0,energized:kind==='weld',arc:false,gas:false,gunOpening:opening,clamp:fixture,carOffset:smooth(indexFraction)*LINE_PITCH,done:station.tasks.filter(t=>time>=t.end).map(t=>t.id),progress:id?clamp((time-station.tasks.find(t=>t.id===id).start)/station.tasks.find(t=>t.id===id).duration):0};
}

// The same main panels are rendered by biw-scene.js. Small ribs, dress pack,
// moving clamp sweep and robot self-collision are outside this proxy check.
export const BIW_PANELS=[
 {name:'地板',size:[3.7,.045,1.65],p:[0,1.0,0]},
 {name:'前舱底板',size:[.6,.045,1.5],p:[-2.0,1.12,0]},
 {name:'后舱底板',size:[.6,.045,1.5],p:[2.0,1.12,0]},
 ...[-1,1].flatMap(side=>[
  {name:'门槛梁',size:[3.35,.14,.12],p:[0,1.04,side*.86]},
  {name:'门槛焊接翻边',size:[3.35,.10,.025],p:[0,1.10,side*.9125]},
  {name:'顶边梁',size:[1.9,.09,.11],p:[0,2.245,side*.73]},
  {name:'顶边翻边',size:[1.9,.10,.025],p:[0,2.26,side*.7725]},
  {name:'前舱侧梁',size:[.9,.12,.10],p:[-1.6,1.46,side*.7425]},
  {name:'前舱翻边',size:[.9,.10,.025],p:[-1.6,1.49,side*.7925]},
  {name:'后舱侧梁',size:[.9,.12,.10],p:[1.65,1.46,side*.7425]},
  {name:'后舱翻边',size:[.9,.10,.025],p:[1.65,1.49,side*.7925]}
 ])
];
const boxes=BIW_PANELS.map(s=>({name:s.name,box:new Box3().setFromCenterAndSize(V(s.p),V(s.size))}));
export function lineCheck(pose,threshold=5){
 const links=[['上臂',pose.shoulder,pose.elbow,.15],['前臂',pose.elbow,pose.wrist,.11],['腕部',pose.wrist,pose.wrist,.13]];
 const back=pose.root.clone().addScaledVector(pose.tangent,.28);
 links.push(['枪背架',back.clone().addScaledVector(N,-.065),back.clone().addScaledVector(N,.36),.035]);
 const hits=[],near=[];let minimum=Infinity;
 for(const [link,a,b,radius] of links)for(const ob of boxes){
  let gap=Infinity;const n=Math.max(2,Math.ceil(a.distanceTo(b)/.025));
  for(let i=0;i<=n;i++){const q=a.clone().lerp(b,i/n);gap=Math.min(gap,(q.distanceTo(ob.box.clampPoint(q,new Vector3()))-radius)*1000);}
  minimum=Math.min(minimum,gap);if(gap<0)hits.push({link,obstacle:ob.name});else if(gap<threshold)near.push({link,obstacle:ob.name,gap});
 }
 return {hits,near,minimum};
}
