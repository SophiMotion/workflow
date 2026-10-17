import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ABBRig} from './abb-rig.js';
import {ABBSixAxisRig} from './abb-six-axis.js';
import {ABBTrajectory,actualTool,mountMatrix,jointDiagnostics,RAD} from './abb-kinematics.js';
import {stationFrames,calibratedTCP,programmedPose,gunFrame} from './control-frames.js';
import {checkCollisionWorld,collectColliders} from './mesh-collision.js';
import {BIW_POINTS,bodyPoints,LINE_STATIONS,LINE_PITCH,selectedStation} from './line-data.js';
import {BIW_PANELS,lineMotionAt,lineCheck} from './line-motion.js';
import {lineSummary} from './engineering.js';
import {buildSheetBody,updateSheetDot} from './sheet-body.js';
import {sheetMetal,indentationProfile,contactState} from './spot-contact.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const GROUPS=['robot','fixture','part','paths','fence','cabinet','gas'];
function batch(group){
 group.updateMatrixWorld(true);const materials=new Map(),remove=[];
 group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh){const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);const list=materials.get(o.material)||[];list.push(geometry);materials.set(o.material,list);remove.push(o);}});
 for(const o of remove)o.removeFromParent();const inverse=group.matrixWorld.clone().invert();
 for(const [material,geometries] of materials){const geo=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g));geo.applyMatrix4(inverse);const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
}

