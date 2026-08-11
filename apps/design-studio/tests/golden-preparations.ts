import type { ArtifactRecord, MeshData, SceneObject, Vec3 } from '../src/core';
import { indexedMesh, mergeIndexed, meshData, type IndexedMesh } from '../src/editing-geometry';
import type { FinishLineClassification, PreparationKind } from '../src/preparation-types';

export type PreparationFixtureFamily =
  | 'chamfer-crown'
  | 'heavy-chamfer'
  | 'shoulder'
  | 'radial-shoulder'
  | 'knife-edge'
  | 'feather-edge'
  | 'veneer'
  | 'inlay'
  | 'onlay'
  | 'overlay'
  | 'multiple-adjacent'
  | 'bridge-abutments'
  | 'irregular'
  | 'partial-missing-margin'
  | 'noisy-scan'
  | 'rounded-scan-noise'
  | 'local-artifact'
  | 'ambiguous-finish-line';

export interface GoldenPreparationFixture {
  family: PreparationFixtureFamily;
  artifact: ArtifactRecord;
  object: SceneObject;
  trueMargins: Vec3[][];
  expectedPreparationFaceIds: number[][];
  expectedKind: PreparationKind;
  expectedFinishLines: FinishLineClassification[];
}

interface Profile { rings: Array<{ z: number; radius: number }>; trueRing: number; kind: PreparationKind; expected: FinishLineClassification; }

export function goldenPreparation(family: PreparationFixtureFamily, segments = 48): GoldenPreparationFixture {
  if (family === 'multiple-adjacent' || family === 'bridge-abutments') {
    const first = makeSingle(family === 'bridge-abutments' ? 'heavy-chamfer' : 'chamfer-crown', segments, [-7.5, 0, 0]); const second = makeSingle(family === 'bridge-abutments' ? 'shoulder' : 'radial-shoulder', segments, [7.5, 0, 0]); const firstMesh = indexedMesh(first.mesh); const secondMesh = indexedMesh(second.mesh); const merged = mergeIndexed([firstMesh, secondMesh]); const offset = firstMesh.faces.length;
    return fixture(family, meshData(merged), [...first.margin, ...[]], [first.margin, second.margin], [first.prepFaces, second.prepFaces.map((id) => id + offset)], family === 'bridge-abutments' ? 'bridge-abutment' : 'crown', [first.expected, second.expected]);
  }
  const baseFamily = family === 'veneer' ? 'knife-edge' : family === 'inlay' ? 'chamfer-crown' : family === 'onlay' ? 'heavy-chamfer' : family === 'overlay' ? 'radial-shoulder' : family === 'irregular' || family === 'noisy-scan' || family === 'rounded-scan-noise' || family === 'local-artifact' || family === 'partial-missing-margin' || family === 'ambiguous-finish-line' ? 'chamfer-crown' : family;
  let value = makeSingle(baseFamily as keyof typeof PROFILES, segments, [0, 0, 0]);
  if (family === 'irregular') value = perturb(value, (point, index) => [point[0] * (1 + 0.07 * Math.sin(index * 0.73)), point[1] * (1 + 0.05 * Math.cos(index * 0.37)), point[2]]);
  if (family === 'noisy-scan') value = perturb(value, (point, index) => isMarginPoint(point, value.margin) ? point : [point[0] + noise(index) * 0.08, point[1] + noise(index + 99) * 0.08, point[2] + noise(index + 211) * 0.05]);
  if (family === 'rounded-scan-noise') value = perturb(value, (point, index) => isMarginPoint(point, value.margin) ? point : [point[0] + Math.sin(index * 0.31) * 0.035, point[1] + Math.cos(index * 0.29) * 0.035, point[2] + Math.sin(index * 0.17) * 0.02]);
  if (family === 'local-artifact') value = perturb(value, (point, index) => index % 53 === 0 && !isMarginPoint(point, value.margin) ? [point[0] * 1.08, point[1] * 1.08, point[2] + 0.12] : point);
  if (family === 'partial-missing-margin') value = removeMarginSector(value, 0, Math.PI / 7);
  if (family === 'ambiguous-finish-line') value = addAmbiguousRing(value, segments);
  const kind: PreparationKind = family === 'veneer' ? 'veneer' : family === 'inlay' ? 'inlay' : family === 'onlay' ? 'onlay' : family === 'overlay' ? 'overlay' : value.kind;
  return fixture(family, value.mesh, value.margin, [value.margin], [value.prepFaces], kind, [value.expected]);
}

