import * as THREE from 'three';
import {assetUrl,jsonAsset,isFilePreview,packedAssetKey} from './local-assets.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {cameraClipping} from './view-precision.mjs';
import {TrafficController,trafficOverlaps} from './traffic-controller.mjs';
import {FLEET_ASSIGNMENTS} from './fleet-routes.mjs';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SparkRenderer,SplatMesh} from '@sparkjsdev/spark';
import {buildSophicar} from './sophicar-adapter.js';
import {VEHICLES,buildCatalogVehicle,rollWheels} from './vehicle-catalog.js';
import {tickDrive,drivePose,validDrive} from './fleet-motion.mjs';
import {buildRobot} from './robot-adapter.js';
import {pathLength,samplePath,sampleAxlePose,advancePlayback} from './route-math.mjs';
import {TerrainSurface} from './terrain-surface.js';
import {TestRoad} from './test-road.js';
import {ROUTE_OPTIONS,routeKind} from './expansion-profile.mjs';
const $=id=>document.getElementById(id);
const STORE='sophi-worlds-composition-v2';
const DEFAULT_SCENE_URL='data/campus-default.json';
let referenceMode=false,originalMode=false;
const DEFAULT={Aluminum_profile_dimensions:40,frame_total_long:2140,frame_total_width:910,wheel_base:1683,front_width:450,front_long:450,frame_high:350,track_width:1400,Seat_Y:-16.05,cameraModel:'MaixCAM',lidarModel:'Mid360'};
const models=[],localFiles=new Map(),drives=new Map();let hudTime=0;let selected=null,mapMesh=null,mapFrame=null,spark=null,busy=false,mode='orbit',playing=false,distance=0,lastTime=0;
let world={name:'浙大地图 · 待导入',kind:null,url:'',file_name:'',marble_url:'',world_id:'',scale:1,ground_offset:0,axis_flip:true,position:[0,0,0],yaw:0,calibrated:false};
let route={object_id:null,points:[],speed:1,loop:false};
const surface=new TerrainSurface();let testRoad=null,routeSamples=[],routeError='',terrainError='';
const scene=new THREE.Scene();scene.background=new THREE.Color('#eef1f4');
const camera=new THREE.PerspectiveCamera(45,1,.02,10000);camera.position.set(4,3.2,4.5);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('canvasHost').append(renderer.domElement);
const environmentRoom=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(environmentRoom,.04).texture;scene.environmentIntensity=.45;environmentRoom.dispose();pmrem.dispose();
const traffic=new TrafficController();
function collisionSize(m){
 let size=m.root.userData.trafficSize;if(!size){m.root.updateMatrixWorld(true);const inverse=m.root.matrixWorld.clone().invert(),b=new THREE.Box3();m.root.traverse(o=>{if(o.isMesh&&!o.userData.presentationOnly){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));}});size={width:Math.max(.1,Math.abs(b.min.x)*2,Math.abs(b.max.x)*2),length:Math.max(.1,Math.abs(b.min.z)*2,Math.abs(b.max.z)*2)};m.root.userData.trafficSize=size;}return {width:size.width*m.scale,length:size.length*m.scale};
}
function trafficEntries(){return models.filter(m=>m.root).map(m=>({id:m.id,size:collisionSize(m),drive:drives.get(m.id)?.playing?drives.get(m.id):null,pose:{position:m.position,yaw:m.yaw}})).filter(e=>!e.drive||e.drive.samples.length>1);}
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.6,0);controls.maxDistance=10000;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xf4faff,0x8b969c,1.8));const sun=new THREE.DirectionalLight(0xfff3df,2.8);sun.position.set(90,200,-100);sun.target.position.set(-30,0,80);scene.add(sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:1,far:550});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.00025;sun.shadow.normalBias=.03;scene.add(sun);
const grid=new THREE.GridHelper(100,100,0xa0b392,0xc7d2be);grid.position.y=-.01;scene.add(grid);
const routeGroup=new THREE.Group();scene.add(routeGroup);
const selectionBox=new THREE.Box3Helper(new THREE.Box3(),0x679253);selectionBox.visible=false;scene.add(selectionBox);
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function resize(){const {width,height}=$('canvasHost').getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe($('canvasHost'));resize();
function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,5500);$('status').textContent=msg}
function number(id,min=-100000,max=100000){const n=Number($(id).value);if($(id).value.trim()===''||!Number.isFinite(n)||n<min||n>max)throw Error(`${$(id).closest('label')?.childNodes[0]?.textContent.trim()||id}：请输入 ${min} 到 ${max} 的数值`);return n}
function cleanUrl(v){if(!v)return '';const u=new URL(v,location.href);if((!['http:','https:'].includes(u.protocol)&&!(isFilePreview&&u.protocol==='file:'&&packedAssetKey(u.href)))||u.username||u.password)throw Error('请输入 HTTP / HTTPS 资产地址');return u.href}
function dispose(root){if(!root)return;root.removeFromParent();if(root instanceof SplatMesh){root.dispose();return}const seen=new Set();root.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose()}for(const m of [o.material].flat()){if(m&&!seen.has(m)){seen.add(m);m.dispose()}}})}
async function run(label,fn){if(busy)return;busy=true;$('loading').textContent=label;$('loading').hidden=false;const elems=[...document.querySelectorAll('button,input,select')];const states=elems.map(x=>x.disabled);elems.forEach(x=>x.disabled=true);try{return await fn()}catch(e){toast(e.message||'操作未完成');console.error('Workbench:',e.message)}finally{busy=false;$('loading').hidden=true;elems.forEach((x,i)=>x.disabled=states[i]);updateRun()}}
function fit(root){const b=root instanceof THREE.Box3?root:new THREE.Box3().setFromObject(root);if(b.isEmpty())return;const c=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3()).length();const r=Math.max(size*.78,1.5);camera.position.copy(c).add(new THREE.Vector3(r*.9,r*.65,r));controls.target.copy(c);camera.near=Math.max(.08,r/100);camera.far=Math.max(1000,r*25);camera.updateProjectionMatrix();controls.update()}
function modelBounds(root){const b=new THREE.Box3();root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh&&!o.userData.presentationOnly){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return b;}
function focusVehicle(m){
 if(!m?.root)return;const b=modelBounds(m.root),center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3()).length(),factor=Math.max(.36,size/4.8),yaw=THREE.MathUtils.degToRad(m.yaw),probe=new THREE.Raycaster(),obstacles=[];testRoad?.root.traverse(o=>{if(o.isMesh&&o.visible)obstacles.push(o)});let eye;
 for(const offset of [[2.7,3.0,-5],[-2.7,3.0,-5],[0,4.6,-6],[1,7,-3],[0,10,0]]){eye=center.clone().add(new THREE.Vector3(...offset).multiplyScalar(factor).applyAxisAngle(new THREE.Vector3(0,1,0),yaw));const delta=eye.clone().sub(center);probe.set(center,delta.clone().normalize());probe.far=delta.length();if(!testRoad||!probe.intersectObjects(obstacles,false).some(h=>h.distance>.2&&h.distance<delta.length()-.15))break;}
 $('followCar').checked=false;applyCamera({position:eye.toArray(),target:center.toArray()});camera.near=.05;camera.updateProjectionMatrix();
}
function allBox(){const b=new THREE.Box3();for(const m of models)if(m.root)b.expandByObject(m.root);if(mapMesh){if(mapMesh instanceof SplatMesh)b.union(mapMesh.getBoundingBox().clone().applyMatrix4(mapMesh.matrixWorld));else b.expandByObject(mapMesh)}return b}
function syncList(){const chips=$('fleetObjects');chips.replaceChildren();for(const m of models){if(!VEHICLES[m.kind])continue;const b=document.createElement('button');b.textContent=m.name+' · '+(drives.get(m.id)?.route.name||'未配路线');b.setAttribute('aria-pressed',String(m===selected));b.onclick=()=>{select(m);if(m.root)focusVehicle(m);};chips.append(b);}const list=$('instanceList');list.replaceChildren();$('count').textContent=String(models.length).padStart(2,'0');for(const m of models){const b=document.createElement('button');b.textContent=(m.root?'◇  ':'↻  ')+m.name+(m.root?'':' · 需重选文件');b.setAttribute('aria-pressed',String(m===selected));b.onclick=()=>{select(m);if(!m.root)toast('此本地 GLB 需重新选择原文件；导入相同文件名即可恢复。')};list.append(b)}}
function select(m){stashDrive();selected=m;const d=drives.get(m?.id);route=d?.route||{object_id:m?.id||null,points:[],speed:2,loop:true};distance=d?.distance||0;playing=!!d?.playing;$('speed').value=route.speed;updateRoute();$('progress').value=routeLength()?distance/routeLength()*100:0;$('emptySelection').hidden=!!m;$('inspector').hidden=!m;syncList();syncInspector();selectionBox.visible=!!m?.root&&mode==='place';if(m?.root)selectionBox.box.setFromObject(m.root)}
function syncInspector(){if(!selected)return;const m=selected;$('selectedName').textContent=m.name;$('selectedKind').textContent=VEHICLES[m.kind]?.source|| (m.kind==='robot'?'SOPHISTUDIO · 概念机器人':'自有 GLB 模型');$('objectName').value=m.name;['posX','posY','posZ'].forEach((id,i)=>$(id).value=m.position[i].toFixed(3));$('yaw').value=m.yaw.toFixed(1);$('objectScale').value=m.scale;$('carParams').hidden=m.kind!=='sophicar';if(m.kind==='sophicar'){$('frameLength').value=m.params.frame_total_long;$('frameWidth').value=m.params.frame_total_width;$('wheelbase').value=m.params.wheel_base}if(m.root){const d=modelBounds(m.root).getSize(new THREE.Vector3());$('objectSize').textContent=`当前包围盒：${d.x.toFixed(2)} × ${d.y.toFixed(2)} × ${d.z.toFixed(2)} m · 俯仰 ${(m.pitch||0).toFixed(1)}°`}}
function transform(m){if(!m.root)return;m.root.position.fromArray(m.position);m.root.rotation.set(THREE.MathUtils.degToRad(m.pitch||0),THREE.MathUtils.degToRad(m.yaw),0,'YXZ');m.root.scale.setScalar(m.scale);m.root.updateMatrixWorld(true);if(m===selected)selectionBox.box.setFromObject(m.root)}
async function makeModel(m){if(m.kind==='sophicar')return buildSophicar(m.params);if(m.kind==='robot')return buildRobot();if(VEHICLES[m.kind]?.file)return buildCatalogVehicle(m.kind);const file=localFiles.get(m.file_name);if(!file&&!m.url)return null;const url=file?URL.createObjectURL(file):cleanUrl(m.url);try{const g=(await new GLTFLoader().loadAsync(url)).scene;g.scale.setScalar(m.asset_scale||1);g.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(g);if(box.isEmpty())throw Error('GLB 没有可见几何');g.position.y-=box.min.y;const root=new THREE.Group();root.add(g);return root}finally{if(file)URL.revokeObjectURL(url)}}
async function addModel(kind,extra={}){const m={id:crypto.randomUUID(),kind,name:VEHICLES[kind]?.name||(kind==='sophicar'?'线控底盘 '+(models.filter(x=>x.kind===kind).length+1):kind==='robot'?'移动机器人 '+(models.filter(x=>x.kind===kind).length+1):'自有模型'),params:{...DEFAULT},position:[models.length*2.2,0,0],yaw:0,scale:1,...extra};m.root=await makeModel(m);models.push(m);if(m.root){scene.add(m.root);transform(m)}select(m);return m}
function syncCameraPreset(){const i=(world.camera_presets||[]).findIndex(v=>vec(v.position)&&vec(v.target)&&camera.position.distanceTo(new THREE.Vector3(...v.position))<.05&&controls.target.distanceTo(new THREE.Vector3(...v.target))<.05);$('cameraPreset').value=i<0?'':String(i);}
controls.addEventListener('end',syncCameraPreset);
function applyCamera(view){if(!view||!vec(view.position)||!vec(view.target))return;const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;camera.position.fromArray(view.position);controls.target.fromArray(view.target);camera.near=Math.max(.3,Math.min(5,camera.position.distanceTo(controls.target)/80));camera.far=1800;camera.updateProjectionMatrix();controls.update();syncCameraPreset();}
function syncSurface(){ $('terrainStatus').textContent=testRoad?'校园主路与赛车赛道保持平整；独立测试道路提供崎岖、砂石、浅水、搓衣板路面。':surface.root?'已接入地面网格 · 路线按地形高度采样':world.collider_url?'地面网格未就绪：'+terrainError:'无地面网格 · 使用 Y=0 平面';}
function syncWorld(){ const views=world.camera_presets||[];$('cameraPreset').hidden=!views.length;$('cameraPreset').replaceChildren(new Option('自由视角',''),...views.map((v,i)=>new Option(v.name,String(i))));syncCameraPreset(); $('mapName').value=world.name;$('worldScale').value=world.scale;$('groundOffset').value=world.ground_offset;$('axisFlip').checked=world.axis_flip;['mapX','mapY','mapZ'].forEach((id,i)=>$(id).value=world.position[i]);$('mapYaw').value=world.yaw;$('calibrated').checked=world.calibrated;$('mapBadge').textContent=testRoad?'扩展校园 · 五大区域':mapMesh?(world.concept?'4×校园 · 概念生成':'地图已载入 · '+(world.calibrated?'已标定':'待标定')):'待加载校园地图';$('mapQuality').hidden=!world.quality_urls;if(world.quality_urls)$('quality').value=world.quality||'full_res';$('qualityDetail').textContent=mapMesh?.numSplats?`${(mapMesh.numSplats/10000).toFixed(1)} 万点 · ${world.quality==='full_res'?'已用归档最高精度；缺失细节仍需重建。':'可切换精细资产改善显示。'}`:'';syncSurface();if(mapMesh){const box=mapBounds() instanceof THREE.Box3?mapBounds():new THREE.Box3().setFromObject(mapMesh);const size=box.getSize(new THREE.Vector3());$('worldExtent').textContent='资产包围范围：'+[size.x,size.y,size.z].map(n=>n.toFixed(1)).join(' × ')+' m（含外围生成区域）';}$('viewLabel').textContent=mapMesh?world.name:'装配预览 · 尚未加载校园地图';$('modeBadge').textContent='1 格 = 1 m · '+(world.calibrated&&mapMesh?'地图已标定':'地图未标定');syncSceneLayers();}
function transformMap(){if(!mapMesh)return;mapMesh.scale.setScalar(world.scale);mapMesh.position.set(0,-world.ground_offset,0);mapFrame.rotation.set(world.axis_flip?Math.PI:0,0,0);const parent=mapFrame.parent;parent.position.fromArray(world.position);parent.rotation.y=THREE.MathUtils.degToRad(world.yaw);parent.updateMatrixWorld(true);surface.transform(world);if(testRoad)testRoad.sync(mapMesh.matrixWorld);syncWorld()}
async function loadMap(source,metadata={}){pauseFleet();let mesh;const file=source instanceof File;let url=file?URL.createObjectURL(source):cleanUrl(source);const ext=(file?source.name:new URL(url).pathname).split('.').pop().toLowerCase();try{
 if(!['spz','ply','glb'].includes(ext))throw Error('地图请使用 .spz、.ply 或自包含 .glb 文件');
 url=await assetUrl(url);
 if(ext==='glb'){mesh=(await new GLTFLoader().loadAsync(url)).scene;if(new THREE.Box3().setFromObject(mesh).isEmpty())throw Error('GLB 中没有可见几何')}
 else{if(!spark){spark=new SparkRenderer({renderer,apertureAngle:0,preBlurAmount:0});scene.add(spark)}const bytes=file?new Uint8Array(await source.arrayBuffer()):isFilePreview&&packedAssetKey(source)?new Uint8Array(await (await fetch(url)).arrayBuffer()):null;const fileName=file?source.name:new URL(source,location.href).pathname.split('/').pop();mesh=bytes?new SplatMesh({fileBytes:bytes,fileName,lod:false,enableLod:false}):new SplatMesh({url,fileName,lod:false,enableLod:false});await mesh.initialized;if(!mesh.numSplats)throw Error('Splat 资产没有可显示的点')}
 // Commit only after success, preserving the previous map on a failed load.
 if(mapMesh){const old=mapFrame.parent;dispose(mapMesh);old.removeFromParent()}
 mapMesh=mesh;const parent=new THREE.Group();mapFrame=new THREE.Group();parent.add(mapFrame);mapFrame.add(mesh);scene.add(parent);
 world={name:world.name,marble_url:'',world_id:'',concept:false,quality_urls:null,collider_url:'',demo_route:null,engineered_road:null,kind:ext,url:file?'':source,file_name:file?source.name:'',scale:1,ground_offset:0,axis_flip:ext!=='glb',calibrated:false,position:[0,0,0],yaw:0,...metadata};
 if(file)localFiles.set(source.name,source);transformMap();setupRoad();terrainError='';try{await surface.load(world.collider_url?await assetUrl(cleanUrl(world.collider_url)):'',world)}catch(e){surface.clear();terrainError=e.message||'加载失败'}syncSurface();updateRoute();fit(mapMesh instanceof SplatMesh?mapMesh.getBoundingBox().clone().applyMatrix4(mapMesh.matrixWorld):mapMesh);toast(world.concept?'概念校园已载入；场地为设计扩展，尺度未经测绘验证。':'地图已载入。请确认地面朝向和已知尺寸后再标定。');
 }catch(e){if(mesh&&mesh!==mapMesh)dispose(mesh);throw e}finally{if(file)URL.revokeObjectURL(url)} }
