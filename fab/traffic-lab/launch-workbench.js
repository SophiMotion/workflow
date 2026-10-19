(function(){
 const message=text=>{const el=document.getElementById('loading');if(el){el.hidden=false;el.textContent=text;}};
 const script=src=>new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(Error('无法读取 '+src));document.head.append(el);});
 async function start(){
  if(location.protocol==='file:'){
   document.querySelector('.private').textContent='本地直开 · 无需启动服务';
   message('正在从本机载入校园与车辆…');
   await script('assets/offline/manifest.js');
   await script('../fab/traffic-lab/workbench.bundle.js?v=20261020-1');
  }else await script('../fab/traffic-lab/workbench.bundle.js?v=20261020-1');
 }
 start().catch(error=>{message('预览未能启动：'+error.message+'。请保留完整项目文件夹。');console.error('Preview startup:',error);});
 setTimeout(()=>{if(!window.workbenchReady)message('仍在载入三维资源。请确认 assets 文件夹完整，并检查浏览器的图形加速设置。');},60000);
})();
