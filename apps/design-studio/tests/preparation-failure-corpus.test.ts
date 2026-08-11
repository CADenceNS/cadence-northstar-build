import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import type { ArtifactRecord, MeshData, SceneObject, Vec3 } from '../src/core';
import { indexedMesh, meshData, type IndexedMesh } from '../src/editing-geometry';
import { detectPreparationCandidates } from '../src/preparation-engine';
import { evaluateMarginQuality, marginVersionFromCandidate } from '../src/margin-engine';
import { goldenGeometryCorpus } from './golden-geometry';
import { goldenPreparation } from './golden-preparations';

type Expected = 'reject' | 'review';
interface FailureFixture { name: string; artifact: ArtifactRecord; object: SceneObject; expected: Expected; }

describe('preparation and margin failure corpus fails closed', () => {
  for (const fixture of failureFixtures()) {
    it(`${fixture.name} requires ${fixture.expected}`, () => {
      const before = structuredClone(fixture.artifact);
      const result = detectPreparationCandidates(indexedMesh(fixture.artifact.mesh), fixture.artifact.id, fixture.object.id, [0, 0, 1]);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((candidate) => candidate.state !== 'AUTO_DETECTED_HIGH_CONFIDENCE')).toBe(true);
      if (fixture.expected === 'reject') expect(result.every((candidate) => ['UNSUPPORTED', 'INSUFFICIENT_GEOMETRY'].includes(candidate.state))).toBe(true);
      else expect(result.every((candidate) => ['AUTO_DETECTED_REVIEW_REQUIRED', 'MULTIPLE_CANDIDATES', 'MANUAL_IDENTIFICATION_REQUIRED', 'INSUFFICIENT_GEOMETRY', 'UNSUPPORTED'].includes(candidate.state))).toBe(true);
      expect(fixture.artifact).toEqual(before);
    });
  }

  it('an impossible self-crossing closed margin cannot be approved', () => {
    const fixture = goldenPreparation('chamfer-crown', 24); const candidate = detectPreparationCandidates(indexedMesh(fixture.artifact.mesh), fixture.artifact.id, fixture.object.id, [0, 0, 1])[0]; const version = marginVersionFromCandidate(candidate.marginCandidates[0], 'prep', 'segmentation', fixture.object); const points = [candidate.marginCandidates[0].points[0], candidate.marginCandidates[0].points[6], candidate.marginCandidates[0].points[18], candidate.marginCandidates[0].points[12]];
    version.curve = { ...version.curve, controlPoints: points, sampledPoints: points, closed: true }; const quality = evaluateMarginQuality(version, fixture.artifact, candidate.faceIds, [0, 0, 1]); expect(quality.valid).toBe(false); expect(quality.checks.find((check) => check.id === 'margin.self-intersection')?.status).toBe('fail');
  });

  it('repeated failure analysis produces identical state, measured values, and reasons', () => {
    for (const fixture of failureFixtures()) { const run = () => detectPreparationCandidates(indexedMesh(fixture.artifact.mesh), fixture.artifact.id, fixture.object.id, [0, 0, 1]).map((candidate) => ({ state: candidate.state, confidence: candidate.confidence, measurements: candidate.measurements, reasons: candidate.ambiguityReasons, faces: candidate.faceIds, margins: candidate.marginCandidates.map((margin) => ({ closed: margin.closed, confidence: margin.confidence, failureReasons: margin.failureReasons })) })); expect(run()).toEqual(run()); }
  });
});

