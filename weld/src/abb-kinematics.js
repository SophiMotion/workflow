import {stationFrames,physicalTarget,programmedPose,calibratedTCP} from './control-frames.js';
import {Matrix4,Vector3,Quaternion} from 'three';
import {lineMotionAt} from './line-motion.js';
// ROS-Industrial abb_irb6700_support, IRB 6700-235/2.65, commit 45f4769.
// SI units, ROS Z-up. Joint frame offsets and axes are copied from its URDF.
export const ABB_JOINTS=[
 {origin:[0,0,.78],axis:[0,0,1],limits:[-170,170],speed:100},
 {origin:[.32,0,0],axis:[0,1,0],limits:[-65,85],speed:90},
 {origin:[0,0,1.135],axis:[0,1,0],limits:[-180,70],speed:90},
 {origin:[0,0,.2],axis:[1,0,0],limits:[-300,300],speed:170},
 {origin:[1.1825,0,0],axis:[0,1,0],limits:[-130,130],speed:120},
 {origin:[.2,0,0],axis:[1,0,0],limits:[-360,360],speed:190}
];
export const RAD=Math.PI/180,DEG=180/Math.PI;
export const ABB_SOURCE='https://github.com/ros-industrial/abb/tree/45f4769d826cf3ac62a65495f2db67b78b0c81df/abb_irb6700_support';
const V=a=>new Vector3(...a),M=()=>new Matrix4(),RY=a=>M().makeRotationY(a),RX=a=>M().makeRotationX(a),RZ=a=>M().makeRotationZ(a);
export function mountMatrix(station){
 const matrix=M().makeBasis(V([0,0,-1]),V([-1,0,0]),V([0,1,0]));
 // Each cell has its own installed base; OP30 is shifted toward the rear targets.
 matrix.setPosition(station==='OP30'?.6:station==='OP10'?-.3:0,.32,2.85);return matrix;
}
export function forward(q,mount=M()){
 let frame=mount.clone();const frames=[frame.clone()];
 ABB_JOINTS.forEach((joint,i)=>{frame=frame.clone().multiply(M().makeTranslation(...joint.origin)).multiply(M().makeRotationAxis(V(joint.axis),q[i]));frames.push(frame);});
 return {frames,flange:frame,tool:frame.clone().multiply(RY(Math.PI/2))};
}
export function jointDiagnostics(q){return q.map((angle,i)=>{const j=ABB_JOINTS[i],degrees=angle*DEG,margin=Math.min(degrees-j.limits[0],j.limits[1]-degrees);return {axis:'J'+(i+1),degrees,min:j.limits[0],max:j.limits[1],speedLimit:j.speed,margin,limited:margin<-.00001,near:margin<5};});}
function equivalents(angle,j,seed){const [lo,hi]=j.limits.map(x=>x*RAD),out=[];for(let n=-2;n<=2;n++){const q=angle+n*2*Math.PI;if(q>=lo-1e-8&&q<=hi+1e-8)out.push(q);}return out.sort((a,b)=>Math.abs(a-seed)-Math.abs(b-seed))[0];}
// Exact spherical-wrist inverse kinematics; enumerate elbow, shoulder and wrist branches.
export function inverse(desired,mount=M(),seed=[0,0,0,0,Math.PI/2,0]){
 const target=mount.clone().invert().multiply(desired),p=V([-.2,0,0]).applyMatrix4(target),rotation=M().extractRotation(target),candidates=[];
 const radius=Math.hypot(p.x,p.y),D=Math.hypot(1.1825,.2),beta=Math.atan2(1.1825,.2),L=1.135;
 for(const back of [false,true]){
  const q1=Math.atan2(p.y,p.x)+(back?Math.PI:0),r=(back?-radius:radius)-.32,z=p.z-.78,c=(r*r+z*z-L*L-D*D)/(2*L*D);
  if(Math.abs(c)>1+1e-9)continue;
  for(const elbow of [-1,1]){
   const phi=elbow*Math.acos(Math.max(-1,Math.min(1,c))),q3=phi-beta,q2=Math.atan2(r,z)-Math.atan2(D*Math.sin(phi),L+D*Math.cos(phi));
   const rem=RZ(q1).multiply(RY(q2+q3)).invert().multiply(rotation),e=rem.elements,b=Math.acos(Math.max(-1,Math.min(1,e[0])));
   const wrists=Math.abs(Math.sin(b))<1e-8?[[seed[3],b,Math.atan2(e[6],e[5])-seed[3]]]:[[Math.atan2(e[1],-e[2]),b,Math.atan2(e[4],e[8])],[Math.atan2(-e[1],e[2]),-b,Math.atan2(-e[4],-e[8])]];
   for(const wrist of wrists){const q=[q1,q2,q3,...wrist].map((a,i)=>equivalents(a,ABB_JOINTS[i],seed[i]));if(q.some(x=>x===undefined))continue;const fk=forward(q).flange,posError=new Vector3().setFromMatrixPosition(fk).distanceTo(new Vector3().setFromMatrixPosition(target));const angleError=new Quaternion().setFromRotationMatrix(fk).angleTo(new Quaternion().setFromRotationMatrix(rotation));if(posError<1e-6&&angleError<1e-5)candidates.push({q,posError,angleError,score:q.reduce((n,a,i)=>n+(a-seed[i])**2*(i<3?2:1),0)});}
  }
 }
 candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;
}
export function desiredFlange(pose,frames){
 if(frames)pose=physicalTarget(pose,frames);
 const x=pose.tangent.clone(),z=pose.normal.clone().negate(),y=z.clone().cross(x).normalize();
 return M().makeBasis(x,y,z).multiply(RY(-Math.PI/2)).setPosition(pose.root.clone().addScaledVector(x,.28).addScaledVector(pose.normal,.48));
}
export function actualTool(q,mount){const fk=forward(q,mount),e=fk.tool.elements,tangent=V(e.slice(0,3)),normal=V(e.slice(8,11)).negate(),wrist=new Vector3().setFromMatrixPosition(fk.flange),root=wrist.clone().addScaledVector(tangent,-.28).addScaledVector(normal,-.48);return {...fk,tangent,normal,wrist,root,tip:root.clone(),shoulder:new Vector3().setFromMatrixPosition(fk.frames[2]),elbow:new Vector3().setFromMatrixPosition(fk.frames[4])};}
export class ABBTrajectory {
 constructor(project,line){this.project=project;this.line=line;this.plans=new Map();
  for(const st of line.stations){const mount=mountMatrix(st.id),home=inverse(desiredFlange(lineMotionAt(0,st,project,line),stationFrames(project,st.id)),mount)?.q||[0,0,0,0,0,0];let seed=home;const segments=[];
   for(const stage of (st.stages.length?st.stages:[{start:0,end:1,duration:1,kind:'idle'}])){const start=[...seed],goal=inverse(desiredFlange(lineMotionAt(Math.max(stage.start,stage.end-1e-7),st,project,line),stationFrames(project,st.id)),mount,seed),end=stage.kind==='home'?home:(goal?.q||seed),joint=['transfer','home'].includes(stage.kind)&&!(project.bodyModel==='zeekr-001'&&stage.kind==='home'),samples=[];
    const count=Math.max(1,Math.ceil(stage.duration/.04));for(let i=0;i<=count;i++){const f=i/count,u=f*f*(3-2*f),t=stage.start+stage.duration*f,raw=lineMotionAt(Math.min(t,stage.end-1e-8),st,project,line);if(joint)seed=start.map((a,j)=>a+(end[j]-a)*u);else seed=inverse(desiredFlange(raw,stationFrames(this.project,st.id)),mount,seed)?.q||seed;samples.push([...seed]);}segments.push({stage,start,end,joint,samples,goalValid:!!goal});
   }this.plans.set(st.id,segments);
  }
 }
 pose(time,st){const raw=lineMotionAt(time,st,this.project,this.line),segments=this.plans.get(st.id),seg=segments.find(s=>time>=s.stage.start&&time<s.stage.end)||segments.at(-1),mount=mountMatrix(st.id);if(!seg)return {...raw,joints:[],q:[]};
  const f=Math.max(0,Math.min(1,(time-seg.stage.start)/seg.stage.duration)),u=f*f*(3-2*f),seed=seg.samples[Math.min(seg.samples.length-1,Math.floor(f*(seg.samples.length-1)))],ik=inverse(desiredFlange(raw,stationFrames(this.project,st.id)),mount,seed),q=seg.joint?seg.start.map((a,j)=>a+(seg.end[j]-a)*u):(ik?.q||seed),actual=actualTool(q,mount),tcp=calibratedTCP(actual,stationFrames(this.project,st.id)),target=programmedPose(raw,stationFrames(this.project,st.id)),joints=jointDiagnostics(q);
  const before=Math.max(seg.stage.start,time-.005),after=Math.min(seg.stage.end-1e-8,time+.005),previous=inverse(desiredFlange(lineMotionAt(before,st,this.project,this.line),stationFrames(this.project,st.id)),mount,q),next=inverse(desiredFlange(lineMotionAt(after,st,this.project,this.line),stationFrames(this.project,st.id)),mount,q);
  joints.forEach((j,i)=>{j.velocity=seg.joint?Math.abs(seg.end[i]-seg.start[i])*6*f*(1-f)/seg.stage.duration*DEG:previous&&next&&after>before?Math.abs(next.q[i]-previous.q[i])*DEG/(after-before):0;j.speedExceeded=j.velocity>j.speedLimit+.1;});
  return {...raw,...actual,tip:tcp.root,tcpNormal:tcp.normal,tcpTangent:tcp.tangent,q,joints,reachable:seg.joint?seg.goalValid:!!ik,positionError:seg.joint?0:tcp.root.distanceTo(target.root)*1000,orientationError:seg.joint?0:ik?ik.angleError*DEG:null,energized:raw.energized&&!!ik,motionType:seg.joint?'MoveJ':'MoveL',singular:Math.abs(Math.sin(q[4]))<Math.sin(3*RAD),desiredRoot:target.root,model:'abb-irb6700'};
 }
}
