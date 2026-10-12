import { engineering } from './domain.mjs';
const PI=Math.PI;
export function robotModel(c){
  const L=c.length/1000,W=c.width/1000,R=c.wheel/2000,H=c.mast/1000,z=R+.06;
  const bodies=[];
  const add=(id,parent,position,shape,size,mass,color,extra={})=>bodies.push({id,parent,position,shape,size,mass,color,offset:[0,0,0],rotation:[0,0,0],joint:'fixed',axis:[0,0,1],...extra});
  add('base_link','base_footprint',[0,0,z],'box',[L,W,.1],c.material==='steel'?21*L*W/.288:11*L*W/.288,'dark');
  add('deck','base_link',[0,0,z+.056],'box',[L-.008,W-.008,.012],1.6,'metal');
  add('battery','base_link',[-L*.15,0,z],'box',[.18,.14,.065],c.batteryAh*.18,'battery');
  add('controller','base_link',[L*.20,0,z],'box',[.08,.08,.028],.3,'green');
  for(const [side,y] of [['left',W/2+.043],['right',-W/2-.043]])for(const [end,x] of [['front',L*.34],['rear',-L*.34]]){
    add(`${end}_${side}_wheel`,'base_link',[x,y,R],'cylinder',[R,.075],1.4,'rubber',{rotation:[PI/2,0,0],joint:'continuous',axis:[0,1,0],effort:c.motor==='350w'?28:20,velocity:20});
    add(`${end}_${side}_motor`,'base_link',[x,y>0?W/2-.015:-W/2+.015,R],'cylinder',[R*.48,.05],1.2,'metal',{rotation:[PI/2,0,0]});
  }
  add('mast','deck',[0,0,z+.07],'cylinder',[.020,H],H*2.3,'metal',{offset:[0,0,H/2]});
  add('mast_mount','deck',[0,0,z+.076],'box',[.14,.13,.016],.5,'metal');
  if(c.arm!=='none'){
    const shoulder=z+.07+H*.93,spread=W*.43;
    add('shoulder_bar','mast',[0,0,shoulder],'cylinder',[.022,spread*2],.8,'metal',{rotation:[PI/2,0,0]});
    add('support_bar','mast',[0,0,z+.07+H*.49],'cylinder',[.020,W*.45],.5,'metal',{rotation:[PI/2,0,0]});
    const n=engineering(c).armDof/2,len=H*.48/n;
    for(const s of [-1,1]){
      const prefix=s===1?'left':'right';let parent='shoulder_bar';
      for(let i=0;i<n;i++){
        const id=`${prefix}_arm_${i+1}`;
        add(id,parent,[0,s*spread,shoulder-i*len],'cylinder',[.016,len],.6,'metal',{offset:[0,0,-len/2],joint:'revolute',axis:i%2?[0,1,0]:[1,0,0],lower:-PI/2,upper:PI/2,effort:8,velocity:1.5});parent=id;
      }
    }
    for(const s of [-1,1])add(s===1?'left_brace':'right_brace','deck',[0,s*W*.2,z+.07],'cylinder',[.014,H*.49],.7,'metal',{offset:[0,0,H*.245]});
  }
  if(c.lidar!=='none')add('lidar_link','deck',[L*.33,0,z+.115],'cylinder',[c.lidar==='a1'?.045:.055,.055],c.lidar==='a1'?.17:.27,'sensor');
  if(c.camera!=='none')add('camera_link','mast',[.035,0,z+.07+H*.83],'box',[.03,.09,.027],.12,'sensor');
  if(c.imu)add('imu_link','base_link',[0,0,z+.025],'box',[.025,.02,.009],.02,'green');
  if(c.estop)add('estop_link','deck',[-L*.34,-W*.30,z+.083],'cylinder',[.021,.025],.07,'red');
  return bodies;
}
const n=v=>Number(v.toFixed(7));
const vec=v=>v.map(n).join(' ');
export function inertia(b){const m=b.mass;let x,y,z;if(b.shape==='box'){const [a,c,d]=b.size;[x,y,z]=[m*(c*c+d*d)/12,m*(a*a+d*d)/12,m*(a*a+c*c)/12];}else{const [r,h]=b.size;[x,y,z]=[m*(3*r*r+h*h)/12,m*(3*r*r+h*h)/12,m*r*r/2];if(Math.abs(b.rotation[0])>.1)[y,z]=[z,y];}return [x,y,z].map(n);}
export function urdf(c){
  const bodies=robotModel(c),byId=Object.fromEntries(bodies.map(b=>[b.id,b]));
  const colors={dark:'.12 .14 .14 1',metal:'.68 .71 .73 1',rubber:'.06 .065 .07 1',sensor:'.14 .17 .17 1',battery:'.22 .27 .32 1',green:'.28 .40 .24 1',red:'.8 .08 .07 1'};
  let xml=`<?xml version="1.0"?>\n<!-- SophiStudio parametric concept geometry. SI units; X forward, Y left, Z up. Inertia estimates require measured replacement. -->\n<robot name="skatechassis">\n  <link name="base_footprint"/>\n`;
  for(const b of bodies){
    const g=b.shape==='box'?`<box size="${vec(b.size)}"/>`:`<cylinder radius="${n(b.size[0])}" length="${n(b.size[1])}"/>`;
    const [ix,iy,iz]=inertia(b),origin=`<origin xyz="${vec(b.offset)}" rpy="${vec(b.rotation)}"/>`;
    xml+=`  <link name="${b.id}">\n    <visual>${origin}<geometry>${g}</geometry><material name="${b.color}"><color rgba="${colors[b.color]}"/></material></visual>\n    <collision>${origin}<geometry>${g}</geometry></collision>\n    <inertial><origin xyz="${vec(b.offset)}"/><mass value="${n(b.mass)}"/><inertia ixx="${ix}" ixy="0" ixz="0" iyy="${iy}" iyz="0" izz="${iz}"/></inertial>\n  </link>\n`;
    const p=byId[b.parent]?.position||[0,0,0],jointPos=b.position.map((v,i)=>v-p[i]);
    xml+=`  <joint name="${b.id}_joint" type="${b.joint}"><parent link="${b.parent}"/><child link="${b.id}"/><origin xyz="${vec(jointPos)}" rpy="0 0 0"/>`;
    if(b.joint!=='fixed') xml+=`<axis xyz="${vec(b.axis)}"/><limit effort="${b.effort}" velocity="${b.velocity}"${b.joint==='revolute'?` lower="${n(b.lower)}" upper="${n(b.upper)}"`:''}/><dynamics damping="0.1" friction="0.05"/>`;
    xml+='</joint>\n';
  }return xml+'</robot>\n';
}
