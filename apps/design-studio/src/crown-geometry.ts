import type { MeshData, Vec3 } from './core';
import {
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
import type { CrownGenerationInput, CrownMaterialProfile, CrownRegion, CrownTopologyMap } from './restoration-types';

const EPSILON = 1e-8;

export interface CrownSolidResult {
  mesh: MeshData;
  indexed: IndexedMesh;
  topologyMap: CrownTopologyMap;
  inspection: ReturnType<typeof inspectGeometry>;
  preparationSurfacePoints: Vec3[];
  requestedGapByInnerVertex: Record<number, number>;
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
  const prep = preparationTriangles(input.preparationMesh, basis);
  const reference = input.referenceMesh ? preparationTriangles(input.referenceMesh, basis) : null;
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
      const sample = samplePreparationHeight(x, y, prep.triangles, prep.vertices);
      if (sample.fallback) fallbackSamples += 1;
      const gap = requestedGap(input.parameters, t, averageRadius);
      const innerPoint: LocalPoint = { x, y, z: sample.z + gap };
      const nx = x / maxX; const ny = y / maxY;
      const anatomy = morphologyHeight(definition, input.parameters, nx, ny);
      const normalizedAnatomy = Math.min(1, anatomy / Math.max(0.1, input.parameters.anatomyIntensity));
      const region = regionFor(t, normalizedAnatomy, definition.mamelonCount > 0 || definition.cusps.length <= 3);
      const minimumThickness = requestedThickness(region, material);
      const radialLength = Math.hypot(x, y) || 1;
      const shapeEnvelope = Math.pow(Math.sin(Math.PI * t), 0.72) * Math.sqrt(Math.max(0, 1 - t));
      const extraX = Math.max(0, targetX - maxX) * shapeEnvelope * Math.sign(x);
      const extraY = Math.max(0, targetY - maxY) * shapeEnvelope * Math.sign(y);
      const cervicalExpansion = minimumThickness * (1 - t) * 0.7;
      let outerPoint: LocalPoint = {
        x: x + extraX + cervicalExpansion * x / radialLength,
        y: y + extraY + cervicalExpansion * y / radialLength,
        z: innerPoint.z + minimumThickness + anatomy * definition.crownDimensionsMm.height * 0.36,
      };
      if (reference) {
        const referenceSample = samplePreparationHeight(outerPoint.x, outerPoint.y, reference.triangles, reference.vertices);
        if (!referenceSample.fallback && referenceSample.z > innerPoint.z + minimumThickness) outerPoint = { ...outerPoint, z: outerPoint.z * 0.35 + referenceSample.z * 0.65 };
      }
      ringPreparation.push({ x, y, z: sample.z }); ringInner.push(innerPoint); ringOuter.push(outerPoint);
      hooks.progress?.('intaglio', ring * segments + segment + 1, rings * segments, 'Sampling actual preparation geometry.');
    }
    preparationLocal.push(ringPreparation); innerLocal.push(ringInner); outerLocal.push(ringOuter);
  }
  roundInternalTransitions(innerLocal, outerLocal, preparationLocal, input.parameters.internalRadiusMm, input.parameters.localReliefMm, material.cementGapMm.maximum);
  const centerSample = samplePreparationHeight(0, 0, prep.triangles, prep.vertices);
  if (centerSample.fallback) fallbackSamples += 1;
  const centerGap = requestedGap(input.parameters, 1, averageRadius);
  const innerCenter: LocalPoint = { x: 0, y: 0, z: centerSample.z + centerGap };
  const centerAnatomy = morphologyHeight(definition, input.parameters, 0, 0);
  let outerCenter: LocalPoint = { x: 0, y: 0, z: innerCenter.z + material.minimumThicknessMm.occlusal + centerAnatomy * definition.crownDimensionsMm.height * 0.36 };
  if (reference) {
    const referenceCenter = samplePreparationHeight(0, 0, reference.triangles, reference.vertices);
    if (!referenceCenter.fallback && referenceCenter.z > innerCenter.z + material.minimumThicknessMm.occlusal) outerCenter = { ...outerCenter, z: outerCenter.z * 0.35 + referenceCenter.z * 0.65 };
  }

  for (const ring of outerLocal) for (const point of ring) { outerVertexIds.push(positions.length); positions.push(world(point, basis)); }
  const outerCenterId = positions.length; outerVertexIds.push(outerCenterId); positions.push(world(outerCenter, basis));
  for (const ring of innerLocal) for (const point of ring) { innerVertexIds.push(positions.length); positions.push(world(point, basis)); }
  const innerCenterId = positions.length; innerVertexIds.push(innerCenterId); positions.push(world(innerCenter, basis));
  for (let index = 0; index < rings * segments; index += 1) {
    const outerId = index; const innerId = rings * segments + 1 + index;
    outerToInner[outerId] = innerId;
    const ring = Math.floor(index / segments); const t = ring / rings;
    const normalized = morphologyHeight(definition, input.parameters, outerLocal[ring][index % segments].x / maxX, outerLocal[ring][index % segments].y / maxY) / Math.max(0.1, input.parameters.anatomyIntensity);
    regions[outerId] = regionFor(t, normalized, definition.mamelonCount > 0 || definition.cusps.length <= 3);
    preparationSurfacePoints.push(world(preparationLocal[ring][index % segments], basis));
    requestedGapByInnerVertex[innerId] = requestedGap(input.parameters, t, averageRadius);
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
  const indexed = orientPositive({ positions, faces });
  const inspection = validateGeometryResult(indexed);
  const topologyMap: CrownTopologyMap = { outerVertexIds, innerVertexIds, marginOuterVertexIds, marginInnerVertexIds, outerToInner, regions };
  const warnings: string[] = [];
  if (fallbackSamples) warnings.push(`${fallbackSamples} intaglio sample${fallbackSamples === 1 ? '' : 's'} fell outside the preparation's projected triangle coverage and used the nearest preparation vertex.`);
  return { mesh: meshData(indexed), indexed, topologyMap, inspection, preparationSurfacePoints, requestedGapByInnerVertex, warnings };
}