function setupRoad(){
 if(testRoad)testRoad.dispose();testRoad=null;surface.road=null;
 if(['flat-road-v1','flat-campus-v2','campus-expanded-v3'].includes(world.engineered_road?.id)&&mapMesh){testRoad=new TestRoad();scene.add(testRoad.root);testRoad.sync(mapMesh.matrixWorld);surface.road=testRoad;}if(!testRoad)originalMode=false;syncSceneLayers();
}
function mapBounds(){return mapMesh instanceof SplatMesh?mapMesh.getBoundingBox().clone().applyMatrix4(mapMesh.matrixWorld):mapMesh}
function updateRoute(){
 routeGroup.visible=$('showRoute').checked;disposeRoute();routeError='';
 try{if(route.surface==='road'&&['campus-flat-road-v1',...Object.values(ROUTE_OPTIONS).map(o=>o.preset)].includes(route.preset_id)){if(!testRoad)throw Error('扩展校园未载入，请加载默认校园。');route.points=testRoad.routePoints(route.preset_id);}routeSamples=route.surface==='terrain'?surface.bake(route.points):route.points.map(p=>[...p]);}catch(e){routeSamples=[];routeError=e.message;}
 const points=routeSamples.map(p=>new THREE.Vector3(...p));if(points.length>1&&points[0].distanceTo(points.at(-1))>.5)route.loop=false;
 if(points.length>1){const geo=new THREE.BufferGeometry().setFromPoints(points.map(p=>p.clone().add(new THREE.Vector3(0,.06,0))));routeGroup.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0x16c1cc,depthTest:false,transparent:true,opacity:.95})));}
 for(const p of (route.surface==='road'&&route.points.length?[route.points[0]]:route.points)){const marker=new THREE.Mesh(new THREE.SphereGeometry(.11,12,8),new THREE.MeshBasicMaterial({color:0xf7c466,depthTest:false}));marker.position.fromArray(p);marker.position.y+=.08;routeGroup.add(marker);}
 distance=Math.min(distance,routeLength());updateRun();
}
function routeLength(){return pathLength(routeSamples);}
function updateMotionHud(){const len=routeLength();$('motionDistance').textContent=`${distance.toFixed(1)} / ${len.toFixed(1)} m · ${(drives.get(route.object_id)?.actualSpeed||0).toFixed(1)} / ${route.speed.toFixed(1)} m/s`;const car=models.find(m=>m.id===route.object_id);$('motionSurface').textContent=testRoad&&car?testRoad.zone(new THREE.Vector3(...car.position)):'';$('motionState').textContent=playing?(drives.get(route.object_id)?.yielding?'减速 / 等待让行':'小车行驶中'):distance>=len&&len>0?'已到达终点':distance>0?'已暂停':'路线已就绪';}
function updateRun(){
 syncFleetUI();
 if($('routePreset')){$('routePreset').disabled=busy||referenceMode||originalMode||!testRoad;$('routePreset').value=route.preset_id?routeKind(route.preset_id):'';}
 const len=routeLength(),target=models.find(m=>m.id===route.object_id);
 $('routeInfo').textContent=routeError|| (len>0?`${route.name||'自定义路线'} · ${len.toFixed(1)} m · ${(len/route.speed).toFixed(0)} 秒`:'没有路线：载入示范路线，或选择车辆后点选。');
 $('runState').textContent=originalMode?'原始参考':referenceMode?'参考图':playing?'行驶中':distance>=len&&len>0?'已到达':len>0?'可直接播放':'等待路径';
 $('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('quickPlay').textContent=playing?'Ⅱ 暂停':'▶ 小车运行';
 $('play').disabled=busy||referenceMode||originalMode||len<.01||!target?.root; $('quickPlay').disabled=$('play').disabled;
 $('demoRoute').disabled=busy||referenceMode||originalMode||(!testRoad&&(!world.demo_route||!surface.root));
 $('motionHud').hidden=referenceMode||originalMode||len<.01;document.querySelector('.compass').hidden=referenceMode||originalMode||len>.01;
 for(const id of ['drawPath','resetPath','clearPath','progress','followCar','loopRoute'])$(id).disabled=busy||referenceMode||originalMode;
 const closed=routeSamples.length>2&&Math.hypot(...routeSamples[0].map((v,i)=>v-routeSamples.at(-1)[i]))<.5;$('loopRoute').disabled||=!closed;$('loopRoute').checked=!!route.loop;updateMotionHud();
}
function followVehicle(snap=false,dt=.016){
 const m=models.find(x=>x.id===route.object_id);if(!$('followCar').checked||!m?.root)return;
 const target=new THREE.Vector3(...m.position).add(new THREE.Vector3(0,.55,0));
 const offset=(testRoad?new THREE.Vector3(3.2,8.5,8):new THREE.Vector3(4,3.4,6)).applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(m.yaw));
 const alpha=snap?1:1-Math.exp(-dt*7);controls.target.lerp(target,alpha);camera.position.lerp(target.clone().add(offset),alpha);if(camera.near!==.3){camera.near=.3;camera.updateProjectionMatrix();}$('cameraPreset').value='';
}
function stop(){playing=false;const d=drives.get(route.object_id);if(d){d.playing=false;d.actualSpeed=0;}updateRun()}
function setMode(next){mode=next;selectionBox.visible=mode==='place'&&!!selected?.root;controls.enableRotate=mode==='orbit';$('drawPath').classList.toggle('recording',mode==='path');$('drawPath').setAttribute('aria-pressed',String(mode==='path'));$('drawPath').textContent=mode==='path'?'完成点选':'＋ 点选路径';$('placeObject').textContent=mode==='place'?'取消放置':'在地面点击放置';$('viewHelp').textContent=mode==='path'?'点击地面添加路点 · 点「完成点选」退出':mode==='place'?'点击地面放置所选对象':'拖动旋转 · 右键平移 · 滚轮缩放 · 点击选择车辆';}
function stashDrive(){if(route.object_id&&models.some(m=>m.id===route.object_id)&&routeSamples.length>1){const old=drives.get(route.object_id);drives.set(route.object_id,{...old,route,distance,playing,samples:routeSamples,length:routeLength(),actualSpeed:playing?(old?.actualSpeed||0):0,travel:old?.travel??distance});}}
function freeRouteDistance(m,d,preferred=0){const others=trafficEntries().filter(e=>e.id!==m.id);for(let offset=0;offset<=d.length;offset+=1){const candidate=preferred+offset;if(candidate>d.length&&!d.route.loop)break;const distance=d.route.loop?candidate%d.length:candidate;const e={id:m.id,size:collisionSize(m),drive:{...d,distance}};if(!trafficOverlaps([...others,e],.3).some(pair=>pair.includes(m.id)))return distance;}return null;}
function placeDrive(m,d){const wb=m.kind==='sophicar'?(m.params.wheel_base/1000):(VEHICLES[m.kind]?.wheelbase||.6);const pose=drivePose(d,wb*m.scale);if(!m.root||!pose)return;m.position=pose.position;m.yaw=pose.yaw;m.pitch=pose.pitch;transform(m);rollWheels(m.root,d.travel??d.distance,m.scale);}
function applyRoute(d){const m=models.find(x=>x.id===route.object_id);if(!m)return;const candidate={route,samples:routeSamples,length:routeLength(),distance:d};const safe=freeRouteDistance(m,candidate,d);if(safe===null){stop();toast('此路线没有可用的安全放置位置，请调整路线。');return;}d=safe;distance=d;placeDrive(m,{...candidate,distance:d,travel:d});const saved=drives.get(m.id);if(saved)saved.travel=d;if(selected===m)syncInspector();updateMotionHud();}
function syncFleetUI(){if(!$('fleetState'))return;const yielding=[...drives.values()].filter(d=>d.playing&&d.yielding).length;const active=[...drives.values()].filter(d=>d.playing&&models.some(m=>m.id===d.route.object_id&&m.root)).length;const ready=[...drives.values()].filter(d=>d.samples.length>1&&models.some(m=>m.id===d.route.object_id&&m.root)).length;$('fleetState').textContent=`${ready} 辆已配路线 · ${active} 辆运行中 · ${yielding} 辆让行`;$('fleetPlay').textContent=active?'Ⅱ 暂停车队':'▶ 全部运行';$('fleetPlay').disabled=busy||referenceMode||originalMode||!ready;$('fleetReset').disabled=busy||referenceMode||originalMode||!ready;}
function pauseFleet(){playing=false;for(const d of drives.values()){d.playing=false;d.actualSpeed=0;}updateRun();}
function fleetView(){const box=new THREE.Box3();for(const m of models)if(m.root&&drives.has(m.id))box.expandByObject(m.root);if(!box.isEmpty())fit(box);$('followCar').checked=false;}
async function prepareFleet(){
 if(!testRoad)throw Error('请先打开扩展校园');pauseFleet();stashDrive();route={object_id:null,points:[],speed:2,loop:true};routeSamples=[];let i=0;
 for(const kind of Object.keys(VEHICLES)){const m=models.find(m=>m.kind===kind)||await addModel(kind,{name:VEHICLES[kind].name});const kindRoute=FLEET_ASSIGNMENTS[kind],choice=ROUTE_OPTIONS[kindRoute],points=testRoad.routePoints(choice.preset);const d={route:{name:choice.name,preset_id:choice.preset,object_id:m.id,points,speed:kind==='rover'?2.5:choice.speed,surface:'road',loop:kindRoute!=='test'},samples:points,distance:0,playing:false,length:pathLength(points)};drives.set(m.id,d);placeDrive(m,d);}
 // Clear the editor alias before selecting, so it cannot overwrite the new formation.
 route={object_id:null,points:[],speed:2,loop:true};routeSamples=[];traffic.reset();select(models.find(m=>m.kind==='rover'));applyCamera(testRoad.view('campus'));syncFleetUI();toast('六车已分配六条路线；运行中自动减速让行，暂停车辆也参与避碰。');
}
async function useDemoRoute(kind='campus'){
 if(!testRoad&&(!world.demo_route||!surface.root))throw Error('当前地图没有可用的示范路线或地面网格。');
 const m=selected?.root?selected:models.find(m=>m.root)||await addModel('sophicar');
 try{localStorage.setItem(STORE+'-before-demo',JSON.stringify(manifest()))}catch{}
 select(m);const choice=ROUTE_OPTIONS[kind]||ROUTE_OPTIONS.campus;route=testRoad?{name:choice.name,preset_id:choice.preset,object_id:m.id,points:testRoad.routePoints(choice.preset),speed:choice.speed,surface:'road',loop:false}:{name:world.demo_route.name,preset_id:'campus-road-lane-v1',object_id:m.id,points:world.demo_route.points_raw.map(p=>new THREE.Vector3(...p).applyMatrix4(mapMesh.matrixWorld).toArray()),speed:2,surface:'terrain',loop:false};
 distance=0;playing=false;$('progress').value=0;$('speed').value=route.speed;$('followCar').checked=true;updateRoute();if(routeError)throw Error(routeError);applyRoute(0);stashDrive();syncList();followVehicle(true);setMode('orbit');toast('示范路线已就绪。点“小车运行”即可开始；可暂停、调速或循环。');
}
controls.addEventListener('start',()=>{$('followCar').checked=false;});

