import type { MeshData, Vec3 } from './core';
import { add3, boundsOfPoints, cross3, distance3, dot3, length3, normalize3, scale3, subtract3 } from './geometry';
import type { GeometryInspection } from './editing-types';

export type Face = [number, number, number];
export type Edge = [number, number];

export interface IndexedMesh {
  positions: Vec3[];
  faces: Face[];
}

export type TriangleIntersectionClassification =
  | 'non-coplanar-crossing'
  | 'coplanar-overlap'
  | 'shared-vertex-crossing'
  | 'shared-edge-fold-through'
  | 'bow-tie-topology'
  | 'degenerate-point-contact'
  | 'degenerate-edge-contact'
  | 'legitimate-shared-vertex'
  | 'legitimate-shared-edge';

export interface TriangleIntersectionRecord {
  triangleIds: [number, number];
  classification: TriangleIntersectionClassification;
  topology: 'independent' | 'shared-vertex' | 'shared-edge' | 'duplicate';
  geometry: 'point' | 'segment' | 'area' | 'topology';
  points: Vec3[];
  invalid: boolean;
  objectId: string | null;
  explanation: string;
}

export interface MeshTopology {
  edges: Edge[];
  edgeFaces: number[][];
  faceEdges: [number, number, number][];
  vertexFaces: number[][];
  vertexEdges: number[][];
  faceNeighbors: number[][];
  boundaryEdges: number[];
  nonManifoldEdges: number[];
  shells: number[][];
}

const EPSILON = 1e-9;

export function indexedMesh(mesh: MeshData): IndexedMesh {
  const source = mesh.sourceTopology ?? { positions: mesh.positions, indices: mesh.indices };
  if (source.positions.length % 3 !== 0) throw new Error('Geometry positions are not complete XYZ tuples.');
  if (source.indices.length % 3 !== 0) throw new Error('Geometry indices are not complete triangles.');
  const positions: Vec3[] = [];
  for (let offset = 0; offset < source.positions.length; offset += 3) {
    const point: Vec3 = [source.positions[offset], source.positions[offset + 1], source.positions[offset + 2]];
    if (!point.every(Number.isFinite)) throw new Error(`Geometry vertex ${offset / 3} contains an invalid coordinate.`);
    positions.push(point);
  }
  const faces: Face[] = [];
  for (let offset = 0; offset < source.indices.length; offset += 3) {
    const face: Face = [source.indices[offset], source.indices[offset + 1], source.indices[offset + 2]];
    if (!face.every((index) => Number.isInteger(index) && index >= 0 && index < positions.length)) throw new Error(`Geometry face ${offset / 3} contains an invalid vertex reference.`);
    faces.push(face);
  }
  return { positions, faces };
}

export function meshData(mesh: IndexedMesh): MeshData {
  validateFiniteMesh(mesh);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (const face of mesh.faces) {
    const normal = faceNormal(mesh, face);
    for (const index of face) {
      positions.push(...mesh.positions[index].map(canonicalZero));
      normals.push(...normal.map(canonicalZero));
      indices.push(indices.length);
    }
  }
  const bounds = boundsOfPoints(mesh.positions) ?? { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 };
  return {
    positions,
    normals,
    indices,
    bounds,
    sourceTopology: { positions: mesh.positions.flat(), indices: mesh.faces.flat() },
  };
}

function canonicalZero(value: number): number { return value === 0 ? 0 : value; }

export function cloneIndexed(mesh: IndexedMesh): IndexedMesh {
  return { positions: mesh.positions.map((point) => [...point]), faces: mesh.faces.map((face) => [...face]) };
}

