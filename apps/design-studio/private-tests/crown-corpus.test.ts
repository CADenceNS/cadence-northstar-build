import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ArtifactManager, createProject, ProjectStore, SceneManager, type ArtifactRecord, type MeshData, type Vec3 } from '../src/core';
import { CommandBus } from '../src/commands';
import { generateCrownProposal } from '../src/crown-engine';
import { createCrownExportRecords, validateAllCrownExports } from '../src/crown-export';
import { runCrownQc } from '../src/crown-qc';
import { indexedMesh, inspectGeometry, meshData } from '../src/editing-geometry';
import { defaultCrownParameters } from '../src/morphology-core';
import { CrownProposalCommand } from '../src/restoration-commands';
import { RestorationStateManager } from '../src/restoration-state';
import type { CrownGenerationInput } from '../src/restoration-types';
import { compactArtifact, PrivateCorpusLoader, roleArtifact, sha256 } from './corpus-helpers';

const loader = await PrivateCorpusLoader.open(process.env.CADENCE_DENTAL_CORPUS_PATH ?? '');
const integrity = await loader.verifyIntegrity();
const attestation = await loader.verifyOwnerAttestation();
const corpusCase = await loader.loadCase('CASE-001');
const privateFixture = fixture();

describe('private dental crown-workflow robustness without fabricated clinical truth', { concurrency: false }, () => {
  it('generates a real derived crown and complete fit analyses from protected dental geometry', async () => {
    assert.equal(integrity.corpusVersion, '0.3'); assert.equal(integrity.verifiedFileCount, 23); assert.equal(attestation.confirmed, true); await loader.assertSourceImmutability();
    const result = privateFixture.result; assert.equal(result.inspection.watertight, true); assert.equal(result.inspection.shellCount, 1); assert.equal(result.inspection.selfIntersectionCount, 0); assert.equal(result.cementSpace.status, 'pass'); assert.ok(result.thickness.failingVertexIds.length === 0);
    assert.ok(Number.isFinite(result.mesialContact.minimumDistanceMm)); assert.ok(Number.isFinite(result.distalContact.minimumDistanceMm)); assert.ok(Number.isFinite(result.occlusion.minimumDistanceMm)); assert.equal(result.seating.status, 'fail'); assert.equal(result.mesialContact.status, 'fail'); assert.equal(result.distalContact.status, 'fail'); assert.equal(result.occlusion.status, 'fail'); await loader.assertSourceImmutability();
  });

  it('creates only a derived restoration artifact and supports exact undo and redo', async () => {
    const runtime = setup(); const sources = structuredClone(runtime.artifacts.list()); await runtime.bus.execute(command(runtime)); const record = runtime.restorations.get().restorations[0]; const crown = runtime.artifacts.get(record.artifactId!)!;
    assert.equal(crown.derivedFrom?.parentArtifactId, privateFixture.preparation.id); assert.equal(crown.derivedFrom?.rootArtifactId, privateFixture.preparation.derivedFrom?.rootArtifactId ?? privateFixture.preparation.id); assert.deepEqual(runtime.artifacts.list().slice(0, sources.length), sources); assert.ok(crown.id !== privateFixture.preparation.id);
    await runtime.bus.undo(); assert.deepEqual(runtime.artifacts.list(), sources); await runtime.bus.redo(); assert.equal(runtime.artifacts.list().length, sources.length + 1); await loader.assertSourceImmutability();
  });

  it('persists and recovers the crown, manual preparation lineage, and review-required analyses', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); const runtime = setup(); await runtime.bus.execute(command(runtime)); const project = createProject('Protected dental crown robustness'); project.scene = runtime.scene.list(); project.artifacts = runtime.artifacts.list(); project.restoration = runtime.restorations.get(); const store = new ProjectStore(); const saved = store.save(project); const reopened = store.open(saved.id); assert.deepEqual(reopened.restoration, project.restoration); assert.deepEqual(reopened.artifacts, project.artifacts); store.autoSave(project); assert.deepEqual(store.recover()?.restoration, project.restoration); await loader.assertSourceImmutability();
  });

  it('round-trips four manufacturing geometry formats but blocks approval and release when private fit evidence fails', async () => {
    const runtime = setup(); await runtime.bus.execute(command(runtime)); const record = runtime.restorations.get().restorations[0]; const crown = runtime.artifacts.get(record.artifactId!)!; const outputs = await validateAllCrownExports(crown.mesh); assert.equal(outputs.length, 4); assert.ok(outputs.every((value) => value.roundTrip.passed && value.roundTrip.maximumSurfaceDeviationMm <= 0.001)); const qc = runCrownQc(record, crown.mesh, outputs.map((value) => value.roundTrip)); assert.equal(qc.overall, 'fail'); assert.ok(qc.hardFailureCount > 0); assert.throws(() => createCrownExportRecords({ ...record, approvalState: 'QC_FAILED', activeQcResultId: qc.id }, outputs), /approved/i); assert.ok(runtime.artifacts.list().every((value) => !originalFileNames().includes(value.sourceName))); await loader.assertSourceImmutability();
  });
});

