import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { createProject, ProjectStore } from '../src/core';
import { CommandBus } from '../src/commands';
import { EditingStateManager } from '../src/editing-state';
import { indexedMesh } from '../src/editing-geometry';
import { executePreparationAnalysis, automaticSegmentation, calculatePreparationMeasurements, createPreparationRecord, detectMarginsForPreparation } from '../src/preparation-engine';
import { compareMarginVersions, evaluateMarginQuality, marginVersionFromCandidate } from '../src/margin-engine';
import { moveMarginControlPoint, reprojectMargin } from '../src/margin-editor';
import { runPreparationQc } from '../src/preparation-qc';
import { MarginEditCommand } from '../src/preparation-commands';
import { PreparationStateManager } from '../src/preparation-state';
import { goldenPreparation, type PreparationFixtureFamily } from './golden-preparations';

const CASES: Array<{ name: string; family: PreparationFixtureFamily; segments: number }> = [
  { name: 'small-preparation', family: 'chamfer-crown', segments: 24 },
  { name: 'single-dense-preparation', family: 'shoulder', segments: 96 },
  { name: 'multiple-preparations', family: 'multiple-adjacent', segments: 48 },
  { name: 'bridge-case', family: 'bridge-abutments', segments: 48 },
  { name: 'high-density-scan', family: 'radial-shoulder', segments: 192 },
  { name: 'noisy-scan', family: 'noisy-scan', segments: 96 },
];

describe('measured preparation and margin performance', () => {
  for (const value of CASES) it(`measures ${value.name} without mutating source geometry`, async () => {
    const fixture = goldenPreparation(value.family, value.segments); const sourceBefore = structuredClone(fixture.artifact); const heapBefore = process.memoryUsage().heapUsed; let cooperativeYields = 0; let heartbeat = 0;
    const heartbeatTimer = setInterval(() => { heartbeat += 1; }, 0);
    const detectionStart = performance.now(); const detection = await executePreparationAnalysis({ requestId: crypto.randomUUID(), artifactId: fixture.artifact.id, sceneObjectId: fixture.object.id, mesh: fixture.artifact.mesh, dentalAxis: [0, 0, 1], mode: 'detect-preparations' }, { yieldControl: async () => { cooperativeYields += 1; await new Promise<void>((resolve) => setTimeout(resolve, 0)); } }); const detectionDurationMs = performance.now() - detectionStart; clearInterval(heartbeatTimer);
    const candidates = detection.candidates ?? []; const candidate = candidates.find((item) => item.marginCandidates.length); expect(candidate).toBeDefined(); const preparation = createPreparationRecord(candidate!); const segmentation = { ...automaticSegmentation(candidate!, fixture.artifact), preparationId: preparation.id }; const mesh = indexedMesh(fixture.artifact.mesh);
    const proposalStart = performance.now(); const margins = detectMarginsForPreparation(mesh, preparation, segmentation, [0, 0, 1]); const marginProposalDurationMs = performance.now() - proposalStart; expect(margins.length).toBeGreaterThan(0); const selected = margins[0];
    const confidenceStart = performance.now(); const confidenceChecksum = selected.segments.reduce((sum, segment) => sum + segment.confidence + segment.dihedralDegrees + segment.normalTransition + segment.surfaceSupport, 0); const confidenceAnalysisDurationMs = performance.now() - confidenceStart;
    let margin = marginVersionFromCandidate(selected, preparation.id, segmentation.id, fixture.object); const comparisonVersion = margins[1] ? marginVersionFromCandidate(margins[1], preparation.id, segmentation.id, fixture.object) : moveMarginControlPoint(margin, 0, margin.curve.controlPoints[0], fixture.artifact); const compareStart = performance.now(); const comparison = compareMarginVersions(margin, comparisonVersion); const candidateComparisonDurationMs = performance.now() - compareStart;
    const editingStart = performance.now(); margin = moveMarginControlPoint(margin, 0, margin.curve.controlPoints[0], fixture.artifact); const marginEditingDurationMs = performance.now() - editingStart;
    const projectionStart = performance.now(); margin = reprojectMargin(margin, fixture.artifact, fixture.object); const surfaceProjectionDurationMs = performance.now() - projectionStart;
    margin.quality = evaluateMarginQuality(margin, fixture.artifact, segmentation.faceIds, [0, 0, 1]); const measurements = calculatePreparationMeasurements(mesh, preparation, segmentation, [0, 0, 1], margin.curve.sampledPoints); const qcStart = performance.now(); const qc = runPreparationQc({ ...preparation, measurements }, measurements, margin, margin.quality, preparation.materialRuleId, mesh); const qcAnalysisDurationMs = performance.now() - qcStart;
    const preparationState = new PreparationStateManager({ ...new PreparationStateManager().get(), preparations: [{ ...preparation, segmentationVersionIds: [segmentation.id], activeSegmentationVersionId: segmentation.id }], segmentations: [segmentation] }); const editing = new EditingStateManager(); const bus = new CommandBus(); const command = new MarginEditCommand(preparationState, editing, margin, margin.curve, 'margin.performance-version', 'Store measured margin version'); const versionStart = performance.now(); await bus.execute(command); const versionSaveDurationMs = performance.now() - versionStart; const undoStart = performance.now(); await bus.undo(); const undoDurationMs = performance.now() - undoStart; const redoStart = performance.now(); await bus.redo(); const redoDurationMs = performance.now() - redoStart;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); const project = createProject(`Preparation performance ${value.name}`); project.artifacts = [fixture.artifact]; project.scene = [fixture.object]; project.editing = editing.get(); project.preparation = { ...preparationState.get(), qcResults: [qc] }; const store = new ProjectStore(); const saveStart = performance.now(); const saved = store.save(project); const projectSaveDurationMs = performance.now() - saveStart; const reopenStart = performance.now(); const reopened = store.open(saved.id); const reopenDurationMs = performance.now() - reopenStart; store.autoSave(reopened); const recoveryStart = performance.now(); const recovered = store.recover(); const recoveryDurationMs = performance.now() - recoveryStart;
    const measurement = { case: value.name, vertices: mesh.positions.length, triangles: mesh.faces.length, preparationCandidates: candidates.length, marginCandidates: margins.length, detectionDurationMs, marginProposalDurationMs, confidenceAnalysisDurationMs, candidateComparisonDurationMs, marginEditingDurationMs, surfaceProjectionDurationMs, qcAnalysisDurationMs, versionSaveDurationMs, undoDurationMs, redoDurationMs, projectSaveDurationMs, reopenDurationMs, recoveryDurationMs, heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore, cooperativeYields, mainLoopHeartbeats: heartbeat, confidenceChecksum, comparisonMaximumDistanceMm: comparison.maximumDistanceMm };
    console.info(`PREPARATION_PERFORMANCE ${JSON.stringify(measurement)}`);
    expect(Object.values(measurement).filter((item) => typeof item === 'number').every(Number.isFinite)).toBe(true); expect(cooperativeYields).toBeGreaterThan(0); expect(heartbeat).toBeGreaterThan(0); expect(recovered?.preparation).toEqual(project.preparation); expect(fixture.artifact).toEqual(sourceBefore);
  });
});

class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
