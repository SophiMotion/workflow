import { randomId } from '../../shared/ids.mjs';
import { useEffect, useRef, useState } from 'react';
import { createProject } from '../../shared/domain.mjs';
import { applyOperation, at, put } from '../../shared/project.mjs';
import { isStatic } from './environment.js';
const KEY='skatechassis-project-v1-'+(new URLSearchParams(location.search).get('project')||'default');
function cached(){try{return JSON.parse(localStorage.getItem(KEY))||createProject();}catch{return createProject();}}
export function useProject(){
  const [project,setProject]=useState(cached),[mode,setMode]=useState('connecting'),[notice,setNotice]=useState(''),[members,setMembers]=useState([]),[actor,setActorState]=useState(()=>localStorage.getItem('skate-actor')||'设计者');
  const pRef=useRef(project),cred=useRef(null),queue=useRef(Promise.resolve()),pending=useRef(0),actorRef=useRef(actor),client=useRef(randomId());
  const replace=p=>{pRef.current=p;setProject(p);localStorage.setItem(KEY,JSON.stringify(p));};
  const api=async(route,opts={})=>{const r=await fetch('/api/skate/'+route,{...opts,headers:{'Content-Type':'application/json',Authorization:cred.current?`Bearer ${cred.current.token}`:'',...opts.headers}});let b;try{b=await r.json();}catch{throw Error('协作服务未连接');}if(!r.ok)throw Error(b.error||'请求失败');return b;};
  useEffect(()=>{let live=true,timer; (async()=>{
    const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1)),shared=q.get('project')&&h.get('key');
    if(isStatic){setMode(shared?'blocked':'local');if(shared)setNotice('此链接需要项目协作服务，请在原项目服务器中打开。');return;}
    try{
      await api('health');
      let stored;try{stored=JSON.parse(localStorage.getItem('skate-credentials'));}catch{}
      cred.current=shared?{id:q.get('project'),token:h.get('key')}:stored;
      if(cred.current){const b=await api(`projects/${cred.current.id}`);if(live)replace(b.project);}
      else{const b=await api('projects',{method:'POST',body:'{}'});cred.current={id:b.id,token:b.token};if(live)replace(b.project);}
      if(!shared)localStorage.setItem('skate-credentials',JSON.stringify(cred.current));if(live)setMode('shared');
      timer=setInterval(async()=>{if(!live||pending.current)return;try{const b=await api(`projects/${cred.current.id}`);if(live&&!pending.current&&b.project.revision>pRef.current.revision)replace(b.project);const m=await api(`projects/${cred.current.id}/presence`,{method:'POST',body:JSON.stringify({client:client.current,name:actorRef.current})});if(live){setMembers(m.members);setMode('shared');}}catch{if(live)setMode('disconnected');}},2500);
    }catch(e){if(live){setMode(shared?'blocked':'local');if(shared)setNotice(e.message);}}
  })();return()=>{live=false;clearInterval(timer);};},[]);
  function operation(op){
    const item={...op,actor:actorRef.current};
    if(op.type==='set')item.expected=at(pRef.current,op.path);
    if(mode==='blocked'||mode==='connecting'||mode==='disconnected'){setNotice(mode==='disconnected'?'服务连接已断开，请等待恢复后再编辑。':'项目尚未就绪');return Promise.resolve(false);}
    try{applyOperation(pRef.current,item);}catch(e){setNotice(e.message);return Promise.resolve(false);}
    if(mode==='local'){replace(applyOperation(pRef.current,item));return Promise.resolve(true);}
    pending.current++;
    if(item.type==='set'){const local=structuredClone(pRef.current);put(local,item.path,item.value);replace(local);}
    const result=queue.current.then(async()=>{
      try{const b=await api(`projects/${cred.current.id}/ops`,{method:'POST',body:JSON.stringify(item)});pending.current--;if(!pending.current)replace(b.project);else pRef.current.revision=b.project.revision;return true;}
      catch(e){pending.current--;sessionStorage.setItem('skate-conflict-backup',JSON.stringify({op:item,at:new Date().toISOString()}));setNotice(e.message);try{const b=await api(`projects/${cred.current.id}`);if(!pending.current)replace(b.project);}catch{setMode('disconnected');}return false;}
    });queue.current=result;return result;
  }
  const set=(path,value)=>operation({type:'set',path,value});
  const shareUrl=()=>{if(!cred.current||mode!=='shared')return '';const u=new URL(location.href);u.search=`?project=${cred.current.id}`;u.hash=`key=${cred.current.token}`;return u.href;};
  const setActor=v=>{v=v.trim().slice(0,60)||'设计者';actorRef.current=v;setActorState(v);localStorage.setItem('skate-actor',v);};
  return {project,projectId:cred.current?.id||null,mode,members,actor,setActor,set,operation,notice,setNotice,shareUrl};
}
