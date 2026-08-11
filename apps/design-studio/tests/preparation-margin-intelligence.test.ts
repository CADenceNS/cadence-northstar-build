import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { createProject, ProjectStore, type Vec3 } from '../src/core';
import { indexedMesh } from '../src/editing-geometry';
import { CommandBus } from '../src/commands';
import { EditingStateManager } from '../src/editing-state';
import { PreparationStateManager } from '../src/preparation-state';
import { MarginEditCommand, PreparationStateCommand } from '../src/preparation-commands';
import {
  analyzeInsertionAxis,
  automaticSegmentation,
  calculatePreparationMeasurements,
  createPreparationRecord,
  detectMarginsForPreparation,
  detectPreparationCandidates,
  manualSegmentation,
  refineSegmentation,
  setInsertionAxis,
  setSegmentationLock,
  sharedBridgeAxis,
} from '../src/preparation-engine';
import {
  approveMarginVersion,
  compareMarginVersions,
  evaluateMarginQuality,
  lockMarginVersion,
  marginVersionFromCandidate,
  snapMarginPoint,
} from '../src/margin-engine';
import {
  addMarginControlPoint,
  combineCandidateSections,
  deleteMarginControlPoint,
  dragMarginSection,
  drawManualMargin,
  extendMargin,
  insertMarginControlPoint,
  joinMargin,
  localReprojectMargin,
  moveMarginControlPoint,
  offsetMargin,
  reprojectMargin,
  resampleMargin,
  reverseMargin,
  setMarginClosed,
  simplifyMargin,
  smoothMargin,
  splitMargin,
  trimMargin,
} from '../src/margin-editor';
import { runPreparationQc } from '../src/preparation-qc';
import { MARGIN_TOOL_COVERAGE_REGISTRY } from '../src/margin-tool-registry';
import { TOOL_COVERAGE_REGISTRY, UNIVERSAL_TOOL_COVERAGE_REGISTRY } from '../src/tool-registry';
import { goldenPreparation, type PreparationFixtureFamily } from './golden-preparations';
import type { MarginCandidate, MarginVersion, PreparationRecord, PreparationSegmentation } from '../src/preparation-types';

const FAMILIES: PreparationFixtureFamily[] = [
  'chamfer-crown', 'heavy-chamfer', 'shoulder', 'radial-shoulder', 'knife-edge', 'feather-edge',
  'veneer', 'inlay', 'onlay', 'overlay', 'multiple-adjacent', 'bridge-abutments', 'irregular',
  'partial-missing-margin', 'noisy-scan', 'rounded-scan-noise', 'local-artifact', 'ambiguous-finish-line',
];

describe('analytic preparation and margin ground-truth corpus', () => {
  for (const family of FAMILIES) {
    it(`measures geometry-supported ${family} candidates deterministically`, () => {
      const fixture = goldenPreparation(family, 32);
      const first = detectPreparationCandidates(indexedMesh(fixture.artifact.mesh), fixture.artifact.id, fixture.object.id, [0, 0, 1]);
      const second = detectPreparationCandidates(indexedMesh(fixture.artifact.mesh), fixture.artifact.id, fixture.object.id, [0, 0, 1]);
      const normalized = (values: typeof first) => values.map((candidate) => ({
        state: candidate.state,
        faces: candidate.faceIds,
        confidence: candidate.confidence,
        margins: candidate.marginCandidates.map((margin) => ({
          points: margin.points,
          confidence: margin.confidence,
          closed: margin.closed,
          finishLine: margin.globalFinishLine,
          evidence: margin.segments.map((segment) => [segment.dihedralDegrees, segment.normalTransition, segment.surfaceSupport, segment.confidence, segment.finishLine]),
        })),
      }));
      expect(normalized(second)).toEqual(normalized(first));
      expect(first.length).toBeGreaterThan(0);
      expect(first.every((candidate) => candidate.state !== 'AUTO_DETECTED_HIGH_CONFIDENCE' || candidate.confidence >= 0.7)).toBe(true);
      if (['partial-missing-margin', 'ambiguous-finish-line'].includes(family)) {
        expect(first.every((candidate) => candidate.state !== 'AUTO_DETECTED_HIGH_CONFIDENCE')).toBe(true);
        return;
      }
      const measured = matchDetectionsToTruth(first.flatMap((candidate) => candidate.marginCandidates), fixture.trueMargins);
      expect(measured.maximumErrorMm).toBeLessThanOrEqual(0.22);
      expect(measured.topologicallyCorrect).toBe(true);
      const detectedFaces = new Set(first.flatMap((candidate) => candidate.faceIds));
      const expectedFaces = new Set(fixture.expectedPreparationFaceIds.flat());
      expect(jaccard(detectedFaces, expectedFaces)).toBeGreaterThanOrEqual(0.55);
      for (const expected of fixture.expectedFinishLines) expect(first.flatMap((candidate) => candidate.marginCandidates).some((margin) => margin.globalFinishLine === expected)).toBe(true);
    });
  }

  it('reports exact aggregate geometric error statistics instead of visual similarity', () => {
    const errors: number[] = [];
    for (const family of FAMILIES.filter((value) => !['partial-missing-margin', 'ambiguous-finish-line'].includes(value))) {
      const fixture = goldenPreparation(family, 40); const detected = detectPreparationCandidates(indexedMesh(fixture.artifact.mesh), fixture.artifact.id, fixture.object.id, [0, 0, 1]);
      for (const truth of fixture.trueMargins) { const best = bestCandidate(detected.flatMap((candidate) => candidate.marginCandidates), truth); errors.push(...pointErrors(best.points, truth)); }
    }
    const ordered = [...errors].sort((a, b) => a - b);
    expect(mean(ordered)).toBeLessThanOrEqual(0.1); expect(percentile(ordered, 50)).toBeLessThanOrEqual(0.1); expect(percentile(ordered, 95)).toBeLessThanOrEqual(0.2); expect(Math.max(...ordered)).toBeLessThanOrEqual(0.25);
  });
});