let press=null;renderer.domElement.addEventListener('pointerdown',e=>{press=[e.clientX,e.clientY]});renderer.domElement.addEventListener('pointerup',e=>{if(busy||referenceMode||originalMode||e.button!==0||!press||Math.hypot(e.clientX-press[0],e.clientY-press[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
 if(mode==='path'||mode==='place'){const p=surface.root?surface.project(ray):world.collider_url?null:ray.ray.intersectPlane(ground,new THREE.Vector3());if(!p){toast('此处没有可用地面，请选择道路或重新加载地面网格。');return;}p.y+=.035;if(mode==='path'){if(!selected?.root){toast('请先选择车辆');return}if(route.object_id!==selected.id&&route.points.length){toast('当前路径属于另一对象；先清空路径再开始');return}route.object_id=selected.id;if(route.points.length>0&&p.distanceTo(new THREE.Vector3(...route.points.at(-1)))<.05)return;if(route.points.length>=200){toast('单条路径最多 200 点');return}route.points.push(p.toArray());route.surface=surface.root?'terrain':'plane';route.name='自定义路线';delete route.preset_id;distance=0;updateRoute();if(routeError)toast(routeError)}else if(selected?.root){stop();selected.position=p.toArray();transform(selected);syncInspector();setMode('orbit')}return}
 const hits=ray.intersectObjects(models.filter(m=>m.root).map(m=>m.root),true);if(hits[0]){let o=hits[0].object;while(o){const m=models.find(m=>m.root===o);if(m){select(m);return}o=o.parent}}});
function describe(m){const {root,...data}=m;return structuredClone(data)}
function manifest(){stashDrive();return {fleet_revision:'traffic-fleet-20261012-v3',drives:[...drives.values()].map(d=>({...structuredClone(d.route),distance:d.distance})),default_scene_revision:world.default_scene_revision||null,schema:'sophi-worlds-scene',schema_version:2,title:world.name,updated_at:new Date().toISOString(),units:'meters',up_axis:'Y',world:structuredClone(world),objects:models.map(describe),route:{...structuredClone(route),distance},camera:{position:camera.position.toArray(),target:controls.target.toArray()},limitations:['Gaussian splat environment with independent meshes; no physical simulation.','Local assets must be relinked by file name after reopening.']}}
function finite(n,min=-1e6,max=1e6){return typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max}
function vec(v){return Array.isArray(v)&&v.length===3&&v.every(n=>finite(n))}
function validate(s){if(s?.schema!=='sophi-worlds-scene'||s.schema_version!==2||!Array.isArray(s.objects)||s.objects.length>100)throw Error('需要 schema_version 2 的 Sophi Worlds 场景 JSON');const w=s.world;if(!w||typeof w.name!=='string'||w.name.length>80||!vec(w.position)||!finite(w.scale,1e-6,1e4)||!finite(w.ground_offset)||!finite(w.yaw)||typeof w.axis_flip!=='boolean')throw Error('地图坐标无效');if(w.url)cleanUrl(w.url);if(w.collider_url)cleanUrl(w.collider_url);if(w.engineered_road&&!['flat-road-v1','flat-campus-v2','campus-expanded-v3'].includes(w.engineered_road.id))throw Error('道路配置版本无效');const ids=new Set();for(const m of s.objects){if(!m||typeof m.id!=='string'||m.id.length>100||ids.has(m.id)||!['sophicar','robot','glb',...Object.keys(VEHICLES)].includes(m.kind)||typeof m.name!=='string'||m.name.length>80||!vec(m.position)||!finite(m.yaw)||!finite(m.scale,.01,100)||!finite(m.asset_scale??1,.000001,100))throw Error('对象数据无效');ids.add(m.id);if(m.pitch!==undefined&&!finite(m.pitch,-90,90))throw Error('车辆坡度角无效');if(m.url)m.url=cleanUrl(m.url);if(m.kind==='sophicar'){const p=m.params;if(!p||!finite(p.frame_total_long,2000,3000)||!finite(p.frame_total_width,800,1400)||!finite(p.wheel_base,1200,p.frame_total_long*.9))throw Error('底盘参数超出范围');m.params={...DEFAULT,frame_total_long:p.frame_total_long,frame_total_width:p.frame_total_width,wheel_base:p.wheel_base}}}
 if(s.drives!==undefined&&(!Array.isArray(s.drives)||s.drives.length>s.objects.length||new Set(s.drives.map(d=>d.object_id)).size!==s.drives.length||!s.drives.every(d=>validDrive(d,ids))))throw Error('车队路线数据无效');
 if(!s.route||!Array.isArray(s.route.points)||s.route.points.length>2048||!s.route.points.every(vec)||!finite(s.route.speed,.1,10)||s.route.object_id!==null&&!ids.has(s.route.object_id))throw Error('路径数据无效');if(s.route.distance!==undefined&&!finite(s.route.distance,0,1e6))throw Error('路线进度无效');if(s.route.surface!==undefined&&!['terrain','plane','road'].includes(s.route.surface))throw Error('路线地面类型无效');if(s.route.loop!==undefined&&typeof s.route.loop!=='boolean')throw Error('循环设置无效');if(s.camera&&(!vec(s.camera.position)||!vec(s.camera.target)))throw Error('镜头数据无效');return s}
async function restore(input){const s=validate(input);originalMode=false;pauseFleet();setMode('orbit');const staged=[];try{for(const data of s.objects){const m={...data};m.root=await makeModel(m);staged.push(m)}}catch(e){staged.forEach(m=>dispose(m.root));throw e}
 for(const m of models)dispose(m.root);models.length=0;models.push(...staged);drives.clear();for(const m of models)if(m.root){scene.add(m.root);transform(m)}if(mapMesh){const p=mapFrame.parent;dispose(mapMesh);p.removeFromParent();mapMesh=null;mapFrame=null}if(testRoad)testRoad.dispose();testRoad=null;surface.road=null;surface.clear();world=structuredClone(s.world);route=structuredClone(s.route);distance=s.route.distance||0;$('speed').value=route.speed;$('progress').value=0;
 let missing=0;if(world.url||localFiles.has(world.file_name)){try{await loadMap(localFiles.get(world.file_name)||world.url,world)}catch(e){missing++;toast('场景已恢复，但地图加载失败：'+e.message)}}else if(world.kind)missing++;
 missing+=models.filter(m=>!m.root).length;syncWorld();for(const r of s.drives||[]){const samples=r.surface==='road'&&testRoad&&Object.values(ROUTE_OPTIONS).some(o=>o.preset===r.preset_id)?testRoad.routePoints(r.preset_id):r.surface==='terrain'?surface.bake(r.points):r.points;const d={route:structuredClone(r),samples,length:pathLength(samples),distance:Math.min(r.distance||0,pathLength(samples)),playing:false};drives.set(r.object_id,d);const m=models.find(m=>m.id===r.object_id);if(m)placeDrive(m,d);}updateRoute();stashDrive();select(models.find(m=>m.id===s.route.object_id)||models[0]||null);updateRoute();distance=Math.min(s.route.distance||0,routeLength());if(routeLength()>0){applyRoute(distance);$('progress').value=distance/routeLength()*100;}if(s.camera){applyCamera(s.camera)}else fit(allBox());toast(missing?`场景配置已恢复；${missing} 个本地或远程资产需重新接入。`:'场景已恢复');}
function download(data,name){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function api(path){if(isFilePreview)throw Error('当前为本地直开模式。远程 API 查询需要通过本机服务打开页面。');const r=await fetch('api/'+path,{headers:{Accept:'application/json'}});if(!r.ok){let err;try{err=(await r.json()).error}catch{}throw Error(err||'请用 tools/worldlabs_server.py 启动本地 API 服务')}return r.json()}
function parseId(value){let id=value.trim();if(/^https?:\/\//.test(id)){const u=new URL(id);if(u.hostname!=='marble.worldlabs.ai')throw Error('请使用 marble.worldlabs.ai 的世界分享链接');id=u.pathname.split('/').filter(Boolean).at(-1)}if(!/^[A-Za-z0-9_-]{1,150}$/.test(id))throw Error('请填写有效的 World ID 或 Marble 世界分享链接');return id}
async function loadWorld(id){const data=await api('worlds/'+parseId(id));const w=data.world||data;const splats=w.assets?.splats,urls=splats?.spz_urls;const quality=urls?.full_res?'full_res':urls?.['500k']?'500k':'100k';const url=urls?.[quality];if(!url)throw Error('世界尚未完成生成或没有 SPZ 资产');const sem=splats.semantics_metadata||{};const scale=sem.metric_scale_factor??1,offset=sem.ground_plane_offset??0;if(!finite(scale,1e-6,1e4)||!finite(offset))throw Error('世界尺度元数据无效');await loadMap(url,{name:(w.display_name||$('mapName').value).slice(0,80),world_id:w.world_id||w.id||parseId(id),marble_url:w.world_marble_url||'',quality,quality_urls:urls,collider_url:w.assets?.mesh?.collider_mesh_url||'',scale,ground_offset:offset,axis_flip:true,calibrated:false});}
$('addCar').onclick=()=>run('正在装配 Sophicar 原始零件…',async()=>{const m=await addModel('sophicar');fit(m.root);toast('已加入 Sophicar 线控底盘')});
$('addRobot').onclick=()=>run('正在添加移动机器人…',async()=>{const m=await addModel('robot');fit(m.root);toast('已加入 SophiStudio 概念机器人')});
$('mapFileButton').onclick=()=>$('mapFile').click();$('modelFileButton').onclick=()=>$('modelFile').click();
$('mapFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)run('正在加载地图…',async()=>{const meta=world.file_name===f.name?structuredClone(world):{name:$('mapName').value.trim()||f.name};await loadMap(f,meta)})};
$('modelFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)run('正在加载车辆模型…',async()=>{if(!f.name.toLowerCase().endsWith('.glb'))throw Error('请选择自包含 GLB');localFiles.set(f.name,f);const existing=models.filter(m=>m.kind==='glb'&&!m.root&&m.file_name===f.name);if(existing.length){for(const m of existing){m.root=await makeModel(m);scene.add(m.root);transform(m)}select(existing[0]);fit(existing[0].root);toast('本地模型已重新关联')}else{const m=await addModel('glb',{name:f.name.slice(0,80),file_name:f.name,url:'',asset_scale:number('modelUnits',.001,1)});fit(m.root);toast('已加入独立 GLB 对象')}})};
$('loadUrl').onclick=()=>run('正在读取地图资产…',()=>loadMap($('assetUrl').value,{name:$('mapName').value.trim()||'环境地图'}));
$('loadWorld').onclick=()=>run('正在读取 World API…',()=>loadWorld($('worldId').value));
$('connectApi').onclick=()=>run('正在查询 API（只读）…',async()=>{const c=await api('status');$('apiState').textContent=`API 已连接 · ${c.remaining_credits} credits。网页与 API 世界库可能不同。`;const data=await api('worlds');const worlds=data.worlds||[];$('worldList').replaceChildren();if(!worlds.length)$('apiState').textContent+=' API 世界列表为空。';for(const w of worlds){const b=document.createElement('button');b.textContent=w.display_name||w.world_id||w.id;b.onclick=()=>run('正在读取世界…',()=>loadWorld(w.world_id||w.id));$('worldList').append(b)}if(data.next_page_token){const note=document.createElement('p');note.className='hint';note.textContent='仅显示最近 100 个世界；其他世界可直接输入 ID。';$('worldList').append(note)}toast('只读查询完成；未发起生成')});
$('mapName').onchange=()=>{world.name=$('mapName').value.trim()||'浙大地图';syncWorld()};
$('demoRoute').onclick=()=>run('正在准备行驶路线…',()=>useDemoRoute($('routePreset').value||'campus'));
$('routePreset').onchange=()=>{const kind=$('routePreset').value;if(kind)run('正在切换路线…',()=>useDemoRoute(kind));};
$('quickPlay').onclick=()=>$('play').click();
$('loopRoute').onchange=()=>{route.loop=$('loopRoute').checked;};
$('showRoute').onchange=()=>{routeGroup.visible=$('showRoute').checked;};
$('followCar').onchange=()=>{if($('followCar').checked)followVehicle(true);};
$('applyMap').onclick=()=>{try{world={...world,scale:number('worldScale',.000001,10000),ground_offset:number('groundOffset'),axis_flip:$('axisFlip').checked,position:['mapX','mapY','mapZ'].map(id=>number(id)),yaw:number('mapYaw'),calibrated:false};transformMap();updateRoute();syncWorld();toast('地图坐标已更新，请重新核验标定')}catch(e){toast(e.message)}};
$('calibrated').onchange=()=>{world.calibrated=$('calibrated').checked&&!!mapMesh;syncWorld()};$('fitMap').onclick=()=>{if(originalMode&&world.original_camera)applyCamera(world.original_camera);else if(testRoad)applyCamera(testRoad.view('overview'));else if(world.overview_camera)applyCamera(world.overview_camera);else if(mapMesh)fit(mapBounds());else toast('请先导入校园地图')};
$('applyTransform').onclick=()=>{if(!selected)return;try{const name=$('objectName').value.trim();if(!name)throw Error('请填写对象名称');const p=['posX','posY','posZ'].map(id=>number(id)),y=number('yaw'),s=number('objectScale',.01,100);stop();selected.name=name;selected.position=p;selected.yaw=y;selected.scale=s;transform(selected);syncList();syncInspector();toast('对象位置已更新')}catch(e){toast(e.message)}};
$('applyParams').onclick=()=>run('正在重建参数化底盘…',async()=>{if(selected?.kind!=='sophicar')return;const p={...DEFAULT,frame_total_long:number('frameLength',2000,3000),frame_total_width:number('frameWidth',800,1400),wheel_base:number('wheelbase',1200,2500)};if(p.wheel_base>p.frame_total_long*.9)throw Error('轴距需要小于车架长度的 90%');const root=await buildSophicar(p);stop();dispose(selected.root);selected.root=root;selected.params=p;scene.add(root);transform(selected);syncInspector();toast('底盘参数已应用')});
$('placeObject').onclick=()=>{if(!selected?.root)return;stop();setMode(mode==='place'?'orbit':'place')};
$('cloneObject').onclick=()=>run('正在复制对象…',async()=>{if(!selected)return;const data=describe(selected);data.name=(data.name+' 副本').slice(0,80);data.position[0]+=2;delete data.id;await addModel(data.kind,data);toast('对象已复制')});
$('removeObject').onclick=()=>{if(!selected)return;const m=selected;stop();drives.delete(m.id);if(route.object_id===m.id){route={object_id:null,points:[],speed:route.speed};updateRoute()}dispose(m.root);models.splice(models.indexOf(m),1);select(models[0]||null);toast('对象已移除')};
$('homeView').onclick=()=>{$('followCar').checked=false;if(originalMode&&world.original_camera)applyCamera(world.original_camera);else if(testRoad)applyCamera(testRoad.view('overview'));else if(world.overview_camera)applyCamera(world.overview_camera);else fit(allBox());$('cameraPreset').value='0'};$('focusObject').onclick=()=>focusVehicle(selected);$('topView').onclick=()=>{$('followCar').checked=false;const c=controls.target.clone();const d=camera.position.distanceTo(c);camera.position.copy(c).add(new THREE.Vector3(0,Math.max(d,6),.001));controls.update()};$('toggleGrid').onclick=()=>{grid.visible=!grid.visible;$('toggleGrid').setAttribute('aria-pressed',String(grid.visible))};
$('drawPath').onclick=()=>{if(!selected?.root){toast('请先选择一个车辆或机器人');return}stop();setMode(mode==='path'?'orbit':'path')};
$('play').onclick=()=>{if(playing){stop();return}if(routeLength()<.01)return;setMode('orbit');if(distance>=routeLength())distance=0;applyRoute(distance);followVehicle(true);playing=true;updateRun()};
$('resetPath').onclick=()=>{stop();distance=0;$('progress').value=0;applyRoute(0);followVehicle(true);updateRun()};$('progress').oninput=()=>{stop();distance=routeLength()*Number($('progress').value)/100;applyRoute(distance);followVehicle(true);updateRun()};
$('clearPath').onclick=()=>{stop();drives.delete(route.object_id);route.points=[];route.object_id=null;distance=0;$('progress').value=0;routeSamples=[];routeError='';disposeRoute();updateRoute()};
function disposeRoute(){for(const child of [...routeGroup.children])dispose(child)}
$('speed').oninput=()=>{const n=Number($('speed').value);if($('speed').value.trim()&&finite(n,.1,10)){route.speed=n;updateRun();}};
$('speed').onchange=()=>{try{route.speed=number('speed',.1,10);updateRun()}catch(e){$('speed').value=route.speed;toast(e.message)}};
$('saveScene').onclick=()=>{try{localStorage.setItem(STORE,JSON.stringify(manifest()));toast(world.file_name||models.some(m=>m.file_name&&!m.url)?'场景和进度已保存；手动导入的本地模型需保留原文件并在重开时关联。':'场景和运行进度已保存；刷新后会恢复并保持暂停。')}catch{toast('浏览器存储不可用，请导出场景 JSON')}};
$('exportScene').onclick=()=>{download(manifest(),'sophi-worlds-scene-'+new Date().toISOString().slice(0,10)+'.json');toast('场景已导出；本地资产文件需随场景一同归档')};
$('importScene').onclick=()=>$('sceneFile').click();$('sceneFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)run('正在恢复场景…',async()=>{if(f.size>3e6)throw Error('场景 JSON 应小于 3 MB；模型请通过 GLB / SPZ 导入');await restore(JSON.parse(await f.text()))})};
renderer.setAnimationLoop(time=>{const dt=Math.min(Math.max((time-lastTime)/1000,0),.1);lastTime=time;if(testRoad)testRoad.waterMaterial.uniforms.time.value=time/1000;
 stashDrive();const moving=new Set([...drives].filter(([,d])=>d.playing).map(([id])=>id));traffic.tick(trafficEntries(),dt);for(const [id,d] of drives){const m=models.find(m=>m.id===id);if(m?.root&&moving.has(id))placeDrive(m,d);}
 const current=drives.get(route.object_id);if(current){distance=current.distance;playing=current.playing;}if(playing)followVehicle(false,dt);
 if(time-hudTime>250){hudTime=time;if(window.trafficLabSnapshot)$('sceneDiagnostics').textContent=JSON.stringify(window.trafficLabSnapshot());$('progress').value=routeLength()?distance/routeLength()*100:0;updateRun();if(playing&&selected&&document.activeElement?.tagName!=='INPUT')syncInspector();}
 controls.update();const {near}=cameraClipping(camera.position.distanceTo(controls.target));if(Math.abs(camera.near-near)>.005){camera.near=near;camera.far=1800;camera.updateProjectionMatrix();}renderer.render(scene,camera);
});
$('prepareFleet').onclick=()=>run('正在装配六款车型…',prepareFleet);
$('fleetPlay').onclick=()=>{stashDrive();const running=[...drives.values()].some(d=>d.playing);if(running)pauseFleet();else{setMode('orbit');for(const [id,d] of drives){if(!models.some(m=>m.id===id&&m.root)||d.length<.01)continue;if(d.distance>=d.length)d.distance=0;d.playing=true;}const d=drives.get(route.object_id);playing=!!d?.playing;distance=d?.distance||0;updateRun();}};
$('fleetReset').onclick=()=>{pauseFleet();let i=0;for(const [id,d] of drives){d.distance=0;d.actualSpeed=0;d.yielding=false;d.travel=d.distance;const m=models.find(m=>m.id===id);if(m){d.distance=freeRouteDistance(m,d,0)??d.distance;placeDrive(m,d);}}traffic.reset();const d=drives.get(route.object_id);distance=d?.distance||0;updateRun();syncInspector();};
$('fleetView').onclick=fleetView;
for(const b of document.querySelectorAll('[data-add-vehicle]'))b.onclick=()=>run('正在载入官方车型…',async()=>{const kind=b.dataset.addVehicle;const m=await addModel(kind,{name:VEHICLES[kind].name});if(testRoad)await useDemoRoute('campus');focusVehicle(m);toast('已加入 '+m.name+'，可独立播放或参与车队运行');});


function syncSceneLayers(){
 const engineered=!!testRoad&&!originalMode&&!referenceMode;
 if(testRoad)testRoad.root.visible=engineered;
 if(mapFrame)mapFrame.parent.visible=!referenceMode&&(!testRoad||originalMode);
 surface.road=testRoad&&!originalMode?testRoad:null;
 routeGroup.visible=!originalMode&&!referenceMode&&$('showRoute').checked;
 for(const m of models)if(m.root)m.root.visible=!originalMode;
 selectionBox.visible=!originalMode&&!!selected?.root&&mode==='place';
 $('showOriginal').hidden=!testRoad;$('showOriginal').setAttribute('aria-pressed',String(originalMode));
 $('show3d').textContent=testRoad?'扩展校园':'3D 世界';$('show3d').setAttribute('aria-pressed',String(!referenceMode&&!originalMode));
 $('mapQuality').hidden=!world.quality_urls||engineered;
 $('cameraPreset').hidden=referenceMode||originalMode||!world.camera_presets?.length;
 if(testRoad){$('campusLifeDetail').textContent='场景陈设：'+testRoad.lifeCounts.shuttles+' 辆接驳车、'+testRoad.lifeCounts.vans+' 辆配送车、'+testRoad.lifeCounts.robots+' 台配送机器人、1 辆卡丁车；'+testRoad.lifeCounts.cyclists+' 位骑行者与 '+(testRoad.lifeCounts.people+testRoad.referenceDetailCounts.people)+' 位人物。选择「接驳车与入口」或「配送与校园街景」近看。';$('modeBadge').textContent=originalMode?'Marble 原始参考 · 地形未整平':(testRoad.referenceDetailCounts.buildings+2)+' 栋建筑 · '+testRoad.gardens.length+' 处花坛 · 灰色平路';$('viewLabel').textContent=originalMode?'Marble 原始世界 · 参考视图':world.name;}
 document.querySelector('.engine').textContent=referenceMode?'用户校园参考图':engineered?'设计场景 · Three.js':'Marble · Spark';
}
function setReferenceMode(value){pauseFleet();referenceMode=value;if(value)originalMode=false;stop();setMode('orbit');$('referenceLayer').hidden=!value;$('canvasHost').hidden=value;$('showReference').setAttribute('aria-pressed',String(value));document.querySelector('.view-tools').hidden=value;$('viewHelp').hidden=value;$('modeBadge').hidden=value;syncSceneLayers();updateRun();if(!value)resize();}
function setOriginalMode(value){originalMode=!!testRoad&&value;setReferenceMode(false);$('followCar').checked=false;syncSceneLayers();if(originalMode)applyCamera(world.original_camera||world.overview_camera);else if(testRoad)applyCamera(testRoad.view('overview'));updateRun();}
$('cameraPreset').onchange=()=>{const index=$('cameraPreset').value;const wasReference=referenceMode||originalMode;originalMode=false;$('followCar').checked=false;if(wasReference)setReferenceMode(false);const view=world.camera_presets?.[Number(index)];applyCamera(index===''?null:view?.road_view&&testRoad?testRoad.view(view.road_view):view);};
$('show3d').onclick=()=>setOriginalMode(false);$('showOriginal').onclick=()=>setOriginalMode(true);$('showReference').onclick=()=>setReferenceMode(true);
async function defaultScene(){return validate(await jsonAsset(DEFAULT_SCENE_URL));}
$('loadDefault').onclick=()=>run('正在载入扩展校园…',async()=>{const data=await defaultScene();try{localStorage.setItem(STORE+'-before-default',JSON.stringify(manifest()))}catch{}setReferenceMode(false);await restore(data);if(!mapMesh)throw Error('默认 3D 资产加载失败；可切换扩展参考图并稍后重试');try{localStorage.setItem(STORE,JSON.stringify(manifest()))}catch{}toast('扩展概念校园已载入；此前场景已保留为浏览器备份');});
$('quality').onchange=()=>run('正在切换地图清晰度…',async()=>{const q=$('quality').value;if(!world.quality_urls?.[q])throw Error('此清晰度未归档');const pos=camera.position.clone(),target=controls.target.clone(),preset=$('cameraPreset').value,previous=structuredClone(world);await loadMap(world.quality_urls[q],{...previous,url:world.quality_urls[q],quality:q});camera.position.copy(pos);controls.target.copy(target);controls.update();$('cameraPreset').value=preset;toast('地图清晰度已切换；车辆与坐标保持不变');});
async function initializeWorkbench(){
 if(isFilePreview)$('apiState').textContent='本地直开：校园、车辆与 Marble 参考均使用本机资源。远程 API 查询需通过本机服务。';
 await run('正在准备默认校园与车辆…',async()=>{let data=null;try{data=JSON.parse(localStorage.getItem(STORE)||'null')}catch{}
 if(!data?.world?.kind){if(data)try{localStorage.setItem(STORE+'-before-default',JSON.stringify(data))}catch{}try{data=await defaultScene()}catch(e){toast(e.message)}}
 if(data?.world?.world_id==='5ec6efd4-4809-4874-9864-2921e49bf208'&&['flat-road-v1','flat-campus-v2'].includes(data.world.engineered_road?.id)){
  const latest=await defaultScene();try{localStorage.setItem(STORE+'-before-campus-expansion',JSON.stringify(data))}catch{}
  const car=data.objects.find(m=>m.kind==='sophicar');data.world=latest.world;data.camera=latest.camera;
  if(car)data.route={...structuredClone(latest.route),object_id:car.id};
 }
 if(data?.world?.world_id==='5ec6efd4-4809-4874-9864-2921e49bf208'&&data.world.engineered_road?.id==='flat-road-v1'){
  const latest=await defaultScene();try{localStorage.setItem(STORE+'-before-level-network',JSON.stringify(data))}catch{}
  const car=data.objects.find(m=>m.kind==='sophicar');data.world=latest.world;data.camera=latest.camera;
  if(car)data.route={...structuredClone(latest.route),object_id:car.id};
  const robot=data.objects.find(m=>m.id==='94df6015-1052-4c55-8b3f-92c77c383832');if(robot)robot.position=latest.objects[1].position;
 }
 if(data?.world?.world_id==='5ec6efd4-4809-4874-9864-2921e49bf208'&&['campus-4x-20261002','campus-4x-motion-20261002'].includes(data.world.default_scene_revision)){
  const latest=await defaultScene();try{localStorage.setItem(STORE+'-before-flat-road-upgrade',JSON.stringify(data))}catch{}
  // Upgrade the known default demonstration; preserve custom routes without changing their terrain.
  const oldDefault=data.route.preset_id==='campus-road-lane-v1'&&data.route.points.length===2&&data.route.points.every((p,i)=>Math.abs(p[0]-[-1.109,-6.42][i])<.01&&Math.abs(p[2]-[17.858,29.248][i])<.01);
  if(!data.route.points.length||oldDefault){
   const car=data.objects.find(m=>m.kind==='sophicar');data.world=latest.world;data.camera=latest.camera;
   if(car)data.route={...structuredClone(latest.route),object_id:car.id};
   const robot=data.objects.find(m=>m.id==='94df6015-1052-4c55-8b3f-92c77c383832');if(robot)robot.position=latest.objects[1].position;
  }
 }

 if(data?.world?.engineered_road?.id==='campus-expanded-v3'&&data.world.default_scene_revision!=='campus-street-life-20261002-v5'){
  const latest=await defaultScene();try{localStorage.setItem(STORE+'-before-street-life',JSON.stringify(data))}catch{}
  data.world.camera_presets=latest.world.camera_presets;data.world.default_scene_revision=latest.world.default_scene_revision;data.camera=latest.camera;
 }
 if(data){try{await restore(data)}catch(e){toast('场景无法恢复：'+e.message);const m=await addModel('sophicar');fit(m.root)}}else{const m=await addModel('sophicar');fit(m.root)}
 if(mapMesh?.numSplats&&!world.calibrated){grid.visible=false;$('toggleGrid').setAttribute('aria-pressed','false')}
 syncWorld();if(testRoad&&data?.fleet_revision!=='traffic-fleet-20261012-v3'){try{localStorage.setItem(STORE+'-before-official-fleet',JSON.stringify(manifest()))}catch{}await prepareFleet();try{localStorage.setItem(STORE,JSON.stringify(manifest()))}catch{}}window.workbenchReady=true;window.trafficLabSnapshot=()=>({ready:true,models:models.map(m=>({id:m.id,kind:m.kind,name:m.name,position:m.position,yaw:m.yaw,pitch:m.pitch,footprint:m.root?collisionSize(m):null,meshes:(()=>{let n=0;m.root?.traverse(o=>{if(o.isMesh)n++});return n})(),wheels:(()=>{const a=[];m.root?.traverse(o=>{if(o.userData.rollingRadius)a.push(o.rotation.x)});return a})()})),drives:[...drives.values()].map(d=>({id:d.route.object_id,preset:d.route.preset_id,speed:d.route.speed,actualSpeed:d.actualSpeed||0,yielding:!!d.yielding,distance:d.distance,travel:d.travel,playing:d.playing})),traffic:{overlaps:trafficOverlaps(trafficEntries()),interventions:traffic.interventions,elapsed:traffic.elapsed},camera:{near:camera.near,far:camera.far,distance:camera.position.distanceTo(controls.target)},selected:selected?.kind,drawCalls:renderer.info.render.calls});
});

}
initializeWorkbench().catch(e=>{$('loading').hidden=false;$('loading').textContent='场景未能启动：'+e.message;console.error(e);});
