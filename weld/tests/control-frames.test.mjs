import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Matrix4} from 'three';
import {defaultProject,validateProject} from '../src/model.js';
import {frameDefaults,frameMatrix,gunFrame,physicalTarget,calibratedTCP,programmedPose,validateFrames} from '../src/control-frames.js';
import {ABBTrajectory,actualTool,forward,mountMatrix,RAD} from '../src/abb-kinematics.js';
import {lineSummary} from '../src/engineering.js';
import {contactState} from '../src/spot-contact.js';
import {ControllerSimulator} from '../src/controller-sim.js';
const raw={root:new Vector3(.2,1.5,.8),tangent:new Vector3(0,1,0),normal:new Vector3(0,0,1)};
test('TCP and work-object transforms compose in the declared order and preserve a neutral calibration',()=>{
 const neutral=physicalTarget(raw,frameDefaults());assert.ok(neutral.root.distanceTo(raw.root)<1e-12);
 const f={tcp:[12,-8,3,5,-3,8],work:[20,30,-10,2,1,-4]},physical=physicalTarget(raw,f),tcp=calibratedTCP(physical,f),goal=programmedPose(raw,f);
 assert.ok(tcp.root.distanceTo(goal.root)<1e-12);assert.ok(tcp.normal.distanceTo(goal.normal)<1e-12);assert.ok(tcp.tangent.distanceTo(goal.tangent)<1e-12);
 const p=new Vector3(1,0,0).applyMatrix4(frameMatrix([0,0,0,0,0,90]));assert.ok(p.distanceTo(new Vector3(0,1,0))<1e-12);
});
test('calibrations drive IK while physical electrode misalignment inhibits current and indentation',()=>{
 const p=defaultProject(),line=lineSummary(p),st=line.stations[0],t=st.tasks[0].start+.1;
 const base=new ABBTrajectory(p,line).pose(t,st);assert.equal(contactState(base,p).seated,true);
 p.controlFrames={OP10:{tcp:[0,0,0,0,0,0],work:[10,0,0,0,0,0]}};
 const changed=new ABBTrajectory(p,line).pose(t,st);assert.ok(changed.reachable);assert.ok(Math.abs(changed.root.x-base.root.x-.01)<1e-8);assert.ok(changed.positionError<1e-6);assert.equal(contactState(changed,p).current,0);assert.equal(contactState(changed,p).indentation,0);
 p.controlFrames.OP10={tcp:[0,10,0,0,0,0],work:[0,0,0,0,0,0]};const tool=new ABBTrajectory(p,line).pose(t,st);assert.ok(tool.tip.distanceTo(base.tip)<1e-8);assert.ok(Math.abs(tool.root.z-base.root.z+.01)<1e-8);assert.equal(contactState(tool,p).seated,false);
});
test('calibration values validate, round-trip through projects and reject non-finite or out-of-range input',()=>{
 const p=defaultProject();p.controlFrames={OP20:{tcp:[10,0,0,0,2,0],work:[0,0,5,0,0,0]}};assert.deepEqual(validateProject(p).controlFrames,p.controlFrames);
 for(const n of [NaN,Infinity,101,'1'])assert.throws(()=>validateFrames({OP10:{tcp:[n,0,0,0,0,0],work:[0,0,0,0,0,0]}}));
 assert.throws(()=>validateFrames({OP99:frameDefaults()}));assert.throws(()=>validateFrames({OP10:{tcp:[],work:[]}}));
});
test('manual commands require connection, motors, manual mode and valid axis increments',()=>{
 const c=new ControllerSimulator();c.sync({project:defaultProject()});const jog=()=>c.dispatch('jog',{axis:0,delta:1});assert.equal(jog().ok,false);c.dispatch('connect');assert.equal(jog().ok,false);c.dispatch('motors-on');assert.equal(jog().ok,false);c.dispatch('set-mode',{value:'manual'});assert.equal(jog().intent,'manual');assert.equal(c.dispatch('jog',{axis:6,delta:1}).ok,false);assert.equal(c.dispatch('jog',{axis:0,delta:6}).ok,false);assert.equal(c.dispatch('gun-close').ok,true);
 c.sync({sceneState:{stations:[{manual:true}]}});assert.equal(c.dispatch('step').ok,false);c.dispatch('set-mode',{value:'automatic'});assert.equal(c.dispatch('run').ok,false);
});
