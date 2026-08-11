import type { Vec3 } from './core';
import { add3, cross3, dot3, normalize3, scale3, subtract3 } from './geometry';
import {
  boundaryLoops,
  buildTopology,
  cloneIndexed,
  compactMesh,
  edgeKey,
  faceArea,
  faceCentroid,
  faceNormal,
  mergeIndexed,
  triangulatePolygon,
  vertexNormals,
  type Face,
  type IndexedMesh,
} from './editing-geometry';

export interface MultiMeshResult { primary: IndexedMesh; additional: IndexedMesh[]; }

export function deleteSelectedFaces(source: IndexedMesh, faceIds: number[]): IndexedMesh {
  const selected = validFaces(source, faceIds, true);
  const mesh = cloneIndexed(source);
  mesh.faces = mesh.faces.filter((_, id) => !selected.has(id));
  return compactMesh(mesh).mesh;
}

export function detachSelectedRegion(source: IndexedMesh, faceIds: number[]): MultiMeshResult {
  const selected = validFaces(source, faceIds, true);
  const detached = compactMesh({ positions: source.positions, faces: source.faces.filter((_, id) => selected.has(id)) }).mesh;
  const primary = compactMesh({ positions: source.positions, faces: source.faces.filter((_, id) => !selected.has(id)) }).mesh;
  if (!primary.faces.length) throw new Error('Detach requires at least one unselected face to remain in the source mesh.');
  return { primary, additional: [detached] };
}

export function separateConnectedShell(source: IndexedMesh, seedFace: number): MultiMeshResult {
  if (!source.faces[seedFace]) throw new Error(`Shell seed face ${seedFace} is unavailable.`);
  const topology = buildTopology(source);
  const shell = topology.shells.find((candidate) => candidate.includes(seedFace));
  if (!shell || topology.shells.length < 2) throw new Error('Separate shell requires a mesh with at least two connected shells.');
  return detachSelectedRegion(source, shell);
}

export function joinMeshes(meshes: IndexedMesh[], weldToleranceMm = 1e-6): IndexedMesh {
  if (meshes.length < 2) throw new Error('Join meshes requires at least two mesh objects.');
  return weldVertices(mergeIndexed(meshes), weldToleranceMm);
}

export function weldVertices(source: IndexedMesh, toleranceMm: number): IndexedMesh {
  if (!(toleranceMm > 0) || !Number.isFinite(toleranceMm)) throw new Error('Weld tolerance must be a finite value greater than zero.');
  const positions: Vec3[] = [];
  const candidates = new Map<string, number[]>();
  const map: number[] = [];
  for (const point of source.positions) {
    const cell = point.map((value) => Math.floor(value / toleranceMm)) as Vec3; const key = cell.join(':');
    const nearby = [-1, 0, 1].flatMap((x) => [-1, 0, 1].flatMap((y) => [-1, 0, 1].flatMap((z) => candidates.get(`${cell[0] + x}:${cell[1] + y}:${cell[2] + z}`) ?? [])));
    const existing = nearby.find((id) => Math.hypot(positions[id][0] - point[0], positions[id][1] - point[1], positions[id][2] - point[2]) <= toleranceMm);
    if (existing !== undefined) map.push(existing);
    else { const id = positions.length; positions.push([...point]); candidates.set(key, [...(candidates.get(key) ?? []), id]); map.push(id); }
  }
  const faces = source.faces.map((face) => face.map((id) => map[id]) as Face).filter((face) => new Set(face).size === 3);
  return compactMesh({ positions, faces }).mesh;
}

export function removeDuplicateVertices(source: IndexedMesh, toleranceMm = 1e-6): IndexedMesh { return weldVertices(source, toleranceMm); }

export function removeDuplicateFaces(source: IndexedMesh): IndexedMesh {
  const seen = new Set<string>();
  const faces = source.faces.filter((face) => { const key = [...face].sort((a, b) => a - b).join(':'); if (seen.has(key)) return false; seen.add(key); return true; });
  return compactMesh({ positions: source.positions, faces }).mesh;
}

