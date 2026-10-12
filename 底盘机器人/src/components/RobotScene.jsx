import { Suspense, useEffect, useMemo, useRef, useState, Component } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Line, Html } from '@react-three/drei';
import { PMREMGenerator, PCFShadowMap } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RotateCcw, Ruler, Layers3, Box, Image, Move3D, Plus, Minus, Eye } from 'lucide-react';
import { robotModel } from '../../shared/robot.mjs';
const PI=Math.PI;
const palette={dark:'#373d3e',metal:'#afb6b8',rubber:'#212524',sensor:'#263633',battery:'#315367',green:'#88a654',red:'#cf4740'};
export function Environment(){const {gl,scene}=useThree();useEffect(()=>{const pm=new PMREMGenerator(gl),room=new RoomEnvironment(),target=pm.fromScene(room,.04);scene.environment=target.texture;return()=>{scene.environment=null;target.dispose();room.dispose();pm.dispose();};},[gl,scene]);return null;}
export function Body({b,exploded,wire,c}){
  const pos=[...b.position];if(exploded){if(b.id==='deck')pos[2]+=.14;if(b.id.includes('wheel')||b.id.includes('motor'))pos[1]+=Math.sign(pos[1])*.15;if(b.id==='battery')pos[2]+=.30;}
  const wheel=b.id.includes('_wheel'),arm=b.id.includes('_arm_');
  return <group position={pos}><group position={b.offset} rotation={b.rotation}><mesh castShadow receiveShadow rotation={b.shape==='cylinder'?[PI/2,0,0]:[0,0,0]}>
    {b.shape==='box'?<boxGeometry args={b.size}/>:<cylinderGeometry args={[b.size[0],b.size[0],b.size[1],48]}/>}
    <meshStandardMaterial color={palette[b.color]} metalness={b.color==='metal'?.88:b.color==='rubber'?.05:.5} roughness={b.color==='metal'?.25:.6} wireframe={wire} transparent={b.id==='base_link'&&exploded} opacity={b.id==='base_link'&&exploded?.25:1}/>
  </mesh>{wheel&&<>
    {[-1,1].map(side=><group key={side} position={[0,0,side*.038]}><mesh><circleGeometry args={[b.size[0]*.59,48]}/><meshStandardMaterial color="#7a8489" metalness={.9} roughness={.24} side={2}/></mesh><mesh position={[0,0,side*.002]}><circleGeometry args={[b.size[0]*.43,48]}/><meshStandardMaterial color="#353c3e" metalness={.6} side={2}/></mesh>{Array.from({length:6},(_,i)=><mesh key={i} position={[Math.cos(i*PI/3)*b.size[0]*.48,Math.sin(i*PI/3)*b.size[0]*.48,side*.004]}><sphereGeometry args={[.005,8,8]}/><meshStandardMaterial color="#cad1d4" metalness={.9}/></mesh>)}</group>)}
    {Array.from({length:c.drive==='mecanum'?10:24},(_,i)=>{const a=i*2*PI/(c.drive==='mecanum'?10:24);return <mesh key={i} position={[Math.cos(a)*b.size[0],Math.sin(a)*b.size[0],0]} rotation={[0,c.drive==='mecanum'?.6:0,a]}><boxGeometry args={[.006,c.drive==='mecanum'?.03:.016,.068]}/><meshStandardMaterial color="#303635" roughness={.9}/></mesh>;})}
  </>}</group>
  {arm&&<group><mesh rotation={[PI/2,0,0]}><cylinderGeometry args={[.033,.033,.055,24]}/><meshStandardMaterial color="#222829" metalness={.65} roughness={.28}/></mesh><mesh position={[0,-.031,0]} rotation={[PI/2,0,0]}><cylinderGeometry args={[.017,.017,.009,20]}/><meshStandardMaterial color="#969ea0" metalness={.9}/></mesh></group>}
  {b.id.endsWith('brace')&&[.5,1].map(t=><mesh key={t} position={[0,0,b.size[1]*t-.015]} rotation={[PI/2,0,0]}><cylinderGeometry args={[.026,.026,.06,24]}/><meshStandardMaterial color="#252b2d" metalness={.55} roughness={.4}/></mesh>)}
  {b.id==='deck'&&[-1,1].flatMap(x=>[-1,1].map(y=><mesh key={`${x}${y}`} position={[x*(b.size[0]/2-.022),y*(b.size[1]/2-.022),.008]}><sphereGeometry args={[.006,10,6]}/><meshStandardMaterial color="#626a70" metalness={.9}/></mesh>))}
  </group>;
}
function Scene({config,exploded,wire,dimensions,view,zoom}){
  const controls=useRef(),{camera}=useThree(),bodies=useMemo(()=>robotModel(config),[config]);
  const height=config.mast/1000+.28;
  useEffect(()=>{const v=view.id==='front'?[2.8,height*.55,0]:view.id==='top'?[.01,3.4,.01]:[2.3,1.65,2.7];camera.position.set(...v.map(x=>x*zoom));controls.current?.target.set(0,height*.46,0);controls.current?.update();},[view,zoom,height,camera]);
  return <><color attach="background" args={['#f4f5f3']}/><Environment/><ambientLight intensity={.75}/><directionalLight position={[3,5,3]} intensity={3} castShadow shadow-mapSize={[2048,2048]}/><directionalLight position={[-3,2,-4]} intensity={2}/>
    <group rotation={[-PI/2,0,0]}>{bodies.map(b=><Body key={b.id} b={b} c={config} exploded={exploded} wire={wire}/>)}</group>
    <Grid position={[0,-.003,0]} args={[30,30]} cellSize={.1} cellThickness={.6} cellColor="#d9ded7" sectionSize={.5} sectionThickness={.6} sectionColor="#cdd3ca" fadeDistance={5} fadeStrength={2} infiniteGrid/>
    <ContactShadows position={[0,-.005,0]} opacity={.36} scale={5} blur={2.7} far={2.5} resolution={512}/>
    {dimensions&&<><Line points={[[0,height,-.39],[0,.18,-.39]]} color="#939d8e" lineWidth={1}/><Html position={[0,height*.6,-.4]} center><span className="dimension-tag">{config.mast} mm</span></Html><Line points={[[-config.width/2000,height+.03,0],[config.width/2000,height+.03,0]]} color="#939d8e" lineWidth={1}/><Html position={[0,height+.05,0]} center><span className="dimension-tag">{config.width} mm</span></Html></>}
    <OrbitControls ref={controls} makeDefault target={[0,height*.46,0]} minDistance={1.1} maxDistance={7} maxPolarAngle={PI/2.04} enableDamping/>
  </>;
}
class SceneBoundary extends Component{constructor(p){super(p);this.state={error:false};}static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="scene-error"><img src="./assets/skatechassis.png" alt="SkateChassis 外观参考"/><p>WebGL 不可用，显示原始外观参考。参数与工程导出仍可使用。</p></div>:this.props.children;}}
export function RobotScene({config,onArmor}){
  const [reference,setReference]=useState(false),[exploded,setExploded]=useState(false),[wire,setWire]=useState(false),[dimensions,setDimensions]=useState(true),[view,setView]=useState({id:'iso',seq:0}),[zoom,setZoom]=useState(1);
  return <section className="viewport" aria-label="机器人三维参数模型"><div className="viewport-top"><span><span className="live-dot"/>{reference?'原始外观参考':'参数化装配'}</span><div className="viewport-top-actions">{onArmor&&<button className="view-ref" onClick={onArmor}><Layers3 size={14}/>导入外壳</button>}<button className={`view-ref ${reference?'active':''}`} onClick={()=>setReference(!reference)}><Image size={14}/>{reference?'返回 3D':'参考图'}</button></div></div>
    {reference?<div className="reference-image"><img src="./assets/skatechassis.png" alt="用户提供的 SkateChassis 机器人效果图"/><p>原始效果图 · 尺寸以参数模型为准</p></div>:<SceneBoundary><Suspense fallback={<div className="loading">正在构建模型…</div>}><Canvas shadows={{type:PCFShadowMap}} dpr={[1,2]} camera={{position:[2.3,1.65,2.7],fov:32,near:.01,far:50}}><Scene config={config} exploded={exploded} wire={wire} dimensions={dimensions} view={view} zoom={zoom}/></Canvas></Suspense></SceneBoundary>}
    <button className="view-cube" title="切换正视 / 顶视 / 透视" onClick={()=>setView({id:view.id==='iso'?'front':view.id==='front'?'top':'iso',seq:view.seq+1})}><Box size={34} strokeWidth={1}/><span>{{iso:'透视',front:'正视',top:'顶视'}[view.id]}</span></button>
    <div className="viewport-toolbar"><button title="重置视角" onClick={()=>{setView({id:'iso',seq:view.seq+1});setZoom(1);}}><RotateCcw size={18}/><span>重置</span></button><button className={dimensions?'active':''} onClick={()=>setDimensions(!dimensions)}><Ruler size={18}/><span>尺寸</span></button><button className={exploded?'active':''} onClick={()=>{setReference(false);setExploded(!exploded);}}><Layers3 size={18}/><span>分解</span></button><button className={wire?'active':''} onClick={()=>{setReference(false);setWire(!wire);}}><Eye size={18}/><span>线框</span></button><i/><button title="放大" onClick={()=>setZoom(Math.max(.5,zoom-.15))}><Plus size={18}/></button><button title="缩小" onClick={()=>setZoom(Math.min(1.7,zoom+.15))}><Minus size={18}/></button></div>
    <div className="viewport-hint"><Move3D size={13}/>拖动旋转 · 滚轮缩放 <span>概念几何 · 非制造图纸</span></div>
  </section>;
}
