import {it,expect} from 'vitest';
import {Matrix4,Vector3} from 'three';
import {neutralPose,parseArmConfig} from '../src/arms';
import {neutralLimbs,fixedModes,parseLimbConfig,limbMatrix,limbPivots,limbJoints} from '../src/limbs';
import {defaults} from '../src/parameters';

it.each(['arm_l','arm_r'] as const)('%s enforces provisional servo limits and preserves saved angles',key=>{
 for(const [wrist_rotation,clamp] of [[-90,0],[0,22],[90,45]]){const pose=neutralLimbs();Object.assign(pose[key],{wrist_rotation,clamp});expect(parseLimbConfig({pose,movable:fixedModes()}).pose[key]).toEqual(pose[key]);}
 for(const [field,value] of [['wrist_rotation',-91],['wrist_rotation',91],['clamp',-1],['clamp',46],['clamp',NaN],['wrist_rotation','30'],['clamp',null]] as const){const pose=neutralLimbs();Object.assign(pose[key],{[field]:value});expect(()=>parseLimbConfig({pose,movable:fixedModes()})).toThrow();}
});
it('loads older saved poses with both new servo angles at zero',()=>{
 const pose=neutralLimbs();for(const p of Object.values(pose)){delete (p as Partial<typeof p>).wrist_rotation;delete (p as Partial<typeof p>).clamp;}
 const restored=parseLimbConfig({pose,movable:fixedModes()});for(const p of Object.values(restored.pose)){expect(p.wrist_rotation).toBe(0);expect(p.clamp).toBe(0);}
 const legacy={...neutralPose};delete (legacy as Partial<typeof legacy>).wrist_rotation;delete (legacy as Partial<typeof legacy>).clamp;
 expect(parseArmConfig({pose:legacy,movable:false}).pose).toEqual(neutralPose);
});
it('does not offer or import hand angles on legs',()=>{expect(limbJoints('leg_l').map(j=>j.key)).toEqual(['shoulder_lift','elbow_bend']);const pose=neutralLimbs();pose.leg_r.clamp=1;expect(()=>parseLimbConfig({pose,movable:fixedModes()})).toThrow();});
it.each(['arm_l','arm_r'] as const)('%s wrist moves only the wrist output and gripper',key=>{
 const pose=neutralLimbs();pose[key].wrist_rotation=60;
 const moving=key==='arm_l'?[270,281,282,283,286,297,298,299]:[457,468,469,470,473,484,485,486];
 const fixed=key==='arm_l'?[158,267,268,269,279,280,300,301,457,486]:[451,452,453,454,455,456,466,467,270,299];
 for(const id of moving)expect(limbMatrix(id,defaults,pose).equals(new Matrix4())).toBe(false);
 for(const id of fixed)expect(limbMatrix(id,defaults,pose)).toEqual(new Matrix4());
});
it.each(['arm_l','arm_r'] as const)('%s clamping moves the driven jaw but keeps the fixed jaw and servo housing still',key=>{
 const pose=neutralLimbs();pose[key].clamp=30;
 for(const id of key==='arm_l'?[286,297,298,299]:[473,484,485,486])expect(limbMatrix(id,defaults,pose).equals(new Matrix4())).toBe(false);
 for(const id of key==='arm_l'?[270,281,282,283,284,285,295,296,486]:[457,468,469,470,471,472,482,483,299])expect(limbMatrix(id,defaults,pose)).toEqual(new Matrix4());
});
it.each(['arm_l','arm_r'] as const)('%s keeps servo hinge connections aligned after resizing and posing the arm',key=>{
 const pose=neutralLimbs();pose[key]={...neutralPose,shoulder_lift:-60,shoulder_swing:-25,arm_twist:20,elbow_bend:70,wrist_rotation:50,clamp:35};
 const p={...defaults,shoulder_length:550,total_height:2000,upper_arm_length:250,lower_arm_length:380};const q=limbPivots(key,p);
 for(const [pivot,a,b] of [[q.wrist!,key==='arm_l'?267:454,key==='arm_l'?282:469],[q.clamp!,key==='arm_l'?283:470,key==='arm_l'?299:486]] as const){const point=new Vector3(...pivot);expect(point.clone().applyMatrix4(limbMatrix(a,p,pose)).distanceTo(point.clone().applyMatrix4(limbMatrix(b,p,pose)))).toBeLessThan(1e-8);}
});
