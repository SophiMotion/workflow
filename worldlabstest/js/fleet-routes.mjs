import {roadRoute} from './road-profile.mjs';
import {raceRoute,testRoute} from './expansion-profile.mjs';
export const FLEET_ASSIGNMENTS={rover:'campus',sophicar:'race',fusion:'westSouth',nav:'westNorth',edu:'raceInner',sophicore:'test'};
export function expandedRoute(kind){
 if(kind==='test')return testRoute();
 if(kind==='race'||kind==='raceInner'){
  const p=raceRoute();if(kind==='race')return p;
  return p.map((v,i)=>{const n=p.length-1,a=p[(i+n-1)%n],b=p[(i+1)%n],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);return [v[0]-dz/len*1.8,v[1],v[2]+dx/len*1.8];});
 }
 if(kind==='westSouth'||kind==='westNorth')return roadRoute().map(p=>[p[0]-32,p[1],1.5+(p[2]-1.5)*33/69+(kind==='westNorth'?36:0)]);
 return roadRoute();
}
