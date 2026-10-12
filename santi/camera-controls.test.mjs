import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const require=createRequire(root+'/cfd/package.json');
const {Vector3,PerspectiveCamera,MathUtils}=require('three');
const html=fs.readFileSync(process.env.SANTI_HTML||root+'/santi/santi.html','utf8');
const start=html.indexOf('var ya=class');
const end=html.indexOf(';var Xc=',start);
assert.ok(start>=0&&end>start,'scene controller is present');
function eventTarget(){return {handlers:new Map(),addEventListener(k,f){this.handlers.set(k,f)},removeEventListener(){}}}
function setup(){
 const window=eventTarget(),document=eventTarget(),canvas=eventTarget();
 const Scene=vm.runInNewContext(html.slice(start,end)+';ya',{Fe:Vector3,Xu:MathUtils.clamp,window,document,Bt:[{x:0,z:0,w:100,d:100}]});
 const s=Object.create(Scene.prototype);
 Object.assign(s,{listeners:[],renderer:{domElement:canvas},host:{focus(){}},paused:false,firstPerson:false,keys:new Set(),tour:false,yaw:.6,pitch:.12,distance:7.2,player:new Vector3(2,.4,3),camera:new PerspectiveCamera(),cameraGoal:new Vector3(),lookTarget:new Vector3(),tmp:new Vector3(),avatar:{visible:true},room:0,roomGroups:[],wallMeshes:[],interactions:[],camRay:{set(){},intersectObjects(){return []}},scene:{updateMatrixWorld(){}},emit(){}});
 s.bind();
 const key=(changes={})=>{const event={code:'Space',target:{tagName:'DIV',isContentEditable:false,closest(){return null}},repeat:false,preventDefault(){this.prevented=true},...changes};window.handlers.get('keydown')(event);return event};
 return {s,key,canvas};
}
test('Space switches camera twice without moving the visitor or changing zoom',()=>{
 const {s,key}=setup();const player=s.player.clone();key();assert.equal(s.firstPerson,true);key();assert.equal(s.firstPerson,false);assert.ok(s.player.equals(player));assert.equal(s.distance,7.2);assert.equal(s.yaw,.6);
});
test('holding Space does not repeatedly toggle',()=>{const {s,key}=setup();key();key({repeat:true});assert.equal(s.firstPerson,true)});
test('editing, controls, modifiers, and paused panels do not change view',()=>{
 const {s,key}=setup();for(const event of [{target:{tagName:'INPUT'}},{target:{tagName:'DIV',isContentEditable:true}},{target:{tagName:'BUTTON',closest(){return this}}},{ctrlKey:true},{metaKey:true},{altKey:true}]){key(event);assert.equal(s.firstPerson,false)}s.paused=true;key();assert.equal(s.firstPerson,false);
});
test('first-person camera is at eye level, looks forward, and hides the avatar',()=>{
 const {s,key}=setup();key();assert.ok(s.camera.position.distanceTo(new Vector3(2,2.1,3))<1e-9);const dir=s.camera.getWorldDirection(new Vector3());const forward=new Vector3(-Math.sin(.6)*Math.cos(.12),-Math.sin(.12),-Math.cos(.6)*Math.cos(.12));assert.ok(dir.distanceTo(forward)<1e-9);assert.equal(s.avatar.visible,false);
});
test('returning to third person restores the follow camera and avatar',()=>{
 const {s,key}=setup();key();key();assert.ok(s.camera.position.distanceTo(s.player)>6);assert.equal(s.avatar.visible,true);
});
test('wheel in first person does not overwrite third-person follow distance',()=>{
 const {s,key,canvas}=setup();key();canvas.handlers.get('wheel')({deltaY:200,preventDefault(){}});assert.equal(s.distance,7.2);
});
