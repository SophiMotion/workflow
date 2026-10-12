import {
  generateUrdf,
  readSophiCadPackage,
  validateUrdfArtifacts,
  type SophiCadPackage,
  type UrdfArtifacts,
} from '@sophicad/core';
import type { ChangesDocument, Diagnostic, ModelDocument } from '@sophicad/schema';
import { create } from 'zustand';

import { normalizeParameterExpression } from '../features/parameters/parameter-values';

export type WorkbenchMode = 'three' | 'urdf';

interface LoadOptions {
  filename?: string;
}

interface WorkbenchState {
  source?: SophiCadPackage;
  sourceBytes?: Uint8Array;
  sourceFilename?: string;
  model?: ModelDocument;
  changes: ChangesDocument;
  diagnostics: Diagnostic[];
  urdf?: UrdfArtifacts;
  selectedEntityId?: string;
  staleEntityIds: Set<string>;
  kinematicsInputAngleDeg: number;
  mode: WorkbenchMode;
  loading: boolean;
  error?: string;
  loadPackage(bytes: Uint8Array, options?: LoadOptions): Promise<void>;
  selectEntity(id?: string): void;
  setMode(mode: WorkbenchMode): void;
  setParameterExpression(name: string, expression: string): void;
  setKinematicsInputAngle(angleDeg: number): void;
  setJointLimit(jointId: string, field: 'lower' | 'upper' | 'effort' | 'velocity', value: number): void;
  reset(): void;
}

function emptyChanges(): ChangesDocument {
  return {
    schemaVersion: '1.0.0',
    basePackageId: '',
    baseFingerprint: '0'.repeat(64),
    targetDesignGuid: '',
    createdAt: new Date().toISOString(),
    parameterChanges: [],
    jointChanges: [],
    robotOverrides: [],
    bomOverrides: [],
  };
}

function changesFor(source: SophiCadPackage): ChangesDocument {
  return source.changes ?? {
    ...emptyChanges(),
    basePackageId: source.manifest.packageId,
    baseFingerprint: source.manifest.source.fingerprint,
    targetDesignGuid: source.manifest.source.designGuid,
  };
}

function generateArtifacts(model: ModelDocument): { urdf?: UrdfArtifacts; diagnostics: Diagnostic[] } {
  const root = model.robot.rootOccurrenceId ?? model.occurrences[0]?.id;
  if (!root) {
    return { diagnostics: [{ severity: 'error', code: 'robot_root_missing', message: '模型没有可用的机器人根实例。' }] };
  }
  const urdf = generateUrdf(model, { rootOccurrenceId: root, meshUriMode: 'relative' });
  return { urdf, diagnostics: [...urdf.diagnostics, ...validateUrdfArtifacts(urdf)] };
}

const initialState = {
  changes: emptyChanges(),
  diagnostics: [] as Diagnostic[],
  staleEntityIds: new Set<string>(),
  mode: 'three' as WorkbenchMode,
  loading: false,
  kinematicsInputAngleDeg: 28,
};

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  ...initialState,
  async loadPackage(bytes, options) {
    set({ loading: true, error: undefined });
    try {
      const source = await readSophiCadPackage(bytes);
      const model = source.model;
      const artifacts = generateArtifacts(model);
      set({
        source,
        sourceBytes: bytes,
        sourceFilename: options?.filename,
        model,
        changes: changesFor(source),
        diagnostics: [...source.diagnostics, ...artifacts.diagnostics],
        urdf: artifacts.urdf,
        selectedEntityId: model.robot.rootOccurrenceId ?? model.occurrences[0]?.id,
        staleEntityIds: new Set(),
        loading: false,
        error: undefined,
      });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '无法读取数据包。' });
    }
  },
  selectEntity(selectedEntityId) {
    set({ selectedEntityId });
  },
  setMode(mode) {
    set({ mode });
  },
  setParameterExpression(name, expression) {
    const state = get();
    const parameter = state.model?.parameters.user.find((item) => item.name === name);
    if (!parameter || !parameter.writable) return;
    const normalizedExpression = normalizeParameterExpression(expression, parameter.unit);
    const parameterChanges = state.changes.parameterChanges.filter((item) => item.name !== name);
    if (normalizedExpression !== parameter.expression) {
      parameterChanges.push({
        name,
        oldExpression: parameter.expression,
        newExpression: normalizedExpression,
        expectedOldValueSi: parameter.valueSi,
      });
    }
    const stale = new Set<string>();
    if (parameterChanges.length > 0) {
      state.model?.components.forEach((component) => stale.add(component.id));
    }
    set({ changes: { ...state.changes, parameterChanges }, staleEntityIds: stale });
  },
  setKinematicsInputAngle(kinematicsInputAngleDeg) {
    if (!Number.isFinite(kinematicsInputAngleDeg)) return;
    set({ kinematicsInputAngleDeg });
  },
  setJointLimit(jointId, field, value) {
    const state = get();
    const path = `limit.${field}` as const;
    const sourceJoint = state.model?.joints.find((item) => item.id === jointId);
    const jointChanges = state.changes.jointChanges.filter((item) => !(item.jointId === jointId && item.field === path));
    jointChanges.push({
      jointId,
      field: path,
      oldValue: sourceJoint?.limit?.[field],
      newValue: value,
      writebackMode: sourceJoint?.writeback.limits ? 'fusion-if-supported' : 'robot-only',
    });
    set({ changes: { ...state.changes, jointChanges } });
  },
  reset() {
    set({
      source: undefined,
      sourceBytes: undefined,
      sourceFilename: undefined,
      model: undefined,
      urdf: undefined,
      selectedEntityId: undefined,
      error: undefined,
      ...initialState,
      changes: emptyChanges(),
      staleEntityIds: new Set(),
    });
  },
}));
