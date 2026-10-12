import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProject, schedule, heatInput, parseResultsCSV, validateProject, simulate} from '../src/model.js';
test('heat input is kJ/mm and changes with travel speed',()=>{assert.equal(heatInput({current:220,voltage:24,efficiency:0.85,speed:8}),0.561);});
test('weld sequence is complete and excludes disabled seams',()=>{const p=defaultProject();p.seams[1].enabled=false;p.strategy='balanced';const s=schedule(p);assert.equal(s.length,3);assert.equal(new Set(s.map(x=>x.id)).size,3);assert.ok(s.every((v,i)=>i===0||v.start>=s[i-1].end));});
test('CSV validates numerical data and supports CRLF',()=>{const r=parseResultsCSV('time_s,temperature_c,stress_mpa,displacement_mm\r\n0,20,0,0\r\n10,830,210,0.24');assert.equal(r.length,2);assert.throws(()=>parseResultsCSV('time_s,temperature_c,stress_mpa,displacement_mm\n0,no,3,2'));assert.throws(()=>parseResultsCSV('time_s,temperature_c,stress_mpa,displacement_mm\n10,80,2,0.1\n1,20,2,0.1'));});
test('invalid project parameters are rejected without coercion',()=>{const p=defaultProject();p.params.speed=0;assert.throws(()=>validateProject(p));p.params.speed='8';assert.throws(()=>validateProject(p));});
test('simulation labels its provenance and yields finite data',()=>{const s=simulate(defaultProject());assert.equal(s.source,'demo');assert.ok(s.samples.length>10);assert.equal(s.samples[0].temperature,20);assert.ok(s.samples.every(x=>Number.isFinite(x.temperature)&&Number.isFinite(x.stress)&&Number.isFinite(x.displacement)));});