describe('preparation segmentation, insertion axis, measurements, and governed QC', () => {
  it('creates, grows, shrinks, refines, and independently locks versioned non-destructive segmentation', () => {
    const { fixture, candidate, preparation, segmentation } = setupPreparation('chamfer-crown');
    const grown = refineSegmentation(segmentation, fixture.artifact, 'grow'); const shrunk = refineSegmentation(grown, fixture.artifact, 'shrink'); const excluded = refineSegmentation(grown, fixture.artifact, 'exclude-neighbors'); const locked = setSegmentationLock(excluded, true);
    expect(grown.version).toBe(segmentation.version + 1); expect(grown.faceIds.length).toBeGreaterThanOrEqual(segmentation.faceIds.length); expect(shrunk.faceIds.length).toBeGreaterThan(0); expect(excluded.faceIds.length).toBeGreaterThan(0); expect(locked.locked).toBe(true); expect(() => refineSegmentation(locked, fixture.artifact, 'grow')).toThrow(/unlock/); expect(fixture.artifact.mesh).toEqual(goldenPreparation('chamfer-crown', 32).artifact.mesh); expect(candidate.faceIds).toEqual(segmentation.faceIds); expect(preparation.artifactId).toBe(fixture.artifact.id);
  });

  it('supports explicit manual face identification and rejects empty or invalid selection', () => {
    const fixture = goldenPreparation('chamfer-crown', 24); const selected = fixture.expectedPreparationFaceIds[0].slice(0, 12); const segmentation = manualSegmentation('prep', fixture.artifact, fixture.object.id, selected);
    expect(segmentation.faceIds).toEqual([...selected].sort((a, b) => a - b)); expect(segmentation.source).toBe('manual'); expect(() => manualSegmentation('prep', fixture.artifact, fixture.object.id, [])).toThrow(/requires selected/); expect(() => manualSegmentation('prep', fixture.artifact, fixture.object.id, [999999])).toThrow(/invalid face/);
  });

  it('measures automatic and manual axis candidates, lock behavior, undercuts, and bridge conflicts', () => {
    const first = setupPreparation('heavy-chamfer'); const second = setupPreparation('shoulder'); const firstAxis = analyzeInsertionAxis(indexedMesh(first.fixture.artifact.mesh), first.preparation, first.segmentation, [0, 0, 1]);
    expect(firstAxis.candidates.length).toBeGreaterThanOrEqual(5); expect(firstAxis.candidates.every((candidate) => Number.isFinite(candidate.undercutDepthMm) && Number.isFinite(candidate.accessibleMarginPercent))).toBe(true);
    const manual = setInsertionAxis(firstAxis, [0.1, 0.2, 1]); expect(manual.source).toBe('manual'); const locked = { ...manual, locked: true }; expect(() => setInsertionAxis(locked, [0, 0, 1])).toThrow(/locked/);
    const compatible = sharedBridgeAxis([manual, { ...analyzeInsertionAxis(indexedMesh(second.fixture.artifact.mesh), second.preparation, second.segmentation, [0, 0, 1]), selectedAxis: manual.selectedAxis }]); expect(compatible.conflict).toBe(false); expect(compatible.commonAxis).toBeDefined();
    const conflict = sharedBridgeAxis([manual, { ...manual, id: 'second', selectedAxis: [0.8, 0, 0.6] }]); expect(conflict.conflict).toBe(true); expect(conflict.commonAxis).toBe(null);
  });

  it('calculates geometry-derived preparation, pre-op reduction, antagonist, and adjacent clearance measurements', () => {
    const { fixture, preparation, segmentation, margin } = setupPreparation('chamfer-crown'); const mesh = indexedMesh(fixture.artifact.mesh); const preop = translatedMesh(fixture.artifact.mesh, [0, 0, 0.8]); const antagonist = translatedMesh(fixture.artifact.mesh, [0, 0, 12]); const adjacent = translatedMesh(fixture.artifact.mesh, [12, 0, 0]);
    const measurements = calculatePreparationMeasurements(mesh, preparation, segmentation, [0, 0, 1], margin.points, preop, antagonist, [adjacent]);
    expect(measurements.preoperativeReferenceAvailable).toBe(true); expect(measurements.preoperativeReductionSamplesMm.length).toBeGreaterThan(0); expect(measurements.preoperativeReductionMap).toHaveLength(measurements.preoperativeReductionSamplesMm.length); expect(measurements.heightMm).toBeGreaterThan(0); expect(measurements.widthMm).toBeGreaterThan(0); expect(measurements.surfaceAreaMm2).toBeGreaterThan(0); expect(measurements.marginCircumferenceMm).toBeGreaterThan(20); expect(measurements.antagonistClearanceMm).toBeGreaterThan(0); expect(measurements.adjacentClearanceMm).toBeGreaterThan(0);
    const unavailable = calculatePreparationMeasurements(mesh, preparation, segmentation, [0, 0, 1], margin.points); expect(unavailable.preoperativeReferenceAvailable).toBe(false); expect(unavailable.occlusalReductionMm).toBe(null); expect(unavailable.antagonistClearanceMm).toBe(null); expect(unavailable.adjacentClearanceMm).toBe(null);
  });

  it('applies versioned material/restoration rules and reports unavailable comparisons as not-run', () => {
    const { fixture, preparation, segmentation, margin } = setupPreparation('chamfer-crown'); const measured = calculatePreparationMeasurements(indexedMesh(fixture.artifact.mesh), preparation, segmentation, [0, 0, 1], margin.points); const version = marginVersionFromCandidate(margin, preparation.id, segmentation.id, fixture.object); version.quality = evaluateMarginQuality(version, fixture.artifact, segmentation.faceIds, [0, 0, 1]);
    const mesh = indexedMesh(fixture.artifact.mesh); const result = runPreparationQc({ ...preparation, measurements: measured }, measured, version, version.quality, 'generic-ceramic-crown', mesh); expect(result.rulesetVersion).toMatch(/CADENCE-PREP-QC/); expect(result.checks.length).toBeGreaterThan(5); expect(result.checks.some((check) => check.status === 'not-run')).toBe(true); expect(result.checks.every((check) => check.threshold.length > 0 && check.explanation.length > 0)).toBe(true); const unsupported = runPreparationQc({ ...preparation, measurements: measured }, measured, version, version.quality, 'unknown-profile', mesh); expect(unsupported.overall).toBe('fail'); expect(unsupported.checks.find((check) => check.id === 'qc.governed-rules')?.status).toBe('fail');
  });
});

