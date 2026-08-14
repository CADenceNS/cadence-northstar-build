import type { MeshData, Vec3 } from './core';
import {
  buildTopology,
  detectSelfIntersections,
  indexedMesh,
  inspectGeometry,
  meshData,
  validateGeometryResult,
  vertexNormals,
  type Face,
  type IndexedMesh,
} from './editing-geometry';
import { add3, cross3, distance3, dot3, length3, normalize3, scale3, subtract3 } from './geometry';
import { CROWN_MATERIAL_PROFILES, morphologyHeight, MORPHOLOGY_DEFINITIONS, validateCrownParameters } from './morphology-core';
import type { CrownGenerationInput, CrownLocks, CrownMaterialProfile, CrownRegion, CrownTopologyMap } from './restoration-types';

const EPSILON = 1e-8;

export interface CrownSolidResult {
  mesh: MeshData;
  indexed: IndexedMesh;
  topologyMap: CrownTopologyMap;
  inspection: ReturnType<typeof inspectGeometry>;
  preparationSurfacePoints: Vec3[];
  requestedGapByInnerVertex: Record<number, number>;
  stageDurationsMs: {
    solidConstructionMs: number;
    morphologyGenerationMs: number;
    intaglioGenerationMs: number;
    spacerCalculationMs: number;
  };
  warnings: string[];
}

export interface CrownSolidHooks {
  progress?: (stage: string, completed: number, total: number, message: string) => void;
  cancelled?: () => boolean;
}

interface Basis { origin: Vec3; u: Vec3; v: Vec3; axis: Vec3; }
interface LocalPoint { x: number; y: number; z: number; }
interface LocalTriangle { a: LocalPoint; b: LocalPoint; c: LocalPoint; minX: number; maxX: number; minY: number; maxY: number; }

function basisFor(axisInput: Vec3, origin: Vec3): Basis {
  const axis = normalize3(axisInput);
  if (length3(axis) < 0.99) throw new Error('Insertion axis must be a finite non-zero vector.');
  const helper: Vec3 = Math.abs(axis[2]) < 0.86 ? [0, 0, 1] : [0, 1, 0];
  const u = normalize3(cross3(helper, axis));
  const v = normalize3(cross3(axis, u));
  return { origin, u, v, axis };
}

function local(point: Vec3, basis: Basis): LocalPoint {
  const relative = subtract3(point, basis.origin);
  return { x: dot3(relative, basis.u), y: dot3(relative, basis.v), z: dot3(relative, basis.axis) };
}

function world(point: LocalPoint, basis: Basis): Vec3 {
  return add3(basis.origin, add3(scale3(basis.u, point.x), add3(scale3(basis.v, point.y), scale3(basis.axis, point.z))));
}

function finiteMargin(points: Vec3[]): Vec3[] {
  if (points.some((point) => point.length !== 3 || !point.every(Number.isFinite))) throw new Error('Approved margin contains a non-finite or malformed model-space point.');
  const cleaned = points.map((point) => [...point] as Vec3);
  if (cleaned.length > 1 && distance3(cleaned[0], cleaned[cleaned.length - 1]) < 1e-6) cleaned.pop();
  if (cleaned.length < 8) throw new Error('Approved margin requires at least eight distinct finite model-space points.');
  return cleaned;
}

export function resampleClosedMargin(points: Vec3[], count: number): Vec3[] {
  const source = finiteMargin(points);
  const cumulative = [0];
  for (let index = 0; index < source.length; index += 1) cumulative.push(cumulative[index] + distance3(source[index], source[(index + 1) % source.length]));
  const total = cumulative[cumulative.length - 1];
  if (total < 1e-4) throw new Error('Approved margin perimeter is too small to generate a restoration.');
  const output: Vec3[] = [];
  for (let sample = 0; sample < count; sample += 1) {
    const target = total * sample / count;
    let segment = 0;
    while (segment + 1 < cumulative.length && cumulative[segment + 1] < target) segment += 1;
    const start = source[segment % source.length]; const end = source[(segment + 1) % source.length];
    const span = cumulative[segment + 1] - cumulative[segment];
    const t = span > EPSILON ? (target - cumulative[segment]) / span : 0;
    output.push(add3(start, scale3(subtract3(end, start), t)));
  }
  return output;
}

function mean(points: Vec3[]): Vec3 {
  return scale3(points.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / points.length);
}

function preparationTriangles(mesh: MeshData, basis: Basis): { triangles: LocalTriangle[]; vertices: LocalPoint[] } {
  const indexed = indexedMesh(mesh);
  const vertices = indexed.positions.map((point) => local(point, basis));
  const triangles = indexed.faces.map(([a, b, c]) => {
    const points = [vertices[a], vertices[b], vertices[c]] as [LocalPoint, LocalPoint, LocalPoint];
    return {
      a: points[0], b: points[1], c: points[2],
      minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)), maxY: Math.max(...points.map((point) => point.y)),
    };
  });
  return { triangles, vertices };
}

