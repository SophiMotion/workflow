import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/model.js';
import {motionAt} from '../src/motion.js';

test('cycle accounting separates production, maintenance allowance and observation',()=>{
  assert.equal(typeof model.cycleSummary,'function');
  const p=model.bracketProject();
  const a=model.cycleSummary(p);
  p.params.coolDuration+=100;
  const b=model.cycleSummary(p);
  assert.equal(a.station,b.station);
  assert.equal(b.observation-a.observation,100);
  assert.ok(Math.abs(a.stages.reduce((s,x)=>s+x.duration,0)-a.station)<1e-8);
  assert.equal(a.target,60);
  p.engineering.availability=80;
  assert.equal(model.cycleSummary(p).budget,48);
});

test('spot welding keeps TCP stationary while squeezing, welding and holding',()=>{
  const p=model.bracketProject();p.process='spot';
  assert.doesNotThrow(()=>model.validateProject(p));
  const plan=model.schedule(p),s=plan[0];
  assert.equal(s.duration,.25);
  const a=motionAt(s.start+.05,plan,p),b=motionAt(s.end-.05,plan,p);
  assert.equal(a.arc,false);
  assert.equal(a.energized,true);
  assert.ok(a.root.distanceTo(b.root)<1e-10);
  const hold=motionAt(s.end+.05,plan,p);
  assert.equal(hold.energized,false);
  assert.equal(hold.phase,'保压');
  assert.ok(hold.root.distanceTo(a.root)<1e-10);
});

test('laser weld duration uses laser speed and never displays an electric arc',()=>{
  const p=model.bracketProject();p.process='laser';
  assert.doesNotThrow(()=>model.validateProject(p));
  p.engineering.laserSpeed=40;
  const plan=model.schedule(p);
  assert.equal(plan[0].duration,8);
  const pose=motionAt(plan[0].start+1,plan,p);
  assert.equal(pose.arc,false);
  assert.equal(pose.energized,true);
});

test('empty work and invalid engineering values cannot claim productive capacity',()=>{
  assert.equal(typeof model.cycleSummary,'function');
  const p=model.bracketProject();p.seams.forEach(s=>s.enabled=false);
  assert.equal(model.cycleSummary(p).station,0);
  assert.equal(model.cycleSummary(p).capacity,0);
  p.engineering.targetJph=0;assert.throws(()=>model.validateProject(p));
  p.engineering.targetJph=60;p.engineering.availability=101;assert.throws(()=>model.validateProject(p));
});

test('legacy projects migrate engineering defaults and preserve custom durations',()=>{
  const p=model.bracketProject();delete p.engineering;delete p.outcome;
  const restored=model.validateProject(p);
  assert.equal(restored.engineering?.targetJph,60);
  assert.equal(restored.outcome,'nominal');
  restored.engineering.spotWeld=.4;
  assert.equal(model.validateProject(JSON.parse(JSON.stringify(restored))).engineering.spotWeld,.4);
});

import {robotPose,envelopeReport} from '../src/motion.js';
import {beadProfile,thermalConstants} from '../src/process.js';
test('near-miss threshold cannot hide a deeper collision on the same tool segment',()=>{
 const p=model.bracketProject(),pose=robotPose('W01',0,p);pose.nozzle.set(.7,1.06,.5);
 const report=envelopeReport(pose,30);
 assert.ok(report.hits.some(h=>h.link==='枪颈'&&h.obstacle==='工作台'));
 assert.ok(report.minimum<0);
});

test('result examples alter morphology and thermal plots without changing cycle accounting',()=>{
 const p=model.bracketProject();p.process='spot';const before=model.cycleSummary(p).station,nominal=beadProfile(p),peak=thermalConstants(p).peak;
 p.outcome='under';assert.ok(beadProfile(p).width<nominal.width);assert.ok(thermalConstants(p).peak<peak);assert.equal(model.cycleSummary(p).station,before);
 p.outcome='over';assert.ok(beadProfile(p).width>nominal.width);assert.ok(thermalConstants(p).peak>peak);
});
