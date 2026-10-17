import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProject,validateProject,schedule,simulate} from '../src/model.js';
import {engineeringReport} from '../src/report.js';
import {lineSummary,cycleSummary} from '../src/engineering.js';
import {lineMotionAt,lineCheck} from '../src/line-motion.js';

test('default project is a round-trippable three-station BIW spot line with 12 unique points',()=>{
 const p=validateProject(JSON.parse(JSON.stringify(defaultProject())));
 assert.equal(p.process,'spot');assert.equal(p.scene,'biw-line');
 assert.equal(new Set(p.seams.map(s=>s.id)).size,12);
 const line=lineSummary(p);assert.equal(line.stations.length,3);
 assert.ok(line.stations.every(s=>s.tasks.length===4));
 p.activeStation='OP30';assert.deepEqual(schedule(p).map(s=>s.id),['W09','W10','W12','W11']);
});

test('parallel line takt is the bottleneck plus ONE common transfer, not a sum of stations',()=>{
 const p=defaultProject(),line=lineSummary(p);
 assert.equal(line.bottleneck,'OP20');
 assert.ok(Math.abs(line.work-28.1)<1e-9);
 assert.ok(Math.abs(line.station-32.1)<1e-9);
 assert.ok(Math.abs(line.average-32.34)<1e-9);
 assert.equal(line.residence,3*line.station);
 for(const s of line.stations){assert.equal(s.stages.at(-1).start,line.work);assert.equal(s.stages.at(-1).end,line.station);}
 p.params.coolDuration=240;assert.equal(cycleSummary(p).duration,line.station);
 p.engineering.lineTransfer1=5;assert.equal(lineSummary(p).bottleneck,'OP10');
});

test('gun, completed points and clamps follow the same clock, including seek and disabled tasks',()=>{
 const p=defaultProject(),line=lineSummary(p),s=line.stations[0],w=s.tasks[0];
 const a=lineMotionAt(w.start+.02,s,p,line),b=lineMotionAt(w.end-.02,s,p,line);
 assert.equal(a.energized,true);assert.equal(a.gunOpening,0);assert.equal(a.clamp,1);
 assert.ok(a.root.distanceTo(b.root)<1e-10);
 assert.ok(lineMotionAt(w.end+.01,s,p,line).done.includes(w.id));
 assert.equal(lineMotionAt(0,s,p,line).done.length,0);
 const transfer=lineMotionAt(line.work+line.index/2,s,p,line);
 assert.equal(transfer.kind,'index');assert.equal(transfer.clamp,0);assert.equal(transfer.gunOpening,1);assert.equal(transfer.energized,false);
 assert.ok(Math.abs(transfer.carOffset-3)<1e-8);
 p.seams[0].enabled=false;assert.ok(!lineSummary(p).stations[0].tasks.some(t=>t.id==='W01'));
 p.seams.forEach(s=>s.enabled=false);assert.equal(lineSummary(p).capacity,0);assert.equal(lineSummary(p).duration,0);
});

test('all line motions maintain fixed arms and continuous TCP at stage boundaries',()=>{
 const p=defaultProject();
 for(const strategy of ['balanced','sequential','reverse']){
  p.strategy=strategy;const line=lineSummary(p);
  for(const s of line.stations){
   for(let t=0;t<=line.duration;t+=.1){const pose=lineMotionAt(t,s,p,line);assert.ok(pose.reachable,`${s.id} ${t}`);assert.ok(Math.abs(pose.shoulder.distanceTo(pose.elbow)-1.35)<1e-8);assert.ok(Math.abs(pose.elbow.distanceTo(pose.wrist)-1.5)<1e-8);assert.deepEqual(lineCheck(pose).hits,[],`${s.id} ${t}`);}
   for(const stage of s.stages.slice(1)){const a=lineMotionAt(stage.start-1e-7,s,p,line),b=lineMotionAt(stage.start+1e-7,s,p,line);assert.ok(a.root.distanceTo(b.root)<1e-5,`${s.id} ${stage.kind} discontinuity`);}
  }
 }
});

test('an empty selected station does not hide other work, and report retains all station schedules',()=>{
 const p=defaultProject();p.seams.filter(s=>['W01','W02','W03','W04'].includes(s.id)).forEach(s=>s.enabled=false);
 assert.equal(schedule(p).length,0);const result=simulate(p);assert.equal(result.samples.length,241);
 const report=engineeringReport(p,result,null);assert.match(report,/三站并行/);assert.match(report,/OP30 \/ W12/);assert.ok(!report.includes('单机器人串行'));
});

test('imported task array order cannot silently change the selected welding strategy',()=>{
 const p=defaultProject(),before=lineSummary(p).stations.map(s=>s.tasks.map(t=>t.id));
 p.seams.reverse();assert.deepEqual(lineSummary(validateProject(p)).stations.map(s=>s.tasks.map(t=>t.id)),before);
 p.seams[0].id='W01';assert.throws(()=>validateProject(p));
});