function barycentricHeight(x: number, y: number, triangle: LocalTriangle): number | null {
  if (x < triangle.minX - EPSILON || x > triangle.maxX + EPSILON || y < triangle.minY - EPSILON || y > triangle.maxY + EPSILON) return null;
  const { a, b, c } = triangle;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) < EPSILON) return null;
  const first = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
  const second = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
  const third = 1 - first - second;
  if (first < -1e-7 || second < -1e-7 || third < -1e-7) return null;
  return first * a.z + second * b.z + third * c.z;
}

function samplePreparationHeight(x: number, y: number, triangles: LocalTriangle[], vertices: LocalPoint[]): { z: number; fallback: boolean } {
  let selected = -Infinity;
  for (const triangle of triangles) {
    const height = barycentricHeight(x, y, triangle);
    if (height !== null && height > selected) selected = height;
  }
  if (Number.isFinite(selected)) return { z: selected, fallback: false };
  let nearest = vertices[0]; let minimum = Infinity;
  for (const vertex of vertices) {
    const distance = Math.hypot(vertex.x - x, vertex.y - y);
    if (distance < minimum) { nearest = vertex; minimum = distance; }
  }
  if (!nearest) throw new Error('Preparation mesh contains no usable surface vertices.');
  return { z: nearest.z, fallback: true };
}

function regionFor(t: number, normalizedHeight: number, anterior: boolean): CrownRegion {
  if (t < 0.08) return 'margin';
  if (t < 0.48) return 'axial';
  if (anterior) return 'incisal';
  if (normalizedHeight > 0.72) return 'cusp';
  if (normalizedHeight < 0.34) return 'fossa';
  return 'occlusal';
}

function requestedThickness(region: CrownRegion, material: CrownMaterialProfile): number {
  return Math.max(material.minimumThicknessMm.global, material.minimumThicknessMm[region]);
}

function ringFaces(start: number, next: number, segments: number, reversed = false): Face[] {
  const faces: Face[] = [];
  for (let segment = 0; segment < segments; segment += 1) {
    const following = (segment + 1) % segments;
    const first: Face = [start + segment, start + following, next + following];
    const second: Face = [start + segment, next + following, next + segment];
    faces.push(reversed ? [first[0], first[2], first[1]] : first, reversed ? [second[0], second[2], second[1]] : second);
  }
  return faces;
}

function fanFaces(ringStart: number, center: number, segments: number, reversed = false): Face[] {
  const faces: Face[] = [];
  for (let segment = 0; segment < segments; segment += 1) {
    const face: Face = [ringStart + segment, ringStart + (segment + 1) % segments, center];
    faces.push(reversed ? [face[0], face[2], face[1]] : face);
  }
  return faces;
}

function orientPositive(mesh: IndexedMesh): IndexedMesh {
  const volume = mesh.faces.reduce((sum, face) => sum + dot3(mesh.positions[face[0]], cross3(mesh.positions[face[1]], mesh.positions[face[2]])) / 6, 0);
  return volume < 0 ? { positions: mesh.positions, faces: mesh.faces.map(([a, b, c]) => [a, c, b]) } : mesh;
}

