// Observed UI evidence, independent of any browser provider.
export function classifyBossState(info={}) {
 let isBoss=false;
 try{const url=new URL(info.url);isBoss=url.protocol==='https:'&&url.hostname==='www.zhipin.com';}catch{}
 if(!isBoss)return {state:'unknown',loggedIn:null,reason:'尚未读到 BOSS 页面'};
 const text=String(info.text||'');
 if(/安全验证|请完成验证|验证码验证/.test(text))return {state:'verification_required',loggedIn:null,reason:'BOSS 要求用户手动完成安全验证'};
 if(/当前登录状态已失效|登录已过期|扫码登录|短信登录|密码登录/.test(text)||info.hasLoginForm)return {state:'login_required',loggedIn:false,reason:'此浏览器会话需要登录'};
 if(info.hasEmployerNav && (info.candidateCount>0||info.conversationCount>0))return {state:'ready',loggedIn:true,reason:'已读到招聘内容；发送前仍须核验岗位、候选人和话术'};
 return {state:'unknown',loggedIn:null,reason:'页面尚未提供可确认的招聘内容'};
}
export async function inspectBossSession(session) {
 const info=await session.eval(`(() => {
  const frames=Array.from(document.querySelectorAll('iframe')).map(f=>{try{return f.contentDocument;}catch{return null;}}).filter(Boolean);
  const docs=[document,...frames];
  return {url:location.href,title:document.title,text:docs.map(d=>d.body?.innerText||'').join('\\n'),
   hasEmployerNav:!!document.querySelector('a[href="/web/chat/job/list"]'),
   hasLoginForm:docs.some(d=>!!d.querySelector('input[type="password"]')),
   candidateCount:docs.reduce((n,d)=>n+d.querySelectorAll('li.card-item').length,0),conversationCount:0};
 })()`);
 return {...classifyBossState(info),url:info.url,title:info.title};
}
