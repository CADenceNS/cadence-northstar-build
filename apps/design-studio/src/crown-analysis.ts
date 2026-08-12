import type { MeshData, Vec3 } from './core';
import { buildTopology, faceArea, indexedMesh, inspectGeometry, meshData, validateGeometryResult, type IndexedMesh } from './editing-geometry';
import { add3, closestPointOnTriangle, cross3, distance3, dot3, intersectRayTriangle, normalize3, scale3, subtract3, type Triangle3 } from './geometry';
import { CROWN_MATERIAL_PROFILES } from './morphology-core';
import type {
  CementSpaceAnalysis,
  ContactPatch,
  ContourAnalysis,
  CrownGenerationInput,
  CrownTopologyMap,
  OcclusionAnalysis,
  ProximalContactAnalysis,
  SeatingAnalysis,
  ThicknessAnalysis,
  ThicknessSample,
} from './restoration-types';
import type { CrownSolidResult } from './crown-geometry';

interface DistanceSample { vertexId: number; position: Vec3; distanceMm: number; inside: boolean; nearest: Vec3; }

function trianglesOf(mesh: MeshData): Triangle3[] {
  const indexed = indexedMesh(mesh);
  return indexed.faces.map(([a, b, c], id) => ({ id, a: indexed.positions[a], b: indexed.positions[b], c: indexed.positions[c] }));
}

function pointInsideClosedMesh(point: Vec3, triangles: Triangle3[]): boolean {
  const direction = normalize3([1, 0.3713906763541037, 0.127831] as Vec3);
  const distances = triangles.flatMap((triangle) => {
    const value = intersectRayTriangle(point, direction, triangle); return value === null ? [] : [value];
  }).sort((a, b) => a - b);
  const unique = distances.filter((distance, index) => !index || Math.abs(distance - distances[index - 1]) > 1e-7);
  return unique.length % 2 === 1;
}

function triangleNormal(triangle: Triangle3): Vec3 { return normalize3(cross3(subtract3(triangle.b, triangle.a), subtract3(triangle.c, triangle.a))); }

function closestSurface(point: Vec3, triangles: Triangle3[]): { point: Vec3; distance: number; triangle: Triangle3 } | null {
  let output: { point: Vec3; distance: number; triangle: Triangle3 } | null = null;
  for (const triangle of triangles) {
    const candidate = closestPointOnTriangle(point, triangle); const distance = distance3(point, candidate);
    if (!output || distance < output.distance) output = { point: candidate, distance, triangle };
  }
  return output;
}

function distanceSamples(mesh: IndexedMesh, vertexIds: number[], targetMesh: MeshData): DistanceSample[] {
  const triangles = trianglesOf(targetMesh); if (!triangles.length) return [];
  const target = indexedMesh(targetMesh); const topology = buildTopology(target);
  const closed = topology.boundaryEdges.length === 0 && topology.nonManifoldEdges.length === 0;
  return vertexIds.map((vertexId) => {
    const position = mesh.positions[vertexId]; const nearest = closestSurface(position, triangles)!;
    const inside = closed ? pointInsideClosedMesh(position, triangles) : dot3(subtract3(position, nearest.point), triangleNormal(nearest.triangle)) < 0;
    return { vertexId, position: [...position], distanceMm: inside ? -nearest.distance : nearest.distance, inside, nearest: nearest.point };
  });
}

function patchBounds(points: Vec3[]): { height: number; width: number } {
  const min: Vec3 = [Infinity, Infinity, Infinity]; const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) { min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
  const dimensions = subtract3(max, min).sort((a, b) => b - a); return { width: dimensions[0] ?? 0, height: dimensions[1] ?? 0 };
}

