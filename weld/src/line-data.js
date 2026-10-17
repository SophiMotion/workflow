// Procedural BIW teaching geometry, in metres. Not an OEM body or ABB CAD model.
export const LINE_PITCH=6;
export const LINE_STATIONS=[
 {id:'OP10',name:'前舱 / 门槛定位焊',short:'前段定位',x:-6,transferKey:'lineTransfer1',ids:['W01','W02','W03','W04']},
 {id:'OP20',name:'侧围 / 顶边补焊',short:'侧围补焊',x:0,transferKey:'lineTransfer2',ids:['W05','W06','W07','W08']},
 {id:'OP30',name:'后舱 / 门槛补焊',short:'后段补焊',x:6,transferKey:'lineTransfer3',ids:['W09','W10','W11','W12']}
];
export const BIW_POINTS={
 W01:{p:[-.90,1.12,.925],t:[0,1,0],name:'前门槛 · 前点'},
 W02:{p:[-.50,1.12,.925],t:[0,1,0],name:'前门槛 · 后点'},
 W03:{p:[-1.58,1.52,.805],t:[0,1,0],name:'前舱侧梁 · 前点'},
 W04:{p:[-1.22,1.52,.805],t:[0,1,0],name:'前舱侧梁 · 后点'},
 W05:{p:[-.65,2.29,.785],t:[0,1,0],name:'顶边梁 · 前点'},
 W06:{p:[.55,2.29,.785],t:[0,1,0],name:'顶边梁 · 后点'},
 W07:{p:[.12,1.50,.925],t:[1,0,0],name:'B 柱 · 下点'},
 W08:{p:[.12,1.92,.875],t:[1,0,0],name:'B 柱 · 上点'},
 W09:{p:[.70,1.12,.925],t:[0,1,0],name:'后门槛 · 前点'},
 W10:{p:[1.0,1.12,.925],t:[0,1,0],name:'后门槛 · 后点'},
 W11:{p:[1.58,1.52,.805],t:[0,1,0],name:'后舱侧梁 · 前点'},
 W12:{p:[1.94,1.52,.805],t:[0,1,0],name:'后舱侧梁 · 后点'}
};
export const isLine=p=>p.scene==='biw-line'&&p.process==='spot';
export const stationFor=id=>LINE_STATIONS.find(s=>s.ids.includes(id));
export const selectedStation=p=>LINE_STATIONS.find(s=>s.id===p.activeStation)||LINE_STATIONS[0];
export const visibleTasks=p=>isLine(p)?p.seams.filter(s=>selectedStation(p).ids.includes(s.id)):p.seams;
// ZEEKR 001 inspired shooting-brake proportions. Public exterior reference only;
// welding points and body construction remain teaching geometry, not OEM process data.
export function zeekrPoint([x,y,z]){
 const ax=Math.abs(x),mapped=ax<=1.7?ax*(1.5025/1.7):1.5025+(ax-1.7)*(2.485-1.5025)/.55;
 return [Math.sign(x)*mapped,1.015+(y-1.015)*.87,z*1.08];
}
export function bodyPoints(project){return project?.bodyModel==='zeekr-001'?ZEEKR_POINTS:BIW_POINTS;}
const ZEEKR_POINTS=Object.fromEntries(Object.entries(BIW_POINTS).map(([id,p])=>[id,{...p,p:zeekrPoint(id==='W04'?[-1.45,p.p[1],p.p[2]]:id==='W11'?[1.93,p.p[1],p.p[2]]:id==='W12'?[2.10,p.p[1],p.p[2]]:p.p)}]));