export function fillBoundaryHole(source: IndexedMesh, boundaryEdgeId?: number): IndexedMesh {
  const topology = buildTopology(source); const loops = boundaryLoops(source, topology);
  if (!loops.length) throw new Error('Fill hole requires an open boundary loop.');
  const loop = boundaryEdgeId === undefined ? loops[0] : loops.find((candidate) => candidate.some((vertex, index) => edgeKey(vertex, candidate[(index + 1) % candidate.length]) === edgeKey(...(topology.edges[boundaryEdgeId] ?? [-1, -1] as [number, number]))));
  if (!loop || loop.length < 3) throw new Error('The selected boundary does not form a fillable loop.');
  const mesh = cloneIndexed(source);
  let faces = triangulatePolygon(loop.map((id) => mesh.positions[id])).map((face) => face.map((id) => loop[id]) as Face);
  const a = loop[0], b = loop[1]; const boundaryEdge = topology.edges.findIndex((edge) => edgeKey(...edge) === edgeKey(a, b)); const referenceId = topology.edgeFaces[boundaryEdge]?.[0]; const reference = referenceId === undefined ? undefined : mesh.faces[referenceId]; const capFace = faces.find((face) => face.includes(a) && face.includes(b));
  if (reference && capFace && directedEdge(reference, a, b) === directedEdge(capFace, a, b)) faces = faces.map(([first, second, third]) => [first, third, second]);
  mesh.faces.push(...faces);
  return mesh;
}

export function bridgeBoundaryLoops(source: IndexedMesh, firstEdgeId: number, secondEdgeId: number): IndexedMesh {
  const topology = buildTopology(source); const loops = boundaryLoops(source, topology);
  const first = loopForEdge(loops, topology, firstEdgeId); const secondRaw = loopForEdge(loops, topology, secondEdgeId);
  if (!first || !secondRaw || first === secondRaw) throw new Error('Bridge requires two distinct boundary loops.');
  const second = orientClosest(first, secondRaw, source.positions);
  const mesh = cloneIndexed(source);
  let firstIndex = 0; let secondIndex = 0;
  while (firstIndex < first.length || secondIndex < second.length) {
    const firstNext = (firstIndex + 1) % first.length; const secondNext = (secondIndex + 1) % second.length;
    const firstProgress = (firstIndex + 1) / first.length; const secondProgress = (secondIndex + 1) / second.length;
    if (firstIndex < first.length && (secondIndex >= second.length || firstProgress <= secondProgress)) {
      mesh.faces.push([first[firstIndex % first.length], first[firstNext], second[secondIndex % second.length]]); firstIndex += 1;
    } else {
      mesh.faces.push([first[firstIndex % first.length], second[secondNext], second[secondIndex % second.length]]); secondIndex += 1;
    }
  }
  return mesh;
}

export function extrudeFaces(source: IndexedMesh, faceIds: number[], distanceMm: number): IndexedMesh {
  if (!Number.isFinite(distanceMm) || Math.abs(distanceMm) < 1e-9) throw new Error('Extrusion distance must be a finite non-zero millimeter value.');
  const selected = validFaces(source, faceIds, true); const topology = buildTopology(source); const mesh = cloneIndexed(source);
  const selectedVertices = unique([...selected].flatMap((id) => source.faces[id]));
  const normalSums = new Map<number, Vec3>();
  for (const faceId of selected) { const normal = faceNormal(source, source.faces[faceId]); for (const vertex of source.faces[faceId]) normalSums.set(vertex, add3(normalSums.get(vertex) ?? [0, 0, 0], normal)); }
  const normals = source.positions.map((_, vertex) => normalize3(normalSums.get(vertex) ?? [0, 0, 0])); const duplicate = new Map<number, number>();
  for (const vertex of selectedVertices) duplicate.set(vertex, mesh.positions.push(add3(source.positions[vertex], scale3(normals[vertex], distanceMm))) - 1);
  mesh.faces = mesh.faces.filter((_, id) => !selected.has(id));
  for (const faceId of selected) mesh.faces.push(source.faces[faceId].map((vertex) => duplicate.get(vertex)!) as Face);
  const boundary = unique([...selected].flatMap((faceId) => topology.faceEdges[faceId]).filter((edgeId) => topology.edgeFaces[edgeId].filter((face) => selected.has(face)).length === 1));
  for (const edgeId of boundary) {
    const [a, b] = topology.edges[edgeId]; const da = duplicate.get(a)!; const db = duplicate.get(b)!;
    mesh.faces.push([a, b, db], [a, db, da]);
  }
  return mesh;
}

