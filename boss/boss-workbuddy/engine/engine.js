// Collection and delivery are separate. Only an audited queue can send messages.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectMainTab,isDebugPortOpen} from './cdp.js';
import {collectSearchCards,waitForSearchCards,clickLoadMore,gotoSearch,searchByKeyword,searchByJobId,checkBlocked,inSearchCount} from './boss.js';
import {beginSend,finishSend,checkSendEligibility,stableIdentity,chinaDate,withExecutionLock,saveReservePool} from './safety.js';
const BOSS_DIR=fileURLToPath(new URL('../../boss-1/boss', import.meta.url));
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function extractJobId(url){try{return new URL(url).searchParams.get('encryptId')||'';}catch{return '';}}
const SKILL_DICT = {
  '3d': {search:'3D打印 工程模型 SLA FDM',core:['sla','lcd','fdm','sls','mjf','3d打印','切片','magics'],related:['solidworks','fusion360','模型','后处理','设备维护','cnc'],bonus:['宁波','工程样机']},
  electrical: {
    search: '嵌入式 STM32 单片机 硬件',
    core: ['stm32', 'esp32', '单片机', '嵌入式', '下位机', 'pcb', 'keil', 'adc', 'pwm', '串口', 'i2c', 'spi', 'can总线', '电机驱动', '电机控制', '无刷电机', '步进电机'],
    related: ['agv', '机器人', '电子', '硬件', '传感器', '驱动', '自动控制', '运动控制', 'ros', 'c语言', 'arm', 'fpga', '电气', 'plc', '联调', '调试'],
    bonus: ['robomaster', '飞思卡尔', '大学生方程式', '智能车', '竞赛', '电赛', '宁波'],
  },
  navigation: {
    search: 'SLAM 机器人 导航 算法',
    core: ['slam', 'ros', 'ros2', '激光雷达', '路径规划', '定位', '建图', 'imu', '深度相机', 'a*', 'dwa', 'teb', '传感器融合', '标定', '导航'],
    related: ['机器人', '算法', 'c++', 'python', '自动驾驶', '无人车', '感知', '轮速计', '里程计', '运动规划', '避障', 'moveit', 'gazebo'],
    bonus: ['jetson', 'orion', 'isaac', '深度学习', 'reinforcement', '强化学习', '宁波'],
  },
  structure: {
    search: '机械 结构 车辆 设计',
    core: ['底盘', '结构设计', '钣金', 'cnc', '焊接', '减振', '悬挂', 'solidworks', 'creo', 'catia', 'cae', '有限元', 'adams', 'ansys', '力学', '三维建模', '干涉检查'],
    related: ['机械', '车辆', '汽车', '模具', '加工', '装配', '3d打印', 'fusion', 'ug', 'nx', '转向', '散热', '强度', '刚度'],
    bonus: ['英语六级', '六级', 'dfm', '轻量化', '拓扑优化', '宁波'],
  },
  backend: {
    search: 'Python 后端 机器学习 服务',
    core: ['django', 'flask', 'fastapi', '后端', 'api', '数据库', 'mysql', 'postgresql', 'redis', 'mongodb', '接口', '服务端', '机器学习', '深度学习', '模型服务', '参数推荐'],
    related: ['python', 'docker', 'k8s', 'kubernetes', 'node', 'express', 'koa', 'java', 'go', '认证', '授权', '压测', '自动化测试', '微服务'],
    bonus: ['3d几何', 'gltf', 'cad', '云部署', '宁波'],
  },
};

// 匹配打分：按技能词库分层匹配
function scoreCandidate(role, cand) {
  const dict = SKILL_DICT[role.id];
  const haystack = [
    cand.desc || '',
    (cand.tags || []).join(' '),
    cand.expect || '',
    cand.education || '',
    cand.city || '',
    cand.school || '',
  ].join(' ').toLowerCase();

  let score = 0;
  const matched = [];
  const tierHit = { core: 0, related: 0, bonus: 0 };

  if (dict) {
    const hit = (kw) => {
      const k = kw.toLowerCase();
      return k.length >= 2 && haystack.includes(k);
    };
    // 核心技能：权重最高
    for (const kw of dict.core) if (hit(kw)) { score += 4; matched.push(kw); tierHit.core++; }
    // 相关技能：中等权重
    for (const kw of dict.related) if (hit(kw)) { score += 2; matched.push(kw); tierHit.related++; }
    // 加分项：权重低（竞赛、六级、宁波等）
    for (const kw of dict.bonus) if (hit(kw)) { score += 1; matched.push(kw); tierHit.bonus++; }
  } else {
    // 兜底：无字典时用 requirements 提取关键词
    const keywords = extractKeywords((role.requirements || '') + ' ' + (role.knowledge || ''));
    for (const kw of keywords) if (haystack.includes(kw.toLowerCase())) { score++; matched.push(kw); }
  }

  return { score, matched, tierHit };
}

