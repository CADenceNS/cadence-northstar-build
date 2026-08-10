import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import { buildTopology, boundaryLoops, edgeKey, faceCentroid, faceNormal, indexedMesh, quantizedKey, type IndexedMesh } from './editing-geometry';
import { distance3, dot3, normalize3, subtract3, transformPoint } from './geometry';
import type { ComponentKind, ComponentSelectionMode, MeshComponentSelection } from './editing-types';

export interface ScreenProjector { projectWorld(position: Vec3): { x: number; y: number; visible: boolean }; }

export class ComponentSelectionEngine {
  private values = new Map<string, MeshComponentSelection>();
  private readonly listeners = new Set<(selections: MeshComponentSelection[]) => void>();

  constructor(initial: MeshComponentSelection[] = []) { this.replace(initial); }

  subscribe(listener: (selections: MeshComponentSelection[]) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  list(): MeshComponentSelection[] { return [...this.values.values()].map((selection) => structuredClone(selection)); }
  get(objectId: string): MeshComponentSelection | undefined { const value = this.values.get(objectId); return value ? structuredClone(value) : undefined; }
  set(selection: MeshComponentSelection, additive = false): void {
    if (!additive) this.values.clear();
    const current = this.values.get(selection.objectId);
    const next = current && additive && current.kind === selection.kind
      ? { ...selection, ids: unique([...current.ids, ...selection.ids]) }
      : structuredClone(selection);
    this.values.set(selection.objectId, next);
    this.changed();
  }
  clear(): void { this.values.clear(); this.changed(); }
  replace(selections: MeshComponentSelection[]): void { this.values = new Map(selections.map((selection) => [selection.objectId, structuredClone(selection)])); this.changed(); }
  removeObject(objectId: string): void { if (this.values.delete(objectId)) this.changed(); }

  private changed(): void { const values = this.list(); this.listeners.forEach((listener) => listener(values)); }
}

export function selectionFromSurfaceHit(
  artifact: ArtifactRecord,
  object: SceneObject,
  triangleId: number,
  position: Vec3,
  mode: Extract<ComponentSelectionMode, 'vertex' | 'edge' | 'face' | 'connected-region' | 'shell' | 'boundary-loop' | 'edge-loop' | 'edge-ring' | 'normal-angle' | 'connectivity'>,
  normalAngleDegrees = 30,
): MeshComponentSelection {
  const mesh = indexedMesh(artifact.mesh);
  if (!mesh.faces[triangleId]) throw new Error(`Triangle ${triangleId} is not present in ${object.name}.`);
  const topology = buildTopology(mesh);
  let kind: ComponentKind = 'face';
  let ids: number[];
  if (mode === 'vertex') {
    kind = 'vertex';
    ids = [nearestVertex(mesh, mesh.faces[triangleId], position)];
  } else if (mode === 'edge') {
    kind = 'edge';
    ids = [nearestEdge(mesh, topology.faceEdges[triangleId], topology.edges, position)];
  } else if (mode === 'face') ids = [triangleId];
  else if (mode === 'connected-region' || mode === 'normal-angle') ids = selectByNormalAngle(mesh, triangleId, normalAngleDegrees);
  else if (mode === 'shell') ids = topology.shells.find((shell) => shell.includes(triangleId)) ?? [triangleId];
  else if (mode === 'connectivity') ids = selectByGeometricConnectivity(mesh, triangleId);
  else {
    kind = 'edge';
    const seed = nearestEdge(mesh, topology.faceEdges[triangleId], topology.edges, position);
    if (mode === 'boundary-loop') ids = selectBoundaryLoop(mesh, seed);
    else if (mode === 'edge-loop') ids = selectEdgeLoop(mesh, seed);
    else ids = selectEdgeRing(mesh, seed);
  }
  return selection(object, kind, ids, mode);
}

export function paintSelect(artifact: ArtifactRecord, object: SceneObject, samples: Vec3[], radiusMm: number): MeshComponentSelection {
  if (!(radiusMm > 0) || !Number.isFinite(radiusMm)) throw new Error('Paint radius must be a finite value greater than zero.');
  const mesh = indexedMesh(artifact.mesh);
  const ids = mesh.faces.flatMap((face, id) => samples.some((sample) => distance3(faceCentroid(mesh, face), sample) <= radiusMm) ? [id] : []);
  return selection(object, 'face', ids, 'paint');
}

export function screenSelect(
  artifact: ArtifactRecord,
  object: SceneObject,
  polygon: Array<{ x: number; y: number }>,
  projector: ScreenProjector,
  mode: 'lasso' | 'rectangle',
): MeshComponentSelection {
  if (polygon.length < 3) throw new Error(`${mode === 'lasso' ? 'Lasso' : 'Rectangle'} selection requires a closed screen region.`);
  const mesh = indexedMesh(artifact.mesh);
  const ids = mesh.faces.flatMap((face, id) => {
    const point = projector.projectWorld(transformPoint(faceCentroid(mesh, face), object));
    return point.visible && pointInPolygon(point, polygon) ? [id] : [];
  });
  return selection(object, 'face', ids, mode);
}

export function growSelection(mesh: IndexedMesh, faceIds: number[], rings = 1): number[] {
  return growComponentSelection(mesh, 'face', faceIds, rings);
}

export function shrinkSelection(mesh: IndexedMesh, faceIds: number[], rings = 1): number[] {
  return shrinkComponentSelection(mesh, 'face', faceIds, rings);
}

export function growComponentSelection(mesh: IndexedMesh, kind: Exclude<ComponentKind, 'object'>, ids: number[], rings = 1): number[] {
  validateComponentSelection(mesh, kind, ids); validateRings(rings); const { neighbors } = componentAdjacency(mesh, kind); const selected = new Set(ids);
  for (let ring = 0; ring < rings; ring += 1) for (const id of [...selected]) for (const neighbor of neighbors[id]) selected.add(neighbor);
  return [...selected].sort((a, b) => a - b);
}

export function shrinkComponentSelection(mesh: IndexedMesh, kind: Exclude<ComponentKind, 'object'>, ids: number[], rings = 1): number[] {
  validateComponentSelection(mesh, kind, ids); validateRings(rings); const { neighbors, domainBoundary } = componentAdjacency(mesh, kind); let selected = new Set(ids);
  for (let ring = 0; ring < rings; ring += 1) {
    const remove = [...selected].filter((id) => domainBoundary.has(id) || neighbors[id].some((neighbor) => !selected.has(neighbor)));
    remove.forEach((id) => selected.delete(id));
  }
  return [...selected].sort((a, b) => a - b);
}

export function invertSelection(mesh: IndexedMesh, kind: Exclude<ComponentKind, 'object'>, ids: number[]): number[] {
  const count = kind === 'vertex' ? mesh.positions.length : kind === 'edge' ? buildTopology(mesh).edges.length : mesh.faces.length;
  const selected = new Set(ids);
  return Array.from({ length: count }, (_, id) => id).filter((id) => !selected.has(id));
}

export function selectByNormalAngle(mesh: IndexedMesh, seedFace: number, angleDegrees: number): number[] {
  if (!mesh.faces[seedFace]) throw new Error(`Face ${seedFace} is unavailable.`);
  if (!Number.isFinite(angleDegrees) || angleDegrees < 0 || angleDegrees > 180) throw new Error('Normal angle must be between 0 and 180 degrees.');
  const topology = buildTopology(mesh);
  const cosine = Math.cos(angleDegrees * Math.PI / 180);
  const selected = new Set([seedFace]);
  const stack = [seedFace];
  while (stack.length) {
    const face = stack.pop()!;
    const normal = faceNormal(mesh, mesh.faces[face]);
    for (const neighbor of topology.faceNeighbors[face]) {
      if (selected.has(neighbor) || dot3(normal, faceNormal(mesh, mesh.faces[neighbor])) < cosine) continue;
      selected.add(neighbor); stack.push(neighbor);
    }
  }
  return [...selected].sort((a, b) => a - b);
}

export function selectByGeometricConnectivity(mesh: IndexedMesh, seedFace: number, toleranceMm = 1e-6): number[] {
  if (!mesh.faces[seedFace]) throw new Error(`Face ${seedFace} is unavailable.`); if (!(toleranceMm > 0) || !Number.isFinite(toleranceMm)) throw new Error('Connectivity tolerance must be a finite millimeter value greater than zero.');
  const byPosition = new Map<string, number[]>();
  mesh.positions.forEach((point, vertex) => { const key = quantizedKey(point, toleranceMm); byPosition.set(key, [...(byPosition.get(key) ?? []), vertex]); });
  const vertexFaces = Array.from({ length: mesh.positions.length }, () => [] as number[]); mesh.faces.forEach((face, id) => face.forEach((vertex) => vertexFaces[vertex].push(id)));
  const selected = new Set([seedFace]); const queue = [seedFace];
  while (queue.length) {
    const face = mesh.faces[queue.shift()!];
    const neighbors = face.flatMap((vertex) => (byPosition.get(quantizedKey(mesh.positions[vertex], toleranceMm)) ?? []).flatMap((candidate) => vertexFaces[candidate]));
    for (const neighbor of neighbors) if (!selected.has(neighbor)) { selected.add(neighbor); queue.push(neighbor); }
  }
  return [...selected].sort((a, b) => a - b);
}

export function selectBoundaryLoop(mesh: IndexedMesh, seedEdge: number): number[] {
  const topology = buildTopology(mesh);
  if (!topology.boundaryEdges.includes(seedEdge)) throw new Error('Boundary-loop selection requires a boundary edge.');
  const loop = boundaryLoops(mesh, topology).find((vertices) => vertices.some((vertex, index) => edgeKey(vertex, vertices[(index + 1) % vertices.length]) === edgeKey(...topology.edges[seedEdge])));
  if (!loop) return [seedEdge];
  const byKey = new Map(topology.edges.map((edge, id) => [edgeKey(...edge), id]));
  return loop.flatMap((vertex, index) => {
    const id = byKey.get(edgeKey(vertex, loop[(index + 1) % loop.length]));
    return id === undefined ? [] : [id];
  }).sort((a, b) => a - b);
}

export function selectEdgeLoop(mesh: IndexedMesh, seedEdge: number): number[] {
  const topology = buildTopology(mesh);
  if (!topology.edges[seedEdge]) throw new Error(`Edge ${seedEdge} is unavailable.`);
  const selected = new Set([seedEdge]);
  const extend = (edgeId: number, vertex: number) => {
    let currentEdge = edgeId;
    let currentVertex = vertex;
    while (true) {
      const current = topology.edges[currentEdge];
      const direction = normalize3(subtract3(mesh.positions[current[1]], mesh.positions[current[0]]));
      const candidates = topology.vertexEdges[currentVertex].filter((id) => id !== currentEdge && !selected.has(id));
      if (!candidates.length) return;
      candidates.sort((a, b) => collinearity(topology.edges[b], currentVertex, mesh, direction) - collinearity(topology.edges[a], currentVertex, mesh, direction) || a - b);
      const next = candidates[0];
      if (collinearity(topology.edges[next], currentVertex, mesh, direction) < 0.5) return;
      selected.add(next);
      currentVertex = topology.edges[next][0] === currentVertex ? topology.edges[next][1] : topology.edges[next][0];
      currentEdge = next;
    }
  };
  extend(seedEdge, topology.edges[seedEdge][0]);
  extend(seedEdge, topology.edges[seedEdge][1]);
  return [...selected].sort((a, b) => a - b);
}

export function selectEdgeRing(mesh: IndexedMesh, seedEdge: number): number[] {
  const topology = buildTopology(mesh);
  if (!topology.edges[seedEdge]) throw new Error(`Edge ${seedEdge} is unavailable.`);
  const selected = new Set([seedEdge]);
  const visitedFaces = new Set<number>();
  const queue = [seedEdge];
  while (queue.length) {
    const edge = queue.shift()!;
    for (const faceId of topology.edgeFaces[edge]) {
      if (visitedFaces.has(faceId)) continue;
      visitedFaces.add(faceId);
      const seedDirection = normalize3(subtract3(mesh.positions[topology.edges[edge][1]], mesh.positions[topology.edges[edge][0]]));
      const candidates = topology.faceEdges[faceId].filter((id) => id !== edge && !selected.has(id));
      candidates.sort((a, b) => parallelism(topology.edges[b], mesh, seedDirection) - parallelism(topology.edges[a], mesh, seedDirection) || a - b);
      const next = candidates[0];
      if (next !== undefined && parallelism(topology.edges[next], mesh, seedDirection) > 0.35) { selected.add(next); queue.push(next); }
    }
  }
  return [...selected].sort((a, b) => a - b);
}

function nearestVertex(mesh: IndexedMesh, face: [number, number, number], position: Vec3): number {
  return [...face].sort((a, b) => distance3(mesh.positions[a], position) - distance3(mesh.positions[b], position) || a - b)[0];
}

function nearestEdge(mesh: IndexedMesh, edgeIds: [number, number, number], edges: Array<[number, number]>, position: Vec3): number {
  return [...edgeIds].sort((a, b) => pointSegmentDistance(position, mesh.positions[edges[a][0]], mesh.positions[edges[a][1]]) - pointSegmentDistance(position, mesh.positions[edges[b][0]], mesh.positions[edges[b][1]]) || a - b)[0];
}

function pointSegmentDistance(point: Vec3, start: Vec3, end: Vec3): number {
  const direction = subtract3(end, start);
  const denominator = dot3(direction, direction);
  const t = denominator ? Math.max(0, Math.min(1, dot3(subtract3(point, start), direction) / denominator)) : 0;
  return distance3(point, [start[0] + direction[0] * t, start[1] + direction[1] * t, start[2] + direction[2] * t]);
}

function collinearity(edge: [number, number], vertex: number, mesh: IndexedMesh, direction: Vec3): number {
  const other = edge[0] === vertex ? edge[1] : edge[0];
  return Math.abs(dot3(normalize3(subtract3(mesh.positions[other], mesh.positions[vertex])), direction));
}

function parallelism(edge: [number, number], mesh: IndexedMesh, direction: Vec3): number {
  return Math.abs(dot3(normalize3(subtract3(mesh.positions[edge[1]], mesh.positions[edge[0]])), direction));
}

function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let first = 0, second = polygon.length - 1; first < polygon.length; second = first++) {
    const a = polygon[first]; const b = polygon[second];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x) inside = !inside;
  }
  return inside;
}

