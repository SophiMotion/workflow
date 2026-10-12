import { useI18n } from './i18n';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { taperedBodyGeometry } from './geometry3d';
import { topOutline } from './design';
import { Box, RotateCcw, Move, ZoomIn, ZoomOut } from 'lucide-react';

function shapeFrom(region) {
  const shape = new THREE.Shape(region.outer.map(p => new THREE.Vector2(...p)));
  for (const hole of region.holes || []) shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(...p))));
  return shape;
}
function release(group) { group.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); }); }
export default function Scene({ design, geometry }) {
  const { t } = useI18n();
  const mount = useRef(null), world = useRef(null), [view, setView] = useState('3d'), [error, setError] = useState('');
  useEffect(() => {
    const el = mount.current; let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setError('当前环境未启用 WebGL，无法显示 3D 预览。请使用 Chrome 或开启硬件加速。'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 1200); camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 100; controls.maxDistance = 350; controls.maxPolarAngle = Math.PI * .49;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa6937d, 2.2));
    const key = new THREE.DirectionalLight(0xfff4e4, 3.8); key.position.set(-65, -60, 160); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -90; key.shadow.camera.right = key.shadow.camera.top = 90; key.shadow.radius = 5; key.shadow.blurSamples = 12; key.shadow.normalBias = .12; key.shadow.bias = -.0001; scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 2.1); rim.position.set(60, 60, 90); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: .16 })); floor.position.z = -.05; floor.receiveShadow = true; scene.add(floor);
    world.current = { renderer, scene, camera, controls, group: null, fit: 80 };
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    let frame; const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }; animate();
    const lost = e => { e.preventDefault(); setError('3D 预览暂时中断，请重新加载页面。设计参数已保存在本机。'); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); release(scene); renderer.dispose(); el.removeChild(renderer.domElement); world.current = null; };
  }, []);
  useEffect(() => {
    const w = world.current; if (!w || !geometry) return;
    if (w.group) { w.scene.remove(w.group); release(w.group); }
    const group = new THREE.Group();
    const body = new THREE.Mesh(taperedBodyGeometry(geometry.outline, geometry.topOutline || topOutline(design, geometry.outline), design.thickness), new THREE.MeshStandardMaterial({ color: '#bb7e30', roughness: .38, metalness: .02 })); body.castShadow = body.receiveShadow = true; group.add(body);
    for (const r of geometry.reliefs) {
      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(r), { depth: r.height + .03, bevelEnabled: false, steps: 1 }), new THREE.MeshStandardMaterial({ color: '#ce903d', roughness: .34, metalness: .015 }));
      mesh.position.z = design.thickness - .03; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    }
    // 轻转模型以让中心文字保持可读 / Turn slightly for a natural product view.
    group.rotation.z = -.12; w.scene.add(group); w.group = group;
    const ratio = design.diameter / w.fit;
    if (w.initialized && Math.abs(ratio - 1) > .001) w.camera.position.sub(w.controls.target).multiplyScalar(ratio).add(w.controls.target);
    w.fit = design.diameter; w.controls.target.set(0, 0, design.thickness * .45);
    if (!w.initialized) { const scale = design.diameter / 80; w.camera.position.set(72 * scale, -118 * scale, 142 * scale); w.initialized = true; }
  }, [geometry, design.thickness, design.diameter]);
  const setCamera = mode => {
    const w = world.current; if (!w) return;
    const scale = Math.max(w.fit / 80, .8);
    if (mode === 'top') w.camera.position.set(0, -.01, 205 * scale);
    else w.camera.position.set(72 * scale, -118 * scale, 142 * scale);
    w.controls.update(); setView(mode);
  };
  const zoom = n => { const w = world.current; if (!w) return; const offset = w.camera.position.clone().sub(w.controls.target).multiplyScalar(n); if (offset.length() >= 100 && offset.length() <= 350) w.camera.position.copy(w.controls.target).add(offset); w.controls.update(); };
  return <section className="preview-card" aria-label={t("月饼 3D 预览")}>
    <div className="canvas" ref={mount} />
    {error && <div className="webgl-error" role="alert">{t(error)}</div>}
    <div className="preview-top"><span className="preview-badge"><Box size={17}/>{t("实时 3D 预览")}</span><button className="icon-button" title={t("重置视角")} aria-label={t("重置视角")} onClick={() => setCamera('3d')}><RotateCcw size={18}/></button></div>
    <div className="rotate-hint"><Move size={13}/> {t("拖动旋转 · 滚轮缩放")}</div>
    <div className="preview-bottom"><div className="dimension-label">⌀ {design.diameter}<span> × </span>{design.thickness} mm <span className="preview-draft">· {design.draftAngle}°</span></div><div className="view-switch"><button className={view === '3d' ? 'selected' : ''} onClick={() => setCamera('3d')}>{t("立体")}</button><button className={view === 'top' ? 'selected' : ''} onClick={() => setCamera('top')}>{t("正面")}</button></div></div>
    <div className="zoom-tools"><button aria-label={t("放大预览")} onClick={() => zoom(.88)}><ZoomIn size={17}/></button><button aria-label={t("缩小预览")} onClick={() => zoom(1.12)}><ZoomOut size={17}/></button></div>
  </section>;
}