export function buildCrownSolid(input: CrownGenerationInput, hooks: CrownSolidHooks = {}): CrownSolidResult {
  const solidStarted = performance.now();
  let morphologyGenerationMs = 0;
  let intaglioGenerationMs = 0;
  let spacerCalculationMs = 0;
  const errors = validateCrownParameters(input.parameters, input.materialProfileId);
  if (errors.length) throw new Error(errors.join(' '));
  if (hooks.cancelled?.()) throw new Error('Crown generation cancelled.');
  const definition = MORPHOLOGY_DEFINITIONS[input.parameters.morphologyId];
  if (!definition.toothNumbers.includes(Number(input.toothNumber))) throw new Error(`Morphology ${definition.label} is not governed for tooth ${input.toothNumber}.`);
  const material = importMaterial(input.materialProfileId);
  const segments = input.parameters.radialSegments;
  const rings = input.parameters.surfaceRings;
  const margin = resampleClosedMargin(input.marginPoints, segments);
  const center = mean(margin);
  const basis = basisFor(input.insertionAxis, center);
  const marginLocal = margin.map((point) => local(point, basis));
  const signedArea = marginLocal.reduce((sum, point, index) => {
    const next = marginLocal[(index + 1) % marginLocal.length]; return sum + point.x * next.y - next.x * point.y;
  }, 0) * 0.5;
  if (Math.abs(signedArea) < 1e-4) throw new Error('Approved margin does not enclose a usable model-space area.');
  if (signedArea < 0) marginLocal.reverse();
  hooks.progress?.('intaglio', 0, rings * segments, 'Sampling the preparation along the approved insertion axis.');
  let stageStarted = performance.now();
  const prep = preparationTriangles(input.preparationMesh, basis);
  intaglioGenerationMs += performance.now() - stageStarted;
  const reference = input.reference ? preparationTriangles(input.reference.mesh, basis) : null;
  const averageRadius = marginLocal.reduce((sum, point) => sum + Math.hypot(point.x, point.y), 0) / marginLocal.length;
  const maxX = Math.max(...marginLocal.map((point) => Math.abs(point.x)), EPSILON);
  const maxY = Math.max(...marginLocal.map((point) => Math.abs(point.y)), EPSILON);
  const targetX = Math.max(maxX, definition.crownDimensionsMm.mesiodistal * input.parameters.mesiodistalScale * 0.5);
  const targetY = Math.max(maxY, definition.crownDimensionsMm.buccolingual * input.parameters.buccolingualScale * 0.5);
  const positions: Vec3[] = [];
  const outerVertexIds: number[] = []; const innerVertexIds: number[] = [];
  const marginOuterVertexIds: number[] = []; const marginInnerVertexIds: number[] = [];
  const outerToInner: Record<number, number> = {}; const regions: Record<number, CrownRegion> = {};
  const preparationSurfacePoints: Vec3[] = []; const requestedGapByInnerVertex: Record<number, number> = {};
  const outerLocal: LocalPoint[][] = []; const innerLocal: LocalPoint[][] = []; const preparationLocal: LocalPoint[][] = [];
  let fallbackSamples = 0;
  for (let ring = 0; ring < rings; ring += 1) {
    if (hooks.cancelled?.()) throw new Error('Crown generation cancelled.');
    const t = ring / rings;
    const ringOuter: LocalPoint[] = []; const ringInner: LocalPoint[] = []; const ringPreparation: LocalPoint[] = [];
    for (let segment = 0; segment < segments; segment += 1) {
      const marginPoint = marginLocal[segment];
      const x = marginPoint.x * (1 - t); const y = marginPoint.y * (1 - t);
      stageStarted = performance.now();
      const sample = samplePreparationHeight(x, y, prep.triangles, prep.vertices);
      intaglioGenerationMs += performance.now() - stageStarted;
      if (sample.fallback) fallbackSamples += 1;
      const nx = x / maxX; const ny = y / maxY;
      stageStarted = performance.now();
      const gap = requestedGap(input.parameters, t, averageRadius, nx, ny);
      spacerCalculationMs += performance.now() - stageStarted;
      const innerPoint: LocalPoint = { x, y, z: sample.z + gap };
      stageStarted = performance.now();
      const anatomy = morphologyHeight(definition, input.parameters, nx, ny);
      morphologyGenerationMs += performance.now() - stageStarted;
      const normalizedAnatomy = Math.min(1, anatomy / Math.max(0.1, input.parameters.anatomyIntensity));
      const region = regionFor(t, normalizedAnatomy, definition.mamelonCount > 0 || definition.cusps.length <= 3);
      const minimumThickness = requestedThickness(region, material);
      const radialLength = Math.hypot(x, y) || 1;
      const cervicalTransition = Math.pow(Math.min(1, t / 0.5), 1.5); const shapeEnvelope = Math.pow(Math.sin(Math.PI * t), 0.72) * Math.sqrt(Math.max(0, 1 - t)) * cervicalTransition;
      const extraX = Math.max(0, targetX - maxX) * shapeEnvelope * Math.sign(x);
      const extraY = Math.max(0, targetY - maxY) * shapeEnvelope * Math.sign(y);
      const facialWeight = Math.max(0, -ny); const lingualWeight = Math.max(0, ny); const mesialWeight = Math.max(0, -nx); const distalWeight = Math.max(0, nx); const directionalWeight = facialWeight + lingualWeight + mesialWeight + distalWeight || 1;
      const directionalEmergence = (facialWeight * input.parameters.facialEmergence + lingualWeight * input.parameters.lingualEmergence + mesialWeight * input.parameters.mesialEmergence + distalWeight * input.parameters.distalEmergence) / directionalWeight;
      const localEmergenceDistance = Math.hypot(nx - input.parameters.localEmergenceX, ny - input.parameters.localEmergenceY);
      const localEmergence = Math.exp(-Math.pow(localEmergenceDistance / Math.max(0.05, input.parameters.localEmergenceRadius), 2)) * input.parameters.localEmergenceStrength;
      const emergenceEnvelope = Math.min(1, t / 0.16) * Math.max(0, 1 - t / 0.52);
      const emergenceAngle = Math.tan(input.parameters.emergenceAngleDegrees * Math.PI / 180) * averageRadius * t * emergenceEnvelope;
      const emergenceProfile = 1 + input.parameters.emergenceConvexity * t * (1 - t) - input.parameters.emergenceConcavity * Math.sin(Math.PI * t) * 0.35;
      const cervicalExpansion = (minimumThickness * (1 - t) * 0.7 * input.parameters.cervicalFullness * directionalEmergence * emergenceProfile + emergenceAngle + localEmergence) * emergenceEnvelope;
      let outerPoint: LocalPoint = {
        x: x + extraX + cervicalExpansion * x / radialLength,
        y: y + extraY + cervicalExpansion * y / radialLength,
        z: innerPoint.z + minimumThickness + anatomy * definition.crownDimensionsMm.height * 0.36 + (region === 'incisal' ? input.parameters.incisalTranslucencySpaceMm : 0),
      };
      if (reference) {
        const referenceSample = samplePreparationHeight(outerPoint.x, outerPoint.y, reference.triangles, reference.vertices);
        const influence = referenceInfluence(input, nx, ny, t, region);
        if (!referenceSample.fallback && influence > 0 && referenceSample.z > innerPoint.z + minimumThickness) outerPoint = { ...outerPoint, z: outerPoint.z * (1 - influence) + referenceSample.z * influence };
      }
      ringPreparation.push({ x, y, z: sample.z }); ringInner.push(innerPoint); ringOuter.push(outerPoint);
      hooks.progress?.('intaglio', ring * segments + segment + 1, rings * segments, 'Sampling actual preparation geometry.');
    }
    preparationLocal.push(ringPreparation); innerLocal.push(ringInner); outerLocal.push(ringOuter);
  }
  stageStarted = performance.now();
  applySharpFeatureRelief(innerLocal, outerLocal, preparationLocal, input.parameters.sharpFeatureReliefMm, material.cementGapMm.maximum);
  const effectiveInternalRadius = Math.max(input.parameters.internalRadiusMm, input.parameters.millingToolDiameterMm * 0.5 + input.parameters.toolAccessAllowanceMm);
  roundInternalTransitions(innerLocal, outerLocal, preparationLocal, effectiveInternalRadius, input.parameters.localReliefMm + input.parameters.sharpFeatureReliefMm, material.cementGapMm.maximum);
  intaglioGenerationMs += performance.now() - stageStarted;
  stageStarted = performance.now();
  const centerSample = samplePreparationHeight(0, 0, prep.triangles, prep.vertices);
  intaglioGenerationMs += performance.now() - stageStarted;
  if (centerSample.fallback) fallbackSamples += 1;
  stageStarted = performance.now();
  const centerGap = requestedGap(input.parameters, 1, averageRadius, 0, 0);
  spacerCalculationMs += performance.now() - stageStarted;
  const innerCenter: LocalPoint = { x: 0, y: 0, z: centerSample.z + centerGap };
  stageStarted = performance.now();
  const centerAnatomy = morphologyHeight(definition, input.parameters, 0, 0);
  morphologyGenerationMs += performance.now() - stageStarted;
  let outerCenter: LocalPoint = { x: 0, y: 0, z: innerCenter.z + material.minimumThicknessMm.occlusal + centerAnatomy * definition.crownDimensionsMm.height * 0.36 + (definition.mamelonCount > 0 ? input.parameters.incisalTranslucencySpaceMm : 0) };
  if (reference) {
    const referenceCenter = samplePreparationHeight(0, 0, reference.triangles, reference.vertices);
    const influence = referenceInfluence(input, 0, 0, 1, definition.mamelonCount > 0 ? 'incisal' : 'occlusal');
    if (!referenceCenter.fallback && influence > 0 && referenceCenter.z > innerCenter.z + material.minimumThicknessMm.occlusal) outerCenter = { ...outerCenter, z: outerCenter.z * (1 - influence) + referenceCenter.z * influence };
  }

  enforcePairedLocalThickness(innerLocal, outerLocal, material, definition.mamelonCount > 0 || definition.cusps.length <= 3);

  for (const ring of outerLocal) for (const point of ring) { outerVertexIds.push(positions.length); positions.push(world(point, basis)); }
  const outerCenterId = positions.length; outerVertexIds.push(outerCenterId); positions.push(world(outerCenter, basis));
  for (const ring of innerLocal) for (const point of ring) { innerVertexIds.push(positions.length); positions.push(world(point, basis)); }
  const innerCenterId = positions.length; innerVertexIds.push(innerCenterId); positions.push(world(innerCenter, basis));
  for (let index = 0; index < rings * segments; index += 1) {
    const outerId = index; const innerId = rings * segments + 1 + index;
    outerToInner[outerId] = innerId;
    const ring = Math.floor(index / segments); const t = ring / rings;
    stageStarted = performance.now();
    const normalized = morphologyHeight(definition, input.parameters, outerLocal[ring][index % segments].x / maxX, outerLocal[ring][index % segments].y / maxY) / Math.max(0.1, input.parameters.anatomyIntensity);
    morphologyGenerationMs += performance.now() - stageStarted;
    regions[outerId] = regionFor(t, normalized, definition.mamelonCount > 0 || definition.cusps.length <= 3);
    preparationSurfacePoints.push(world(preparationLocal[ring][index % segments], basis));
    stageStarted = performance.now();
    requestedGapByInnerVertex[innerId] = requestedGap(input.parameters, t, averageRadius, outerLocal[ring][index % segments].x / maxX, outerLocal[ring][index % segments].y / maxY);
    spacerCalculationMs += performance.now() - stageStarted;
    if (ring === 0) { marginOuterVertexIds.push(outerId); marginInnerVertexIds.push(innerId); }
  }
  outerToInner[outerCenterId] = innerCenterId; regions[outerCenterId] = definition.mamelonCount > 0 ? 'incisal' : 'occlusal';
  preparationSurfacePoints.push(world({ ...innerCenter, z: innerCenter.z - centerGap }, basis)); requestedGapByInnerVertex[innerCenterId] = centerGap;

  const faces: Face[] = [];
  for (let ring = 0; ring < rings - 1; ring += 1) faces.push(...ringFaces(ring * segments, (ring + 1) * segments, segments));
  faces.push(...fanFaces((rings - 1) * segments, outerCenterId, segments));
  const innerOffset = rings * segments + 1;
  for (let ring = 0; ring < rings - 1; ring += 1) faces.push(...ringFaces(innerOffset + ring * segments, innerOffset + (ring + 1) * segments, segments, true));
  faces.push(...fanFaces(innerOffset + (rings - 1) * segments, innerCenterId, segments, true));
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments; const outer = segment; const outerNext = next; const inner = innerOffset + segment; const innerNext = innerOffset + next;
    faces.push([outerNext, outer, inner], [outerNext, inner, innerNext]);
  }
  hooks.progress?.('topology', 1, 1, 'Validating the closed restoration topology.');
  const oriented = orientPositive({ positions, faces }); const repaired = repairOuterSurfaceIntersections(oriented, outerVertexIds, marginOuterVertexIds, outerToInner, regions, material);
  const indexed = repaired.mesh; const inspection = validateGeometryResult(indexed);
  const topologyMap: CrownTopologyMap = { outerVertexIds, innerVertexIds, marginOuterVertexIds, marginInnerVertexIds, outerToInner, regions };
  const warnings: string[] = [];
  if (fallbackSamples) warnings.push(`${fallbackSamples} intaglio sample${fallbackSamples === 1 ? '' : 's'} fell outside the preparation's projected triangle coverage and used the nearest preparation vertex.`);
  if (repaired.originalIntersectionCount) warnings.push(`Resolved ${repaired.originalIntersectionCount} outer-surface triangle intersections with bounded local topology-preserving relaxation; the approved margin and intaglio remained unchanged.`);
  return {
    mesh: meshData(indexed), indexed, topologyMap, inspection, preparationSurfacePoints, requestedGapByInnerVertex,
    stageDurationsMs: {
      solidConstructionMs: performance.now() - solidStarted,
      morphologyGenerationMs,
      intaglioGenerationMs,
      spacerCalculationMs,
    },
    warnings,
  };
}

