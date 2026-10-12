import {it,expect} from 'vitest';
import {walkingPose} from '../src/walk';
import {neutralLimbs,limbKeys,validateLimb} from '../src/limbs';
it('alternates legs and counter-swings arms over a repeating cycle',()=>{
 const a=walkingPose(.5),b=walkingPose(1.5),repeat=walkingPose(2.5);
 expect(a.leg_l.shoulder_lift).toBeCloseTo(-a.leg_r.shoulder_lift);
 expect(a.arm_l.shoulder_lift).toBeCloseTo(-a.leg_l.shoulder_lift*.6);
 expect(a.leg_l.shoulder_lift).toBeCloseTo(b.leg_r.shoulder_lift);
 expect(repeat.leg_l.shoulder_lift).toBeCloseTo(a.leg_l.shoulder_lift);
});
it('keeps every joint within preview limits, with knees bending only in the existing direction',()=>{
 for(let t=0;t<4;t+=.025){const pose=walkingPose(t);for(const limb of limbKeys)expect(validateLimb(limb,pose[limb])).toEqual([]);}
});
it('preserves hand settings and never mutates the original pose',()=>{
 const initial=neutralLimbs();initial.arm_l.wrist_rotation=30;initial.arm_r.clamp=20;
 const saved=structuredClone(initial),pose=walkingPose(.5,initial);
 expect(initial).toEqual(saved);expect(pose.arm_l.wrist_rotation).toBe(30);expect(pose.arm_r.clamp).toBe(20);
});
