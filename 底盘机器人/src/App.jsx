import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Download, History, Layers3, Save, Share2, X, Copy, Link, Cpu, FileBox } from 'lucide-react';
import { useProject } from './lib/useProject.js';
import { isStatic, workspaceUrl } from './lib/environment.js';
import { Configurator } from './components/Configurator.jsx';
import { RobotScene } from './components/RobotScene.jsx';
import { Summary } from './components/Summary.jsx';
import { BomView } from './components/BomView.jsx';
import { QuoteView } from './components/QuoteView.jsx';
import { PrdView } from './components/PrdView.jsx';
import { ExportsView } from './components/ExportsView.jsx';
import { Button, Modal } from './components/Controls.jsx';
import { exportAll, download } from './lib/exports.js';
import { deleteArmorDraft } from './lib/armor-storage.js';
const ArmorWorkbench=lazy(()=>import('./components/ArmorWorkbench.jsx'));
const tabs=[['design','参数设计'],['armor','外观装配'],['bom','BOM 清单'],['quote','报价方案'],['prd','协作 PRD'],['exports','工程导出']];
export default function App(){
  const state=useProject(),{project:p,mode,members,actor,setActor,set,operation,notice,setNotice,shareUrl}=state;
  const [tab,setTab]=useState('design'),[group,setGroup]=useState('structure'),[modal,setModal]=useState(''),[toast,setToast]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);
  useEffect(()=>{
    // Clear legacy geometry without loading it into memory. / 直接清除旧草稿，不解码模型。
    deleteArmorDraft(state.projectId||'local').catch(()=>notify('旧外壳缓存未能清除；本次不会自动加载或保存外壳缓存。'));
  },[state.projectId]);
  useEffect(()=>{
    if(tab!=='armor')return;
    const leave=()=>setTab('design'),hidden=()=>{if(document.visibilityState==='hidden')leave();};
    window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',hidden);};
  },[tab]);
  const content=useRef(),toastTimer=useRef();
  const notify=msg=>{setToast(msg);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),5500);};
  useEffect(()=>{if(notice){notify(notice);setNotice('');}},[notice]);
  useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const ctx=gsap.context(()=>gsap.fromTo(content.current,{opacity:.45,y:9},{opacity:1,y:0,duration:.4,ease:'power2.out'}));return()=>ctx.revert();},[tab]);
  useEffect(()=>()=>clearTimeout(toastTimer.current),[]);
  const onGroup=id=>{setGroup(id);setTab('design');};
  const save=async()=>{if(await operation({type:'snapshot'}))notify('当前配置和文档已保存为版本快照');};
  const bundle=async()=>{setBusy(true);try{await exportAll(p);notify('完整工程包已生成');}catch(e){notify(e.message);}finally{setBusy(false);}};
  const shared=mode==='shared';
  return <><header className="app-header"><a className="brand" href={workspaceUrl} aria-label="SophiStudio 工作流"><img className="studio-logo" src="./assets/sophistudio-logo.png" alt="SophiStudio"/></a><nav aria-label="SophiStudio 导航"><button className="active" onClick={()=>setTab('design')}>工作空间</button><button onClick={()=>setTab('exports')}>工程资产</button><button onClick={()=>setModal('tools')}>工具箱<ChevronDown size={13}/></button></nav><div className="header-right"><span className={`connection ${shared?'online':''}`}><span className="live-dot"/>{({connecting:'连接项目',shared:'共享项目',local:'本地项目',disconnected:'连接中断',blocked:'无法访问'})[mode]}</span><button className="avatar user-avatar" onClick={()=>setModal('profile')} aria-label="编辑协作身份">{actor.slice(0,1)}</button></div></header>
    <main><section className="project-heading"><div><a className="breadcrumb" href={workspaceUrl}><ArrowLeft size={14}/>返回 <span>/</span> 工作空间 <span>/</span> 机器人设计</a><div className="project-title"><h1>{p.name}</h1><span className="project-status">{p.prd.status}</span></div><p>从一个参数，到一台机器人。</p></div><div className="project-actions"><Button className="share-button" onClick={()=>setModal('share')}><Share2 size={15}/>协作</Button><Button onClick={save}><Save size={15}/>保存版本</Button><Button variant="dark" onClick={()=>setTab('exports')}><Download size={16}/>导出工程<ArrowUpRight size={14}/></Button></div></section>
    <div className="tabbar"><nav aria-label="工程模块">{tabs.map(([id,title])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}>{title}{id==='bom'&&<span>{Object.keys(p.prices).filter(k=>p.prices[k]).length||'自动'}</span>}</button>)}</nav><button className="version-button" onClick={()=>setModal('versions')}><History size={14}/>版本记录<span>{p.versions.length}</span></button></div>
    {mode==='blocked'&&<div className="access-error">无法访问此共享项目，请使用包含访问密钥的完整链接。</div>}
    <div ref={content} className={`content ${tab==='design'?'design-content':''}`}>
      {tab==='design'&&<div className="workbench"><Configurator config={p.config} set={set} group={group} setGroup={setGroup} disabled={p.prd.status==='已冻结'||mode==='blocked'}/><RobotScene config={p.config} onArmor={()=>setTab('armor')}/><Summary project={p} onTab={setTab} onGroup={onGroup}/></div>}
      {tab==='armor'&&mode!=='connecting'&&mode!=='blocked'&&<Suspense fallback={<div className="loading">正在打开外观装配…</div>}><ArmorWorkbench key={state.projectId||'local'} config={p.config} disabled={p.prd.status==='已冻结'||mode==='disconnected'} notify={notify}/></Suspense>}
      {tab==='bom'&&<BomView project={p} set={set} notify={notify}/>}
      {tab==='quote'&&<QuoteView project={p} set={set}/>}
      {tab==='prd'&&<PrdView project={p} set={set} operation={operation} actor={actor} mode={mode} notify={notify}/>}
      {tab==='exports'&&<ExportsView project={p} notify={notify}/>}
    </div></main>
    <footer className="statusbar"><span><span className="live-dot"/>参数驱动<span className="footer-separator">·</span>模型与文档联动</span><div>{shared&&<span>{members.length||1} 位编辑者在线</span>}<span>{mode==='local'?'保存在此浏览器':shared?'已连接项目服务':'项目服务未连接'}</span><span>rev. {p.revision}</span><button onClick={()=>setModal('about')}>设计说明<ArrowUpRight size={12}/></button></div></footer>
    {toast&&<div className="toast" role="status"><Check size={17}/><span>{toast}</span><button onClick={()=>setToast('')} aria-label="关闭提示"><X size={15}/></button></div>}
    {modal==='profile'&&<Modal title="协作身份" onClose={()=>setModal('')}><form className="form" onSubmit={e=>{e.preventDefault();setActor(new FormData(e.currentTarget).get('name'));setModal('');notify('编辑署名已更新');}}><p className="form-intro">用于评论与版本记录的显示名称；这是项目内署名，不是身份认证。</p><label>你的姓名<input name="name" defaultValue={actor} maxLength={60} required autoFocus/></label><Button variant="dark">保存署名</Button></form></Modal>}
    {modal==='share'&&<Modal title="一起把设计推进一步。" onClose={()=>setModal('')}><div className="form"><div className="share-illustration"><Layers3 size={38} strokeWidth={1}/><span>同一个项目，同一份工程基线。</span></div><p>持有完整链接的成员可以编辑此项目、讨论章节并保存版本。团队设备需能访问运行中的项目服务器。</p>{shared?<><label>项目协作链接<input aria-label="项目协作链接" readOnly value={shareUrl()} onFocus={e=>e.target.select()}/></label><Button variant="dark" onClick={async()=>{try{await navigator.clipboard.writeText(shareUrl());setCopied(true);}catch{notify('请选中上方链接后复制');}}}><Copy size={15}/>{copied?'已复制链接':'复制协作链接'}</Button><small>当前为 {location.hostname}；跨设备使用时通过服务器的局域网地址或已部署域名打开页面。</small></>:<div className="inline-note">当前为本地模式。运行项目服务后才可生成团队协作链接；本地编辑不会假装已同步给其他成员。</div>}</div></Modal>}
    {modal==='versions'&&<Modal title="设计版本" onClose={()=>setModal('')}><div className="form"><p>每个版本保留当时的配置、价格、报价规则与 PRD。</p>{p.versions.length===0?<div className="empty">还没有版本快照。点击「保存版本」记录当前设计。</div>:p.versions.map(v=><div className="version-item" key={v.id}><span><b>{v.name}</b><strong>{v.note}</strong><small>{v.actor} · {new Date(v.at).toLocaleString()}</small></span><button className="icon-button" title="下载此版本快照" onClick={()=>download(`SkateChassis-${v.name}.json`,JSON.stringify(v,null,2),'application/json')}><Download size={16}/></button></div>)}</div></Modal>}
    {modal==='tools'&&<Modal title="SophiStudio 工具箱" onClose={()=>setModal('')}><div className="tool-modal">{isStatic?<p>这些扩展工具需要本地 SophiStudio 环境。请在本机启动工作台后，从工具箱继续使用。</p>:[['SophiCAD Bridge','Fusion 装配与工程格式转换','sophicar-formate/web/dist/index.html'],['STL Quote','几何分析与加工报价','stlquote/index.html'],['PRD / SOW','项目驾驶舱与交付管理','prd/prd.html'],['CFD','气动与流场仿真','cfd/dist/index.html'],['SophiCar V2','底盘设计与实验','sophicarv2/index.html']].map(([name,desc,url])=><a key={name} href={'/studio/'+url} target="_blank" rel="noreferrer"><FileBox size={22}/><span><strong>{name}</strong><small>{desc}</small></span><ArrowUpRight size={18}/></a>)}</div></Modal>}
    {modal==='about'&&<Modal title="设计与数据说明" onClose={()=>setModal('')}><div className="form"><p>机器人外观来自你提供的 SkateChassis 效果图；页面模型是按参数生成的概念装配。</p><p>PRD 按用户提供 PDF 的 13 章组织。文档中的填写规则作为工作台功能参考，不代表工程指标已得到验证。</p><p>初始零件价格为估算。天猫核价需要真实商品链接、SKU、店铺、价格与日期。当前未连接自动商品价格服务。</p><p>Fusion 使用官方脚本 API 生成原生 F3D；需要在 Autodesk Fusion 中运行。模型含可编辑尺寸与特征历史，详细机械设计需继续完善。</p><Button onClick={bundle} disabled={busy}><Download size={15}/>{busy?'正在打包…':'下载当前工程包'}</Button></div></Modal>}
  </>;
}
