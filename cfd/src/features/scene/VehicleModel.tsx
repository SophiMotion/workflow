import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { FlowFieldFrame } from "../flow/types";
import type { HotspotId } from "./hotspotTypes";
import { SCENE_VEHICLE_BODY_CENTER_Y, SOLVER_VEHICLE_BODY_CENTER_V } from "./sceneCoordinates";
import { vehicleModuleOpacities } from "./sceneVisibility";

type VehicleModelProps = {
  frame: FlowFieldFrame | null;
  selected: HotspotId | null;
};

function pressureColor(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value) || maximum <= minimum) return "#879194";
  const t = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);
  const low = new THREE.Color("#2366bc");
  const middle = new THREE.Color("#879194");
  const high = new THREE.Color("#d94a43");
  return (t < 0.5 ? low.lerp(middle, t * 2) : middle.lerp(high, (t - 0.5) * 2)).getStyle();
}

export function VehicleModel({ frame, selected }: VehicleModelProps) {
  const { stand: standOpacity, car: carOpacity } = vehicleModuleOpacities(selected);
  const pressureBands = useMemo(() => {
    if (!frame?.pressure.length) return ["#718083", "#879194", "#718083"];
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const value of frame.pressure) {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    return [0.34, 0.5, 0.66].map((u) => {
      const x = Math.round(u * (frame.width - 1));
      const y = Math.round((frame.height - 1) * SOLVER_VEHICLE_BODY_CENTER_V);
      return pressureColor(frame.pressure[y * frame.width + x] ?? 0, minimum, maximum);
    });
  }, [frame]);

  return (
    <group position={[0, SCENE_VEHICLE_BODY_CENTER_Y - 0.1 * 0.82, 0]}>
      <group>
        <mesh position={[0, -0.52, 0]}><boxGeometry args={[2.35, 0.12, 1.18]} /><meshStandardMaterial color="#d84940" transparent opacity={standOpacity} /></mesh>
        <mesh position={[-0.72, -0.3, 0]}><boxGeometry args={[0.12, 0.5, 0.12]} /><meshStandardMaterial color="#d84940" transparent opacity={standOpacity} /></mesh>
        <mesh position={[0.72, -0.3, 0]}><boxGeometry args={[0.12, 0.5, 0.12]} /><meshStandardMaterial color="#d84940" transparent opacity={standOpacity} /></mesh>
      </group>

      <group scale={0.82}>
        <RoundedBox args={[2.3, 0.48, 1.02]} radius={0.15} smoothness={3} position={[0, 0.1, 0]}>
          <meshStandardMaterial color="#e8e5dc" emissive="#e8e5dc" emissiveIntensity={0.08} metalness={0.25} roughness={0.34} transparent opacity={carOpacity} />
        </RoundedBox>
        <mesh position={[-1.18, 0.1, 0]} rotation={[0, 0, -0.16]}>
          <boxGeometry args={[0.36, 0.36, 0.92]} />
          <meshStandardMaterial color="#e8e5dc" transparent opacity={carOpacity} />
        </mesh>
        <mesh position={[0.18, 0.57, 0]} rotation={[0, 0, -0.05]}>
          <boxGeometry args={[1.18, 0.48, 0.86]} />
          <meshStandardMaterial color="#789398" metalness={0.18} roughness={0.28} transparent opacity={0.9 * carOpacity} />
        </mesh>
        {pressureBands.map((color, index) => (
          <mesh key={index} position={[-0.67 + index * 0.66, 0.35, 0.515]}>
            <boxGeometry args={[0.46, 0.18, 0.025]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.14} transparent opacity={0.78 * carOpacity} />
          </mesh>
        ))}
        {[-0.72, 0.75].flatMap((x) => [-0.52, 0.52].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -0.1, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.18, 18]} />
            <meshStandardMaterial color="#20272a" transparent opacity={carOpacity} />
          </mesh>
        )))}
        <group position={[0.9, 0.68, 0]}>
          <mesh><boxGeometry args={[0.08, 0.36, 0.08]} /><meshStandardMaterial color="#d84940" transparent opacity={carOpacity} /></mesh>
          <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.38, 0.06, 1.12]} /><meshStandardMaterial color="#252d30" transparent opacity={carOpacity} /></mesh>
        </group>
      </group>
    </group>
  );
}
