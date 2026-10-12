import * as THREE from 'three';

// Reference-driven architecture. Static details are instanced by material so books,
// mullions, chairs and planted courtyards do not add thousands of draw calls.
export function buildReferenceCampus(s){
 const root=new THREE.Group();root.name='参考图校园 · 建筑与庭院';s.deck.add(root);
 let personCount=0;
 const batches=new Map(),unit=new THREE.BoxGeometry(1,1,1),object=new THREE.Object3D();
 const mat=(color,extra={})=>s.mat(color,extra);
 const box=(w,h,d,x,y,z,m,rot=0)=>{if(!batches.has(m))batches.set(m,[]);batches.get(m).push({w,h,d,x,y,z,rot});};
 const white=mat(0xf4efe4),cream=mat(0xe7ddca),floor=mat(0xd2ae7d),wood=mat(0xa7713e),metal=mat(0x536366),dark=mat(0x283f47),glass=mat(0x80b4c8,{transparent:true,opacity:.19,roughness:.17,depthWrite:false});
 const glow=mat(0xefc589,{emissive:0xeeb969,emissiveIntensity:.2}),blue=mat(0x1379b5),red=mat(0xcc4832),green=mat(0x258568);
 const line=(points,color=0xf6f1de)=>{const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));root.add(new THREE.Line(g,new THREE.LineBasicMaterial({color})));};
 const tube=(points,r,m)=>{const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,r,6,false);const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;root.add(mesh);};
 const add=(geometry,m,x,y,z)=>{const mesh=new THREE.Mesh(geometry,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 const label=(text,x,y,z,w,h,color)=>s.label(text,x,y,z,w,h,color);
 const chair=(x,y,z,color=0xa47547)=>{box(.48,.1,.48,x,y+.43,z,mat(color));box(.48,.6,.1,x,y+.7,z+.22,mat(color));for(const dx of [-.18,.18])for(const dz of [-.16,.16])box(.045,.42,.045,x+dx,y+.2,z+dz,metal);};
 const desk=(x,y,z,type)=>{
  box(2,.12,1,x,y+.74,z,floor);for(const dx of [-.8,.8])for(const dz of [-.35,.35])box(.07,.73,.07,x+dx,y+.36,z+dz,metal);
  if(type==='lab'){box(.8,.36,.56,x,y+1,z,dark);box(.63,.27,.035,x,y+1.03,z-.3,mat(0x96cbd2));box(.35,.22,.35,x+.67,y+.9,z,mat(0xe2a644));}
  else{box(.48,.03,.34,x-.28,y+.82,z-.05,mat(0x6399a5));box(.28,.22,.04,x+.55,y+.92,z+.16,cream);chair(x,y,z+.85);}
 };
 const bookshelf=(x,y,z,w=2.2)=>{
  box(.12,2,.5,x-w/2,y+1,z,wood);box(.12,2,.5,x+w/2,y+1,z,wood);
  for(let f=0;f<4;f++){box(w,.1,.52,x,y+.1+f*.52,z,wood);for(let i=0;i<11;i++)box(.1,.29+(i%3)*.055,.32,x-w/2+.2+i*(w-.3)/11,y+.31+f*.52,z-.03,mat([0xc08345,0x497d87,0xb6523d,0xd6be84][(i+f)%4]));}
 };
 const person=(x,z,color,y=0)=>{
  personCount++;
  add(new THREE.SphereGeometry(.16,8,6),mat(0xddba91),x,y+1.52,z);
  add(new THREE.CapsuleGeometry(.17,.47,3,6),mat(color),x,y+.99,z);
  for(const dx of [-.11,.11])box(.13,.6,.15,x+dx,y+.38,z,dark);
 };
 const shell=(x,z,w,d,h,accent,title,type)=>{
  const floors=3,fh=h/3,minZ=z-d/2,maxZ=z+d/2,minX=x-w/2,maxX=x+w/2;
  box(w+1,.18,d+1,x,.09,z,mat(0xc8c6bc));
  // Open front and east corner, opaque rear with warm interior wall panels.
  box(w,h,.3,x,h/2+.2,maxZ,cream);box(.26,h,d,minX,h/2+.2,z,white);
  for(let f=0;f<=floors;f++)box(w+.5,.18,d+.5,x,.23+f*fh,z,f===floors?white:floor);
  for(let f=0;f<floors;f++){
   const y=.33+f*fh;
   box(w-1.6,fh-.45,.06,x,y+fh/2,maxZ-.19,glow);
   // Wide colour panels make the three reference buildings legible from both sides.
   box(3.2,fh-.12,.4,maxX-1.35,y+fh/2,minZ-.04,accent);
   box(.38,fh-.12,3.4,maxX+.04,y+fh/2,minZ+1.5,accent);
   for(let k=0;k<5;k++){
    const xx=minX+1.1+k*(w-4.7)/4;
    box(.16,fh,.2,xx,y+fh/2,minZ-.12,white);
    if(k<4)box((w-4.7)/4-.15,fh-.4,.035,xx+(w-4.7)/8,y+fh/2,minZ-.08,glass);
   }
   for(let k=0;k<4;k++){
    const zz=minZ+4+k*(d-4.4)/3;
    box(.18,fh,.16,maxX+.12,y+fh/2,zz,white);
    if(k<3)box(.035,fh-.4,(d-4.4)/3-.14,maxX+.08,y+fh/2,zz+(d-4.4)/6,glass);
   }
   box(w+.7,.2,.5,x,y+fh-.02,minZ-.08,white);box(.5,.2,d+.7,maxX+.08,y+fh-.02,z,white);
   // Balcony lines and differentiated interiors, not blank window textures.
   box(w-4.3,.05,.06,x-1.8,y+1.1,minZ-.43,metal);
   for(let k=0;k<9;k++)box(.035,.84,.035,minX+.5+k*(w-4.7)/8,y+.68,minZ-.43,metal);
   if(type==='library'){
    for(let k=0;k<4;k++){bookshelf(minX+2+k*3.1,y,maxZ-1.1);desk(minX+2+k*3.05,y,minZ+2.1,'read');}
    bookshelf(maxX-1.4,y,z+1.7,2.1);
   }else if(type==='lab'){
    for(let k=0;k<3;k++)desk(minX+2+k*3.2,y,minZ+2,'lab');
    for(let k=0;k<3;k++){box(1.9,1.6,.8,minX+2+k*3.2,y+.8,maxZ-.8,mat(0x849a9d));box(1.5,.8,.06,minX+2+k*3.2,y+1.2,maxZ-1.25,dark);}
   }else if(type==='gym'){
    for(let k=0;k<4;k++){
     const xx=minX+1.7+k*3.2;box(1.2,.14,2,xx,y+.13,minZ+2.2,dark);box(.07,1.2,.07,xx-.48,y+.8,minZ+2.8,metal);box(.07,1.2,.07,xx+.48,y+.8,minZ+2.8,metal);box(1,.32,.16,xx,y+1.48,minZ+2.8,dark);
    }
    for(let k=0;k<4;k++)box(1.2,.1,2.2,minX+2+k*3,y+.09,maxZ-2,mat(0x6f9eae));
   }else{
    for(let k=0;k<3;k++){desk(minX+2+k*3.2,y,minZ+2,'read');chair(minX+2+k*3.2,y,minZ+1.15,0x578b76);}
    box(w-3,1.8,.08,x,y+1.45,maxZ-.22,mat(0x3f6868));
   }
   // Visible internal stairs beside the right window wall.
   if(f<2)for(let k=0;k<13;k++)box(1.35,.16,.42,maxX-1.1,y+.14+(k+1)*fh/13,maxZ-1.1-k*.43,white);
   person(minX+2.5+(f%2)*5,minZ+1.05,[0x467184,0xd99558,0x74715e][f],y);
  }
  // Parapets, roof equipment and coloured canopy.
  for(const xx of [minX-.1,maxX+.1])box(.2,.55,d+.5,xx,h+.58,z,white);
  box(w+.5,.55,.2,x,h+.58,maxZ+.1,white);
  box(3.5,.9,2.4,minX+2.5,h+.8,maxZ-2.1,mat(0xe6e3da));
  box(6.1,.13,3.2,x-1,2.8,minZ-1.6,accent);for(const xx of [x-3.7,x+1.7])box(.11,2.75,.11,xx,1.4,minZ-2.95,accent);
  label(title,x,h+1.8,z,10,1.55,accent.color.getHex());
  return {x,z,w,d,h,minX,maxX,minZ,maxZ};
 };
 for(const x of [-16,16])for(const z of [18,54])box(24,.06,27,x,-.01,z,mat(0xdcd6c8));
 const lib=shell(-16,17,18,16,9.9,blue,'图书馆 · 学习中心','library');
 const research=shell(16,17,17,12,9.3,green,'交通研究楼','study');
 const lab=shell(-16,56,18,15,9.9,red,'机器人实验室','lab');
 const gym=shell(16,60,18,15,11.1,mat(0x437e9b),'运动与仿真中心','gym');
 // Red steel-and-glass lab forecourt, as in the supplied illustration.
 const roofGlass=mat(0xa6c9d1,{transparent:true,opacity:.34,roughness:.18,depthWrite:false,side:THREE.DoubleSide});
 box(8.4,.07,4.6,-15,3.5,46.05,roofGlass);
 for(const x of [-19.2,-10.8]){box(.12,.12,4.8,x,3.54,46.05,red);for(const z of [43.7,48.4])box(.12,3.5,.12,x,1.75,z,red);}
 for(const z of [43.7,45.3,46.9,48.4])box(8.5,.1,.1,-15,3.58,z,red);
 // An outdoor lab demonstrator: joints, arm and cabinet on a plinth.
 box(1.1,.18,1.1,-14,.16,44.8,cream);box(.65,1.15,.65,-14,.82,44.8,mat(0xe4d9bf));tube([[-14,1.2,44.8],[-13.6,2.2,44.8],[-12.9,2.4,44.5]],.13,mat(0xde923e));
 // True curved glass roof with blue ribs, not a flat sheet under disconnected arches.
 const rx=7.5,rz=5.8,base=gym.h+.5,positions=[],indices=[];
 for(let j=0;j<=8;j++)for(let i=0;i<=32;i++){const t=i/32*Math.PI;positions.push(16-Math.cos(t)*rx,base+Math.sin(t)*2.5,60-rz+j/8*rz*2);}
 for(let j=0;j<8;j++)for(let i=0;i<32;i++){const a=j*33+i;indices.push(a,a+33,a+1,a+1,a+33,a+34);}
 const vaulted=new THREE.BufferGeometry();vaulted.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));vaulted.setIndex(indices);vaulted.computeVertexNormals();add(vaulted,roofGlass,0,0,0);
 for(let j=0;j<7;j++)tube(Array.from({length:25},(_,i)=>{const t=i/24*Math.PI;return [16-Math.cos(t)*rx,base+Math.sin(t)*2.5,54.2+j*1.933];}),.045,mat(0x4988ab));
 for(const x of [8.5,23.5])box(.08,.08,12,x,base,60,mat(0x4988ab));
 // Digital campus screen mounted on the visible side of the gym.
 const screenCanvas=document.createElement('canvas');screenCanvas.width=512;screenCanvas.height=384;const c=screenCanvas.getContext('2d');
 c.fillStyle='#173843';c.fillRect(0,0,512,384);c.strokeStyle='#65b6c4';c.lineWidth=3;
 const nodes=[[62,104],[180,70],[320,123],[440,86],[96,255],[252,213],[422,278]];
 for(const [a,b] of [[0,1],[1,2],[2,3],[0,4],[4,5],[2,5],[5,6]]){c.beginPath();c.moveTo(...nodes[a]);c.lineTo(...nodes[b]);c.stroke();}
 nodes.forEach(([x,y],i)=>{c.fillStyle=['#d4a154','#7ebb98','#e57b55'][i%3];c.beginPath();c.arc(x,y,10,0,7);c.fill();});c.fillStyle='#d8edef';c.font='22px sans-serif';c.fillText('SOPHI  |  CAMPUS NETWORK',22,34);c.font='16px sans-serif';c.fillText('MOBILITY  /  ROBOTICS  /  DIGITAL TWIN',22,354);
 const screenTex=new THREE.CanvasTexture(screenCanvas);screenTex.colorSpace=THREE.SRGBColorSpace;s.textures.push(screenTex);
 box(.28,4.6,6.4,25.3,7.6,61,dark);const screen=add(new THREE.PlaneGeometry(6,4.2),new THREE.MeshBasicMaterial({map:screenTex}),25.47,7.6,61);screen.rotation.y=Math.PI/2;
 // Court, white markings, hoops and a few people.
 box(19,.08,10.3,16,.055,43,mat(0x558ca5));line([[8,.108,39],[24,.108,39],[24,.108,47],[8,.108,47],[8,.108,39]]);line([[16,.108,39],[16,.108,47]]);
 line(Array.from({length:65},(_,i)=>[16+Math.cos(i/64*Math.PI*2)*1.3,.11,43+Math.sin(i/64*Math.PI*2)*1.3]));
 for(const x of [7.4,24.6]){box(.12,2.9,.12,x,1.45,43,metal);box(.1,1,1.65,x,2.85,43,white);const hoop=add(new THREE.TorusGeometry(.27,.025,6,16),red,x+(x<16?.45:-.45),2.53,43);hoop.rotation.x=Math.PI/2;}
 person(11,42,0xf0b95d);person(20,44,0xe57d4d);person(16,46,0xeee8d5);
 // Entrance gate and security cabin with real doors, window frames and a flat roof.
 for(const x of [-5,5])box(.75,3.4,.85,x,1.7,-5.7,white);box(11.7,.52,.95,0,3.4,-5.7,white);
 box(4.2,2.6,3,-9,1.3,-7,cream);box(4.7,.18,3.5,-9,2.75,-7,white);
 for(const x of [-10.3,-9.1]){box(1,.9,.045,x,1.7,-8.53,mat(0x739aa8));box(.08,1.1,.08,x-.55,1.7,-8.62,white);}
 box(.9,2.1,.05,-7.65,1.1,-8.55,mat(0xa6bfbd));
 // Bicycle shelter, full bikes, benches, light poles and entry paving.
 box(8,.1,3.6,23,2.55,28,roofGlass);for(const x of [19.4,26.6]){box(.08,.08,3.6,x,2.62,28,metal);box(.12,2.6,.12,x,1.3,29.5,metal);}
 for(let i=0;i<7;i++){
  const x=20+i;for(const z of [27.3,28.7]){const wh=add(new THREE.TorusGeometry(.34,.035,6,16),dark,x,.42,z);wh.rotation.y=Math.PI/2;}
  line([[x,.42,27.3],[x,.92,27.9],[x,.42,28.7],[x,.75,28.1],[x,.42,27.3]],0x434d4c);box(.12,.05,.35,x,1.02,28,wood);box(.6,.05,.05,x,1.05,27.45,metal);
 }
 for(const [x,z] of [[-22,29],[-10,29],[10,7],[24,7],[-10,41],[28,65]]){box(2.5,.18,.7,x,.61,z,wood);box(2.5,.5,.12,x,.87,z+.33,wood);for(const dx of [-1,1])box(.1,.55,.55,x+dx,.3,z,metal);}
 for(const [x,z] of [[-27,6],[27,6],[-5.8,30],[5.8,30],[-27,68],[27,68]]){box(.12,4.1,.12,x,2.05,z,metal);box(.8,.18,.45,x,4.12,z,white);}
 for(const x of [-24,-16,-2,2,14,22])box(1.35,.025,3.6,x,.008,-7.5,white);
 for(const [x,z,color] of [[-3,-7,0x527887],[3,-5,0xdba667],[6,8,0xddd8c6],[-5,43,0x7c9c8a],[-11,44,0xb88652]])person(x,z,color);
 // Dense individual planting islands leave roads and building doors clear.
 const gardens=[];
 for(const x of [-26.5,-5.5,5.5,26.5])for(const z of [7,28.8,66.5])gardens.push([x,z,2.5,3]);
 for(const x of [-21,-11,11,21])gardens.push([x,5.8,5.5,2.1]);
 for(const z of [43,50,57,64])gardens.push([-26.7,z,2.2,4.3]);
 for(const z of [52,59,66])gardens.push([27,z,2,4.3]);
 for(const [x,z,w,d] of gardens){box(w,.18,d,x,.09,z,mat(0xd2cbb7));box(w-.2,.1,d-.2,x,.19,z,mat(0x82754c));s.gardens.push({x,z,w:w-.3,d:d-.3});}
 for(const x of [-26.4,-5.6,5.6,26.4])for(const z of [7,29,66.5])s.tree(x,z,{size:.85,planter:false});
 for(const z of [43,50,57,64])s.tree(-26.7,z,{size:.78,planter:false});
 for(const z of [53,60,67])s.tree(27,z,{size:.7,planter:false});
 for(const x of [-41,-37.8,39.5,43.5])for(let z=-8;z<83;z+=5.2){if(Math.abs(z)<5&&x>35)continue;s.tree(x,z,{size:1.05,planter:true});}
 for(let x=-29;x<31;x+=4.8)if(Math.abs(x)>7)s.tree(x,-11,{size:.85,planter:true});
 for(let x=-24;x<=28;x+=5.2)s.tree(x,80,{size:.95,planter:true});
 // Companion pavilions give the enlarged grounds additional usable architecture.
 s.building(-71,84,15,8,4.3,0xb98249,'湖畔咖啡 · 休憩');
 s.building(54,54,15,9,6.4,0x527f89,'创新工坊 · 机器人');
 for(const [x,z] of [[-80,82],[-62,82],[44,48],[44,59],[63,48],[63,59]])s.tree(x,z,{size:.95});
 // More teaching / social buildings in the extension, outside the road network.
 shell(-12,87,18,8,7.2,mat(0xbb7856),'创意教学楼','study');
 shell(55,82,18,10,7.8,mat(0x558c84),'学生交流中心','library');
 shell(95,28,12,16,6.6,mat(0xc79846),'智能交通工坊','lab');
 // Planted courtyards with clear front-door approaches, never on driving lanes.
 const extraBeds=[[-21,-6,8,2],[21,-6,8,2],[-5.5,17,2,6],[5.5,17,2,6],[-5.5,53,2,6],[5.5,54,2,7],[-16,40.9,9,1.6],[16,49.8,9,1.6],[-26,76.5,4,2],[-16,76.5,7,2],[14,76.5,8,2],[25,76.5,4,2],[55,71,12,2.4],[67,79,2.2,7],[44,89,2.2,5],[95,16,9,2],[85.8,23,2,5],[85.8,34,2,5],[95,40,10,2.6],[94,52,11,3],[94,73,11,3],[54,12,12,2.5],[64,22,2,6],[54,43,10,2.6],[65,54,2,6],[-83,84,2,6],[-59,84,2,6],[-72,91,10,2]];
 for(const [x,z,w,d] of extraBeds){box(w,.2,d,x,.1,z,mat(0xd2cbb7));box(w-.22,.08,d-.22,x,.22,z,mat(0x82754c));s.gardens.push({x,z,w:w-.45,d:d-.45});}
 for(const [x,z] of [[67,87],[43,87],[89,42],[101,42],[88,52],[101,52],[88,73],[101,73],[-24,89],[0,90]])s.tree(x,z,{size:.8});
 // Two compact stopping bays keep parked service vehicles off the active route.
 box(10,.03,4.7,54,.005,7,mat(0xc7c4bb));box(5,.03,6.2,63,.005,31,mat(0xc7c4bb));
 for(const x of [50,54,58])box(.09,.014,4.2,x,.028,7,white);
 // Flush immutable geometry into a small number of draws.
 for(const [material,items] of batches){const mesh=new THREE.InstancedMesh(unit,material,items.length);mesh.name='校园细节 · '+items.length+' 件';items.forEach((a,i)=>{object.position.set(a.x,a.y,a.z);object.rotation.set(0,a.rot,0);object.scale.set(a.w,a.h,a.d);object.updateMatrix();mesh.setMatrixAt(i,object.matrix);});mesh.castShadow=!material.transparent;mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);}
 s.referenceDetailCounts={buildings:9,people:personCount,staticBoxes:[...batches.values()].reduce((n,v)=>n+v.length,0)};
}
