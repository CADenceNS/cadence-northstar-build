import type { MeshData, Vec3 } from './core';
import { buildTopology, edgeKey, faceCentroid, faceNormal, indexedMesh, type IndexedMesh } from './editing-geometry';
import { add3, cross3, distance3, dot3, normalize3, scale3, subtract3 } from './geometry';

export interface FeatureEdgeMeasurement {
  edgeId: number;
  vertices: [number, number];
  faceIds: number[];
  dihedralDegrees: number;
  normalTransition: number;
  tangentToAxis: number;
  featureScore: number;
}

export interface OrderedFeaturePath {
  edgeIds: number[];
  vertexIds: number[];
  closed: boolean;
  branching: boolean;
}

export interface PlaneBasis { origin: Vec3; u: Vec3; v: Vec3; normal: Vec3; }

export function dentalBasis(axisInput: Vec3, origin: Vec3 = [0, 0, 0]): PlaneBasis {
  const normal = normalize3(axisInput);
  if (!normal.some((value) => Math.abs(value) > 1e-12)) throw new Error('Dental axis must be non-zero.');
  const reference: Vec3 = Math.abs(normal[2]) < 0.85 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize3(cross3(reference, normal));
  const v = normalize3(cross3(normal, u));
  return { origin, u, v, normal };
}

export function projectToPlane(point: Vec3, basis: PlaneBasis): [number, number] {
  const relative = subtract3(point, basis.origin);
  return [dot3(relative, basis.u), dot3(relative, basis.v)];
}

export function axialHeight(point: Vec3, axis: Vec3, origin: Vec3 = [0, 0, 0]): number {
  return dot3(subtract3(point, origin), normalize3(axis));
}

export function featureEdges(mesh: IndexedMesh, axisInput: Vec3, minimumDihedralDegrees = 12): FeatureEdgeMeasurement[] {
  const axis = normalize3(axisInput); const topology = buildTopology(mesh); const normals = mesh.faces.map((face) => faceNormal(mesh, face));
  return topology.edges.flatMap((vertices, edgeId) => {
    const faces = topology.edgeFaces[edgeId];
    if (faces.length < 1 || faces.length > 2) return [];
    const edgeDirection = normalize3(subtract3(mesh.positions[vertices[1]], mesh.positions[vertices[0]]));
    const tangentToAxis = 1 - Math.abs(dot3(edgeDirection, axis));
    let dihedralDegrees = faces.length === 2 ? angleBetween(normals[faces[0]], normals[faces[1]]) : 180;
    if (!Number.isFinite(dihedralDegrees)) dihedralDegrees = 0;
    const normalTransition = faces.length === 2 ? Math.abs(Math.abs(dot3(normals[faces[0]], axis)) - Math.abs(dot3(normals[faces[1]], axis))) : 1;
    const angularEvidence = clamp01(dihedralDegrees / 90);
    const featureScore = 0.55 * angularEvidence + 0.25 * normalTransition + 0.2 * tangentToAxis;
    return dihedralDegrees >= minimumDihedralDegrees && tangentToAxis >= 0.75 ? [{ edgeId, vertices, faceIds: [...faces], dihedralDegrees, normalTransition, tangentToAxis, featureScore }] : [];
  });
}

export function orderFeaturePaths(edges: FeatureEdgeMeasurement[]): OrderedFeaturePath[] {
  const byId = new Map(edges.map((edge) => [edge.edgeId, edge]));
  const vertexEdges = new Map<number, number[]>();
  for (const edge of edges) for (const vertex of edge.vertices) vertexEdges.set(vertex, [...(vertexEdges.get(vertex) ?? []), edge.edgeId]);
  const unused = new Set(edges.map((edge) => edge.edgeId)); const paths: OrderedFeaturePath[] = [];
  while (unused.size) {
    const component = collectEdgeComponent([...unused][0], byId, vertexEdges);
    component.forEach((edgeId) => unused.delete(edgeId));
    const degrees = new Map<number, number>();
    for (const edgeId of component) for (const vertex of byId.get(edgeId)!.vertices) degrees.set(vertex, (degrees.get(vertex) ?? 0) + 1);
    const branching = [...degrees.values()].some((value) => value > 2);
    if (branching) {
      for (const path of splitBranchedComponent(component, byId, degrees)) if (path.edgeIds.length >= 2) paths.push({ ...path, branching: true });
      continue;
    }
    const endpoints = [...degrees.entries()].filter(([, degree]) => degree === 1).map(([vertex]) => vertex).sort((a, b) => a - b);
    const start = endpoints[0] ?? Math.min(...degrees.keys());
    paths.push({ ...tracePath(start, component, byId), branching: false });
  }
  return paths.sort((a, b) => b.edgeIds.length - a.edgeIds.length || a.vertexIds[0] - b.vertexIds[0]);
}

