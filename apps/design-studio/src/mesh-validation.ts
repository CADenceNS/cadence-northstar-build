import type { ArtifactRecord, StoredValidationCheck, ValidationCheckStatus, Vec3 } from './core';
import { analyzeSelfIntersections, type TriangleIntersectionRecord } from './editing-geometry';
import { cross3, dot3, length3, subtract3 } from './geometry';

export const VALIDATION_ENGINE_VERSION = '1.1.0';

export interface ValidationOptions {
  vertexToleranceMm: number;
  zeroAreaThresholdMm2: number;
  smallComponentAbsoluteAreaMm2: number;
  smallComponentRelativeArea: number;
}

export interface ValidationTopologySnapshot {
  canonicalPositions: number[];
  triangleCanonicalIndices: number[][];
  trianglePositions: number[][];
  edgeVertices: Record<string, [number, number]>;
  shellTriangles: number[][];
}

export interface MeshValidationResult {
  artifactId: string;
  engineVersion: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  options: ValidationOptions;
  checks: StoredValidationCheck[];
  overall: 'pass' | 'warning' | 'fail';
  warningCount: number;
  failureCount: number;
  resultFingerprint: string;
  selfIntersections: TriangleIntersectionRecord[];
  topology: ValidationTopologySnapshot;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  vertexToleranceMm: 1e-6,
  zeroAreaThresholdMm2: 1e-12,
  smallComponentAbsoluteAreaMm2: 0.01,
  smallComponentRelativeArea: 0.0001,
};

interface EdgeOccurrence { triangle: number; from: number; to: number; }