const PROFILES = {
  'chamfer-crown': profile(1.05, 0.55, 'crown', 'chamfer'),
  'heavy-chamfer': profile(2.1, 0.42, 'crown', 'heavy-chamfer'),
  shoulder: { rings: [{ z: -2, radius: 6 }, { z: 0, radius: 5 }, { z: 0, radius: 4 }, { z: 5, radius: 3.35 }], trueRing: 2, kind: 'crown', expected: 'shoulder' } satisfies Profile,
  'radial-shoulder': profile(4.8, 0.25, 'crown', 'radial-shoulder'),
  'knife-edge': profile(0.45, 0.7, 'veneer', 'knife-edge'),
  'feather-edge': profile(0.27, 0.8, 'veneer', 'feather-edge'),
} as const;

function profile(finishSlope: number, finishHeight: number, kind: PreparationKind, expected: FinishLineClassification): Profile {
  const marginRadius = 4; const marginZ = 0.35; const priorZ = marginZ - finishHeight; const priorRadius = marginRadius + finishSlope * finishHeight;
  return { rings: [{ z: -2, radius: Math.min(6.25, priorRadius + finishSlope * (priorZ + 2)) }, { z: priorZ, radius: priorRadius }, { z: marginZ, radius: marginRadius }, { z: 5.2, radius: 3.35 }], trueRing: 2, kind, expected };
}

function makeSingle(family: keyof typeof PROFILES, segments: number, translation: Vec3): { mesh: MeshData; margin: Vec3[]; prepFaces: number[]; kind: PreparationKind; expected: FinishLineClassification } {
  return makeSingleFromProfile(PROFILES[family], segments, translation);
}

function makeSingleFromProfile(profileValue: Profile, segments: number, translation: Vec3): { mesh: MeshData; margin: Vec3[]; prepFaces: number[]; kind: PreparationKind; expected: FinishLineClassification } {
  const positions: Vec3[] = []; const faces: Array<[number, number, number]> = [];
  for (const ring of profileValue.rings) for (let segment = 0; segment < segments; segment += 1) { const angle = segment / segments * Math.PI * 2; positions.push([translation[0] + Math.cos(angle) * ring.radius, translation[1] + Math.sin(angle) * ring.radius, translation[2] + ring.z]); }
  for (let ring = 0; ring < profileValue.rings.length - 1; ring += 1) for (let segment = 0; segment < segments; segment += 1) { const next = (segment + 1) % segments; const a = ring * segments + segment, b = ring * segments + next, c = (ring + 1) * segments + segment, d = (ring + 1) * segments + next; faces.push([a, b, d], [a, d, c]); }
  const bottomCenter = positions.length; positions.push([translation[0], translation[1], translation[2] + profileValue.rings[0].z]); const topCenter = positions.length; positions.push([translation[0], translation[1], translation[2] + profileValue.rings.at(-1)!.z]);
  for (let segment = 0; segment < segments; segment += 1) { const next = (segment + 1) % segments; faces.push([bottomCenter, next, segment]); const topOffset = (profileValue.rings.length - 1) * segments; faces.push([topCenter, topOffset + segment, topOffset + next]); }
  const margin = Array.from({ length: segments }, (_, segment) => [...positions[profileValue.trueRing * segments + segment]] as Vec3); const firstPrepBand = profileValue.trueRing; const prepFaces = faces.flatMap((_, id) => id >= firstPrepBand * segments * 2 && id < (profileValue.rings.length - 1) * segments * 2 || id >= (profileValue.rings.length - 1) * segments * 2 && id % 2 === 1 ? [id] : []);
  return { mesh: meshData({ positions, faces }), margin, prepFaces, kind: profileValue.kind, expected: profileValue.expected };
}

