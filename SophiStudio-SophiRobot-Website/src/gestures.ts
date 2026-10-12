import type {LimbPoses} from './limbs';
export const gestureNames=['welcome','reach','celebrate'] as const;
export type Gesture=typeof gestureNames[number];
export const GESTURE_DURATION=4;
export const gestureLabels:Record<Gesture,string>={welcome:'Welcome',reach:'Reach forward',celebrate:'Celebrate'};
export function gesturePose(gesture:Gesture,seconds:number,original:LimbPoses):LimbPoses{
 const pose=structuredClone(original);
 if(seconds<=0||seconds>=GESTURE_DURATION)return pose;
 const x=Math.max(0,Math.min(1,seconds/.9,(GESTURE_DURATION-seconds)/.9)),blend=x*x*(3-2*x);
 const pulse=Math.sin(Math.max(0,seconds-.9)*Math.PI*3);
 const targets={
  welcome:{shoulder_lift:-25,shoulder_swing:-60,elbow_bend:20,arm_twist:0},
  reach:{shoulder_lift:-85,shoulder_swing:-8,elbow_bend:12,arm_twist:0},
  celebrate:{shoulder_lift:-155+8*pulse,shoulder_swing:-20,elbow_bend:25+10*pulse,arm_twist:0}
 }[gesture];
 for(const limb of ['arm_l','arm_r'] as const)for(const joint of Object.keys(targets) as (keyof typeof targets)[]){
  pose[limb][joint]=original[limb][joint]+(targets[joint]-original[limb][joint])*blend;
 }
 return pose;
}