export function buildTopology(mesh: IndexedMesh): MeshTopology {
  const edgeByKey = new Map<string, number>();
  const edges: Edge[] = [];
  const edgeFaces: number[][] = [];
  const faceEdges: [number, number, number][] = [];
  const vertexFaces = Array.from({ length: mesh.positions.length }, () => [] as number[]);
  const vertexEdges = Array.from({ length: mesh.positions.length }, () => [] as number[]);
  for (let faceId = 0; faceId < mesh.faces.length; faceId += 1) {
    const face = mesh.faces[faceId];
    const pairs: Edge[] = [[face[0], face[1]], [face[1], face[2]], [face[2], face[0]]];
    const ids = pairs.map(([a, b]) => {
      const key = edgeKey(a, b);
      let id = edgeByKey.get(key);
      if (id === undefined) {
        id = edges.length;
        edgeByKey.set(key, id);
        edges.push(a < b ? [a, b] : [b, a]);
        edgeFaces.push([]);
        vertexEdges[a].push(id);
        vertexEdges[b].push(id);
      }
      edgeFaces[id].push(faceId);
      return id;
    }) as [number, number, number];
    faceEdges.push(ids);
    for (const vertex of face) vertexFaces[vertex].push(faceId);
  }
  const faceNeighbors = Array.from({ length: mesh.faces.length }, () => [] as number[]);
  edgeFaces.forEach((faces) => {
    for (const face of faces) for (const neighbor of faces) if (face !== neighbor && !faceNeighbors[face].includes(neighbor)) faceNeighbors[face].push(neighbor);
  });
  faceNeighbors.forEach((neighbors) => neighbors.sort((a, b) => a - b));
  const shells = connectedComponents(mesh.faces.length, faceNeighbors);
  return {
    edges,
    edgeFaces,
    faceEdges,
    vertexFaces,
    vertexEdges,
    faceNeighbors,
    boundaryEdges: edgeFaces.flatMap((faces, id) => faces.length === 1 ? [id] : []),
    nonManifoldEdges: edgeFaces.flatMap((faces, id) => faces.length > 2 ? [id] : []),
    shells,
  };
}

export function faceNormal(mesh: IndexedMesh, face: Face): Vec3 {
  return normalize3(cross3(subtract3(mesh.positions[face[1]], mesh.positions[face[0]]), subtract3(mesh.positions[face[2]], mesh.positions[face[0]])));
}

export function faceArea(mesh: IndexedMesh, face: Face): number {
  return length3(cross3(subtract3(mesh.positions[face[1]], mesh.positions[face[0]]), subtract3(mesh.positions[face[2]], mesh.positions[face[0]]))) * 0.5;
}

export function faceCentroid(mesh: IndexedMesh, face: Face): Vec3 {
  return scale3(add3(add3(mesh.positions[face[0]], mesh.positions[face[1]]), mesh.positions[face[2]]), 1 / 3);
}

export function vertexNormals(mesh: IndexedMesh): Vec3[] {
  const sums = Array.from({ length: mesh.positions.length }, () => [0, 0, 0] as Vec3);
  for (const face of mesh.faces) {
    const weighted = cross3(subtract3(mesh.positions[face[1]], mesh.positions[face[0]]), subtract3(mesh.positions[face[2]], mesh.positions[face[0]]));
    for (const vertex of face) sums[vertex] = add3(sums[vertex], weighted);
  }
  return sums.map(normalize3);
}

export function boundaryLoops(mesh: IndexedMesh, topology = buildTopology(mesh)): number[][] {
  const adjacency = new Map<number, number[]>();
  for (const edgeId of topology.boundaryEdges) {
    const [a, b] = topology.edges[edgeId];
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  }
  const unused = new Set(topology.boundaryEdges.map((edgeId) => edgeKey(...topology.edges[edgeId])));
  const loops: number[][] = [];
  while (unused.size) {
    const firstKey = [...unused].sort()[0];
    const [start, next] = firstKey.split(':').map(Number) as Edge;
    const loop = [start];
    let previous = start;
    let current = next;
    unused.delete(firstKey);
    while (current !== start && loop.length <= topology.boundaryEdges.length + 1) {
      loop.push(current);
      const candidates = (adjacency.get(current) ?? []).filter((candidate) => candidate !== previous && unused.has(edgeKey(current, candidate))).sort((a, b) => a - b);
      if (!candidates.length) break;
      const candidate = candidates[0];
      unused.delete(edgeKey(current, candidate));
      previous = current;
      current = candidate;
    }
    if (loop.length >= 2) loops.push(loop);
  }
  return loops.sort((a, b) => a[0] - b[0]);
}

export function inspectGeometry(mesh: IndexedMesh): GeometryInspection {
  validateFiniteMesh(mesh);
  const topology = buildTopology(mesh);
  const area = mesh.faces.reduce((sum, face) => sum + faceArea(mesh, face), 0);
  const watertight = mesh.faces.length > 0 && topology.boundaryEdges.length === 0 && topology.nonManifoldEdges.length === 0 && mesh.faces.every((face) => faceArea(mesh, face) > EPSILON);
  const signedVolume = watertight
    ? mesh.faces.reduce((sum, face) => sum + dot3(mesh.positions[face[0]], cross3(mesh.positions[face[1]], mesh.positions[face[2]])) / 6, 0)
    : null;
  const bounds = boundsOfPoints(mesh.positions) ?? { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 };
  return {
    vertexCount: mesh.positions.length,
    triangleCount: mesh.faces.length,
    boundaryEdgeCount: topology.boundaryEdges.length,
    nonManifoldEdgeCount: topology.nonManifoldEdges.length,
    shellCount: topology.shells.filter((shell) => shell.length).length,
    surfaceAreaMm2: area,
    volumeMm3: signedVolume === null ? null : Math.abs(signedVolume),
    watertight,
    boundingDimensionsMm: subtract3(bounds.max, bounds.min),
    selfIntersectionCount: detectSelfIntersections(mesh).length,
  };
}

