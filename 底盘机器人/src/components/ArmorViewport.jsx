import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Box3, BoxGeometry, Vector3, DoubleSide, PCFShadowMap } from 'three';
import { Box, RotateCcw, Scan, Eye } from 'lucide-react';
import { Body, Environment } from './RobotScene.jsx';
import { partsBounds, partMatrix } from '../lib/armor-model.js';

function ArmorPart({part,matrices,selected,onSelect,ghost,wire,cut}){
  const {gl}=useThree();
  useEffect(()=>{for(const m of Array.isArray(part.material)?part.material:[part.material])for(const t of Object.values(m))if(t?.isTexture){const anisotropy=gl.capabilities.getMaxAnisotropy();if(t.anisotropy!==anisotropy){t.anisotropy=anisotropy;t.needsUpdate=true;}}},[part.material,gl]);
  const material=useMemo(()=>{
    const ms=(Array.isArray(part.material)?part.material:[part.material]).map(m=>{const c=m.clone();c.wireframe=wire;c.transparent=ghost||m.transparent;c.opacity=ghost?.38:m.opacity;c.depthWrite=ghost?false:m.depthWrite;return c;});return Array.isArray(part.material)?ms:ms[0];
  },[part.material,ghost,wire]);
  useEffect(()=>()=>{for(const m of Array.isArray(material)?material:[material])m.dispose();},[material]);
  const box=useMemo(()=>{if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();return part.geometry.boundingBox.clone();},[part.geometry]);
  const size=box.getSize(new Vector3()),center=box.getCenter(new Vector3()),axis=cut?.axis||'z';
  const outline=useMemo(()=>new BoxGeometry(...box.getSize(new Vector3()).toArray().map(v=>v+.004)),[box]);
  useEffect(()=>()=>outline.dispose(),[outline]);
  const at=center.clone();if(cut)at[axis]=cut.position;
  if(part.visible===false)return null;
  return <group matrix={partMatrix(part,matrices)} matrixAutoUpdate={false} dispose={null}>
    <mesh geometry={part.geometry} material={material} castShadow receiveShadow onClick={e=>{e.stopPropagation();onSelect(part.id);}}/>
    {selected&&<lineSegments position={center.toArray()}><edgesGeometry args={[outline]}/><lineBasicMaterial color="#91b33d" transparent opacity={.7} depthTest={false}/></lineSegments>}
    {selected&&cut&&<mesh position={at.toArray()} rotation={axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0]} renderOrder={10}>
      <planeGeometry args={[Math.max(size.x,size.y,size.z)*1.3,Math.max(size.x,size.y,size.z)*1.3]}/><meshBasicMaterial color="#b3d568" side={DoubleSide} transparent opacity={.32} depthWrite={false}/>
    </mesh>}
  </group>;
}
function Contents({config,bodies,matrices,parts,selected,onSelect,ghost,wire,cut,showFrame,view}){
  const {camera,invalidate}=useThree(),controls=useRef();
  const bounds=useMemo(()=>{const box=parts.length?partsBounds(parts):new Box3();box.expandByPoint(new Vector3(-.5,-.5,0));box.expandByPoint(new Vector3(.5,.5,config.mast/1000+.4));return box;},[parts,config.mast]);
  useEffect(()=>{
    const target=bounds.getCenter(new Vector3());target.set(target.x,target.z,-target.y);
    const size=bounds.getSize(new Vector3()).length(),d=Math.max(2.3,size*1.6),dir=view.id==='front'?new Vector3(1,0,0):view.id==='side'?new Vector3(0,0,1):new Vector3(1,.5,1).normalize();
    camera.position.copy(target.clone().addScaledVector(dir,d));controls.current?.target.copy(target);controls.current?.update();invalidate();
  },[view,config.mast,parts.length===0,camera,invalidate]);
  return <><color attach="background" args={['#f3f5f0']}/><Environment/><ambientLight intensity={1}/><directionalLight position={[3,5,3]} intensity={2.5} castShadow/><directionalLight position={[-3,2,-4]} intensity={1.5}/>
    <group rotation={[-Math.PI/2,0,0]}>
      {showFrame&&bodies.map(b=><group key={b.id} matrix={matrices[b.id]} matrixAutoUpdate={false}><Body b={{...b,position:[0,0,0]}} c={config} wire={false}/></group>)}
      {parts.map(p=><ArmorPart key={p.id} part={p} matrices={matrices} selected={p.id===selected} onSelect={onSelect} ghost={ghost} wire={wire} cut={p.id===selected?cut:null}/>)}
    </group>
    <Grid args={[10,10]} position={[0,-.01,0]} cellSize={.1} sectionSize={.5} cellColor="#e0e5d9" sectionColor="#ccd5c1" fadeDistance={5} infiniteGrid/>
    <OrbitControls ref={controls} makeDefault minDistance={.2} maxDistance={20} enableDamping/>
  </>;
}
class ArmorBoundary extends Component{
  state={error:false};static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<div className="armor-empty"><Box size={36}/><p>三维预览暂不可用，请刷新后重新导入。</p><small>刷新会清除临时外壳；已下载的 GLB 文件仍可使用。</small></div>:this.props.children;}
}
export function ArmorViewport(props){
  const [view,setView]=useState({id:'iso',n:0});
  return <section className="armor-viewport" aria-label="外壳装配三维视图">
    <div className="armor-scene-label"><span className="live-dot"/>{props.parts.length?'外壳与骨架':'等待导入外壳'}<span>米制空间</span></div>
    <ArmorBoundary><Suspense fallback={<div className="armor-empty">正在准备预览…</div>}><Canvas frameloop="demand" shadows={{type:PCFShadowMap}} dpr={[1,2]} gl={{antialias:true,powerPreference:'high-performance'}} camera={{fov:38,near:.005,far:100,position:[3,2,3]}}><Contents {...props} view={view}/></Canvas></Suspense></ArmorBoundary>
    <div className="armor-view-tools"><button onClick={()=>setView(v=>({id:'iso',n:v.n+1}))}><RotateCcw size={15}/>适合视图</button><button onClick={()=>setView(v=>({id:'front',n:v.n+1}))}><Scan size={15}/>正面</button><button onClick={()=>setView(v=>({id:'side',n:v.n+1}))}><Box size={15}/>侧面</button><button className={props.ghost?'active':''} onClick={props.onGhost}><Eye size={15}/>透视外壳</button></div>
    <p className="armor-scene-hint">拖动旋转 · 滚轮缩放 · 点击选择甲片</p>
  </section>;
}