function contactPatches(mesh: IndexedMesh, samples: DistanceSample[], threshold: number): ContactPatch[] {
  const ids = new Set(samples.filter((sample) => sample.distanceMm <= threshold).map((sample) => sample.vertexId));
  if (!ids.size) return [];
  const topology = buildTopology(mesh); const pending = new Set(ids); const patches: ContactPatch[] = [];
  while (pending.size) {
    const start = [...pending].sort((a, b) => a - b)[0]; pending.delete(start); const component = [start]; const stack = [start];
    while (stack.length) {
      const current = stack.pop()!;
      const neighbors = topology.vertexEdges[current].flatMap((edgeId) => topology.edges[edgeId]).filter((value) => value !== current && pending.has(value));
      for (const neighbor of neighbors) { pending.delete(neighbor); stack.push(neighbor); component.push(neighbor); }
    }
    const componentSet = new Set(component);
    const area = mesh.faces.reduce((sum, face) => face.some((vertex) => componentSet.has(vertex)) ? sum + faceArea(mesh, face) * face.filter((vertex) => componentSet.has(vertex)).length / 3 : sum, 0);
    const points = component.map((id) => mesh.positions[id]); const center = scale3(points.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / points.length); const bounds = patchBounds(points);
    patches.push({ vertexIds: component.sort((a, b) => a - b), areaMm2: area, center, heightMm: bounds.height, widthMm: bounds.width });
  }
  return patches.sort((a, b) => b.areaMm2 - a.areaMm2);
}

export function calculateThickness(mesh: MeshData, map: CrownTopologyMap, materialId: CrownGenerationInput['materialProfileId']): ThicknessAnalysis {
  const indexed = indexedMesh(mesh); const material = CROWN_MATERIAL_PROFILES[materialId]; const samples: ThicknessSample[] = [];
  for (const outerId of map.outerVertexIds) {
    const innerId = map.outerToInner[outerId]; if (innerId === undefined) continue;
    const region = map.regions[outerId] ?? 'axial'; const minimum = Math.max(material.minimumThicknessMm.global, material.minimumThicknessMm[region]); const thickness = distance3(indexed.positions[outerId], indexed.positions[innerId]);
    samples.push({ outerVertexId: outerId, innerVertexId: innerId, position: [...indexed.positions[outerId]], thicknessMm: thickness, minimumMm: minimum, region, status: thickness + 1e-6 < minimum ? 'fail' : thickness < minimum + 0.1 ? 'warning' : 'pass' });
  }
  const regions: ThicknessAnalysis['byRegion'] = { margin: null, axial: null, occlusal: null, incisal: null, cusp: null, fossa: null };
  for (const region of Object.keys(regions) as Array<keyof typeof regions>) { const values = samples.filter((sample) => sample.region === region).map((sample) => sample.thicknessMm); regions[region] = values.length ? Math.min(...values) : null; }
  return {
    id: crypto.randomUUID(),
    globalMinimumMm: samples.length ? Math.min(...samples.map((sample) => sample.thicknessMm)) : 0,
    byRegion: regions,
    samples,
    failingVertexIds: samples.filter((sample) => sample.status === 'fail').map((sample) => sample.outerVertexId),
    analyzedAt: new Date().toISOString(),
  };
}

export function calculateCementSpace(solid: CrownSolidResult, input: CrownGenerationInput): CementSpaceAnalysis {
  const indexed = solid.indexed; const inner = solid.topologyMap.innerVertexIds;
  const measured: number[] = []; const invalid: number[] = [];
  inner.forEach((innerId, index) => {
    const preparationPoint = solid.preparationSurfacePoints[index];
    if (!preparationPoint) { invalid.push(innerId); return; }
    const value = dot3(subtract3(indexed.positions[innerId], preparationPoint), normalize3(input.insertionAxis));
    if (!Number.isFinite(value) || value <= 0) invalid.push(innerId); else measured.push(value);
  });
  const minimum = measured.length ? Math.min(...measured) : 0; const maximum = measured.length ? Math.max(...measured) : 0; const mean = measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : 0;
  const governed = CROWN_MATERIAL_PROFILES[input.materialProfileId];
  return {
    id: crypto.randomUUID(), requestedMarginalGapMm: input.parameters.marginalGapMm, requestedAxialGapMm: input.parameters.axialSpacerMm, requestedOcclusalGapMm: input.parameters.occlusalSpacerMm,
    measuredMinimumMm: minimum, measuredMaximumMm: maximum, measuredMeanMm: mean, sampleCount: measured.length, invalidSampleVertexIds: invalid,
    status: !invalid.length && minimum >= governed.marginalGapMm.minimum - 1e-4 && maximum <= governed.cementGapMm.maximum + Math.max(0, input.parameters.localReliefMm) + 1e-4 ? 'pass' : 'fail',
  };
}

