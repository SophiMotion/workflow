import type {
  ChangesDocument,
  Diagnostic,
  ModelDocument,
  ParameterChange,
  RobotJointOverride,
} from '@sophicad/schema';

import { orderChangedParameters } from './dependencies.js';

export class ChangeError extends Error {
  readonly code: string;
  readonly entityId: string | undefined;

  constructor(code: string, message: string, entityId?: string) {
    super(message);
    this.name = 'ChangeError';
    this.code = code;
    this.entityId = entityId;
  }
}

export interface SortedParameterChangeResult {
  ordered: ParameterChange[];
  diagnostics: Diagnostic[];
}

export interface PatchedModelResult {
  model: ModelDocument;
  changedEntityIds: string[];
  diagnostics: Diagnostic[];
}

export function sortParameterChanges(
  model: ModelDocument,
  changes: readonly ParameterChange[],
): SortedParameterChangeResult {
  const parameters = new Map(model.parameters.user.map((item) => [item.name, item]));
  const changesByName = new Map<string, ParameterChange>();

  for (const change of changes) {
    if (changesByName.has(change.name)) {
      throw new ChangeError('duplicate_parameter_change', `参数 ${change.name} 出现多个修改。`, change.name);
    }
    const parameter = parameters.get(change.name);
    if (!parameter) {
      throw new ChangeError('parameter_not_found', `找不到用户参数 ${change.name}。`, change.name);
    }
    if (!parameter.writable) {
      throw new ChangeError('parameter_read_only', `用户参数 ${change.name} 不可写。`, change.name);
    }
    if (change.newExpression.trim().length === 0) {
      throw new ChangeError('parameter_expression_empty', `用户参数 ${change.name} 的新表达式为空。`, change.name);
    }
    changesByName.set(change.name, change);
  }

  const dependencyResult = orderChangedParameters(model, changes);
  if (dependencyResult.cycleNames.length > 0) {
    throw new ChangeError(
      'parameter_dependency_cycle',
      `参数修改依赖形成环：${dependencyResult.cycleNames.join(', ')}`,
      dependencyResult.cycleNames[0],
    );
  }

  return {
    ordered: dependencyResult.orderedNames.map((name) => changesByName.get(name)!),
    diagnostics: [],
  };
}

function recordChanged(changed: string[], id: string): void {
  if (!changed.includes(id)) changed.push(id);
}

function mergeRobotOverride(
  current: RobotJointOverride | undefined,
  next: RobotJointOverride,
): RobotJointOverride {
  return {
    ...(current ?? { jointId: next.jointId }),
    ...next,
    ...(current?.limit || next.limit
      ? { limit: { ...(current?.limit ?? {}), ...(next.limit ?? {}) } }
      : {}),
  };
}

export function applyChangesDocument(
  model: ModelDocument,
  changes: ChangesDocument,
): PatchedModelResult {
  const sorted = sortParameterChanges(model, changes.parameterChanges);
  const originalParameters = new Map(model.parameters.user.map((item) => [item.name, item]));

  for (const change of sorted.ordered) {
    const original = originalParameters.get(change.name)!;
    if (original.expression !== change.oldExpression) {
      throw new ChangeError(
        'parameter_precondition_failed',
        `参数 ${change.name} 的当前表达式与更新包不一致。`,
        change.name,
      );
    }
    if (
      change.expectedOldValueSi !== undefined
      && original.valueSi !== change.expectedOldValueSi
    ) {
      throw new ChangeError(
        'parameter_value_precondition_failed',
        `参数 ${change.name} 的当前值与更新包不一致。`,
        change.name,
      );
    }
  }

  const patched = structuredClone(model);
  const patchedParameters = new Map(patched.parameters.user.map((item) => [item.name, item]));
  const changedEntityIds: string[] = [];
  for (const change of sorted.ordered) {
    patchedParameters.get(change.name)!.expression = change.newExpression;
    recordChanged(changedEntityIds, change.name);
  }

  for (const change of changes.jointChanges) {
    const joint = patched.joints.find((item) => item.id === change.jointId);
    if (!joint) {
      throw new ChangeError('joint_not_found', `找不到 Joint ${change.jointId}。`, change.jointId);
    }
    const currentLimit = joint.limit ?? {};
    const key = change.field.slice('limit.'.length) as 'lower' | 'upper' | 'effort' | 'velocity';
    if (change.oldValue !== undefined && currentLimit[key] !== change.oldValue) {
      throw new ChangeError('joint_precondition_failed', `Joint ${change.jointId} 限位已变化。`, change.jointId);
    }
    joint.limit = { ...currentLimit, [key]: change.newValue };
    recordChanged(changedEntityIds, change.jointId);
  }

  for (const change of changes.robotOverrides) {
    const index = patched.robot.jointOverrides.findIndex((item) => item.jointId === change.jointId);
    const current = index >= 0 ? patched.robot.jointOverrides[index] : undefined;
    const merged = mergeRobotOverride(current, change.override);
    if (index >= 0) patched.robot.jointOverrides[index] = merged;
    else patched.robot.jointOverrides.push(merged);
    recordChanged(changedEntityIds, change.jointId);
  }

  for (const change of changes.bomOverrides) {
    const bom = patched.bom.find((item) => item.componentId === change.componentId);
    if (!bom) {
      throw new ChangeError('bom_component_not_found', `BOM 中找不到组件 ${change.componentId}。`, change.componentId);
    }
    if (change.description !== undefined) bom.description = change.description;
    if (change.material !== undefined) bom.material = change.material;
    recordChanged(changedEntityIds, change.componentId);
  }

  return {
    model: patched,
    changedEntityIds,
    diagnostics: sorted.diagnostics,
  };
}
