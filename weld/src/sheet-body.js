import * as THREE from 'three';
import {BIW_POINTS,bodyPoints,zeekrPoint} from './line-data.js';
import {indentationProfile} from './spot-contact.js';
const V=(...a)=>new THREE.Vector3(...a),UP=V(0,1,0);

// Parametric teaching BIW, in metres. Open sheet sections and stamped skins,
// not an OEM CAD model. Wheelhouses cover only the upper half of each opening.
export function buildSheetBody(o,parent,thickness=1.2,model='sheet-metal'){
 const zeekr=model==='zeekr-001',points=bodyPoints({bodyModel:model});
 const shell=new THREE.Group(),marks=new THREE.Group();parent.add(shell,marks);
 const t=thickness/1000,steel=o.mat('#bac7d0',.36,.72),inner=o.mat('#8fabbc',.42,.64),edge=o.mat('#6f8798',.43,.64);
 steel.side=inner.side=THREE.DoubleSide;steel.userData.baseColor='#bac7d0';inner.userData.baseColor='#8fabbc';edge.userData.baseColor='#6f8798';
 const mesh=(g,m=steel,x=0,y=0,z=0)=>o.mesh(g,m,x,y,z,shell);
 const box=(w,h,d,m,x,y,z)=>o.box(w,h,d,m,x,y,z,shell);
 const formed=(a,b,width,depth,mat=steel)=>{
  const group=new THREE.Group();shell.add(group);group.position.copy(a).add(b).multiplyScalar(.5);const delta=b.clone().sub(a);group.quaternion.setFromUnitVectors(UP,delta.clone().normalize());const length=delta.length();
  o.box(width,length,t,mat,0,0,-depth/2,group);
  for(const s of [-1,1]){o.box(t,length,depth,mat,s*width/2,0,0,group);o.box(.016,length,t,mat,s*(width/2+.008),0,depth/2,group);}
 };
 const skin=(nu,nv,point,mat=steel)=>{
  const pos=[],uv=[],indices=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){pos.push(...point(i/nu,j/nv));uv.push(i/nu,j/nv);}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();const normals=g.getAttribute('normal'),n=pos.length/3;
  for(let k=0;k<n;k++){pos.push(pos[k*3]-normals.getX(k)*t,pos[k*3+1]-normals.getY(k)*t,pos[k*3+2]-normals.getZ(k)*t);uv.push(uv[k*2],uv[k*2+1]);}
  const top=[...indices];for(let k=0;k<top.length;k+=3)indices.push(top[k]+n,top[k+2]+n,top[k+1]+n);
  const side=(a,b)=>indices.push(a,a+n,b,b,a+n,b+n);for(let i=0;i<nu;i++){side(i*(nv+1),(i+1)*(nv+1));side((i+1)*(nv+1)+nv,i*(nv+1)+nv);}for(let j=0;j<nv;j++){side(j+1,j);side(nu*(nv+1)+j,nu*(nv+1)+j+1);}
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.deleteAttribute('normal');g.computeVertexNormals();return mesh(g,mat);
 };
 // Floor pan with pressed longitudinal ribs and a raised transmission tunnel.
 skin(64,24,(u,v)=>{const x=-2.18+u*4.36,z=-.79+v*1.58;const tunnel=(zeekr?.022:.13)*Math.exp(-Math.pow(z/.19,4)),rib=.009*Math.pow(Math.sin(x*10),8)*(Math.abs(z)>.22?1:0);return [x,1.015+tunnel+rib,z];});
 for(const x of [-1.15,-.36,.45,1.2])formed(V(x,1.035,-.78),V(x,1.035,.78),.065,.045,inner);
 for(const z of [-.56,.56])formed(V(-2.20,.98,z),V(2.20,.98,z),.08,.065,inner);
 for(const side of [-1,1]){
  // Open hat sections instead of solid bars for rockers and roof rails.
  formed(V(-1.32,1.075,side*.867),V(1.35,1.075,side*.867),.043,.10);
  formed(V(-.92,2.245,side*.735),V(.97,2.245,side*.735),.045,.055);
  formed(V(-1.32,1.09,side*.86),V(-.91,2.235,side*.73),.073,.044);
  formed(V(.025,1.09,side*.865),V(.025,2.235,side*.73),.070,.048);
  formed(V(1.40,1.09,side*.86),V(.96,2.235,side*.73),.11,.046);
  // B-pillar flange is a narrow folded return, offset from the clamp axis.
  formed(V(.086,1.19,side*.895),V(.086,2.22,side*.77),.016,.014,inner);
  for(const sign of [-1,1]){
   const sh=new THREE.Shape();sh.moveTo(1.06,1.01);sh.lineTo(1.13,1.47);sh.lineTo(2.25,1.47);sh.lineTo(2.25,1.01);sh.lineTo(2.16,1.01);sh.absarc(1.70,1.01,.46,0,Math.PI,false);sh.lineTo(1.06,1.01);sh.closePath();
   const g=new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false,curveSegments:36});g.scale(sign,1,1);mesh(g,steel,0,0,side*.813).name='wheel-quarter';
   const wh=skin(40,8,(u,v)=>{const a=u*Math.PI,r=.455+.012*Math.sin(v*Math.PI);return [sign*(1.70+r*Math.cos(a)),1.008+r*Math.sin(a),side*(.51+v*.30)];},inner);wh.name='open-wheelhouse';wh.userData.wheelhouse=true;
   const lip=skin(40,2,(u,v)=>{const a=u*Math.PI,r=.46+v*.012;return [sign*(1.70+r*Math.cos(a)),1.01+r*Math.sin(a),side*(.815+Math.sin(v*Math.PI)*.004)];});lip.name='wheel-opening-flange';
   // Hood/trunk inner ledge with shallow pressed returns, no finished exterior trim.
   box(.99,t,.12,steel,sign*1.7,1.465,side*.74);
   formed(V(sign*1.17,1.43,side*.70),V(sign*2.19,1.43,side*.70),.045,.035,inner);
  }
 }
 // Roof crown and stamped header / rear roof bows.
 if(!zeekr)skin(28,28,(u,v)=>{const z=-.73+v*1.46;return [-.88+u*1.80,2.225+.044*(1-(z/.73)**2),z];});
 else{for(const side of [-1,1])skin(32,6,(u,v)=>{const z=side*(.58+v*.15);return [-.88+u*1.80,2.225+.044*(1-(z/.73)**2),z];});for(const x of [-.88,.78])skin(8,28,(u,v)=>{const z=-.58+v*1.16;return [x+u*.14,2.225+.044*(1-(z/.73)**2),z];});}
 for(const x of [-.9,.94])formed(V(x,2.223,-.735),V(x,2.223,.735),.06,.025,inner);
 for(const x of [-2.18,2.18]){formed(V(x,1.24,-.73),V(x,1.24,.73),.105,.06);box(t,.23,1.46,inner,x,1.34,0);}
 for(const x of [-1.1,1.1])skin(12,12,(u,v)=>[x+(u-.5)*.18,1.03+.20*v,-.68+v*1.36],inner);
 if(zeekr){
  // Continuous stamped bodyside around two open door apertures and the rear quarter window.
  // No closures, glass, wheels or trim: this is a body-shop assembly.
  for(const side of [-1,1]){
   const shape=new THREE.Shape();shape.moveTo(-1.32,1.035);shape.lineTo(1.24,1.035);shape.absarc(1.70,1.01,.46,Math.PI,0,true);shape.lineTo(2.25,1.01);shape.lineTo(2.25,1.47);shape.bezierCurveTo(1.82,1.56,1.45,2.12,.97,2.29);shape.bezierCurveTo(.4,2.33,-.48,2.32,-.94,2.28);shape.lineTo(-1.34,1.50);shape.closePath();
   const hole=coords=>{const h=new THREE.Path();coords.forEach(([x,y],i)=>i?h.lineTo(x,y):h.moveTo(x,y));h.closePath();shape.holes.push(h);};
   hole([[-1.24,1.19],[-1.22,1.48],[-.83,2.17],[-.075,2.19],[-.075,1.19]]);
   hole([[.13,1.19],[.13,2.19],[.85,2.17],[1.19,1.73],[1.16,1.19]]);
   hole([[1.10,2.10],[1.58,1.64],[1.34,1.63],[1.00,2.10]]);
   const geom=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false,curveSegments:24}),pos=geom.attributes.position;
   for(let i=0;i<pos.count;i++){const y=pos.getY(i),z=side*(.89-Math.max(0,y-1.45)*.20)+pos.getZ(i);pos.setZ(i,z);}geom.computeVertexNormals();mesh(geom).name='stamped-bodyside';
   // Pressed side character line and local structural ribs.
   for(const x of [-.74,-.44,.36,.71])formed(V(x,1.04,side*.80),V(x,1.16,side*.80),.042,.025,inner);
  }
  // Cowl, front rails, suspension cups and a short rear deck frame.
  skin(30,12,(u,v)=>[-1.32+u*.18,1.48+.05*Math.sin(v*Math.PI),-.80+v*1.6],inner);
  for(const sign of [-1,1])for(const side of [-1,1]){
   formed(V(sign*1.2,1.15,side*.48),V(sign*2.23,1.15,side*.48),.09,.06,inner);
   const cup=mesh(new THREE.CylinderGeometry(.17,.21,.12,40,1,true),inner,sign*1.70,1.39,side*.54);cup.name='suspension-tower';
   mesh(new THREE.RingGeometry(.085,.17,40),steel,sign*1.70,1.45,side*.54).rotation.x=-Math.PI/2;
  }
  // Bulkheads use pierced stampings instead of a rectangular solid wall.
  for(const x of [-1.23,1.24]){const panel=new THREE.Shape();panel.moveTo(-.72,1.05);panel.lineTo(.72,1.05);panel.lineTo(.67,1.43);panel.lineTo(-.67,1.43);panel.closePath();for(const z of [-.43,0,.43]){const h=new THREE.Path();h.absarc(z,1.25,.075,0,Math.PI*2,true);panel.holes.push(h);}const g=new THREE.ExtrudeGeometry(panel,{depth:t,bevelEnabled:false});g.rotateY(Math.PI/2);mesh(g,inner,x,0,0);}
  // Warp the structure to the reference envelope. Weld laps are built afterwards
  // so their thickness and electrode contact geometry stay in millimetres.
  shell.updateMatrixWorld(true);const objects=[];shell.traverse(obj=>{if(obj.isMesh)objects.push(obj);});
  for(const obj of objects){const g=obj.geometry.clone().applyMatrix4(new THREE.Matrix4().copy(shell.matrixWorld).invert().multiply(obj.matrixWorld)),a=g.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),q=zeekrPoint([x,y,a.getZ(i)]),cx=Math.sign(x)*1.70,r=Math.hypot(x-cx,y-1.01),wheel=['open-wheelhouse','wheel-opening-flange'].includes(obj.name),edge=['wheel-quarter','stamped-bodyside'].includes(obj.name)?Math.max(0,1-Math.abs(r-.46)/.065):0;const factor=wheel?1:edge;q[0]+=(Math.sign(x)*1.5025+(x-cx)*.87-q[0])*factor;a.setXYZ(i,...q);}g.computeVertexNormals();const parent=obj.parent;parent.remove(obj);shell.add(obj);obj.position.set(0,0,0);obj.quaternion.identity();obj.scale.set(1,1,1);obj.geometry.dispose();obj.geometry=g;}
 }
 // Physical two-sheet laps. Front surface equals each programmed TCP plane.
 const patches=[{x:[-1.34,1.36],y:[1.105,1.145],z:.925,ids:['W01','W02','W09','W10']},{x:[-.93,.98],y:[2.279,2.325],z:.785,ids:['W05','W06']},{x:[-2.22,-1.10],y:[1.505,1.555],z:.805,ids:['W03','W04']},{x:[1.10,2.22],y:[1.505,1.555],z:.805,ids:['W11','W12']},...['W07','W08'].map(id=>{const [x,y,z]=points[id].p;return {x:[x-.025,x+.037],y:[y-.04,y+.04],z,ids:[id]};})];
 const dots={};
 for(const source of patches){
  const p=zeekr?{...source,x:source.x.map(x=>zeekrPoint([x,0,0])[0]),y:source.y.map(y=>zeekrPoint([0,y,0])[1]),z:source.z*1.08}:source;
  const sh=new THREE.Shape();sh.moveTo(p.x[0],p.y[0]);sh.lineTo(p.x[1],p.y[0]);sh.lineTo(p.x[1],p.y[1]);sh.lineTo(p.x[0],p.y[1]);sh.closePath();
  for(const id of p.ids){const [x,y]=points[id].p,hole=new THREE.Path();hole.absarc(x,y,.0055,0,Math.PI*2,true);sh.holes.push(hole);}
  mesh(new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false,curveSegments:24}),steel,0,0,p.z-t);
  box(p.x[1]-p.x[0],p.y[1]-p.y[0],t,inner,(p.x[0]+p.x[1])/2,(p.y[0]+p.y[1])/2,p.z-t*1.5);
  box(p.x[1]-p.x[0],p.y[1]-p.y[0],2*t,steel,(p.x[0]+p.x[1])/2,(p.y[0]+p.y[1])/2,-p.z+t);
  // Folded seam joins the visible lap to its supporting body structure.
  box(p.x[1]-p.x[0],t,.035,inner,(p.x[0]+p.x[1])/2,p.y[0],p.z-.0175);
  for(const id of p.ids){const [x,y,z]=points[id].p;
   const dent=new THREE.Mesh(dentGeometry(0,.0032),steel.clone());dent.position.set(x,y,z);marks.add(dent);
   const rim=o.mesh(new THREE.TorusGeometry(.0033,.00012,6,48),o.mat('#5d6f79',.34,.8),x,y,z+.00003,marks);
   const halo=o.mesh(new THREE.RingGeometry(.0035,.0075,48),new THREE.MeshBasicMaterial({color:'#bd7042',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),x,y,z+.00006,marks);
   dots[id]={dent,rim,halo,key:null};
  }
 }
 // Part boundaries remain legible without thick dark wireframes.
 shell.updateMatrixWorld(true);
 const boundaries=[];shell.traverse(obj=>{if(obj.isMesh&&obj.geometry.index===null&&obj.geometry.type==='ExtrudeGeometry'){const line=new THREE.LineSegments(new THREE.EdgesGeometry(obj.geometry,38),new THREE.LineBasicMaterial({color:'#596f7f',transparent:true,opacity:.27}));line.position.copy(obj.position);line.quaternion.copy(obj.quaternion);boundaries.push(line);}});shell.add(...boundaries);
 return {shell,marks,dots,thickness,model,materials:[steel,inner,edge]};
}

