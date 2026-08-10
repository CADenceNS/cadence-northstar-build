import type { Vec3 } from './core';
import type { TriangleQualityReport } from './editing-types';
import { add3, distance3, dot3, normalize3, scale3, subtract3 } from './geometry';
import { averageEdgeLength, buildTopology, cloneIndexed, compactMesh, detectSelfIntersections, faceArea, faceNormal, type Face, type IndexedMesh } from './editing-geometry';
import { smoothRegion, weldVertices } from './mesh-edit-tools';

export interface RemeshOptions {
  targetEdgeLengthMm: number;
  iterations: number;
  preserveBoundaries: boolean;
  preserveSharpFeatures: boolean;
  sharpAngleDegrees: number;
}

export function subdivide(source: IndexedMesh, levels = 1): IndexedMesh {
  if (!Number.isInteger(levels) || levels < 1 || levels > 6) throw new Error('Subdivision levels must be an integer from 1 to 6.');
  let mesh = cloneIndexed(source);
  for (let level = 0; level < levels; level += 1) mesh = splitEdges(mesh, new Set(buildTopology(mesh).edges.map((_, id) => id)));
  return mesh;
}

export function adaptiveSubdivision(source: IndexedMesh, targetEdgeLengthMm: number, maximumLevels = 6): IndexedMesh {
  assertTargetEdge(targetEdgeLengthMm); let mesh = cloneIndexed(source);
  for (let level = 0; level < maximumLevels; level += 1) {
    const topology = buildTopology(mesh); const marked = new Set(topology.edges.flatMap(([a, b], id) => distance3(mesh.positions[a], mesh.positions[b]) > targetEdgeLengthMm ? [id] : []));
    if (!marked.size) break; mesh = splitEdges(mesh, marked);
  }
  if (buildTopology(mesh).edges.some(([a, b]) => distance3(mesh.positions[a], mesh.positions[b]) > targetEdgeLengthMm + 1e-9)) throw new Error(`Adaptive subdivision could not reach the ${targetEdgeLengthMm} mm target within ${maximumLevels} levels.`);
  return mesh;
}

export function isotropicRemesh(source: IndexedMesh, options: RemeshOptions): IndexedMesh {
  validateRemeshOptions(options); let mesh = cloneIndexed(source);
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const topology = buildTopology(mesh); const marked = new Set(topology.edges.flatMap(([a, b], id) => distance3(mesh.positions[a], mesh.positions[b]) > options.targetEdgeLengthMm * 4 / 3 ? [id] : []));
    if (marked.size) mesh = splitEdges(mesh, marked);
    mesh = collapseShortEdges(mesh, options.targetEdgeLengthMm * 0.72, options.preserveBoundaries, options.preserveSharpFeatures, options.sharpAngleDegrees);
    const smoothedTopology = buildTopology(mesh); const fixed = options.preserveSharpFeatures ? [...sharpEdges(mesh, smoothedTopology, options.sharpAngleDegrees)].flatMap((edge) => smoothedTopology.edges[edge]) : [];
    const allFaces = mesh.faces.map((_, id) => id); mesh = smoothRegion(mesh, allFaces, 1, 0.28, options.preserveBoundaries, fixed);
  }
  return mesh;
}

export function localRemesh(source: IndexedMesh, faceIds: number[], options: RemeshOptions): IndexedMesh {
  validateRemeshOptions(options); const selected = new Set(faceIds.filter((id) => source.faces[id])); if (!selected.size) throw new Error('Local remesh requires selected faces.');
  let mesh = cloneIndexed(source);
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const topology = buildTopology(mesh);
    const regionBoundary = topology.edges.flatMap((edge, id) => { const incident = topology.edgeFaces[id]; return incident.some((face) => selected.has(face)) && incident.some((face) => !selected.has(face)) ? edge : []; });
    const marked = new Set([...selected].flatMap((face) => topology.faceEdges[face] ?? []).filter((edge) => topology.edgeFaces[edge].every((face) => selected.has(face)) && distance3(mesh.positions[topology.edges[edge][0]], mesh.positions[topology.edges[edge][1]]) > options.targetEdgeLengthMm * 4 / 3));
    if (marked.size) {
      const split = splitEdgesDetailed(mesh, marked); const nextSelected = new Set<number>(); for (const face of selected) for (const next of split.faceMap[face] ?? []) nextSelected.add(next); selected.clear(); nextSelected.forEach((face) => selected.add(face)); mesh = split.mesh;
    }
    const currentTopology = buildTopology(mesh); const fixed = new Set(regionBoundary);
    if (options.preserveSharpFeatures) for (const edge of sharpEdges(mesh, currentTopology, options.sharpAngleDegrees)) for (const vertex of currentTopology.edges[edge]) fixed.add(vertex);
    mesh = smoothRegion(mesh, [...selected], 1, 0.28, options.preserveBoundaries, fixed);
    if (!marked.size) break;
  }
  return mesh;
}

