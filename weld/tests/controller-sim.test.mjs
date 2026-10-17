import test from 'node:test';
import assert from 'node:assert/strict';
import {ControllerSimulator,CONTROLLER_SIGNALS,stepBoundary,rapidPreview} from '../src/controller-sim.js';
import {studioMarkup} from '../src/studio-ui.js';
import {defaultProject,bracketProject} from '../src/model.js';
import {lineSummary} from '../src/engineering.js';
import {lineMotionAt} from '../src/line-motion.js';

function contextAt(project,time){const line=lineSummary(project);return {project,time,sceneState:{line:true,stations:line.stations.map(st=>{const raw=lineMotionAt(time,st,project,line);return {...raw,seam:raw.id,tip:raw.tip.toArray(),joints:[{axis:'J1',degrees:12,min:-170,max:170,limited:false}],collisions:[]};})}};}
function connected(project=defaultProject()){const sim=new ControllerSimulator();sim.sync(contextAt(project,0));sim.dispatch('connect');return sim;}

test('controller starts disconnected with unknown signals and no pretend live pose',()=>{
 const sim=new ControllerSimulator(),p=defaultProject(),task=lineSummary(p).stations[0].tasks[0];sim.sync(contextAt(p,task.start+.01));
 const s=sim.snapshot();assert.equal(s.connected,false);assert.equal(s.kind,'local-simulator');assert.equal(s.executing,false);
 assert.ok(s.stations.every(st=>st.tcp===null&&st.joints.length===0&&CONTROLLER_SIGNALS.every(sig=>st.signals[sig.key]===null)));
 assert.match(s.scope,/未连接 ABB/);
});

test('run enforces connection, motors, automatic mode, scene and enabled tasks',()=>{
 const p=defaultProject(),sim=new ControllerSimulator();sim.sync(contextAt(p,0));
 assert.equal(sim.dispatch('run').ok,false);assert.equal(sim.dispatch('motors-on').ok,false);
 sim.dispatch('connect');assert.equal(sim.dispatch('run').ok,false);
 sim.dispatch('motors-on');sim.dispatch('set-mode',{value:'manual'});assert.equal(sim.dispatch('run').ok,false);
 sim.dispatch('set-mode',{value:'automatic'});assert.deepEqual(sim.dispatch('run').intent,'run');
 sim.dispatch('pause');sim.sync({project:bracketProject()});assert.equal(sim.dispatch('run').ok,false);
 p.seams.forEach(s=>s.enabled=false);sim.sync(contextAt(p,0));assert.equal(sim.dispatch('run').ok,false);
});

test('manual single-stage execution requires a stopped or paused controller',()=>{
 const sim=connected();sim.dispatch('set-mode',{value:'manual'});assert.equal(sim.dispatch('step').ok,false);
 sim.dispatch('motors-on');assert.equal(sim.dispatch('step').intent,'step');assert.equal(sim.snapshot().execution,'stepping');
 assert.equal(sim.dispatch('step').ok,false);assert.equal(sim.dispatch('pause').intent,'pause');assert.equal(sim.snapshot().execution,'paused');
 assert.equal(sim.dispatch('step').ok,true);
});

test('pause, motor off, disconnect and stop immediately cancel simulated weld command',()=>{
 const p=defaultProject(),w=lineSummary(p).stations[0].tasks[0],sim=connected(p);sim.dispatch('motors-on');sim.dispatch('run');
 sim.sync(contextAt(p,w.start+.02));assert.equal(sim.snapshot().stations[0].signals.welding,true);
 sim.dispatch('pause');assert.equal(sim.snapshot().stations[0].signals.welding,false);assert.equal(sim.snapshot().stations[0].signals.current,0);
 sim.dispatch('run');sim.dispatch('motors-off');assert.equal(sim.snapshot().execution,'stopped');assert.equal(sim.snapshot().stations[0].signals.welding,false);
 sim.dispatch('motors-on');sim.dispatch('run');assert.equal(sim.dispatch('stop').intent,'stop');assert.equal(sim.snapshot().executing,false);
 sim.dispatch('run');sim.dispatch('disconnect');assert.equal(sim.snapshot().motorsOn,false);assert.equal(sim.snapshot().stations[0].signals.welding,null);
});

test('mode change stops execution, and editing name cannot inject unsupported connection settings',()=>{
 const sim=connected();sim.dispatch('motors-on');sim.dispatch('run');assert.equal(sim.dispatch('set-mode',{value:'manual'}).intent,'pause');
 assert.equal(sim.snapshot().execution,'stopped');assert.equal(sim.dispatch('set-mode',{value:'remote'}).ok,false);
 assert.equal(sim.dispatch('set-name',{value:'  BIW demo  '}).ok,true);assert.equal(sim.snapshot().name,'BIW demo');
 assert.equal(sim.dispatch('set-name',{value:''}).ok,false);assert.equal(sim.dispatch('select-station',{value:'OP40'}).ok,false);
 sim.dispatch('select-station',{value:'OP20'});assert.equal(sim.snapshot().selectedStation,'OP20');
});

test('faults latch, cancel motors, block start and require explicit reset plus re-arming',()=>{
 const sim=connected();sim.dispatch('motors-on');sim.dispatch('run');sim.dispatch('fault',{code:'TEST',message:'测试故障'});
 assert.equal(sim.snapshot().execution,'faulted');assert.equal(sim.snapshot().motorsOn,false);assert.equal(sim.dispatch('motors-on').ok,false);
 assert.equal(sim.dispatch('run').ok,false);sim.dispatch('reset');assert.equal(sim.snapshot().faults.length,0);assert.equal(sim.dispatch('run').ok,false);
 sim.dispatch('motors-on');assert.equal(sim.dispatch('run').ok,true);
});

