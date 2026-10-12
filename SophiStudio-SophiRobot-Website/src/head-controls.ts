import {neutralHead,headJoints,validateHead,type HeadPose} from './head';
export class HeadControls{
 pose=neutralHead();movable=false;valid=true;
 constructor(private host:HTMLElement,private change:(pose:HeadPose,valid:boolean)=>void){this.render();}
 load(pose:HeadPose,movable:boolean){this.pose={...pose};this.movable=movable;this.valid=true;this.render();this.change(this.pose,true);}
 private render(){
  this.host.innerHTML=`<section class="joint-section"><h2>Head movement</h2><div class="arm-modes" role="group" aria-label="Head movement mode"><button data-head-mode="fixed" aria-pressed="${!this.movable}">Fixed</button><button data-head-mode="movable" aria-pressed="${this.movable}">Movable</button></div><p class="arm-mode-description">${this.movable?'Adjust rotation and tilt below.':'Head pose locked. Select Movable to adjust.'}</p><div class="joint-fields">${headJoints.map(j=>`<div class="joint-row"><label for="head-${j.key}">${j.label}<small>${j.min}° to +${j.max}°</small></label><div class="number-input"><input id="head-${j.key}" type="number" min="${j.min}" max="${j.max}" step="1" value="${this.pose[j.key]}" ${this.movable?'':'disabled'}><span>°</span></div><input id="head-range-${j.key}" type="range" aria-label="${j.label} slider" min="${j.min}" max="${j.max}" step="1" value="${this.pose[j.key]}" ${this.movable?'':'disabled'}></div>`).join('')}</div><p id="head-error" role="alert" hidden></p><button id="head-reset">Reset head</button><p class="tab-note">0° is the original pose. Positive tilt looks up; negative tilt looks down. Limits are provisional and not collision-checked.</p></section>`;
  this.host.querySelectorAll<HTMLButtonElement>('[data-head-mode]').forEach(b=>b.onclick=()=>this.load(this.pose,b.dataset.headMode==='movable'));
  this.host.querySelector<HTMLButtonElement>('#head-reset')!.onclick=()=>this.load(neutralHead(),this.movable);
  for(const j of headJoints){const input=this.host.querySelector<HTMLInputElement>('#head-'+j.key)!,slider=this.host.querySelector<HTMLInputElement>('#head-range-'+j.key)!;
   const apply=()=>{const next={...this.pose};for(const field of headJoints){const el=this.host.querySelector<HTMLInputElement>('#head-'+field.key)!;next[field.key]=el.value===''?NaN:Number(el.value);el.setAttribute('aria-invalid',String(!Number.isFinite(next[field.key])||next[field.key]<field.min||next[field.key]>field.max));}const errors=validateHead(next);this.valid=!errors.length;const error=this.host.querySelector<HTMLElement>('#head-error')!;error.hidden=this.valid;error.textContent=errors.join(' ');if(this.valid){this.pose=next;for(const field of headJoints)this.host.querySelector<HTMLInputElement>('#head-range-'+field.key)!.value=String(next[field.key]);}this.change(this.pose,this.valid);};
   input.oninput=apply;slider.oninput=()=>{input.value=slider.value;apply();};
  }
 }
}
