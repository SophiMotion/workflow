import {expect,it} from 'vitest';
import {gesturePose,gestureNames,GESTURE_DURATION} from '../src/gestures';
import {neutralLimbs,limbKeys,validateLimb} from '../src/limbs';
for(const gesture of gestureNames){
 it(`${gesture} returns to the original pose and preserves legs and hand settings`,()=>{
  const initial=neutralLimbs();initial.arm_r.shoulder_lift=40;initial.arm_l.wrist_rotation=35;initial.arm_r.clamp=20;
  const saved=structuredClone(initial);
  expect(gesturePose(gesture,0,initial)).toEqual(initial);
  expect(gesturePose(gesture,GESTURE_DURATION,initial)).toEqual(initial);
  const middle=gesturePose(gesture,2,initial);
  expect(middle).not.toEqual(initial);expect(middle.leg_l).toEqual(initial.leg_l);expect(middle.leg_r).toEqual(initial.leg_r);
  expect(middle.arm_l.wrist_rotation).toBe(35);expect(middle.arm_r.clamp).toBe(20);expect(initial).toEqual(saved);
 });
 it(`${gesture} stays within all preview joint ranges`,()=>{
  for(let t=0;t<=GESTURE_DURATION;t+=.03){const pose=gesturePose(gesture,t,neutralLimbs());for(const limb of limbKeys)expect(validateLimb(limb,pose[limb])).toEqual([]);}
 });
}