export function validateMeshArtifact(artifact: ArtifactRecord, overrides: Partial<ValidationOptions> = {}, objectId: string | null = null): MeshValidationResult {
  const started = performance.now(); const startedAt = new Date().toISOString();
  const options = { ...DEFAULT_OPTIONS, ...overrides };
  const source = artifact.mesh.sourceTopology ?? { positions: artifact.mesh.positions, indices: artifact.mesh.indices };
  const sourceVertexCount = Math.floor(source.positions.length / 3);
  const invalidCoordinateIds: string[] = [];
  const sourcePoints: Array<Vec3 | null> = [];
  for (let index = 0; index < sourceVertexCount; index += 1) {
    const point: Vec3 = [source.positions[index * 3], source.positions[index * 3 + 1], source.positions[index * 3 + 2]];
    if (point.some((value) => !Number.isFinite(value))) { invalidCoordinateIds.push(`vertex:${index}`); sourcePoints.push(null); }
    else sourcePoints.push(point);
  }
  if (source.positions.length % 3) invalidCoordinateIds.push(`coordinate:${source.positions.length - source.positions.length % 3}`);

  const canonicalPositions: Vec3[] = [];
  const canonicalByKey = new Map<string, number>();
  const sourceToCanonical: number[] = [];
  const duplicateVertexIds: string[] = [];
  for (let index = 0; index < sourcePoints.length; index += 1) {
    const point = sourcePoints[index];
    if (!point) { sourceToCanonical.push(-1); continue; }
    const key = point.map((value) => Math.round(value / options.vertexToleranceMm)).join(':');
    const existing = canonicalByKey.get(key);
    if (existing === undefined) { canonicalByKey.set(key, canonicalPositions.length); sourceToCanonical.push(canonicalPositions.length); canonicalPositions.push(point); }
    else { sourceToCanonical.push(existing); duplicateVertexIds.push(`vertex:${index}`); }
  }

  const referenced = new Set<number>();
  const invalidReferenceIds: string[] = [];
  const triangles: Array<{ id: number; source: [number, number, number]; canonical: [number, number, number]; points: [Vec3, Vec3, Vec3] | null; area: number }> = [];
  for (let offset = 0; offset + 2 < source.indices.length; offset += 3) {
    const indices = [source.indices[offset], source.indices[offset + 1], source.indices[offset + 2]] as [number, number, number];
    const validIndices = indices.every((index) => Number.isInteger(index) && index >= 0 && index < sourcePoints.length);
    if (validIndices) indices.forEach((index) => referenced.add(index));
    const points = validIndices ? indices.map((index) => sourcePoints[index]) as Array<Vec3 | null> : [null, null, null];
    const validPoints = points.every(Boolean);
    if (!validIndices || !validPoints) invalidReferenceIds.push(`triangle:${offset / 3}`);
    const canonical = (validIndices ? indices.map((index) => sourceToCanonical[index]) : [-1, -1, -1]) as [number, number, number];
    const typedPoints = validPoints ? points as [Vec3, Vec3, Vec3] : null;
    const area = typedPoints ? length3(cross3(subtract3(typedPoints[1], typedPoints[0]), subtract3(typedPoints[2], typedPoints[0]))) * 0.5 : 0;
    triangles.push({ id: offset / 3, source: indices, canonical, points: typedPoints, area });
  }
  if (source.indices.length % 3) invalidReferenceIds.push(`index:${source.indices.length - source.indices.length % 3}`);

  const empty = sourceVertexCount === 0 || triangles.length === 0;
  const zeroAreaIds = triangles.filter((triangle) => triangle.points && triangle.area <= options.zeroAreaThresholdMm2).map((triangle) => `triangle:${triangle.id}`);
  const degenerateIds = triangles.filter((triangle) => !triangle.points || new Set(triangle.canonical).size < 3).map((triangle) => `triangle:${triangle.id}`);
  const duplicateTriangleIds: string[] = [];
  const triangleKeys = new Map<string, number>();
  for (const triangle of triangles.filter((item) => item.points)) {
    const key = [...triangle.canonical].sort((a, b) => a - b).join(':');
    if (triangleKeys.has(key)) duplicateTriangleIds.push(`triangle:${triangle.id}`); else triangleKeys.set(key, triangle.id);
  }
  const unreferencedVertexIds = sourcePoints.map((_, index) => index).filter((index) => !referenced.has(index)).map((index) => `vertex:${index}`);

  const edges = new Map<string, EdgeOccurrence[]>();
  for (const triangle of triangles.filter((item) => item.points && new Set(item.canonical).size === 3)) {
    const directed: Array<[number, number]> = [[triangle.canonical[0], triangle.canonical[1]], [triangle.canonical[1], triangle.canonical[2]], [triangle.canonical[2], triangle.canonical[0]]];
    for (const [from, to] of directed) {
      const key = edgeId(from, to); const occurrences = edges.get(key) ?? [];
      occurrences.push({ triangle: triangle.id, from, to }); edges.set(key, occurrences);
    }
  }
  const boundaryEdgeIds = [...edges].filter(([, occurrences]) => occurrences.length === 1).map(([id]) => id).sort();
  const nonManifoldEdgeIds = [...edges].filter(([, occurrences]) => occurrences.length > 2).map(([id]) => id).sort();
  const inconsistentIds = [...edges].filter(([, occurrences]) => occurrences.length === 2 && occurrences[0].from === occurrences[1].from && occurrences[0].to === occurrences[1].to).map(([id]) => id).sort();
  const boundaryComponentCount = countBoundaryComponents(boundaryEdgeIds);

  const shells = connectedShells(triangles.length, edges);
  const validShells = shells.filter((shell) => shell.some((id) => triangles[id]?.points));
  const shellAreas = validShells.map((shell) => shell.reduce((sum, id) => sum + (triangles[id]?.area ?? 0), 0));
  const totalArea = triangles.reduce((sum, triangle) => sum + triangle.area, 0);
  const largestShell = shellAreas.length ? shellAreas.indexOf(Math.max(...shellAreas)) : -1;
  const disconnectedTriangleIds = validShells.flatMap((shell, index) => index === largestShell ? [] : shell.map((id) => `triangle:${id}`)).sort(numericElementSort);
  const smallThreshold = Math.max(options.smallComponentAbsoluteAreaMm2, totalArea * options.smallComponentRelativeArea);
  const smallTriangleIds = validShells.flatMap((shell, index) => validShells.length > 1 && shellAreas[index] < smallThreshold ? shell.map((id) => `triangle:${id}`) : []).sort(numericElementSort);

  const selfIntersectionExecutable = !empty && !invalidReferenceIds.length && !invalidCoordinateIds.length && !zeroAreaIds.length && !degenerateIds.length;
  const selfIntersections = selfIntersectionExecutable
    ? analyzeSelfIntersections({ positions: canonicalPositions, faces: triangles.map(({ canonical }) => [...canonical]) }, objectId)
    : [];
  const selfIntersectionIds = selfIntersections.map(({ triangleIds }) => `intersection:${triangleIds[0]}-${triangleIds[1]}`);
  const signedVolume = triangles.reduce((sum, triangle) => triangle.points ? sum + dot3(triangle.points[0], cross3(triangle.points[1], triangle.points[2])) / 6 : sum, 0);
  const closed = !empty && !invalidReferenceIds.length && !zeroAreaIds.length && !degenerateIds.length && !boundaryEdgeIds.length && !nonManifoldEdgeIds.length && !selfIntersections.length;
  const invertedNormalIds = detectInvertedNormals(artifact);
  if (closed && signedVolume < -options.zeroAreaThresholdMm2 && !invertedNormalIds.length) invertedNormalIds.push(...triangles.map((triangle) => `triangle:${triangle.id}`));
  const bounds = finiteBounds(sourcePoints.filter((point): point is Vec3 => Boolean(point)));

  const checks: StoredValidationCheck[] = [
    check('empty-geometry', empty ? 'fail' : 'pass', { vertices: sourceVertexCount, triangles: triangles.length }, '> 0 vertices and triangles', empty ? ['mesh:0'] : [], empty ? 'The artifact contains no executable triangle geometry.' : 'The artifact contains triangle geometry.'),
    check('invalid-numeric-coordinates', invalidCoordinateIds.length ? 'fail' : 'pass', invalidCoordinateIds.length, '0 non-finite coordinates', invalidCoordinateIds, invalidCoordinateIds.length ? 'Non-finite coordinate values prevent reliable geometric analysis.' : 'All coordinate values are finite.'),
    check('zero-area-triangles', zeroAreaIds.length ? 'fail' : 'pass', zeroAreaIds.length, `area > ${options.zeroAreaThresholdMm2} mm²`, zeroAreaIds, zeroAreaIds.length ? 'Triangles with zero or near-zero surface area were detected.' : 'No zero-area triangles were detected.'),
    check('degenerate-triangles', degenerateIds.length || invalidReferenceIds.length ? 'fail' : 'pass', degenerateIds.length + invalidReferenceIds.length, '3 valid distinct vertices per triangle', unique([...degenerateIds, ...invalidReferenceIds]), degenerateIds.length || invalidReferenceIds.length ? 'Triangles with repeated vertices or invalid references were detected.' : 'Every triangle has three valid distinct vertices.'),
    check('duplicate-triangles', duplicateTriangleIds.length ? 'fail' : 'pass', duplicateTriangleIds.length, '0 duplicate triangle definitions', duplicateTriangleIds, duplicateTriangleIds.length ? 'Geometrically identical triangle definitions were detected.' : 'No duplicate triangles were detected.'),
    check('duplicate-vertices', duplicateVertexIds.length ? 'warning' : 'pass', duplicateVertexIds.length, `coordinate tolerance ${options.vertexToleranceMm} mm`, duplicateVertexIds, duplicateVertexIds.length ? 'Coincident source vertices were detected; this is common in facet-based STL but is reported explicitly.' : 'No coincident source vertices were detected.'),
    check('unreferenced-vertices', unreferencedVertexIds.length ? 'warning' : 'pass', unreferencedVertexIds.length, '0 unreferenced vertices', unreferencedVertexIds, unreferencedVertexIds.length ? 'Source vertices not referenced by any triangle were detected.' : 'Every source vertex is referenced by triangle geometry.'),
    check('boundary-edges', boundaryEdgeIds.length ? 'fail' : 'pass', boundaryEdgeIds.length, '0 single-use edges', boundaryEdgeIds, boundaryEdgeIds.length ? 'Edges used by only one triangle expose a mesh boundary.' : 'No boundary edges were detected.'),
    check('open-boundaries', boundaryEdgeIds.length ? 'fail' : 'pass', boundaryComponentCount, '0 open boundary components', boundaryEdgeIds, boundaryEdgeIds.length ? 'One or more connected open boundary components were detected.' : 'No open boundaries were detected.'),
    check('non-manifold-edges', nonManifoldEdgeIds.length ? 'fail' : 'pass', nonManifoldEdgeIds.length, 'at most 2 incident triangles per edge', nonManifoldEdgeIds, nonManifoldEdgeIds.length ? 'Edges shared by more than two triangles were detected.' : 'All populated edges have at most two incident triangles.'),
    check('self-intersections', !selfIntersectionExecutable ? 'not-run' : selfIntersections.length ? 'fail' : 'pass', selfIntersectionExecutable ? selfIntersections.length : null, '0 invalid triangle intersections', selfIntersectionIds, !selfIntersectionExecutable ? 'Self-intersection analysis cannot execute until invalid or degenerate triangle input is resolved.' : selfIntersections.length ? 'Invalid triangle crossings, overlaps, contacts, or bow-tie topology were detected.' : 'No invalid triangle intersections or bow-tie topology were detected.'),
    check('disconnected-shells', validShells.length > 1 ? 'warning' : 'pass', validShells.length, '1 connected shell', disconnectedTriangleIds, validShells.length > 1 ? 'Multiple disconnected triangle shells were detected.' : 'Geometry forms one connected shell.'),
    check('inconsistent-triangle-winding', inconsistentIds.length ? 'fail' : 'pass', inconsistentIds.length, 'opposite traversal across shared edges', inconsistentIds, inconsistentIds.length ? 'Adjacent triangles traverse shared edges in the same direction.' : 'Shared-edge triangle winding is consistent.'),
    check('inverted-normal-candidates', invertedNormalIds.length ? 'warning' : 'pass', invertedNormalIds.length, '0 opposed normals or negative closed volume', invertedNormalIds, invertedNormalIds.length ? 'Triangle normals oppose geometric winding or the closed shell has negative signed volume.' : 'No inverted normal candidates were detected.'),
    check('extremely-small-components', smallTriangleIds.length ? 'warning' : 'pass', smallTriangleIds.length, `component area >= ${smallThreshold} mm²`, smallTriangleIds, smallTriangleIds.length ? 'A disconnected component falls below the configured absolute or relative area threshold.' : 'No extremely small disconnected components were detected.'),
    check('bounding-box-dimensions', bounds ? 'pass' : 'not-run', bounds ? { x: bounds.max[0] - bounds.min[0], y: bounds.max[1] - bounds.min[1], z: bounds.max[2] - bounds.min[2] } : null, 'finite millimeter dimensions', [], bounds ? 'Axis-aligned source bounding dimensions were measured in millimeters.' : 'Bounding dimensions cannot execute without finite vertices.'),
    check('triangle-count', 'pass', triangles.length, 'reported value', [], 'Triangle count was measured from source topology.'),
    check('vertex-count', 'pass', sourceVertexCount, 'reported value', [], 'Vertex count was measured from source topology.'),
    check('surface-area', invalidCoordinateIds.length ? 'not-run' : 'pass', invalidCoordinateIds.length ? null : totalArea, `area threshold ${options.zeroAreaThresholdMm2} mm²`, zeroAreaIds, invalidCoordinateIds.length ? 'Surface area cannot execute with non-finite coordinates.' : 'Triangle surface area was summed in square millimeters.'),
    check('signed-volume', closed ? 'pass' : 'not-run', closed ? signedVolume : null, 'closed manifold mesh required', [], closed ? 'Signed volume was calculated from the oriented closed triangle shell.' : 'Signed volume was not executed because the mesh is not a closed manifold shell.'),
    check('watertight-status', closed ? 'pass' : 'fail', closed, 'true', unique([...boundaryEdgeIds, ...nonManifoldEdgeIds, ...degenerateIds, ...invalidReferenceIds, ...selfIntersectionIds]), closed ? 'The mesh is a closed, non-self-intersecting two-manifold shell under the configured tolerance.' : 'The mesh is not watertight under the configured tolerance.'),
  ];

  const failureCount = checks.filter((item) => item.status === 'fail').length;
  const warningCount = checks.filter((item) => item.status === 'warning').length;
  const overall = failureCount ? 'fail' : warningCount ? 'warning' : 'pass';
  const fingerprint = stableFingerprint({ checks: checks.map(({ id, status, measuredValue, threshold, affectedCount, affectedElementIds }) => ({ id, status, measuredValue, threshold, affectedCount, affectedElementIds })), selfIntersections });
  return {
    artifactId: artifact.id,
    engineVersion: VALIDATION_ENGINE_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: performance.now() - started,
    options,
    checks,
    overall,
    warningCount,
    failureCount,
    resultFingerprint: fingerprint,
    selfIntersections,
    topology: {
      canonicalPositions: canonicalPositions.flat(),
      triangleCanonicalIndices: triangles.map((triangle) => [...triangle.canonical]),
      trianglePositions: triangles.map((triangle) => triangle.points ? triangle.points.flat() : []),
      edgeVertices: Object.fromEntries([...edges.keys()].map((id) => [id, parseEdgeId(id)])),
      shellTriangles: validShells,
    },
  };
}

