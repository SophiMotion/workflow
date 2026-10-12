import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ComponentRecord } from '@sophicad/schema';
import type { SophiCadPackage } from '@sophicad/core';

import { useWorkbenchStore } from '../../store/workbench-store';
import { GeometryPromiseCache } from './geometry-cache';
import { buildFourBarPreview } from './four-bar-preview';

const cache = new GeometryPromiseCache<THREE.BufferGeometry[]>();

function buffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function loadGeometry(source: SophiCadPackage, component: ComponentRecord): Promise<THREE.BufferGeometry[]> {
  const path = component.visualMesh ?? component.collisionMesh;
  if (!path) return [];
  const bytes = source.files.get(path);
  if (!bytes) return [];
  if (path.toLowerCase().endsWith('.stl')) {
    const geometry = new STLLoader().parse(buffer(bytes));
    geometry.computeVertexNormals();
    return [geometry];
  }
  const gltf = await new GLTFLoader().parseAsync(buffer(bytes), '');
  const geometries: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) geometries.push(object.geometry.clone());
  });
  return geometries;
}

function rowMajorMatrix(values: readonly number[]): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    values[0]!, values[1]!, values[2]!, values[3]!,
    values[4]!, values[5]!, values[6]!, values[7]!,
    values[8]!, values[9]!, values[10]!, values[11]!,
    values[12]!, values[13]!, values[14]!, values[15]!,
  );
}

export function OccurrenceScene({ showJointAxes = false }: { showJointAxes?: boolean }) {
  const source = useWorkbenchStore((state) => state.source);
  const model = useWorkbenchStore((state) => state.model);
  const selected = useWorkbenchStore((state) => state.selectedEntityId);
  const select = useWorkbenchStore((state) => state.selectEntity);
  const changes = useWorkbenchStore((state) => state.changes.parameterChanges);
  const inputAngleDeg = useWorkbenchStore((state) => state.kinematicsInputAngleDeg);
  const [geometries, setGeometries] = useState<Map<string, THREE.BufferGeometry[]>>(new Map());

  useEffect(() => {
    let active = true;
    if (!source || !model) return undefined;
    const entries = model.components.map(async (component) => {
      const value = await cache.get(`${source.manifest.packageId}:${component.id}`, () => loadGeometry(source, component));
      return [component.id, value] as const;
    });
    void Promise.all(entries).then((items) => { if (active) setGeometries(new Map(items)); });
    return () => { active = false; };
  }, [model, source]);

  const components = useMemo(() => new Map(model?.components.map((item) => [item.id, item]) ?? []), [model]);
  const preview = useMemo(() => {
    if (!model) return undefined;
    const changed = new Map(changes.map((item) => [item.name, item.newExpression]));
    return buildFourBarPreview(model, changed, inputAngleDeg);
  }, [changes, inputAngleDeg, model]);
  if (!model) return null;
  return (
    <group>
      {model.occurrences.map((occurrence) => {
        const component = components.get(occurrence.componentId);
        const color = component?.appearance?.baseColor ?? [0.52, 0.56, 0.6, 1];
        const isSelected = selected === occurrence.id || selected === occurrence.componentId;
        return (
          <group key={occurrence.id} matrix={preview?.get(occurrence.id) ?? rowMajorMatrix(occurrence.transform)} matrixAutoUpdate={false}>
            {(geometries.get(occurrence.componentId) ?? []).map((geometry, index) => (
              <mesh key={index} geometry={geometry} onClick={(event) => { event.stopPropagation(); select(occurrence.id); }} castShadow receiveShadow>
                <meshStandardMaterial
                  color={isSelected ? '#002FA7' : new THREE.Color(color[0], color[1], color[2])}
                  metalness={0.38}
                  roughness={0.56}
                  emissive={isSelected ? '#174ea6' : '#000000'}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>
        );
      })}
      {showJointAxes ? model.joints.map((joint) => (
        <group key={joint.id} position={[joint.origin[3], joint.origin[7], joint.origin[11]]}>
          <mesh onClick={(event) => { event.stopPropagation(); select(joint.id); }}>
            <torusGeometry args={[0.012, 0.0016, 8, 32]} />
            <meshBasicMaterial color={joint.loopClosure ? '#FBBC04' : '#002FA7'} />
          </mesh>
          <arrowHelper args={[new THREE.Vector3(...joint.axis), new THREE.Vector3(), 0.045, joint.loopClosure ? 0xfdd663 : 0x8ab4f8]} />
        </group>
      )) : null}
    </group>
  );
}