function collectEdgeComponent(seed: number, byId: Map<number, FeatureEdgeMeasurement>, vertexEdges: Map<number, number[]>): Set<number> {
  const result = new Set<number>(); const queue = [seed];
  while (queue.length) {
    const edgeId = queue.shift()!; if (result.has(edgeId)) continue; result.add(edgeId);
    for (const vertex of byId.get(edgeId)!.vertices) for (const neighbor of vertexEdges.get(vertex) ?? []) if (!result.has(neighbor)) queue.push(neighbor);
  }
  return result;
}

function splitBranchedComponent(component: Set<number>, byId: Map<number, FeatureEdgeMeasurement>, degrees: Map<number, number>): Array<Omit<OrderedFeaturePath, 'branching'>> {
  const unused = new Set(component); const paths: Array<Omit<OrderedFeaturePath, 'branching'>> = [];
  while (unused.size) {
    const edgeId = [...unused].sort((a, b) => a - b)[0]; const edge = byId.get(edgeId)!;
    const start = edge.vertices.find((vertex) => degrees.get(vertex) !== 2) ?? edge.vertices[0];
    const edgeIds: number[] = []; const vertexIds = [start]; let current = start; let previousEdge = -1;
    while (true) {
      const nextEdge = [...unused].filter((id) => id !== previousEdge && byId.get(id)!.vertices.includes(current)).sort((a, b) => a - b)[0];
      if (nextEdge === undefined) break;
      unused.delete(nextEdge); edgeIds.push(nextEdge); const pair = byId.get(nextEdge)!.vertices; current = pair[0] === current ? pair[1] : pair[0]; vertexIds.push(current); previousEdge = nextEdge;
      if (degrees.get(current) !== 2 || current === start) break;
    }
    paths.push({ edgeIds, vertexIds: current === start ? vertexIds.slice(0, -1) : vertexIds, closed: current === start });
  }
  return paths;
}

function tracePath(start: number, component: Set<number>, byId: Map<number, FeatureEdgeMeasurement>): Omit<OrderedFeaturePath, 'branching'> {
  const unused = new Set(component); const edgeIds: number[] = []; const vertexIds = [start]; let current = start; let previousEdge = -1;
  while (unused.size) {
    const nextEdge = [...unused].filter((edgeId) => edgeId !== previousEdge && byId.get(edgeId)!.vertices.includes(current)).sort((a, b) => a - b)[0];
    if (nextEdge === undefined) break;
    unused.delete(nextEdge); edgeIds.push(nextEdge); const edge = byId.get(nextEdge)!; current = edge.vertices[0] === current ? edge.vertices[1] : edge.vertices[0]; vertexIds.push(current); previousEdge = nextEdge;
    if (current === start) break;
  }
  const closed = current === start && edgeIds.length >= 3;
  return { edgeIds, vertexIds: closed ? vertexIds.slice(0, -1) : vertexIds, closed };
}

export function pathLength(points: Vec3[], closed: boolean): number {
  let value = 0; for (let index = 1; index < points.length; index += 1) value += distance3(points[index - 1], points[index]);
  if (closed && points.length > 2) value += distance3(points.at(-1)!, points[0]); return value;
}

