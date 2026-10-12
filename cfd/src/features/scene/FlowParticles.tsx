import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { RunPhase } from "../experiment/model";
import type { FlowFieldFrame } from "../flow/types";
import { sampleFlowVelocityInto, type FlowVelocity } from "./flowSampling";
import {
  SCENE_FLOW_Y_MAX,
  SCENE_FLOW_Y_MIN,
  sceneXToSolverU,
  sceneYToSolverV,
  solverVToSceneY,
} from "./sceneCoordinates";

type FlowParticlesProps = {
  frame: FlowFieldFrame | null;
  phase: RunPhase;
  windSpeedMps: number;
  count?: number;
};

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.73 + salt * 17.11) * 43758.5453;
  return value - Math.floor(value);
}

function createPositions(count: number) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = -2.8 + seeded(index, 1) * 5.6;
    positions[index * 3 + 1] = solverVToSceneY(0.04 + seeded(index, 2) * 0.92);
    positions[index * 3 + 2] = -0.92 + seeded(index, 3) * 1.84;
  }
  return positions;
}

type ParticleBuffers = {
  positions: Float32Array;
  stalledFor: Float32Array;
  velocity: FlowVelocity;
  transform: THREE.Object3D;
  count: number;
};

function createParticleBuffers(count: number): ParticleBuffers {
  return {
    positions: createPositions(count),
    stalledFor: new Float32Array(count),
    velocity: { x: 0, y: 0 },
    transform: new THREE.Object3D(),
    count,
  };
}

function writeParticleMatrices(mesh: THREE.InstancedMesh | null, buffers: ParticleBuffers) {
  if (!mesh) return;
  mesh.count = buffers.count;
  for (let index = 0; index < buffers.count; index += 1) {
    const offset = index * 3;
    buffers.transform.position.set(
      buffers.positions[offset] ?? 0,
      buffers.positions[offset + 1] ?? 0,
      buffers.positions[offset + 2] ?? 0,
    );
    buffers.transform.updateMatrix();
    mesh.setMatrixAt(index, buffers.transform.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function FlowParticles({ frame, phase, windSpeedMps, count = 900 }: FlowParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef(frame);
  const phaseRef = useRef(phase);
  const windRef = useRef(windSpeedMps);
  const [initialBuffers] = useState(() => createParticleBuffers(count));
  const particleBuffersRef = useRef(initialBuffers);

  useEffect(() => { frameRef.current = frame; }, [frame]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { windRef.current = windSpeedMps; }, [windSpeedMps]);

  useLayoutEffect(() => {
    if (particleBuffersRef.current.count !== count) {
      particleBuffersRef.current = createParticleBuffers(count);
    }
    writeParticleMatrices(meshRef.current, particleBuffersRef.current);
  }, [count]);

  useFrame((_, delta) => {
    if (phaseRef.current === "paused") return;
    const activeFrame = frameRef.current;
    const buffers = particleBuffersRef.current;
    const { positions, stalledFor, velocity } = buffers;
    for (let index = 0; index < buffers.count; index += 1) {
      const offset = index * 3;
      let x = positions[offset] ?? -2.8;
      let y = positions[offset + 1] ?? 0;
      let z = positions[offset + 2] ?? 0;
      if (activeFrame) {
        sampleFlowVelocityInto(activeFrame, sceneXToSolverU(x), sceneYToSolverV(y), velocity);
      } else {
        velocity.x = Math.max(0.018, windRef.current / 240);
        velocity.y = Math.sin(x * 1.8 + index) * 0.0012;
      }
      const forwardSpeed = Math.max(0, velocity.x * 17 + windRef.current * 0.016);
      stalledFor[index] = forwardSpeed < 0.018 ? (stalledFor[index] ?? 0) + delta : 0;
      x += forwardSpeed * delta;
      y += velocity.y * delta * 5;
      z += Math.sin(index * 0.37 + x) * delta * 0.006;
      if (x > 2.8 || x < -2.8 || y < SCENE_FLOW_Y_MIN || y > SCENE_FLOW_Y_MAX || (stalledFor[index] ?? 0) > 1.5) {
        x = -2.8;
        y = solverVToSceneY(0.04 + seeded(index, 4) * 0.92);
        z = -0.92 + seeded(index, 5) * 1.84;
        stalledFor[index] = 0;
      }
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
    }
    writeParticleMatrices(meshRef.current, buffers);
  });

  return (
    <instancedMesh key={count} ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.024, 4, 4]} />
      <meshBasicMaterial color="#002FA7" transparent opacity={0.82} />
    </instancedMesh>
  );
}