export function insetFaces(source: IndexedMesh, faceIds: number[], amountMm: number): IndexedMesh {
  if (!(amountMm > 0) || !Number.isFinite(amountMm)) throw new Error('Inset amount must be a finite millimeter value greater than zero.');
  const selected = validFaces(source, faceIds, true); const mesh = cloneIndexed(source);
  mesh.faces = mesh.faces.filter((_, id) => !selected.has(id));
  for (const id of selected) {
    const face = source.faces[id]; const center = faceCentroid(source, face);
    const inset = face.map((vertex) => {
      const direction = subtract3(center, source.positions[vertex]); const length = Math.hypot(...direction);
      if (amountMm >= length) throw new Error(`Inset amount exceeds face ${id} inradius.`);
      return mesh.positions.push(add3(source.positions[vertex], scale3(normalize3(direction), amountMm))) - 1;
    }) as Face;
    mesh.faces.push(inset);
    for (let edge = 0; edge < 3; edge += 1) { const next = (edge + 1) % 3; mesh.faces.push([face[edge], face[next], inset[next]], [face[edge], inset[next], inset[edge]]); }
  }
  return mesh;
}

export function offsetSurfaceRegion(source: IndexedMesh, faceIds: number[], distanceMm: number): IndexedMesh {
  if (!Number.isFinite(distanceMm) || Math.abs(distanceMm) < 1e-9) throw new Error('Surface offset must be a finite non-zero millimeter value.');
  const selected = validFaces(source, faceIds, true); const mesh = cloneIndexed(source); const normals = vertexNormals(source);
  for (const vertex of unique([...selected].flatMap((face) => source.faces[face]))) mesh.positions[vertex] = add3(mesh.positions[vertex], scale3(normals[vertex], distanceMm));
  return mesh;
}

export function thickenMesh(source: IndexedMesh, thicknessMm: number): IndexedMesh {
  if (!(thicknessMm > 0) || !Number.isFinite(thicknessMm)) throw new Error('Shell thickness must be a finite millimeter value greater than zero.');
  const topology = buildTopology(source); const normals = vertexNormals(source); const mesh = cloneIndexed(source); const offset = mesh.positions.length;
  mesh.positions.push(...source.positions.map((point, id) => add3(point, scale3(normals[id], -thicknessMm))));
  mesh.faces.push(...source.faces.map(([a, b, c]) => [c + offset, b + offset, a + offset] as Face));
  for (const edgeId of topology.boundaryEdges) { const [a, b] = topology.edges[edgeId]; mesh.faces.push([a, a + offset, b + offset], [a, b + offset, b]); }
  return mesh;
}

export function flattenRegion(source: IndexedMesh, faceIds: number[], planeNormal?: Vec3): IndexedMesh {
  const selected = validFaces(source, faceIds, true); const mesh = cloneIndexed(source); const vertices = unique([...selected].flatMap((face) => source.faces[face]));
  const center = average(vertices.map((id) => source.positions[id]));
  const normal = normalize3(planeNormal ?? average([...selected].map((id) => faceNormal(source, source.faces[id]))));
  if (!normal.some(Math.abs)) throw new Error('Flatten requires a valid selection plane.');
  for (const vertex of vertices) mesh.positions[vertex] = subtract3(mesh.positions[vertex], scale3(normal, dot3(subtract3(mesh.positions[vertex], center), normal)));
  return mesh;
}

export function smoothRegion(source: IndexedMesh, faceIds: number[], iterations = 1, strength = 0.35, preserveBoundary = true, fixedVertexIds: Iterable<number> = []): IndexedMesh {
  if (!Number.isFinite(strength) || strength < -1 || strength > 1) throw new Error('Smoothing strength must be between negative one and one.');
  const selected = validFaces(source, faceIds, true); const topology = buildTopology(source); const vertices = new Set(unique([...selected].flatMap((face) => source.faces[face])));
  const fixed = new Set([...fixedVertexIds, ...(preserveBoundary ? topology.boundaryEdges.flatMap((edge) => topology.edges[edge]).filter((vertex) => vertices.has(vertex)) : [])]);
  let mesh = cloneIndexed(source);
  for (let iteration = 0; iteration < Math.max(1, Math.floor(iterations)); iteration += 1) {
    const next = mesh.positions.map((point) => [...point] as Vec3);
    for (const vertex of vertices) {
      if (fixed.has(vertex)) continue;
      const neighbors = unique(topology.vertexEdges[vertex].flatMap((edge) => topology.edges[edge]).filter((id) => id !== vertex));
      if (!neighbors.length) continue;
      const target = average(neighbors.map((id) => mesh.positions[id])); next[vertex] = add3(scale3(mesh.positions[vertex], 1 - strength), scale3(target, strength));
    }
    mesh = { positions: next, faces: mesh.faces };
  }
  return mesh;
}

