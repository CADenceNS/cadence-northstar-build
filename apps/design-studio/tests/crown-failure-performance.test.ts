import { describe, it } from 'node:test';
import { ArtifactManager, createProject, ProjectStore, SceneManager } from '../src/core';
import { CommandBus } from '../src/commands';
import { buildCrownSolid, resampleClosedMargin, scaleCrownAnatomy, sculptCrownSurface } from '../src/crown-geometry';
import { optimizeCrownConstraints } from '../src/crown-analysis';
import { createCrownExportRecords } from '../src/crown-export';
import { generateCrownProposal } from '../src/crown-engine';
import { simulateSeating } from '../src/crown-analysis';
import { validateAllCrownExports } from '../src/crown-export';
import { indexedMesh } from '../src/editing-geometry';
import { CROWN_MATERIAL_PROFILES, defaultCrownParameters } from '../src/morphology-core';
import { CrownProposalCommand } from '../src/restoration-commands';
import { RestorationStateManager } from '../src/restoration-state';
import { runCrownQc } from '../src/crown-qc';
import { CROWN_TOOL_COVERAGE_REGISTRY } from '../src/crown-tool-registry';
import { UNIVERSAL_TOOL_COVERAGE_REGISTRY } from '../src/tool-registry';
import { boxMesh, goldenCrown } from './golden-crowns';
import { goldenPreparation } from './golden-preparations';
import { expect } from './test-helpers';

