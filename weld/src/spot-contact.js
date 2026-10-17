import {Vector3} from 'three';
import {bodyPoints} from './line-data.js';
export const sheetMetal=p=>p.bodyModel!=='legacy';
export function contactState(pose,project){
 const thickness=project.params.thickness/1000,stack=thickness*2,gap=project.engineering.gunStroke/1000*pose.gunOpening;
 const f=pose.kind==='weld'?pose.phaseProgress:['hold','open','retreat'].includes(pose.kind)?1:0;
 const target=pose.id?new Vector3(...bodyPoints(project)[pose.id].p):null;
 const aligned=!!target&&pose.root.distanceTo(target)<.00005&&pose.reachable!==false&&pose.normal.dot(new Vector3(0,0,1))>Math.cos(Math.PI/180);
 const dent=aligned?indentationProfile(project.outcome,0).depth*f*f*(3-2*f):0;
 const front=pose.root.clone().addScaledVector(pose.normal,gap-dent),back=pose.root.clone().addScaledVector(pose.normal,-stack);
 const seated=aligned&&gap<.00001,pressing=seated&&['squeeze','weld','hold','manual-close'].includes(pose.kind),current=pressing&&pose.kind==='weld'?project.engineering.spotCurrent:0;
 return {thickness:thickness*1000,stack:stack*1000,opening:gap*1000,indentation:dent*1000,front:front.toArray(),back:back.toArray(),frontGap:aligned?gap*1000:null,backGap:aligned?0:null,aligned,seated,pressing,current,force:pressing?project.engineering.gunForce*(pose.kind==='squeeze'?Math.min(1,pose.phaseProgress*3):1):0,phase:pose.kind};
}

// A revolved shallow depression; coordinates are metres, front surface at z=0.
export function indentationProfile(outcome,age){
 const scale=outcome==='under'?.9:outcome==='over'?1.15:1;
 return {radius:.0045*scale,depth:(outcome==='over'?.00022:outcome==='under'?.000035:.00009),heat:Math.max(0,1-age/4)};
}
