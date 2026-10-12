import './studio-navigation.css';

const workflowUrl='file:///Users/wubo/Documents/2026-2/sophistudio/index.html#/workflow';

export function studioBrand(){
 return `<a class="brand studio-brand" href="${workflowUrl}" data-open-workflow aria-label="SophiStudio · 返回工作流" title="返回 SophiStudio 工作流"><img src="${import.meta.env.BASE_URL}sophistudio-logo.png" alt="SophiStudio" width="140" height="48"></a>`;
}

export function workflowButton(){
 return '<button type="button" class="workflow-return" data-open-workflow><span aria-hidden="true">←</span> 返回工作流</button>';
}

export function bindWorkflowNavigation(){
 const feedback=document.createElement('div');
 feedback.className='workflow-feedback';feedback.hidden=true;
 feedback.innerHTML='<p role="status"></p><label hidden>工作流地址<input readonly aria-label="工作流地址"></label><button type="button" aria-label="关闭提示">×</button>';
 document.body.append(feedback);
 const message=feedback.querySelector('p')!;
 const fallback=feedback.querySelector('label')!;
 const address=feedback.querySelector('input')!;
 address.value=workflowUrl;
 address.addEventListener('focus',()=>address.select());
 feedback.querySelector('button')!.addEventListener('click',()=>feedback.hidden=true);
 const controls=document.querySelectorAll<HTMLElement>('[data-open-workflow]');
 let pending=false,timer:number|undefined;
 controls.forEach(control=>control.addEventListener('click',async event=>{
  event.preventDefault();
  if(pending)return;
  if(location.protocol==='file:'){location.href=workflowUrl;return;}
  pending=true;window.clearTimeout(timer);
  controls.forEach(item=>{item.setAttribute('aria-disabled','true');if(item instanceof HTMLButtonElement)item.disabled=true;});
  feedback.hidden=false;fallback.hidden=true;message.textContent='正在打开工作流…';
  try{
   const response=await fetch(`${import.meta.env.BASE_URL}api/open-workflow`,{method:'POST',headers:{'X-SophiStudio-Action':'open-workflow'},signal:AbortSignal.timeout(8000)});
   const result=await response.json();
   if(typeof result.url==='string')address.value=result.url;
   if(!response.ok||!result.ok)throw new Error('Unable to open workflow.');
   message.textContent='正在默认浏览器中打开工作流。';
   timer=window.setTimeout(()=>feedback.hidden=true,5000);
  }catch{
   message.textContent='暂时无法自动打开，请复制下方地址到浏览器。';fallback.hidden=false;
  }finally{
   pending=false;controls.forEach(item=>{item.removeAttribute('aria-disabled');if(item instanceof HTMLButtonElement)item.disabled=false;});
  }
 }));
}
