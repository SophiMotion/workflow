// The splitter lives outside the controller's rerendered tab content.
export function bindDockResize(workspace,splitter){
 const key='sophi-controller-width-v1',defaultWidth=360;
 let preferred=defaultWidth,drag=null;
 try{const saved=Number(localStorage.getItem(key));if(saved>=320&&saved<=600)preferred=saved;}catch{}
 const bounds=()=>({min:320,max:Math.max(320,Math.min(600,workspace.clientWidth-340))});
 const apply=()=>{
  const {min,max}=bounds(),width=Math.round(Math.max(min,Math.min(max,preferred)));
  workspace.style.setProperty('--controller-width',`${width}px`);
  splitter.setAttribute('aria-valuemin',min);splitter.setAttribute('aria-valuemax',max);
  splitter.setAttribute('aria-valuenow',width);splitter.setAttribute('aria-valuetext',`控制台宽度 ${width} 像素`);
 };
 const save=()=>{try{localStorage.setItem(key,String(preferred));}catch{}};
 const set=value=>{const {min,max}=bounds();preferred=Math.max(min,Math.min(max,value));apply();};
 const finish=(cancel=false)=>{
  if(!drag)return;
  const previous=drag;drag=null;
  if(cancel){preferred=previous.preferred;apply();}else save();
  if(splitter.hasPointerCapture(previous.id))splitter.releasePointerCapture(previous.id);
  document.body.classList.remove('resizing-controller');
 };
 splitter.addEventListener('pointerdown',event=>{
  if(event.button!==0||innerWidth<=640)return;
  event.preventDefault();splitter.focus();
  drag={id:event.pointerId,x:event.clientX,width:Number(splitter.getAttribute('aria-valuenow')),preferred};
  splitter.setPointerCapture(event.pointerId);document.body.classList.add('resizing-controller');
 });
 splitter.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)set(drag.width+drag.x-event.clientX);});
 splitter.addEventListener('pointerup',()=>finish());
 splitter.addEventListener('pointercancel',()=>finish(true));
 splitter.addEventListener('lostpointercapture',()=>finish(true));
 splitter.addEventListener('dblclick',()=>{set(defaultWidth);save();});
 splitter.addEventListener('keydown',event=>{
  const current=Number(splitter.getAttribute('aria-valuenow')),{min,max}=bounds();
  const next={ArrowLeft:current+16,ArrowRight:current-16,Home:min,End:max}[event.key];
  if(next===undefined)return;event.preventDefault();set(next);save();
 });
 window.addEventListener('resize',()=>{finish(true);apply();});
 window.addEventListener('blur',()=>finish(true));
 apply();return {apply,cancel:()=>finish(true)};
}
