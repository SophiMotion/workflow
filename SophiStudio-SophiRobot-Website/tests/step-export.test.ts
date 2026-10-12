import {expect,it} from 'vitest';
import {exportPreviewStep} from '../src/step-export';
import {defaults} from '../src/parameters';
import {neutralLimbs} from '../src/limbs';
import type {Model} from '../src/geometry';
const model=(id=0):Model=>({metadata:{source:'test',sha256:'test',units:'mm',meshCount:1,hierarchy:{},bounds:{min:[0,0,0],max:[10,10,0],size:[10,10,0],center:[5,5,0]}},meshes:[{id,name:"Test 'part'",positions:[0,0,0,10,0,0,0,10,0],indices:[0,1,2],bounds:{min:[0,0,0],max:[10,10,0],size:[10,10,0],center:[5,5,0]}}]});
const read=(r:ReturnType<typeof exportPreviewStep>)=>new TextDecoder().decode(Buffer.concat(r.chunks));
it('writes STEP exchange geometry in millimeters with escaped part names',()=>{const result=exportPreviewStep(model(),defaults,neutralLimbs(),true);const s=read(result);expect(s).toContain('ISO-10303-21;');expect(s).toContain('SI_UNIT(.MILLI.,.METRE.)');expect(s).toContain("Test ''part''");expect(s).toContain('FACE_SURFACE');expect(s).toContain('END-ISO-10303-21;');expect(result.triangles).toBe(1)});
it('honors hidden base covers',()=>{expect(()=>exportPreviewStep(model(1),defaults,neutralLimbs(),false)).toThrow('No visible');});
it('applies resized geometry and joint matrices',()=>{const m=model(299),poses=neutralLimbs();poses.arm_l.wrist_rotation=45;const a=read(exportPreviewStep(m,defaults,neutralLimbs(),true));expect(read(exportPreviewStep(m,{...defaults,lower_arm_length:350},poses,true))).not.toBe(a);expect(m.meshes[0].positions).toEqual([0,0,0,10,0,0,0,10,0]);});
it('rejects invalid geometry instead of silently emitting corrupt STEP',()=>{const m=model();m.meshes[0].positions[0]=NaN;expect(()=>exportPreviewStep(m,defaults,neutralLimbs(),true)).toThrow();});

it('exports the requested head pose using the same matrix as the viewer',async()=>{const {Vector3}=await import('three'),{headMatrix}=await import('../src/head');const m=model(265),head={rotation:40,tilt:20},r=read(exportPreviewStep(m,defaults,neutralLimbs(),true,()=>{},head));const coordinates=r.match(/CARTESIAN_POINT\('',\(([^)]+)\)\)/)![1].split(',').map(Number),expected=new Vector3(0,0,0).applyMatrix4(headMatrix(265,defaults,head)).toArray();coordinates.forEach((v,i)=>expect(v).toBeCloseTo(expected[i],6));});