describe('automatic margin evidence, quality, editing, lineage, and command integration', () => {
  it('retains ranked candidates and computes local confidence and finish-line evidence from mesh measurements', () => {
    const { fixture, preparation, segmentation } = setupPreparation('shoulder'); const margins = detectMarginsForPreparation(indexedMesh(fixture.artifact.mesh), preparation, segmentation, [0, 0, 1]);
    expect(margins.length).toBeGreaterThan(0); expect(margins.every((candidate, index) => candidate.rank === index + 1)).toBe(true); expect(margins.every((candidate) => candidate.segments.length > 0 && candidate.segments.every((segment) => segment.explanation.includes('Measured')))).toBe(true); expect(margins.some((candidate) => candidate.globalFinishLine === 'shoulder')).toBe(true);
  });

  it('validates every required margin-quality condition and rejects invalid approval', () => {
    const { fixture, preparation, segmentation, margin } = setupPreparation('chamfer-crown'); const version = marginVersionFromCandidate(margin, preparation.id, segmentation.id, fixture.object); const quality = evaluateMarginQuality(version, fixture.artifact, segmentation.faceIds, [0, 0, 1]);
    const ids = quality.checks.map((check) => check.id); for (const id of ['margin.closed-loop', 'margin.self-intersection', 'margin.duplicate-segments', 'margin.sharp-spikes', 'margin.curvature-discontinuity', 'margin.surface-detachment', 'margin.missing-geometry', 'margin.implausible-jump', 'margin.loop-orientation', 'margin.multiple-loops', 'margin.preparation-enclosure', 'margin.local-boundary-ambiguity']) expect(ids).toContain(id);
    const invalid = { ...version, curve: { ...version.curve, closed: false } }; invalid.quality = evaluateMarginQuality(invalid, fixture.artifact, segmentation.faceIds, [0, 0, 1]); expect(invalid.quality.valid).toBe(false); expect(() => approveMarginVersion(invalid, null, 0)).toThrow(/invalid margin/);
    version.quality = quality; if (quality.valid) { expect(() => approveMarginVersion(version, null, 1)).toThrow(/QC failure/); const approved = approveMarginVersion(version, 'technician-1', 0); const locked = lockMarginVersion(approved, true); expect(locked.stage).toBe('locked'); expect(locked.parentVersionId).toBe(approved.id); expect(() => offsetMargin(locked, 0.1, fixture.artifact)).toThrow(/Locked margin/); }
  });

  it('draws every manual mode in model coordinates and performs surface-constrained magnetic snapping', () => {
    const { fixture, margin } = setupPreparation('chamfer-crown'); const points = margin.points.filter((_, index) => index % 8 === 0).slice(0, 5).map((point) => [point[0], point[1], point[2] + 0.4] as Vec3);
    for (const mode of ['surface-following', 'magnetic', 'freehand', 'spline', 'point-by-point'] as const) { const curve = drawManualMargin(mode, points, fixture.artifact, fixture.object, mode, mode === 'magnetic' ? { confidenceOverlayVisible: true, undercutOverlayVisible: false, magnetEnabled: true, magnetStrength: 1, magnetSearchRadiusMm: 2, curvatureWeight: 1, surfaceNormalWeight: 1, smoothing: 0.2 } : undefined, margin.points); expect(curve.controlPoints.length).toBeGreaterThanOrEqual(2); expect(curve.controlPoints.every((point) => point.every(Number.isFinite))).toBe(true); }
    const snapped = snapMarginPoint([margin.points[0][0], margin.points[0][1], margin.points[0][2] + 0.5], fixture.artifact, { enabled: true, strength: 1, searchRadiusMm: 2, curvatureWeight: 1, surfaceNormalWeight: 1, smoothing: 0 }, { candidatePoints: margin.points, userAnchors: [margin.points[0]] }); expect(snapped.target).not.toBe('none'); expect(snapped.distanceMm).toBeGreaterThan(0);
  });

  it('executes the complete margin editing operation family against model coordinates', () => {
    const { fixture, preparation, segmentation, margin } = setupPreparation('chamfer-crown'); let version = marginVersionFromCandidate(margin, preparation.id, segmentation.id, fixture.object); const original = version;
    version = moveMarginControlPoint(version, 0, version.curve.controlPoints[0], fixture.artifact); version = insertMarginControlPoint(version, 1, midpoint(version.curve.controlPoints[0], version.curve.controlPoints[1])); version = addMarginControlPoint(version, version.curve.controlPoints.at(-1)!); version = deleteMarginControlPoint(version, version.curve.controlPoints.length - 1); version = dragMarginSection(version, 0, 2, [0.01, 0, 0], fixture.artifact); version = offsetMargin(version, 0.05, fixture.artifact); version = offsetMargin(version, -0.05, fixture.artifact); version = smoothMargin(version, 0.2, [0, 2]); version = smoothMargin(version, 0.1); version = simplifyMargin(version, 0.001); version = resampleMargin(version, 0.5); version = setMarginClosed(version, false); version = extendMargin(version, 0.1, 0.1); version = trimMargin(version, 0.05, Math.max(0.2, curveLength(version) - 0.1)); const [split, second] = splitMargin(version, Math.max(1, Math.floor(version.curve.controlPoints.length / 2))); version = joinMargin(split, second, 0.5); version = setMarginClosed(version, true); version = reverseMargin(version); version = reprojectMargin(version, fixture.artifact, fixture.object); version = localReprojectMargin(version, fixture.artifact, [0, 1]);
    expect(version.manualAdjustments.length).toBeGreaterThanOrEqual(18); expect(version.id).not.toBe(original.id); expect(version.confidenceMeasurements.every((segment) => segment.finishLine === 'indeterminate' && segment.category === 'ambiguous')).toBe(true); expect(compareMarginVersions(original, version).changedPointCount).toBeGreaterThan(0);
  });

  it('combines explicitly compatible candidate sections and rejects unsupported gaps', () => {
    const { margin } = setupPreparation('chamfer-crown'); const first = { ...structuredClone(margin), id: 'first' }; const second = { ...structuredClone(margin), id: 'second' }; const half = Math.floor(margin.points.length / 2); const curve = combineCandidateSections([first, second], [{ candidateId: first.id, start: 0, end: half }, { candidateId: second.id, start: half, end: margin.points.length - 1 }]); expect(curve.controlPoints.length).toBeGreaterThan(margin.points.length - 2); expect(() => combineCandidateSections([first], [{ candidateId: first.id, start: 0, end: 2 }])).toThrow(/at least two/);
  });

  it('commits margin state and curve atomically through command history with undo and redo', async () => {
    const { fixture, preparation, segmentation, margin } = setupPreparation('chamfer-crown'); const stateManager = new PreparationStateManager(); const editing = new EditingStateManager(); const bus = new CommandBus(); const version = marginVersionFromCandidate(margin, preparation.id, segmentation.id, fixture.object); const before = stateManager.get(); const next = { ...before, preparations: [preparation], segmentations: [segmentation], margins: [] };
    await bus.execute(new PreparationStateCommand(stateManager, next, 'preparation.identify', 'Identify preparation')); await bus.execute(new MarginEditCommand(stateManager, editing, version, version.curve, 'margin.accept', 'Accept margin'));
    expect(stateManager.get().margins).toHaveLength(1); expect(editing.get().curves).toHaveLength(1); await bus.undo(); expect(stateManager.get().margins).toHaveLength(0); expect(editing.get().curves).toHaveLength(0); await bus.redo(); expect(stateManager.get().margins).toHaveLength(1); expect(editing.get().curves).toHaveLength(1);
  });
});

