import { createHash } from 'node:crypto';
export const CATEGORIES=['未评估','匹配证据充分','需要核实','当前岗位证据不足'];
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const day=v=>{if(!v||Number.isNaN(new Date(v).getTime()))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));};
export const verifiedSent=r=>r.status==='已发送'&&Boolean(r.sentAt&&r.verification&&r.message);
export function professional(r){return Object.fromEntries(['school','major','skills','projects','city','evidence','gaps','reviewLevel','english'].map(k=>[k,String(r[k]||'')]));}
export function fingerprint(r,role){return hash({v:1,data:professional(r),requirements:role?.requirements||'',knowledge:role?.knowledge||''});}
export function viewRecords({data,config,state}){
 const roles=[...config.roles,...(config.archivedRoles||[])];
 return data.reviews.map(r=>{const role=roles.find(x=>x.id===r.roleId),fp=fingerprint(r,role),assessment=state.assessments[r.id],history=state.reviews[r.id]||[],manual=history.at(-1),reviewStale=Boolean(manual&&manual.fingerprint!==fp),stale=Boolean(assessment&&assessment.fingerprint!==fp);
 const status=r.doNotContact?'停止联系':verifiedSent(r)?'已核验发送':r.status==='已发送'?'结果待核验':r.status==='待核验'?'结果待核验':r.reply?'有回复':r.status||'未发送';
 return {...r,roleName:role?.name||r.roleId,archived:!config.roles.some(x=>x.id===r.roleId),fingerprint:fp,category:manual?.category||(!stale&&assessment?.category)||'未评估',categorySource:manual?'人工复核':(!stale&&assessment?'Codex 评估':'待评估'),communicationStatus:status,reviewHistory:history,reviewCount:history.length,reviewStale,hasReply:Boolean(r.reply),lastReviewAt:manual?.at||'',assessment:assessment||null,assessmentStale:stale,assessmentHistory:state.assessmentHistory[r.id]||[]};});
}
export function filterRecords(rows,f={}){
 const q=String(f.q||'').trim().toLowerCase();return rows.filter(r=>
 (!f.role||r.roleId===f.role)&&(!f.category||r.category===f.category)&&(!f.status||(f.status==='有回复'?r.hasReply:f.status==='已核验发送'?verifiedSent(r):r.communicationStatus===f.status))&&(!f.level||(r.reviewLevel||'摘要')===f.level)&&(!f.date||day(r.reviewedAt)===f.date)&&(!f.revisited||(f.revisited==='stale'?r.reviewStale:f.revisited==='yes'?r.reviewCount>0:r.reviewCount===0))&&(!q||[r.name,r.school,r.major,r.skills,r.projects,r.evidence,r.gaps,r.message,r.roleName].join(' ').toLowerCase().includes(q)));
}
export function dashboard(s,scope='today',now=new Date()){
 const today=day(now),latest=s.data.runs?.at(-1),ids=new Set(latest?.continuationRunIds||[latest?.id]);
 return s.config.roles.map(role=>{const rows=s.data.reviews.filter(r=>r.roleId===role.id);const inScope=(r,field)=>scope==='all'||(scope==='run'?ids.has(r.runId):day(r[field])===today);const unique=rs=>new Set(rs.map(r=>r.platformCandidateId?'platform:'+r.platformCandidateId:r.id)).size;
 return {id:role.id,name:role.name,read:unique(rows.filter(r=>inScope(r,'reviewedAt'))),detail:unique(rows.filter(r=>r.reviewLevel==='详细'&&inScope(r,'detailedReviewedAt'))),sent:unique(rows.filter(r=>verifiedSent(r)&&inScope(r,'sentAt'))),detailUnknownTime:rows.filter(r=>r.reviewLevel==='详细'&&!r.detailedReviewedAt).length,reviewTarget:role.reviewTarget,contactTarget:role.contactTarget};});
}
