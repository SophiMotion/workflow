import {raceRoute} from './expansion-profile.mjs';
// Exact sampled outer edge shared with the race ribbon. Clip access paving at
// this boundary instead of hiding a second road surface underneath the track.
export function outerRaceEdges(){const race=raceRoute(),n=race.length-1;return [-1,1].map(side=>race.map((p,i)=>{const a=race[(i+n-1)%n],b=race[(i+1)%n],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz);return [p[0]+dz/l*6.5*side,p[2]-dx/l*6.5*side];}));}
export function raceLeftEdge(z,edges=outerRaceEdges()){let x=Infinity;for(const edge of edges)for(let i=1;i<edge.length;i++){const a=edge[i-1],b=edge[i];if(z>=Math.min(a[1],b[1])&&z<=Math.max(a[1],b[1])&&Math.abs(a[1]-b[1])>1e-8)x=Math.min(x,a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]));}return x;}
export function accessRoadStrips(){const edges=outerRaceEdges();return [[75.3,109.1,-28.7],[109.1,115.7,-20]].map(([start,end,right])=>{const zs=[start,end,...edges.flat().map(v=>v[1]).filter(z=>z>start&&z<end)];zs.sort((a,b)=>a-b);return zs.map(z=>({z,left:-35.3,right:Math.min(right,raceLeftEdge(z,edges))}));});}
