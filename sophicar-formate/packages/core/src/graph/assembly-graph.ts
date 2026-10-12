import type { Diagnostic, JointRecord, ModelDocument } from '@sophicad/schema';

export interface AssemblyAnalysis {
  roots: string[];
  connectedComponents: string[][];
  orphanOccurrenceIds: string[];
  degreesOfFreedom: number;
  diagnostics: Diagnostic[];
}

export interface SpanningTreeResult {
  rootOccurrenceId: string;
  treeJointIds: string[];
  loopJointIds: string[];
  disconnectedJointIds: string[];
  diagnostics: Diagnostic[];
}

interface Edge {
  joint: JointRecord;
  left: string;
  right: string;
}

class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  constructor(values: Iterable<string>) {
    for (const value of values) {
      this.parent.set(value, value);
      this.rank.set(value, 0);
    }
  }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (parent === undefined) {
      this.parent.set(value, value);
      this.rank.set(value, 0);
      return value;
    }
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(left: string, right: string): boolean {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return false;

    const leftRank = this.rank.get(leftRoot) ?? 0;
    const rightRank = this.rank.get(rightRoot) ?? 0;
    if (leftRank < rightRank) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    this.parent.set(rightRoot, leftRoot);
    if (leftRank === rightRank) {
      this.rank.set(leftRoot, leftRank + 1);
    }
    return true;
  }
}

function collectEdges(model: ModelDocument, diagnostics: Diagnostic[]): Edge[] {
  const occurrenceIds = new Set(model.occurrences.map((item) => item.id));
  const seenJointIds = new Set<string>();
  const edges: Edge[] = [];

  for (const joint of [...model.joints].sort((left, right) => left.id.localeCompare(right.id))) {
    if (seenJointIds.has(joint.id)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate_joint_id',
        message: `Joint ID 重复：${joint.id}`,
        entityId: joint.id,
      });
      continue;
    }
    seenJointIds.add(joint.id);

    if (joint.suppressed) continue;
    const left = joint.parentOccurrenceId;
    const right = joint.childOccurrenceId;
    if (!left || !right || !occurrenceIds.has(left) || !occurrenceIds.has(right)) {
      diagnostics.push({
        severity: 'error',
        code: 'joint_occurrence_missing',
        message: `Joint ${joint.id} 的父或子 Occurrence 不存在。`,
        entityId: joint.id,
      });
      continue;
    }
    if (left === right) {
      diagnostics.push({
        severity: 'error',
        code: 'joint_self_loop',
        message: `Joint ${joint.id} 连接到同一 Occurrence。`,
        entityId: joint.id,
      });
      continue;
    }
    edges.push({ joint, left, right });
  }
  return edges;
}

function buildAdjacency(nodes: Iterable<string>, edges: Edge[]): Map<string, Edge[]> {
  const adjacency = new Map<string, Edge[]>();
  for (const node of nodes) adjacency.set(node, []);
  for (const edge of edges) {
    adjacency.get(edge.left)?.push(edge);
    adjacency.get(edge.right)?.push(edge);
  }
  for (const list of adjacency.values()) {
    list.sort((left, right) => left.joint.id.localeCompare(right.joint.id));
  }
  return adjacency;
}

function reachableFrom(root: string, adjacency: ReadonlyMap<string, Edge[]>): Set<string> {
  const reached = new Set<string>();
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || reached.has(current)) continue;
    reached.add(current);
    for (const edge of adjacency.get(current) ?? []) {
      const next = edge.left === current ? edge.right : edge.left;
      if (!reached.has(next)) queue.push(next);
    }
  }
  return reached;
}

export function analyzeAssemblyGraph(model: ModelDocument): AssemblyAnalysis {
  const diagnostics: Diagnostic[] = [];
  const occurrenceIds = model.occurrences.map((item) => item.id).sort();
  const uniqueOccurrenceIds = new Set(occurrenceIds);
  if (uniqueOccurrenceIds.size !== occurrenceIds.length) {
    diagnostics.push({
      severity: 'error',
      code: 'duplicate_occurrence_id',
      message: '装配体包含重复的 Occurrence ID。',
    });
  }

  const edges = collectEdges(model, diagnostics);
  const adjacency = buildAdjacency(uniqueOccurrenceIds, edges);
  const remaining = new Set(uniqueOccurrenceIds);
  const connectedComponents: string[][] = [];

  for (const candidate of [...remaining].sort()) {
    if (!remaining.has(candidate)) continue;
    const component = [...reachableFrom(candidate, adjacency)].sort();
    for (const id of component) remaining.delete(id);
    connectedComponents.push(component);
  }
  connectedComponents.sort((left, right) => (left[0] ?? '').localeCompare(right[0] ?? ''));

  const roots = model.occurrences
    .filter((item) => item.grounded)
    .map((item) => item.id)
    .sort();

  return {
    roots,
    connectedComponents,
    orphanOccurrenceIds: connectedComponents
      .filter((component) => component.length === 1 && (adjacency.get(component[0] ?? '')?.length ?? 0) === 0)
      .flat(),
    degreesOfFreedom: edges.reduce((total, edge) => total + edge.joint.degreesOfFreedom, 0),
    diagnostics,
  };
}