function repairOuterSurfaceIntersections(mesh: IndexedMesh, outerVertexIds: number[], marginVertexIds: number[], outerToInner: Record<number, number>, regions: Record<number, CrownRegion>, material: CrownMaterialProfile): { mesh: IndexedMesh; originalIntersectionCount: number } {
  const first = detectSelfIntersections(mesh); if (!first.length) return { mesh, originalIntersectionCount: 0 };
  const outer = new Set(outerVertexIds); const margin = new Set(marginVertexIds); let candidate: IndexedMesh = { positions: mesh.positions.map((point) => [...point] as Vec3), faces: mesh.faces.map((face) => [...face]) }; const originalIntersectionCount = first.length;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const intersections = detectSelfIntersections(candidate); if (!intersections.length) return { mesh: candidate, originalIntersectionCount };
    const topology = buildTopology(candidate); const affected = new Set(intersections.flatMap(([firstFace, secondFace]) => [...candidate.faces[firstFace], ...candidate.faces[secondFace]]).filter((id) => outer.has(id) && !margin.has(id)));
    if (!affected.size) break; const source = candidate.positions.map((point) => [...point] as Vec3);
    for (const id of affected) {
      const neighbors = [...new Set(topology.vertexEdges[id].flatMap((edgeId) => topology.edges[edgeId]).filter((value) => value !== id && outer.has(value)))]; if (!neighbors.length) continue;
      const average = scale3(neighbors.reduce<Vec3>((sum, neighbor) => add3(sum, source[neighbor]), [0, 0, 0]), 1 / neighbors.length); const delta = subtract3(average, source[id]); const bounded = scale3(normalize3(delta), Math.min(length3(delta) * 0.3, 0.12)); candidate.positions[id] = add3(source[id], bounded);
    }
    for (const id of affected) {
      const innerId = outerToInner[id]; if (innerId === undefined) continue; const relative = subtract3(candidate.positions[id], candidate.positions[innerId]); const current = length3(relative); const required = requestedThickness(regions[id] ?? 'axial', material) + 0.005; if (current < required) candidate.positions[id] = add3(candidate.positions[innerId], scale3(normalize3(relative), required));
    }
  }
  return { mesh: candidate, originalIntersectionCount };
}

