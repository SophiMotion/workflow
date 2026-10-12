import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { HotspotId } from "./hotspotTypes";

type WindTunnelGeometryProps = {
  selected: HotspotId | null;
  cutaway: boolean;
};

const OFF_WHITE = "#ebe8df";
const CHARCOAL = "#252d30";
const RED = "#d84940";

function moduleOpacity(selected: HotspotId | null, id: HotspotId) {
  return selected && selected !== id ? 0.2 : 1;
}

function makeTaperGeometry() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.8, -1.25, -1.35, -0.8, -1.25, 1.35, -0.8, 1.25, 1.35, -0.8, 1.25, -1.35,
    0.8, -0.92, -1.02, 0.8, -0.92, 1.02, 0.8, 0.92, 1.02, 0.8, 0.92, -1.02,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7,
    1, 5, 6, 1, 6, 2, 0, 3, 7, 0, 7, 4,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function HoneycombPlane({ x, opacity }: { x: number; opacity: number }) {
  const columns = 8;
  const rows = 7;
  const cells = useMemo(() => Array.from({ length: columns * rows }, (_, index) => ({
    x: (index % columns - (columns - 1) / 2) * 0.25 + (Math.floor(index / columns) % 2) * 0.125,
    y: (Math.floor(index / columns) - (rows - 1) / 2) * 0.27,
  })), []);
  const geometry = useMemo(() => new THREE.RingGeometry(0.09, 0.115, 6), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: CHARCOAL, side: THREE.DoubleSide }), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const matrix = new THREE.Matrix4();
    cells.forEach((cell, index) => {
      matrix.makeTranslation(cell.x, cell.y, 0);
      meshRef.current?.setMatrixAt(index, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [cells]);

  return (
    <group position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <instancedMesh ref={meshRef} args={[geometry, material, cells.length]}>
        <meshStandardMaterial color={CHARCOAL} transparent opacity={opacity} side={THREE.DoubleSide} />
      </instancedMesh>
      <mesh>
        <boxGeometry args={[2.35, 2.35, 0.06]} />
        <meshStandardMaterial color={CHARCOAL} wireframe transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

function StructuralHoop({ x, opacity }: { x: number; opacity: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1.18, 0]}><boxGeometry args={[0.16, 0.14, 2.42]} /><meshStandardMaterial color={CHARCOAL} transparent opacity={opacity} /></mesh>
      <mesh position={[0, -1.18, 0]}><boxGeometry args={[0.16, 0.14, 2.42]} /><meshStandardMaterial color={CHARCOAL} transparent opacity={opacity} /></mesh>
      <mesh position={[0, 0, 1.14]}><boxGeometry args={[0.16, 2.22, 0.14]} /><meshStandardMaterial color={CHARCOAL} transparent opacity={opacity} /></mesh>
      <mesh position={[0, 0, -1.14]}><boxGeometry args={[0.16, 2.22, 0.14]} /><meshStandardMaterial color={CHARCOAL} transparent opacity={opacity} /></mesh>
    </group>
  );
}

export function WindTunnelGeometry({ selected, cutaway }: WindTunnelGeometryProps) {
  const taper = useMemo(() => makeTaperGeometry(), []);
  const straightenerOpacity = moduleOpacity(selected, "straightener");
  const contractionOpacity = moduleOpacity(selected, "contraction");
  const testOpacity = moduleOpacity(selected, "test-section");
  const fanOpacity = moduleOpacity(selected, "fan");

  return (
    <group>
      <group>
        <HoneycombPlane x={-5.1} opacity={straightenerOpacity} />
        <HoneycombPlane x={-4.6} opacity={straightenerOpacity} />
        <mesh position={[-4.86, 0, 0]}>
          <boxGeometry args={[0.8, 2.7, 2.9]} />
          <meshStandardMaterial color={OFF_WHITE} side={THREE.BackSide} transparent opacity={0.82 * straightenerOpacity} />
        </mesh>
      </group>

      <group position={[-3.55, 0, 0]}>
        <mesh geometry={taper}>
          <meshStandardMaterial color={OFF_WHITE} transparent opacity={0.86 * contractionOpacity} side={THREE.DoubleSide} />
        </mesh>
        <StructuralHoop x={-0.76} opacity={contractionOpacity} />
        <StructuralHoop x={0.76} opacity={contractionOpacity} />
      </group>

      <group>
        <mesh position={[0, cutaway ? -0.55 : 0, 0]}>
          <boxGeometry args={[5.2, cutaway ? 1.1 : 2.2, 2.15]} />
          <meshPhysicalMaterial color="#b8e2df" transmission={0.42} transparent opacity={0.055 * testOpacity} roughness={0.12} thickness={0.04} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <StructuralHoop x={-2.55} opacity={testOpacity} />
        <StructuralHoop x={0} opacity={testOpacity} />
        <StructuralHoop x={2.55} opacity={testOpacity} />
      </group>

      <group position={[3.65, 0, 0]}>
        <mesh geometry={taper} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial color={OFF_WHITE} transparent opacity={0.86 * fanOpacity} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group position={[5.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh><cylinderGeometry args={[1.33, 1.33, 0.75, 32, 1, true]} /><meshStandardMaterial color={OFF_WHITE} transparent opacity={fanOpacity} side={THREE.DoubleSide} /></mesh>
        <mesh><cylinderGeometry args={[0.23, 0.23, 0.88, 20]} /><meshStandardMaterial color={RED} transparent opacity={fanOpacity} /></mesh>
        {Array.from({ length: 6 }, (_, index) => (
          <group key={index} rotation={[0, index * Math.PI / 3, 0]}>
            <mesh position={[0.48, 0, 0]} rotation={[0, 0, 0.34]}>
              <boxGeometry args={[0.7, 0.06, 0.22]} />
              <meshStandardMaterial color={RED} transparent opacity={fanOpacity} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[1.25, 1.25, 0.05, 32]} /><meshStandardMaterial color={RED} wireframe transparent opacity={fanOpacity} /></mesh>
      </group>

      <group position={[0, -1.47, 0]}>
        <mesh><boxGeometry args={[12, 0.12, 3.2]} /><meshStandardMaterial color="#17242a" metalness={0.4} roughness={0.62} /></mesh>
        {[-5, -2.5, 0, 2.5, 5].map((x) => <mesh key={x} position={[x, -0.16, 0]}><boxGeometry args={[0.18, 0.22, 3]} /><meshStandardMaterial color={CHARCOAL} /></mesh>)}
      </group>
    </group>
  );
}