export function decimate(source: IndexedMesh, targetTriangleCount: number, preserveBoundaries = true, preserveSharpFeatures = true, sharpAngleDegrees = 40): IndexedMesh {
  if (!Number.isInteger(targetTriangleCount) || targetTriangleCount < 4 || targetTriangleCount >= source.faces.length) throw new Error(`Target triangle count must be an integer from 4 to ${Math.max(4, source.faces.length - 1)}.`);
  let mesh = cloneIndexed(source); let guard = source.faces.length * 4;
  while (mesh.faces.length > targetTriangleCount && guard-- > 0) {
    const topology = buildTopology(mesh); const boundary = new Set(topology.boundaryEdges); const sharp = sharpEdges(mesh, topology, sharpAngleDegrees);
    const candidates = topology.edges.map(([a, b], id) => ({ id, a, b, length: distance3(mesh.positions[a], mesh.positions[b]) }))
      .filter((candidate) => (!preserveBoundaries || !boundary.has(candidate.id)) && (!preserveSharpFeatures || !sharp.has(candidate.id)))
      .sort((first, second) => first.length - second.length || first.id - second.id);
    let collapsed = false;
    for (const candidate of candidates) {
      const next = collapseEdge(mesh, candidate.a, candidate.b); const nextTopology = buildTopology(next);
      if (next.faces.length >= targetTriangleCount && !nextTopology.nonManifoldEdges.length && !detectSelfIntersections(next).length) { mesh = next; collapsed = true; break; }
    }
    if (!collapsed) throw new Error(`Decimation stopped at ${mesh.faces.length} triangles because every remaining collapse would violate preserved topology.`);
  }
  if (mesh.faces.length > targetTriangleCount) throw new Error(`Decimation did not reach the requested ${targetTriangleCount} triangle target.`);
  return mesh;
}

export function smoothTopology(source: IndexedMesh, iterations = 1, preserveBoundaries = true): IndexedMesh { return smoothRegion(source, source.faces.map((_, id) => id), iterations, 0.3, preserveBoundaries); }

export function triangleQuality(mesh: IndexedMesh, minimumAngleThresholdDegrees = 15): TriangleQualityReport {
  if (!mesh.faces.length) return { triangleCount: 0, minimumAngleDegrees: 0, averageMinimumAngleDegrees: 0, worstAspectRatio: Infinity, averageAspectRatio: Infinity, belowQualityThresholdCount: 0 };
  const values = mesh.faces.map((face) => {
    const [a, b, c] = face.map((id) => mesh.positions[id]); const lengths = [distance3(a, b), distance3(b, c), distance3(c, a)]; const angles = [angle(lengths[0], lengths[2], lengths[1]), angle(lengths[0], lengths[1], lengths[2]), angle(lengths[1], lengths[2], lengths[0])];
    const area = faceArea(mesh, face); const longest = Math.max(...lengths); const altitude = longest ? 2 * area / longest : 0; return { minimumAngle: Math.min(...angles), aspectRatio: altitude ? longest / altitude : Infinity };
  });
  return {
    triangleCount: values.length,
    minimumAngleDegrees: Math.min(...values.map((value) => value.minimumAngle)),
    averageMinimumAngleDegrees: values.reduce((sum, value) => sum + value.minimumAngle, 0) / values.length,
    worstAspectRatio: Math.max(...values.map((value) => value.aspectRatio)),
    averageAspectRatio: values.reduce((sum, value) => sum + value.aspectRatio, 0) / values.length,
    belowQualityThresholdCount: values.filter((value) => value.minimumAngle < minimumAngleThresholdDegrees).length,
  };
}

function splitEdges(source: IndexedMesh, marked: Set<number>): IndexedMesh { return splitEdgesDetailed(source, marked).mesh; }

