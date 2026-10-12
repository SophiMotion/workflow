import { Line } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { LabState } from "../experiment/labStore";
import type { FlowFieldFrame } from "../flow/types";
import {
  SCENE_FLOW_CENTER_Y,
  SCENE_FLOW_HEIGHT,
  SCENE_FLOW_WIDTH,
  SOLVER_VEHICLE_BODY_CENTER_V,
  solverVToSceneY,
} from "./sceneCoordinates";

type FieldMode = LabState["selectedField"];

type FieldSliceProps = {
  frame: FlowFieldFrame | null;
  mode: FieldMode;
  reducedMotion: boolean;
};

const TEXTURE_WIDTH = 120;
const TEXTURE_HEIGHT = 48;

type Rgb = readonly [number, number, number];

function makePaletteLut(low: Rgb, middle: Rgb, high: Rgb, midpoint = 0.5) {
  const lut = new Uint8Array(256 * 3);
  for (let index = 0; index < 256; index += 1) {
    const normalized = index / 255;
    const lowerHalf = normalized <= midpoint;
    const amount = lowerHalf ? normalized / midpoint : (normalized - midpoint) / (1 - midpoint);
    const from = lowerHalf ? low : middle;
    const to = lowerHalf ? middle : high;
    const offset = index * 3;
    lut[offset] = Math.round(from[0] + (to[0] - from[0]) * amount);
    lut[offset + 1] = Math.round(from[1] + (to[1] - from[1]) * amount);
    lut[offset + 2] = Math.round(from[2] + (to[2] - from[2]) * amount);
  }
  return lut;
}

const PALETTE_LUTS: Record<FieldMode, Uint8Array> = {
  speed: makePaletteLut([6, 59, 67], [49, 214, 219], [240, 238, 231], 0.58),
  pressure: makePaletteLut([37, 101, 182], [128, 137, 140], [217, 75, 67]),
  vorticity: makePaletteLut([101, 55, 166], [128, 137, 140], [227, 166, 63]),
  streamlines: makePaletteLut([80, 227, 208], [80, 227, 208], [80, 227, 208]),
};

function fieldValues(frame: FlowFieldFrame | null, mode: FieldMode) {
  if (!frame) return null;
  if (mode === "pressure") return frame.pressure;
  if (mode === "vorticity") return frame.vorticity;
  return frame.speed;
}

function makeTexture(frame: FlowFieldFrame | null, mode: FieldMode) {
  const rgba = new Uint8Array(TEXTURE_WIDTH * TEXTURE_HEIGHT * 4);
  const values = fieldValues(frame, mode);
  const palette = PALETTE_LUTS[mode];
  let minimum = Infinity;
  let maximum = -Infinity;
  if (values) {
    for (const value of values) {
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }

  for (let row = 0; row < TEXTURE_HEIGHT; row += 1) {
    for (let column = 0; column < TEXTURE_WIDTH; column += 1) {
      const u = column / (TEXTURE_WIDTH - 1);
      const v = row / (TEXTURE_HEIGHT - 1);
      let normalized = 0.25 + u * 0.6 + Math.sin(u * 11 + v * 4) * 0.04;
      if (frame && values) {
        const sourceX = Math.round(u * (frame.width - 1));
        const sourceY = Math.round(v * (frame.height - 1));
        const value = values[sourceY * frame.width + sourceX] ?? minimum;
        normalized = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0.5;
      }
      const paletteOffset = Math.round(Math.min(1, Math.max(0, normalized)) * 255) * 3;
      const offset = (row * TEXTURE_WIDTH + column) * 4;
      rgba[offset] = palette[paletteOffset] ?? 0;
      rgba[offset + 1] = palette[paletteOffset + 1] ?? 0;
      rgba[offset + 2] = palette[paletteOffset + 2] ?? 0;
      rgba[offset + 3] = mode === "streamlines" ? 0 : Math.round((frame ? 0.54 : 0.28) * 255);
    }
  }

  const texture = new THREE.DataTexture(rgba, TEXTURE_WIDTH, TEXTURE_HEIGHT, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function StaticStreamlines({ muted }: { muted: boolean }) {
  const paths = useMemo(() => Array.from({ length: 24 }, (_, row) => {
    const baseV = 0.08 + row * (0.84 / 23);
    const baseY = solverVToSceneY(baseV);
    return Array.from({ length: 34 }, (__, column) => {
      const x = -2.9 + column * (5.8 / 33);
      const vehicleWake = Math.exp(-Math.pow((x - 0.15) / 1.25, 2));
      const side = baseV >= SOLVER_VEHICLE_BODY_CENTER_V ? 1 : -1;
      const y = baseY + side * vehicleWake * 0.09 + Math.sin(x * 2.2 + row) * 0.008;
      return new THREE.Vector3(x, y, 0.08);
    });
  }), []);

  return <>{paths.map((points, index) => <Line key={index} points={points} color="#002FA7" transparent opacity={muted ? 0.34 : 0.76} lineWidth={0.75} />)}</>;
}

export function FieldSlice({ frame, mode, reducedMotion }: FieldSliceProps) {
  const texture = useMemo(() => makeTexture(frame, mode), [frame, mode]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group>
      {mode !== "streamlines" && (
        <mesh position={[0, SCENE_FLOW_CENTER_Y, 0.06]} renderOrder={-1}>
          <planeGeometry args={[SCENE_FLOW_WIDTH, SCENE_FLOW_HEIGHT]} />
          <meshBasicMaterial map={texture} transparent opacity={1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {(mode === "streamlines" || reducedMotion) && <StaticStreamlines muted={mode !== "streamlines"} />}
    </group>
  );
}