export function simulateSeating(solid: CrownSolidResult, input: CrownGenerationInput, pathLengthMm = 3, steps = 7): SeatingAnalysis {
  const axis = normalize3(input.insertionAxis); const indexed = solid.indexed; const prepTriangles = trianglesOf(input.preparationMesh); const preparationClosed = (() => { const topology = buildTopology(indexedMesh(input.preparationMesh)); return topology.boundaryEdges.length === 0 && topology.nonManifoldEdges.length === 0; })();
  const innerIds = solid.topologyMap.innerVertexIds; const samples: SeatingAnalysis['samples'] = [];
  for (let step = steps - 1; step >= 0; step -= 1) {
    const offset = pathLengthMm * step / (steps - 1); const colliding: number[] = []; let minimumClearance = Infinity;
    for (const vertexId of innerIds) {
      const point = add3(indexed.positions[vertexId], scale3(axis, offset)); const nearest = closestSurface(point, prepTriangles);
      if (!nearest) { colliding.push(vertexId); continue; }
      const inside = preparationClosed ? pointInsideClosedMesh(point, prepTriangles) : dot3(subtract3(point, nearest.point), triangleNormal(nearest.triangle)) < -1e-6;
      const signed = inside ? -nearest.distance : nearest.distance; minimumClearance = Math.min(minimumClearance, signed); if (inside) colliding.push(vertexId);
    }
    samples.push({ offsetMm: offset, collisionCount: colliding.length, minimumClearanceMm: Number.isFinite(minimumClearance) ? minimumClearance : null, collidingVertexIds: colliding });
  }
  const blockers = [...new Set(samples.flatMap((sample) => sample.collidingVertexIds))].sort((a, b) => a - b); const maximumPenetration = Math.max(0, ...samples.map((sample) => Math.max(0, -(sample.minimumClearanceMm ?? 0))));
  return { id: crypto.randomUUID(), insertionAxis: axis, pathLengthMm, samples, seated: blockers.length === 0, maximumPenetrationMm: maximumPenetration, blockingVertexIds: blockers, status: blockers.length ? 'fail' : 'pass', analyzedAt: new Date().toISOString() };
}

export function analyzeProximalContact(mesh: MeshData, map: CrownTopologyMap, target: CrownGenerationInput['adjacentMeshes'][number] | undefined, side: 'mesial' | 'distal', input: CrownGenerationInput): ProximalContactAnalysis {
  const indexed = indexedMesh(mesh); if (!target) return { id: crypto.randomUUID(), side, adjacentObjectId: null, minimumDistanceMm: null, penetrationMm: 0, clearanceMm: null, patches: [], distanceSamples: [], status: 'not-run', analyzedAt: new Date().toISOString() };
  const samples = distanceSamples(indexed, map.outerVertexIds, target.mesh); const minimum = samples.length ? Math.min(...samples.map((sample) => sample.distanceMm)) : null; const penetration = minimum === null ? 0 : Math.max(0, -minimum); const clearance = minimum === null ? null : Math.max(0, minimum); const profile = CROWN_MATERIAL_PROFILES[input.materialProfileId];
  const patches = contactPatches(indexed, samples, Math.max(profile.contactDistanceMm.maximum, 0.15));
  return {
    id: crypto.randomUUID(), side, adjacentObjectId: target.objectId, minimumDistanceMm: minimum, penetrationMm: penetration, clearanceMm: clearance, patches,
    distanceSamples: samples.map(({ vertexId, position, distanceMm, inside }) => ({ vertexId, position, distanceMm, inside })),
    status: minimum !== null && minimum >= profile.contactDistanceMm.minimum && minimum <= profile.contactDistanceMm.maximum ? 'pass' : 'fail', analyzedAt: new Date().toISOString(),
  };
}

