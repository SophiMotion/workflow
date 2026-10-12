import { useEffect, useState } from 'react';
import { Box, FileCode2, FileText, Download, ArrowUpRight, CheckCircle2, CircleAlert, Braces, Archive } from 'lucide-react';
import { checks } from '../../shared/domain.mjs';
import { robotModel } from '../../shared/robot.mjs';
import { Button } from './Controls.jsx';
import { isStatic } from '../lib/environment.js';
import { exportUrdf,exportRos,exportFusion,exportFusionConfig,fusionStatus,exportProject,exportAll } from '../lib/exports.js';
export function ExportsView({project:p,notify}){
  const [busy,setBusy]=useState(''),[handoff,setHandoff]=useState(null);const bodies=robotModel(p.config),warnings=checks(p.config);
  const openFusion=async()=>{setBusy('fusion');setHandoff(null);try{const result=await exportFusion(p);setHandoff(result);notify(result.launch==='failed'?'配置已下载，请查看 Fusion 连接说明':'配置已下载，正在打开 Fusion 插件');}catch(e){notify(e.message);}finally{setBusy('');}};
  useEffect(()=>{if(!handoff?.id||handoff.state||handoff.launch==='failed')return;
    let active=true,timer;const deadline=Date.now()+45000;
    const check=async()=>{try{const s=await fusionStatus(handoff.id);if(!active)return;
      if(['opened','building','generated','saved','error','superseded'].includes(s.state)){setHandoff(h=>({...h,...s}));return;}
      if(Date.now()>deadline){setHandoff(h=>({...h,state:'waiting'}));return;}
    }catch(e){if(active){setHandoff(h=>({...h,state:'waiting',error:e.message}));return;}}
    if(active)timer=setTimeout(check,1500);};check();return()=>{active=false;clearTimeout(timer);};
  },[handoff?.id,handoff?.state,handoff?.launch]);
  const run=async(id,fn)=>{setBusy(id);try{await fn(p);notify('工程文件已生成，下载已开始');}catch(e){notify(e.message);}finally{setBusy('');}};
  return <section className="document-view"><header className="section-header"><div><h2>从设计工作台，走向真实工程。</h2><p>所有文件由当前配置生成 · revision {p.revision}</p></div><Button variant="dark" disabled={!!busy} onClick={()=>run('all',exportAll)}><Archive size={16}/>{busy==='all'?'正在打包…':'下载完整工程包'}</Button></header>
    <div className="export-grid">{[
      ['urdf',FileCode2,'ROS · URDF','可直接解析的机器人描述',`${bodies.length+1} 个 link，${bodies.filter(b=>b.joint!=='fixed').length} 个运动关节。包含惯量估算、碰撞体与传感器坐标系。`,'下载 .urdf',exportUrdf],
      ['ros',Box,'ROS 2 工程包','模型、启动文件与 RViz 配置','解压到工作空间 src，colcon build 后启动模型。用于模型展示，硬件驱动与控制器按实物对接。','下载 ROS 2 包',exportRos],
      ['fusion',Braces,'Fusion 360 · 参数建模',isStatic?'下载配置，在 Fusion 中导入':'下载配置，同时打开插件',isStatic?'下载当前结构、动力、电控与传感配置，在本机 Fusion 插件中导入并生成可编辑模型、保存 F3D。':'当前结构、动力、电控与传感选型保存为 JSON，并发送到本机 Fusion 插件。在插件内生成可编辑模型、保存 F3D。',isStatic?'下载 Fusion 配置':'下载配置并打开 Fusion',isStatic?exportFusionConfig:exportFusion],
      ['json',FileText,'项目数据 · JSON','配置、价格、文档与版本归档','完整保留参数、核价记录、报价规则、PRD、讨论与版本快照。共享链接中的访问凭据不会进入导出文件。','下载项目数据',exportProject],
    ].map(([id,Icon,title,sub,desc,cta,fn])=><article className="export-card" key={id}><div className="export-icon"><Icon size={30} strokeWidth={1.3}/></div><h3>{title}</h3><strong>{sub}</strong><p>{desc}</p><Button disabled={!!busy} onClick={()=>id==='fusion'&&!isStatic?openFusion():run(id,fn)}><Download size={15}/>{busy===id?'正在生成…':cta}</Button>{id==='fusion'&&!isStatic&&<button className="fusion-download-only" onClick={()=>{exportFusionConfig(p);notify('Fusion 配置文件已下载');}}>仅下载配置文件</button>}</article>)}</div>
    {handoff&&<div className="fusion-handoff" role="status"><strong>{['opened','building','generated','saved'].includes(handoff.state)?'Fusion 插件已接收配置':handoff.launch==='failed'?'配置已下载 · Fusion 未启动':handoff.state==='waiting'?'配置已下载 · 等待插件连接':handoff.state==='error'?'插件处理失败':handoff.state==='superseded'?'此配置已被新的导出替换':'配置已下载 · 正在打开 Fusion'}</strong><p>{handoff.message||handoff.error||'插件面板打开后，点击「生成新模型」。Fusion 冷启动可能需要一些时间。'}</p>{(!handoff.state||handoff.state==='waiting'||handoff.launch==='failed')&&<p>首次使用：Fusion → 实用工具 → 脚本和附加模块 → 附加模块 → ＋，选择 <code>SkateChassis20260906</code> 文件夹，运行并启用自动加载。也可在插件内导入已下载的 .fusion.json。</p>}</div>}
    <div className="export-bottom"><div className="panel engineering-checks"><h3>工程交付前的复核</h3><p><CheckCircle2 size={16}/>统一采用米、千克、弧度；X 向前、Y 向左、Z 向上。</p><p><CircleAlert size={16}/>模型为概念几何。惯量、关节限位、配合公差和重心须在实物与 CAD 中校核。</p><p><CircleAlert size={16}/>本机页面可自动唤起 Fusion；其他设备下载配置后，在各自 Fusion 插件中导入。</p>{warnings.map((w,i)=><p className={w.level} key={i}><CircleAlert size={16}/>{w.text}</p>)}</div><div className="panel tool-connections"><h3>继续使用 SophiStudio 工具</h3>{isStatic?<p>扩展工具需要本地 SophiStudio 环境；在线版可直接下载上方工程文件，在相应桌面工具中继续设计。</p>:<><a href="/studio/sophicar-formate/web/dist/index.html" target="_blank" rel="noreferrer"><span>SophiCAD Bridge<small>继续检查 Fusion 装配与转换工程格式</small></span><ArrowUpRight size={18}/></a><a href="/studio/stlquote/index.html" target="_blank" rel="noreferrer"><span>STL Quote<small>按实际几何分析制造工艺与加工报价</small></span><ArrowUpRight size={18}/></a><a href="/studio/prd/prd.html" target="_blank" rel="noreferrer"><span>PRD / SOW 驾驶舱<small>延续项目计划、商务与交付管理</small></span><ArrowUpRight size={18}/></a><a href="/studio/cfd/dist/index.html" target="_blank" rel="noreferrer"><span>CFD 仿真<small>进入工程仿真工具</small></span><ArrowUpRight size={18}/></a></>}</div></div>
  </section>;
}