describe('preparation persistence, recovery, and coverage registry', () => {
  it('persists and recovers preparation segmentation, axes, margins, QC, lineage, and settings', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); const { fixture, candidate, preparation, segmentation, margin } = setupPreparation('chamfer-crown'); const axis = analyzeInsertionAxis(indexedMesh(fixture.artifact.mesh), preparation, segmentation, [0, 0, 1]); const version = marginVersionFromCandidate(margin, preparation.id, segmentation.id, fixture.object); const project = createProject('Preparation persistence'); project.artifacts = [fixture.artifact]; project.scene = [fixture.object]; project.preparation = { ...project.preparation, candidates: [candidate], preparations: [{ ...preparation, segmentationVersionIds: [segmentation.id], activeSegmentationVersionId: segmentation.id, insertionAxisAnalysisIds: [axis.id], activeInsertionAxisAnalysisId: axis.id, marginVersionIds: [version.id], activeMarginVersionId: version.id }], segmentations: [segmentation], axes: [axis], margins: [version], activePreparationId: preparation.id };
    const store = new ProjectStore(); const saved = store.save(project); const opened = store.open(saved.id); expect(opened.preparation).toEqual(project.preparation); store.autoSave(opened); expect(store.recover()?.preparation).toEqual(project.preparation); expect(opened.artifacts[0]).toEqual(fixture.artifact);
  });

  it('registers every preparation and margin capability with implementation, command, persistence, recovery, test, browser, performance, support, and fail-closed evidence', () => {
    expect(MARGIN_TOOL_COVERAGE_REGISTRY.length).toBe(54); expect(UNIVERSAL_TOOL_COVERAGE_REGISTRY.length).toBe(TOOL_COVERAGE_REGISTRY.length + MARGIN_TOOL_COVERAGE_REGISTRY.length); expect(new Set(MARGIN_TOOL_COVERAGE_REGISTRY.map((entry) => entry.toolId)).size).toBe(MARGIN_TOOL_COVERAGE_REGISTRY.length);
    for (const entry of MARGIN_TOOL_COVERAGE_REGISTRY) { expect(entry.productionStatus).toBe('IMPLEMENTED_PENDING_CERTIFICATION'); expect(entry.inputRequirements.length).toBeGreaterThan(0); expect(entry.algorithm.length).toBeGreaterThan(0); expect(entry.geometryBehavior.length).toBeGreaterThan(0); expect(entry.commandCoverage.length).toBeGreaterThan(0); expect(entry.undoRedo).toBe(true); expect(entry.persistence).toBe(true); expect(entry.recovery).toBe(true); expect(entry.deterministicTests).toMatch(/preparation-margin-intelligence/); expect(entry.browserTests).toMatch(/design-studio-preparation/); expect(entry.performanceTest).toMatch(/preparation-performance/); expect(entry.knownSupportedConditions.length).toBeGreaterThan(0); expect(entry.failClosedConditions.length).toBeGreaterThan(0); }
  });
});

