import type { ModelDocument } from '@sophicad/schema';

export interface ChangedValue<T> { id: string; before: T; after: T }
export interface ModelComparison {
  parameters: { added: string[]; removed: string[]; changed: ChangedValue<string>[] };
  components: { added: string[]; removed: string[] };
  occurrences: { added: string[]; removed: string[] };
  joints: { added: string[]; removed: string[]; changed: string[] };
  bom: { added: string[]; removed: string[]; changed: string[] };
  physicalProperties: { changed: string[] };
}

function ids<T>(values: readonly T[], id: (value: T) => string): Set<string> {
  return new Set(values.map(id));
}

function setDiff(left: ReadonlySet<string>, right: ReadonlySet<string>): string[] {
  return [...left].filter((value) => !right.has(value)).sort();
}

function changedByJson<T>(left: readonly T[], right: readonly T[], id: (value: T) => string): string[] {
  const rightById = new Map(right.map((item) => [id(item), item]));
  return left.filter((item) => {
    const next = rightById.get(id(item));
    return next !== undefined && JSON.stringify(item) !== JSON.stringify(next);
  }).map(id).sort();
}

export function compareModels(left: ModelDocument, right: ModelDocument): ModelComparison {
  const leftParameters = new Map(left.parameters.user.map((item) => [item.name, item]));
  const rightParameters = new Map(right.parameters.user.map((item) => [item.name, item]));
  const leftComponents = ids(left.components, (item) => item.id);
  const rightComponents = ids(right.components, (item) => item.id);
  const leftOccurrences = ids(left.occurrences, (item) => item.id);
  const rightOccurrences = ids(right.occurrences, (item) => item.id);
  const leftJoints = ids(left.joints, (item) => item.id);
  const rightJoints = ids(right.joints, (item) => item.id);
  const leftBom = ids(left.bom, (item) => item.componentId);
  const rightBom = ids(right.bom, (item) => item.componentId);
  return {
    parameters: {
      added: setDiff(new Set(rightParameters.keys()), new Set(leftParameters.keys())),
      removed: setDiff(new Set(leftParameters.keys()), new Set(rightParameters.keys())),
      changed: [...leftParameters].flatMap(([name, before]) => {
        const after = rightParameters.get(name);
        return after && (before.expression !== after.expression || Math.abs((before.valueSi ?? 0) - (after.valueSi ?? 0)) > 1e-12)
          ? [{ id: name, before: before.expression, after: after.expression }]
          : [];
      }).sort((a, b) => a.id.localeCompare(b.id)),
    },
    components: { added: setDiff(rightComponents, leftComponents), removed: setDiff(leftComponents, rightComponents) },
    occurrences: { added: setDiff(rightOccurrences, leftOccurrences), removed: setDiff(leftOccurrences, rightOccurrences) },
    joints: {
      added: setDiff(rightJoints, leftJoints), removed: setDiff(leftJoints, rightJoints),
      changed: changedByJson(left.joints, right.joints, (item) => item.id),
    },
    bom: {
      added: setDiff(rightBom, leftBom), removed: setDiff(leftBom, rightBom),
      changed: changedByJson(left.bom, right.bom, (item) => item.componentId),
    },
    physicalProperties: {
      changed: changedByJson(left.physicalProperties, right.physicalProperties, (item) => item.entityId),
    },
  };
}
