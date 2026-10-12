import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
// Image + video interpretation. Estimated metric proportions, front -Z, wheels about X.
export function buildReferenceRover(){
 const root=new T.Group();root.name='Sophi 开放式智能试验车 · 视频曲面版';
 const blue=new T.MeshPhysicalMaterial({color:0x254e83,metalness:.58,roughness:.24,clearcoat:1,clearcoatRoughness:.16,envMapIntensity:1.6});
 const cream=new T.MeshStandardMaterial({color:0xe5d7bd,roughness:.56});
 const black=new T.MeshStandardMaterial({color:0x20272d,roughness:.48,metalness:.28});
 const rubber=new T.MeshStandardMaterial({color:0x22262b,roughness:.88});
 const chrome=new T.MeshStandardMaterial({color:0xc5ccd3,roughness:.22,metalness:.9,envMapIntensity:1.5});
 const darkMetal=new T.MeshStandardMaterial({color:0x485462,roughness:.32,metalness:.78});
 const orange=new T.MeshStandardMaterial({color:0xe59824,roughness:.4,metalness:.55});
 const glass=new T.MeshPhysicalMaterial({color:0x91b5cb,metalness:.15,roughness:.08,transparent:true,opacity:.27,side:T.DoubleSide,depthWrite:false,clearcoat:1,envMapIntensity:1.5});
 const led=new T.MeshStandardMaterial({color:0xe3f8ff,emissive:0xa8dbff,emissiveIntensity:1.7});
 const red=new T.MeshStandardMaterial({color:0xb32337,emissive:0xa01227,emissiveIntensity:1.1});
 const sensor=new T.MeshPhysicalMaterial({color:0x0b5578,metalness:.7,roughness:.18,clearcoat:1});
 const fabric=new T.MeshStandardMaterial({color:0xbbae96,roughness:1});
 const stitch=new T.MeshStandardMaterial({color:0x746e66,roughness:1});
 function mesh(g,m,p=[0,0,0],parent=root){const o=new T.Mesh(g,m);o.position.fromArray(p);o.castShadow=!m.transparent;o.receiveShadow=!m.transparent;parent.add(o);return o;}
 function box(size,p,m=blue,parent=root,r=.035){return mesh(r?new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(n=>n*.44))):new T.BoxGeometry(...size),m,p,parent);}
 function cylinder(r,h,p,m=chrome,parent=root,segments=32){return mesh(new T.CylinderGeometry(r,r,h,segments),m,p,parent);}
 function bar(a,b,r=.025,m=darkMetal,parent=root){const v=new T.Vector3(...a),w=new T.Vector3(...b),o=mesh(new T.CylinderGeometry(r,r,v.distanceTo(w),12),m,v.clone().add(w).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),w.sub(v).normalize());return o;}
 function tube(points,r,m=blue){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),48,r,12,false),m);}
 function pane(rows,m=glass){const pos=[],idx=[],cols=16;for(let j=0;j<rows.length;j++){const [y,z,w,bow]=rows[j];for(let i=0;i<=cols;i++){const t=i/cols*2-1;pos.push(t*w,y+(.01*(1-t*t)),z-bow*(1-t*t));}}for(let j=0;j<rows.length-1;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;idx.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return mesh(g,m);}
 box([1.46,.19,3.34],[0,.57,.01],black);box([1.60,.12,3.10],[0,.75,.05],cream);
 // Continuous rounded nose and tail, large curved glass and inset capsule lamps.
 box([1.78,.43,.51],[0,1.16,-1.59],blue,root,.18);
 box([1.80,.42,.46],[0,1.13,1.58],blue,root,.17);
 box([1.56,.19,.045],[0,1.21,-1.86],chrome,root,.06);
 box([1.53,.163,.049],[0,1.21,-1.883],black,root,.06);
 for(const y of [1.165,1.255])box([1.48,.024,.014],[0,y,-1.912],led,root,.011);
 box([1.53,.15,.045],[0,1.22,1.817],chrome,root,.06);box([1.49,.104,.04],[0,1.22,1.85],red,root,.047);
 pane([[1.36,-1.68,.76,.08],[1.53,-1.48,.77,.08],[1.77,-1.19,.78,.06],[2.02,-.78,.77,.03]]);
 pane([[1.34,1.64,.76,-.02],[1.63,1.52,.78,-.025],[2.04,1.25,.77,-.015]]);
 // Solid bevelled side shells with large open door apertures.
 for(const side of [-1,1]){
  const sh=new T.Shape();sh.moveTo(1.74,1.03);sh.quadraticCurveTo(1.81,1.21,1.63,1.47);sh.lineTo(.78,2.04);sh.quadraticCurveTo(.62,2.17,.39,2.15);sh.lineTo(-1.15,2.13);sh.quadraticCurveTo(-1.40,2.12,-1.48,1.9);sh.lineTo(-1.76,1.19);sh.quadraticCurveTo(-1.8,.97,-1.56,.84);sh.lineTo(-1.12,.66);sh.lineTo(.96,.66);sh.quadraticCurveTo(1.24,.70,1.30,.99);sh.lineTo(1.74,1.03);
  const hole=new T.Path();hole.moveTo(1.31,1.37);hole.lineTo(.63,1.96);hole.quadraticCurveTo(.51,2.02,.36,2.01);hole.lineTo(-1.13,2.0);hole.quadraticCurveTo(-1.24,2.,-1.3,1.85);hole.lineTo(-1.53,1.24);hole.quadraticCurveTo(-1.58,1.10,-1.38,1.04);hole.lineTo(-1.02,.81);hole.lineTo(.83,.81);hole.quadraticCurveTo(1.02,.84,1.06,1.10);hole.lineTo(1.31,1.37);sh.holes.push(hole);
  const g=new T.ExtrudeGeometry(sh,{depth:.085,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.027,bevelThickness:.023,curveSegments:18});g.rotateY(Math.PI/2);mesh(g,blue,[side*.82-(side<0?.085:0),0,0]);
  tube([[side*.805,.80,-1.00],[side*.805,.81,-.3],[side*.805,.81,.7],[side*.805,.87,1.13],[side*.805,1.1,1.42]],.035,cream);
  tube([[side*.85,.77,.37],[side*.85,1.1,.26],[side*.85,1.67,.31],[side*.85,2.035,.39]],.056,blue);
  box([.13,.045,2.02],[side*.9,.69,.25],chrome);for(let j=0;j<18;j++)box([.15,.005,.04],[side*.92,.718,-.61+j*.095],black,root,0);
  box([.07,.27,.59],[side*.85,1.15,1.28],black,root,.065);
  for(let j=0;j<8;j++)box([.078,.012,.47],[side*.857,1.05+j*.026,1.28],darkMetal,root,0);
 }
 // Panoramic roof: transparent panels, cream headlining and thin blue rails.
 pane([[2.055,-.75,.76,0],[2.085,-.38,.79,0],[2.09,.34,.79,0],[2.075,.89,.79,0],[2.045,1.25,.76,0]]);
 for(const z of [-.73,.37,1.24]){box([1.60,.08,.115],[0,2.046,z],blue,root,.045);box([1.49,.025,.10],[0,1.992,z],cream);}
 for(const x of [-.77,.77])box([.07,.045,1.95],[x,1.985,.24],cream);
 // Sculpted upholstery with woven inserts and piping, visible through open sides.
 for(const x of [-.40,.40])for(const z of [-.38,.75]){
  box([.60,.095,.64],[x,.88,z],black);box([.59,.18,.60],[x,.99,z],cream,root,.08);
  const back=box([.59,.68,.21],[x,1.32,z+.24],cream,root,.088);back.rotation.x=-.11;
  box([.34,.23,.18],[x,1.77,z+.27],cream,root,.075);
  box([.36,.44,.028],[x,1.33,z+.122],fabric,root,.013);box([.35,.018,.39],[x,1.084,z-.03],fabric,root,.005);
  for(let i=0;i<9;i++){const dx=(i-4)*.038;box([.003,.41,.003],[x+dx,1.33,z+.106],stitch,root,0);box([.003,.002,.36],[x+dx,1.095,z-.03],stitch,root,0);}
  for(let i=0;i<11;i++)box([.34,.003,.003],[x,1.135+i*.038,z+.104],stitch,root,0);
  for(let i=0;i<9;i++)box([.34,.002,.003],[x,1.096,z-.19+i*.04],stitch,root,0);
  for(const dx of [-.28,.28])box([.065,.075,.43],[x+dx,1.16,z+.015],cream);
  bar([x+.22,1.64,z+.14],[x-.19,1.075,z-.2],.014,black);
 }
 box([1.35,.14,.29],[0,1.26,-1.16],black);box([.27,.17,.025],[.15,1.37,-1.05],sensor);
 const steering=mesh(new T.TorusGeometry(.177,.019,10,40),black,[-.40,1.38,-.96]);steering.rotation.x=-.5;
 for(const dx of [-.12,.12])bar([-.4,1.38,-.96],[-.4+dx,1.42,-.98],.014,chrome);
 bar([-.40,1.12,-1.19],[-.40,1.38,-.96],.024,chrome);
 for(const z of [-1.79,1.74]){
  box([.47,.48,.16],[0,.68,z],black,root,.06);box([.69,.12,.18],[0,.4,z],chrome);
  for(const x of [-.23,0,.23]){const o=cylinder(.046,.027,[x,.41,z+(z<0?-.1:.1)],x===0?black:z<0?led:red);o.rotation.x=Math.PI/2;}
 }
 const emblem=new T.MeshStandardMaterial({color:0x165bea,emissive:0x1549d4,emissiveIntensity:.5});
 for(const [a,b] of [[[-.12,.85,-1.885],[.13,.85,-1.885]],[[-.12,.85,-1.885],[-.15,.78,-1.885]],[[-.15,.78,-1.885],[.12,.73,-1.885]],[[.12,.73,-1.885],[.08,.66,-1.885]],[[.08,.66,-1.885],[-.15,.66,-1.885]]])bar(a,b,.019,emblem);
 function lidar(x,y,z,r=.08){cylinder(r,.035,[x,y,z]);cylinder(r*.94,.115,[x,y+.075,z],sensor);cylinder(r,.028,[x,y+.148,z]);}
 lidar(0,2.25,-.27,.13);for(const x of [-.13,.13])bar([x,2.10,-.43],[x*.7,2.24,-.27],.023,black);
 for(const [x,y,z] of [[-.9,1.10,-1.56],[.9,1.10,-1.56],[-.77,2.07,1.31],[.77,2.07,1.31]])lidar(x,y,z,.063);
 for(const x of [-.53,0,.53]){box([.13,.09,.10],[x,2.16,-.66],black);const lens=cylinder(.028,.013,[x,2.16,-.721],sensor);lens.rotation.x=Math.PI/2;}
 // Detailed open alloy rims, visible discs, tread blocks and coilover suspension.
 for(const x of [-.90,.90])for(const z of [-1.31,1.32]){
  const side=Math.sign(x),wheel=new T.Group();wheel.name='drive-wheel-'+x+'-'+z;wheel.position.set(x,.42,z);wheel.userData.rollingRadius=.42;root.add(wheel);
  const tire=mesh(new T.TorusGeometry(.30,.12,16,64),rubber,[0,0,0],wheel);tire.rotation.y=Math.PI/2;
  const disc=cylinder(.235,.024,[-side*.043,0,0],darkMetal,wheel);disc.rotation.z=Math.PI/2;
  for(const xx of [-.07,.08]){const rim=mesh(new T.TorusGeometry(.273,.018,10,64),chrome,[xx,0,0],wheel);rim.rotation.y=Math.PI/2;}
  const hub=cylinder(.071,.18,[0,0,0],chrome,wheel);hub.rotation.z=Math.PI/2;
  for(let n=0;n<10;n++){const a=n*Math.PI/5;bar([side*.09,Math.cos(a)*.075,Math.sin(a)*.075],[side*.085,Math.cos(a+.14)*.253,Math.sin(a+.14)*.253],.019,chrome,wheel);}
  for(let n=0;n<5;n++){const a=n*Math.PI*2/5;const bolt=cylinder(.012,.019,[side*.107,Math.cos(a)*.05,Math.sin(a)*.05],black,wheel,8);bolt.rotation.z=Math.PI/2;}
  for(let n=0;n<64;n++)for(const row of [-1,0,1]){const a=n*Math.PI/32+row*.022;const tread=box([.065,.008,.034],[row*.067,Math.cos(a)*(.418-Math.abs(row)*.012),Math.sin(a)*(.418-Math.abs(row)*.012)],rubber,wheel,0);tread.rotation.x=a;}
  for(const y of [.36,.58])for(const dz of [-.19,.19])bar([x*.44,y+.055,z+dz],[x*.89,y,z],.028,chrome);
  const a=new T.Vector3(x*.60,.88,z),b=new T.Vector3(x*.89,.40,z),axis=b.clone().sub(a),sideVec=new T.Vector3(0,0,1),normal=new T.Vector3().crossVectors(axis,sideVec).normalize();
  bar(a.toArray(),b.toArray(),.029,chrome);const pts=[];for(let i=0;i<=100;i++){const f=i/100,ang=f*Math.PI*16;pts.push(a.clone().addScaledVector(axis,f).addScaledVector(sideVec,Math.cos(ang)*.053).addScaledVector(normal,Math.sin(ang)*.053));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),128,.010,6,false),chrome);
  bar([x*.48,.69,z-.22],[x*.67,.43,z+.04],.02,orange);
 }
 root.userData={source:'User image and video bob 2026-10-10 23.22.05.mp4',dimensionsAssumed:true,frontAxis:'-Z'};return root;
}