export function relaxRegion(source: IndexedMesh, faceIds: number[], iterations = 1, preserveBoundary = true): IndexedMesh {
  let mesh = cloneIndexed(source);
  for (let iteration = 0; iteration < Math.max(1, Math.floor(iterations)); iteration += 1) {
    mesh = smoothRegion(mesh, faceIds, 1, 0.5, preserveBoundary);
    mesh = smoothRegion(mesh, faceIds, 1, -0.53, preserveBoundary);
  }
  return mesh;
}

export function recalculateNormals(source: IndexedMesh): IndexedMesh { return cloneIndexed(source); }

export function reverseNormals(source: IndexedMesh, faceIds?: number[]): IndexedMesh {
  const selected = faceIds ? validFaces(source, faceIds, true) : new Set(source.faces.map((_, id) => id)); const mesh = cloneIndexed(source);
  mesh.faces = mesh.faces.map(([a, b, c], id) => selected.has(id) ? [a, c, b] : [a, b, c]); return mesh;
}

export function removeIsolatedComponents(source: IndexedMesh, minimumAreaMm2: number): IndexedMesh {
  if (!(minimumAreaMm2 >= 0) || !Number.isFinite(minimumAreaMm2)) throw new Error('Minimum component area must be a finite non-negative value.');
  const topology = buildTopology(source);
  if (topology.shells.length < 2) return cloneIndexed(source);
  const areas = topology.shells.map((shell) => shell.reduce((sum, face) => sum + faceArea(source, source.faces[face]), 0));
  const keep = new Set(topology.shells.flatMap((shell, index) => areas[index] >= minimumAreaMm2 ? shell : []));
  if (!keep.size) throw new Error('Isolated-component removal would delete all geometry.');
  return compactMesh({ positions: source.positions, faces: source.faces.filter((_, id) => keep.has(id)) }).mesh;
}

function validFaces(mesh: IndexedMesh, ids: number[], required: boolean): Set<number> {
  const selected = new Set(ids.filter((id) => Number.isInteger(id) && mesh.faces[id]));
  if (required && !selected.size) throw new Error('This mesh operation requires one or more selected faces.');
  if (selected.size !== new Set(ids).size) throw new Error('The face selection contains an invalid element identifier.');
  return selected;
}

function loopForEdge(loops: number[][], topology: ReturnType<typeof buildTopology>, edgeId: number): number[] | undefined {
  const edge = topology.edges[edgeId]; if (!edge || !topology.boundaryEdges.includes(edgeId)) throw new Error(`Edge ${edgeId} is not a boundary edge.`);
  return loops.find((loop) => loop.some((vertex, index) => edgeKey(vertex, loop[(index + 1) % loop.length]) === edgeKey(...edge)));
}

function orientClosest(first: number[], second: number[], positions: Vec3[]): number[] {
  let best = [...second]; let bestDistance = Infinity;
  for (const candidate of [second, [...second].reverse()]) for (let offset = 0; offset < candidate.length; offset += 1) {
    const rotated = [...candidate.slice(offset), ...candidate.slice(0, offset)]; const distance = Math.hypot(...subtract3(positions[first[0]], positions[rotated[0]]));
    if (distance < bestDistance) { best = rotated; bestDistance = distance; }
  }
  return best;
}

function average(points: Vec3[]): Vec3 { return scale3(points.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / points.length); }
function unique(values: number[]): number[] { return [...new Set(values)].sort((a, b) => a - b); }
function directedEdge(face: Face, a: number, b: number): number { for (let index = 0; index < 3; index += 1) { if (face[index] === a && face[(index + 1) % 3] === b) return 1; if (face[index] === b && face[(index + 1) % 3] === a) return -1; } return 0; }