function applySharpFeatureRelief(inner: LocalPoint[][], outer: LocalPoint[][], preparation: LocalPoint[][], reliefMm: number, maximumCementGapMm: number): void {
  if (reliefMm <= 0 || inner.length < 2) return; const segments = inner[0].length; const source = preparation.map((ring) => ring.map((point) => ({ ...point })));
  for (let ring = 1; ring < inner.length; ring += 1) for (let segment = 0; segment < segments; segment += 1) {
    const neighbors = [source[ring][(segment + segments - 1) % segments], source[ring][(segment + 1) % segments], source[ring - 1][segment]]; if (ring + 1 < source.length) neighbors.push(source[ring + 1][segment]); const average = neighbors.reduce((sum, point) => sum + point.z, 0) / neighbors.length; const curvature = Math.abs(source[ring][segment].z - average); const weight = Math.min(1, curvature / 0.04); if (weight <= 1e-6) continue;
    const maximum = source[ring][segment].z + maximumCementGapMm + reliefMm; const delta = Math.max(0, Math.min(reliefMm * weight, maximum - inner[ring][segment].z)); inner[ring][segment].z += delta; outer[ring][segment].z += delta;
  }
}

function requestedGap(parameters: CrownGenerationInput['parameters'], t: number, averageRadius: number, normalizedX: number, normalizedY: number): number {
  const insetDistance = averageRadius * t;
  const blend = Math.max(0, Math.min(1, (insetDistance - parameters.spacerStartMm) / Math.max(averageRadius - parameters.spacerStartMm, 1e-6)));
  const axialGap = (parameters.cementGapMm + parameters.axialSpacerMm) * 0.5;
  const localDistance = Math.hypot(normalizedX - parameters.localSpacerCenterX, normalizedY - parameters.localSpacerCenterY);
  const localWeight = Math.exp(-Math.pow(localDistance / Math.max(0.05, parameters.localSpacerRadius), 2));
  return (parameters.marginalGapMm * (1 - blend) + (axialGap * (1 - t) + parameters.occlusalSpacerMm * t) * blend + parameters.localReliefMm + parameters.localSpacerOverrideMm * localWeight) * (1 + parameters.manufacturingCompensationPercent / 100);
}

