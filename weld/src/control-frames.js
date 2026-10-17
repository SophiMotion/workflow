import {Matrix4,Vector3,Euler,Quaternion} from 'three';
export const FRAME_AXES=['X','Y','Z','Rx','Ry','Rz'];
export const frameDefaults=()=>({tcp:[0,0,0,0,0,0],work:[0,0,0,0,0,0]});
export function stationFrames(project,station){return project.controlFrames?.[station]||frameDefaults();}
export function validateFrames(frames={}){
 const result={};
 for(const [station,config] of Object.entries(frames)){
  if(!['OP10','OP20','OP30'].includes(station))throw Error('坐标工位无效');
  result[station]=frameDefaults();
  for(const kind of ['tcp','work']){
   const v=config?.[kind];if(!Array.isArray(v)||v.length!==6)throw Error('坐标需包含 X / Y / Z / Rx / Ry / Rz');
   v.forEach((n,i)=>{const limit=kind==='tcp'?(i<3?100:30):(i<3?1000:180);if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>limit)throw Error(`${kind} ${FRAME_AXES[i]} 需在 ±${limit} ${i<3?'mm':'°'} 内`);});result[station][kind]=[...v];
  }
 }return result;
}
// Millimetres / degrees. Fixed-axis rotations: Rz * Ry * Rx.
export function frameMatrix(v){const r=Math.PI/180;return new Matrix4().compose(new Vector3(...v.slice(0,3)).multiplyScalar(.001),new Quaternion().setFromEuler(new Euler(v[3]*r,v[4]*r,v[5]*r,'ZYX')),new Vector3(1,1,1));}
export function gunFrame(pose){return new Matrix4().makeBasis(pose.tangent,pose.normal,pose.tangent.clone().cross(pose.normal)).setPosition(pose.root);}
export function poseFromFrame(m){const e=m.elements;return {root:new Vector3().setFromMatrixPosition(m),tangent:new Vector3(...e.slice(0,3)).normalize(),normal:new Vector3(...e.slice(4,7)).normalize()};}
export function programmedPose(raw,frames){return {...raw,...poseFromFrame(frameMatrix(frames.work).multiply(gunFrame(raw)))};}
export function physicalTarget(raw,frames){return {...raw,...poseFromFrame(frameMatrix(frames.work).multiply(gunFrame(raw)).multiply(frameMatrix(frames.tcp).invert()))};}
export function calibratedTCP(actual,frames){return poseFromFrame(gunFrame(actual).multiply(frameMatrix(frames.tcp)));}
