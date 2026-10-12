// Shared durable send boundary. Browser observations must be supplied by a verified adapter.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export function chinaDate(value) {
 const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'';
}
export function stableIdentity(record) {
 const id=record?.candidateId || record?.geekId || record?.candidateKey?.split('|').at(-1);
 return typeof id==='string' && /^[A-Za-z0-9_~-]{12,}$/.test(id) && !/reconcile|unknown/i.test(id) ? id : null;
}
const fail=code=>{throw new Error(code);};
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
function atomicWrite(file,text){
 const temp=file+'.'+randomUUID()+'.tmp';let fd;
 try {fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,text);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);}
 finally {if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
export async function withExecutionLock(dir,fn){
 const lock=path.join(dir,'.recruitment-execution.lock');let fd;
 try {fd=fs.openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('EXECUTOR_BUSY：已有招聘执行器持有锁');throw e;}
 fs.writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
 try{return await fn();}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
function transaction(dir,fn){
 for(const name of ['.sync.lock','.heartbeat.lock'])if(fs.existsSync(path.join(dir,name)))fail('DATA_BUSY：其他执行方正在更新');
 const lock=path.join(dir,'.recruitment-data.lock');let fd;
 try{fd=fs.openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('DATA_BUSY');throw e;}
 try{
  const file=path.join(dir,'recruitment-data.json');const raw=fs.readFileSync(file,'utf8');const data=JSON.parse(raw);
  const result=fn(data,read(dir,'recruitment-config.json'));
  if(fs.readFileSync(file,'utf8')!==raw)fail('DATA_CHANGED：数据已被其他执行方修改');
  atomicWrite(file,JSON.stringify(data,null,2)+'\n');return result;
 }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
export function checkSendEligibility(data,config,{roleId,recordId,candidateId,now=new Date().toISOString()}){
 const today=chinaDate(now);if(!today)fail('INVALID_TIME');
 const role=config.roles.find(r=>r.id===roleId && r.active!==false);if(!role)fail('ROLE_INACTIVE');
 if(!role.requirementsVerified || chinaDate(role.requirementsVerifiedAt)!==today)fail('REQUIREMENTS_NOT_VERIFIED_TODAY');
 if(!role.greetingConfirmed || !role.greeting?.trim())fail('GREETING_NOT_CONFIRMED');
 const record=data.reviews.find(r=>r.id===recordId && r.roleId===roleId);
 if(!record || !candidateId || stableIdentity(record)!==candidateId || record.identityVerified!==true)fail('IDENTITY_UNVERIFIED');
 const same=data.reviews.filter(r=>stableIdentity(r)===candidateId);
 if(same.some(r=>r.doNotContact))fail('DO_NOT_CONTACT');
 if(same.some(r=>r.status==='已发送'||r.sentAt))fail('DUPLICATE_CONTACT');
 if(same.some(r=>['待发送','发送待核验','发送结果未知'].includes(r.status)))fail('PENDING_OR_UNCERTAIN');
 const attempts=data.sendAttempts||[];
 if(attempts.some(a=>a.candidateId===candidateId && ['pending','unknown'].includes(a.status)))fail('PENDING_OR_UNCERTAIN');
 for(const u of data.uncertainSends||[]){
  if(!u.retryBlocked)continue;
  if(stableIdentity(u)===candidateId)fail('UNCERTAIN_SEND');
  if(!stableIdentity(u) && u.name===record.name)fail('IDENTITY_UNRESOLVED：同名待核验，不合并为同一人');
 }
 if(record.reviewLevel!=='详细'||!Number.isFinite(Date.parse(record.detailedReviewedAt))||Date.parse(record.detailedReviewedAt)>Date.parse(now)||!record.evidence?.trim()||!record.fullResumeEvidence?.trim())fail('DETAIL_REVIEW_REQUIRED');
 const compared=(data.comparisons||[]).find(c=>c.roleId===roleId&&c.date===today&&chinaDate(c.comparedAt)===today&&new Date(c.comparedAt)<=new Date(now)&&c.requirements===role.requirements&&c.selectedRecordIds?.includes(recordId));
 if(!compared)fail('SAMPLE_COMPARISON_REQUIRED');
 const samples=data.reviews.filter(r=>compared.sampleRecordIds?.includes(r.id)&&r.roleId===roleId&&chinaDate(r.reviewedAt)===today);
 if(new Set(samples.map(stableIdentity).filter(Boolean)).size<Math.max(100,Number(role.reviewTarget)||100))fail('SAMPLE_INCOMPLETE');
 const used=new Set(data.reviews.filter(r=>r.roleId===roleId&&r.status==='已发送'&&chinaDate(r.sentAt)===today).map(r=>stableIdentity(r)||r.id));
 for(const a of attempts)if(a.roleId===roleId&&chinaDate(a.pendingAt)===today&&['pending','unknown'].includes(a.status))used.add(a.candidateId||a.id);
 for(const u of data.uncertainSends||[])if(u.retryBlocked&&u.roleId===roleId&&chinaDate(u.attemptedAt)===today)used.add(stableIdentity(u)||u.attemptId||u.id);
 const quota=Math.min(20,Number(role.contactTarget)||20);if(used.size>=quota)fail('DAILY_QUOTA_REACHED');
 return {role,record};
}
export function beginSend(dir,request){
 return transaction(dir,(data,config)=>{
  const now=request.now||new Date().toISOString();const {role,record}=checkSendEligibility(data,config,{...request,now});
  const attempt={id:randomUUID(),roleId:role.id,recordId:record.id,name:record.name,candidateId:request.candidateId,message:role.greeting,pendingAt:now,status:'pending'};
  (data.sendAttempts??=[]).push(attempt);record.pendingAt=now;record.status='待发送';data.updatedAt=now;return attempt;
 });
}
export function finishSend(dir,attemptId,proof,now=new Date().toISOString()){
 return transaction(dir,data=>{
  const attempt=data.sendAttempts?.find(a=>a.id===attemptId);if(!attempt)fail('ATTEMPT_NOT_FOUND');
  if(attempt.status==='sent')return attempt;
  const validUrl=(()=>{try{const u=new URL(proof?.sourceUrl);return u.protocol==='https:'&&u.hostname==='www.zhipin.com'&&u.pathname.startsWith('/web/chat/');}catch{return false;}})();
  const verified=proof?.type==='chat_message'&&proof.candidateId===attempt.candidateId&&proof.roleId===attempt.roleId&&proof.message===attempt.message&&validUrl&&Number.isFinite(Date.parse(proof.verifiedAt))&&Date.parse(proof.verifiedAt)>=Date.parse(attempt.pendingAt)&&Date.parse(proof.verifiedAt)<=Date.parse(now)&&Number.isFinite(Date.parse(proof.sentAt))&&Date.parse(proof.sentAt)>=Date.parse(attempt.pendingAt)&&Date.parse(proof.sentAt)<=Date.parse(proof.verifiedAt);
  const record=data.reviews.find(r=>r.id===attempt.recordId);if(!record)fail('REVIEW_RECORD_REMOVED');
  attempt.status=verified?'sent':'unknown';attempt.lastCheckedAt=now;
  if(verified){
   attempt.proof=proof;record.status='已发送';record.sentAt=proof.sentAt;record.message=attempt.message;record.verification='正确候选人聊天中的岗位、精确消息及时间均已核验';record.deliveryProof=proof;
   for(const u of data.uncertainSends||[])if(u.attemptId===attemptId){u.retryBlocked=false;u.resolvedAt=now;u.status='已核验';}
  }else{
   record.status='发送待核验';record.gaps=[record.gaps,'本次发送结果或对应岗位/消息待核查，禁止重试'].filter(Boolean).join('；');
   if(!(data.uncertainSends||[]).some(u=>u.attemptId===attemptId))(data.uncertainSends??=[]).push({id:attemptId,attemptId,name:attempt.name,roleId:attempt.roleId,candidateId:attempt.candidateId,message:attempt.message,attemptedAt:attempt.pendingAt,status:'待核验',retryBlocked:true,note:'发送已进入持久待核验流程；不可用通用弹窗或卡片变化替代正确聊天证据。'});
  }
  data.updatedAt=now;return attempt;
 });
}

export function saveReservePool(dir,filename,pool){atomicWrite(path.join(dir,filename),JSON.stringify(pool,null,2)+'\n');}
