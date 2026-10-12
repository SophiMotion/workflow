import {describe,it,expect} from 'vitest';
import model from '../public/model.json';
import {defaults,fields,validate} from '../src/parameters';
import {deform,boundsOf,roleOf} from '../src/geometry';
const mesh=(id:number)=>model.meshes[id];
const b=(id:number,p=defaults)=>boundsOf(deform(mesh(id),p));
describe('source and defaults',()=>{
 it('has the expected 506 source bodies and two covers',()=>{expect(model.meshes.length).toBe(506);expect(model.meshes.filter(m=>roleOf(m)==='cover').length).toBe(2)});
 it('preserves every original coordinate at default settings',()=>{for(const m of model.meshes) expect(Array.from(deform(m,defaults))).toEqual(m.positions)});
 it('keeps GPU float32 quantization below 0.001 mm',()=>{let error=0;for(const m of model.meshes){const gpu=Float32Array.from(deform(m,defaults));gpu.forEach((v,i)=>error=Math.max(error,Math.abs(v-m.positions[i])));}expect(error).toBeLessThan(.001)});
 it('uses actual STEP overall dimensions',()=>{expect(b(17).max[2]).toBeCloseTo(1744);expect(b(8).center[0]-b(4).center[0]).toBeCloseTo(600)});
});
describe('validation',()=>{
 it('accepts measured defaults',()=>expect(validate(defaults)).toEqual([]));
 it.each([NaN,Infinity,-1,0])('rejects invalid length %s',v=>expect(validate({...defaults,base_length:v}).length).toBeGreaterThan(0));
 it('rejects wheels outside frame and excessive hip height',()=>{expect(validate({...defaults,wheel_base:890}).length).toBeGreaterThan(0);expect(validate({...defaults,wheel_track:840}).length).toBeGreaterThan(0);expect(validate({...defaults,hip_position:1600}).length).toBeGreaterThan(0)});
 it('rejects impossible tire and folded base',()=>{expect(validate({...defaults,tire_thickness:140}).length).toBeGreaterThan(0);expect(validate({...defaults,base_middle_length:250}).length).toBeGreaterThan(0)});
});
describe('parameter behavior',()=>{
 it('moves drive train rigidly by half axle and track changes',()=>{const p={...defaults,wheel_base:540,wheel_track:620};for(const id of [3,4,5,6,7,8,21,22]){const a=b(id),c=b(id,p);expect(c.center[0]-a.center[0]).toBeCloseTo(Math.sign(a.center[0])*10);expect(c.center[1]-a.center[1]).toBeCloseTo(20);c.size.forEach((s,i)=>expect(s).toBeCloseTo(a.size[i]));}expect(b(9,p).center[1]-b(9).center[1]).toBeCloseTo(-20)});
 it('grounds resized tires and keeps motors aligned to axle',()=>{const p={...defaults,od_tire:180};expect(b(4,p).min[2]).toBeCloseTo(0);expect(b(8,p).min[2]).toBeCloseTo(0);expect(b(5,p).center[2]).toBeCloseTo(90);expect(b(6,p).center[2]).toBeCloseTo(90);expect(b(5,p).size).toEqual(b(5).size)});
 it('keeps wheel hub bore rigid when changing rim diameter',()=>{const p={...defaults,tire_thickness:30};expect(b(6,p)).toEqual(b(6));expect(b(3,p).size[1]).toBeCloseTo(120)});
 it('moves hip from deck and preserves its spine mounting ends',()=>{const p={...defaults,hip_position:900,hip_length:400,base_height:220};expect(b(23,p).min[0]).toBeCloseTo(40);expect(b(23,p).max[0]).toBeCloseTo(200);expect(b(24,p).max[0]).toBeCloseTo(-40);expect(b(23,p).min[2]).toBeCloseTo(1170)});
 it('keeps shoulder attached to spine',()=>{const p={...defaults,total_height:1800,shoulder_length:550};expect(b(11,p).max[2]).toBeCloseTo(b(17,p).min[2]);expect(b(17,p).max[2]).toBeCloseTo(1668.25);expect(b(17,p).size[0]).toBeCloseTo(550)});
 it('maintains upright-to-crossmember connections when base height changes',()=>{const p={...defaults,base_height:240,thin_sheet:3};expect(b(15,p).min[2]).toBeCloseTo(b(14,p).max[2]);expect(b(15,p).max[2]).toBeCloseTo(b(12,p).min[2])});
 it('sets thin cover thickness while holding outer top surface',()=>{const p={...defaults,thin_sheet:4};const m=mesh(1),v=deform(m,p);for(let i=0;i<v.length;i+=3){if(Math.abs(m.positions[i+2]-248)<1e-7) expect(v[i+2]).toBeCloseTo(246);if(Math.abs(m.positions[i+2]-250)<1e-7) expect(v[i+2]).toBeCloseTo(250)}});
 it('keeps absent structural mounts read-only',()=>{expect(validate({...defaults,structural_sheet:6}).length).toBeGreaterThan(0)});
 it('never accumulates distortion',()=>{const m=mesh(0),original=[...m.positions];const a=deform(m,{...defaults,base_length:1000});deform(m,{...defaults,base_length:950});expect(deform(m,{...defaults,base_length:1000})).toEqual(a);expect(m.positions).toEqual(original);expect(Array.from(deform(m,defaults))).toEqual(original)});
 it.each(fields.filter(f=>f.key!=='structural_sheet').map(f=>[f.key,f.test] as const))('changes real geometry for %s',(key,value)=>{const p={...defaults,[key]:value};expect(validate(p)).toEqual([]);expect(model.meshes.some(m=>{const a=deform(m,p);return a.some((v,i)=>Math.abs(v-m.positions[i])>1e-6)})).toBe(true)});
});