export function validateGeometryResult(mesh: IndexedMesh, options: { allowEmpty?: boolean; allowBoundaries?: boolean; allowDisconnected?: boolean } = {}): GeometryInspection {
  validateFiniteMesh(mesh);
  if (!options.allowEmpty && (!mesh.positions.length || !mesh.faces.length)) throw new Error('Geometry operation produced empty output.');
  const degenerate = mesh.faces.flatMap((face, id) => new Set(face).size < 3 || faceArea(mesh, face) <= EPSILON ? [id] : []);
  if (degenerate.length) throw new Error(`Geometry operation produced ${degenerate.length} degenerate triangle${degenerate.length === 1 ? '' : 's'}.`);
  const topology = buildTopology(mesh);
  if (topology.nonManifoldEdges.length) throw new Error(`Geometry operation produced ${topology.nonManifoldEdges.length} non-manifold edge${topology.nonManifoldEdges.length === 1 ? '' : 's'}.`);
  if (!options.allowBoundaries && topology.boundaryEdges.length) throw new Error(`Geometry operation produced ${topology.boundaryEdges.length} open boundary edge${topology.boundaryEdges.length === 1 ? '' : 's'}.`);
  if (!options.allowDisconnected && topology.shells.length > 1) throw new Error(`Geometry operation produced ${topology.shells.length} disconnected components.`);
  const intersections = analyzeSelfIntersections(mesh);
  if (intersections.length) {
    const first = intersections[0];
    throw new Error(`Geometry operation produced ${intersections.length} self-intersecting triangle pair${intersections.length === 1 ? '' : 's'}; first ${first.classification} at triangles ${first.triangleIds.join('/')} near ${JSON.stringify(first.points)} (${first.explanation})`);
  }
  return inspectGeometry(mesh);
}

export function detectSelfIntersections(mesh: IndexedMesh): Array<[number, number]> {
  return analyzeSelfIntersections(mesh).map(({ triangleIds }) => triangleIds);
}

export function analyzeSelfIntersections(mesh: IndexedMesh, objectId: string | null = null): TriangleIntersectionRecord[] {
  if (mesh.faces.length < 2) return [];
  const boxes = mesh.faces.map((face) => triangleBounds(mesh, face));
  const order = mesh.faces.map((_, id) => id).sort((a, b) => boxes[a].min[0] - boxes[b].min[0] || a - b);
  const results: TriangleIntersectionRecord[] = [];
  for (let left = 0; left < order.length; left += 1) {
    const firstId = order[left];
    for (let right = left + 1; right < order.length; right += 1) {
      const secondId = order[right];
      if (boxes[secondId].min[0] > boxes[firstId].max[0] + EPSILON) break;
      if (!boxesOverlap(boxes[firstId], boxes[secondId])) continue;
      const result = classifyTrianglePairIntersection(mesh, firstId, secondId, objectId);
      if (result?.invalid) results.push(result);
    }
  }
  results.push(...detectBowTieTopology(mesh, objectId, new Set(results.map(({ triangleIds }) => triangleIds.join(':')))));
  return results.sort((first, second) => first.triangleIds[0] - second.triangleIds[0] || first.triangleIds[1] - second.triangleIds[1] || first.classification.localeCompare(second.classification));
}

