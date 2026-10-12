import * as THREE from 'three';

// Reference-inspired scenery actors. Baked as instances, separate from the
// editable Sophicar and its playback path; these are parked / posed exhibits.
export function buildCampusLife(s){
 const source=new THREE.Group(),root=new THREE.Group();root.name='校园生活 · 接驳 / 配送 / 骑行 / 行人';
 const cube=new THREE.BoxGeometry(1,1,1),ball=new THREE.SphereGeometry(1,10,8),cylinder=new THREE.CylinderGeometry(1,1,1,12),ring=new THREE.TorusGeometry(1,.09,6,20);
 const steel=s.mat(0x29343b),rubber=s.mat(0x24292b),ivory=s.mat(0xeee5d1),skin=s.mat(0xd9b18b),glass=s.mat(0x6b99a9,{transparent:true,opacity:.48,roughness:.18,depthWrite:false}),yellow=s.mat(0xefb629),blue=s.mat(0x207ba0),orange=s.mat(0xe07832);
 const counts={shuttles:0,vans:0,robots:0,cyclists:0,people:0,karts:0};
 const mesh=(g,geometry,material,p,scale)=>{const m=new THREE.Mesh(geometry,material);m.position.fromArray(p);m.scale.fromArray(scale);g.add(m);return m;};
 const box=(g,w,h,d,x,y,z,m)=>mesh(g,cube,m,[x,y,z],[w,h,d]);
 const orb=(g,x,y,z,rx,ry,rz,m)=>mesh(g,ball,m,[x,y,z],[rx,ry,rz]);
 const bar=(g,a,b,r,m)=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));const o=mesh(g,cylinder,m,a,[r,v.length(),r]);o.position.addScaledVector(v,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;};
 const group=(x,z,yaw=0)=>{const g=new THREE.Group();g.position.set(x,.035,z);g.rotation.y=yaw;source.add(g);return g;};
 const person=(parent,x,z,color,y=0,pose='walk',yaw=0)=>{
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw;parent.add(g);counts.people++;
  const shirt=s.mat(color),pants=s.mat(0x41515a),headY=pose==='sit'?1.28:1.63,hip=pose==='sit'?.65:.83;
  orb(g,0,headY,0,.155,.19,.155,skin);orb(g,0,headY+.105,-.025,.16,.09,.15,s.mat(0x4f4135));
  box(g,.39,.5,.25,0,hip+.29,0,shirt);bar(g,[0,headY-.15,0],[0,hip+.48,0],.085,skin);
  for(const side of [-1,1]){
   const xx=side*.115,knee=pose==='sit'?[xx,.57,.36]:[xx,.43,side*.14],foot=pose==='sit'?[xx,.17,.4]:[xx,.07,-side*.23];
   bar(g,[xx,hip,0],knee,.085,pants);bar(g,knee,foot,.066,pants);box(g,.17,.1,.3,foot[0],foot[1]-.025,foot[2]+.07,steel);
   const elbow=pose==='sit'?[side*.25,.86,.24]:[side*.28,1.04,-side*.15],hand=pose==='sit'?[side*.23,.91,.46]:[side*.22,.84,-side*.22];
   bar(g,[side*.21,hip+.46,0],elbow,.068,shirt);bar(g,elbow,hand,.054,skin);orb(g,...hand,.067,.075,.065,skin);
  }
  if(pose==='walk'){box(g,.3,.36,.16,0,1.12,-.2,s.mat(0x927957));}
  return g;
 };
 const wheels=(g,wheelbase,track,r)=>{
  for(const z of [-wheelbase/2,wheelbase/2])for(const side of [-1,1]){
   const tire=mesh(g,cylinder,rubber,[side*track/2,r,z],[r,.2,r]);tire.rotation.z=Math.PI/2;
   const hub=mesh(g,cylinder,s.mat(0xb5bebd),[side*(track/2+.108),r,z],[r*.55,.025,r*.55]);hub.rotation.z=Math.PI/2;
  }
 };
 const shuttle=(x,z,yaw)=>{
  const g=group(x,z,yaw);counts.shuttles++;wheels(g,2.55,1.64,.34);
  box(g,1.85,.26,4.1,0,.58,0,steel);box(g,1.75,.4,.75,0,.82,1.65,steel);box(g,1.8,.28,.45,0,.82,-1.8,steel);
  box(g,1.95,.13,3.65,0,2.18,-.06,steel);box(g,1.5,.025,2.5,0,2.26,-.1,s.mat(0x485d6d));
  for(const side of [-1,1])for(const zz of [-1.7,.35,1.6])bar(g,[side*.86,.74,zz],[side*.86,2.17,zz-.1],.047,steel);
  box(g,1.63,.78,.03,0,1.66,1.51,glass);
  for(const zz of [-1.15,.25]){box(g,1.42,.14,.56,0,.87,zz,ivory);box(g,1.42,.48,.12,0,1.13,zz-.26,ivory);}
  for(const [xx,zz,col] of [[-.4,.27,0x6790a0],[.4,.27,0xd2a36c],[-.4,-1.1,0xe9ded0]])person(g,xx,zz,col,.13,'sit');
  for(const side of [-1,1])box(g,.28,.15,.04,side*.59,.89,2.04,s.mat(0xffedba,{emissive:0xe9bf65,emissiveIntensity:.3}));
  const steering=mesh(g,ring,steel,[-.43,1.19,.98],[.2,.2,.2]);steering.rotation.x=-.55;
 };
 const van=(x,z,yaw)=>{
  const g=group(x,z,yaw);counts.vans++;wheels(g,2.12,1.46,.31);
  box(g,1.66,.23,3.5,0,.52,0,steel);box(g,1.72,1.53,2.02,0,1.35,-.62,yellow);box(g,1.63,.6,1.25,0,.91,1.01,yellow);box(g,1.6,.9,.98,0,1.62,.99,yellow);
  box(g,1.34,.62,.035,0,1.7,1.497,glass);for(const side of [-1,1]){box(g,.025,.57,.63,side*.81,1.7,1.03,glass);box(g,.07,.06,.23,side*.83,1.2,.79,steel);box(g,.2,.12,.025,side*.5,.94,1.66,ivory);}
  box(g,1.28,.035,.03,0,1.43,-1.644,steel);box(g,.04,1.18,.03,0,1.38,-1.65,steel);box(g,1.16,.12,.04,0,.72,1.66,steel);
  // Contrasting parcel symbol on both sides of the cargo box.
  for(const side of [-1,1]){box(g,.026,.47,.7,side*.87,1.5,-.63,ivory);box(g,.029,.055,.7,side*.886,1.5,-.63,yellow);}
 };
 const robot=(x,z,yaw)=>{
  const g=group(x,z,yaw);counts.robots++;wheels(g,.64,.64,.16);box(g,.75,.28,1.02,0,.35,0,blue);box(g,.58,.38,.65,0,.66,-.02,ivory);
  box(g,.13,.8,.13,0,1.18,-.18,ivory);box(g,.43,.17,.3,0,1.65,-.16,ivory);box(g,.3,.08,.025,0,1.65,.002,steel);
  orb(g,-.095,1.66,.025,.03,.03,.02,s.mat(0x43c9d8));orb(g,.095,1.66,.025,.03,.03,.02,s.mat(0x43c9d8));
  box(g,.34,.09,.03,0,.75,.32,steel);
 };
 const cyclist=(x,z,yaw,color)=>{
  const g=group(x,z,yaw);counts.cyclists++;
  for(const zz of [-.7,.7]){const wheel=mesh(g,ring,rubber,[0,.38,zz],[.35,.35,.35]);wheel.rotation.y=Math.PI/2;for(let i=0;i<6;i++){const a=i/6*Math.PI;bar(g,[0,.38+Math.sin(a)*.32,zz+Math.cos(a)*.32],[0,.38-Math.sin(a)*.32,zz-Math.cos(a)*.32],.012,s.mat(0xc1c6c2));}}
  const frame=s.mat(color);for(const [a,b] of [[[0,.38,-.7],[0,.8,-.15]],[[0,.8,-.15],[0,.4,0]],[[0,.4,0],[0,.38,-.7]],[[0,.8,-.15],[0,.87,.49]],[[0,.87,.49],[0,.4,0]],[[0,.87,.49],[0,.38,.7]]])bar(g,a,b,.03,frame);
  box(g,.26,.06,.3,0,.91,-.18,steel);bar(g,[0,.86,.49],[0,1.12,.52],.025,steel);bar(g,[-.29,1.12,.52],[.29,1.12,.52],.025,steel);
  const shirt=s.mat(0xe8d8bd),pants=s.mat(0x567080);
  bar(g,[0,1,-.15],[0,1.51,.08],.19,shirt);orb(g,0,1.72,.16,.16,.19,.16,skin);orb(g,0,1.83,.15,.18,.1,.18,frame);
  for(const side of [-1,1]){bar(g,[side*.16,1.43,.07],[side*.28,1.13,.52],.06,skin);bar(g,[side*.12,1,-.16],[side*.15,.73,.25],.08,pants);bar(g,[side*.15,.73,.25],[side*.17,.45,-side*.16],.065,pants);box(g,.15,.1,.25,side*.17,.42,-side*.16,steel);}
 };
 const kart=(x,z,yaw)=>{
  const g=group(x,z,yaw);counts.karts++;wheels(g,1.65,1.35,.27);
  box(g,1.04,.09,2.15,0,.34,0,steel);for(const side of [-1,1])bar(g,[side*.57,.4,-1.16],[side*.57,.4,1.16],.055,orange);
  for(const zz of [-1.1,-.5,.4,1.05])bar(g,[-.58,.4,zz],[.58,.4,zz],.055,orange);
  box(g,.5,.14,.65,0,.56,-.1,steel);box(g,.52,.55,.12,0,.85,-.4,steel);box(g,.7,.4,.48,0,.64,-.85,s.mat(0x656965));
  bar(g,[0,.43,.46],[0,.92,.37],.045,steel);const steer=mesh(g,ring,steel,[0,.94,.4],[.23,.23,.23]);steer.rotation.x=-.65;person(g,0,-.12,0xc59356,-.15,'sit');
 };
 // Vehicles occupy the opposite lane or stopping bays. The existing Sophicar
 // route runs along x=+1.5 / +30.5 and stays unobstructed.
 shuttle(-20,-1.5,Math.PI/2);shuttle(54,7,Math.PI/2);
 van(-39,20,Math.PI);van(63,31,0);
 robot(66,30,Math.PI);robot(-13,43,Math.PI/2);robot(62,61,0);
 cyclist(-4.8,13,0,0xb36947);cyclist(-36.5,43,0,0x3c8b93);cyclist(9,73.5,Math.PI/2,0xa29741);cyclist(-48,58,0,0xb87742);
 kart(22,26,Math.PI/2);
 const walkers=[[-3.9,12,.3],[-4.1,18,2.8],[4.1,22,0],[4.3,23,2],[-3.9,47,1.2],[4.3,57,.2],[4,59,3],[-19,6,1.4],[-17.7,6,1.4],[13,6,2.1],[14.3,6,2.1],[-20,42,.4],[-18.7,41.7,2.9],[11,51,0],[12.5,51.5,3],[27.6,28,1],[18,28,0],[6,-5.5,.5],[-4,-8,2.2],[9,-7,3],[-22,77,1.6],[2,78,2],[53,73,1],[55,73,2],[90,17,0],[-72,77,1],[-68,77,2],[-69,100,1],[-56,172,0],[-58,173,2],[-55,36,1],[-53.5,36,2]];
 const clothes=[0xe2ded2,0x657c8a,0xd89b69,0x63958a,0x9b7663,0xbdc1ad];
 walkers.forEach(([x,z,yaw],i)=>person(source,x,z,clothes[i%clothes.length],0,'walk',yaw));
 // Bake each geometry/material pair once, preserving each local pose.
 source.updateMatrixWorld(true);const batches=new Map();source.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;if(!batches.has(key))batches.set(key,{geometry:o.geometry,material:o.material,matrices:[]});batches.get(key).matrices.push(o.matrixWorld.clone());});
 for(const b of batches.values()){const inst=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((m,i)=>inst.setMatrixAt(i,m));inst.castShadow=!b.material.transparent;inst.receiveShadow=true;inst.computeBoundingSphere();root.add(inst);}
 s.deck.add(root);s.lifeCounts=counts;
}
