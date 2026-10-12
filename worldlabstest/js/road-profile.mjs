// All road beds and junctions share one datum. Water and gravel are surface layers.
export const ROAD = Object.freeze({length:72,width:6.6,asphaltEnd:56,gravelEnd:68,
  puddleX:1.45,puddleZ:63,puddleRX:1.65,puddleRZ:3,waterLevel:.04,
  routeX:1.5,start:6,end:6,anchor:[2.5,3.2,10],yaw:-25});
export const CAMPUS = Object.freeze({minX:-46,maxX:46,minZ:-12,maxZ:84,vertical:[-32,0,32],horizontal:[0,36,72]});
export function isRoad(x,z){const h=ROAD.width/2;return z>=-h&&z<=72+h&&CAMPUS.vertical.some(v=>Math.abs(x-v)<=h)||x>=-32-h&&x<=32+h&&CAMPUS.horizontal.some(v=>Math.abs(z-v)<=h);}
export function puddleRadius(x,z){return Math.hypot((x-ROAD.puddleX)/ROAD.puddleRX,(z-ROAD.puddleZ)/ROAD.puddleRZ);}
export function roadHeight(){return 0;}
export function roadZone(x,z){return isRoad(x,z)?'灰色平路':'校园广场';}
export function roadTiles(){
 const xs=[-35.3,-28.7,-3.3,3.3,28.7,35.3],zs=[-3.3,3.3,32.7,39.3,56,68,68.7,75.3],tiles=[];
 for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
  const x=(xs[i]+xs[i-1])/2,z=(zs[j]+zs[j-1])/2;
  if(isRoad(x,z))tiles.push({x0:xs[i-1],x1:xs[i],z0:zs[j-1],z1:zs[j],gravel:false});
 }return tiles;
}
export function roadRoute(){
 const p=[],point=(x,z)=>p.push([x,.025,z]);point(1.5,6);
 const line=(x,z)=>{const a=p.at(-1),n=Math.ceil(Math.hypot(x-a[0],z-a[2])/2);for(let i=1;i<=n;i++)point(a[0]+(x-a[0])*i/n,a[2]+(z-a[2])*i/n);};
 const arc=(x,z,from,to)=>{for(let i=1;i<=12;i++){const t=(from+(to-from)*i/12)*Math.PI/180;point(x+3*Math.cos(t),z+3*Math.sin(t));}};
 line(1.5,67.5);arc(4.5,67.5,180,90);line(27.5,70.5);arc(27.5,67.5,90,0);
 line(30.5,4.5);arc(27.5,4.5,0,-90);line(4.5,1.5);arc(4.5,4.5,-90,-180);line(1.5,6);
 return p;
}