function selection(object: SceneObject, kind: ComponentKind, ids: number[], mode: ComponentSelectionMode): MeshComponentSelection {
  return { objectId: object.id, artifactId: object.artifactId, kind, ids: unique(ids), mode, updatedAt: new Date().toISOString() };
}

function validateComponentSelection(mesh: IndexedMesh, kind: Exclude<ComponentKind, 'object'>, ids: number[]): void { const topology = buildTopology(mesh); const count = kind === 'vertex' ? mesh.positions.length : kind === 'edge' ? topology.edges.length : mesh.faces.length; if (!ids.length) throw new Error(`${kind} selection is required.`); if (ids.some((id) => !Number.isInteger(id) || id < 0 || id >= count)) throw new Error(`${kind} selection contains an invalid element identifier.`); }
function validateRings(rings: number): void { if (!Number.isInteger(rings) || rings < 1 || rings > 50) throw new Error('Selection ring count must be an integer from 1 to 50.'); }

function componentAdjacency(mesh: IndexedMesh, kind: Exclude<ComponentKind, 'object'>): { neighbors: number[][]; domainBoundary: Set<number> } {
  const topology = buildTopology(mesh);
  if (kind === 'face') return { neighbors: topology.faceNeighbors, domainBoundary: new Set(topology.boundaryEdges.flatMap((edge) => topology.edgeFaces[edge])) };
  if (kind === 'vertex') return { neighbors: topology.vertexEdges.map((edges, vertex) => unique(edges.flatMap((edge) => topology.edges[edge]).filter((id) => id !== vertex))), domainBoundary: new Set(topology.boundaryEdges.flatMap((edge) => topology.edges[edge])) };
  return { neighbors: topology.edges.map(([a, b], edge) => unique([...topology.vertexEdges[a], ...topology.vertexEdges[b]].filter((id) => id !== edge))), domainBoundary: new Set(topology.boundaryEdges) };
}

function unique(values: number[]): number[] { return [...new Set(values)].sort((a, b) => a - b); }