describe('crown failure corpus rejects unsupported or corrupt input', () => {
  it('rejects invalid tooth numbers and morphology mismatches', () => { const fixture = goldenPreparation('chamfer-crown', 32); const base = input(fixture); expect(() => buildCrownSolid({ ...base, toothNumber: '0' })).toThrow(/morphology|tooth/i); expect(() => buildCrownSolid({ ...base, toothNumber: '3' })).toThrow(/not governed/i); });
  it('rejects insufficient, non-enclosing, and non-finite margins', () => { const fixture = goldenPreparation('chamfer-crown', 32); const base = input(fixture); expect(() => buildCrownSolid({ ...base, marginPoints: fixture.trueMargins[0].slice(0, 4) })).toThrow(/eight/i); expect(() => resampleClosedMargin(Array.from({ length: 8 }, () => [0, 0, 0]), 32)).toThrow(/perimeter|eight/i); const invalid = structuredClone(fixture.trueMargins[0]); invalid[0][0] = Number.NaN; expect(() => buildCrownSolid({ ...base, marginPoints: invalid })).toThrow(/eight|finite/i); });
  it('rejects zero insertion axes and governed parameter violations', () => { const fixture = goldenPreparation('chamfer-crown', 32); const base = input(fixture); expect(() => buildCrownSolid({ ...base, insertionAxis: [0, 0, 0] })).toThrow(/axis/i); expect(() => buildCrownSolid({ ...base, parameters: { ...base.parameters, cementGapMm: 2 } })).toThrow(/cementGapMm/); expect(() => buildCrownSolid({ ...base, parameters: { ...base.parameters, radialSegments: 7 } })).toThrow(/Radial segments/); });
  it('detects an impossible seating path against actual blocking geometry', () => { const fixture = goldenCrown('maxillary-central-incisor'); const bounds = fixture.result.mesh.bounds; const blocker = boxMesh([bounds.min[0] - 2, bounds.min[1] - 2, bounds.min[2] - 2], [bounds.max[0] + 2, bounds.max[1] + 2, bounds.max[2] + 2]); const solid = buildCrownSolid(fixture.input); const seating = simulateSeating(solid, { ...fixture.input, preparationMesh: blocker }); expect(seating.status).toBe('fail'); expect(seating.blockingVertexIds.length).toBeGreaterThan(0); });
  it('rejects locked sculpting/morphing and brush misses', () => { const fixture = goldenCrown('maxillary-central-incisor'); expect(() => sculptCrownSurface(fixture.result.mesh, fixture.result.topologyMap, { center: [0, 0, 0], radiusMm: 1, strengthMm: 0.1, mode: 'add' }, { ...fixtureResultLocks(), anatomy: true })).toThrow(/lock/i); expect(() => sculptCrownSurface(fixture.result.mesh, fixture.result.topologyMap, { center: [1000, 1000, 1000], radiusMm: 1, strengthMm: 0.1, mode: 'add' }, fixtureResultLocks())).toThrow(/does not intersect/i); expect(() => scaleCrownAnatomy(fixture.result.mesh, fixture.result.topologyMap, [0, 0, 0], [2, 1, 1], fixtureResultLocks())).toThrow(/0.7 and 1.3/); });
  it('reports complete direct tool coverage evidence and no inactive crown tool', () => { expect(CROWN_TOOL_COVERAGE_REGISTRY.length).toBeGreaterThan(70); expect(new Set(CROWN_TOOL_COVERAGE_REGISTRY.map((value) => value.toolId)).size).toBe(CROWN_TOOL_COVERAGE_REGISTRY.length); expect(CROWN_TOOL_COVERAGE_REGISTRY.every((value) => value.undoRedo && value.persistence && value.recovery && value.algorithm.length > 20 && value.geometryOperation.length > 10 && value.deterministicEvidence.length > 0 && value.browserEvidence.length > 0 && value.performanceEvidence.length > 0 && value.failClosedConditions.length > 5)).toBe(true); expect(UNIVERSAL_TOOL_COVERAGE_REGISTRY.length).toBeGreaterThan(CROWN_TOOL_COVERAGE_REGISTRY.length); });
  it('fails closed for every required crown failure category', async () => {
    const fixture = goldenCrown('maxillary-first-molar'); const corrupt = structuredClone(fixture.result.mesh); corrupt.sourceTopology!.positions[0] = Number.NaN;
    expect(() => buildCrownSolid({ ...fixture.input, marginPoints: [] })).toThrow(/margin|eight/i);
    const crossing = structuredClone(fixture.input.marginPoints); [crossing[1], crossing[12]] = [crossing[12], crossing[1]]; expect(() => buildCrownSolid({ ...fixture.input, marginPoints: crossing })).toThrow();
    expect(() => optimizeCrownConstraints(fixture.result.mesh, fixture.result.topologyMap, { ...fixture.input, adjacentMeshes: [] }, fixtureResultLocks())).toThrow(/requires mesial, distal/i);
    expect(() => optimizeCrownConstraints(fixture.result.mesh, fixture.result.topologyMap, fixture.input, { ...fixtureResultLocks(), mesialContact: true, distalContact: true, occlusion: true, anatomy: true, intaglio: true }).evidence.status).not.toThrow();
    await expect(validateAllCrownExports(corrupt)).rejects.toThrow(/corrupt|invalid|finite/i);
    const invalidProfile = { ...fixture.input, parameters: { ...fixture.input.parameters, internalRadiusMm: 0.01 } }; expect(() => buildCrownSolid(invalidProfile)).toThrow(/Internal radius/);
    const now = new Date(0).toISOString(); const record = { ...minimalRecord(fixture), approvalState: 'QC_FAILED' as const, activeQcResultId: null }; expect(() => createCrownExportRecords(record, [], now)).toThrow(/QC|approved/i);
  });
});

