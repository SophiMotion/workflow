import {expect,it} from 'vitest';
import {createFusionRequest} from '../src/fusion-export';
import {defaults} from '../src/parameters';
import {neutralLimbs,fixedModes} from '../src/limbs';
import {defaultMotors} from '../src/motors';
const sha='a8435cbd1f3598f699c9bc4f95bd08b898c1e92c5d29baf5d6665e07fb7ed3de';
const config=()=>({version:1,source:'Assembly testing website 4.step',sourceSha256:sha,parameters:{...defaults},limbs:{pose:neutralLimbs(),movable:fixedModes()},motors:defaultMotors()});
it('creates an explicit Fusion handoff with dimensions, pose and motor metadata',()=>{const c=config();c.limbs.pose.arm_l.wrist_rotation=40;const r=createFusionRequest(c,sha,'website');expect(r.fusionExport.poseMode).toBe('website');expect(r.limbs.pose.arm_l.wrist_rotation).toBe(40);expect(r.motors).toEqual(c.motors);expect(r.parameters).toEqual(defaults)});
it('makes keeping the Fusion pose explicit',()=>expect(createFusionRequest(config(),sha,'fusion').fusionExport.poseMode).toBe('fusion'));
it('rejects invalid dimensions and joint state before download',()=>{const c=config();c.parameters.base_length=1;expect(()=>createFusionRequest(c,sha,'website')).toThrow();c.parameters.base_length=900;c.limbs.pose.arm_l.clamp=46;expect(()=>createFusionRequest(c,sha,'website')).toThrow()});

it('includes head pose and requires the updated companion request format',()=>{const c={...config(),head:{pose:{rotation:20,tilt:-15},movable:true}};const r=createFusionRequest(c,sha,'website');expect(r.head).toEqual(c.head);expect(r.fusionExport.version).toBe(2);});
