import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {acquireLock} from './lock.mjs';
import { CATEGORIES, fingerprint } from './model.mjs';
const fresh=()=>({schemaVersion:1,version:0,reviews:{},assessments:{},assessmentHistory:{},jobs:[],exports:[]});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export class Store {
 constructor(root){this.root=root;this.dir=path.join(root,'boss/want');this.file=path.join(this.dir,'state.json');}
 async init(){await fs.mkdir(this.dir,{recursive:true,mode:0o700});await this.mutate(()=>{});}
 async readState(){try{return {...fresh(),...JSON.parse(await fs.readFile(this.file,'utf8'))};}catch(e){if(e.code==='ENOENT')return fresh();throw e;}}
 async snapshot(){const [config,data,state]=await Promise.all(['recruitment-config.json','recruitment-data.json'].map(n=>fs.readFile(path.join(this.root,'boss',n),'utf8').then(JSON.parse)).concat(this.readState()));return {config,data,state};}
 async mutate(fn){
  const release=await acquireLock(path.join(this.dir,'.state.lock'));
  try{const state=await this.readState();const result=await fn(state);state.version++;state.updatedAt=new Date().toISOString();const tmp=this.file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,JSON.stringify(state,null,2),{mode:0o600});await fs.rename(tmp,this.file);return result;}finally{await release();}
 }
 async addReview(id,{category,note,expectedVersion,expectedFingerprint}={}){
  if(!CATEGORIES.includes(category)||typeof note!=='string'||!note.trim()||note.length>10000)throw Error('请选择分类并填写 1–10000 字复核说明');
  const snap=await this.snapshot();const row=snap.data.reviews.find(r=>r.id===id);if(!row)throw Error('资料记录不存在');const fp=fingerprint(row,[...snap.config.roles,...(snap.config.archivedRoles||[])].find(role=>role.id===row.roleId));if(expectedFingerprint!==undefined&&expectedFingerprint!==fp)throw Error('资料已更新，请重新打开并阅读后再保存复核');
  return this.mutate(s=>{const list=s.reviews[id]||[];if(expectedVersion!==undefined&&expectedVersion!==list.length)throw Error('复核版本已更新，请刷新后再保存');const event={id:randomUUID(),at:new Date().toISOString(),category,note:note.trim(),source:'人工复核',fingerprint:fp};(s.reviews[id]??=[]).push(event);return event;});
 }
}