describe('measured crown performance and deterministic stability', () => {
  for (const value of [{ label: 'small', radialSegments: 24, surfaceRings: 6 }, { label: 'medium', radialSegments: 48, surfaceRings: 12 }, { label: 'high-density', radialSegments: 96, surfaceRings: 20 }]) {
    it(`measures ${value.label} crown proposal and four-format round trip`, async () => {
      const heap = process.memoryUsage().heapUsed; const started = performance.now(); const fixture = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', value); const proposalDurationMs = performance.now() - started; const exportStart = performance.now(); const exports = await validateAllCrownExports(fixture.result.mesh); const exportDurationMs = performance.now() - exportStart; const measurement = { case: value.label, vertices: fixture.result.inspection.vertexCount, triangles: fixture.result.inspection.triangleCount, proposalDurationMs, analysisDurationMs: fixture.result.durationMs, exportDurationMs, heapDeltaBytes: process.memoryUsage().heapUsed - heap, maximumRoundTripDeviationMm: Math.max(...exports.map((output) => output.roundTrip.maximumSurfaceDeviationMm)), watertight: fixture.result.inspection.watertight, selfIntersections: fixture.result.inspection.selfIntersectionCount };
      console.info(`CROWN_PERFORMANCE ${JSON.stringify(measurement)}`); expect(Object.values(measurement).filter((item) => typeof item === 'number').every(Number.isFinite)).toBe(true); expect(measurement.watertight).toBe(true); expect(measurement.selfIntersections).toBe(0); expect(measurement.maximumRoundTripDeviationMm).toBeLessThanOrEqual(0.001); expect(exports.every((output) => output.roundTrip.passed)).toBe(true);
    });
  }
  it('measures every required deterministic crown production stage', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    const heapBefore = process.memoryUsage().heapUsed;
    const fixture = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', { radialSegments: 48, surfaceRings: 12 });
    const indexed = indexedMesh(fixture.result.mesh); const sculptVertexId = fixture.result.topologyMap.outerVertexIds.find((id) => fixture.result.topologyMap.regions[id] === 'axial')!;
    let started = performance.now();
    const sculpted = sculptCrownSurface(fixture.result.mesh, fixture.result.topologyMap, { center: indexed.positions[sculptVertexId], radiusMm: 1.5, strengthMm: 0.02, mode: 'add' }, fixtureResultLocks());
    const sculptResponseMs = performance.now() - started;
    started = performance.now();
    const optimized = optimizeCrownConstraints(fixture.result.mesh, fixture.result.topologyMap, fixture.input, fixtureResultLocks(), [], { maximumIterations: 3 });
    const autoOptimizationMs = performance.now() - started;
    const outputs = await validateAllCrownExports(fixture.result.mesh);
    const record = minimalRecord(fixture);
    started = performance.now();
    const qc = runCrownQc(record, fixture.result.mesh, outputs.map((value) => value.roundTrip));
    const qcDurationMs = performance.now() - started;

    const artifacts = new ArtifactManager([fixture.preparation.artifact]); const scene = new SceneManager([fixture.preparation.object]); const restorations = new RestorationStateManager(); const bus = new CommandBus();
    const command = new CrownProposalCommand({ artifacts, scene, restorations }, fixture.input, fixture.result, { preparationVersionId: 'segmentation-v1', approvedMarginVersionId: 'margin-v1', insertionAxisAnalysisId: 'axis-v1' });
    started = performance.now(); await bus.execute(command); const commandExecutionMs = performance.now() - started;
    started = performance.now(); await bus.undo(); const undoDurationMs = performance.now() - started;
    started = performance.now(); await bus.redo(); const redoDurationMs = performance.now() - started;
    const project = createProject('Measured crown project'); project.scene = scene.list(); project.artifacts = artifacts.list(); project.restoration = restorations.get(); const store = new ProjectStore();
    started = performance.now(); const saved = store.save(project); const saveDurationMs = performance.now() - started;
    started = performance.now(); const reopened = store.open(saved.id); const reopenDurationMs = performance.now() - started;

    const performanceEvidence = {
      ...fixture.result.performance,
      sculptResponseMs,
      autoOptimizationMs,
      qcDurationMs,
      exportSerializationMs: outputs.reduce((sum, value) => sum + value.performance.exportSerializationMs, 0),
      reimportDurationMs: outputs.reduce((sum, value) => sum + value.performance.reimportDurationMs, 0),
      roundTripValidationMs: outputs.reduce((sum, value) => sum + value.performance.roundTripValidationMs, 0),
      commandExecutionMs,
      undoDurationMs,
      redoDurationMs,
      saveDurationMs,
      reopenDurationMs,
      heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
    };
    console.info(`CROWN_STAGE_PERFORMANCE ${JSON.stringify(performanceEvidence)}`);
    expect(Object.values(performanceEvidence).every(Number.isFinite)).toBe(true);
    expect(Object.values(fixture.result.performance).every((value) => value >= 0)).toBe(true);
    expect(sculpted.sourceTopology).not.toEqual(fixture.result.mesh.sourceTopology);
    expect(optimized.evidence.iterationCount).toBeGreaterThan(0);
    expect(qc.hardFailureCount).toBe(0);
    expect(reopened.restoration).toEqual(project.restoration);
  });
  it('measures four simultaneously generated crowns and preserves byte-identical reruns', () => { const started = performance.now(); const families = ['maxillary-central-incisor', 'maxillary-first-premolar', 'maxillary-first-molar', 'mandibular-first-molar'] as const; const first = families.map((family) => goldenCrown(family)); const durationMs = performance.now() - started; const rerun = first.map((fixture) => generateCrownProposal({ ...fixture.input, requestId: `${fixture.input.requestId}-multi-rerun` })); console.info(`CROWN_MULTI_PERFORMANCE ${JSON.stringify({ meshes: first.length, triangles: first.reduce((sum, fixture) => sum + fixture.result.inspection.triangleCount, 0), durationMs, heapBytes: process.memoryUsage().heapUsed })}`); expect(rerun.map((value) => value.mesh.sourceTopology)).toEqual(first.map((value) => value.result.mesh.sourceTopology)); });
});