export function classifyTrianglePairIntersection(mesh: IndexedMesh, firstId: number, secondId: number, objectId: string | null = null): TriangleIntersectionRecord | null {
  if (firstId === secondId || !mesh.faces[firstId] || !mesh.faces[secondId]) throw new Error('Triangle-pair classification requires two distinct valid triangle identifiers.');
  const ids: [number, number] = firstId < secondId ? [firstId, secondId] : [secondId, firstId];
  const firstFace = mesh.faces[ids[0]], secondFace = mesh.faces[ids[1]];
  const first = firstFace.map((id) => mesh.positions[id]) as [Vec3, Vec3, Vec3];
  const second = secondFace.map((id) => mesh.positions[id]) as [Vec3, Vec3, Vec3];
  if (first.some((point) => !point) || second.some((point) => !point)) throw new Error('Triangle-pair classification encountered an invalid vertex reference.');
  const shared = firstFace.filter((vertex) => secondFace.includes(vertex));
  const topology = shared.length >= 3 ? 'duplicate' : shared.length === 2 ? 'shared-edge' : shared.length === 1 ? 'shared-vertex' : 'independent';
  const contact = triangleContact(first, second);
  if (!contact) return null;
  const sharedPoints = shared.map((vertex) => mesh.positions[vertex]);
  const confinedToShared = contact.points.every((point) => sharedPoints.some((sharedPoint) => distance3(point, sharedPoint) <= contact.tolerance));

  if (topology === 'shared-vertex' && contact.geometry === 'point' && confinedToShared) {
    return intersectionRecord(ids, 'legitimate-shared-vertex', topology, contact.geometry, contact.points, false, objectId, 'The triangles meet only at their shared topology vertex.');
  }
  if (topology === 'shared-edge') {
    const onlySharedEdge = contact.geometry === 'segment' && contact.points.length >= 2 && contact.points.every((point) => pointOnSegment3(point, sharedPoints[0], sharedPoints[1], contact.tolerance));
    const oppositeTraversal = directedEdgeSign(firstFace, shared[0], shared[1]) === -directedEdgeSign(secondFace, shared[0], shared[1]);
    if (onlySharedEdge) return intersectionRecord(ids, 'legitimate-shared-edge', topology, contact.geometry, contact.points, false, objectId, oppositeTraversal ? 'The triangles meet only along a consistently oriented shared topology edge.' : 'The triangles meet only along their shared topology edge; winding consistency is reported by the separate topology check.');
    return intersectionRecord(ids, 'shared-edge-fold-through', topology, contact.geometry, contact.points, true, objectId, 'The triangles overlap beyond their shared topology edge.');
  }
  if (topology === 'shared-vertex') return intersectionRecord(ids, 'shared-vertex-crossing', topology, contact.geometry, contact.points, true, objectId, 'The triangles intersect beyond their single shared topology vertex.');
  if (topology === 'duplicate' || contact.geometry === 'area') return intersectionRecord(ids, 'coplanar-overlap', topology, contact.geometry, contact.points, true, objectId, 'The triangles overlap across a positive-area coplanar region.');
  if (contact.geometry === 'point') return intersectionRecord(ids, 'degenerate-point-contact', topology, contact.geometry, contact.points, true, objectId, 'Independent triangles make an isolated point contact that is not represented by shared topology.');
  if (contact.coplanar) return intersectionRecord(ids, 'degenerate-edge-contact', topology, contact.geometry, contact.points, true, objectId, 'Independent coplanar triangles contact along an edge without shared topology.');
  return intersectionRecord(ids, 'non-coplanar-crossing', topology, contact.geometry, contact.points, true, objectId, 'Independent non-coplanar triangles cross in model space.');
}

export function compactMesh(mesh: IndexedMesh): { mesh: IndexedMesh; vertexMap: Record<number, number> } {
  const used = new Set(mesh.faces.flat());
  const vertexMap: Record<number, number> = {};
  const positions: Vec3[] = [];
  [...used].sort((a, b) => a - b).forEach((oldId) => { vertexMap[oldId] = positions.length; positions.push([...mesh.positions[oldId]]); });
  return { mesh: { positions, faces: mesh.faces.map((face) => face.map((id) => vertexMap[id]) as Face) }, vertexMap };
}

export function mergeIndexed(meshes: IndexedMesh[]): IndexedMesh {
  const positions: Vec3[] = [];
  const faces: Face[] = [];
  for (const mesh of meshes) {
    const offset = positions.length;
    positions.push(...mesh.positions.map((point) => [...point] as Vec3));
    faces.push(...mesh.faces.map((face) => face.map((id) => id + offset) as Face));
  }
  return { positions, faces };
}