function perturb(value: ReturnType<typeof makeSingle>, transform: (point: Vec3, index: number) => Vec3): ReturnType<typeof makeSingle> {
  const mesh = indexedMesh(value.mesh); const positions = mesh.positions.map((point, index) => transform([...point], index)); const margin = value.margin.map((point) => { const nearest = mesh.positions.findIndex((valuePoint) => distance(valuePoint, point) < 1e-8); return nearest >= 0 ? positions[nearest] : point; }); return { ...value, mesh: meshData({ positions, faces: mesh.faces.map((face) => [...face]) }), margin };
}

function removeMarginSector(value: ReturnType<typeof makeSingle>, center: number, halfWidth: number): ReturnType<typeof makeSingle> {
  const mesh = indexedMesh(value.mesh); const marginVertices = new Set(value.margin.flatMap((point) => mesh.positions.flatMap((candidate, id) => distance(candidate, point) < 1e-8 ? [id] : []))); const faces = mesh.faces.filter((face) => !face.some((vertex) => marginVertices.has(vertex) && angularDistance(Math.atan2(mesh.positions[vertex][1], mesh.positions[vertex][0]), center) < halfWidth));
  return { ...value, mesh: meshData({ positions: mesh.positions.map((point) => [...point]), faces }), prepFaces: value.prepFaces.filter((id) => id < faces.length) };
}

function addAmbiguousRing(value: ReturnType<typeof makeSingle>, segments: number): ReturnType<typeof makeSingle> {
  const profileValue: Profile = { rings: [{ z: -2, radius: 6.1 }, { z: -0.2, radius: 5.1 }, { z: 0.35, radius: 4.5 }, { z: 0.8, radius: 4 }, { z: 5.2, radius: 3.35 }], trueRing: 3, kind: 'crown', expected: 'chamfer' };
  return makeSingleFromProfile(profileValue, segments, [0, 0, 0]);
}

function fixture(family: PreparationFixtureFamily, mesh: MeshData, _firstMargin: Vec3[], margins: Vec3[][], expectedFaces: number[][], kind: PreparationKind, expected: FinishLineClassification[]): GoldenPreparationFixture {
  const now = new Date(0).toISOString(); const artifact: ArtifactRecord = { id: `artifact-${family}`, sourceName: `${family}.stl`, sourceFormat: 'stl', checksum: `sha256-${family}`, importedAt: now, byteLength: (mesh.sourceTopology?.positions.length ?? mesh.positions.length) * 8, units: 'mm', orientation: 'normalized', metadata: { goldenPreparationFamily: family }, history: [{ at: now, action: 'generated-test-fixture' }], mesh };
  const object: SceneObject = { id: `object-${family}`, name: family, type: 'preparation', artifactId: artifact.id, visible: true, isolated: false, locked: false, selected: true, transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [0.8, 0.82, 0.9, 1], opacity: 1, metallic: 0, roughness: 0.7 }, metadata: {} };
  return { family, artifact, object, trueMargins: margins, expectedPreparationFaceIds: expectedFaces, expectedKind: kind, expectedFinishLines: expected };
}

function noise(index: number): number { let value = (index + 1) * 1664525 + 1013904223; value ^= value >>> 16; return (value >>> 0) / 0xffffffff * 2 - 1; }
function isMarginPoint(point: Vec3, margin: Vec3[]): boolean { return margin.some((value) => distance(point, value) < 1e-8); }
function distance(first: Vec3, second: Vec3): number { return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]); }
function angularDistance(first: number, second: number): number { const value = Math.abs(first - second) % (Math.PI * 2); return Math.min(value, Math.PI * 2 - value); }