function input(fixture: ReturnType<typeof goldenPreparation>) { return { requestId: 'failure', preparationId: 'prep', preparationArtifactId: fixture.artifact.id, preparationMesh: fixture.artifact.mesh, marginPoints: fixture.trueMargins[0], insertionAxis: [0, 0, 1] as [number, number, number], toothNumber: '8', caseId: 'failure-case', numberingSystem: 'UNIVERSAL' as const, arch: 'MAXILLARY' as const, dentalAxes: { mesial: [1, 0, 0] as [number, number, number], facial: [0, -1, 0] as [number, number, number], occlusal: [0, 0, 1] as [number, number, number] }, materialProfileId: 'zirconia-monolithic' as const, parameters: { ...defaultCrownParameters(8), radialSegments: 32, surfaceRings: 8 }, adjacentMeshes: [], referenceAdaptation: { mode: 'none' as const, influence: 0, selectedRegion: null }, contourReferences: [{ objectId: fixture.artifact.id, kind: 'preparation' as const, mesh: fixture.artifact.mesh }] }; }
function fixtureResultLocks() { return { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false }; }
function minimalRecord(fixture: ReturnType<typeof goldenCrown>) { const profile = CROWN_MATERIAL_PROFILES[fixture.input.materialProfileId]; const now = new Date(0).toISOString(); return { id: 'failure-restoration', caseId: fixture.input.caseId, numberingSystem: fixture.input.numberingSystem, arch: fixture.input.arch, restorationType: 'SINGLE_UNIT_TOOTH_SUPPORTED_CROWN' as const, preparationId: fixture.input.preparationId, preparationVersionId: 'seg', approvedMarginVersionId: 'margin', insertionAxisAnalysisId: 'axis', toothNumber: String(fixture.toothNumber), morphologyId: fixture.input.parameters.morphologyId, morphologyVersion: 'CADENCE-MORPHOLOGY-1.0.0', materialProfileId: fixture.input.materialProfileId, materialProfileVersion: profile.version, materialProfileSnapshot: profile, adjacentObjectIds: { mesial: null, distal: null }, opposingObjectId: null, preOpObjectId: null, referenceAdaptation: fixture.input.referenceAdaptation, designVersion: 1, manufacturingState: 'QC_REQUIRED' as const, geometryLineageRootArtifactId: fixture.preparation.artifact.id, activeBranchId: 'main', artifactId: 'crown', sceneObjectId: 'object', parameters: fixture.input.parameters, locks: fixtureResultLocks(), topologyMap: fixture.result.topologyMap, thickness: fixture.result.thickness, cementSpace: fixture.result.cementSpace, seating: fixture.result.seating, mesialContact: fixture.result.mesialContact, distalContact: fixture.result.distalContact, occlusion: fixture.result.occlusion, contour: fixture.result.contour, optimization: null, sculptMaskVertexIds: [], lockedAnatomyVertexIds: [], qcResultIds: [], activeQcResultId: null, versionIds: ['v1'], activeVersionId: 'v1', exportRecordIds: [], historyEventIds: [], checkpointIds: [], approvalState: 'QC_REQUIRED' as const, approvedAt: null, approvedBy: null, createdAt: now, updatedAt: now }; }
class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