export function analyzeOcclusion(mesh: MeshData, map: CrownTopologyMap, input: CrownGenerationInput): OcclusionAnalysis {
  const target = input.antagonist; const indexed = indexedMesh(mesh);
  if (!target) return { id: crypto.randomUUID(), antagonistObjectId: null, minimumDistanceMm: null, maximumPenetrationMm: 0, minimumClearanceMm: null, contactPatches: [], distanceSamples: [], status: 'not-run', analyzedAt: new Date().toISOString() };
  const candidates = map.outerVertexIds.filter((id) => !['margin', 'axial'].includes(map.regions[id])); const samples = distanceSamples(indexed, candidates, target.mesh); const minimum = samples.length ? Math.min(...samples.map((sample) => sample.distanceMm)) : null; const penetration = minimum === null ? 0 : Math.max(0, -minimum); const clearance = minimum === null ? null : Math.max(0, minimum); const profile = CROWN_MATERIAL_PROFILES[input.materialProfileId];
  return {
    id: crypto.randomUUID(), antagonistObjectId: target.objectId, minimumDistanceMm: minimum, maximumPenetrationMm: penetration, minimumClearanceMm: clearance,
    contactPatches: contactPatches(indexed, samples, Math.max(profile.occlusalClearanceMm.maximum, 0.2)),
    distanceSamples: samples.map(({ vertexId, position, distanceMm, inside }) => ({ vertexId, position, distanceMm, inside })),
    status: minimum !== null && minimum >= profile.occlusalClearanceMm.minimum && minimum <= profile.occlusalClearanceMm.maximum ? 'pass' : 'fail', analyzedAt: new Date().toISOString(),
  };
}

export function analyzeContour(mesh: MeshData, map: CrownTopologyMap, referenceMesh?: MeshData): ContourAnalysis {
  if (!referenceMesh) return { id: crypto.randomUUID(), overContouredVertexIds: [], underContouredVertexIds: [], maximumOverContourMm: 0, maximumUnderContourMm: 0, referenceObjectId: null, status: 'not-run' };
  const indexed = indexedMesh(mesh); const samples = distanceSamples(indexed, map.outerVertexIds, referenceMesh); const over = samples.filter((sample) => sample.distanceMm > 0.5); const under = samples.filter((sample) => sample.distanceMm < -0.5);
  return { id: crypto.randomUUID(), overContouredVertexIds: over.map((sample) => sample.vertexId), underContouredVertexIds: under.map((sample) => sample.vertexId), maximumOverContourMm: Math.max(0, ...over.map((sample) => sample.distanceMm)), maximumUnderContourMm: Math.max(0, ...under.map((sample) => -sample.distanceMm)), referenceObjectId: 'reference', status: over.length || under.length ? 'warning' : 'pass' };
}

export function runCrownAnalyses(solid: CrownSolidResult, input: CrownGenerationInput) {
  return {
    thickness: calculateThickness(solid.mesh, solid.topologyMap, input.materialProfileId),
    cementSpace: calculateCementSpace(solid, input),
    seating: simulateSeating(solid, input),
    mesialContact: analyzeProximalContact(solid.mesh, solid.topologyMap, input.adjacentMeshes.find((item) => item.side === 'mesial'), 'mesial', input),
    distalContact: analyzeProximalContact(solid.mesh, solid.topologyMap, input.adjacentMeshes.find((item) => item.side === 'distal'), 'distal', input),
    occlusion: analyzeOcclusion(solid.mesh, solid.topologyMap, input),
    contour: analyzeContour(solid.mesh, solid.topologyMap, input.referenceMesh),
  };
}

