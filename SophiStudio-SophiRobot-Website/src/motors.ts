export const motorGroups=['Shoulder','Knee','Elbow','Wrist'] as const;
export const motorSlots=['shoulder_l','shoulder_r','knee_l','knee_r','elbow_l','elbow_r','wrist_l','wrist_r','base_l','base_r'] as const;
export type MotorSlot=typeof motorSlots[number];
export const motorOptions=['current','option_a','option_b'] as const;
export type MotorOption=typeof motorOptions[number];
export const motorTypes=['Unspecified','Servo','Stepper','BLDC','Other'] as const;
export const specFields=[{key:'torque',label:'Rated torque',unit:'N·m'},{key:'speed',label:'Rated speed',unit:'rpm'},{key:'voltage',label:'Rated voltage',unit:'V'},{key:'ratio',label:'Gear ratio',unit:':1'}] as const;
export interface MotorSpec{name:string;type:typeof motorTypes[number];torque:number|null;speed:number|null;voltage:number|null;ratio:number|null}
export type Motors=Record<MotorSlot,{selected:MotorOption;options:Record<MotorOption,MotorSpec>}>;
export function defaultMotors():Motors{return Object.fromEntries(motorSlots.map(slot=>[slot,{selected:'current',options:Object.fromEntries(motorOptions.map((id,i)=>[id,{name:i===0?'Current motor (unspecified)':`Option ${i===1?'A':'B'} (placeholder)`,type:'Unspecified',torque:null,speed:null,voltage:null,ratio:null}]))}])) as Motors;}
export function parseMotors(value:unknown):Motors{
 if(value===undefined)return defaultMotors();
 if(!value||typeof value!=='object')throw new Error('Invalid motor selections.');
 const input=value as Motors,out=defaultMotors();
 for(const slot of motorSlots){const item=input[slot];if(slot.startsWith('base_')&&item===undefined)continue;if(!item||!motorOptions.includes(item.selected)||!item.options)throw new Error('Invalid motor selection: '+slot);
  out[slot].selected=item.selected;
  for(const id of motorOptions){const s=item.options[id];if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!motorTypes.includes(s.type))throw new Error('Enter a motor name and valid type for '+slot+'.');
   const copy:MotorSpec={name:s.name,type:s.type,torque:null,speed:null,voltage:null,ratio:null};
   for(const {key} of specFields){const v=s[key];if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9||(key==='ratio'&&v===0)))throw new Error('Use a valid positive gear ratio or nonnegative motor specification. Leave unknown values blank.');copy[key]=v;}
   out[slot].options[id]=copy;
  }
 }
 return out;
}