function requestedGap(parameters: CrownGenerationInput['parameters'], t: number, averageRadius: number): number {
  const insetDistance = averageRadius * t;
  const blend = Math.max(0, Math.min(1, (insetDistance - parameters.spacerStartMm) / Math.max(averageRadius - parameters.spacerStartMm, 1e-6)));
  const axialGap = (parameters.cementGapMm + parameters.axialSpacerMm) * 0.5;
  return (parameters.marginalGapMm * (1 - blend) + (axialGap * (1 - t) + parameters.occlusalSpacerMm * t) * blend + parameters.localReliefMm) * (1 + parameters.manufacturingCompensationPercent / 100);
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

function importMaterial(id: CrownGenerationInput['materialProfileId']): CrownMaterialProfile {
  const profile = CROWN_MATERIAL_PROFILES[id];
  if (!profile) throw new Error(`Material profile ${id} is not registered.`);
  return profile;
}

export interface CrownSculptInput {
  center: Vec3;
  radiusMm: number;
  strengthMm: number;
  mode: 'add' | 'remove' | 'smooth';
}

export function sculptCrownSurface(mesh: MeshData, topologyMap: CrownTopologyMap, input: CrownSculptInput, locks: { margin: boolean; intaglio: boolean; anatomy: boolean }): MeshData {
  if (locks.anatomy) throw new Error('Anatomy lock prevents local sculpting.');
  if (!Number.isFinite(input.radiusMm) || input.radiusMm <= 0 || !Number.isFinite(input.strengthMm)) throw new Error('Sculpt radius and strength must be finite, with radius greater than zero.');
  const indexed = indexedMesh(mesh); const normals = vertexNormals(indexed); const outer = new Set(topologyMap.outerVertexIds); const margin = new Set(topologyMap.marginOuterVertexIds);
  const next = indexed.positions.map((point) => [...point] as Vec3);
  const affected = topologyMap.outerVertexIds.filter((id) => distance3(indexed.positions[id], input.center) <= input.radiusMm && !(locks.margin && margin.has(id)));
  if (!affected.length) throw new Error('Sculpt brush does not intersect the editable crown surface.');
  if (input.mode === 'smooth') {
    const topology = importTopology(indexed); const source = indexed.positions;
    for (const id of affected) {
      const neighbors = topology.vertexEdges[id].flatMap((edgeId) => topology.edges[edgeId]).filter((value) => value !== id && outer.has(value));
      if (!neighbors.length) continue;
      const average = scale3(neighbors.reduce<Vec3>((sum, neighbor) => add3(sum, source[neighbor]), [0, 0, 0]), 1 / neighbors.length);
      const weight = Math.max(0, 1 - distance3(source[id], input.center) / input.radiusMm) * Math.min(1, Math.abs(input.strengthMm));
      next[id] = add3(source[id], scale3(subtract3(average, source[id]), weight));
    }
  } else {
    const direction = input.mode === 'add' ? 1 : -1;
    for (const id of affected) {
      const ratio = distance3(indexed.positions[id], input.center) / input.radiusMm; const falloff = Math.pow(Math.max(0, 1 - ratio * ratio), 2);
      next[id] = add3(indexed.positions[id], scale3(normals[id], direction * Math.abs(input.strengthMm) * falloff));
    }
  }
  const result = { positions: next, faces: indexed.faces };
  validateGeometryResult(result);
  return meshData(result);
}

function importTopology(mesh: IndexedMesh) {
  return buildTopologyStatic(mesh);
}

import { buildTopology as buildTopologyStatic } from './editing-geometry';

export function scaleCrownAnatomy(mesh: MeshData, topologyMap: CrownTopologyMap, center: Vec3, scale: Vec3, locks: { margin: boolean; intaglio: boolean; anatomy: boolean }): MeshData {
  if (locks.anatomy) throw new Error('Anatomy lock prevents global crown morphing.');
  if (scale.some((value) => !Number.isFinite(value) || value < 0.7 || value > 1.3)) throw new Error('Crown morph scale must be finite and remain between 0.7 and 1.3.');
  const indexed = indexedMesh(mesh); const outer = new Set(topologyMap.outerVertexIds); const margin = new Set(topologyMap.marginOuterVertexIds);
  const positions = indexed.positions.map((point, id) => {
    if (!outer.has(id) || (locks.margin && margin.has(id))) return [...point] as Vec3;
    const relative = subtract3(point, center); return add3(center, [relative[0] * scale[0], relative[1] * scale[1], relative[2] * scale[2]]);
  });
  const result = { positions, faces: indexed.faces };
  validateGeometryResult(result);
  return meshData(result);
}