export function triangulatePolygon(points: Vec3[]): Face[] {
  if (points.length < 3) throw new Error('Polygon triangulation requires at least three vertices.');
  const normal: Vec3 = [0, 0, 0];
  for (let index = 0; index < points.length; index += 1) { const current = points[index], next = points[(index + 1) % points.length]; normal[0] += (current[1] - next[1]) * (current[2] + next[2]); normal[1] += (current[2] - next[2]) * (current[0] + next[0]); normal[2] += (current[0] - next[0]) * (current[1] + next[1]); }
  if (length3(normal) <= EPSILON) throw new Error('Polygon boundary is planar-degenerate and cannot be triangulated.');
  const drop = Math.abs(normal[0]) >= Math.abs(normal[1]) && Math.abs(normal[0]) >= Math.abs(normal[2]) ? 0 : Math.abs(normal[1]) >= Math.abs(normal[2]) ? 1 : 2;
  const projected = points.map((point) => drop === 0 ? [point[1], point[2]] as [number, number] : drop === 1 ? [point[0], point[2]] as [number, number] : [point[0], point[1]] as [number, number]);
  const signedArea = projected.reduce((sum, point, index) => { const next = projected[(index + 1) % projected.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0); if (Math.abs(signedArea) <= EPSILON) throw new Error('Polygon projection has zero area.'); const orientation = Math.sign(signedArea);
  const remaining = points.map((_, index) => index); const faces: Face[] = []; let guard = points.length * points.length;
  while (remaining.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let offset = 0; offset < remaining.length; offset += 1) {
      const previous = remaining[(offset - 1 + remaining.length) % remaining.length], current = remaining[offset], next = remaining[(offset + 1) % remaining.length];
      if (cross2(projected[previous], projected[current], projected[next]) * orientation <= EPSILON) continue;
      if (remaining.some((candidate) => candidate !== previous && candidate !== current && candidate !== next && pointInTriangleProjected(projected[candidate], projected[previous], projected[current], projected[next]))) continue;
      faces.push([previous, current, next]); remaining.splice(offset, 1); clipped = true; break;
    }
    if (!clipped) throw new Error('Polygon boundary is self-intersecting or cannot be triangulated without degeneracy.');
  }
  if (remaining.length !== 3) throw new Error('Polygon triangulation did not produce a complete result.'); faces.push([remaining[0], remaining[1], remaining[2]]); return faces;
}

export function edgeKey(a: number, b: number): string { return `${Math.min(a, b)}:${Math.max(a, b)}`; }

export function quantizedKey(point: Vec3, tolerance: number): string {
  const safe = Math.max(tolerance, Number.EPSILON);
  return `${Math.round(point[0] / safe)}:${Math.round(point[1] / safe)}:${Math.round(point[2] / safe)}`;
}

export function connectedComponents(count: number, neighbors: number[][]): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];
  for (let seed = 0; seed < count; seed += 1) {
    if (visited.has(seed)) continue;
    const component: number[] = [];
    const stack = [seed];
    visited.add(seed);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const neighbor of neighbors[current] ?? []) if (!visited.has(neighbor)) { visited.add(neighbor); stack.push(neighbor); }
    }
    components.push(component.sort((a, b) => a - b));
  }
  return components.sort((a, b) => a[0] - b[0]);
}

function validateFiniteMesh(mesh: IndexedMesh): void {
  for (let id = 0; id < mesh.positions.length; id += 1) if (!mesh.positions[id].every(Number.isFinite)) throw new Error(`Geometry vertex ${id} contains an invalid coordinate.`);
  for (let id = 0; id < mesh.faces.length; id += 1) if (!mesh.faces[id].every((vertex) => Number.isInteger(vertex) && vertex >= 0 && vertex < mesh.positions.length)) throw new Error(`Geometry face ${id} contains an invalid vertex reference.`);
}

