import { randomId } from '../../shared/ids.mjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box3, Matrix4, Vector3 } from 'three';
import { Upload, Download, Save, Undo2, Layers3, Box, Eye, EyeOff, Scissors, Link2, RotateCcw, Sparkles, Trash2, Check, ArrowRight, Info } from 'lucide-react';
import { robotModel } from '../../shared/robot.mjs';
import { download } from '../lib/exports.js';
import { countTriangles } from '../lib/armor-geometry.js';
import { editGeometry } from '../lib/armor-edit.js';
import { GLB_LIMIT, TRIANGLE_LIMIT, GLB_LIMIT_LABEL, TRIANGLE_LIMIT_LABEL, jointMatrices, partsBounds, partsFromScene, demoScene, partMatrix, withMatrix, detachPart, validatePartMetadata, partMetadata } from '../lib/armor-model.js';
import { loadArmorGlb, exportArmorGlb } from '../lib/armor-io.js';
import { createArmorSession, armorFrame, releaseArmorResources } from '../lib/armor-session.js';
import { ArmorViewport } from './ArmorViewport.jsx';
import '../armor.css';

const round=v=>Math.round(v*10)/10;
const axisNames=['X 前后','Y 左右','Z 上下'];
const label=id=>({mast:'立柱 · 胸背甲',shoulder_bar:'肩部横梁',support_bar:'腰部横梁',deck:'底盘顶板',base_link:'底盘主体',left_brace:'左支撑杆',right_brace:'右支撑杆'}[id]||id.replace('left_arm_','左臂 · 连杆 ').replace('right_arm_','右臂 · 连杆 '));
const materials=p=>Array.isArray(p.material)?p.material:[p.material];
function historyBytes(snapshots){const buffers=new Set();for(const list of snapshots)for(const p of list){for(const a of Object.values(p.geometry.attributes))buffers.add((a.isInterleavedBufferAttribute?a.data.array:a.array).buffer);if(p.geometry.index)buffers.add(p.geometry.index.array.buffer);}return [...buffers].reduce((sum,b)=>sum+b.byteLength,0);}
function BusyStatus({message}){const [seconds,setSeconds]=useState(0);useEffect(()=>{const started=Date.now(),timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[]);return <><div className="armor-spinner"/><b>{message}</b><span className="armor-wait-time" aria-hidden="true">已等待 {seconds} 秒</span><p className="armor-wait-help">完整精度处理，不会自动减面。大模型可能需要较长时间，请保持页面打开。</p></>;}
function NumberField({label,value,onChange,min=-10000,max=10000,step=1,unit='mm',disabled=false}){
  const [draft,setDraft]=useState(String(round(value)));useEffect(()=>setDraft(String(round(value))),[value]);
  function commit(){const n=Number(draft);if(draft.trim()&&Number.isFinite(n)){const v=Math.max(min,Math.min(max,n));if(v!==value)onChange(v);setDraft(String(round(v)));}else setDraft(String(round(value)));}
  return <label className="armor-number"><span>{label}</span><div><input aria-label={label} type="number" value={draft} min={min} max={max} step={step} disabled={disabled} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><small>{unit}</small></div></label>;
}
function Section({title,icon:Icon,children,open=true}){return <details className="armor-section" open={open}><summary>{Icon&&<Icon size={15}/>}<b>{title}</b></summary><div>{children}</div></details>;}
export default function ArmorWorkbench({config,disabled=false,notify}){
  const [session]=useState(createArmorSession);
  const [parts,setParts]=useState([]),[selected,setSelected]=useState(''),[filename,setFilename]=useState('');
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[savedAt,setSavedAt]=useState(''),[undoCount,setUndoCount]=useState(0);
  const [ghost,setGhost]=useState(false),[wire,setWire]=useState(false),[showFrame,setShowFrame]=useState(true),[angles,setAngles]=useState({}),[poseJoint,setPoseJoint]=useState('left_arm_1');
  const [cutEnabled,setCutEnabled]=useState(false),[cutAxis,setCutAxis]=useState('z'),[cutPercent,setCutPercent]=useState(50),[ratio,setRatio]=useState(70),[textureSize,setTextureSize]=useState(Infinity),[drag,setDrag]=useState(false);
  const input=useRef(),history=useRef(session.history),resources=useRef(session.resources),busyRef=useRef(false);
  const bodies=useMemo(()=>robotModel(config),[config]),rest=useMemo(()=>jointMatrices(bodies),[bodies]),matrices=useMemo(()=>jointMatrices(bodies,angles),[bodies,angles]);
  const chosen=parts.find(p=>p.id===selected),bounds=useMemo(()=>parts.length?partsBounds(parts,rest):new Box3(),[parts,rest]);
  const overall=parts.length?bounds.getSize(new Vector3()):new Vector3(),triangles=parts.reduce((n,p)=>n+countTriangles(p.geometry),0);
  const posed=Object.values(angles).some(v=>v!==0),locked=disabled||!!busy,editLocked=locked||posed;
  const selectedBase=chosen?withMatrix(chosen,partMatrix(chosen,rest)):null;
  const localBox=useMemo(()=>{if(!chosen)return null;if(!chosen.geometry.boundingBox)chosen.geometry.computeBoundingBox();return chosen.geometry.boundingBox.clone();},[chosen?.geometry]);
  const cutAt=localBox?localBox.min[cutAxis]+(localBox.max[cutAxis]-localBox.min[cutAxis])*cutPercent/100:0;
  const targets=bodies.filter(b=>!b.id.includes('wheel')&&!b.id.includes('motor')&&['mast','deck','shoulder_bar','support_bar','base_link','left_brace','right_brace'].includes(b.id)||b.id.includes('_arm_'));
  const joints=bodies.filter(b=>b.joint==='revolute');
  function track(next){return session.track(next);}
  function apply(next){session.signal.throwIfAborted();try{next.forEach(p=>validatePartMetadata(partMetadata(p)));}catch(e){setError(e.message);return;}history.current.push(parts);if(history.current.length>10)history.current.shift();while(history.current.length>1&&historyBytes([next,...history.current])>384*1024*1024)history.current.shift();setUndoCount(history.current.length);setParts(track(next));setDirty(true);setError('');}
  const progress=message=>{if(!session.signal.aborted)setBusy(message);};
  function updatePart(patch){if(!chosen)return;apply(parts.map(p=>p.id===selected?{...p,...patch}:p));}
  async function work(message,fn){if(busyRef.current||session.signal.aborted)return;busyRef.current=true;setBusy(message);setError('');try{await armorFrame(session.signal);await fn(session.signal);}catch(e){if(!session.signal.aborted)setError(e.message||'操作失败，请重试。');}finally{busyRef.current=false;if(!session.signal.aborted)setBusy('');}}
  function receive(next,name,original){setParts(track(next));setFilename(name);session.source=original;setSelected(next[0]?.id||'');history.current.length=0;setUndoCount(0);setAngles({});setDirty(true);setCutEnabled(false);setSavedAt('');}
  useEffect(()=>{
    const leave=()=>session.dispose(),hidden=()=>{if(document.visibilityState==='hidden')leave();};
    window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',hidden);session.dispose();};
  },[session]);
  useEffect(()=>{if(selected&&!parts.some(p=>p.id===selected))setSelected(parts[0]?.id||'');},[parts,selected]);
  useEffect(()=>{
    const retained={geometries:new Set(),materials:new Set()};
    for(const p of [parts,...history.current].flat()){retained.geometries.add(p.geometry);materials(p).forEach(m=>retained.materials.add(m));}
    releaseArmorResources(resources.current,retained);
  },[parts,undoCount]);
  async function importFile(file){
    if(!file||locked)return;
    if(!file.name.toLowerCase().endsWith('.glb')){setError('请选择混元导出的 .glb 文件。');return;}
    if(file.size>GLB_LIMIT){setError(`文件超过 ${GLB_LIMIT_LABEL}，请分成多个 GLB 导入。`);return;}
    if(dirty&&parts.length&&!window.confirm('导入新文件会替换尚未保存的外壳，继续吗？'))return;
    await work(`正在读取 ${(file.size/1024/1024).toFixed(1)} MB 文件…`,async signal=>{const buffer=await file.arrayBuffer(),next=await loadArmorGlb(buffer,config,{onProgress:progress,signal});receive(next,file.name,buffer);notify(`已导入 ${next.length} 个部件，保留 ${next.reduce((n,p)=>n+countTriangles(p.geometry),0).toLocaleString()} 个三角面和原始贴图。`);});
  }
  async function example(){await work('正在准备演示外壳…',async signal=>{const next=track(partsFromScene(demoScene(),config)),buffer=await exportArmorGlb(next,config,Infinity,true,{signal});receive(next,'演示外壳.glb',buffer);});}
  function adjustMatrix(part,matrix){const value=withMatrix(part,matrix);return {...value,bindRest:part.binding&&rest[part.binding]?rest[part.binding].toArray():null};}
  function bulk(matrix){apply(parts.map(p=>adjustMatrix(p,matrix.clone().multiply(partMatrix(p,rest)))));}
  function resizeAll(height){const center=bounds.getCenter(new Vector3());center.z=bounds.min.z;const s=height/1000/overall.z;bulk(new Matrix4().makeTranslation(...center.toArray()).multiply(new Matrix4().makeScale(s,s,s)).multiply(new Matrix4().makeTranslation(-center.x,-center.y,-center.z)));}
  function rotateAll(axis){const c=bounds.getCenter(new Vector3()),r=axis==='z'?new Matrix4().makeRotationZ(Math.PI/2):new Matrix4().makeRotationX(Math.PI/2);bulk(new Matrix4().makeTranslation(c.x,c.y,c.z).multiply(r).multiply(new Matrix4().makeTranslation(-c.x,-c.y,-c.z)));}
  function alterSelected(field,index,value){const base={...selectedBase,[field]:selectedBase[field].map((v,i)=>i===index?value:v)};updatePart({...base,bindRest:chosen.binding&&rest[chosen.binding]?rest[chosen.binding].toArray():null});}
  function bind(target){const p=detachPart(chosen,rest);updatePart({...p,binding:target,bindRest:target?rest[target].toArray():null});if(target.includes('_arm_'))setPoseJoint(target);}
  function align(){const target=bodies.find(b=>b.id===chosen.binding);if(!target)return;const c=new Vector3().fromArray(target.offset).applyMatrix4(rest[target.id]);updatePart({...selectedBase,position:c.toArray(),bindRest:rest[target.id].toArray()});}
  async function split(){await work('正在生成独立甲片…',async signal=>{if(parts.length>=250)throw Error('部件数量已达 250 个，请删除不需要的部件后继续。');const {negative,positive}=await editGeometry('split',chosen.geometry,{axis:cutAxis,position:cutAt,onProgress:progress,signal});if(triangles-countTriangles(chosen.geometry)+countTriangles(negative)+countTriangles(positive)>TRIANGLE_LIMIT){negative.dispose();positive.dispose();throw Error(`切割后将超过 ${TRIANGLE_LIMIT_LABEL}三角面，请分部件保存后继续。`);}const next=parts.flatMap(p=>p.id===selected?[{...p,id:randomId(),name:p.name+' · A',geometry:negative,cutOpen:true},{...p,id:randomId(),name:p.name+' · B',geometry:positive,cutOpen:true}]:[p]);apply(next);setSelected(next.find(p=>p.geometry===positive).id);setCutEnabled(false);notify('已拆为两块独立网格，可分别绑定。切口暂未封闭。');});}
  async function simplify(){await work('正在优化所选部件…',async signal=>{const before=countTriangles(chosen.geometry),{geometry}=await editGeometry('simplify',chosen.geometry,{ratio:ratio/100,signal}),after=countTriangles(geometry);if(after>=before){geometry.dispose();notify('为保留轮廓和纹理接缝，此部件未进一步减面。');return;}updatePart({geometry});notify(`三角面 ${before.toLocaleString()} → ${after.toLocaleString()}，可撤销对比。`);});}
  async function save(){await work('正在打包外壳文件…',async signal=>{const glb=await exportArmorGlb(parts,config,Infinity,true,{signal});download((filename.replace(/\.glb$/i,'')||'外壳')+'-外壳备份.glb',glb,'model/gltf-binary');setDirty(false);setSavedAt(new Date().toISOString());notify('外壳备份已生成，包含隐藏部件和绑定；请保留下载文件，浏览器不再保存草稿。');});}
  async function exportFile(){await work('正在打包模型与贴图…',async signal=>{const glb=await exportArmorGlb(parts,config,textureSize,false,{signal});download((filename.replace(/\.glb$/i,'')||'外壳')+'-装配.glb',glb,'model/gltf-binary');notify('已导出可见甲片和绑定信息；重新导入可继续编辑。');});}
  async function reset(){if(!session.source)return;await work('正在恢复导入版本…',async signal=>{const next=await loadArmorGlb(session.source,config,{onProgress:progress,signal});apply(next);setSelected(next[0]?.id||'');setAngles({});});}
  function undo(){const previous=history.current.pop();if(!previous)return;setParts(previous);setUndoCount(history.current.length);setDirty(true);setAngles({});setError('');}
  return <div className="armor-workspace" onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();setDrag(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDrag(false);}} onDrop={e=>{e.preventDefault();setDrag(false);importFile(e.dataTransfer.files[0]);}}>
    <header className="armor-heading"><div><span className="armor-eyebrow">从混元模型，到机器人外壳</span><h2>外观装配 <span>工作台</span></h2><p>导入模型，分出甲片，让外观跟随骨架。</p></div><div className="armor-actions"><span className="armor-save-state">{dirty?'临时编辑 · 离开前请下载':savedAt?'已生成备份文件':'临时外壳会话'}</span><button className="button" disabled={!undoCount||locked} onClick={undo}><Undo2 size={15}/>撤销</button><button className="button" disabled={!parts.length||locked} onClick={save}><Save size={15}/>保存外壳文件</button><button className="button dark" disabled={!parts.length||locked} onClick={exportFile}><Download size={15}/>导出 GLB</button></div></header>
    <div className="armor-flow"><span><b>01</b> 导入与对齐</span><ArrowRight size={13}/><span><b>02</b> 分件与优化</span><ArrowRight size={13}/><span><b>03</b> 绑定与检查</span></div>
    <div className="armor-session-note"><Info size={16}/><span>刷新、切换页面或浏览器标签时，自动清除外壳缓存。需要保留编辑，请先「保存外壳文件」。</span></div>
    {error&&<div className="armor-alert" role="alert">{error}<button aria-label="关闭错误" onClick={()=>setError('')}>×</button></div>}
    {posed&&<div className="armor-pose-note">正在预览关节动作。回到零位后可编辑甲片。<button onClick={()=>setAngles({})}>回到零位</button></div>}
    <div className="armor-layout">
      <aside className="armor-panel armor-assets"><div className="armor-panel-title"><Layers3 size={18}/><h3>外壳资产</h3><span>{parts.length||'—'}</span></div>
        <input ref={input} type="file" accept=".glb" aria-label="导入 GLB 文件" className="armor-file-input" onChange={e=>{importFile(e.target.files[0]);e.target.value='';}} disabled={locked}/>
        <button className="armor-upload" onClick={()=>input.current.click()} disabled={locked}><Upload size={23}/><b>{filename?'导入其他 GLB':'拖入混元 GLB 模型'}</b><span>最大 {GLB_LIMIT_LABEL} · {TRIANGLE_LIMIT_LABEL}三角面</span></button>
        <div className="armor-quality-note"><b>效果优先</b><span>保留原始网格与 PBR 贴图，不自动减面</span></div>
        {filename&&<div className="armor-file-meta"><strong title={filename}>{filename}</strong><span>{triangles.toLocaleString()} 三角面 · {parts.length} 个部件</span></div>}
        {!parts.length?<div className="armor-start"><p>选择混元导出的 GLB，保留材质和贴图。</p><button onClick={example} disabled={locked}><Sparkles size={14}/>先试用演示外壳</button><small>程序化样件，用于熟悉操作</small></div>:<>
          <fieldset disabled={editLocked}><Section title="整体对齐" icon={Box}><NumberField label="模型总高度" value={overall.z*1000} min={50} max={10000} onChange={resizeAll}/><div className="armor-pair"><button onClick={()=>rotateAll('z')}>水平转 90°</button><button onClick={()=>rotateAll('x')}>翻转朝向 90°</button></div><button className="armor-text-button" onClick={()=>{const c=bounds.getCenter(new Vector3());bulk(new Matrix4().makeTranslation(-c.x,-c.y,config.wheel/2000+.13-bounds.min.z));}}>居中并放到底盘上方</button></Section></fieldset>
          <div className="armor-list-head"><b>部件列表</b><small>点击部件进行编辑</small></div><div className="armor-parts" role="list" aria-label="外壳部件列表">{parts.map((p,i)=><div role="listitem" className={`armor-part-row ${selected===p.id?'selected':''}`} key={p.id}><button className="armor-part-select" onClick={()=>{setSelected(p.id);setCutPercent(50);}} disabled={locked}><span className="armor-part-index">{String(i+1).padStart(2,'0')}</span><span><strong>{p.name}</strong><small>{p.binding?label(p.binding):'尚未绑定'} · {countTriangles(p.geometry).toLocaleString()} 面</small></span></button><button title={p.visible===false?'显示部件':'隐藏部件'} aria-label={`${p.visible===false?'显示':'隐藏'} ${p.name}`} disabled={locked} onClick={()=>apply(parts.map(q=>q.id===p.id?{...q,visible:q.visible===false}:q))}>{p.visible===false?<EyeOff size={14}/>:<Eye size={14}/>}</button></div>)}</div>
          <button className="armor-text-button armor-restore" disabled={locked||!session.source} onClick={reset}><RotateCcw size={13}/>恢复导入时版本</button>
        </>}
      </aside>
      <div className="armor-center"><ArmorViewport config={config} bodies={bodies} matrices={matrices} parts={parts} selected={selected} onSelect={setSelected} ghost={ghost} onGhost={()=>setGhost(v=>!v)} wire={wire} showFrame={showFrame} cut={cutEnabled?{axis:cutAxis,position:cutAt}:null}/>
        <div className="armor-scene-options"><label><input type="checkbox" checked={showFrame} onChange={e=>setShowFrame(e.target.checked)}/>显示骨架</label><label><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>查看网格</label><span>切口未封闭 · 外观装配预览</span></div>
        <div className="armor-fit-note"><Check size={16}/><div><strong>先定尺寸，再安装甲片</strong><p>先检查整体方向和比例，再选中甲片，绑定对应连杆。模型贴图会随切割保留。</p></div></div>
      </div>
      <aside className="armor-panel armor-inspector"><div className="armor-panel-title"><Box size={18}/><h3>甲片属性</h3></div>
        {!chosen?<div className="armor-empty-properties"><Box size={32}/><p>导入后选择一块甲片</p><small>这里可以调整尺寸、分件和绑定。</small></div>:<>
          <fieldset disabled={editLocked}><div className="armor-name"><label>部件名称<input aria-label="部件名称" key={chosen.id+chosen.name} defaultValue={chosen.name} maxLength={80} onBlur={e=>{const name=e.target.value.trim();if(name&&name!==chosen.name)updatePart({name});}}/></label><button aria-label="删除所选部件" title="删除所选部件，可撤销" onClick={()=>apply(parts.filter(p=>p.id!==selected))}><Trash2 size={15}/></button></div>
          <Section title="尺寸与位置" icon={Box}>
            <div className="armor-mini-label">甲片尺寸（局部方向）</div>{axisNames.map((name,i)=><NumberField key={'s'+i} label={`${name}尺寸`} value={localBox.getSize(new Vector3()).getComponent(i)*selectedBase.scale[i]*1000} min={1} max={10000} onChange={v=>alterSelected('scale',i,v/1000/Math.max(localBox.getSize(new Vector3()).getComponent(i),1e-8))}/>)}
            <div className="armor-mini-label">位置（相对底盘原点）</div>{axisNames.map((name,i)=><NumberField key={'p'+i} label={`${name}位置`} value={selectedBase.position[i]*1000} onChange={v=>alterSelected('position',i,v/1000)}/>)}
            {axisNames.map((name,i)=><NumberField key={'r'+i} label={`${name}旋转`} unit="°" min={-360} max={360} value={selectedBase.rotation[i]*180/Math.PI} onChange={v=>alterSelected('rotation',i,v*Math.PI/180)}/>)}
          </Section>
          <Section title="分件切割" icon={Scissors}><label className="armor-check"><input type="checkbox" checked={cutEnabled} onChange={e=>setCutEnabled(e.target.checked)}/>显示切割平面</label><div className="armor-cut-axes">{['x','y','z'].map(a=><button key={a} className={cutAxis===a?'active':''} onClick={()=>{setCutAxis(a);setCutEnabled(true);}}>{a.toUpperCase()} 方向</button>)}</div><label className="armor-slider">切割位置 <b>{cutPercent}%</b><input type="range" aria-label="切割位置" min={1} max={99} value={cutPercent} onChange={e=>{setCutPercent(+e.target.value);setCutEnabled(true);}}/></label><button className="armor-primary" disabled={chosen.visible===false} onClick={split}><Scissors size={14}/>拆为两块甲片</button><p className="armor-help">沿平面生成独立网格，可重复切割。切口暂不自动封闭。</p></Section>
          <Section title="手动减面（可选）" icon={Sparkles} open={false}><label className="armor-slider">目标保留面数 <b>{ratio}%</b><input aria-label="目标保留面数" type="range" min={10} max={90} step={10} value={ratio} onChange={e=>setRatio(+e.target.value)}/></label><button className="armor-secondary" onClick={simplify}>优化所选部件</button><p className="armor-help">仅点击此按钮才会减面。优先保留轮廓和纹理接缝，实际面数可能高于目标。可撤销对比。</p></Section>
          <Section title="绑定骨架" icon={Link2}><label className="armor-select-label">跟随的连杆<select aria-label="绑定连杆" value={chosen.binding||''} onChange={e=>bind(e.target.value)}><option value="">未绑定 · 自由定位</option>{targets.map(b=><option key={b.id} value={b.id}>{label(b.id)}</option>)}{chosen.binding&&!rest[chosen.binding]&&<option value={chosen.binding}>连杆已不存在 · 请重新绑定</option>}</select></label><button className="armor-secondary" disabled={!chosen.binding||!rest[chosen.binding]} onClick={align}>移至所选连杆中心</button><p className="armor-help">绑定保持当前位置；移动到连杆后，手动调整尺寸和间隙。</p></Section>
          </fieldset>
        </>}
        <Section title="动作检查" icon={RotateCcw}><label className="armor-select-label">预览关节<select aria-label="预览关节" value={joints.some(b=>b.id===poseJoint)?poseJoint:''} onChange={e=>setPoseJoint(e.target.value)} disabled={locked}><option value="" disabled>选择关节</option>{joints.map(b=><option key={b.id} value={b.id}>{label(b.id)}</option>)}</select></label><label className="armor-slider">旋转角度 <b>{angles[poseJoint]||0}°</b><input type="range" aria-label="关节旋转角度" min={-90} max={90} step={5} value={angles[poseJoint]||0} disabled={locked||!joints.some(b=>b.id===poseJoint)} onChange={e=>setAngles({...angles,[poseJoint]:+e.target.value})}/></label><button className="armor-text-button" onClick={()=>setAngles({})}>所有关节回到零位</button><p className="armor-help">用于目视检查碰撞，尚未自动计算运动干涉。</p></Section>
        <Section title="导出设置" icon={Download}><label className="armor-select-label">贴图最大边长<select aria-label="导出贴图尺寸" value={textureSize} onChange={e=>setTextureSize(+e.target.value)}><option value="Infinity">原始尺寸 · 效果优先</option><option value={4096}>4096 px</option><option value={2048}>2048 px</option><option value={1024}>1024 px · 更轻量</option></select></label><p className="armor-help">默认不缩小贴图。导出可见甲片、贴图和绑定信息，不含底盘。绑定在零位保存，重新导入本工作台可继续编辑。</p></Section>
      </aside>
    </div>
    {(busy||drag)&&<div className={`armor-overlay ${drag?'drop':''}`} role="status">{drag?<><Upload size={38}/><b>松开导入 GLB</b></>:<BusyStatus message={busy}/>}</div>}
  </div>;
}