function check(id: string, status: ValidationCheckStatus, measuredValue: StoredValidationCheck['measuredValue'], threshold: StoredValidationCheck['threshold'], affectedElementIds: string[], explanation: string): StoredValidationCheck {
  return { id, status, measuredValue, threshold, affectedCount: affectedElementIds.length, affectedElementIds: unique(affectedElementIds), explanation };
}

function connectedShells(triangleCount: number, edges: Map<string, EdgeOccurrence[]>): number[][] {
  const parent = Array.from({ length: triangleCount }, (_, index) => index);
  const find = (value: number): number => { let current = value; while (parent[current] !== current) { parent[current] = parent[parent[current]]; current = parent[current]; } return current; };
  const join = (first: number, second: number) => { const a = find(first); const b = find(second); if (a !== b) parent[b] = a; };
  for (const occurrences of edges.values()) for (let index = 1; index < occurrences.length; index += 1) join(occurrences[0].triangle, occurrences[index].triangle);
  const groups = new Map<number, number[]>();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) { const root = find(triangle); const values = groups.get(root) ?? []; values.push(triangle); groups.set(root, values); }
  return [...groups.values()].sort((a, b) => a[0] - b[0]);
}

function countBoundaryComponents(edgeIds: string[]): number {
  const adjacency = new Map<number, Set<number>>();
  for (const id of edgeIds) { const [a, b] = parseEdgeId(id); (adjacency.get(a) ?? adjacency.set(a, new Set()).get(a)!).add(b); (adjacency.get(b) ?? adjacency.set(b, new Set()).get(b)!).add(a); }
  const visited = new Set<number>(); let count = 0;
  for (const vertex of adjacency.keys()) {
    if (visited.has(vertex)) continue; count += 1; const stack = [vertex]; visited.add(vertex);
    while (stack.length) for (const next of adjacency.get(stack.pop()!) ?? []) if (!visited.has(next)) { visited.add(next); stack.push(next); }
  }
  return count;
}