function edgePriority(edge: Edge, locked: ReadonlySet<string>): [number, number, number, string] {
  return [
    locked.has(edge.joint.id) ? 0 : 1,
    edge.joint.type === 'fixed' ? 0 : 1,
    edge.joint.type !== 'unknown' && edge.joint.type !== 'inferred' ? 0 : 1,
    edge.joint.id,
  ];
}

function comparePriority(
  left: Edge,
  right: Edge,
  locked: ReadonlySet<string>,
): number {
  const leftKey = edgePriority(left, locked);
  const rightKey = edgePriority(right, locked);
  for (let index = 0; index < leftKey.length; index += 1) {
    const a = leftKey[index];
    const b = rightKey[index];
    if (typeof a === 'number' && typeof b === 'number' && a !== b) return a - b;
    if (typeof a === 'string' && typeof b === 'string') {
      const compared = a.localeCompare(b);
      if (compared !== 0) return compared;
    }
  }
  return 0;
}

export function buildUrdfSpanningTree(
  model: ModelDocument,
  rootOccurrenceId: string,
  lockedJointIds: readonly string[] = model.robot.lockedTreeJointIds ?? [],
): SpanningTreeResult {
  const diagnostics: Diagnostic[] = [];
  const occurrenceIds = new Set(model.occurrences.map((item) => item.id));
  if (!occurrenceIds.has(rootOccurrenceId)) {
    return {
      rootOccurrenceId,
      treeJointIds: [],
      loopJointIds: [],
      disconnectedJointIds: model.joints.map((item) => item.id).sort(),
      diagnostics: [{
        severity: 'error',
        code: 'root_occurrence_not_found',
        message: `找不到 root Occurrence：${rootOccurrenceId}`,
        entityId: rootOccurrenceId,
      }],
    };
  }

  const allEdges = collectEdges(model, diagnostics);
  const allAdjacency = buildAdjacency(occurrenceIds, allEdges);
  const reachable = reachableFrom(rootOccurrenceId, allAdjacency);
  const edges = allEdges.filter((edge) => reachable.has(edge.left) && reachable.has(edge.right));
  const disconnectedJointIds = allEdges
    .filter((edge) => !reachable.has(edge.left) || !reachable.has(edge.right))
    .map((edge) => edge.joint.id)
    .sort();

  const locked = new Set(lockedJointIds);
  const unionFind = new UnionFind(reachable);
  const selected: Edge[] = [];
  const loopEdges: Edge[] = [];

  for (const edge of [...edges].sort((left, right) => comparePriority(left, right, locked))) {
    if (unionFind.union(edge.left, edge.right)) {
      selected.push(edge);
      continue;
    }
    loopEdges.push(edge);
    if (locked.has(edge.joint.id)) {
      diagnostics.push({
        severity: 'error',
        code: 'locked_joint_cycle',
        message: `锁定 Joint ${edge.joint.id} 会形成 URDF 环路。`,
        entityId: edge.joint.id,
      });
    }
  }

  const selectedAdjacency = buildAdjacency(reachable, selected);
  const treeJointIds: string[] = [];
  const visited = new Set<string>();
  const queue = [rootOccurrenceId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    for (const edge of selectedAdjacency.get(current) ?? []) {
      const next = edge.left === current ? edge.right : edge.left;
      if (visited.has(next)) continue;
      treeJointIds.push(edge.joint.id);
      queue.push(next);
    }
  }

  return {
    rootOccurrenceId,
    treeJointIds,
    loopJointIds: loopEdges.map((edge) => edge.joint.id).sort(),
    disconnectedJointIds,
    diagnostics,
  };
}