// 通用停用词（不是技能，不应参与匹配）
const STOP_WORDS = new Set([
  '工程师', '相关', '业务', '方向', '开发', '能力', '优先', '要求', '具有', '经验', '负责', '以上',
  '我们', '需要', '工作', '岗位', '职位', '宁波', '专业', '进行', '以及', '熟悉', '掌握', '了解',
  '应届', '本科', '大专', '在校', '应届生', '问题', '项目', '实践', '学习', '参与', '具备', '熟练',
  '使用', '完成', '基础', '能力', '背景', '学校', '学历', '毕业', '时间', '薪资', '面议', '加分',
  '经历', '优势', '关注', '最近', '意向', '城市', '到岗', '在职', '离职', '随时', '以上', '同等',
  '优先考虑', '欢迎', '实习', '同学', '交流', '和', '的', '了', '在', '是', '有', '等', '与', '或',
]);

function extractKeywords(text) {
  const kw = [];
  // 英文技能词（保留有意义的缩写和术语）
  const enWords = text.match(/[A-Za-z][A-Za-z0-9+/#.*-]{1,}/g) || [];
  const enStop = /^(and|the|for|with|or|in|on|to|of|a|an|is|are|at|by|from)$/i;
  for (const w of enWords) if (w.length >= 2 && !enStop.test(w)) kw.push(w);
  // 中文技能词（过滤停用词）
  const cnWords = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  for (const w of cnWords) if (!STOP_WORDS.has(w)) kw.push(w);
  return [...new Set(kw)].slice(0, 80);
}

// 筛选达标线：命中核心技能 ≥1 才达标（严格门槛，不向弱匹配放宽）
// 用户 2026-09-29 确认：推荐页打招呼质量门槛 = 命中核心技能才打，避免浪费免费额度
function pickQualified(scored) {
  const qualified = scored.filter(c => (c.tierHit?.core || 0) >= 1);
  return { qualified, relaxed: false };
}


// An adapter must observe the correct role, identity and exact chat message. A generic
// success popup cannot implement verifySentMessage. The legacy collector has no such adapter.
export async function runPreparedQueue({dataDir=BOSS_DIR,browser,roleIds=null,now=()=>new Date().toISOString()}={}){
 const summary={totalCollected:0,totalSent:0,totalSkipped:0,totalUnknown:0};
 if(!browser || ['selectRole','prepareCandidate','sendApprovedGreeting','verifySentMessage'].some(k=>typeof browser[k]!=='function'))return {ok:false,error:'DELIVERY_ADAPTER_UNAVAILABLE：缺少已验证的浏览器及精确聊天核验连接；未点击发送',summary};
 return withExecutionLock(dataDir,async()=>{
  const results=[];const config=read(dataDir,'recruitment-config.json');
  const active=config.roles.filter(r=>r.active!==false&&(!roleIds||roleIds.includes(r.id)));
  if(!active.length || roleIds?.some(id=>!active.some(r=>r.id===id)))return {ok:false,error:'ROLE_NOT_CONFIGURED',summary};
  for(const role of active){
   const data=read(dataDir,'recruitment-data.json');const date=chinaDate(now());
   const selection=(data.comparisons||[]).filter(c=>c.roleId===role.id&&c.date===date).at(-1);
   if(!selection){results.push({roleId:role.id,status:'待比较100人并核查完整简历'});continue;}
   let selected=false;
   for(const recordId of new Set(selection.selectedRecordIds||[])){
    const latest=read(dataDir,'recruitment-data.json');const record=latest.reviews.find(r=>r.id===recordId);const candidateId=stableIdentity(record);
    try{checkSendEligibility(latest,read(dataDir,'recruitment-config.json'),{roleId:role.id,recordId,candidateId,now:now()});}
    catch(e){summary.totalSkipped++;results.push({roleId:role.id,recordId,status:'blocked',reason:e.message});continue;}
    if(!selected){const sw=await browser.selectRole(role);if(!sw?.ok)return {ok:false,error:'ROLE_NOT_READY',summary,results};selected=true;}
    const context=await browser.prepareCandidate({roleId:role.id,candidateId,recordId});
    if(context?.roleId!==role.id||context?.candidateId!==candidateId)return {ok:false,error:'ROLE_OR_IDENTITY_CHANGED',summary,results};
    // Fresh data check and durable pending record immediately before the side effect.
    let attempt;
    try{attempt=beginSend(dataDir,{roleId:role.id,recordId,candidateId,now:now()});}
    catch(e){summary.totalSkipped++;results.push({roleId:role.id,recordId,status:'blocked',reason:e.message});continue;}
    let proof=null,error=null;
    try{await browser.sendApprovedGreeting(attempt);proof=await browser.verifySentMessage(attempt);}catch(e){error=e.message;}
    const result=finishSend(dataDir,attempt.id,proof,now());
    if(result.status!=='sent'){summary.totalUnknown++;return {ok:false,error:error||'SEND_UNCONFIRMED：已记录待核验，停止继续发送',summary,results};}
    summary.totalSent++;results.push({roleId:role.id,recordId,status:'sent'});
   }
  }
  const fresh=read(dataDir,'recruitment-data.json');const date=chinaDate(now());
  const targets=config.roles.filter(r=>r.active!==false&&(!roleIds||roleIds.includes(r.id)));
  const complete=targets.every(role=>new Set(fresh.reviews.filter(r=>r.roleId===role.id&&r.status==='已发送'&&r.deliveryProof?.type==='chat_message'&&chinaDate(r.sentAt)===date).map(stableIdentity).filter(Boolean)).size>=Math.min(20,Number(role.contactTarget)||20));
  return {ok:complete,status:complete?'completed':'incomplete',summary,results};
 });
}

// Read-only legacy collection: no automatic browser launch, no profile copying,
// no greeting clicks, and no overwriting the shared recruitment history.
export async function run({roleIds=null,dryRun=false,maxReviewPerRole=100,contactPerRole=20,sendGreeting=true,paidGreet=false,dataDir=BOSS_DIR,browser}={}){
 if(paidGreet)return {ok:false,error:'付费发送未获授权，本入口不支持',summary:{totalCollected:0,totalSent:0,totalSkipped:0}};
 if(sendGreeting&&!dryRun)return runPreparedQueue({dataDir,browser,roleIds});
 return withExecutionLock(dataDir,async()=>{
  if(!(await isDebugPortOpen()))return {ok:false,error:'BROWSER_CONNECTION_UNAVAILABLE：没有已连接的专用浏览器；不会另开窗口或复制登录配置'};
  const {session}=await connectMainTab();
  try{
   const blocked=await checkBlocked(session);if(blocked.blocked)return {ok:false,error:blocked.reason};
   const config=read(dataDir,'recruitment-config.json');const roles=config.roles.filter(r=>r.active!==false&&(!roleIds||roleIds.includes(r.id)));
   const pool=[];let totalCollected=0;
   await gotoSearch(session);
   for(const role of roles){
    const cards=[],seen=new Set();const target=Math.max(100,Number(maxReviewPerRole)||100);
    const collect=async source=>{
     let stagnant=0;
     while(cards.length<target&&stagnant<3){
      const blocked=await checkBlocked(session);if(blocked.blocked)throw new Error(blocked.reason);
      let added=0;
      for(const c of await collectSearchCards(session))if(c.lid&&!seen.has(c.lid)&&cards.length<target){seen.add(c.lid);cards.push({...c,source});added++;}
      if(!added)stagnant++;else stagnant=0;
      if(cards.length>=target)break;
      const before=await inSearchCount(session);if(!(await clickLoadMore(session))?.ok)break;
      for(let i=0;i<8;i++){await sleep(400);if(await inSearchCount(session)>before)break;}
     }
    };
    const jobId=extractJobId(role.jobUrl);
    if(jobId){await searchByJobId(session,jobId);await waitForSearchCards(session);await collect('jobId');}
    if(cards.length<target){await searchByKeyword(session,SKILL_DICT[role.id]?.search||role.bossName);await waitForSearchCards(session);await collect('keyword');}
    const scored=cards.map(c=>({...c,...scoreCandidate(role,c)})).sort((a,b)=>b.score-a.score);
    pool.push({roleId:role.id,roleName:role.name,collectedAt:new Date().toISOString(),reviewLevel:'采集待阅读',total:cards.length,candidates:scored,topN:pickQualified(scored).qualified.slice(0,contactPerRole)});
    totalCollected+=cards.length;
    if(!dryRun)saveReservePool(dataDir,`search-pool-${chinaDate(new Date())}.json`,pool);
   }
   return {ok:true,status:'collected_only',summary:{totalCollected,totalSent:0,totalSkipped:0},results:pool};
  }finally{await session.close();}
 });
}