function detectInvertedNormals(artifact: ArtifactRecord): string[] {
  const ids: string[] = [];
  const { positions, normals, indices } = artifact.mesh;
  for (let offset = 0; offset + 2 < indices.length; offset += 3) {
    const vertexIds = [indices[offset], indices[offset + 1], indices[offset + 2]];
    const points = vertexIds.map((index) => [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]] as Vec3);
    const normal = cross3(subtract3(points[1], points[0]), subtract3(points[2], points[0]));
    const supplied: Vec3 = [0, 0, 0];
    for (const index of vertexIds) { supplied[0] += normals[index * 3] ?? 0; supplied[1] += normals[index * 3 + 1] ?? 0; supplied[2] += normals[index * 3 + 2] ?? 0; }
    if (length3(normal) && length3(supplied) && dot3(normal, supplied) < 0) ids.push(`triangle:${offset / 3}`);
  }
  return ids;
}

function finiteBounds(points: Vec3[]): { min: Vec3; max: Vec3 } | null {
  if (!points.length) return null; const min: Vec3 = [Infinity, Infinity, Infinity]; const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
  return { min, max };
}

function edgeId(first: number, second: number): string { return `edge:${Math.min(first, second)}-${Math.max(first, second)}`; }
function parseEdgeId(id: string): [number, number] { const [first, second] = id.slice(5).split('-').map(Number); return [first, second]; }
function unique(values: string[]): string[] { return [...new Set(values)].sort(numericElementSort); }
function numericElementSort(first: string, second: string): number { const prefix = first.localeCompare(second, undefined, { numeric: false }); if (first.split(':')[0] !== second.split(':')[0]) return prefix; return Number(first.split(':')[1]?.split('-')[0]) - Number(second.split(':')[1]?.split('-')[0]); }
function stableFingerprint(value: unknown): string {
  const text = JSON.stringify(value); let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
