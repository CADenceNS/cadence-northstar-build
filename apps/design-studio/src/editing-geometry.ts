import type { MeshData, Vec3 } from './core';
import { add3, boundsOfPoints, cross3, distance3, dot3, length3, normalize3, scale3, subtract3 } from './geometry';
import type { GeometryInspection } from './editing-types';

export type Face = [number, number, number];
export type Edge = [number, number];

export interface IndexedMesh {
  positions: Vec3[];
  faces: Face[];
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
      positions.push(...mesh.positions[index]);
      normals.push(...normal);
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
  const intersections = detectSelfIntersections(mesh);
  if (intersections.length) throw new Error(`Geometry operation produced ${intersections.length} self-intersecting triangle pair${intersections.length === 1 ? '' : 's'}.`);
  return inspectGeometry(mesh);
}

export function detectSelfIntersections(mesh: IndexedMesh): Array<[number, number]> {
  if (mesh.faces.length < 2) return [];
  const boxes = mesh.faces.map((face) => triangleBounds(mesh, face));
  const order = mesh.faces.map((_, id) => id).sort((a, b) => boxes[a].min[0] - boxes[b].min[0] || a - b);
  const results: Array<[number, number]> = [];
  for (let left = 0; left < order.length; left += 1) {
    const firstId = order[left];
    const first = mesh.faces[firstId];
    const firstVertices = new Set(first);
    for (let right = left + 1; right < order.length; right += 1) {
      const secondId = order[right];
      if (boxes[secondId].min[0] > boxes[firstId].max[0] + EPSILON) break;
      const second = mesh.faces[secondId];
      if (second.some((vertex) => firstVertices.has(vertex))) continue;
      if (!boxesOverlap(boxes[firstId], boxes[secondId])) continue;
      if (trianglesIntersect(first.map((id) => mesh.positions[id]) as [Vec3, Vec3, Vec3], second.map((id) => mesh.positions[id]) as [Vec3, Vec3, Vec3])) results.push([firstId, secondId]);
    }
  }
  return results;
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

function trianglesIntersect(first: [Vec3, Vec3, Vec3], second: [Vec3, Vec3, Vec3]): boolean {
  const firstNormal = cross3(subtract3(first[1], first[0]), subtract3(first[2], first[0]));
  const secondNormal = cross3(subtract3(second[1], second[0]), subtract3(second[2], second[0]));
  const normalsCross = length3(cross3(firstNormal, secondNormal));
  const scale = Math.max(length3(firstNormal) * length3(secondNormal), EPSILON);
  if (normalsCross <= EPSILON * scale) {
    const unit = normalize3(firstNormal);
    if (!unit.some(Math.abs) || second.some((point) => Math.abs(dot3(subtract3(point, first[0]), unit)) > EPSILON)) return false;
    return coplanarTrianglesIntersect(first, second, unit);
  }
  const firstEdges: Array<[Vec3, Vec3]> = [[first[0], first[1]], [first[1], first[2]], [first[2], first[0]]];
  const secondEdges: Array<[Vec3, Vec3]> = [[second[0], second[1]], [second[1], second[2]], [second[2], second[0]]];
  return firstEdges.some(([a, b]) => segmentIntersectsTriangle(a, b, second)) || secondEdges.some(([a, b]) => segmentIntersectsTriangle(a, b, first));
}

function coplanarTrianglesIntersect(first: [Vec3, Vec3, Vec3], second: [Vec3, Vec3, Vec3], normal: Vec3): boolean {
  const drop = Math.abs(normal[0]) >= Math.abs(normal[1]) && Math.abs(normal[0]) >= Math.abs(normal[2]) ? 0 : Math.abs(normal[1]) >= Math.abs(normal[2]) ? 1 : 2;
  const project = (point: Vec3): [number, number] => drop === 0 ? [point[1], point[2]] : drop === 1 ? [point[0], point[2]] : [point[0], point[1]];
  const a = first.map(project) as [[number, number], [number, number], [number, number]];
  const b = second.map(project) as [[number, number], [number, number], [number, number]];
  const edges = (triangle: typeof a): Array<[[number, number], [number, number]]> => [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]];
  if (edges(a).some(([start, end]) => edges(b).some(([otherStart, otherEnd]) => segmentsIntersect2(start, end, otherStart, otherEnd)))) return true;
  return pointInTriangle2(a[0], b) || pointInTriangle2(b[0], a);
}

function segmentsIntersect2(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const orientation = (first: [number, number], second: [number, number], third: [number, number]) => (second[0] - first[0]) * (third[1] - first[1]) - (second[1] - first[1]) * (third[0] - first[0]);
  const values = [orientation(a, b, c), orientation(a, b, d), orientation(c, d, a), orientation(c, d, b)];
  if (values[0] * values[1] < -EPSILON && values[2] * values[3] < -EPSILON) return true;
  const onSegment = (point: [number, number], start: [number, number], end: [number, number]) => Math.abs(orientation(start, end, point)) <= EPSILON && point[0] >= Math.min(start[0], end[0]) - EPSILON && point[0] <= Math.max(start[0], end[0]) + EPSILON && point[1] >= Math.min(start[1], end[1]) - EPSILON && point[1] <= Math.max(start[1], end[1]) + EPSILON;
  return Math.abs(values[0]) <= EPSILON && onSegment(c, a, b) || Math.abs(values[1]) <= EPSILON && onSegment(d, a, b) || Math.abs(values[2]) <= EPSILON && onSegment(a, c, d) || Math.abs(values[3]) <= EPSILON && onSegment(b, c, d);
}

function pointInTriangle2(point: [number, number], triangle: [[number, number], [number, number], [number, number]]): boolean {
  const sign = (value: [number, number], first: [number, number], second: [number, number]) => (value[0] - second[0]) * (first[1] - second[1]) - (first[0] - second[0]) * (value[1] - second[1]);
  const values = [sign(point, triangle[0], triangle[1]), sign(point, triangle[1], triangle[2]), sign(point, triangle[2], triangle[0])];
  return !(values.some((value) => value < -EPSILON) && values.some((value) => value > EPSILON));
}

function segmentIntersectsTriangle(start: Vec3, end: Vec3, triangle: [Vec3, Vec3, Vec3]): boolean {
  const direction = subtract3(end, start);
  const edge1 = subtract3(triangle[1], triangle[0]);
  const edge2 = subtract3(triangle[2], triangle[0]);
  const p = cross3(direction, edge2);
  const determinant = dot3(edge1, p);
  if (Math.abs(determinant) <= EPSILON) return false;
  const inverse = 1 / determinant;
  const t = subtract3(start, triangle[0]);
  const u = dot3(t, p) * inverse;
  if (u < -EPSILON || u > 1 + EPSILON) return false;
  const q = cross3(t, edge1);
  const v = dot3(direction, q) * inverse;
  if (v < -EPSILON || u + v > 1 + EPSILON) return false;
  const amount = dot3(edge2, q) * inverse;
  return amount >= -EPSILON && amount <= 1 + EPSILON;
}

export function averageEdgeLength(mesh: IndexedMesh): number {
  const topology = buildTopology(mesh);
  return topology.edges.length ? topology.edges.reduce((sum, [a, b]) => sum + distance3(mesh.positions[a], mesh.positions[b]), 0) / topology.edges.length : 0;
}
