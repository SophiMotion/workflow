import {samplePath,advancePlayback} from './route-math.mjs';
// Kinematic traffic control in metres. No tyre/friction or rigid-body solver.
const BRAKE=4,ACCEL=1.8,CLEARANCE=.28;
export function footprint(pose,size={width:1,length:1},margin=0){
 const y=pose.yaw*Math.PI/180;return {x:pose.position[0],z:pose.position[2],u:[Math.cos(y),-Math.sin(y)],v:[Math.sin(y),Math.cos(y)],w:size.width/2+margin,l:size.length/2+margin};
}
export function overlaps(a,b){
 const dx=b.x-a.x,dz=b.z-a.z;
 for(const n of [a.u,a.v,b.u,b.v]){const extent=q=>q.w*Math.abs(q.u[0]*n[0]+q.u[1]*n[1])+q.l*Math.abs(q.v[0]*n[0]+q.v[1]*n[1]);if(Math.abs(dx*n[0]+dz*n[1])>=extent(a)+extent(b))return false;}return true;
}
// Cache segment lengths; binary search keeps dense proving profiles inexpensive.
const cache=new WeakMap();
function fastSample(p,d){let c=cache.get(p);if(!c){const lengths=[0];for(let i=1;i<p.length;i++)lengths.push(lengths.at(-1)+Math.hypot(...p[i].map((v,k)=>v-p[i-1][k])));c=lengths;cache.set(p,c);}d=Math.max(0,Math.min(d,c.at(-1)));let lo=1,hi=p.length-1;while(lo<hi){const m=(lo+hi)>>1;if(c[m]<d)lo=m+1;else hi=m;}const a=p[lo-1],b=p[lo],f=(d-c[lo-1])/(c[lo]-c[lo-1]||1);return {position:a.map((v,k)=>v+(b[k]-v)*f),yaw:Math.atan2(a[0]-b[0],a[2]-b[2])*180/Math.PI};}
const point=(e,travel=0)=>{const d=e.drive;if(!d)return e.pose;return fastSample(d.samples,advancePlayback(d.distance,1,travel,d.length,d.route.loop).distance);};
const body=(e,travel=0,margin=0)=>footprint(point(e,travel),e.size,margin);
export function trafficOverlaps(entries,margin=0){const pairs=[];for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(overlaps(body(entries[i],0,margin),body(entries[j],0,margin)))pairs.push([entries[i].id,entries[j].id]);return pairs;}
export class TrafficController{
 constructor(){this.reservations=new Map();this.interventions=0;this.elapsed=0;}
 reset(){this.reservations.clear();}
 tick(entries,dt){
  // Bounded substeps plus swept checks prevent low-frame-rate tunnelling.
  let remaining=Math.max(0,Math.min(dt,.5));while(remaining>1e-7){const h=Math.min(remaining,.025);this.step(entries,h);remaining-=h;this.elapsed+=h;}
 }
 step(entries,h){
  const speed=e=>e.drive?.playing?e.drive.route.speed:0;
  const wanted=new Map(entries.map(e=>[e.id,speed(e)]));
  for(const e of entries)if(e.drive)e.drive.yielding=false;
  // Scan each vehicle's braking corridor against current occupied footprints.
  for(const a of entries){if(!speed(a))continue;const current=a.drive.actualSpeed||0,reach=Math.max(3,current*current/(2*BRAKE)+current*.65+1),occupied=entries.filter(b=>b!==a).map(b=>body(b,0,CLEARANCE/2));
   for(let s=.12;s<=reach;s+=.18){if(occupied.some(b=>overlaps(body(a,s,CLEARANCE/2),b))){wanted.set(a.id,Math.min(wanted.get(a.id),Math.sqrt(2*BRAKE*Math.max(0,s-.5))));break;}}
  }
  // Predict crossing conflicts and keep one stable right of way until paths clear.
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const a=entries[i],b=entries[j],va=speed(a),vb=speed(b),key=[a.id,b.id].sort().join('|');if(!va||!vb)continue;const aNow=point(a).position,bNow=point(b).position;if(Math.hypot(aNow[0]-bNow[0],aNow[2]-bNow[2])>(va+vb)*3+a.size.length+b.size.length){this.reservations.delete(key);continue;}
   let conflict=null;for(let t=.2;t<=3;t+=.2){if(overlaps(body(a,va*t,CLEARANCE),body(b,vb*t,CLEARANCE))){conflict=t;break;}}
   if(conflict===null){this.reservations.delete(key);continue;}
   let winner=this.reservations.get(key);
   const pa=point(a),pb=point(b),dx=pb.position[0]-pa.position[0],dz=pb.position[2]-pa.position[2],yaw=pa.yaw*Math.PI/180;
   if(Math.cos((pa.yaw-pb.yaw)*Math.PI/180)>.85){winner=(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)>0?b.id:a.id;}
   if(!winner){winner=a.id.localeCompare(b.id)<0?a.id:b.id;this.reservations.set(key,winner);}
   const loser=winner===a.id?b:a;wanted.set(loser.id,0);loser.drive.yielding=true;
  }
  const moves=new Map();for(const e of entries){const d=e.drive;if(!d)continue;const target=wanted.get(e.id),old=d.actualSpeed||0;d.actualSpeed=target>old?Math.min(target,old+ACCEL*h):Math.max(target,old-BRAKE*h);if(!d.playing)d.actualSpeed=0;d.yielding ||= d.playing&&target<d.route.speed-.05;moves.set(e.id,d.actualSpeed*h);}
  // Final swept OBB guard includes paused vehicles. A user can place overlapping
  // objects manually; those remain stopped and are reported, never silently moved.
  for(let pass=0;pass<2;pass++)for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const a=entries[i],b=entries[j],da=moves.get(a.id)||0,db=moves.get(b.id)||0;if(!da&&!db)continue;
   const steps=Math.max(1,Math.ceil(Math.max(da,db)/.05));let hit=false;for(let k=1;k<=steps;k++)if(overlaps(body(a,da*k/steps,.08),body(b,db*k/steps,.08))){hit=true;break;}
   if(hit){for(const e of [a,b])if(e.drive&&moves.get(e.id)){moves.set(e.id,0);e.drive.actualSpeed=0;e.drive.yielding=true;}this.interventions++;}
  }
  for(const e of entries){const d=e.drive;if(!d?.playing)continue;const before=d.distance,travel=moves.get(e.id)||0,next=advancePlayback(d.distance,1,travel,d.length,d.route.loop);d.distance=next.distance;d.travel=(d.travel??before)+(d.route.loop?travel:next.distance-before);if(next.finished){d.playing=false;d.actualSpeed=0;}}
 }
}