export class BiwLineScene {
 constructor(owner){
  this.o=owner;this.root=new THREE.Group();owner.scene.add(this.root);this.root.visible=false;this.seamMeshes=[];this.cells=[];this.bodies=[];this.manual=new Map();this.controlVisible=false;this.selected='W01';this.mode='solid';this.visibility=Object.fromEntries(GROUPS.map(k=>[k,true]));
  this.m={steel:owner.mat('#bac7cf',.32,.63),edge:owner.mat('#718591',.36,.72),dark:owner.mat('#384a57',.65,.48),blue:owner.mat('#567d92',.48,.45),yellow:owner.mat('#e5b73e',.55,.3),rail:owner.mat('#929fa8',.28,.75),red:owner.mat('#df4450'),white:owner.mat('#eef1f1')};
  this.inspection=new THREE.Group();this.root.add(this.inspection);this.hiddenForInspection=[];this.labels=document.createElement('div');this.labels.className='world-labels';owner.container.append(this.labels);this.build();
  this.toolAxes=new THREE.AxesHelper(.23);this.workAxes=new THREE.AxesHelper(.32);this.root.add(this.toolAxes,this.workAxes);this.toolAxes.visible=this.workAxes.visible=false;
  this.staticObstacles=[...collectColliders(this.conveyor,'输送线'),...collectColliders(this.fence,'围栏'),...this.cells.flatMap(c=>[...collectColliders(c.fixture,c.station.id+' 夹具底座'),...collectColliders(c.cabinet,c.station.id+' 控制柜'),...c.clamps.flatMap((cl,i)=>collectColliders(cl.pivot,c.station.id+' 活动夹臂 '+(i+1)))])];
  this.bodyObstacles=this.bodies.map(b=>({body:b,colliders:[...collectColliders(b.shell,'车身 '+b.stationIndex),...collectColliders(b.pallet,'托盘 '+b.stationIndex)]}));
 }
 group(parent=this.root){const g=new THREE.Group();parent.add(g);return g;}
 build(){const o=this.o,m=this.m;
  const floor=o.mesh(new THREE.PlaneGeometry(80,70),o.mat('#e2e8ec',.95,0),0,-.045,0,this.root);floor.rotation.x=-Math.PI/2;
  this.grid=new THREE.GridHelper(40,40,0xc6d2db,0xd9e1e7);this.grid.position.y=-.04;this.root.add(this.grid);
  const conveyor=this.group();
  for(const z of [-.69,.69]){o.box(23,.15,.13,m.dark,0,.38,z,conveyor);o.box(23,.04,.09,m.rail,0,.48,z,conveyor);}
  for(let x=-11.5;x<=11.5;x+=.34){const roller=o.cyl(.055,1.52,m.rail,x,.43,0,conveyor);roller.rotation.x=Math.PI/2;}
  for(let x=-10;x<=10;x+=2)for(const z of [-.65,.65]){o.box(.11,.33,.11,m.dark,x,.17,z,conveyor);o.box(.28,.04,.25,m.dark,x,.02,z,conveyor);}
  batch(conveyor);this.conveyor=conveyor;
  this.fence=this.group();
  for(let x=-9;x<=9;x+=1.5){o.box(.055,2.5,.055,m.yellow,x,1.25,-2.2,this.fence);if(x<9){for(const y of [.16,2.42])o.box(1.5,.045,.04,m.yellow,x+.75,y,-2.2,this.fence);}}
  const meshLines=[];for(let x=-9;x<=9;x+=.15)meshLines.push(x,.18,-2.2,x,2.4,-2.2);for(let y=.3;y<2.4;y+=.15)meshLines.push(-9,y,-2.2,9,y,-2.2);
  const meshGeo=new THREE.BufferGeometry();meshGeo.setAttribute('position',new THREE.Float32BufferAttribute(meshLines,3));this.fence.add(new THREE.LineSegments(meshGeo,new THREE.LineBasicMaterial({color:'#8697a1',transparent:true,opacity:.18})));batch(this.fence);
  LINE_STATIONS.forEach((st,i)=>{
   const cell=this.group();cell.position.x=st.x;
   const staticFixture=this.group(cell),clamps=[];
   const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V(-2.65,.004,-1.65),V(2.65,.004,-1.65),V(2.65,.004,3.35),V(-2.65,.004,3.35)]),new THREE.LineBasicMaterial({color:'#b7c6d0'}));cell.add(outline);
   for(const x of [-1.0,1.05])for(const sign of [-1,1]){
    const z=sign*1.18;o.box(.37,.11,.42,m.dark,x,.06,z,staticFixture);o.box(.17,.68,.20,m.blue,x,.43,z,staticFixture);o.box(.28,.09,.29,m.rail,x,.81,z,staticFixture);
    const pivot=this.group(cell);pivot.position.set(x,.91,z);const arm=o.box(.11,.075,.40,m.yellow,0,.11,-sign*.14,pivot);o.box(.10,.10,.10,m.dark,0,.04,-sign*.28,pivot);const pin=o.cyl(.045,.23,m.rail,0,.10,0,pivot);pin.rotation.z=Math.PI/2;clamps.push({pivot,sign});
    o.cyl(.042,.28,m.dark,x,.56,z+sign*.10,staticFixture);o.cyl(.018,.19,m.rail,x,.76,z+sign*.10,staticFixture);
   }
   batch(staticFixture);
   const robot=this.group(cell),legacyRoot=this.group(robot),realRoot=this.group(robot),rig=new ABBRig(o,legacyRoot),realRig=new ABBSixAxisRig(o,realRoot,st.id);
   const cabinet=this.group(cell);o.box(.72,1.12,.55,m.white,-2.28,.60,2.45,cabinet);o.box(.65,.93,.018,m.rail,-2.28,.60,2.735,cabinet);o.box(.29,.17,.025,m.dark,-2.35,.86,2.75,cabinet);o.box(.035,.18,.03,m.dark,-2.01,.62,2.76,cabinet);
   o.cyl(.03,.04,m.red,-2.12,.86,2.78,cabinet).rotation.x=Math.PI/2;
   for(let j=0;j<5;j++)o.box(.32,.015,.025,m.dark,-2.28,.26+j*.04,2.75,cabinet);
   const tower=this.group(cabinet);for(let j=0;j<3;j++)o.cyl(.038,.07,o.mat(['#78bcb0','#e6b84d','#b97b7b'][j]),-2.0,1.23+j*.08,2.45,tower);
   batch(cabinet);
   const title=document.createElement('div');title.className='station-world-label';title.innerHTML=`<b>${st.id}</b><span>ABB IRB 6700</span>`;this.labels.append(title);
   const points=this.group(cell),markers={};
   for(const id of st.ids){const data=BIW_POINTS[id],ring=o.mesh(new THREE.TorusGeometry(.048,.006,6,24),new THREE.MeshBasicMaterial({color:'#e99b4e',depthTest:false}),...data.p,points);ring.position.z+=.016;ring.userData.seam=id;ring.renderOrder=3;this.seamMeshes.push(ring);
    markers[id]={ring};
   }
   const route=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#c48549',dashSize:.05,gapSize:.035,transparent:true,opacity:.65}));points.add(route);
   this.cells.push({station:st,cell,rig,realRig,legacyRoot,realRoot,robot,cabinet,title,fixture:staticFixture,clamps,points,markers,route});
   const body=this.buildBody(i);body.group.position.x=st.x;this.bodies.push(body);
  });
  const incoming=this.buildBody(-1);incoming.group.position.x=-12;incoming.group.visible=false;this.bodies.unshift(incoming);

 }
 buildBody(stationIndex){const o=this.o,m=this.m,group=this.group(),shell=this.group(group),pallet=this.group(group),marks=this.group(group);
  for(const panel of BIW_PANELS)o.box(...panel.size,m.steel,...panel.p,shell);
  // Open window and door apertures, roof rails, pillars and stamped floor ribs.
  const beam=(a,b,w=.095,d=.07)=>{const delta=b.clone().sub(a),mesh=o.box(w,delta.length(),d,m.steel,...a.clone().add(b).multiplyScalar(.5).toArray(),shell);mesh.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());};
  for(const side of [-1,1]){
   beam(V(-1.33,1.10,side*.86),V(-.90,2.24,side*.73),.12,.10); // A pillar
   beam(V(.06,1.10,side*.88),V(.06,2.24,side*.73),.12,.09); // B pillar
   beam(V(1.48,1.10,side*.86),V(.96,2.24,side*.73),.15,.10); // C pillar
   // Visible, thin flanges along the B-pillar targets.
   beam(V(.12,1.18,side*.949),V(.12,2.22,side*.825),.035,.025);
   for(const rear of [false,true]){
    const sign=rear?1:-1,cx=1.68,sh=new THREE.Shape();sh.moveTo(1.07,1.03);sh.lineTo(1.18,1.53);sh.lineTo(2.25,1.47);sh.lineTo(2.25,1.03);sh.lineTo(cx+.43,1.03);sh.absarc(cx,1.03,.43,0,Math.PI,false);sh.lineTo(1.07,1.03);
    const g=new THREE.ExtrudeGeometry(sh,{depth:.025,bevelEnabled:false});g.scale(sign,1,1);o.mesh(g,m.steel,0,0,side*.86,shell);
    const arch=o.mesh(new THREE.TorusGeometry(.43,.025,6,32,Math.PI),m.edge,sign*cx,1.03,side*.86,shell);
    const wheelhouse=o.mesh(new THREE.CylinderGeometry(.42,.42,.28,28,1,true,0,Math.PI),m.steel,sign*cx,1.04,side*.73,shell);wheelhouse.rotation.x=Math.PI/2;wheelhouse.rotation.z=Math.PI/2;
   }
  }
  for(const x of [-.91,.95])beam(V(x,2.24,-.74),V(x,2.24,.74),.11,.09);
  for(const x of [-.45,.40])beam(V(x,2.28,-.73),V(x,2.28,.73),.035,.025);
  // Narrow roof skin strip leaves the cabin visible in this inspection view.
  o.box(1.70,.025,.52,m.steel,0,2.28,-.45,shell);
  for(const x of [-1.0,-.5,0,.5,1.0]){o.box(.075,.045,1.55,m.edge,x,1.04,0,shell);o.box(.025,.014,1.5,m.steel,x+.06,1.06,0,shell);}
  o.box(2.9,.19,.28,m.steel,0,1.1,0,shell);
  for(const x of [-1.05,1.28])o.box(.06,.30,1.5,m.steel,x,1.22,0,shell);
  for(const x of [-2.2,2.2])o.box(.10,.18,1.61,m.edge,x,1.24,0,shell);
  for(const x of [-1.6,1.65])for(const z of [-.5,.5]){o.cyl(.21,.18,m.steel,x,1.27,z,shell);o.cyl(.09,.025,m.dark,x,1.37,z,shell);}
  batch(shell);
  for(const mesh of [...shell.children].filter(o=>o.isMesh)){const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,30),new THREE.LineBasicMaterial({color:'#687f8e',transparent:true,opacity:.23}));shell.add(edges);}
  for(const z of [-.61,.61]){o.box(4.6,.15,.13,m.dark,0,.60,z,pallet);o.box(4.55,.035,.14,m.rail,0,.70,z,pallet);}
  for(const x of [-1.4,1.4]){o.box(.16,.12,1.55,m.dark,x,.70,0,pallet);for(const z of [-.63,.63]){o.box(.16,.23,.14,m.blue,x,.86,z,pallet);o.box(.23,.04,.2,m.rail,x,.98,z,pallet);}}
  batch(pallet);
  const dots={};
  for(const [id,data] of Object.entries(BIW_POINTS)){
   const nugget=o.mesh(new THREE.SphereGeometry(.022,12,8),o.mat('#7f8990',.3,.8),...data.p,marks);nugget.scale.z=.16;nugget.position.z+=.003;
   const rim=o.mesh(new THREE.TorusGeometry(.027,.0035,6,24),o.mat('#8893a0'),...data.p,marks);rim.position.z+=.005;
   const halo=o.mesh(new THREE.CircleGeometry(.10,24),new THREE.MeshBasicMaterial({color:'#ef7c39',transparent:true,opacity:.15,depthWrite:false}),...data.p,marks);halo.position.z+=.009;
   dots[id]={nugget,rim,halo};
  }
  return {group,shell,pallet,marks,dots,stationIndex,legacyShell:shell,legacyMarks:marks,legacyDots:dots};
 }
 setProject(project){this.manual.clear();this.project=project;
  for(const body of this.bodies){
   if(!body.sheet||body.sheet.thickness!==project.params.thickness||body.sheet.model!==project.bodyModel){
    if(body.sheet){const mats=new Set(body.sheet.materials);for(const group of [body.sheet.shell,body.sheet.marks]){group.removeFromParent();group.traverse(obj=>{obj.geometry?.dispose();if(obj.material)mats.add(obj.material);});}mats.forEach(m=>m.dispose());}
    body.sheet=buildSheetBody(this.o,body.group,project.params.thickness,project.bodyModel);batch(body.sheet.shell);body.sheet.shell.traverse(obj=>{if(obj.isMesh)obj.receiveShadow=false;});
   }
   const detailed=sheetMetal(project);body.legacyShell.visible=body.legacyMarks.visible=!detailed;body.sheet.shell.visible=body.sheet.marks.visible=detailed;
   body.shell=detailed?body.sheet.shell:body.legacyShell;body.marks=detailed?body.sheet.marks:body.legacyMarks;body.dots=detailed?body.sheet.dots:body.legacyDots;
  }
  this.bodyObstacles=this.bodies.map(b=>({body:b,colliders:[...collectColliders(b.shell,'车身 '+b.stationIndex),...collectColliders(b.pallet,'托盘 '+b.stationIndex)]}));
  this.line=lineSummary(project);this.trajectory=project.robotModel==='illustrative'?null:new ABBTrajectory(project,this.line);for(const cell of this.cells){const st=this.line.stations.find(s=>s.id===cell.station.id),points=st.tasks.map(t=>V(...bodyPoints(project)[t.id].p).add(V(0,0,.015)));cell.route.geometry.dispose();cell.route.geometry=new THREE.BufferGeometry().setFromPoints(points.length?points:[V(0,0,0)]);cell.route.computeLineDistances();for(const [id,m] of Object.entries(cell.markers))m.ring.position.fromArray(bodyPoints(project)[id].p).add(V(0,0,.016));}this.rebuildContactPlan();this.update(0);}
 rebuildContactPlan(){this.validWelds=new Set();for(const st of this.line.stations)for(const task of st.tasks){const w=task.stages.find(s=>s.kind==='weld');if(!this.trajectory||contactState(this.trajectory.pose((w.start+w.end)/2,st),this.project).seated)this.validWelds.add(task.id);}}
 update(time){
  if(!this.project)return;this.time=time;this.states=[];
  const p=this.project,line=this.line;
  this.cells.forEach((cell,i)=>{
   const st=line.stations[i];let pose=this.trajectory?this.trajectory.pose(time,st):lineMotionAt(time,st,p,line);
   pose.done=pose.done.filter(id=>this.validWelds.has(id));const manual=this.manual.get(st.id);if(manual&&this.trajectory){const actual=actualTool(manual.q,mountMatrix(st.id)),tcp=calibratedTCP(actual,stationFrames(p,st.id));pose={...pose,...actual,tip:tcp.root,tcpNormal:tcp.normal,tcpTangent:tcp.tangent,q:[...manual.q],joints:jointDiagnostics(manual.q).map(j=>({...j,velocity:0,speedExceeded:false})),kind:manual.opening===0?'manual-close':'manual',phase:manual.opening===0?'手动合枪 · 未通电':'六轴手动点动',gunOpening:manual.opening,energized:false,manual:true,motionType:'Jog',reachable:true,positionError:0,orientationError:0,singular:Math.abs(Math.sin(manual.q[4]))<Math.sin(3*RAD)};}cell.realRoot.visible=!!this.trajectory;cell.legacyRoot.visible=!this.trajectory;(this.trajectory?cell.realRig:cell.rig).update(pose,p);cell.clamps.forEach(c=>c.pivot.rotation.x=-c.sign*(1-pose.clamp)*1.12);
   for(const [id,{ring}] of Object.entries(cell.markers)){const enabled=st.tasks.some(t=>t.id===id),done=pose.done.includes(id);ring.visible=enabled&&!done&&pose.carOffset===0&&!(pose.id===id&&['close','squeeze','weld','hold'].includes(pose.kind));ring.material.color.set(pose.id===id?'#e27735':done?'#4c9b88':'#c69c6e');ring.scale.setScalar(pose.id===id?1.3:1);}
   cell.route.visible=pose.carOffset===0;
   const check=this.trajectory?{hits:[]}:lineCheck(pose,p.engineering.clearance);this.states.push({...pose,contact:(this.trajectory?cell.realRig:cell.rig).contact,collisions:check.hits});
  });
  const offset=this.states[0]?.carOffset||0;
  this.bodies.forEach(body=>{
   body.group.position.x=(body.stationIndex-1)*LINE_PITCH+offset;
   body.group.visible=body.stationIndex>=0||offset>0;
   body.shell.visible=this.visibility.part;body.marks.visible=this.visibility.part;body.pallet.visible=this.visibility.fixture;
   for(const [id,dot] of Object.entries(body.dots)){
    const pointStation=LINE_STATIONS.findIndex(s=>s.ids.includes(id)),prior=pointStation<body.stationIndex;
    const task=line.stations[pointStation].tasks.find(t=>t.id===id),now=pointStation===body.stationIndex&&task&&time>=task.stages.find(s=>s.kind==='weld').end;
    const visible=!!task&&this.validWelds.has(id)&&(prior||now),age=now?time-task.stages.find(s=>s.kind==='weld').end:99;
    if(sheetMetal(p)){const weld=task?.stages.find(s=>s.kind==='weld'),f=visible?1:pointStation===body.stationIndex&&weld&&this.validWelds.has(id)?Math.min(1,Math.max(0,(time-weld.start)/weld.duration)):0;updateSheetDot(dot,visible,age,p.outcome,this.mode,f*f*(3-2*f));continue;}
    dot.nugget.visible=dot.rim.visible=visible;dot.halo.visible=visible&&age<5;
    const size=p.outcome==='under'?.6:p.outcome==='over'?1.6:1;dot.nugget.scale.set(size,size,.16);dot.rim.scale.setScalar(size);
    dot.nugget.material.color.set(p.outcome==='over'?'#645854':age<.8?'#d29266':'#82929e');
    dot.halo.material.opacity=Math.max(0,1-age/5)*(this.mode==='temperature'?.65:.20);dot.halo.scale.setScalar(1+Math.min(age,5)*.25);
   }
  });
  if(this.trajectory){this.root.updateMatrixWorld(true);this.cells.forEach(c=>c.realRig.clearHighlights());const environment=[...this.staticObstacles,...this.bodyObstacles.filter(b=>b.body.group.visible).flatMap(b=>b.colliders)];this.collision=checkCollisionWorld(this.cells.map(c=>c.realRig),environment,p.engineering.clearance);for(const state of this.states){state.collisions=this.collision.hits.filter(h=>h.station===state.station||h.otherStation===state.station);state.near=this.collision.near.filter(h=>h.station===state.station||h.otherStation===state.station);}}
  for(const [obj] of this.hiddenForInspection)obj.visible=false;this.updateInspection();this.updateControlAxes();this.updateLabels();
 }
 reconfigureFrames(){this.trajectory=new ABBTrajectory(this.project,this.line);this.rebuildContactPlan();this.update(this.time||0);this.o.needsRender=true;}
 clearManual(){this.manual.clear();this.update(this.time||0);this.o.needsRender=true;}
 setControlVisible(visible){this.controlVisible=visible;this.updateControlAxes();this.o.needsRender=true;}
 updateControlAxes(){const state=this.states?.find(s=>s.station===selectedStation(this.project).id),enabled=this.controlVisible&&this.viewMode!=='contact'&&!!this.trajectory&&!!state;this.toolAxes.visible=this.workAxes.visible=enabled;if(!enabled)return;
  const x=LINE_STATIONS.find(s=>s.id===state.station).x,frames=stationFrames(this.project,state.station),tcp=calibratedTCP(state,frames),point=bodyPoints(this.project)[this.selected]||bodyPoints(this.project).W01,target=programmedPose({root:V(...point.p),normal:V(0,0,1),tangent:V(...point.t)},frames);
  for(const [axes,pose] of [[this.toolAxes,tcp],[this.workAxes,target]]){axes.position.copy(pose.root);axes.position.x+=x;axes.quaternion.setFromRotationMatrix(gunFrame(pose));}
 }
 manualCommand(station,{axis,delta,opening}={}){
  if(!this.trajectory)return {ok:false,message:'请选择 ABB 真实六轴模型'};
  const state=this.states.find(s=>s.station===station),previous=this.manual.get(station),q=[...state.q],next=[...q];
  if(axis!==undefined){if(!Number.isInteger(axis)||axis<0||axis>5||!Number.isFinite(delta)||Math.abs(delta)>5)return {ok:false,message:'点动每次为 0.1° / 1° / 5°'};next[axis]+=delta*RAD;}
  if(jointDiagnostics(next).some(j=>j.limited))return {ok:false,message:'已到关节限位，点动被拒绝'};
  if(opening!==undefined&&opening!==0&&opening!==1)return {ok:false,message:'开合值无效'};
  const steps=Math.max(1,Math.ceil(Math.abs(delta||0)/.5));
  for(let i=1;i<=steps;i++){
   this.manual.set(station,{q:q.map((a,j)=>a+(next[j]-a)*i/steps),opening:opening??previous?.opening??1});this.update(this.time);
   const added=this.collision?.hits[0];
   if(added){if(previous)this.manual.set(station,previous);else this.manual.delete(station);this.update(this.time);this.o.needsRender=true;return {ok:false,message:`点动路径检出碰撞，已保留原姿态：${added.link+' / '+added.obstacle}`,collision:added};}
  }
  this.o.needsRender=true;return {ok:true};
 }
 updateLabels(){this.labels.hidden=!this.root.visible;if(!this.project)return;const rect=this.o.container.getBoundingClientRect();for(const c of this.cells){const pos=V(c.station.x,3.45,1).project(this.o.camera);c.title.hidden=['weld','contact'].includes(this.viewMode)||pos.z>1||pos.z<0||Math.abs(pos.x)>.96||Math.abs(pos.y)>.90;c.title.style.transform=`translate(${(pos.x*.5+.5)*rect.width}px,${(-pos.y*.5+.5)*rect.height}px) translate(-50%,-50%)`;c.title.classList.toggle('active',selectedStation(this.project).id===c.station.id);}}
 setSelected(id){this.selected=id;for(const cell of this.cells){const chosen=cell.station.ids.includes(id);cell.title.classList.toggle('active',chosen);cell.points.visible=this.visibility.paths&&this.viewMode!=='contact';}}
 setMode(mode){this.mode=mode;for(const b of this.bodies)for(const obj of b.shell.children)if(obj.isMesh){obj.material.wireframe=mode==='mesh';obj.material.color.set(['temperature','stress','displacement'].includes(mode)?'#5175a0':obj.material.userData.baseColor||(obj.material===this.m.steel?'#bac7cf':obj.material===this.m.edge?'#718591':'#384a57'));}this.update(this.time||0);}
 getState(){const id=selectedStation(this.project).id,p=this.states?.find(s=>s.station===id);if(!p)return null;const plain=s=>({contact:s.contact?{...s.contact,dentDepth:indentationProfile(this.project.outcome,0).depth*1000,bodyModel:this.project.bodyModel}:null,station:s.station,seam:s.id,phase:s.phase,kind:s.kind,phaseProgress:s.phaseProgress,phaseElapsed:s.phaseElapsed,phaseDuration:s.phaseDuration,energized:s.energized&&(s.contact?s.contact.current>0:true),manual:!!s.manual,q:s.q?[...s.q]:[],tcpNormal:s.tcpNormal?.toArray(),tcpTangent:s.tcpTangent?.toArray(),normal:s.normal.toArray(),tangent:s.tangent.toArray(),arc:false,gas:false,gunOpening:s.gunOpening,clamp:s.clamp,progress:s.progress,carOffset:s.carOffset,collisions:s.collisions,near:s.near||[],reachable:s.reachable,model:s.model||'illustrative',joints:s.joints||[],positionError:s.positionError,orientationError:s.orientationError,motionType:s.motionType,singular:!!s.singular,root:s.root.toArray(),tip:s.tip.toArray(),done:s.done,deposited:Object.fromEntries(LINE_STATIONS.find(st=>st.id===s.station).ids.map(id=>[id,s.done.includes(id)?1:0]))});return {...plain(p),line:true,viewMode:this.viewMode,bodyModel:this.project.bodyModel,stations:this.states.map(plain),bottleneck:this.line.bottleneck,collisionCheck:this.trajectory?this.collision:null};}
 toggle(name){if(name==='grid'){this.grid.visible=!this.grid.visible;return this.grid.visible;}this.visibility[name]=!this.visibility[name];const visible=this.visibility[name];if(name==='fence')this.fence.visible=visible;if(name==='fixture')this.conveyor.visible=visible;for(const c of this.cells){if(c[name])c[name].visible=visible;if(name==='paths')c.points.visible=visible;if(name==='fixture')c.clamps.forEach(x=>x.pivot.visible=visible);}this.update(this.time);return visible;}
 updateInspection(){
  if(!this.sectionTarget)return;const {point,target,tangent,normal,side,cutOffset,station}=this.sectionTarget,c=this.states?.find(s=>s.station===station)?.contact,t=this.project.params.thickness/1000;
  const depth=c?.aligned?c.indentation/1000:this.states?.find(s=>s.station===station)?.done.includes(this.selected)?indentationProfile(this.project.outcome,0).depth:0,key=t+':'+depth.toFixed(7);
  if(this.inspection.userData.key===key&&this.inspection.children.length)return;this.inspection.userData.key=key;
  for(const obj of [...this.inspection.children]){obj.geometry.dispose();obj.material.dispose();obj.removeFromParent();}
  const id=this.selected,lo=id==='W05'||id==='W06'?-.011:id==='W07'||id==='W08'?-.025:-.015,hi=id==='W01'||id==='W02'||id==='W09'||id==='W10'?.025:.035;
  for(let layer=0;layer<2;layer++){const positions=[],index=[];for(let i=0;i<=64;i++){const u=lo+(hi-lo)*i/64,r=Math.hypot(u,cutOffset),fade=Math.min(1,Math.max(0,(r-.003)/(indentationProfile(this.project.outcome,0).radius-.003))),dent=-depth*(1-fade*fade*(3-2*fade));for(const n of [layer===0?dent:-t,-(layer+1)*t])positions.push(...target.clone().addScaledVector(tangent,u).addScaledVector(normal,n).addScaledVector(side,cutOffset+.000002).toArray());if(i<64){const k=i*2;index.push(k,k+1,k+2,k+1,k+3,k+2);}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(index);g.computeVertexNormals();const material=new THREE.MeshStandardMaterial({color:layer===0?'#b4d7e3':'#6d98b0',metalness:.25,roughness:.5,side:THREE.DoubleSide});this.inspection.add(new THREE.Mesh(g,material));}
 }
 view(name,stationId){
  for(const [obj,visible] of this.hiddenForInspection)obj.visible=visible;this.hiddenForInspection=[];for(const obj of [...this.inspection.children]){obj.geometry?.dispose();obj.material?.dispose();obj.removeFromParent();}this.sectionTarget=null;
  this.viewMode=name;const camera=this.o.camera,controls=this.o.controls,focus=LINE_STATIONS.find(s=>s.id===stationId),macro=name==='contact'&&focus;
  if(this.o.renderer)this.o.renderer.localClippingEnabled=true;
  for(const b of this.bodies)for(const g of [b.legacyShell,b.sheet?.shell,b.legacyMarks,b.sheet?.marks].filter(Boolean))g.traverse(obj=>{if(obj.material){obj.material.clippingPlanes=null;obj.material.needsUpdate=true;}});
  for(const cell of this.cells)cell.points.visible=this.visibility.paths&&!macro;
  if((name==='weld'||macro)&&focus){
   const point=bodyPoints(this.project)[this.selected]||bodyPoints(this.project)[focus.ids[0]],target=V(...point.p);target.x+=focus.x;controls.target.copy(target);
   if(macro){const tangent=V(...point.t),normal=V(0,0,1),side=tangent.clone().cross(normal),result=this.states?.find(s=>s.station===focus.id)?.kind==='retreat';if(side.y<0)side.negate();camera.position.copy(target).addScaledVector(side,result?.085:.12).addScaledVector(normal,result?.11:.072).addScaledVector(tangent,.025);camera.near=.002;
    if(sheetMetal(this.project)){
     const body=this.bodies.find(b=>b.stationIndex===LINE_STATIONS.indexOf(focus));const plane=(axis,offset)=>new THREE.Plane().setFromNormalAndCoplanarPoint(axis,target.clone().addScaledVector(axis,offset));
     const planes=[plane(side.clone().negate(),result?-.018:0),plane(side,-.055),plane(tangent,-.025),plane(tangent.clone().negate(),-.04),plane(normal,-.04),plane(normal.clone().negate(),-.005)];
     for(const g of [body?.sheet.shell,body?.sheet.marks].filter(Boolean))g.traverse(obj=>{if(obj.material)obj.material.clippingPlanes=planes;});
     const hide=obj=>{if(!obj)return;this.hiddenForInspection.push([obj,obj.visible]);obj.visible=false;};
     hide(this.conveyor);hide(this.fence);hide(this.grid);
     for(const b of this.bodies){hide(b.pallet);if(b!==body){hide(b.shell);hide(b.marks);}}
     for(const c of this.cells){hide(c.cabinet);hide(c.fixture);c.clamps.forEach(cl=>hide(cl.pivot));const keep=c.station.id===focus.id?(this.trajectory?c.realRig:c.rig).servoGun.group:null;c.robot.traverse(obj=>{if(!obj.isMesh)return;let a=obj,inside=false;while(a){if(a===keep)inside=true;a=a.parent;}if(!inside)hide(obj);});}
     this.sectionTarget={point,target,tangent,normal,side,cutOffset:result?.018:0,station:focus.id};this.updateInspection();
    }
   }else{camera.position.copy(target).add(V(-1.4,.12,.9));camera.near=.03;}
  }else if(focus){controls.target.set(focus.x,1.55,.3);camera.position.set(focus.x+4.2,4.7,7.4);camera.near=.05;}else{controls.target.set(0,1.3,.35);if(name==='top')camera.position.set(0,21,.36);else if(name==='front')camera.position.set(0,7,23);else camera.position.set(7.8,8.8,16.0);camera.near=.05;}
  controls.minDistance=macro?.025:name==='weld'?.35:2;controls.maxDistance=42;camera.updateProjectionMatrix();controls.update();this.updateControlAxes();
 }
}
