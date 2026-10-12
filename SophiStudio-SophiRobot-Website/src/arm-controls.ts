import {neutralPose,type JointKey} from './arms';
import {limbKeys,limbLabels,limbJoints,neutralLimbs,fixedModes,validateLimb,type LimbKey,type LimbPoses,type LimbModes} from './limbs';
export class ArmControls{
 pose:LimbPoses=neutralLimbs();movable:LimbModes=fixedModes();valid=true;private active:LimbKey="arm_l";
 constructor(private host:HTMLElement,private change:(pose:LimbPoses,movable:LimbModes,valid:boolean)=>void){this.render();}
 load(pose:LimbPoses,movable:LimbModes){this.pose=structuredClone(pose);this.movable={...movable};this.valid=true;this.render();this.change(this.pose,this.movable,true);}
 private render(){
  const joints=limbJoints(this.active),pose=this.pose[this.active],movable=this.movable[this.active];
  this.host.innerHTML=`<section class="joint-section"><h2>Limb movement</h2><div class="limb-selector" role="group" aria-label="Select limb">${limbKeys.map(k=>`<button data-limb="${k}" aria-pressed="${k===this.active}">${limbLabels[k]}</button>`).join('')}</div><p class="tab-note">${limbLabels[this.active]} · ${this.active.endsWith('_l')?'+X side':'−X side'}</p><div class="arm-modes" role="group" aria-label="Selected limb mode"><button id="arm-fixed" aria-pressed="${!movable}">Fixed</button><button id="arm-movable" aria-pressed="${movable}">Movable</button></div><p class="arm-mode-description">${movable?'Adjust the joints below to pose this limb.':'Current pose is locked. Select Movable to adjust joints.'}</p><div class="joint-fields">${joints.map(j=>`<div class="joint-row"><label for="joint-${j.key}">${j.label}<small>${j.axis}</small></label><div class="number-input"><input id="joint-${j.key}" type="number" min="${j.min}" max="${j.max}" step="1" value="${pose[j.key]}" ${!movable?'disabled':''}><span>°</span></div><input id="range-${j.key}" aria-label="${j.label} slider" type="range" min="${j.min}" max="${j.max}" step="1" value="${pose[j.key]}" ${!movable?'disabled':''}></div>`).join('')}</div><p id="joint-error" role="alert" hidden></p><button id="neutral-pose">Reset selected limb</button><p class="tab-note">${this.active.startsWith('leg')?'Model 4 has one hip axis; hip swing is unavailable. ':'Hand servo limits are provisional: wrist −90° to +90°, clamp 0° to 45°. 0° keeps the STEP reference; increasing clamp closes the driven jaw. Jaws may overlap near the maximum. These are not verified hardware limits. '}Axes inferred from actuator shafts. Preview limits only; poses are not collision-checked. 0° is the normal fixed reference pose. Reset returns this limb to 0°. Fixed mode holds your current pose.</p></section>`;
  this.host.querySelector('#arm-fixed')!.addEventListener('click',()=>this.load(this.pose,{...this.movable,[this.active]:false}));
  this.host.querySelector('#arm-movable')!.addEventListener('click',()=>this.load(this.pose,{...this.movable,[this.active]:true}));
  this.host.querySelector('#neutral-pose')!.addEventListener('click',()=>this.load({...this.pose,[this.active]:{...neutralPose}},this.movable));
  for(const button of Array.from(this.host.querySelectorAll<HTMLButtonElement>('[data-limb]')))button.addEventListener('click',()=>{if(!this.valid)return;this.active=button.dataset.limb as LimbKey;this.render();});
  for(const j of joints){
   this.host.querySelector<HTMLInputElement>(`#joint-${j.key}`)!.addEventListener('input',()=>this.apply(j.key,false));
   this.host.querySelector<HTMLInputElement>(`#range-${j.key}`)!.addEventListener('input',()=>this.apply(j.key,true));
  }
 }
 private apply(key:JointKey,slider:boolean){
  const joints=limbJoints(this.active);
  const number=this.host.querySelector<HTMLInputElement>(`#joint-${key}`)!;
  if(slider)number.value=this.host.querySelector<HTMLInputElement>(`#range-${key}`)!.value;
  const candidate={...this.pose[this.active]};for(const j of joints){const value=this.host.querySelector<HTMLInputElement>(`#joint-${j.key}`)!.value;candidate[j.key]=value===''?NaN:Number(value);}
  const errors=validateLimb(this.active,candidate);this.valid=errors.length===0;
  const error=this.host.querySelector<HTMLElement>('#joint-error')!;error.hidden=this.valid;error.textContent=errors.join(' ');
  for(const j of joints){const input=this.host.querySelector<HTMLInputElement>(`#joint-${j.key}`)!;input.setAttribute('aria-invalid',String(!Number.isFinite(candidate[j.key])||candidate[j.key]<j.min||candidate[j.key]>j.max));}
  if(this.valid){this.pose[this.active]=candidate;for(const j of joints)this.host.querySelector<HTMLInputElement>(`#range-${j.key}`)!.value=String(candidate[j.key]);}
  this.change(this.pose,this.movable,this.valid);
 }
}