function referenceInfluence(input: CrownGenerationInput, normalizedX: number, normalizedY: number, t: number, region: CrownRegion): number {
  if (!input.reference || input.referenceAdaptation.mode === 'none') return 0;
  const base = Math.max(0, Math.min(1, input.referenceAdaptation.influence));
  switch (input.referenceAdaptation.mode) {
    case 'copy': return 1;
    case 'blend': return base;
    case 'partial-copy': return t >= 0.45 ? base : 0;
    case 'preserve-facial': return normalizedY < 0 ? base : 0;
    case 'preserve-incisal': return region === 'incisal' ? base : 0;
    case 'preserve-occlusal-table': return ['occlusal', 'cusp', 'fossa'].includes(region) ? base : 0;
    case 'preserve-selected-region': {
      const selected = input.referenceAdaptation.selectedRegion;
      return selected && Math.hypot(normalizedX - selected.centerX, normalizedY - selected.centerY) <= selected.radius ? base : 0;
    }
    default: return 0;
  }
}

/**
 * Rounds concave intaglio transitions in insertion-axis space. The operation is
 * bounded by the material's maximum cement space and carries the same delta to
 * the paired outer surface so it cannot silently reduce wall thickness.
 */
function roundInternalTransitions(
  inner: LocalPoint[][],
  outer: LocalPoint[][],
  preparation: LocalPoint[][],
  radiusMm: number,
  localReliefMm: number,
  maximumCementGapMm: number,
): void {
  if (!inner.length || radiusMm <= 0) return;
  const iterations = Math.max(1, Math.min(6, Math.ceil(radiusMm / 0.35)));
  const strength = Math.min(0.32, 0.08 + radiusMm * 0.1);
  const segments = inner[0].length;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const source = inner.map((ring) => ring.map((point) => ({ ...point })));
    for (let ring = 1; ring < inner.length; ring += 1) {
      for (let segment = 0; segment < segments; segment += 1) {
        const neighbors = [source[ring][(segment + segments - 1) % segments], source[ring][(segment + 1) % segments], source[ring - 1][segment]];
        if (ring + 1 < inner.length) neighbors.push(source[ring + 1][segment]);
        const averageZ = neighbors.reduce((sum, point) => sum + point.z, 0) / neighbors.length;
        const candidate = source[ring][segment].z + Math.max(0, averageZ - source[ring][segment].z) * strength;
        const maximumZ = preparation[ring][segment].z + maximumCementGapMm + Math.max(0, localReliefMm);
        const nextZ = Math.min(maximumZ, candidate);
        const delta = Math.max(0, nextZ - source[ring][segment].z);
        inner[ring][segment].z += delta;
        outer[ring][segment].z += delta;
      }
    }
  }
}

function enforcePairedLocalThickness(inner: LocalPoint[][], outer: LocalPoint[][], material: CrownMaterialProfile, anterior: boolean): void {
  for (let ring = 0; ring < outer.length; ring += 1) {
    const t = ring / outer.length;
    for (let segment = 0; segment < outer[ring].length; segment += 1) {
      const relative: Vec3 = [outer[ring][segment].x - inner[ring][segment].x, outer[ring][segment].y - inner[ring][segment].y, outer[ring][segment].z - inner[ring][segment].z]; const current = length3(relative);
      const normalizedHeight = Math.min(1, Math.max(0, current / Math.max(material.minimumThicknessMm.global, material.minimumThicknessMm.occlusal))); const required = requestedThickness(regionFor(t, normalizedHeight, anterior), material);
      if (current + 1e-6 >= required) continue; const direction = normalize3(relative); const distance = required + 0.005;
      outer[ring][segment] = { x: inner[ring][segment].x + direction[0] * distance, y: inner[ring][segment].y + direction[1] * distance, z: inner[ring][segment].z + direction[2] * distance };
    }
  }
}


