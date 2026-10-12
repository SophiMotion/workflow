import {neutralLimbs,type LimbPoses} from './limbs';

/** Two-second in-place preview cycle. Uses the existing knee sign convention. */
export function walkingPose(seconds:number,initial:LimbPoses=neutralLimbs()):LimbPoses{
 const pose=neutralLimbs(),phase=seconds*Math.PI;
 for(const side of ['l','r'] as const){
  const swing=Math.sin(phase+(side==='r'?Math.PI:0));
  pose[`leg_${side}`].shoulder_lift=20*swing;
  pose[`leg_${side}`].elbow_bend=30*Math.max(0,swing)**2;
  pose[`arm_${side}`].shoulder_lift=-12*swing;
  pose[`arm_${side}`].elbow_bend=8+4*swing;
  pose[`arm_${side}`].wrist_rotation=initial[`arm_${side}`].wrist_rotation;
  pose[`arm_${side}`].clamp=initial[`arm_${side}`].clamp;
 }
 return pose;
}
