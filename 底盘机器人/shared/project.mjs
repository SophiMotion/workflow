import { randomId } from './ids.mjs';
import { validateConfig, validateRules, freezeIssues, validTmall, prdSections, defaultConfig, defaultRules } from './domain.mjs';
const clone = x=>structuredClone(x);
export const at=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);
export function put(obj,path,value){const keys=path.split('.');let o=obj;for(const k of keys.slice(0,-1)){o[k]??={};o=o[k];}o[keys.at(-1)]=value;}
function verifyPath(path){
  return Object.keys(defaultConfig).some(k=>path===`config.${k}`)||Object.keys(defaultRules).some(k=>path===`rules.${k}`)||/^prices\.[a-z0-9-]+$/.test(path)||['name','prd.owner','prd.targetDate','prd.requirements','prd.checklist'].includes(path)||prdSections.some(([id])=>path===`prd.sections.${id}`);
}
export function applyOperation(project, op) {
  if(!op||typeof op.actor!=='string'||op.actor.length>60||!op.actor.trim())throw Error('请填写编辑者姓名');
  const p=clone(project); const now=new Date().toISOString();
  if(op.type==='set'){
    if(!verifyPath(op.path)) throw Error('不允许的字段');
    if(p.prd.status==='已冻结')throw Error('项目基线已冻结，请先记录变更并重开草案');
    if(JSON.stringify(at(p,op.path))!==JSON.stringify(op.expected)) {const e=Error('同一字段已被其他成员更新。本次编辑已保留为冲突备份，请复核后重试。');e.status=409;throw e;}
    if(JSON.stringify(op.value)?.length>60000)throw Error('内容过长');
    put(p,op.path,op.value);
    validateConfig(p.config);validateRules(p.rules);
    if(typeof p.name!=='string'||!p.name.trim()||p.name.length>120)throw Error('项目名称无效');
    if(typeof p.prd.owner!=='string'||p.prd.owner.length>100)throw Error('DRI 无效');
    if(typeof p.prd.targetDate!=='string'||(p.prd.targetDate&&!/^\d{4}-\d{2}-\d{2}$/.test(p.prd.targetDate)))throw Error('日期无效');
    for(const [id] of prdSections)if(typeof p.prd.sections[id]!=='string'||p.prd.sections[id].length>20000)throw Error('章节内容无效');
    if(!Array.isArray(p.prd.checklist)||p.prd.checklist.length!==10||p.prd.checklist.some(v=>typeof v!=='boolean'))throw Error('确认清单无效');
    if(!Array.isArray(p.prd.requirements)||p.prd.requirements.length>100||p.prd.requirements.some(r=>!r||['id','text','metric','owner','due','evidence'].some(k=>typeof r[k]!=='string'||r[k].length>2000)))throw Error('需求字段无效');
    if(op.path.startsWith('prices.')&&op.value!==null){const v=op.value;if(!v||!validTmall(v.url)||typeof v.spec!=='string'||!v.spec.trim()||typeof v.shop!=='string'||!v.shop.trim()||!Number.isFinite(v.price)||v.price<0||v.price>10000000||!Number.isFinite(v.taxRate)||v.taxRate<0||v.taxRate>100||!Number.isFinite(Date.parse(v.checkedAt))||Date.parse(v.checkedAt)>Date.now()+86400000)throw Error('核价需要有效天猫商品链接、规格、店铺、金额、税率与日期');}
  } else if(op.type==='comment'){
    if(typeof op.text!=='string'||!op.text.trim()||op.text.length>4000)throw Error('评论需为 1–4000 字');
    if(!prdSections.some(([id])=>id===op.section))throw Error('章节无效');
    p.comments.push({id:randomId(),author:op.actor,text:op.text,section:op.section,resolved:false,at:now});
  } else if(op.type==='resolve'){
    const comment=p.comments.find(c=>c.id===op.id);if(!comment)throw Error('评论不存在');comment.resolved=!comment.resolved;
  } else if(['snapshot','freeze','reopen','review'].includes(op.type)){
    if(op.type==='freeze') {const issues=freezeIssues(p);if(issues.length)throw Error(issues.join('；'));if(p.prd.status!=='评审中')throw Error('请先进入评审中状态');p.prd.status='已冻结';}
    if(op.type==='review') {if(p.prd.status!=='草案')throw Error('仅草案可以发起评审');p.prd.status='评审中';}
    if(op.type==='reopen'){if(p.prd.status!=='已冻结')throw Error('当前没有冻结基线');if(!op.note?.trim())throw Error('请填写变更原因');p.prd.status='草案';p.prd.sections.changes+=`\nCR-${p.versions.length+1} | ${now.slice(0,10)} | ${op.actor} | ${op.note} | 待评审`;}
    if(op.type!=='review')p.versions.unshift({id:randomId(),name:`V${p.versions.length+1}.0`,actor:op.actor,at:now,note:op.note||({snapshot:'保存设计快照',freeze:'冻结项目基线',reopen:'发起变更'}[op.type]),snapshot:{config:clone(p.config),prices:clone(p.prices),rules:clone(p.rules),prd:clone(p.prd)}});
    p.versions=p.versions.slice(0,30);
  } else throw Error('未知操作');
  p.revision++;p.updatedAt=now;p.activity.unshift({actor:op.actor,at:now,type:op.type,path:op.path||'',revision:p.revision});p.activity=p.activity.slice(0,100);
  return p;
}