function setupPreparation(family: PreparationFixtureFamily): { fixture: ReturnType<typeof goldenPreparation>; candidate: ReturnType<typeof detectPreparationCandidates>[number]; preparation: PreparationRecord; segmentation: PreparationSegmentation; margin: MarginCandidate } {
  const fixture = goldenPreparation(family, 32); const candidates = detectPreparationCandidates(indexedMesh(fixture.artifact.mesh), fixture.artifact.id, fixture.object.id, [0, 0, 1]); const candidate = candidates.find((value) => value.marginCandidates.length) ?? candidates[0]; if (!candidate?.marginCandidates[0]) throw new Error(`${family} did not produce a margin candidate`); const preparation = createPreparationRecord(candidate, { kind: fixture.expectedKind }); const segmentation = { ...automaticSegmentation(candidate, fixture.artifact), preparationId: preparation.id }; return { fixture, candidate, preparation, segmentation, margin: candidate.marginCandidates[0] };
}

function bestCandidate(candidates: MarginCandidate[], truth: Vec3[]): MarginCandidate { const ranked = candidates.map((candidate) => ({ candidate, error: mean(pointErrors(candidate.points, truth)) })).sort((a, b) => a.error - b.error); if (!ranked[0]) throw new Error('No margin candidate was detected'); return ranked[0].candidate; }
function matchDetectionsToTruth(candidates: MarginCandidate[], truth: Vec3[][]): { maximumErrorMm: number; topologicallyCorrect: boolean } { const best = truth.map((margin) => bestCandidate(candidates, margin)); const errors = truth.flatMap((margin, index) => pointErrors(best[index].points, margin)); return { maximumErrorMm: Math.max(...errors), topologicallyCorrect: best.every((candidate) => candidate.closed) }; }
function pointErrors(points: Vec3[], truth: Vec3[]): number[] { return points.map((point) => Math.min(...truth.map((target) => Math.hypot(point[0] - target[0], point[1] - target[1], point[2] - target[2])))); }
function jaccard(first: Set<number>, second: Set<number>): number { const intersection = [...first].filter((value) => second.has(value)).length; const union = new Set([...first, ...second]).size; return union ? intersection / union : 0; }
function mean(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function percentile(values: number[], percent: number): number { const ordered = [...values].sort((a, b) => a - b); return ordered[Math.max(0, Math.min(ordered.length - 1, Math.ceil(ordered.length * percent / 100) - 1))] ?? 0; }
function midpoint(first: Vec3, second: Vec3): Vec3 { return [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2, (first[2] + second[2]) / 2]; }
function curveLength(value: MarginVersion): number { const points = value.curve.controlPoints; return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1], point[2] - points[index][2]), 0); }
function translatedMesh(mesh: ReturnType<typeof goldenPreparation>['artifact']['mesh'], delta: Vec3) { const next = structuredClone(mesh); for (let index = 0; index < next.positions.length; index += 3) { next.positions[index] += delta[0]; next.positions[index + 1] += delta[1]; next.positions[index + 2] += delta[2]; } if (next.sourceTopology) for (let index = 0; index < next.sourceTopology.positions.length; index += 3) { next.sourceTopology.positions[index] += delta[0]; next.sourceTopology.positions[index + 1] += delta[1]; next.sourceTopology.positions[index + 2] += delta[2]; } next.bounds = { min: next.bounds.min.map((value, index) => value + delta[index]) as Vec3, max: next.bounds.max.map((value, index) => value + delta[index]) as Vec3 }; return next; }

class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
