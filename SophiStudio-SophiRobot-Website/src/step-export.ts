import {Vector3} from 'three';
import {deform,roleOf,type Model} from './geometry';
import {limbMatrix,type LimbPoses} from './limbs';
import type {Params} from './parameters';
import {headMatrix,neutralHead,type HeadPose} from './head';
const quote=(s:string)=>"'"+s.replace(/[^\x20-\x7e]/g,'?').replace(/'/g,"''")+"'";
const real=(n:number)=>{if(!Number.isFinite(n))throw new Error('Nonfinite geometry cannot be exported.');const s=(Math.abs(n)<1e-10?0:n).toFixed(8).replace(/0+$/,'');return s.endsWith('.')?s:s.includes('.')?s:s+'.';};
export function exportPreviewStep(model:Model,p:Params,poses:LimbPoses,cover:boolean,progress:(done:number,total:number)=>void=()=>{},head:HeadPose=neutralHead()){
 const chunks:Uint8Array<ArrayBuffer>[]=[];const encoder=new TextEncoder();let buffer='',serial=0,triangles=0,bodyCount=0;
 const write=(s:string)=>{buffer+=s;if(buffer.length>262144){chunks.push(encoder.encode(buffer));buffer='';}};
 const add=(s:string)=>{const id='#'+(++serial);write(id+'='+s+';\n');return id;};
 write("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('SophiRobot faceted preview geometry; not native parametric CAD'),'2;1');\nFILE_NAME('SophiRobot-preview.step','"+new Date().toISOString().slice(0,19)+"',('SophiStudio'),('SophiStudio'),'SophiStudio','SophiRobot','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n");
 const app=add("APPLICATION_CONTEXT('automotive design')");add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,${app})`);
 const pc=add(`PRODUCT_CONTEXT('',${app},'mechanical')`),product=add(`PRODUCT('SophiRobot','SophiRobot','Faceted website preview',(${pc}))`),formation=add(`PRODUCT_DEFINITION_FORMATION('','',${product})`),definitionContext=add(`PRODUCT_DEFINITION_CONTEXT('part definition',${app},'design')`),definition=add(`PRODUCT_DEFINITION('design','',${formation},${definitionContext})`),pds=add(`PRODUCT_DEFINITION_SHAPE('','',${definition})`);
 const length=add('(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.))'),angle=add('(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.))'),solid=add('(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT())'),uncertainty=add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.000001),${length},'distance_accuracy_value','')`),context=add(`(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((${uncertainty})) GLOBAL_UNIT_ASSIGNED_CONTEXT((${length},${angle},${solid})) REPRESENTATION_CONTEXT('',''))`);
 const shapes:string[]=[];const source=model.meshes.filter(m=>cover||roleOf(m)!=='cover');
 for(const mesh of source){
  const positions=deform(mesh,p),matrix=limbMatrix(mesh.id,p,poses).multiply(headMatrix(mesh.id,p,head));const points:string[]=[],coords:Vector3[]=[],unique=new Map<string,number>(),index:number[]=[];
  for(let i=0;i<positions.length;i+=3){const v=new Vector3(positions[i],positions[i+1],positions[i+2]).applyMatrix4(matrix),key=[real(v.x),real(v.y),real(v.z)].join(',');let ix=unique.get(key);if(ix===undefined){ix=coords.length;unique.set(key,ix);coords.push(v);points.push(add(`CARTESIAN_POINT('',(${key}))`));}index.push(ix);}
  const faces:string[]=[],edges=new Map<string,{count:number;direction:number}>();
  for(let i=0;i<mesh.indices.length;i+=3){const ia=index[mesh.indices[i]],ib=index[mesh.indices[i+1]],ic=index[mesh.indices[i+2]];const a=coords[ia],b=coords[ib],c=coords[ic];if(!a||!b||!c)throw new Error('Invalid triangle index in '+mesh.name);
   const tangent=b.clone().sub(a),normal=tangent.clone().cross(c.clone().sub(a));if(normal.lengthSq()<1e-18)continue;normal.normalize();tangent.normalize();
   const n=add(`DIRECTION('',(${real(normal.x)},${real(normal.y)},${real(normal.z)}))`),t=add(`DIRECTION('',(${real(tangent.x)},${real(tangent.y)},${real(tangent.z)}))`),axis=add(`AXIS2_PLACEMENT_3D('',${points[ia]},${n},${t})`),plane=add(`PLANE('',${axis})`),loop=add(`POLY_LOOP('',(${points[ia]},${points[ib]},${points[ic]}))`),bound=add(`FACE_OUTER_BOUND('',${loop},.T.)`);
   faces.push(add(`FACE_SURFACE('',(${bound}),${plane},.T.)`));triangles++;
   for(const [u,v] of [[ia,ib],[ib,ic],[ic,ia]]){const key=u<v?u+':'+v:v+':'+u,e=edges.get(key)||{count:0,direction:0};e.count++;e.direction+=u<v?1:-1;edges.set(key,e);}
  }
  if(!faces.length)throw new Error('No valid faces in '+mesh.name);
  const closed=[...edges.values()].every(e=>e.count===2&&e.direction===0),shell=add(`${closed?'CLOSED_SHELL':'OPEN_SHELL'}(${quote(mesh.name)},(${faces.join(',')}))`);
  shapes.push(add(`SHELL_BASED_SURFACE_MODEL(${quote(mesh.name)},(${shell}))`));bodyCount++;progress(bodyCount,source.length);
 }
 if(!shapes.length)throw new Error('No visible components to export.');
 const representation=add(`MANIFOLD_SURFACE_SHAPE_REPRESENTATION('SophiRobot faceted preview',(${shapes.join(',')}),${context})`);add(`SHAPE_DEFINITION_REPRESENTATION(${pds},${representation})`);
 write('ENDSEC;\nEND-ISO-10303-21;\n');if(buffer)chunks.push(encoder.encode(buffer));return {chunks,triangles,bodyCount};
}
