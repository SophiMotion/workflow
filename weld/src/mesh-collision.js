import {Matrix4,Vector3,Ray,DoubleSide} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
const trees=new WeakMap(),boxes=new WeakMap();
function tree(g){if(!trees.has(g))trees.set(g,new MeshBVH(g));g.boundsTree=trees.get(g);return trees.get(g);}
function bounds(mesh){if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);}
function contains(container,other){
 const point=new Vector3().fromBufferAttribute(other.geometry.attributes.position,0).applyMatrix4(other.matrixWorld).applyMatrix4(container.matrixWorld.clone().invert());
 if(!container.geometry.boundingBox.containsPoint(point))return false;
 const hits=tree(container.geometry).raycast(new Ray(point,new Vector3(.831,.427,.357).normalize()),DoubleSide),distances=hits.map(h=>h.distance).sort((a,b)=>a-b).filter((d,i,a)=>d>1e-8&&(i===0||d-a[i-1]>1e-7));
 return distances.length%2===1;
}
export function collisionPair(a,b,clearance=5,cached=false){
 const boxA=cached?boxes.get(a.mesh):bounds(a.mesh),boxB=cached?boxes.get(b.mesh):bounds(b.mesh),gap=clearance/1000;
 if(!boxA.clone().expandByScalar(gap).intersectsBox(boxB))return null;
 const transform=new Matrix4().copy(a.mesh.matrixWorld).invert().multiply(b.mesh.matrixWorld),bvh=tree(a.mesh.geometry);tree(b.mesh.geometry);
 if(bvh.intersectsGeometry(b.mesh.geometry,transform)||contains(a.mesh,b.mesh)||contains(b.mesh,a.mesh))return {link:a.name,obstacle:b.name,gap:0,collision:true};
 const result={};bvh.closestPointToGeometry(b.mesh.geometry,transform,result,{},0,gap);
 if(result.distance!==undefined&&result.distance<gap)return {link:a.name,obstacle:b.name,gap:result.distance*1000,collision:false};return null;
}
export function checkCollisionWorld(robots,environment,clearance=5){
 const hits=[],near=[],tested=new Set(),links=robots.flatMap(r=>r.colliders),guns=robots.flatMap(r=>r.gunColliders),all=[...links,...guns];
 for(const c of [...all,...environment])boxes.set(c.mesh,bounds(c.mesh));
 const check=(a,b)=>{const key=[a.name,b.name].sort().join('|');if(tested.has(key))return;tested.add(key);const hit=collisionPair(a,b,clearance,true);if(hit){(hit.collision?hits:near).push({...hit,station:a.station,otherStation:b.station||null});if(hit.collision){a.visual?.material.emissive.set('#862a14');b.visual?.material.emissive.set('#862a14');}}};
 for(const a of all)for(const b of environment)check(a,b);
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];if(a.station===b.station){if(a.role==='gun'&&b.role==='gun')continue;if(a.role==='robot'&&b.role==='robot'&&(Math.abs(a.index-b.index)<=1||/cylinder|piston/.test(a.name)&&b.index<=4||/cylinder|piston/.test(b.name)&&a.index<=4))continue;if((a.role==='gun'&&b.index>=5)||(b.role==='gun'&&a.index>=5))continue;}check(a,b);}
 return {hits,near,minimum:near.length?Math.min(...near.map(h=>h.gap)):hits.length?0:null,pairs:tested.size,coverage:'native link meshes + gun arms / BIW, clamps, conveyor, cabinets, fence / non-adjacent self and inter-station pairs'};
}
export function collectColliders(group,name,station=null){const result=[];group.traverse(mesh=>{if(mesh.isMesh&&!mesh.isInstancedMesh)result.push({mesh,name:name+' #'+result.length,station,role:'environment'});});return result;}