function constrainedSurfaceAdjustment(mesh: MeshData, map: CrownTopologyMap, target: MeshData, vertexIds: number[], targetDistance: number, maximumStepMm: number): MeshData {
  const indexed = indexedMesh(mesh); const samples = distanceSamples(indexed, vertexIds, target); const positions = indexed.positions.map((point) => [...point] as Vec3);
  for (const sample of samples) {
    const error = sample.inside ? targetDistance - sample.distanceMm : sample.distanceMm - targetDistance; if (Math.abs(error) < 0.005) continue;
    const direction = normalize3(subtract3(sample.nearest, sample.position));
    const step = Math.max(-maximumStepMm, Math.min(maximumStepMm, error));
    positions[sample.vertexId] = add3(sample.position, scale3(direction, step));
  }
  const result = { positions, faces: indexed.faces }; validateGeometryResult(result); return meshData(result);
}

export function optimizeProximalContact(mesh: MeshData, map: CrownTopologyMap, target: MeshData, side: 'mesial' | 'distal', targetDistance: number, locked: boolean): MeshData {
  if (locked) throw new Error(`${side === 'mesial' ? 'Mesial' : 'Distal'} contact lock prevents automatic contact optimization.`);
  const indexed = indexedMesh(mesh); const samples = distanceSamples(indexed, map.outerVertexIds.filter((id) => !['margin'].includes(map.regions[id])), target).sort((a, b) => a.distanceMm - b.distanceMm);
  const count = Math.max(3, Math.ceil(samples.length * 0.08)); return constrainedSurfaceAdjustment(mesh, map, target, samples.slice(0, count).map((sample) => sample.vertexId), targetDistance, 0.25);
}

export function optimizeStaticOcclusion(mesh: MeshData, map: CrownTopologyMap, antagonist: MeshData, targetDistance: number, locked: boolean): MeshData {
  if (locked) throw new Error('Occlusion lock prevents automatic static-occlusion optimization.');
  const candidates = map.outerVertexIds.filter((id) => !['margin', 'axial'].includes(map.regions[id])); return constrainedSurfaceAdjustment(mesh, map, antagonist, candidates, targetDistance, 0.2);
}

export function autoThickenCrown(mesh: MeshData, map: CrownTopologyMap, materialId: CrownGenerationInput['materialProfileId'], locks: { margin: boolean; intaglio: boolean; anatomy: boolean }): MeshData {
  if (locks.intaglio && locks.anatomy) throw new Error('Minimum-thickness conflict is unsatisfiable while both intaglio and anatomy are locked.');
  const indexed = indexedMesh(mesh); const profile = CROWN_MATERIAL_PROFILES[materialId]; const positions = indexed.positions.map((point) => [...point] as Vec3); let changed = 0;
  for (const outerId of map.outerVertexIds) {
    const innerId = map.outerToInner[outerId]; if (innerId === undefined) continue; const region = map.regions[outerId] ?? 'axial'; if (locks.margin && region === 'margin') continue;
    const vector = subtract3(indexed.positions[outerId], indexed.positions[innerId]); const current = Math.hypot(...vector); const required = Math.max(profile.minimumThicknessMm.global, profile.minimumThicknessMm[region]);
    if (current + 1e-6 >= required) continue; if (locks.anatomy) throw new Error(`Minimum-thickness conflict at outer vertex ${outerId} cannot be corrected while anatomy is locked.`);
    positions[outerId] = add3(indexed.positions[innerId], scale3(normalize3(vector), required + 0.02)); changed += 1;
  }
  if (!changed) return structuredClone(mesh); const result = { positions, faces: indexed.faces }; validateGeometryResult(result); return meshData(result);
}

export function crownIntegrity(mesh: MeshData) { return inspectGeometry(indexedMesh(mesh)); }