test('all stations derive I/O from exactly the supplied scene time, including rewind',()=>{
 const p=defaultProject(),line=lineSummary(p),sim=connected(p);sim.dispatch('motors-on');sim.dispatch('run');
 const w=line.stations[1].tasks[0],welding=w.stages.find(x=>x.kind==='weld'),hold=w.stages.find(x=>x.kind==='hold'),open=w.stages.find(x=>x.kind==='open');
 let s=sim.sync(contextAt(p,(welding.start+welding.end)/2));assert.equal(s.stations[1].signals.welding,true);assert.equal(s.stations[1].signals.gunClosed,true);assert.equal(s.stations[1].signals.current,p.engineering.spotCurrent);assert.equal(s.stations[1].signals.force,p.engineering.gunForce);
 s=sim.sync(contextAt(p,(hold.start+hold.end)/2));assert.equal(s.stations[1].signals.welding,false);assert.equal(s.stations[1].signals.hold,true);assert.equal(s.stations[1].signals.force,p.engineering.gunForce);
 s=sim.sync(contextAt(p,(open.start+open.end)/2));assert.equal(s.stations[1].signals.gunClosed,false);assert.equal(s.stations[1].signals.hold,false);
 s=sim.sync(contextAt(p,line.work+.1));assert.ok(s.stations.every(st=>st.signals.complete&&st.signals.gunOpen&&!st.signals.fixtureClosed));
 s=sim.sync(contextAt(p,0));assert.ok(s.stations.every(st=>!st.signals.complete&&st.completed===0&&!st.signals.welding));
});

test('scene collision or invalid axis faults a running controller but not passive preview',()=>{
 for(const property of [{collisions:['body']},{reachable:false},{joints:[{limited:true}]}]){
  const p=defaultProject(),sim=connected(p),ctx=contextAt(p,1);Object.assign(ctx.sceneState.stations[2],property);
  sim.sync(ctx);assert.equal(sim.snapshot().faults.length,0);
  sim.dispatch('motors-on');sim.dispatch('run');const s=sim.sync(ctx);assert.equal(s.execution,'faulted');assert.equal(s.faults[0].code,'SIM_MOTION_FAULT');assert.equal(s.motorsOn,false);
 }
});

test('new sheet-metal electrode contact governs closed feedback and pressure ramp',()=>{
 const p=defaultProject(),sim=connected(p),w=lineSummary(p).stations[0].tasks[0],ctx=contextAt(p,w.start+.02);
 sim.dispatch('motors-on');sim.dispatch('run');ctx.sceneState.stations[0].contact={seated:false,current:8,force:3};
 let s=sim.sync(ctx);assert.equal(s.stations[0].signals.gunClosed,false);assert.equal(s.stations[0].signals.welding,false);
 ctx.sceneState.stations[0].contact={seated:true,current:7.5,force:2.2};s=sim.sync(ctx);assert.equal(s.stations[0].signals.gunClosed,true);assert.equal(s.stations[0].signals.current,7.5);assert.equal(s.stations[0].signals.force,2.2);
});

test('step boundary handles exact boundaries, empty station and no work without NaN',()=>{
 const p=defaultProject(),line=lineSummary(p),st=line.stations[0];
 assert.equal(stepBoundary(p,0,'OP10'),st.stages[0].end);
 assert.equal(stepBoundary(p,st.stages[0].end,'OP10'),st.stages[1].end);
 assert.equal(stepBoundary(p,st.stages[0].end-1e-10,'OP10'),st.stages[1].end);
 p.seams.filter(s=>['W01','W02','W03','W04'].includes(s.id)).forEach(s=>s.enabled=false);
 assert.ok(stepBoundary(p,0,'OP10')>0);
 p.seams.forEach(s=>s.enabled=false);assert.equal(stepBoundary(p,0,'OP20'),0);
 assert.equal(stepBoundary(bracketProject(),2),2);
});

test('RAPID preview follows enabled station tasks and advertises its non-executable scope',()=>{
 const p=defaultProject();p.seams.find(s=>s.id==='W05').enabled=false;
 const lines=rapidPreview(p,'OP20');assert.match(lines[0].text,/不是可执行/);assert.ok(!lines.some(l=>l.seam==='W05'));assert.ok(lines.some(l=>l.seam==='W06'));
 const stages=lines.filter(l=>l.start!==undefined);assert.ok(stages.every(l=>l.end>l.start));assert.ok(stages.some(l=>l.phase==='hold'));
 assert.ok(!lines.some(l=>l.seam==='W01'));
});

test('snapshots are detached and event history stays bounded',()=>{
 const sim=connected(),s=sim.snapshot();s.events.length=0;s.stations[0].signals.welding=true;assert.ok(sim.snapshot().events.length>0);assert.equal(sim.snapshot().stations[0].signals.welding,false);
 for(let i=0;i<130;i++)sim.dispatch('set-name',{value:'Sim '+i});assert.equal(sim.snapshot().events.length,100);
});

test('every Studio tab labels local simulation and escapes user-entered names',()=>{
 const p=defaultProject(),sim=connected(p);sim.dispatch('set-name',{value:'<img onerror=x>'});
 for(const tab of ['controller','rapid','tool','io','events']){const html=studioMarkup(sim.snapshot(),p,null,{tab,station:'OP20'});assert.match(html,/RobotStudio 风格/);assert.match(html,/非 ABB 官方软件/);assert.ok(!html.includes('<img onerror=x>'));assert.match(html,/data-studio-action="connect"|data-studio-action="disconnect"/);}
});
