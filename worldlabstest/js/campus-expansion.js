import * as THREE from 'three';
import {accessRoadStrips} from './road-surfaces.mjs';
import {SITE,TEST,TEST_SECTIONS,testHeight,raceRoute} from './expansion-profile.mjs';

// Extension scenery shares TestRoad's materials, disposal, picking and coordinate frame.
export function buildExpansion(s){
 const asphalt=s.asphalt,white=s.mat(0xf6f1e5),stone=s.mat(0xd7d2c3),navy=s.mat(0x283e54);
 const plane=(w,d,x,z,y,mat,drive=false)=>{const g=new THREE.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.receiveShadow=true;s.deck.add(m);if(drive)s.driveMeshes.push(m);return m;};
 const line=(points,color=0xf8f1df)=>{const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Line(g,new THREE.LineBasicMaterial({color}));s.deck.add(m);return m;};
 const ellipse=(x,z,rx,rz,y,mat,inner=0)=>{
  const sh=new THREE.Shape();sh.absellipse(x,-z,rx,rz,0,Math.PI*2,false,0);
  if(inner){const hole=new THREE.Path();hole.absellipse(x,-z,rx-inner,rz-inner,0,Math.PI*2,true,0);sh.holes.push(hole);}
  const g=new THREE.ShapeGeometry(sh,100);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.y=y;m.receiveShadow=true;s.deck.add(m);return m;
 };
 const outline=(x,z,rx,rz,y,color)=>line(Array.from({length:129},(_,i)=>{const t=i/128*Math.PI*2;return [x+rx*Math.cos(t),y,z+rz*Math.sin(t)];}),color);
 // Gray asphalt access roads stop at the main-grid edges; the proving road is an independent lane.
 plane(39.2,6.6,54.9,0,0,asphalt,true); // core east -> proving-road apron
 for(const rows of accessRoadStrips()){
  const p=[],uv=[],idx=[];for(const {z,left,right} of rows)for(const x of [left,right]){p.push(x,0,z);uv.push(x/2,z/2);}for(let i=0;i<rows.length-1;i++){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,asphalt);m.receiveShadow=true;s.deck.add(m);s.driveMeshes.push(m);
 }
 for(const [a,b] of [[-4,14],[32,34],[50,52],[68,70],[88,98]])plane(7,b-a,TEST.x,(a+b)/2,0,asphalt,true);
 // Sports park: oval running lanes, football markings, hoops and spectator stands.
 ellipse(-80,36,27,39,.025,stone,2);
 ellipse(-80,36,25,37,.025,s.mat(0xb45f4f),6.3);
 ellipse(-80,36,18.7,30.7,.04,s.mat(0x72977b));
 for(let i=0;i<6;i++)outline(-80,36,19.6+i,31.6+i,.055,0xf0d2be);
 
 for(let i=0;i<8;i++)plane(30,46/8,-80,13+46/8*(i+.5),.054,s.mat(i%2?0x749b7d:0x7b9f83));
 const fy=.068;
 line([[-95,fy,13],[-65,fy,13],[-65,fy,59],[-95,fy,59],[-95,fy,13]]);
 line([[-95,fy,36],[-65,fy,36]]);outline(-80,36,5,5,fy,0xffffff);
 for(const z of [13,59]){const dir=z===13?1:-1;line([[-88,fy,z],[-88,fy,z+dir*7],[-72,fy,z+dir*7],[-72,fy,z]]);
  for(const x of [-83, -77])s.box(.12,2.4,.12,x,1.2,z,white);s.box(6.1,.12,.12,-80,2.4,z,white);
  for(let i=0;i<9;i++)line([[-83+i*.75,0,z-dir*1.3],[-83+i*.75,2.4,z]],0xeff3ea);
 }
 for(let i=0;i<4;i++)s.box(7+i*.6,.7,36,-110+i*.5,.35+i*.6,36,s.mat(i%2?0xbbc5c5:0xb6c6cd));
 s.box(9,.3,38,-108,5,36,navy);for(const z of [19,53])s.box(.18,5,.18,-111,2.5,z,white);
 s.label('02  运动公园',-80,4,-6,16,2.8,0x426e65);
 for(const x of [-102,-58])for(const z of [6,65]){s.box(.2,12,.2,x,6,z,navy);s.box(3,.7,.5,x,12,z,white);}
 // Irregular lake shoreline, a continuous promenade and small observation piers.
 const lakeShape=(scale=1)=>{
  const sh=new THREE.Shape();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,r=1+.09*Math.sin(a*3)+.055*Math.cos(a*5);const x=-73+Math.cos(a)*31*r*scale,z=139+Math.sin(a)*38*r*scale;i?sh.lineTo(x,-z):sh.moveTo(x,-z);}return sh;
 };
 const shapeMesh=(shape,y,mat)=>{const g=new THREE.ShapeGeometry(shape,100);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.y=y;m.receiveShadow=true;s.deck.add(m);return m;};
 const shoreRing=(outer,inner,color)=>{const shape=lakeShape(outer);shape.holes.push(new THREE.Path(lakeShape(inner).getPoints()));shapeMesh(shape,.032,s.mat(color));};
 shoreRing(1.12,1.065,0xcebfa4);shoreRing(1.065,1.015,0xeae4d4);shoreRing(1.015,1,0xa9b6a1);
 shapeMesh(lakeShape(),.032,s.waterMaterial);
 // Island and boardwalk stay inside the lake, away from driving routes.
 ellipse(-77,142,5.5,8,.06,s.mat(0xc9c1a9));s.tree(-77,141);s.tree(-79,144);
 for(let i=0;i<28;i++)s.box(6,.13,.52,-73,.23,94+i*.6,s.mat(0xa78a62));
 for(let i=0;i<42;i++)s.box(.52,.13,4,-36-i*.6,.23,148,s.mat(0xa78a62));
 for(const z of [101,107,111])for(const x of [-75.8,-70.2])s.box(.1,1.05,.1,x,.7,z,white);
 s.label('03  湖畔生态区',-74,5,182,18,2.8,0x34788e);
 // Landscape clusters are separate planted areas, never green shoulders over roads.
 for(let i=0;i<26;i++){const a=i/26*Math.PI*2,x=-73+Math.cos(a)*39,z=139+Math.sin(a)*46;if(x>-111&&x<-34&&z<196)s.tree(x,z);}
 for(let z=5;z<=78;z+=10)s.tree(-48,z);
 // Racing ribbon: geometry and route use exactly the same sampled centerline.
 const race=raceRoute();
 const ribbon=(width,y,material,drive=false,inner=0,edge=1)=>{
  const positions=[],uv=[],indices=[];
  for(let i=0;i<race.length;i++){const prev=race[(i+race.length-2)%(race.length-1)],next=race[(i+1)%(race.length-1)],dx=next[0]-prev[0],dz=next[2]-prev[2],n=Math.hypot(dx,dz);for(const side of [-1,1]){positions.push(race[i][0]+dz/n*(inner?(side<0?inner:width)/2*edge:width/2*side),y,race[i][2]-dx/n*(inner?(side<0?inner:width)/2*edge:width/2*side));uv.push((side+1)/2,i/4);}}
  for(let i=0;i<race.length-1;i++){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.receiveShadow=true;s.deck.add(m);if(drive)s.driveMeshes.push(m);return m;
 };
 for(const side of [-1,1]){ribbon(13,.0,s.mat(0xc6c9c4,{side:THREE.DoubleSide}),false,9.8,side);ribbon(9.8,.0,s.mat(0xd76151,{side:THREE.DoubleSide}),false,8,side);}ribbon(8,.0,s.mat(0x60666b),true);
 // Red/white curbing follows each bend; no elevated blocks inside the racing line.
 for(let i=0;i<race.length-1;i+=2){const p=race[i],n=race[i+1],yaw=Math.atan2(n[0]-p[0],n[2]-p[2]);for(const side of [-1,1]){const b=s.box(.65,.025,1.4,p[0]+Math.cos(yaw)*4.5*side,.023,p[2]-Math.sin(yaw)*4.5*side,white);b.rotation.y=yaw;}}
 const start=race[0],n=race[1],angle=Math.atan2(n[0]-start[0],n[2]-start[2]);
 for(let i=0;i<10;i++)for(let j=0;j<2;j++){const b=s.box(.8,.018,.7,start[0]+Math.cos(angle)*(i-4.5)*.8+Math.sin(angle)*j*.7,.034,start[2]-Math.sin(angle)*(i-4.5)*.8+Math.cos(angle)*j*.7,s.mat((i+j)%2?0xf7f5ee:0x172b3e));b.rotation.y=angle;}
 // Pit lane, garages and timing structure.
 plane(37,5,33,175,.013,s.mat(0x737779),true);s.building(33,168,26,7,3.7,0xb75949,'PIT · 维修区');
 for(let x=22;x<46;x+=5){s.box(3.5,.02,2.5,x,.04,173,white);s.box(3.2,.022,2.2,x,.05,173,navy);}
 s.label('04  赛车环道',35,6,202,18,3,0x294e71);
 for(let x=6;x<=64;x+=7)s.tree(x,198);
 // Four proving surfaces, generated directly from the profile used for driving.
 for(const part of TEST_SECTIONS){
  const segments=Math.ceil((part.to-part.from)/.1),g=new THREE.PlaneGeometry(TEST.width,part.to-part.from,8,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const z=p.getZ(i)+(part.from+part.to)/2;p.setXYZ(i,p.getX(i)+TEST.x,testHeight(z)+.012,z);}g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,s.mat(part.color,{roughness:part.id==='water'?.4:1}));mesh.receiveShadow=true;s.deck.add(mesh);s.driveMeshes.push(mesh);
  s.sign(`${String(TEST_SECTIONS.indexOf(part)+1).padStart(2,'0')}  ${part.name}`,TEST.x-6,part.from,part.color);
  // Shallow relief and sampling markers are intentional, not broken terrain.
  for(const z of [part.from,part.to])plane(TEST.width,.18,TEST.x,z,.03,white);
 }
 for(const side of [-1,1])for(let z=8;z<94;z+=4){s.box(.13,.7,.13,TEST.x+side*4.2,.35,z,white);s.box(.14,.18,.14,TEST.x+side*4.2,.65,z,s.mat(0xe29e48));}
 plane(6.2,13.8,TEST.x,60,TEST.water,s.waterMaterial);
 for(const side of [-1,1])s.box(.16,.24,16,TEST.x+side*3.4,.12,60,stone);
 // Visible sand and individual gravel, batched for efficient rendering.
 const count=2500,rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),s.mat(0xbca68c),count),o=new THREE.Object3D(),col=new THREE.Color();let seed=781;
 const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<count;i++){const x=TEST.x+(rand()-.5)*6.8,z=34.15+rand()*15.7,r=.03+rand()*.075;o.position.set(x,testHeight(z)+.022,z);o.scale.set(r,.015+rand()*.028,r*.7);o.rotation.set(rand(),rand()*6,rand());o.updateMatrix();rocks.setMatrixAt(i,o.matrix);col.setHSL(.09,.15,.42+rand()*.25);rocks.setColorAt(i,col);}rocks.receiveShadow=true;s.deck.add(rocks);
 s.label('05  综合测试道路',78,4,-10,20,2.8,0x815d3f);
 // Service pavilion alongside test lane, plus route-identification ground boards.
 s.building(54,22,15,9,4,0xc19455,'TEST · 测试站');
 for(const z of [38,49,61,88])s.tree(69,z);
 s.label('01  未来校园',0,4,-13,18,2.8,0x355f6a);
}