function cross2(a: [number, number], b: [number, number], c: [number, number]): number { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function pointInTriangleProjected(point: [number, number], a: [number, number], b: [number, number], c: [number, number]): boolean { const values = [cross2(a, b, point), cross2(b, c, point), cross2(c, a, point)]; return !(values.some((value) => value < -EPSILON) && values.some((value) => value > EPSILON)); }

function triangleBounds(mesh: IndexedMesh, face: Face) {
  const points = face.map((id) => mesh.positions[id]);
  return {
    min: [Math.min(...points.map((point) => point[0])), Math.min(...points.map((point) => point[1])), Math.min(...points.map((point) => point[2]))] as Vec3,
    max: [Math.max(...points.map((point) => point[0])), Math.max(...points.map((point) => point[1])), Math.max(...points.map((point) => point[2]))] as Vec3,
  };
}

function boxesOverlap(first: { min: Vec3; max: Vec3 }, second: { min: Vec3; max: Vec3 }): boolean {
  return [0, 1, 2].every((axis) => first.min[axis] <= second.max[axis] + EPSILON && second.min[axis] <= first.max[axis] + EPSILON);
}

interface TriangleContact {
  geometry: 'point' | 'segment' | 'area';
  points: Vec3[];
  coplanar: boolean;
  tolerance: number;
}

interface ProjectedVertex { uv: [number, number]; point: Vec3; }

function triangleContact(first: [Vec3, Vec3, Vec3], second: [Vec3, Vec3, Vec3]): TriangleContact | null {
  const all = [...first, ...second];
  const bounds = boundsOfPoints(all)!;
  const tolerance = Math.max(EPSILON, length3(subtract3(bounds.max, bounds.min)) * 1e-9);
  const firstNormal = cross3(subtract3(first[1], first[0]), subtract3(first[2], first[0]));
  const secondNormal = cross3(subtract3(second[1], second[0]), subtract3(second[2], second[0]));
  const firstLength = length3(firstNormal), secondLength = length3(secondNormal);
  if (firstLength <= tolerance * tolerance || secondLength <= tolerance * tolerance) return null;
  const parallel = length3(cross3(firstNormal, secondNormal)) <= firstLength * secondLength * 1e-9;
  if (parallel) {
    const unit = scale3(firstNormal, 1 / firstLength);
    if (second.some((point) => Math.abs(dot3(subtract3(point, first[0]), unit)) > tolerance)) return null;
    return coplanarTriangleContact(first, second, unit, tolerance);
  }
  const points: Vec3[] = [];
  collectTrianglePlaneContacts(first, second, secondNormal, tolerance, points);
  collectTrianglePlaneContacts(second, first, firstNormal, tolerance, points);
  const unique = deduplicateContactPoints(points, tolerance);
  if (!unique.length) return null;
  const pair = farthestPair(unique);
  return pair && pair.distance > tolerance
    ? { geometry: 'segment', points: [pair.first, pair.second], coplanar: false, tolerance }
    : { geometry: 'point', points: [unique[0]], coplanar: false, tolerance };
}

function coplanarTriangleContact(first: [Vec3, Vec3, Vec3], second: [Vec3, Vec3, Vec3], normal: Vec3, tolerance: number): TriangleContact | null {
  const drop = dominantAxis(normal);
  const project = (point: Vec3): [number, number] => drop === 0 ? [point[1], point[2]] : drop === 1 ? [point[0], point[2]] : [point[0], point[1]];
  const firstProjected = first.map((point) => ({ uv: project(point), point })) as [ProjectedVertex, ProjectedVertex, ProjectedVertex];
  const secondProjected = second.map((point) => ({ uv: project(point), point })) as [ProjectedVertex, ProjectedVertex, ProjectedVertex];
  const clipped = clipProjectedTriangle(firstProjected, secondProjected, tolerance);
  const area = Math.abs(projectedPolygonArea(clipped.map(({ uv }) => uv)));
  const characteristicLength = Math.max(...[...first, ...second].flatMap((point, index, values) => values.slice(index + 1).map((other) => distance3(point, other))), tolerance);
  if (area > tolerance * characteristicLength * 4) return { geometry: 'area', points: deduplicateContactPoints(clipped.map(({ point }) => point), tolerance), coplanar: true, tolerance };

  const contacts: Vec3[] = [];
  for (const vertex of firstProjected) if (pointInTriangle2(vertex.uv, secondProjected.map(({ uv }) => uv) as [[number, number], [number, number], [number, number]], tolerance)) contacts.push(vertex.point);
  for (const vertex of secondProjected) if (pointInTriangle2(vertex.uv, firstProjected.map(({ uv }) => uv) as [[number, number], [number, number], [number, number]], tolerance)) contacts.push(vertex.point);
  for (let firstEdge = 0; firstEdge < 3; firstEdge += 1) for (let secondEdge = 0; secondEdge < 3; secondEdge += 1) {
    const a = firstProjected[firstEdge], b = firstProjected[(firstEdge + 1) % 3], c = secondProjected[secondEdge], d = secondProjected[(secondEdge + 1) % 3];
    for (const amount of segmentContactParameters2(a.uv, b.uv, c.uv, d.uv, tolerance)) contacts.push(add3(a.point, scale3(subtract3(b.point, a.point), amount)));
  }
  const unique = deduplicateContactPoints(contacts, tolerance);
  if (!unique.length) return null;
  const pair = farthestPair(unique);
  return pair && pair.distance > tolerance
    ? { geometry: 'segment', points: [pair.first, pair.second], coplanar: true, tolerance }
    : { geometry: 'point', points: [unique[0]], coplanar: true, tolerance };
}

function clipProjectedTriangle(subject: [ProjectedVertex, ProjectedVertex, ProjectedVertex], clip: [ProjectedVertex, ProjectedVertex, ProjectedVertex], tolerance: number): ProjectedVertex[] {
  let output: ProjectedVertex[] = subject.map(({ uv, point }) => ({ uv: [...uv], point: [...point] }));
  const orientation = Math.sign(projectedPolygonArea(clip.map(({ uv }) => uv))) || 1;
  for (let edge = 0; edge < 3 && output.length; edge += 1) {
    const start = clip[edge].uv, end = clip[(edge + 1) % 3].uv;
    const input = output; output = [];
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index], next = input[(index + 1) % input.length];
      const currentDistance = cross2(start, end, current.uv) * orientation;
      const nextDistance = cross2(start, end, next.uv) * orientation;
      const currentInside = currentDistance >= -tolerance, nextInside = nextDistance >= -tolerance;
      if (currentInside) output.push(current);
      if (currentInside !== nextInside) {
        const amount = currentDistance / (currentDistance - nextDistance);
        output.push({ uv: [current.uv[0] + (next.uv[0] - current.uv[0]) * amount, current.uv[1] + (next.uv[1] - current.uv[1]) * amount], point: add3(current.point, scale3(subtract3(next.point, current.point), amount)) });
      }
    }
  }
  return output;
}

