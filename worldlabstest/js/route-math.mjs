// Pure distance-based route sampling, in meters; no simulation-engine assumptions.
const segmentLength=(a,b)=>Math.hypot(...b.map((v,i)=>v-a[i]));
export function pathLength(points){let sum=0;for(let i=1;i<points.length;i++)sum+=segmentLength(points[i-1],points[i]);return sum;}
export function samplePath(points,distance){
 let left=Math.max(0,Math.min(Number.isFinite(distance)?distance:0,pathLength(points)));
 let result=null;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],len=segmentLength(a,b);if(len<1e-8)continue;
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],t=Math.min(1,left/len);
  result={position:a.map((v,k)=>v+(b[k]-v)*t),yaw:Math.atan2(-dx,-dz)*180/Math.PI,pitch:Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI};
  if(left<len)return result;left-=len;
 }
 return result;
}
export function advancePlayback(distance,speed,dt,length,loop=false){
 if(length<=0)return {distance:0,finished:true};
 const next=distance+Math.max(0,speed)*Math.max(0,dt);
 return loop?{distance:next%length,finished:false}:{distance:Math.min(length,next),finished:next>=length};
}

// A kinematic two-axle stance, not a suspension or tyre-force solver.
export function sampleAxlePose(points,distance,wheelbase=1.683){
 const center=samplePath(points,distance);if(!center)return null;
 const half=Math.max(.1,wheelbase)/2,front=samplePath(points,distance+half),rear=samplePath(points,distance-half);
 const a=rear.position,b=front.position;
 return {...center,position:[center.position[0],(a[1]+b[1])/2,center.position[2]],pitch:Math.atan2(b[1]-a[1],Math.hypot(b[0]-a[0],b[2]-a[2]))*180/Math.PI};
}
