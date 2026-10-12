import {it,expect} from 'vitest';
import {wavePose,WAVE_DURATION} from '../src/wave';
import {neutralLimbs,limbKeys,validateLimb} from '../src/limbs';
it('starts and finishes at the original pose without modifying it',()=>{
 const initial=neutralLimbs();initial.arm_r.shoulder_lift=35;initial.arm_r.clamp=20;
 const copy=structuredClone(initial);
 expect(wavePose(0,initial)).toEqual(initial);
 expect(wavePose(WAVE_DURATION,initial)).toEqual(initial);
 wavePose(2,initial);expect(initial).toEqual(copy);
});
it('waves only the right arm and keeps all angles inside preview limits',()=>{
 const initial=neutralLimbs();
 for(let t=0;t<=WAVE_DURATION;t+=.025){const p=wavePose(t,initial);
  for(const limb of limbKeys)expect(validateLimb(limb,p[limb])).toEqual([]);
  for(const limb of ['arm_l','leg_l','leg_r'] as const)expect(p[limb]).toEqual(initial[limb]);
 }
 expect(wavePose(1.2,initial).arm_r.wrist_rotation).not.toBeCloseTo(wavePose(1.5,initial).arm_r.wrist_rotation);
 expect(wavePose(2,initial).arm_r.shoulder_lift).toBeLessThan(-90);
});