function importMaterial(id: CrownGenerationInput['materialProfileId']): CrownMaterialProfile {
  const profile = CROWN_MATERIAL_PROFILES[id];
  if (!profile) throw new Error(`Material profile ${id} is not registered.`);
  return profile;
}

export interface CrownSculptInput {
  center: Vec3;
  radiusMm: number;
  strengthMm: number;
  mode: CrownSculptMode;
  falloff?: 'linear' | 'smooth' | 'sharp';
  surfaceConstraint?: boolean;
  maskVertexIds?: number[];
  invertMask?: boolean;
  smoothMask?: boolean;
  symmetryAxis?: 'x' | 'y' | 'z' | null;
  direction?: Vec3;
  lockedVertexIds?: number[];
}

export type CrownSculptMode = 'add' | 'remove' | 'smooth' | 'flatten' | 'inflate' | 'deflate' | 'pinch' | 'crease' | 'grab' | 'drag' | 'carve' | 'wax-knife' | 'scrape' | 'polish' | 'sharpen' | 'fill' | 'local-relax';

export const CROWN_SCULPT_MODES: readonly CrownSculptMode[] = ['add', 'remove', 'smooth', 'flatten', 'inflate', 'deflate', 'pinch', 'crease', 'grab', 'drag', 'carve', 'wax-knife', 'scrape', 'polish', 'sharpen', 'fill', 'local-relax'];

export function sculptCrownSurface(mesh: MeshData, topologyMap: CrownTopologyMap, input: CrownSculptInput, locks: CrownLocks): MeshData {
  if (locks.anatomy) throw new Error('Anatomy lock prevents local sculpting.');
  if (!Number.isFinite(input.radiusMm) || input.radiusMm <= 0 || !Number.isFinite(input.strengthMm)) throw new Error('Sculpt radius and strength must be finite, with radius greater than zero.');
  if (!CROWN_SCULPT_MODES.includes(input.mode)) throw new Error(`Unsupported crown sculpt mode ${String(input.mode)}.`);
  if (input.direction && (input.direction.length !== 3 || input.direction.some((value) => !Number.isFinite(value)))) throw new Error('Sculpt direction must be a finite model-space vector.');
  const indexed = indexedMesh(mesh); const normals = vertexNormals(indexed); const topology = importTopology(indexed); const outer = new Set(topologyMap.outerVertexIds); const margin = new Set(topologyMap.marginOuterVertexIds); const locked = new Set(input.lockedVertexIds ?? []);
  const next = indexed.positions.map((point) => [...point] as Vec3);
  const center = mean(topologyMap.outerVertexIds.map((id) => indexed.positions[id]));
  const mask = new Set(input.maskVertexIds ?? []);
  const maskWeight = (id: number): number => {
    if (!mask.size) return 1;
    const directlyEditable = input.invertMask ? mask.has(id) : !mask.has(id);
    if (!input.smoothMask) return directlyEditable ? 1 : 0;
    const neighbors = topology.vertexEdges[id].flatMap((edgeId) => topology.edges[edgeId]).filter((value) => value !== id && outer.has(value));
    const editableNeighbors = neighbors.filter((value) => input.invertMask ? mask.has(value) : !mask.has(value)).length;
    return (Number(directlyEditable) * 2 + editableNeighbors) / Math.max(2, 2 + neighbors.length);
  };
  const lockRejects = (id: number): boolean => {
    const point = indexed.positions[id]; const region = topologyMap.regions[id];
    return (locks.margin && margin.has(id))
      || (locks.selectedAnatomy && locked.has(id))
      || (locks.facialContour && point[1] <= center[1])
      || (locks.lingualContour && point[1] > center[1])
      || (locks.mesialContact && point[0] <= center[0])
      || (locks.distalContact && point[0] > center[0])
      || (locks.occlusion && ['occlusal', 'incisal', 'cusp', 'fossa'].includes(region));
  };
  let affected = topologyMap.outerVertexIds.filter((id) => distance3(indexed.positions[id], input.center) <= input.radiusMm && !lockRejects(id) && maskWeight(id) > 0);
  if (!affected.length) throw new Error('Sculpt brush does not intersect the editable crown surface.');
  if (input.symmetryAxis) {
    const axis = input.symmetryAxis === 'x' ? 0 : input.symmetryAxis === 'y' ? 1 : 2;
    const mirrored = affected.flatMap((id) => {
      const target = [...indexed.positions[id]] as Vec3; target[axis] = center[axis] - (target[axis] - center[axis]);
      let nearest = -1; let minimum = Infinity;
      for (const candidate of topologyMap.outerVertexIds) { const value = distance3(indexed.positions[candidate], target); if (value < minimum) { minimum = value; nearest = candidate; } }
      return nearest >= 0 && minimum <= input.radiusMm * 0.35 && !lockRejects(nearest) && maskWeight(nearest) > 0 ? [nearest] : [];
    });
    affected = [...new Set([...affected, ...mirrored])];
  }
  const source = indexed.positions;
  const averageNormal = normalize3(affected.reduce<Vec3>((sum, id) => add3(sum, normals[id]), [0, 0, 0]));
  const requestedDirection = normalize3(input.direction ?? averageNormal);
  for (const id of affected) {
    const point = source[id]; const ratio = Math.min(1, distance3(point, input.center) / input.radiusMm); const weight = sculptFalloff(ratio, input.falloff ?? 'smooth') * maskWeight(id); const magnitude = Math.abs(input.strengthMm) * weight;
    if (!magnitude) continue;
    const neighbors = topology.vertexEdges[id].flatMap((edgeId) => topology.edges[edgeId]).filter((value) => value !== id && outer.has(value));
    const average = neighbors.length ? scale3(neighbors.reduce<Vec3>((sum, neighbor) => add3(sum, source[neighbor]), [0, 0, 0]), 1 / neighbors.length) : point;
    const laplacian = subtract3(average, point);
    switch (input.mode) {
      case 'add': case 'inflate': case 'fill': next[id] = add3(point, scale3(normals[id], magnitude)); break;
      case 'remove': case 'deflate': case 'carve': next[id] = add3(point, scale3(normals[id], -magnitude)); break;
      case 'smooth': next[id] = add3(point, scale3(laplacian, Math.min(1, magnitude))); break;
      case 'polish': next[id] = add3(point, scale3(laplacian, Math.min(0.75, magnitude * 0.65))); break;
      case 'local-relax': next[id] = add3(point, scale3(laplacian, Math.min(0.5, magnitude * 0.45))); break;
      case 'flatten': {
        const signed = dot3(subtract3(point, input.center), averageNormal); next[id] = add3(point, scale3(averageNormal, -signed * Math.min(1, magnitude))); break;
      }
      case 'pinch': {
        const radial = subtract3(input.center, point); const tangent = subtract3(radial, scale3(normals[id], dot3(radial, normals[id]))); next[id] = add3(point, scale3(normalize3(tangent), magnitude)); break;
      }
      case 'crease': {
        const radial = subtract3(input.center, point); const tangent = subtract3(radial, scale3(normals[id], dot3(radial, normals[id]))); next[id] = add3(point, add3(scale3(normalize3(tangent), magnitude * 0.55), scale3(normals[id], -magnitude * 0.45))); break;
      }
      case 'sharpen': {
        const curvature = subtract3(point, average); next[id] = add3(point, scale3(normalize3(curvature), magnitude)); break;
      }
      case 'grab': case 'drag': {
        const constrained = input.surfaceConstraint || input.mode === 'drag' ? subtract3(requestedDirection, scale3(normals[id], dot3(requestedDirection, normals[id]))) : requestedDirection;
        next[id] = add3(point, scale3(normalize3(constrained), magnitude)); break;
      }
      case 'wax-knife': {
        const side = dot3(subtract3(point, input.center), requestedDirection) >= 0 ? 1 : -1; next[id] = add3(point, scale3(normals[id], side * magnitude)); break;
      }
      case 'scrape': {
        const signed = dot3(subtract3(point, input.center), averageNormal); if (signed > 0) next[id] = add3(point, scale3(averageNormal, -Math.min(signed, magnitude))); break;
      }
    }
  }
  const result = { positions: next, faces: indexed.faces };
  validateGeometryResult(result);
  return meshData(result);
}

