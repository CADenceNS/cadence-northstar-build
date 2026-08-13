import type { MeshData, Vec3 } from './core';
import { buildTopology, faceArea, indexedMesh, inspectGeometry, meshData, validateGeometryResult, type IndexedMesh } from './editing-geometry';
import { add3, closestPointOnTriangle, cross3, distance3, dot3, intersectRayTriangle, normalize3, scale3, subtract3, type Triangle3 } from './geometry';
import { CROWN_MATERIAL_PROFILES } from './morphology-core';
import type {
  CementSpaceAnalysis,
  ContactPatch,
  ContourAnalysis,
  ContourReferenceKind,
  ContourRegion,
  CrownGenerationInput,
  CrownLocks,
  CrownOptimizationEvidence,
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

export type CrownContourReference = { objectId: string; kind: ContourReferenceKind; mesh: MeshData };

export function analyzeContour(mesh: MeshData, map: CrownTopologyMap, referenceInput?: MeshData | CrownContourReference[]): ContourAnalysis {
  const references: CrownContourReference[] = !referenceInput ? [] : Array.isArray(referenceInput) ? referenceInput : [{ objectId: 'reference', kind: 'pre-op', mesh: referenceInput }];
  const emptyRegions = (): ContourAnalysis['regions'] => ({ facial: summary(), lingual: summary(), cervical: summary(), proximal: summary() });
  if (!references.length) return { id: crypto.randomUUID(), overContouredVertexIds: [], underContouredVertexIds: [], maximumOverContourMm: 0, maximumUnderContourMm: 0, referenceObjectId: null, references: [], regions: emptyRegions(), status: 'not-run' };
  const indexed = indexedMesh(mesh); const center: Vec3 = [(mesh.bounds.min[0] + mesh.bounds.max[0]) / 2, (mesh.bounds.min[1] + mesh.bounds.max[1]) / 2, (mesh.bounds.min[2] + mesh.bounds.max[2]) / 2];
  const byReference: ContourAnalysis['references'] = []; const allOver = new Map<number, number>(); const allUnder = new Map<number, number>();
  const regions = emptyRegions();
  for (const reference of references) {
    const samples = distanceSamples(indexed, map.outerVertexIds, reference.mesh); const over = samples.filter((sample) => sample.distanceMm > 0.5); const under = samples.filter((sample) => sample.distanceMm < -0.5);
    for (const sample of over) allOver.set(sample.vertexId, Math.max(allOver.get(sample.vertexId) ?? 0, sample.distanceMm));
    for (const sample of under) allUnder.set(sample.vertexId, Math.max(allUnder.get(sample.vertexId) ?? 0, -sample.distanceMm));
    for (const sample of [...over, ...under]) {
      const region = contourRegion(indexed.positions[sample.vertexId], center, map.regions[sample.vertexId]); const value = regions[region]; value.affectedVertexIds.push(sample.vertexId); if (sample.distanceMm > 0) value.maximumOverContourMm = Math.max(value.maximumOverContourMm, sample.distanceMm); else value.maximumUnderContourMm = Math.max(value.maximumUnderContourMm, -sample.distanceMm);
    }
    byReference.push({ kind: reference.kind, objectId: reference.objectId, maximumOverContourMm: Math.max(0, ...over.map((sample) => sample.distanceMm)), maximumUnderContourMm: Math.max(0, ...under.map((sample) => -sample.distanceMm)), overContouredVertexIds: over.map((sample) => sample.vertexId), underContouredVertexIds: under.map((sample) => sample.vertexId) });
  }
  for (const value of Object.values(regions)) value.affectedVertexIds = [...new Set(value.affectedVertexIds)].sort((a, b) => a - b);
  const overContouredVertexIds = [...allOver.keys()].sort((a, b) => a - b); const underContouredVertexIds = [...allUnder.keys()].sort((a, b) => a - b);
  return { id: crypto.randomUUID(), overContouredVertexIds, underContouredVertexIds, maximumOverContourMm: Math.max(0, ...allOver.values()), maximumUnderContourMm: Math.max(0, ...allUnder.values()), referenceObjectId: references[0]?.objectId ?? null, references: byReference, regions, status: overContouredVertexIds.length || underContouredVertexIds.length ? 'warning' : 'pass' };
}

function summary(): ContourAnalysis['regions'][ContourRegion] { return { maximumOverContourMm: 0, maximumUnderContourMm: 0, affectedVertexIds: [] }; }

function contourRegion(point: Vec3, center: Vec3, crownRegion: CrownTopologyMap['regions'][number]): ContourRegion {
  if (crownRegion === 'margin' || crownRegion === 'axial') return 'cervical';
  const x = Math.abs(point[0] - center[0]); const y = Math.abs(point[1] - center[1]);
  if (x > y) return 'proximal';
  return point[1] <= center[1] ? 'facial' : 'lingual';
}

export function correctContour(
  mesh: MeshData,
  map: CrownTopologyMap,
  references: CrownContourReference[],
  mode: 'over' | 'under' | 'both',
  maximumStepMm: number,
  locks: CrownLocks,
): MeshData {
  if (!references.length) throw new Error('Contour correction requires at least one assigned model-space reference.');
  if (!Number.isFinite(maximumStepMm) || maximumStepMm <= 0 || maximumStepMm > 1) throw new Error('Contour correction step must be finite and between 0 and 1 mm.');
  const indexed = indexedMesh(mesh); const positions = indexed.positions.map((point) => [...point] as Vec3); const margin = new Set(map.marginOuterVertexIds); let changed = 0;
  for (const reference of references) {
    for (const sample of distanceSamples(indexed, map.outerVertexIds, reference.mesh)) {
      if (Math.abs(sample.distanceMm) <= 0.5 || (sample.distanceMm > 0 && mode === 'under') || (sample.distanceMm < 0 && mode === 'over')) continue;
      const point = indexed.positions[sample.vertexId]; const locked = locks.anatomy || (locks.margin && margin.has(sample.vertexId)) || (locks.facialContour && point[1] <= mesh.bounds.min[1] + (mesh.bounds.max[1] - mesh.bounds.min[1]) / 2) || (locks.lingualContour && point[1] > mesh.bounds.min[1] + (mesh.bounds.max[1] - mesh.bounds.min[1]) / 2);
      if (locked) continue;
      const step = Math.min(maximumStepMm, Math.abs(sample.distanceMm) - 0.5); positions[sample.vertexId] = add3(positions[sample.vertexId], scale3(normalize3(subtract3(sample.nearest, sample.position)), step)); changed += 1;
    }
  }
  if (!changed) throw new Error('Contour correction found no editable out-of-tolerance vertices; verify locks and reference coverage.');
  const result = { positions, faces: indexed.faces }; validateGeometryResult(result); return meshData(result);
}

export function runCrownAnalyses(solid: CrownSolidResult, input: CrownGenerationInput) {
  let started = performance.now();
  const thickness = calculateThickness(solid.mesh, solid.topologyMap, input.materialProfileId);
  const thicknessAnalysisMs = performance.now() - started;
  started = performance.now();
  const cementSpace = calculateCementSpace(solid, input);
  const cementSpaceAnalysisMs = performance.now() - started;
  started = performance.now();
  const seating = simulateSeating(solid, input);
  const seatingAnalysisMs = performance.now() - started;
  started = performance.now();
  const mesialContact = analyzeProximalContact(solid.mesh, solid.topologyMap, input.adjacentMeshes.find((item) => item.side === 'mesial'), 'mesial', input);
  const distalContact = analyzeProximalContact(solid.mesh, solid.topologyMap, input.adjacentMeshes.find((item) => item.side === 'distal'), 'distal', input);
  const contactCalculationMs = performance.now() - started;
  started = performance.now();
  const occlusion = analyzeOcclusion(solid.mesh, solid.topologyMap, input);
  const occlusalCalculationMs = performance.now() - started;
  started = performance.now();
  const contour = analyzeContour(solid.mesh, solid.topologyMap, input.contourReferences);
  const contourAnalysisMs = performance.now() - started;
  return {
    thickness,
    cementSpace,
    seating,
    mesialContact,
    distalContact,
    occlusion,
    contour,
    stageDurationsMs: {
      thicknessAnalysisMs,
      cementSpaceAnalysisMs,
      seatingAnalysisMs,
      contactCalculationMs,
      occlusalCalculationMs,
      contourAnalysisMs,
    },
  };
}

function constrainedSurfaceAdjustment(mesh: MeshData, map: CrownTopologyMap, target: MeshData, vertexIds: number[], targetDistance: number, maximumStepMm: number): MeshData {
  const indexed = indexedMesh(mesh); const samples = distanceSamples(indexed, vertexIds, target); const displacements = new Map<number, Vec3>();
  for (const sample of samples) {
    const error = sample.inside ? targetDistance - sample.distanceMm : sample.distanceMm - targetDistance; if (Math.abs(error) < 0.005) continue;
    const direction = normalize3(subtract3(sample.nearest, sample.position));
    const step = Math.max(-maximumStepMm, Math.min(maximumStepMm, error));
    displacements.set(sample.vertexId, scale3(direction, step));
  }
  if (!displacements.size) return structuredClone(mesh);
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = 2 ** -attempt; const positions = indexed.positions.map((point, id) => add3(point, scale3(displacements.get(id) ?? [0, 0, 0], scale))); const result = { positions, faces: indexed.faces };
    try { validateGeometryResult(result); return meshData(result); }
    catch (error) { lastError = error; }
  }
  throw new Error(`Contact or occlusal adjustment could not produce valid crown geometry after bounded backtracking: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export function optimizeProximalContact(mesh: MeshData, map: CrownTopologyMap, target: MeshData, side: 'mesial' | 'distal', targetDistance: number, locked: boolean): MeshData {
  if (locked) throw new Error(`${side === 'mesial' ? 'Mesial' : 'Distal'} contact lock prevents automatic contact optimization.`);
  const indexed = indexedMesh(mesh); const samples = distanceSamples(indexed, map.outerVertexIds.filter((id) => !['margin'].includes(map.regions[id])), target).sort((a, b) => a.distanceMm - b.distanceMm);
  // A broad proximal support region prevents a narrow displacement boundary from folding the crown surface.
  const count = Math.max(3, Math.ceil(samples.length * 0.2)); return constrainedSurfaceAdjustment(mesh, map, target, samples.slice(0, count).map((sample) => sample.vertexId), targetDistance, 0.25);
}

export function optimizeStaticOcclusion(mesh: MeshData, map: CrownTopologyMap, antagonist: MeshData, targetDistance: number, locked: boolean): MeshData {
  if (locked) throw new Error('Occlusion lock prevents automatic static-occlusion optimization.');
  const candidates = map.outerVertexIds.filter((id) => !['margin', 'axial'].includes(map.regions[id])); return constrainedSurfaceAdjustment(mesh, map, antagonist, candidates, targetDistance, 0.2);
}

export function autoThickenCrown(mesh: MeshData, map: CrownTopologyMap, materialId: CrownGenerationInput['materialProfileId'], locks: CrownLocks, lockedVertexIds: number[] = []): MeshData {
  if (locks.intaglio && locks.anatomy) throw new Error('Minimum-thickness conflict is unsatisfiable while both intaglio and anatomy are locked.');
  const indexed = indexedMesh(mesh); const profile = CROWN_MATERIAL_PROFILES[materialId]; const positions = indexed.positions.map((point) => [...point] as Vec3); const selectedLocks = new Set(lockedVertexIds); const center: Vec3 = [(mesh.bounds.min[0] + mesh.bounds.max[0]) / 2, (mesh.bounds.min[1] + mesh.bounds.max[1]) / 2, (mesh.bounds.min[2] + mesh.bounds.max[2]) / 2]; let changed = 0;
  for (const outerId of map.outerVertexIds) {
    const innerId = map.outerToInner[outerId]; if (innerId === undefined) continue; const region = map.regions[outerId] ?? 'axial'; if (locks.margin && region === 'margin') continue;
    const vector = subtract3(indexed.positions[outerId], indexed.positions[innerId]); const current = Math.hypot(...vector); const required = Math.max(profile.minimumThicknessMm.global, profile.minimumThicknessMm[region]);
    if (current + 1e-6 >= required) continue;
    const point = indexed.positions[outerId]; const constrained = locks.anatomy || (locks.selectedAnatomy && selectedLocks.has(outerId)) || (locks.facialContour && point[1] <= center[1]) || (locks.lingualContour && point[1] > center[1]) || (locks.mesialContact && point[0] <= center[0]) || (locks.distalContact && point[0] > center[0]) || (locks.occlusion && ['occlusal', 'incisal', 'cusp', 'fossa'].includes(region));
    if (constrained) throw new Error(`Minimum-thickness conflict at outer vertex ${outerId} is unsatisfiable under the active restoration locks.`);
    positions[outerId] = add3(indexed.positions[innerId], scale3(normalize3(vector), required + 0.02)); changed += 1;
  }
  if (!changed) return structuredClone(mesh); const result = { positions, faces: indexed.faces }; validateGeometryResult(result); return meshData(result);
}

export interface CrownJointOptimizationResult {
  mesh: MeshData;
  evidence: CrownOptimizationEvidence;
  analyses: {
    thickness: ThicknessAnalysis;
    mesialContact: ProximalContactAnalysis;
    distalContact: ProximalContactAnalysis;
    occlusion: OcclusionAnalysis;
  };
}

/** Joint, deterministic, lock-aware optimization over actual crown vertices. */
export function optimizeCrownConstraints(
  mesh: MeshData,
  map: CrownTopologyMap,
  input: CrownGenerationInput,
  locks: CrownLocks,
  lockedVertexIds: number[] = [],
  options: { maximumIterations?: number; convergenceTolerance?: number } = {},
): CrownJointOptimizationResult {
  const mesial = input.adjacentMeshes.find((value) => value.side === 'mesial'); const distal = input.adjacentMeshes.find((value) => value.side === 'distal');
  if (!mesial || !distal || !input.antagonist) throw new Error('Joint crown optimization requires mesial, distal, and antagonist geometry.');
  const maximumIterations = Math.max(1, Math.min(25, Math.floor(options.maximumIterations ?? 10))); const tolerance = Math.max(1e-6, Math.min(0.05, options.convergenceTolerance ?? 0.002));
  const baseline = indexedMesh(mesh); let current = structuredClone(mesh); let previousObjective = Infinity; let iterationCount = 0; let status: CrownOptimizationEvidence['status'] = 'best-effort';
  const beforeAnalyses = optimizationAnalyses(current, map, input); const before = optimizationMeasurements(beforeAnalyses);
  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    iterationCount = iteration + 1;
    let currentAnalyses = optimizationAnalyses(current, map, input);
    if (!locks.mesialContact && contactOutsideGovernedRange(currentAnalyses.mesialContact, input)) {
      current = optimizeProximalContact(current, map, mesial.mesh, 'mesial', input.parameters.targetMesialContactMm, false);
      currentAnalyses = optimizationAnalyses(current, map, input);
    }
    if (!locks.distalContact && contactOutsideGovernedRange(currentAnalyses.distalContact, input)) {
      current = optimizeProximalContact(current, map, distal.mesh, 'distal', input.parameters.targetDistalContactMm, false);
      currentAnalyses = optimizationAnalyses(current, map, input);
    }
    if (!locks.occlusion && occlusionOutsideGovernedRange(currentAnalyses.occlusion, input)) {
      current = optimizeStaticOcclusion(current, map, input.antagonist.mesh, input.parameters.targetOcclusalClearanceMm, false);
    }
    const thickness = calculateThickness(current, map, input.materialProfileId);
    if (thickness.failingVertexIds.length) current = autoThickenCrown(current, map, input.materialProfileId, locks, lockedVertexIds);
    validateGeometryResult(indexedMesh(current));
    const analyses = optimizationAnalyses(current, map, input); const terms = optimizationTerms(analyses, baseline, indexedMesh(current), input); const objective = objectiveValue(terms);
    if (constraintViolations(analyses, input).length === 0 && Math.abs(previousObjective - objective) <= tolerance) { status = 'converged'; break; }
    if (objective > previousObjective + tolerance) { status = 'best-effort'; break; }
    if (Math.abs(previousObjective - objective) <= tolerance) { status = constraintViolations(analyses, input).length ? 'best-effort' : 'converged'; break; }
    previousObjective = objective;
  }
  const analyses = optimizationAnalyses(current, map, input); const violations = constraintViolations(analyses, input);
  const lockedConflict = violations.some((value) => (value.includes('mesial') && locks.mesialContact) || (value.includes('distal') && locks.distalContact) || (value.includes('occlusal') && locks.occlusion) || (value.includes('thickness') && (locks.anatomy || locks.intaglio)));
  if (lockedConflict) status = 'constraint-conflict'; else if (!violations.length) status = 'converged';
  const evidence: CrownOptimizationEvidence = {
    id: crypto.randomUUID(), status, objectiveTerms: optimizationTerms(analyses, baseline, indexedMesh(current), input), constraintViolations: violations, iterationCount, convergenceTolerance: tolerance, before, after: optimizationMeasurements(analyses), executedAt: new Date().toISOString(),
  };
  return { mesh: current, evidence, analyses };
}

function optimizationAnalyses(mesh: MeshData, map: CrownTopologyMap, input: CrownGenerationInput) {
  return {
    thickness: calculateThickness(mesh, map, input.materialProfileId),
    mesialContact: analyzeProximalContact(mesh, map, input.adjacentMeshes.find((item) => item.side === 'mesial'), 'mesial', input),
    distalContact: analyzeProximalContact(mesh, map, input.adjacentMeshes.find((item) => item.side === 'distal'), 'distal', input),
    occlusion: analyzeOcclusion(mesh, map, input),
  };
}

function optimizationMeasurements(value: ReturnType<typeof optimizationAnalyses>): CrownOptimizationEvidence['before'] {
  return { mesialDistanceMm: value.mesialContact.minimumDistanceMm, distalDistanceMm: value.distalContact.minimumDistanceMm, occlusalDistanceMm: value.occlusion.minimumDistanceMm, minimumThicknessMm: value.thickness.globalMinimumMm };
}

function optimizationTerms(value: ReturnType<typeof optimizationAnalyses>, baseline: IndexedMesh, current: IndexedMesh, input: CrownGenerationInput): CrownOptimizationEvidence['objectiveTerms'] {
  const displacementSquared = current.positions.reduce((sum, point, index) => sum + distance3(point, baseline.positions[index]) ** 2, 0);
  const profile = CROWN_MATERIAL_PROFILES[input.materialProfileId];
  return {
    mesialContactErrorMm: value.mesialContact.minimumDistanceMm === null ? null : Math.abs(value.mesialContact.minimumDistanceMm - input.parameters.targetMesialContactMm),
    distalContactErrorMm: value.distalContact.minimumDistanceMm === null ? null : Math.abs(value.distalContact.minimumDistanceMm - input.parameters.targetDistalContactMm),
    occlusalClearanceErrorMm: value.occlusion.minimumDistanceMm === null ? null : Math.abs(value.occlusion.minimumDistanceMm - input.parameters.targetOcclusalClearanceMm),
    thicknessDeficitMm: value.thickness.samples.reduce((sum, sample) => sum + Math.max(0, sample.minimumMm - sample.thicknessMm), 0),
    morphologyDisplacementRmsMm: Math.sqrt(displacementSquared / Math.max(1, current.positions.length)) / Math.max(1, profile.minimumThicknessMm.global),
  };
}

function objectiveValue(value: CrownOptimizationEvidence['objectiveTerms']): number { return (value.mesialContactErrorMm ?? 1) + (value.distalContactErrorMm ?? 1) + (value.occlusalClearanceErrorMm ?? 1) + value.thicknessDeficitMm * 2 + value.morphologyDisplacementRmsMm * 0.1; }

function contactOutsideGovernedRange(value: ProximalContactAnalysis, input: CrownGenerationInput): boolean {
  const range = CROWN_MATERIAL_PROFILES[input.materialProfileId].contactDistanceMm;
  return value.minimumDistanceMm === null || value.minimumDistanceMm < range.minimum || value.minimumDistanceMm > range.maximum;
}

function occlusionOutsideGovernedRange(value: OcclusionAnalysis, input: CrownGenerationInput): boolean {
  const range = CROWN_MATERIAL_PROFILES[input.materialProfileId].occlusalClearanceMm;
  return value.minimumDistanceMm === null || value.minimumDistanceMm < range.minimum || value.minimumDistanceMm > range.maximum;
}

function constraintViolations(value: ReturnType<typeof optimizationAnalyses>, input: CrownGenerationInput): string[] {
  const violations: string[] = [];
  if (contactOutsideGovernedRange(value.mesialContact, input)) violations.push('mesial contact target is outside the governed range');
  if (contactOutsideGovernedRange(value.distalContact, input)) violations.push('distal contact target is outside the governed range');
  if (occlusionOutsideGovernedRange(value.occlusion, input)) violations.push('occlusal clearance target is outside the governed range');
  if (value.thickness.failingVertexIds.length) violations.push(`${value.thickness.failingVertexIds.length} minimum-thickness vertices remain`);
  return violations;
}

export function crownIntegrity(mesh: MeshData) { return inspectGeometry(indexedMesh(mesh)); }
