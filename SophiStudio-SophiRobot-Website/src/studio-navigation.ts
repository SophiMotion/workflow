import './studio-navigation.css';

const appBase=new URL(import.meta.env.BASE_URL,location.href);
const localService=['localhost','127.0.0.1','[::1]'].includes(appBase.hostname) && appBase.port==='4189';
const workflowUrl=localService
 ? 'http://127.0.0.1:4173/studio/index.html#/workflow'
 : new URL('../../index.html#/workflow',appBase).href;

export function studioBrand(){
 return `<a class="brand studio-brand" href="${workflowUrl}" data-open-workflow aria-label="SophiStudio · 返回工作流" title="返回 SophiStudio 工作流"><img src="${import.meta.env.BASE_URL}sophistudio-logo.png" alt="SophiStudio" width="140" height="48"></a>`;
}

export function workflowButton(){
 return '<button type="button" class="workflow-return" data-open-workflow><span aria-hidden="true">←</span> 返回工作流</button>';
}

export function skatechassisLink(){
 const href=localService
  ? 'http://127.0.0.1:4173/'
  : new URL('../../底盘机器人/dist/index.html',appBase).href;
 return `<a class="skatechassis-link" href="${href}" aria-label="打开 SkateChassis 机器人工作台">SkateChassis 机器人工作台 <span aria-hidden="true">→</span></a>`;
}

export function bindWorkflowNavigation(){
 document.querySelectorAll<HTMLElement>('[data-open-workflow]').forEach(control=>{
  control.addEventListener('click',event=>{
   event.preventDefault();
   location.href=workflowUrl;
  });
 });
}
