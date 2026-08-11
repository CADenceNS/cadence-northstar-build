import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ArtifactManager, createProject, ProjectStore, SceneManager, type Vec3 } from '../src/core';
import { indexedMesh } from '../src/editing-geometry';
import { createPolyline } from '../src/curve-tools';
import { drawManualMargin } from '../src/margin-editor';
import { manualMarginVersion } from '../src/margin-engine';
import { createPreparationRecord, detectPreparationCandidates, executePreparationAnalysis, manualSegmentation } from '../src/preparation-engine';
import { createPreparationProjectState, type PreparationCandidate } from '../src/preparation-types';
import { compactArtifact, PrivateCorpusLoader, roleArtifact } from './corpus-helpers';

const loader = await PrivateCorpusLoader.open(process.env.CADENCE_DENTAL_CORPUS_PATH ?? '');
const cases = [await loader.loadCase('CASE-001'), await loader.loadCase('CASE-002'), await loader.loadCase('CASE-003')];

describe('private dental preparation robustness without fabricated margin truth', { concurrency: false }, () => {
  it('fails closed for every real scan that has no owner-attested preparation margin truth', async () => {
    await loader.assertSourceImmutability(); let scans = 0;
    for (const corpusCase of cases) for (const source of corpusCase.artifacts.values()) {
      const compact = compactArtifact(source, `prep-robustness-${corpusCase.id}-${scans}`, 2_000); const before = structuredClone(source); const result = detectPreparationCandidates(indexedMesh(compact.mesh), compact.id, `scene-${scans}`, [0, 0, 1]);
      assert.ok(result.length > 0); assert.ok(result.every((candidate) => candidate.state !== 'AUTO_DETECTED_HIGH_CONFIDENCE'), `${corpusCase.id} scan ${scans} was automatically accepted without verified margin truth.`); assert.deepEqual(source, before); scans += 1;
    }
    assert.equal(scans, 11); await loader.assertSourceImmutability();
  });

  it('projects a technician-authored model-space curve onto an actual private scan without changing source bytes', async () => {
    const source = roleArtifact(cases[0], 'upper_arch'); const compact = compactArtifact(source, 'private-manual-margin-projection', 4_000); const artifacts = new ArtifactManager([compact]); const scene = new SceneManager(); const object = scene.addFromArtifact(compact, 'preparation'); const mesh = indexedMesh(compact.mesh); const stride = Math.max(1, Math.floor(mesh.positions.length / 12)); const points = Array.from({ length: 8 }, (_, index) => mesh.positions[Math.min(mesh.positions.length - 1, index * stride)]).map((point) => [point[0], point[1], point[2] + 0.25] as Vec3);
    const curve = drawManualMargin('Private scan manual margin', points, compact, object, 'surface-following'); assert.ok(curve.controlPoints.length >= 2); assert.equal(curve.artifactId, compact.id); assert.equal(curve.objectId, object.id); assert.ok(curve.controlPoints.every((point) => point.every(Number.isFinite))); assert.deepEqual(artifacts.get(compact.id), compact); await loader.assertSourceImmutability();
  });

  it('persists and recovers a manual preparation and margin without asserting automatic accuracy', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); const source = [...cases[1].artifacts.values()][0]; const compact = compactArtifact(source, 'private-preparation-persistence', 2_000); const scene = new SceneManager(); const object = scene.addFromArtifact(compact, 'preparation'); const mesh = indexedMesh(compact.mesh); const selectedFaces = Array.from({ length: Math.min(48, mesh.faces.length) }, (_, index) => index); const candidate = manualCandidate(compact.id, object.id, selectedFaces); const preparation = createPreparationRecord(candidate, { kind: 'unknown' }); const segmentation = manualSegmentation(preparation.id, compact, object.id, selectedFaces); const curve = createPolyline('Explicit private manual margin', [...new Set(selectedFaces.flatMap((id) => mesh.faces[id]))].slice(0, 12).map((id) => mesh.positions[id]), { objectId: object.id, artifactId: compact.id }); const margin = manualMarginVersion(curve, preparation.id, segmentation.id, null); preparation.segmentationVersionIds = [segmentation.id]; preparation.activeSegmentationVersionId = segmentation.id; preparation.marginVersionIds = [margin.id]; preparation.activeMarginVersionId = margin.id;
    const project = createProject('Private preparation recovery'); project.artifacts = [compact]; project.scene = scene.list(); project.preparation = { ...createPreparationProjectState(), candidates: [candidate], preparations: [preparation], segmentations: [segmentation], margins: [margin], activePreparationId: preparation.id }; const store = new ProjectStore(); const saved = store.save(project); assert.deepEqual(store.open(saved.id).preparation, project.preparation); store.autoSave(project); assert.deepEqual(store.recover()?.preparation, project.preparation); await loader.assertSourceImmutability();
  });

  it('measures worker-cooperative full-scan preparation safety analysis and preserves responsiveness evidence', async () => {
    const measurements: Array<Record<string, number | string>> = [];
    for (const [index, corpusCase] of cases.entries()) { const source = [...corpusCase.artifacts.values()][0]; const compact = compactArtifact(source, `private-preparation-performance-${index}`, 8_000); let yields = 0; const heapBefore = process.memoryUsage().heapUsed; const started = performance.now(); const result = await executePreparationAnalysis({ requestId: `private-preparation-${index}`, artifactId: compact.id, sceneObjectId: `scene-${index}`, mesh: compact.mesh, dentalAxis: [0, 0, 1], mode: 'detect-preparations' }, { yieldControl: async () => { yields += 1; await Promise.resolve(); } }); const durationMs = performance.now() - started; assert.ok(yields > 0); assert.ok((result.candidates ?? []).every((candidate) => candidate.state !== 'AUTO_DETECTED_HIGH_CONFIDENCE')); measurements.push({ case: corpusCase.id, triangles: (compact.mesh.sourceTopology?.indices.length ?? compact.mesh.indices.length) / 3, durationMs, heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore, cooperativeYields: yields }); }
    console.info(`PRIVATE_PREPARATION_PERFORMANCE ${JSON.stringify(measurements)}`); await loader.assertSourceImmutability();
  });
});

function manualCandidate(artifactId: string, sceneObjectId: string, faceIds: number[]): PreparationCandidate { const now = new Date().toISOString(); return { id: crypto.randomUUID(), artifactId, sceneObjectId, shellIndex: -1, name: 'Technician identified preparation', toothPosition: 'manually assigned', kind: 'unknown', state: 'MANUAL_IDENTIFICATION_REQUIRED', faceIds, boundaryVertexIds: [], proposedInsertionAxis: [0, 0, 1], measurements: { vertexCount: 0, triangleCount: faceIds.length, finiteCoordinateRatio: 1, surfaceAreaMm2: 0, boundingDimensionsMm: [0, 0, 0], candidateFeatureEdgeCount: 0, candidateLoopCount: 0, localHeightMm: 0, wallNormalDispersion: 1, taperDegrees: null, topologyBoundaryEdgeCount: 0, topologyNonManifoldEdgeCount: 0 }, marginCandidates: [], ambiguityReasons: ['No verified private-corpus margin truth exists; technician identification is explicit.'], confidence: 0, createdAt: now }; }
class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
