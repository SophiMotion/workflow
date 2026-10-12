import {defaultMotors,parseMotors,motorGroups,motorOptions,motorTypes,specFields,type Motors,type MotorSlot,type MotorOption} from './motors';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class MotorControls{
 state:Motors=defaultMotors();valid=true;private group:typeof motorGroups[number]='Shoulder';
 constructor(private change:()=>void){}
 load(value:Motors){this.state=parseMotors(value);this.valid=true;}
 render(host:HTMLElement,base=false){
  const group=base?'Base':this.group;
  host.innerHTML=`<section class="motor-panel"><h2>${base?'Base drive motors':'Motor specifications'}</h2>${base?'':`<div class="motor-groups" role="group" aria-label="Motor joint">${motorGroups.map(g=>`<button data-motor-group="${g}" aria-pressed="${g===this.group}">${g}</button>`).join('')}</div>`}<p class="tab-note">${group==='Shoulder'?'One motor choice per shoulder side, shared as a specification for its lift and swing shafts.':group==='Wrist'?'Wrist rotation motor only. The clamping servo is not changed.':'Choose each side independently.'}</p>${(['l','r'] as const).map(side=>{
   const slot=`${group.toLowerCase()}_${side}` as MotorSlot,item=this.state[slot],spec=item.options[item.selected];
   return `<section class="motor-card" data-slot="${slot}"><h3>${group} ${side.toUpperCase()}</h3><label for="motor-${slot}">Motor option</label><select id="motor-${slot}" data-motor-select>${motorOptions.map(id=>`<option value="${id}" ${id===item.selected?'selected':''}>${escape(item.options[id].name)}</option>`).join('')}</select><details><summary>Edit selected specification</summary><label>Model name<input data-spec="name" type="text" maxlength="100" required value="${escape(spec.name)}"></label><label>Motor type<select data-spec="type">${motorTypes.map(t=>`<option ${t===spec.type?'selected':''}>${t}</option>`).join('')}</select></label>${specFields.map(f=>`<label>${f.label} <span>${f.unit}</span><input data-spec="${f.key}" type="number" min="0" max="1000000000" step="any" placeholder="Not specified" value="${spec[f.key]??''}"></label>`).join('')}</details></section>`;
  }).join('')}<p class="motor-error" role="alert" hidden></p><p class="tab-note">Edits belong to this side and option. Save configuration includes every option and your selections.</p></section>`;
  const check=()=>{try{parseMotors(this.state);this.valid=true;}catch{this.valid=false;}const error=host.querySelector<HTMLElement>('.motor-error')!;error.hidden=this.valid;error.textContent='Enter a model name and valid specifications. Unknown numeric values can be left blank; gear ratio must be greater than zero.';this.change();};
  host.querySelectorAll<HTMLButtonElement>('[data-motor-group]').forEach(b=>b.onclick=()=>{if(!this.valid)return;this.group=b.dataset.motorGroup as typeof this.group;this.render(host,base);});
  host.querySelectorAll<HTMLElement>('[data-slot]').forEach(card=>{
   const slot=card.dataset.slot as MotorSlot,select=card.querySelector<HTMLSelectElement>('[data-motor-select]')!;
   select.onchange=()=>{if(!this.valid){select.value=this.state[slot].selected;return;}this.state[slot].selected=select.value as MotorOption;this.render(host,base);this.change();};
   card.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-spec]').forEach(input=>input.addEventListener('input',()=>{
    const spec=this.state[slot].options[this.state[slot].selected],key=input.dataset.spec!;
    if(key==='name'){spec.name=input.value;select.selectedOptions[0].textContent=input.value||'Unnamed motor';}else if(key==='type')spec.type=input.value as typeof spec.type;else{const k=key as typeof specFields[number]['key'];spec[k]=(input as HTMLInputElement).validity.badInput?NaN:input.value===''?null:Number(input.value);}
    input.setAttribute('aria-invalid',String(!input.checkValidity()));check();
   }));
  });
 }
}