export function dentGeometry(depth,radius){
 const positions=[],indices=[],rings=12,segments=48,outer=.0055;
 for(let r=0;r<=rings;r++)for(let s=0;s<=segments;s++){const rho=r/rings*outer,a=s/segments*Math.PI*2;const u=Math.min(1,Math.max(0,(rho-.003)/(radius-.003))),bowl=-depth*(1-u*u*(3-2*u));positions.push(Math.cos(a)*rho,Math.sin(a)*rho,bowl);}
 for(let r=0;r<rings;r++)for(let s=0;s<segments;s++){const a=r*(segments+1)+s,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function updateSheetDot(dot,done,age,outcome,mode,fraction=done?1:0){
 const profile=indentationProfile(outcome,age),key=fraction>0?outcome+':'+fraction.toFixed(3):'flat';
 if(dot.key!==key){dot.dent.geometry.dispose();dot.dent.geometry=dentGeometry(profile.depth*fraction,profile.radius);dot.key=key;}
 dot.rim.visible=done;dot.rim.scale.setScalar(profile.radius/.0033);dot.halo.visible=done;
 dot.dent.material.color.set(done?(outcome==='over'?'#737c80':'#9babb3'):'#bac7d0');
 dot.halo.material.opacity=done?(mode==='temperature'?.48:.09)*profile.heat:0;
}