function collectTrianglePlaneContacts(source: [Vec3, Vec3, Vec3], target: [Vec3, Vec3, Vec3], targetNormal: Vec3, tolerance: number, output: Vec3[]): void {
  const unit = normalize3(targetNormal);
  const distances = source.map((point) => dot3(subtract3(point, target[0]), unit));
  for (let index = 0; index < 3; index += 1) {
    const next = (index + 1) % 3, firstDistance = distances[index], secondDistance = distances[next];
    if (Math.abs(firstDistance) <= tolerance && pointInTriangle3(source[index], target, tolerance)) output.push(source[index]);
    if (firstDistance * secondDistance < -tolerance * tolerance) {
      const amount = firstDistance / (firstDistance - secondDistance);
      const point = add3(source[index], scale3(subtract3(source[next], source[index]), amount));
      if (pointInTriangle3(point, target, tolerance)) output.push(point);
    } else if (Math.abs(firstDistance) <= tolerance && Math.abs(secondDistance) <= tolerance) {
      if (pointInTriangle3(source[next], target, tolerance)) output.push(source[next]);
    }
  }
}

function pointInTriangle3(point: Vec3, triangle: [Vec3, Vec3, Vec3], tolerance: number): boolean {
  const first = subtract3(triangle[1], triangle[0]), second = subtract3(triangle[2], triangle[0]), relative = subtract3(point, triangle[0]);
  const aa = dot3(first, first), ab = dot3(first, second), bb = dot3(second, second), ar = dot3(first, relative), br = dot3(second, relative);
  const denominator = aa * bb - ab * ab;
  if (Math.abs(denominator) <= tolerance * tolerance) return false;
  const u = (bb * ar - ab * br) / denominator, v = (aa * br - ab * ar) / denominator;
  const barycentricTolerance = tolerance / Math.max(Math.sqrt(aa), Math.sqrt(bb), tolerance);
  return u >= -barycentricTolerance && v >= -barycentricTolerance && u + v <= 1 + barycentricTolerance;
}

function segmentContactParameters2(a: [number, number], b: [number, number], c: [number, number], d: [number, number], tolerance: number): number[] {
  const direction = [b[0] - a[0], b[1] - a[1]] as [number, number], other = [d[0] - c[0], d[1] - c[1]] as [number, number];
  const denominator = direction[0] * other[1] - direction[1] * other[0];
  const offset = [c[0] - a[0], c[1] - a[1]] as [number, number];
  if (Math.abs(denominator) > tolerance) {
    const amount = (offset[0] * other[1] - offset[1] * other[0]) / denominator;
    const otherAmount = (offset[0] * direction[1] - offset[1] * direction[0]) / denominator;
    return amount >= -tolerance && amount <= 1 + tolerance && otherAmount >= -tolerance && otherAmount <= 1 + tolerance ? [Math.max(0, Math.min(1, amount))] : [];
  }
  if (Math.abs(offset[0] * direction[1] - offset[1] * direction[0]) > tolerance) return [];
  const lengthSquared = direction[0] ** 2 + direction[1] ** 2;
  if (lengthSquared <= tolerance * tolerance) return [];
  const first = (offset[0] * direction[0] + offset[1] * direction[1]) / lengthSquared;
  const second = first + (other[0] * direction[0] + other[1] * direction[1]) / lengthSquared;
  const low = Math.max(0, Math.min(first, second)), high = Math.min(1, Math.max(first, second));
  if (low > high + tolerance) return [];
  return Math.abs(high - low) <= tolerance ? [(low + high) / 2] : [low, high];
}

function pointInTriangle2(point: [number, number], triangle: [[number, number], [number, number], [number, number]], tolerance: number): boolean {
  const values = [cross2(triangle[0], triangle[1], point), cross2(triangle[1], triangle[2], point), cross2(triangle[2], triangle[0], point)];
  return !(values.some((value) => value < -tolerance) && values.some((value) => value > tolerance));
}