function splitEdgesDetailed(source: IndexedMesh, marked: Set<number>): { mesh: IndexedMesh; faceMap: number[][] } {
  const topology = buildTopology(source); const mesh = cloneIndexed(source); const midpoint = new Map<number, number>();
  for (const edgeId of [...marked].sort((a, b) => a - b)) { const edge = topology.edges[edgeId]; if (!edge) continue; midpoint.set(edgeId, mesh.positions.push(scale3(add3(source.positions[edge[0]], source.positions[edge[1]]), 0.5)) - 1); }
  const faces: Face[] = []; const faceMap: number[][] = [];
  for (let faceId = 0; faceId < source.faces.length; faceId += 1) {
    const [a, b, c] = source.faces[faceId]; const [ab, bc, ca] = topology.faceEdges[faceId];
    const mab = midpoint.get(ab), mbc = midpoint.get(bc), mca = midpoint.get(ca); const count = Number(mab !== undefined) + Number(mbc !== undefined) + Number(mca !== undefined);
    const generated: Face[] = count === 0 ? [[a, b, c]]
      : count === 1 && mab !== undefined ? [[a, mab, c], [mab, b, c]]
      : count === 1 && mbc !== undefined ? [[b, mbc, a], [mbc, c, a]]
      : count === 1 && mca !== undefined ? [[c, mca, b], [mca, a, b]]
      : count === 2 && mab !== undefined && mbc !== undefined ? [[a, mab, c], [mab, mbc, c], [mab, b, mbc]]
      : count === 2 && mbc !== undefined && mca !== undefined ? [[a, b, mca], [b, mbc, mca], [mbc, c, mca]]
      : count === 2 && mca !== undefined && mab !== undefined ? [[a, mab, mca], [mab, b, c], [mab, c, mca]]
      : [[a, mab!, mca!], [mab!, b, mbc!], [mca!, mbc!, c], [mab!, mbc!, mca!]];
    faceMap[faceId] = generated.map((_, index) => faces.length + index); faces.push(...generated);
  }
  return { mesh: { positions: mesh.positions, faces }, faceMap };
}

function collapseShortEdges(source: IndexedMesh, threshold: number, preserveBoundaries: boolean, preserveSharpFeatures: boolean, sharpAngleDegrees: number): IndexedMesh {
  let mesh = cloneIndexed(source); const rejected = new Set<string>(); let guard = source.positions.length;
  while (guard-- > 0) {
    const topology = buildTopology(mesh); const boundary = new Set(topology.boundaryEdges); const sharp = sharpEdges(mesh, topology, sharpAngleDegrees);
    const candidate = topology.edges.map(([a, b], id) => ({ id, a, b, key: `${a}:${b}`, length: distance3(mesh.positions[a], mesh.positions[b]) }))
      .filter((edge) => edge.length < threshold && !rejected.has(edge.key) && (!preserveBoundaries || !boundary.has(edge.id)) && (!preserveSharpFeatures || !sharp.has(edge.id)))
      .sort((a, b) => a.length - b.length || a.id - b.id)[0];
    if (!candidate) break;
    const next = collapseEdge(mesh, candidate.a, candidate.b);
    if (!buildTopology(next).nonManifoldEdges.length && !detectSelfIntersections(next).length) { mesh = next; rejected.clear(); }
    else rejected.add(candidate.key);
  }
  return mesh;
}

function collapseEdge(source: IndexedMesh, keep: number, remove: number): IndexedMesh {
  const positions = source.positions.map((point) => [...point] as Vec3); positions[keep] = scale3(add3(positions[keep], positions[remove]), 0.5);
  const faces = source.faces.map((face) => face.map((id) => id === remove ? keep : id) as Face).filter((face) => new Set(face).size === 3);
  return compactMesh({ positions, faces }).mesh;
}

function sharpEdges(mesh: IndexedMesh, topology: ReturnType<typeof buildTopology>, thresholdDegrees: number): Set<number> {
  const cosine = Math.cos(thresholdDegrees * Math.PI / 180); const result = new Set<number>();
  topology.edgeFaces.forEach((faces, edge) => { if (faces.length > 2 || faces.length === 2 && dot3(faceNormal(mesh, mesh.faces[faces[0]]), faceNormal(mesh, mesh.faces[faces[1]])) < cosine) result.add(edge); }); return result;
}

function angle(first: number, second: number, opposite: number): number { const denominator = 2 * first * second; if (!denominator) return 0; return Math.acos(Math.max(-1, Math.min(1, (first * first + second * second - opposite * opposite) / denominator))) * 180 / Math.PI; }
function assertTargetEdge(value: number): void { if (!(value > 0) || !Number.isFinite(value)) throw new Error('Target edge length must be a finite millimeter value greater than zero.'); }
function validateRemeshOptions(options: RemeshOptions): void { assertTargetEdge(options.targetEdgeLengthMm); if (!Number.isInteger(options.iterations) || options.iterations < 1 || options.iterations > 20) throw new Error('Remesh iterations must be an integer from 1 to 20.'); if (!(options.sharpAngleDegrees > 0 && options.sharpAngleDegrees < 180)) throw new Error('Sharp-feature angle must be between 0 and 180 degrees.'); }