export function polygonSignedArea(points: Vec3[], axis: Vec3): number {
  if (points.length < 3) return 0; const center = meanPoint(points); const basis = dentalBasis(axis, center); const projected = points.map((point) => projectToPlane(point, basis));
  return projected.reduce((sum, point, index) => { const next = projected[(index + 1) % projected.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0) / 2;
}

export function pointInMargin(point: Vec3, margin: Vec3[], axis: Vec3): boolean {
  if (margin.length < 3) return false; const center = meanPoint(margin); const basis = dentalBasis(axis, center); const polygon = margin.map((value) => projectToPlane(value, basis)); const projected = projectToPlane(point, basis); let inside = false;
  for (let first = 0, previous = polygon.length - 1; first < polygon.length; previous = first++) {
    const a = polygon[first], b = polygon[previous];
    if ((a[1] > projected[1]) !== (b[1] > projected[1]) && projected[0] < (b[0] - a[0]) * (projected[1] - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0]) inside = !inside;
  }
  return inside;
}

export function marginRegionFaces(mesh: IndexedMesh, margin: Vec3[], axisInput: Vec3): number[] {
  if (margin.length < 3) return [];
  const axis = normalize3(axisInput); const center = meanPoint(margin); const marginHeight = median(margin.map((point) => axialHeight(point, axis, center)));
  const radii = margin.map((point) => radialDistance(point, center, axis)); const radius = Math.max(...radii, 1e-6);
  return mesh.faces.flatMap((face, faceId) => {
    const centroid = faceCentroid(mesh, face); const height = axialHeight(centroid, axis, center); const radial = radialDistance(centroid, center, axis);
    return height >= marginHeight - Math.max(0.05, radius * 0.03) && radial <= radius * 1.2 ? [faceId] : [];
  });
}

export function segmentationBoundaryEdges(mesh: IndexedMesh, faceIds: number[]): number[] {
  const selected = new Set(faceIds); const topology = buildTopology(mesh);
  return topology.edges.flatMap((_, edgeId) => {
    const count = topology.edgeFaces[edgeId].filter((faceId) => selected.has(faceId)).length;
    return count > 0 && count < topology.edgeFaces[edgeId].length || count === 1 && topology.edgeFaces[edgeId].length === 1 ? [edgeId] : [];
  });
}

export function dilateFaces(mesh: IndexedMesh, faceIds: number[], rings = 1): number[] {
  const topology = buildTopology(mesh); let selected = new Set(faceIds);
  for (let iteration = 0; iteration < rings; iteration += 1) selected = new Set([...selected, ...[...selected].flatMap((faceId) => topology.faceNeighbors[faceId] ?? [])]);
  return [...selected].sort((a, b) => a - b);
}

export function erodeFaces(mesh: IndexedMesh, faceIds: number[], rings = 1): number[] {
  const topology = buildTopology(mesh); let selected = new Set(faceIds);
  for (let iteration = 0; iteration < rings; iteration += 1) {
    const remove = [...selected].filter((faceId) => (topology.faceNeighbors[faceId] ?? []).some((neighbor) => !selected.has(neighbor)) || topology.faceEdges[faceId].some((edgeId) => topology.edgeFaces[edgeId].length === 1));
    remove.forEach((faceId) => selected.delete(faceId));
  }
  return [...selected].sort((a, b) => a - b);
}

export function curveSelfIntersections(points: Vec3[], axis: Vec3, closed: boolean): Array<[number, number]> {
  if (points.length < 4) return []; const center = meanPoint(points); const basis = dentalBasis(axis, center); const values = points.map((point) => projectToPlane(point, basis)); const segmentCount = closed ? values.length : values.length - 1; const intersections: Array<[number, number]> = [];
  for (let first = 0; first < segmentCount; first += 1) for (let second = first + 1; second < segmentCount; second += 1) {
    if (Math.abs(first - second) <= 1 || closed && first === 0 && second === segmentCount - 1) continue;
    if (segmentsIntersect(values[first], values[(first + 1) % values.length], values[second], values[(second + 1) % values.length])) intersections.push([first, second]);
  }
  return intersections;
}

export function closestCurveDistance(point: Vec3, points: Vec3[], closed: boolean): number {
  let best = Infinity; const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) best = Math.min(best, pointSegmentDistance(point, points[index], points[(index + 1) % points.length]));
  return best;
}

export function meshFrom(value: MeshData): IndexedMesh { return indexedMesh(value); }
export function meanPoint(points: Vec3[]): Vec3 { return points.length ? scale3(points.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / points.length) : [0, 0, 0]; }
export function radialDistance(point: Vec3, center: Vec3, axis: Vec3): number { const relative = subtract3(point, center); return Math.hypot(...subtract3(relative, scale3(normalize3(axis), dot3(relative, normalize3(axis))))); }
export function angleBetween(first: Vec3, second: Vec3): number { return Math.acos(Math.max(-1, Math.min(1, dot3(normalize3(first), normalize3(second))))) * 180 / Math.PI; }
export function median(values: number[]): number { if (!values.length) return 0; const ordered = [...values].sort((a, b) => a - b); const middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; }
export function percentile(values: number[], percent: number): number { if (!values.length) return 0; const ordered = [...values].sort((a, b) => a - b); const index = Math.max(0, Math.min(ordered.length - 1, Math.ceil(percent / 100 * ordered.length) - 1)); return ordered[index]; }
export function clamp01(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }

function pointSegmentDistance(point: Vec3, start: Vec3, end: Vec3): number {
  const segment = subtract3(end, start); const denominator = dot3(segment, segment); const t = denominator ? Math.max(0, Math.min(1, dot3(subtract3(point, start), segment) / denominator)) : 0; return distance3(point, add3(start, scale3(segment, t)));
}

function segmentsIntersect(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const orientation = (p: [number, number], q: [number, number], r: [number, number]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const values = [orientation(a, b, c), orientation(a, b, d), orientation(c, d, a), orientation(c, d, b)];
  return values[0] * values[1] < -1e-12 && values[2] * values[3] < -1e-12;
}

export function topologyEdgeId(mesh: IndexedMesh, first: number, second: number): number | undefined {
  const topology = buildTopology(mesh); const lookup = new Map(topology.edges.map((edge, id) => [edgeKey(...edge), id])); return lookup.get(edgeKey(first, second));
}
