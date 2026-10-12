import {walkingPose} from './walk';
import {limbKeys,type LimbPoses} from './limbs';
import type {JointKey} from './arms';
import {wavePose,WAVE_DURATION} from './wave';
import {gesturePose,gestureNames,gestureLabels,GESTURE_DURATION,type Gesture} from './gestures';
type AnimationMode='walk'|'wave'|Gesture;

export class WalkControls{
 private frame=0;private playing=false;private original?:LimbPoses;
 private elapsed=0;private blendTime=0;private last=0;private lastDraw=0;
 private mode:AnimationMode='walk';private speaking=false;private speechGeneration=0;
 constructor(private host:HTMLElement,private getPose:()=>LimbPoses|null,private apply:(pose:LimbPoses,preview:boolean)=>void,private greeting:(visible:boolean)=>void=()=>{}){
  host.innerHTML='<section class="walking-section"><h2>Walking preview</h2><div class="walking-actions"><button id="walk-play" aria-pressed="false">▶ Play walk</button><label for="walk-speed">Speed<select id="walk-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option></select></label></div><p id="walk-status" class="tab-note" role="status">Simple limb animation · base stays in place.</p></section>';
  host.querySelector('h2')!.textContent='Animation previews';
  host.querySelector('.walking-actions')!.insertAdjacentHTML('afterend','<div class="wave-actions"><button id="wave-play" aria-pressed="false">👋 Wave &amp; say hi</button><label><input id="greeting-voice" type="checkbox" checked> Voice greeting</label></div>');
  host.querySelector('#walk-play')!.addEventListener('click',()=>this.playing&&this.mode==='walk'?this.stop():this.start('walk'));
  host.querySelector('#wave-play')!.addEventListener('click',()=>this.playing&&this.mode==='wave'?this.stop():this.start('wave'));
  host.querySelector('.wave-actions')!.insertAdjacentHTML('afterend',`<div class="gesture-actions" role="group" aria-label="More animations">${gestureNames.map(name=>`<button id="${name}-play" aria-pressed="false">${gestureLabels[name]}</button>`).join('')}</div>`);
  for(const name of gestureNames)host.querySelector(`#${name}-play`)!.addEventListener('click',()=>this.playing&&this.mode===name?this.stop():this.start(name));
  host.querySelector('#greeting-voice')!.addEventListener('change',()=>{if(!host.querySelector<HTMLInputElement>('#greeting-voice')!.checked)this.cancelSpeech();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
 }
 private start(mode:AnimationMode){
  this.stop();
  const pose=this.getPose();if(!pose)return;
  this.mode=mode;
  this.original=structuredClone(pose);this.playing=true;this.elapsed=0;this.blendTime=0;this.last=performance.now();this.lastDraw=0;
  const button=this.host.querySelector(`#${mode}-play`)!;
  button.textContent=mode==='walk'?'■ Stop walk':mode==='wave'?'■ Stop greeting':`■ Stop ${gestureLabels[mode].toLowerCase()}`;button.setAttribute('aria-pressed','true');
  this.host.querySelector<HTMLSelectElement>('#walk-speed')!.disabled=mode==='wave';
  this.host.querySelector('#walk-status')!.textContent=mode==='walk'?'Walking in place. Stop restores your pose; editing stops the preview.':mode==='wave'?'Hi! I’m SophiRobot. · Waving with the right arm.':`${gestureLabels[mode]} · Plays once, then restores your pose.`;
  if(mode==='wave'){
   this.greeting(true);
   if(this.host.querySelector<HTMLInputElement>('#greeting-voice')!.checked){
    if('speechSynthesis' in window&&'SpeechSynthesisUtterance' in window){
     try{const speech=new SpeechSynthesisUtterance('Hi! I am SophiRobot.');speech.lang='en-US';speech.rate=.95;
      const generation=++this.speechGeneration;
      this.speaking=true;speech.onend=()=>{if(generation===this.speechGeneration)this.speaking=false;};
      speech.onerror=()=>{if(generation!==this.speechGeneration)return;this.speaking=false;if(this.playing&&this.mode==='wave')this.host.querySelector('#walk-status')!.textContent='Hi! I’m SophiRobot. · Voice unavailable; greeting shown on screen.';};
      window.speechSynthesis.speak(speech);
     }catch{this.speaking=false;this.host.querySelector('#walk-status')!.textContent='Voice unavailable · Hi! I’m SophiRobot.';}
    }else this.host.querySelector('#walk-status')!.textContent='Voice unavailable · Hi! I’m SophiRobot.';
   }
  }
  this.frame=requestAnimationFrame(this.tick);
 }
 private tick=(now:number)=>{
  if(!this.playing||!this.original)return;
  const dt=Math.min((now-this.last)/1000,.1);this.last=now;this.blendTime+=dt;
  this.elapsed+=dt*(this.mode==='wave'?1:Number(this.host.querySelector<HTMLSelectElement>('#walk-speed')!.value));
  if(this.mode==='wave'&&this.elapsed>=WAVE_DURATION){this.stop();return;}
  if(this.mode!=='wave'&&this.mode!=='walk'&&this.elapsed>=GESTURE_DURATION){this.stop();return;}
  if(now-this.lastDraw>=1000/30){
   const pose=this.mode==='wave'?wavePose(this.elapsed,this.original):this.mode==='walk'?walkingPose(this.elapsed,this.original):gesturePose(this.mode,this.elapsed,this.original),x=Math.min(1,this.blendTime/.5),blend=x*x*(3-2*x);
   if(this.mode==='walk')for(const limb of limbKeys)for(const joint of Object.keys(pose[limb]) as JointKey[])pose[limb][joint]=this.original[limb][joint]+(pose[limb][joint]-this.original[limb][joint])*blend;
   this.apply(pose,true);this.lastDraw=now;
  }
  this.frame=requestAnimationFrame(this.tick);
 };
 private cancelSpeech(){this.speechGeneration++;if(this.speaking&&'speechSynthesis' in window){this.speaking=false;window.speechSynthesis.cancel();}}
 stop(){
  if(!this.playing)return;
  this.playing=false;cancelAnimationFrame(this.frame);
  this.cancelSpeech();this.greeting(false);
  if(this.original)this.apply(this.original,false);
  this.host.querySelector('#walk-play')!.textContent='▶ Play walk';this.host.querySelector('#walk-play')!.setAttribute('aria-pressed','false');
  this.host.querySelector('#wave-play')!.textContent='👋 Wave & say hi';this.host.querySelector('#wave-play')!.setAttribute('aria-pressed','false');
  for(const name of gestureNames){const button=this.host.querySelector(`#${name}-play`)!;button.textContent=gestureLabels[name];button.setAttribute('aria-pressed','false');}
  this.host.querySelector<HTMLSelectElement>('#walk-speed')!.disabled=false;
  this.host.querySelector('#walk-status')!.textContent='Stopped · original pose restored.';
 }
}