function projectedPolygonArea(points: Array<[number, number]>): number {
  return points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0) * 0.5;
}

function dominantAxis(normal: Vec3): number {
  return Math.abs(normal[0]) >= Math.abs(normal[1]) && Math.abs(normal[0]) >= Math.abs(normal[2]) ? 0 : Math.abs(normal[1]) >= Math.abs(normal[2]) ? 1 : 2;
}

function deduplicateContactPoints(points: Vec3[], tolerance: number): Vec3[] {
  const values: Vec3[] = [];
  for (const point of points) if (!values.some((existing) => distance3(existing, point) <= tolerance)) values.push([...point]);
  return values;
}

function farthestPair(points: Vec3[]): { first: Vec3; second: Vec3; distance: number } | null {
  let result: { first: Vec3; second: Vec3; distance: number } | null = null;
  for (let first = 0; first < points.length; first += 1) for (let second = first + 1; second < points.length; second += 1) {
    const distance = distance3(points[first], points[second]);
    if (!result || distance > result.distance) result = { first: points[first], second: points[second], distance };
  }
  return result;
}

function pointOnSegment3(point: Vec3, start: Vec3, end: Vec3, tolerance: number): boolean {
  const segment = subtract3(end, start), lengthSquared = dot3(segment, segment);
  if (lengthSquared <= tolerance * tolerance) return distance3(point, start) <= tolerance;
  const amount = dot3(subtract3(point, start), segment) / lengthSquared;
  if (amount < -tolerance || amount > 1 + tolerance) return false;
  return distance3(point, add3(start, scale3(segment, amount))) <= tolerance;
}

function directedEdgeSign(face: Face, first: number, second: number): number {
  for (let index = 0; index < 3; index += 1) {
    const next = (index + 1) % 3;
    if (face[index] === first && face[next] === second) return 1;
    if (face[index] === second && face[next] === first) return -1;
  }
  return 0;
}

function intersectionRecord(triangleIds: [number, number], classification: TriangleIntersectionClassification, topology: TriangleIntersectionRecord['topology'], geometry: TriangleIntersectionRecord['geometry'], points: Vec3[], invalid: boolean, objectId: string | null, explanation: string): TriangleIntersectionRecord {
  return { triangleIds, classification, topology, geometry, points: points.map((point) => [...point]), invalid, objectId, explanation };
}

function detectBowTieTopology(mesh: IndexedMesh, objectId: string | null, existingPairs: Set<string>): TriangleIntersectionRecord[] {
  const topology = buildTopology(mesh);
  const results: TriangleIntersectionRecord[] = [];
  for (let vertex = 0; vertex < topology.vertexFaces.length; vertex += 1) {
    const incident = topology.vertexFaces[vertex];
    if (incident.length < 2) continue;
    const incidentSet = new Set(incident);
    const neighbors = new Map<number, number[]>();
    for (const faceId of incident) {
      const connected = topology.faceNeighbors[faceId].filter((neighbor) => incidentSet.has(neighbor) && mesh.faces[faceId].filter((id) => mesh.faces[neighbor].includes(id)).includes(vertex));
      neighbors.set(faceId, connected);
    }
    const unvisited = new Set(incident); const components: number[][] = [];
    while (unvisited.size) {
      const seed = Math.min(...unvisited); const component: number[] = []; const stack = [seed]; unvisited.delete(seed);
      while (stack.length) { const current = stack.pop()!; component.push(current); for (const neighbor of neighbors.get(current) ?? []) if (unvisited.delete(neighbor)) stack.push(neighbor); }
      components.push(component.sort((a, b) => a - b));
    }
    for (let index = 1; index < components.length; index += 1) {
      const triangleIds = [components[0][0], components[index][0]].sort((a, b) => a - b) as [number, number];
      const key = triangleIds.join(':'); if (existingPairs.has(key)) continue; existingPairs.add(key);
      results.push(intersectionRecord(triangleIds, 'bow-tie-topology', 'shared-vertex', 'topology', [mesh.positions[vertex]], true, objectId, `Vertex ${vertex} joins disconnected triangle fans and forms bow-tie topology.`));
    }
  }
  return results;
}

export function averageEdgeLength(mesh: IndexedMesh): number {
  const topology = buildTopology(mesh);
  return topology.edges.length ? topology.edges.reduce((sum, [a, b]) => sum + distance3(mesh.positions[a], mesh.positions[b]), 0) / topology.edges.length : 0;
}
