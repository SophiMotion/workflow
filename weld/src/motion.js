import {isSpot,isLaser,isArc,ENGINEERING_DEFAULTS} from './engineering.js';
import {Vector3,Box3} from 'three';
const v=a=>new Vector3(...a),up=new Vector3(0,1,0);
export const SEAMS={
 W01:{a:[.27,1.166,.333],b:[1.07,1.166,.333],normal:[0,.8,.6]},
 W02:{a:[1.07,1.166,.222],b:[.27,1.166,.222],normal:[0,.8,-.6]},
 W03:{a:[.08,1.166,.80],b:[.08,1.166,.42],normal:[-.6,.8,0]},
 W04:{a:[1.275,1.166,.42],b:[1.275,1.166,.80],normal:[.6,.8,0]}
};
export const SPOTS={W01:[.32,1.82,.36],W02:[.98,1.82,.36],W03:[.32,1.82,.58],W04:[.98,1.82,.58]};
export const spotPoint=id=>v(SPOTS[id]);
export const SHOULDER=[-1.65,1.14,-.85],L1=2.1,L2=2.25;
export function seamPoint(id,u,p){if(isSpot(p))return spotPoint(id);const s=SEAMS[id],pos=v(s.a).lerp(v(s.b),u);const tangent=v(s.b).sub(v(s.a)).normalize();const across=v(s.normal);across.y=0;across.normalize();const amp=isLaser(p)||p.weave==='straight'?0:p.weave==='zigzag'?.010:.012;pos.addScaledVector(across,(1+Math.sin(u*Math.PI*36))*.5*amp);if(p.weave==='circle')pos.addScaledVector(tangent,Math.cos(u*Math.PI*36)*.006);return pos;}
export function solvePose(root,normal,p){const n=normal.clone().normalize(),tip=root.clone().addScaledVector(n,.009);const nozzle=root.clone().addScaledVector(n,p.params.torchDistance/250);const neck=root.clone().addScaledVector(n,.42);const wrist=root.clone().addScaledVector(n,1.16);const shoulder=v(SHOULDER),d=wrist.clone().sub(shoulder),dist=d.length(),reachable=dist<L1+L2&&dist>Math.abs(L1-L2);d.normalize();const bend=up.clone().addScaledVector(d,-up.dot(d)).normalize();const x=(L1*L1-L2*L2+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,L1*L1-x*x));const elbow=shoulder.clone().addScaledVector(d,x).addScaledVector(bend,h);return {root,normal:n,tip,nozzle,neck,wrist,elbow,shoulder,reachable};}
export function robotPose(id,u,p,lift=0){if(isSpot(p)){const root=spotPoint(id);root.z+=(root.z<.4?-1:1)*.8*Math.min(1,lift/.2);root.y+=Math.max(0,lift-.2);return solvePose(root,up,p);}const root=seamPoint(id,u,p);root.y+=lift;const clearance=v(SEAMS[id].normal);clearance.y=0;root.addScaledVector(clearance.normalize(),.18*Math.min(1,lift/.45));const n=(isSpot(p)?up.clone():v(SEAMS[id].normal)).lerp(up,Math.min(1,lift/.65)).normalize();return solvePose(root,n,p);}
export function motionAt(time,plan,p){
 const e={...ENGINEERING_DEFAULTS,...p.engineering},lift=.9*e.approachDistance/80,spot=isSpot(p);
 const idle=(id,phase)=>({...robotPose(id,spot?0:1,p,lift),arc:false,energized:false,gas:false,phase,id,progress:1,process:p.process,gunOpening:1});
 if(!plan.length)return {...idle('W01','待机'),id:null,progress:0};
 const stages=plan.flatMap(s=>s.stages||[]),stage=stages.find(s=>time>=s.start&&time<s.end);
 if(!stage){if(time<stages[0].start)return {...idle(plan[0].id,time<e.loadTime?'上件':'夹紧'),...robotPose(plan[0].id,0,p,lift),progress:0};return idle(plan.at(-1).id,time<stages.at(-1).end+e.unloadTime?'松夹 / 下件':'焊后冷却观察');}
 const task=plan.find(s=>s.id===stage.id),f=Math.max(0,Math.min(1,(time-stage.start)/stage.duration)),u=spot?0:Math.max(0,Math.min(1,(time-task.start)/task.duration));let pose;
 if(stage.kind==='transfer'){
  const a=robotPose(stage.previousId||stage.id,spot?0:stage.previousId?1:0,p,lift),b=robotPose(stage.id,0,p,lift);
  pose=solvePose(a.root.clone().lerp(b.root,f),a.normal.clone().lerp(b.normal,f).normalize(),p);
 }else if(stage.kind==='approach')pose=robotPose(stage.id,0,p,lift*(1-f));
 else if(stage.kind==='retreat')pose=robotPose(stage.id,spot?0:1,p,lift*f);
 else if(['wait','cooling'].includes(stage.kind))pose=robotPose(stage.id,spot?0:1,p,lift);
 else pose=robotPose(stage.id,u,p);
 const energized=stage.kind==='weld';
 return {...pose,id:stage.id,process:p.process,progress:u,phase:stage.label,arc:energized&&isArc(p),energized,gas:!spot&&['weld','preflow','postflow'].includes(stage.kind),gunOpening:stage.kind==='close'?1-f:stage.kind==='open'?f:['squeeze','weld','hold'].includes(stage.kind)?0:1};
}
// Conservative capsule/box overlap: proxy clearance only, not industrial collision certification.
export const obstacles=[
 ['底板',[-.02,1.0825,.05],[1.42,1.1575,.95]],['立板',[.01,1.145,.2475],[1.39,1.795,.3125]],
 ['左筋板',[.092,1.15,.33],[.16,1.76,.92]],['右筋板',[1.182,1.15,.33],[1.25,1.76,.92]],
 ['工作台',[-.375,.78,-.25],[1.775,1.05,1.25]],
 ...[[-.13,.05],[1.5,.05],[-.13,1.02],[1.5,1.02]].map(([x,z],i)=>['夹具'+i,[x-.09,1.05,z-.115],[x+.20,1.47,z+.115]])
].map(([name,a,b])=>({name,box:new Box3(v(a),v(b))}));
export function collisionReport(pose){return envelopeReport(pose).hits;}
export function envelopeReport(pose,threshold=0){const hits=[],near=[];let minimum=Infinity;const links=[['上臂',pose.shoulder,pose.elbow,.18],['肘部',pose.elbow,pose.elbow,.29],['前臂',pose.elbow,pose.wrist,.12],['腕部',pose.wrist,pose.wrist,.19],['枪体',pose.wrist,pose.neck,[.10,.075]],['枪颈',pose.neck,pose.nozzle,[.035,.028]],['喷嘴',pose.nozzle.clone().addScaledVector(pose.normal,-.013),pose.nozzle.clone().addScaledVector(pose.normal,.107),[.022,.028]]];if(pose.process==='spot'){links.splice(5);const side=['W03','W04'].includes(pose.id)?1:-1,offset=new Vector3(0,0,.42*side),root=pose.root;links.push(['点焊枪背架',root.clone().add(offset).add(new Vector3(0,-.15,0)),root.clone().add(offset).add(new Vector3(0,.45,0)),.047],['下枪臂',root.clone().add(new Vector3(0,-.14,0)),root.clone().add(offset).add(new Vector3(0,-.14,0)),.038],['上枪臂',root.clone().add(new Vector3(0,.40,0)),root.clone().add(offset).add(new Vector3(0,.40,0)),.038]);}for(const [name,a,b,r] of links){
 const n=Math.max(2,Math.ceil(a.distanceTo(b)/.018));
 for(const ob of (pose.process==='spot'?spotObstacles:obstacles)){
  let gap=Infinity;
  for(let i=0;i<=n;i++){
   const point=a.clone().lerp(b,i/n),closest=ob.box.clampPoint(point,new Vector3());
   const radius=Array.isArray(r)?r[0]+(r[1]-r[0])*i/n:r;
   gap=Math.min(gap,(point.distanceTo(closest)-radius)*250);
  }
  minimum=Math.min(minimum,gap);
  if(gap<0)hits.push({link:name,obstacle:ob.name});
  else if(gap<threshold)near.push({link:name,obstacle:ob.name,gap});
 }
}
return {hits,near,minimum};}

const spotObstacles=[...obstacles.filter(o=>!['底板','立板','左筋板','右筋板'].includes(o.name)),{name:'搭接板',box:new Box3(v([-.02,1.745,.02]),v([1.42,1.80,.9]))}];
