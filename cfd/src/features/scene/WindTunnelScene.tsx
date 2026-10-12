import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import type { PerspectiveCamera } from "three";
import { useLabStore } from "../experiment/labStore";
import { AdaptiveQualityController, qualityProfile, type QualityProfile } from "../shell/quality";
import { CameraControlBar } from "./CameraControlBar";
import { applyCameraCommand, type CameraCommand } from "./cameraCommands";
import { FieldSlice } from "./FieldSlice";
import { FlowParticles } from "./FlowParticles";
import { Hotspots } from "./Hotspots";
import type { HotspotId } from "./hotspotTypes";
import { SceneFallback } from "./SceneFallback";
import { VehicleModel } from "./VehicleModel";
import { WindTunnelGeometry } from "./WindTunnelGeometry";
import { registerWebglContextRecovery } from "./webglContextRecovery";

export type WindTunnelSceneProps = {
  webglAvailable?: boolean;
  onHotspot(id: HotspotId): void;
  quality?: QualityProfile;
  onQualityChange?(profile: QualityProfile): void;
  onContextLost?(): void;
  onContextRestored?(): void;
};

function detectWebgl() {
  if (typeof window === "undefined" || typeof window.WebGLRenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    const loseContext = context.getExtension("WEBGL_lose_context") as { loseContext?(): void } | null;
    loseContext?.loseContext?.();
    return true;
  } catch {
    return false;
  }
}

let cachedWebglAvailability: boolean | undefined;

function getWebglAvailability() {
  if (cachedWebglAvailability === undefined) cachedWebglAvailability = detectWebgl();
  return cachedWebglAvailability;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function QualityFrameMonitor({
  paused,
  profile,
  onChange,
}: {
  paused: boolean;
  profile: QualityProfile;
  onChange(profile: QualityProfile): void;
}) {
  const [controller] = useState(() => new AdaptiveQualityController(profile.name, onChange));
  useEffect(() => { controller.setOnChange(onChange); }, [controller, onChange]);
  useEffect(() => { controller.setProfile(profile.name); }, [controller, profile.name]);
  useFrame((_, delta) => {
    if (!paused) controller.recordFrame(delta * 1_000);
  });
  return null;
}

export function WindTunnelScene({
  webglAvailable,
  onHotspot,
  quality = qualityProfile("medium"),
  onQualityChange = () => undefined,
  onContextLost = () => undefined,
  onContextRestored = () => undefined,
}: WindTunnelSceneProps) {
  const resolvedWebglAvailable = webglAvailable ?? getWebglAvailability();
  const [selected, setSelected] = useState<HotspotId | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const orbitControlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const frame = useLabStore((state) => state.flowField);
  const fieldMode = useLabStore((state) => state.selectedField);
  const phase = useLabStore((state) => state.phase);
  const windSpeedMps = useLabStore((state) => state.telemetry.windSpeedMps);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!canvasElement) return;
    return registerWebglContextRecovery(
      canvasElement,
      () => {
        setContextLost(true);
        onContextLost();
      },
      () => {
        setContextLost(false);
        setSceneKey((current) => current + 1);
        onContextRestored();
      },
    );
  }, [canvasElement, onContextLost, onContextRestored]);
  const selectHotspot = (id: HotspotId) => {
    const next = selected === id ? null : id;
    setSelected(next);
    if (next) onHotspot(next);
  };
  const commandCamera = (command: CameraCommand) => {
    const camera = cameraRef.current;
    const controls = orbitControlsRef.current;
    if (!camera || !controls) return;
    applyCameraCommand({ camera, controls }, command);
  };

  return (
    <section className="wind-tunnel-scene" aria-label="三维数字风洞工作区">
      <div className="scene-hud">
        <span><span>2D TEACHING CFD</span><span> / 二维教学近似</span></span>
        <span>{resolvedWebglAvailable ? `${fieldMode.toUpperCase()} / ${frame ? "实时场" : "示意流场"}` : "DIAGRAM MODE / 示意模式"}</span>
      </div>
      <div className="scene-viewport">
        {resolvedWebglAvailable && (
        <div className={`scene-canvas${contextLost ? " scene-canvas-context-lost" : ""}`} aria-label="交互式三维风洞">
          <Canvas
            key={sceneKey}
            camera={{ position: [7.8, 4.6, 10.4], fov: 38 }}
            dpr={[1, 1.65]}
            fallback={<SceneFallback />}
            onCreated={({ camera, gl }) => {
              cameraRef.current = camera as PerspectiveCamera;
              setCanvasElement(gl.domElement);
            }}
          >
            <color attach="background" args={["#202124"]} />
            <fog attach="fog" args={["#202124", 13, 24]} />
            <ambientLight intensity={1.5} />
            <directionalLight position={[-4, 7, 8]} intensity={3.2} color="#f8f2df" />
            <directionalLight position={[7, 2, -4]} intensity={1.5} color="#34a853" />
            <WindTunnelGeometry selected={selected} cutaway={selected === "test-section"} />
            <FieldSlice frame={frame} mode={fieldMode} reducedMotion={reducedMotion} />
            <VehicleModel frame={frame} selected={selected} />
            <QualityFrameMonitor paused={contextLost} profile={quality} onChange={onQualityChange} />
            {!reducedMotion && quality.particleCount > 0 && (
              <FlowParticles frame={frame} phase={phase} windSpeedMps={windSpeedMps} count={quality.particleCount} />
            )}
            <gridHelper args={[18, 36, "#5f6368", "#3c4043"]} position={[0, -1.56, 0]} />
            <axesHelper args={[1.05]} position={[-6.1, -1.42, 1.55]} />
            <OrbitControls ref={orbitControlsRef} makeDefault target={[0, -0.05, 0]} minDistance={7} maxDistance={18} enableDamping dampingFactor={0.08} />
          </Canvas>
        </div>
        )}
        {(!resolvedWebglAvailable || contextLost) && (
          <SceneFallback
            announce={contextLost}
            message={contextLost ? "三维上下文已丢失，正在等待浏览器恢复。" : undefined}
          />
        )}
        <CameraControlBar
          disabled={!resolvedWebglAvailable || contextLost}
          onCommand={commandCamera}
        />
      </div>
      <Hotspots selected={selected} onSelect={selectHotspot} />
    </section>
  );
}
