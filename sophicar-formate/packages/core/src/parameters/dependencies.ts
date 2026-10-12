import type { ModelDocument, ParameterChange } from '@sophicad/schema';

export interface DependencySortResult {
  orderedNames: string[];
  cycleNames: string[];
}

export function orderChangedParameters(
  model: ModelDocument,
  changes: readonly ParameterChange[],
): DependencySortResult {
  const changedNames = new Set(changes.map((item) => item.name));
  const parameters = new Map(model.parameters.user.map((item) => [item.name, item]));
  const outgoing = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  for (const name of changedNames) {
    outgoing.set(name, new Set());
    indegree.set(name, 0);
  }

  for (const name of changedNames) {
    const parameter = parameters.get(name);
    if (!parameter) continue;
    for (const dependency of parameter.dependencies) {
      if (!changedNames.has(dependency)) continue;
      const dependents = outgoing.get(dependency);
      if (!dependents || dependents.has(name)) continue;
      dependents.add(name);
      indegree.set(name, (indegree.get(name) ?? 0) + 1);
    }
  }

  const ready = [...changedNames]
    .filter((name) => (indegree.get(name) ?? 0) === 0)
    .sort();
  const orderedNames: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) break;
    orderedNames.push(current);
    for (const dependent of [...(outgoing.get(current) ?? [])].sort()) {
      const nextDegree = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, nextDegree);
      if (nextDegree === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }

  const cycleNames = [...changedNames]
    .filter((name) => !orderedNames.includes(name))
    .sort();
  return { orderedNames, cycleNames };
}
