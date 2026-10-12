import * as THREE from 'three';
import {ROAD,CAMPUS,roadTiles,roadRoute,roadZone} from './road-profile.mjs';
import {SITE,TEST,VIEWS,onTestLane,testZone,testRoute,raceRoute,routeKind} from './expansion-profile.mjs';
import {groundTop} from './view-precision.mjs';
import {expandedRoute} from './fleet-routes.mjs';
import {buildExpansion} from './campus-expansion.js';
import {buildReferenceCampus} from './campus-reference.js';
import {buildCampusLife} from './campus-life.js';
import {buildCampusFoliage} from './campus-foliage.js';

// A complete, watertight campus ground replaces the warped generated terrain in work mode.
// The original Marble asset is kept intact in its separate reference view.
export class TestRoad {
 constructor(){
  this.exclusive=true;this.root=new THREE.Group();this.root.name='未来校园 · 运动湖区与综合试验场';this.root.matrixAutoUpdate=false;
  this.deck=new THREE.Group();this.deck.position.fromArray(ROAD.anchor);this.deck.rotation.y=THREE.MathUtils.degToRad(ROAD.yaw);this.root.add(this.deck);
  this.textures=[];this.driveMeshes=[];this.materials=new Map();this.treeSpecs=[];this.gardens=[];
  const ground=this.box(SITE.maxX-SITE.minX,.6,SITE.maxZ-SITE.minZ,(SITE.maxX+SITE.minX)/2,groundTop-.3,(SITE.maxZ+SITE.minZ)/2,this.mat(0xdedfd9));this.driveMeshes.push(ground);
  const asphalt=new THREE.MeshStandardMaterial({map:this.texture(false),color:0xc2c3c4,roughness:.94});
  this.asphalt=asphalt;
  const gravel=new THREE.MeshStandardMaterial({map:this.texture(true),color:0x6d899f,roughness:1});
  for(const t of roadTiles()){
   const g=new THREE.PlaneGeometry(t.x1-t.x0,t.z1-t.z0);g.rotateX(-Math.PI/2);
   const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(t.x1-t.x0)/2,uv.getY(i)*(t.z1-t.z0)/2);
   const m=new THREE.Mesh(g,t.gravel?gravel:asphalt);m.position.set((t.x0+t.x1)/2,0,(t.z0+t.z1)/2);m.receiveShadow=true;this.deck.add(m);this.driveMeshes.push(m);
  }
  this.markings();buildReferenceCampus(this);this.water();buildExpansion(this);buildCampusLife(this);buildCampusFoliage(this);
 }
 mat(color,extra={}){const key=JSON.stringify([color,extra]);if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.82,...extra}));return this.materials.get(key);}
 box(w,h,d,x,y,z,material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.deck.add(m);return m;}
 texture(gravel){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');let seed=gravel?12:73;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  c.fillStyle=gravel?'#b5b5b5':'#aaaaaa';c.fillRect(0,0,256,256);
  for(let i=0;i<12000;i++){const v=Math.floor((gravel?120:161)+rand()*(gravel?70:18));c.fillStyle=`rgb(${v},${v},${v})`;const s=gravel?1+rand()*3:1;c.fillRect(rand()*256,rand()*256,s,s);}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;this.textures.push(t);return t;
 }
 markings(){
  const white=new THREE.MeshBasicMaterial({color:0xf4f6f5,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  for(const x of CAMPUS.vertical){
   for(let z=6;z<68;z+=4){if(Math.abs(z-36)<5)continue;this.box(.12,.008,1.8,x,.012,z,white);}
   for(const s of [-1,1])for(const [a,b] of [[4,32],[40,68]])this.box(.1,.006,b-a,x+s*3.02,.009,(a+b)/2,white);
  }
  for(const z of CAMPUS.horizontal){
   for(let x=-26;x<28;x+=4){if(Math.abs(x)<5)continue;this.box(1.8,.008,.12,x,.012,z,white);}
   for(const s of [-1,1])for(const [a,b] of [[-28,-4],[4,28]])this.box(b-a,.006,.1,(a+b)/2,.009,z+s*3.02,white);
  }
  for(const z of [29.5,42.5])for(let i=0;i<8;i++)this.box(.45,.012,1.65,-2.7+i*.77,.018,z,white);
  // A start line leaves the lane unobstructed.
  this.box(2.5,.012,.18,1.55,.018,5,white);
 }
 building(x,z,w,d,h,color,name){
  const wall=this.mat(0xe9e5da),accent=this.mat(color),glass=this.mat(0x86afbd,{roughness:.22,metalness:.15,transparent:true,opacity:.34});
  const floors=Math.max(1,Math.round(h/3)),floorHeight=h/floors;
  this.box(w+1,.16,d+1,x,.08,z,this.mat(0xc5c9c7));
  // Open glass-fronted floors echo the reference's cutaway architecture.
  this.box(w,h,.32,x,h/2+.16,z+d/2,wall);for(const side of [-1,1])this.box(.3,h,d,x+side*w/2,h/2+.16,z,wall);
  for(let f=0;f<=floors;f++)this.box(w+.3,.16,d+.25,x,.18+f*floorHeight,z,f===floors?this.mat(0xf2f1e9):this.mat(0xd4bea0));
  this.box(1.4,h,.45,x-w/2+1,h/2+.2,z-d/2,accent);
  for(let f=0;f<floors;f++){
   const y=.28+f*floorHeight;
   for(let k=0;k<Math.floor((w-2)/3);k++){
    const xx=x-w/2+3+k*3;
    this.box(.16,floorHeight,.22,xx-1.2,y+floorHeight/2,z-d/2,wall);
    this.box(2.65,floorHeight-.35,.055,xx+.25,y+floorHeight/2,z-d/2+.04,glass);
    this.box(1.65,.14,.95,xx,y+.7,z-d/2+2.2,this.mat(0xb68d57));
    for(const dx of [-.58,.58])this.box(.09,.6,.1,xx+dx,y+.34,z-d/2+2.2,this.mat(0x8a7963));
    this.box(.65,.08,.55,xx+.2,y+.82,z-d/2+2.1,this.mat(0x497488));
   }
   this.box(w,.2,.3,x,y+floorHeight-.05,z-d/2,wall);
   // Soft amber rear panels keep interiors visible even in the overview.
   this.box(w-2,floorHeight-.6,.08,x,y+floorHeight/2,z+d/2-.25,this.mat(0xd5af73,{emissive:0x9c6422,emissiveIntensity:.13}));
  }
  this.box(w+.6,.25,d+.6,x,h+.4,z,this.mat(0xf8f5ed));
  for(const side of [-1,1])this.box(.2,.38,d+.6,x+side*(w/2+.2),h+.7,z,wall);
  this.box(w+.6,.38,.2,x,h+.7,z+d/2+.2,wall);
  this.box(5,.16,2.8,x,2.75,z-d/2-1.3,accent);
  for(const dx of [-2.2,2.2])this.box(.09,2.7,.09,x+dx,1.4,z-d/2-2.4,accent);
  this.label(name,x,h+1.55,z,Math.max(7,w*.72),1.5,color);
 }
 tree(x,z,options={}){this.treeSpecs.push({x,z,...options});}
 water(){
  this.waterMaterial=new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec3 p; varying vec3 wp; void main(){p=position;vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 p; varying vec3 wp; uniform float time; void main(){float ripple=sin(p.x*2.2+sin(p.z*.8)+time*.6)*sin(p.z*1.7-time*.5);float swell=.5+.5*sin(p.x*.16+p.z*.19+sin(p.z*.23)+time*.1);float f=pow(1.-abs(normalize(cameraPosition-wp).y),3.);float sparkle=pow(max(0.,ripple),12.);gl_FragColor=vec4(mix(vec3(.06,.28,.35),vec3(.43,.68,.74),.19+swell*.08+f*.4+sparkle*.035),1.);}`});

 }
 label(text,x,y,z,w,h,color){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=144;const c=canvas.getContext('2d');c.fillStyle='#'+color.toString(16).padStart(6,'0');c.fillRect(0,0,768,144);c.fillStyle='white';c.font='500 54px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,72);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:true}));s.position.set(x,y,z);s.scale.set(w,h,1);this.deck.add(s);
 }
 sign(text,x,z,color){this.label(text,x,2,z,4,.75,color);this.box(.07,1.6,.07,x,.8,z,this.mat(0x87969d));}
 sync(mapMatrix){const base=new THREE.Matrix4().makeRotationX(Math.PI).multiply(new THREE.Matrix4().makeTranslation(0,-27.2877197265625,0)).multiply(new THREE.Matrix4().makeScale(3.0701990127563477,3.0701990127563477,3.0701990127563477));this.root.matrix.copy(mapMatrix).multiply(base.invert());this.root.updateMatrixWorld(true);}
 routePoints(preset){const kind=routeKind(preset);return expandedRoute(kind).map(p=>this.deck.localToWorld(new THREE.Vector3(...p)).toArray());}
 local(point){return this.deck.worldToLocal(point.clone());}
 contains(point){const p=this.local(point);return p.x>=SITE.minX&&p.x<=SITE.maxX&&p.z>=SITE.minZ&&p.z<=SITE.maxZ;}
 project(ray){return ray.intersectObjects(this.driveMeshes,false)[0]??null;}
 zone(point){const p=this.local(point);return onTestLane(p.x,p.z)?testZone(p.z):p.z>90&&p.x>-34?'赛车赛道':roadZone(p.x,p.z);}
 view(name){const v=VIEWS[name]||VIEWS.overview;return {position:this.deck.localToWorld(new THREE.Vector3(...v.position)).toArray(),target:this.deck.localToWorld(new THREE.Vector3(...v.target)).toArray()};}
 dispose(){this.root.removeFromParent();const seen=new Set();this.root.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}for(const m of [o.material].flat())if(m&&!seen.has(m)){seen.add(m);m.dispose();}});this.textures.forEach(t=>t.dispose());}
}