function failureFixtures(): FailureFixture[] {
  const base = goldenPreparation('chamfer-crown', 28); const multi = goldenPreparation('multiple-adjacent', 28); const partial = goldenPreparation('partial-missing-margin', 28); const ambiguous = goldenPreparation('ambiguous-finish-line', 28);
  const duplicate = alter(base, 'duplicate-surface', (mesh) => ({ ...mesh, faces: [...mesh.faces, [...mesh.faces[0]] as [number, number, number]] }));
  const mirrored = alter(base, 'mirrored-scan', (mesh) => ({ positions: mesh.positions.map(([x, y, z]) => [-x, y, z] as Vec3), faces: mesh.faces.map((face) => [...face]) }));
  const scale = alter(base, 'incorrect-scale', (mesh) => ({ positions: mesh.positions.map((point) => point.map((value) => value * 100) as Vec3), faces: mesh.faces.map((face) => [...face]) }));
  const missingGingival = alter(base, 'missing-gingival-geometry', (mesh) => ({ ...mesh, faces: mesh.faces.filter((_, id) => id >= 28 * 2) }));
  const incomplete = alter(base, 'highly-incomplete-preparation', (mesh) => ({ ...mesh, faces: mesh.faces.slice(0, 12) }));
  const severeNoise = alter(base, 'severe-scan-noise', (mesh) => ({ positions: mesh.positions.map((point, index) => [point[0] + noise(index) * 2.5, point[1] + noise(index + 91) * 2.5, point[2] + noise(index + 183) * 1.5] as Vec3), faces: mesh.faces.map((face) => [...face]) }));
  const noPrep = generated('no-preparation', smoothCylinder());
  const selfIntersecting = generated('self-intersecting-input', { positions: [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0.5, -1], [0, 0.5, 1], [1, 0.5, 0]], faces: [[0, 1, 2], [3, 4, 5]] });
  const nonManifoldSource = goldenGeometryCorpus().find((value) => value.name === 'non-manifold-edge')!.artifact; const nonManifold = { name: 'non-manifold-input', artifact: nonManifoldSource, object: objectFor(nonManifoldSource), expected: 'reject' as const };
  return [
    { name: 'no preparation', artifact: noPrep, object: objectFor(noPrep), expected: 'review' },
    { name: 'multiple ambiguous preparations', artifact: multi.artifact, object: multi.object, expected: 'review' },
    { name: 'missing gingival geometry', artifact: missingGingival, object: objectFor(missingGingival), expected: 'review' },
    { name: 'large scan hole at margin', artifact: partial.artifact, object: partial.object, expected: 'review' },
    { name: 'severe scan noise', artifact: severeNoise, object: objectFor(severeNoise), expected: 'review' },
    { name: 'duplicate surface', artifact: duplicate, object: objectFor(duplicate), expected: 'reject' },
    { name: 'self-intersecting input', artifact: selfIntersecting, object: objectFor(selfIntersecting), expected: 'reject' },
    nonManifold,
    { name: 'mirrored scan', artifact: mirrored, object: objectFor(mirrored), expected: 'reject' },
    { name: 'incorrect scale', artifact: scale, object: objectFor(scale), expected: 'reject' },
    { name: 'highly incomplete preparation', artifact: incomplete, object: objectFor(incomplete), expected: 'review' },
    { name: 'disconnected preparation', artifact: multi.artifact, object: multi.object, expected: 'review' },
    { name: 'competing finish lines', artifact: ambiguous.artifact, object: ambiguous.object, expected: 'review' },
  ];
}

function alter(base: ReturnType<typeof goldenPreparation>, name: string, operation: (mesh: IndexedMesh) => IndexedMesh): ArtifactRecord { return { ...structuredClone(base.artifact), id: `artifact-${name}`, sourceName: `${name}.stl`, checksum: `sha256-${name}`, mesh: meshData(operation(indexedMesh(base.artifact.mesh))) }; }
function generated(name: string, mesh: IndexedMesh): ArtifactRecord { return { id: `artifact-${name}`, sourceName: `${name}.stl`, sourceFormat: 'stl', checksum: `sha256-${name}`, importedAt: new Date(0).toISOString(), byteLength: mesh.positions.length * 24, units: 'mm', orientation: 'normalized', metadata: { failureFixture: name }, history: [{ at: new Date(0).toISOString(), action: 'generated-failure-fixture' }], mesh: meshData(mesh) }; }
function objectFor(artifact: ArtifactRecord): SceneObject { return { id: `object-${artifact.id}`, name: artifact.sourceName, type: 'preparation', artifactId: artifact.id, visible: true, isolated: false, locked: false, selected: true, transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [1, 1, 1, 1], opacity: 1, metallic: 0, roughness: 0.7 }, metadata: {} }; }
function smoothCylinder(segments = 24): IndexedMesh { const positions: Vec3[] = []; const faces: Array<[number, number, number]> = []; for (const z of [-4, 4]) for (let index = 0; index < segments; index += 1) { const angle = index / segments * Math.PI * 2; positions.push([Math.cos(angle) * 5, Math.sin(angle) * 5, z]); } for (let index = 0; index < segments; index += 1) { const next = (index + 1) % segments; faces.push([index, next, segments + next], [index, segments + next, segments + index]); } return { positions, faces }; }
function noise(index: number): number { let value = (index + 1) * 1664525 + 1013904223; value ^= value >>> 16; return (value >>> 0) / 0xffffffff * 2 - 1; }