function sculptFalloff(ratio: number, mode: NonNullable<CrownSculptInput['falloff']>): number {
  const value = Math.max(0, 1 - ratio);
  if (mode === 'linear') return value;
  if (mode === 'sharp') return value ** 4;
  return value * value * (3 - 2 * value);
}

function importTopology(mesh: IndexedMesh) {
  return buildTopologyStatic(mesh);
}

import { buildTopology as buildTopologyStatic } from './editing-geometry';

export function scaleCrownAnatomy(mesh: MeshData, topologyMap: CrownTopologyMap, center: Vec3, scale: Vec3, locks: CrownLocks, lockedVertexIds: number[] = []): MeshData {
  if (locks.anatomy) throw new Error('Anatomy lock prevents global crown morphing.');
  if (scale.some((value) => !Number.isFinite(value) || value < 0.7 || value > 1.3)) throw new Error('Crown morph scale must be finite and remain between 0.7 and 1.3.');
  const indexed = indexedMesh(mesh); const outer = new Set(topologyMap.outerVertexIds); const margin = new Set(topologyMap.marginOuterVertexIds); const selectedLocks = new Set(lockedVertexIds);
  const positions = indexed.positions.map((point, id) => {
    const region = topologyMap.regions[id];
    const constrained = !outer.has(id)
      || (locks.margin && margin.has(id))
      || (locks.selectedAnatomy && selectedLocks.has(id))
      || (locks.facialContour && point[1] <= center[1])
      || (locks.lingualContour && point[1] > center[1])
      || (locks.mesialContact && point[0] <= center[0])
      || (locks.distalContact && point[0] > center[0])
      || (locks.occlusion && ['occlusal', 'incisal', 'cusp', 'fossa'].includes(region));
    if (constrained) return [...point] as Vec3;
    const relative = subtract3(point, center); return add3(center, [relative[0] * scale[0], relative[1] * scale[1], relative[2] * scale[2]]);
  });
  const result = { positions, faces: indexed.faces };
  validateGeometryResult(result);
  return meshData(result);
}