function fixture() {
  const source = roleArtifact(corpusCase, 'upper_arch'); const opposing = compactArtifact(roleArtifact(corpusCase, 'lower_arch'), 'CASE-001-opposing-derived', 4_000); const preparation = compactArtifact(source, 'CASE-001-manual-preparation-derived', 4_000); const topology = indexedMesh(preparation.mesh); const center: Vec3 = [(preparation.mesh.bounds.min[0] + preparation.mesh.bounds.max[0]) / 2, (preparation.mesh.bounds.min[1] + preparation.mesh.bounds.max[1]) / 2, (preparation.mesh.bounds.min[2] + preparation.mesh.bounds.max[2]) / 2];
  const marginPoints = Array.from({ length: 32 }, (_, index) => { const angle = index / 32 * Math.PI * 2; const target: Vec3 = [center[0] + Math.cos(angle) * 3.2, center[1] + Math.sin(angle) * 3.2, center[2]]; return nearestProjected(topology.positions, target); });
  const mesial = sideArtifact(preparation, 'CASE-001-mesial-derived', center[0] - 2.5, true); const distal = sideArtifact(preparation, 'CASE-001-distal-derived', center[0] + 2.5, false);
  const input: CrownGenerationInput = {
    requestId: 'CASE-001-private-crown-robustness', preparationId: 'CASE-001-technician-manual-preparation', preparationArtifactId: preparation.id, preparationMesh: preparation.mesh, marginPoints, insertionAxis: [0, 0, 1], toothNumber: '8', caseId: 'CASE-001-private-robustness', numberingSystem: 'UNIVERSAL', arch: 'MAXILLARY', dentalAxes: { mesial: [1, 0, 0], facial: [0, -1, 0], occlusal: [0, 0, 1] }, materialProfileId: 'zirconia-monolithic', parameters: { ...defaultCrownParameters(8), radialSegments: 24, surfaceRings: 6 }, adjacentMeshes: [{ objectId: mesial.id, side: 'mesial', mesh: mesial.mesh }, { objectId: distal.id, side: 'distal', mesh: distal.mesh }], antagonist: { objectId: opposing.id, mesh: opposing.mesh }, referenceAdaptation: { mode: 'none', influence: 0, selectedRegion: null }, contourReferences: [{ objectId: preparation.id, kind: 'preparation', mesh: preparation.mesh }],
  };
  return { preparation, mesial, distal, opposing, input, result: generateCrownProposal(input) };
}

function setup() {
  const artifacts = new ArtifactManager([privateFixture.preparation, privateFixture.mesial, privateFixture.distal, privateFixture.opposing]); const scene = new SceneManager(); scene.addFromArtifact(privateFixture.preparation, 'preparation'); scene.addFromArtifact(privateFixture.mesial, 'reference'); scene.addFromArtifact(privateFixture.distal, 'reference'); scene.addFromArtifact(privateFixture.opposing, 'opposing'); return { artifacts, scene, restorations: new RestorationStateManager(), bus: new CommandBus() };
}

function command(runtime: ReturnType<typeof setup>) { return new CrownProposalCommand(runtime, privateFixture.input, privateFixture.result, { preparationVersionId: 'CASE-001-manual-segmentation-v1', approvedMarginVersionId: 'CASE-001-technician-margin-v1', insertionAxisAnalysisId: 'CASE-001-technician-axis-v1' }); }

function sideArtifact(source: ArtifactRecord, name: string, boundary: number, lower: boolean): ArtifactRecord {
  const topology = indexedMesh(source.mesh); const faces = topology.faces.filter((face) => { const x = face.reduce((sum, id) => sum + topology.positions[id][0], 0) / 3; return lower ? x < boundary : x > boundary; }); const mesh = meshData({ positions: topology.positions, faces }); return derived(source, name, mesh);
}

function derived(source: ArtifactRecord, name: string, mesh: MeshData): ArtifactRecord { const topology = indexedMesh(mesh); const encoded = new TextEncoder().encode(JSON.stringify(topology)); return { ...structuredClone(source), id: name, sourceName: `${name}.stl`, checksum: sha256(encoded), byteLength: encoded.byteLength, metadata: { privateCorpusCase: 'CASE-001', derivedPurpose: name }, history: [...source.history, { at: '2026-08-13T00:00:00.000Z', action: 'private-derived-robustness-fixture', detail: name }], mesh, derivedFrom: { parentArtifactId: source.id, rootArtifactId: source.derivedFrom?.rootArtifactId ?? source.id, operationId: name, operation: 'private-derived-robustness-fixture', version: 1, before: inspectGeometry(indexedMesh(source.mesh)), after: inspectGeometry(topology), createdAt: '2026-08-13T00:00:00.000Z' } }; }

function nearestProjected(points: Vec3[], target: Vec3): Vec3 { let nearest = points[0]; let minimum = Infinity; for (const point of points) { const distance = (point[0] - target[0]) ** 2 + (point[1] - target[1]) ** 2; if (distance < minimum) { minimum = distance; nearest = point; } } return [...nearest]; }

function originalFileNames(): string[] { return corpusCase.manifest.files.flatMap((value) => value.path ?? value.sanitized_filename ?? []); }

class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
