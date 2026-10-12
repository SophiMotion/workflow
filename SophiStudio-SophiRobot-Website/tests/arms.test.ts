import {it,expect} from 'vitest';
import {joints,neutralPose,validatePose,parseArmConfig} from '../src/arms';
it('retains the user-specified shoulder ranges',()=>{expect(joints[0]).toMatchObject({min:-180,max:180});expect(joints[1]).toMatchObject({min:-100,max:40});for(const shoulder_lift of [-180,-90,0,90,180])for(const shoulder_swing of [-100,40])expect(validatePose({...neutralPose,shoulder_lift,shoulder_swing})).toEqual([])});
it('rejects invalid and nonfinite angles',()=>{for(const shoulder_lift of [-181,181,360,NaN,Infinity])expect(validatePose({...neutralPose,shoulder_lift})).toHaveLength(1)});
it('preserves fixed pose serialization',()=>{const p={pose:{...neutralPose,elbow_bend:90},movable:false};expect(parseArmConfig(JSON.parse(JSON.stringify(p)))).toEqual(p)});
