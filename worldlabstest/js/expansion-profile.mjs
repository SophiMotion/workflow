// Design-space dimensions in meters. Campus and race circuit stay level;
// only the separately marked proving lane changes elevation.
export const SITE=Object.freeze({minX:-115,maxX:105,minZ:-18,maxZ:205});
export const TEST=Object.freeze({x:78,width:7,start:4,end:94,water:.12});
export const TEST_SECTIONS=Object.freeze([
 {id:'rough',name:'崎岖路',from:14,to:32,color:0x997154,detail:'连续缓坡与不规则起伏 · 最高约 0.5 m'},
 {id:'gravel',name:'砂石路',from:34,to:50,color:0xb5a384,detail:'细砂与碎石铺面 · 小幅起伏'},
 {id:'water',name:'水塘路',from:52,to:68,color:0x468ea9,detail:'平整路基 · 12 cm 浅水'},
 {id:'washboard',name:'搓衣板路',from:70,to:88,color:0xb99b77,detail:'横向周期凸纹 · 高 8 cm / 间距 0.85 m'}
]);
const envelope=(z,a,b)=>Math.min(1,Math.max(0,(z-a)/1.8),Math.max(0,(b-z)/1.8));
export function testHeight(z){
 if(z>=14&&z<=32)return envelope(z,14,32)*(.17+.16*Math.sin((z-14)*1.15)+.12*Math.sin((z-14)*2.37)**2);
 if(z>=34&&z<=50)return envelope(z,34,50)*(.028+.017*Math.sin(z*3)+.011*Math.sin(z*7));
 if(z>=70&&z<=88)return envelope(z,70,88)*.08*(.5-.5*Math.cos((z-70)*Math.PI*2/.85));
 return 0;
}
export function testZone(z){return TEST_SECTIONS.find(s=>z>=s.from&&z<=s.to)?.name||'平整衔接段';}
export function onTestLane(x,z){return Math.abs(x-TEST.x)<=TEST.width/2&&z>=0&&z<=98;}
export function testRoute(){return Array.from({length:901},(_,i)=>{const z=TEST.start+i/10;return [TEST.x,testHeight(z)+.025,z];});}
// Closed, smooth circuit with a hairpin and infield S bend; sampled from one source
// for both rendered pavement and the vehicle path.
const raceControls=[[-22,113],[-24,149],[-14,182],[20,190],[65,184],[81,162],[76,138],[57,136],[42,153],[22,158],[12,143],[25,123],[56,114],[59,101],[28,97],[-4,102]];
export function raceRoute(){
 const points=[],n=raceControls.length;
 for(let i=0;i<n;i++)for(let j=0;j<20;j++){
  const t=j/20,t2=t*t,t3=t2*t;
  const a=raceControls[(i+n-1)%n],b=raceControls[i],c=raceControls[(i+1)%n],d=raceControls[(i+2)%n];
  const coord=k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3);
  points.push([coord(0),.025,coord(1)]);
 }
 points.push([...points[0]]);return points;
}
export const ROUTE_OPTIONS=Object.freeze({
 campus:{name:'东区 · 智能试验车巡游',preset:'campus-level-network-v2',speed:4,view:'campus'},
 race:{name:'赛道 · 主环线',preset:'campus-race-v3',speed:8,view:'race'},
 westSouth:{name:'西南区 · 图书馆配送',preset:'campus-west-south-v4',speed:1.5,view:'campus'},
 westNorth:{name:'西北区 · 实验楼巡检',preset:'campus-west-north-v4',speed:1.2,view:'campus'},
 raceInner:{name:'赛道 · 内侧训练线',preset:'campus-race-inner-v4',speed:3,view:'race'},
 test:{name:'综合测试 · 崎岖 / 砂石 / 水塘 / 搓衣板',preset:'campus-proving-v3',speed:2,view:'test'}
});
export function routeKind(preset){return Object.keys(ROUTE_OPTIONS).find(k=>ROUTE_OPTIONS[k].preset===preset)||'campus';}
export const VIEWS=Object.freeze({
 overview:{position:[250,290,-200],target:[-8,0,86]},
 campus:{position:[80,76,-59],target:[0,2,34]},
 entrance:{position:[-4,15,-21],target:[-15,1.4,1]},
 street:{position:[21,19,15],target:[-1.4,1.4,36]},
 annex:{position:[153,135,-26],target:[43,0,64]},
 facades:{position:[47,28,-17],target:[0,4,25]},
 sports:{position:[-18,85,-29],target:[-78,0,35]},
 lake:{position:[-12,80,87],target:[-73,0,140]},
 race:{position:[140,145,67],target:[27,0,147]},
 test:{position:[128,62,11],target:[78,0,48]},
 rough:{position:[88,8,14],target:[78,.3,23]},
 water:{position:[89,13,47],target:[78,0,61]},
 washboard:{position:[88,7,69],target:[78,0,79]},
 start:{position:[12,12,-5],target:[1,0,13]},
 end:{position:[128,62,11],target:[78,0,48]}
});
