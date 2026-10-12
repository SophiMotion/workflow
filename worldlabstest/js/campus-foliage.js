import * as THREE from 'three';

// A single batch per geometry supplies mature, multi-lobed tree canopies and
// low planting. All coordinates stay outside the driving meshes.
export function buildCampusFoliage(s){
 const group=new THREE.Group();group.name='校园植被 · 乔木 / 灌木 / 花池';s.deck.add(group);
 let seed=61927;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const crowns=[],leaves=[],trunks=[],branches=[],planters=[],shrubs=[],flowers=[];
 const palette=[0x526b31,0x667d3d,0x728847,0x81914e,0x4c6b38,0x929d55];
 for(const tree of s.treeSpecs){
  const size=tree.size??1,stretch=.9+rand()*.24,h=(4.7+rand()*.8)*size,rad=1.58*size;
  const {x,z}=tree;
  trunks.push({p:[x,1.34*size,z],scale:[.19*size,2.7*size,.19*size],color:0x856b48});
  if(tree.planter!==false)planters.push({p:[x,.12,z],scale:[1.02*size,.24,1.02*size],color:0xbcbba6});
  for(let j=0;j<5;j++){
   const a=j/5*Math.PI*2+rand()*.4,dx=Math.cos(a)*rad*.62,dz=Math.sin(a)*rad*.62;
   const start=new THREE.Vector3(x,1.9*size,z),end=new THREE.Vector3(x+dx,3.6*size,z+dz),diff=end.clone().sub(start);
   branches.push({p:start.clone().add(end).multiplyScalar(.5).toArray(),scale:[.075*size,diff.length(),.075*size],q:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize()),color:0x89744e});
  }
  crowns.push({p:[x,h-.85*size,z],scale:[rad*.84,1.4*size,rad*.84],color:palette[Math.floor(rand()*palette.length)]});
  for(let j=0;j<13;j++){
   const a=j*2.39996,layer=j<8?0:1,r=rad*(layer?.58:.75),yy=h-(layer?.5:1.35)*size;
   crowns.push({p:[x+Math.cos(a)*r,yy+(rand()-.5)*.6*size,z+Math.sin(a)*r],scale:[(.66+rand()*.28)*size,(.67+rand()*.35)*size,(.67+rand()*.26)*size],color:palette[Math.floor(rand()*palette.length)]});
  }
  // Small edge clusters make crowns read as foliage rather than a single sphere.
  for(let j=0;j<65;j++){
   const a=rand()*Math.PI*2,v=rand()*2-1,r=Math.sqrt(1-v*v),rr=rad*(.94+rand()*.19);
   leaves.push({p:[x+Math.cos(a)*r*rr,h-.85*size+v*1.4*size,z+Math.sin(a)*r*rr],scale:[.22*size,.3*size,.23*size],color:palette[Math.floor(rand()*palette.length)]});
  }
 }
 for(const bed of s.gardens){
  const n=Math.ceil(bed.w*bed.d*5.2);
  for(let i=0;i<n;i++){
   const x=bed.x+(rand()-.5)*bed.w,z=bed.z+(rand()-.5)*bed.d,r=.19+rand()*.19;
   shrubs.push({p:[x,.3+rand()*.17,z],scale:[r,.24+rand()*.22,r*.85],color:palette[Math.floor(rand()*palette.length)]});
   if(i%2===0)for(let bloom=0;bloom<3;bloom++)flowers.push({p:[x+(rand()-.5)*.22,.64+rand()*.15,z+(rand()-.5)*.22],scale:[.13,.1,.13],color:[0xf0c344,0xf5e5c3,0xeeac54,0xb691bd,0xd78576][i%5]});
  }
 }
 const dummy=new THREE.Object3D(),color=new THREE.Color();
 const batch=(name,items,geometry,material)=>{
  if(!items.length)return;
  const m=new THREE.InstancedMesh(geometry,material,items.length);m.name=name;
  items.forEach((a,i)=>{dummy.position.fromArray(a.p);dummy.scale.fromArray(a.scale);dummy.quaternion.copy(a.q||new THREE.Quaternion());dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);color.setHex(a.color);m.setColorAt(i,color);});
  m.instanceMatrix.needsUpdate=true;m.castShadow=true;m.receiveShadow=true;m.computeBoundingSphere();group.add(m);
 };
 const bark=s.mat(0xffffff,{roughness:1}),leaf=s.mat(0xffffff,{roughness:.92});
 batch('树干',trunks,new THREE.CylinderGeometry(.75,1,1,8),bark);
 batch('树枝',branches,new THREE.CylinderGeometry(.55,1,1,6),bark);
 batch('乔木树冠',crowns,new THREE.IcosahedronGeometry(1,1),leaf);
 batch('树冠叶簇',leaves,new THREE.IcosahedronGeometry(1,0),leaf);
 batch('独立树池',planters,new THREE.CylinderGeometry(1,1.07,1,12),bark);
 batch('灌木',shrubs,new THREE.IcosahedronGeometry(1,1),leaf);
 batch('花卉',flowers,new THREE.IcosahedronGeometry(1,0),leaf);
 s.foliageCounts={trees:s.treeSpecs.length,crownClusters:crowns.length+leaves.length,shrubs:shrubs.length,flowers:flowers.length};
}
