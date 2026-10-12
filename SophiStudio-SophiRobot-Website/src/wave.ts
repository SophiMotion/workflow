import type {LimbPoses} from './limbs';
import type {JointKey} from './arms';
export const WAVE_DURATION=4.8;
export function wavePose(seconds:number,original:LimbPoses):LimbPoses{
 const pose=structuredClone(original);
 if(seconds<=0||seconds>=WAVE_DURATION)return pose;
 const x=Math.max(0,Math.min(1,seconds/.8,(WAVE_DURATION-seconds)/.8)),blend=x*x*(3-2*x);
 const oscillation=Math.sin(Math.max(0,seconds-.8)*Math.PI*3);
 const target={shoulder_lift:-145,shoulder_swing:-25+8*oscillation,arm_twist:0,elbow_bend:25,wrist_rotation:25*oscillation,clamp:0};
 for(const joint of Object.keys(target) as JointKey[])pose.arm_r[joint]=original.arm_r[joint]+(target[joint]-original.arm_r[joint])*blend;
 return pose;
}
