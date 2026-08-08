import { beforeEach, describe, it } from 'node:test';
import { expect } from './test-helpers';
import { autoAssembleCase } from '../src/case-assembly';
import { CommandBus } from '../src/commands';
import { ArtifactManager, createProject, ProjectStore, SceneManager } from '../src/core';
import { coordinateVisualizationLines, estimateDentalCoordinates, manuallyCorrectDentalAxes, reverseAnteriorDirection } from '../src/dental-coordinates';
import { alignLandmarkPairs, applyNumericAdjustment, nudgeTransform, userAdjustment } from '../src/manual-registration';
import { RegistrationStateCommand } from '../src/registration-commands';
import { registerPair } from '../src/registration-engine';
import { applyRigid, axisAngleRigid, composeRigid, identityRigid, invertRigid, rigidFromRotationTranslation, transformDifference } from '../src/registration-math';
import { createRegistrationReport, registrationReportToCsv, registrationReportToHtml, registrationReportToJson } from '../src/registration-reports';
import { createCaseScanSet, updateScan } from '../src/scan-set';
import { CaseScanSetManager, RegistrationReportManager } from '../src/state-managers';
import type { CaseScanRecord, PairwiseRegistrationResult } from '../src/registration-types';
import { archArtifact, transformArtifact } from './golden-registration';

describe('case scan assembly and dental coordinate normalization', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); });

  it('assembles upper, lower and bite scans from actual geometry without combining artifacts', async () => {
    const setup = assemblyFixture(1); const artifactsBefore = structuredClone(setup.artifacts);
    const progress: number[] = []; const assembled = await autoAssembleCase(setup.scanSet, setup.artifacts, setup.execute, (value) => progress.push(value.completed));
    expect(assembled.errors).toHaveLength(0); expect(assembled.results).toHaveLength(2); expect(assembled.scanSet.assemblyStatus).toBe('accepted');
    const upper = assembled.scanSet.scans.find((scan) => scan.assignedRole === 'upper-arch')!;
    const lower = assembled.scanSet.scans.find((scan) => scan.assignedRole === 'lower-arch')!;
    const bite = assembled.scanSet.scans.find((scan) => scan.assignedRole === 'buccal-bite-left')!;
    const difference = transformDifference(lower.registrationTransform, setup.lowerCaseTransform);
    expect(difference.translationError <= 0.05).toBe(true); expect(difference.rotationErrorDegrees <= 0.1).toBe(true);
    expect(assembled.scanSet.transformGraph.some((edge) => edge.sourceScanId === lower.id)).toBe(true);
    expect(assembled.scanSet.transformGraph.some((edge) => edge.sourceScanId === bite.id && edge.targetScanId === upper.id)).toBe(true);
    expect(assembled.scanSet.dentalCoordinates?.convention).toBe('CADENCE_DENTAL_XYZ_V1');
    expect(progress.at(-1)).toBe(2); expect(setup.artifacts).toEqual(artifactsBefore);
  });

  it('retains independent multi-bite candidates and marks conflicting occlusion for review', async () => {
    const setup = assemblyFixture(2); let lowerCall = 0;
    const execute = async (source: CaseScanRecord, target: CaseScanRecord, purpose: Parameters<typeof setup.execute>[2]) => {
      const result = await setup.execute(source, target, purpose);
      if (purpose === 'bite-lower' && lowerCall++ === 1 && result.transform) {
        const shifted = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [0.8, 0, 0]), result.transform);
        return { ...structuredClone(result), transform: shifted, deterministicFingerprint: `${result.deterministicFingerprint}-conflict` };
      }
      return result;
    };
    const assembled = await autoAssembleCase(setup.scanSet, setup.artifacts, execute);
    expect(assembled.results).toHaveLength(4); expect(assembled.scanSet.assemblyStatus).toBe('review');
    expect(assembled.warnings.join(' ')).toMatch(/Bite scans disagree/);
    expect(assembled.scanSet.relationships.filter((relationship) => relationship.purpose.startsWith('bite-'))).toHaveLength(4);
  });

  it('does not fabricate an occlusal relationship when no bite evidence exists', async () => {
    const setup = assemblyFixture(0); let calls = 0;
    const assembled = await autoAssembleCase(setup.scanSet, setup.artifacts, async (...args) => { calls += 1; return setup.execute(...args); });
    expect(calls).toBe(0); expect(assembled.scanSet.assemblyStatus).toBe('review'); expect(assembled.warnings.join(' ')).toMatch(/without bite evidence/);
    const upper = assembled.scanSet.scans.find((scan) => scan.assignedRole === 'upper-arch')!; const lower = assembled.scanSet.scans.find((scan) => scan.assignedRole === 'lower-arch')!;
    expect(assembled.scanSet.transformGraph.some((edge) => edge.sourceScanId === lower.id && edge.targetScanId === upper.id)).toBe(false);
  });

  it('estimates a right-handed, versioned dental XYZ system from real arch geometry', () => {
    const setup = assemblyFixture(0); const scanSet = structuredClone(setup.scanSet); scanSet.scans[0].registrationStatus = 'accepted';
    const coordinates = estimateDentalCoordinates(scanSet, setup.artifacts); const axes = [coordinates.leftRightAxis, coordinates.anteriorPosteriorAxis, coordinates.occlusalGingivalAxis];
    expect(coordinates.convention).toBe('CADENCE_DENTAL_XYZ_V1'); expect(coordinates.confidence).toBeGreaterThan(0);
    for (const axis of axes) expect(Math.hypot(...axis)).toBeCloseTo(1, 8);
    expect(Math.abs(dot(axes[0], axes[1])) < 1e-8).toBe(true); expect(Math.abs(dot(axes[1], axes[2])) < 1e-8).toBe(true);
    const normalizedOrigin = applyRigid(coordinates.caseTransform, coordinates.origin); expect(Math.hypot(...normalizedOrigin) < 1e-8).toBe(true);
    expect(coordinateVisualizationLines(coordinates)).toHaveLength(4);
  });

  it('persists explicit manual plane, midline and anterior-direction corrections', () => {
    const setup = assemblyFixture(0); const scanSet = structuredClone(setup.scanSet); scanSet.scans[0].registrationStatus = 'accepted';
    const estimated = estimateDentalCoordinates(scanSet, setup.artifacts);
    const corrected = manuallyCorrectDentalAxes(estimated, [0, 0, 1], [0, 1, 0], 'test-user');
    const reversed = reverseAnteriorDirection(corrected, 'test-user');
    expect(corrected.manuallyCorrected).toBe(true); expect(corrected.version).toBe(estimated.version + 1); expect(reversed.version).toBe(corrected.version + 1);
    expect(reversed.history.at(-1)?.action).toBe('reverse-anterior-direction');
    expect(() => manuallyCorrectDentalAxes({ ...reversed, locked: true }, [0, 0, 1], [0, 1, 0])).toThrow(/locked/);
  });

  it('provides exact three-point, surface-correspondence, numeric and nudge fallbacks', () => {
    const known = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [3, -2, 1]), axisAngleRigid([0, 0, 1], Math.PI / 8));
    const source: [number, number, number][] = [[0, 0, 0], [4, 0, 0], [0, 3, 1], [2, 1, 4]]; const target = source.map((point) => applyRigid(known, point));
    const aligned = alignLandmarkPairs(source, target); const difference = transformDifference(aligned, known);
    expect(difference.translationError < 1e-8).toBe(true); expect(difference.rotationErrorDegrees < 1e-5).toBe(true);
    const numeric = applyNumericAdjustment(identityRigid(), [1, 2, 3], [0, 0, 10]); expect(numeric.translation).toEqual([1, 2, 3]);
    expect(nudgeTransform(identityRigid(), 'x', 0.1).translation).toEqual([0.1, 0, 0]);
  });

  it('routes accepted registration state through command undo, redo and lock validation', async () => {
    const setup = assemblyFixture(0); const scene = new SceneManager(setup.scene.list()); const manager = new CaseScanSetManager(setup.scanSet); const bus = new CommandBus();
    const source = setup.scanSet.scans[0]; const transform = rigidFromRotationTranslation([0, 0, 0, 1], [2, 3, 4]);
    const next = updateScan(setup.scanSet, source.id, { registrationTransform: transform, registrationStatus: 'accepted' });
    await bus.execute(new RegistrationStateCommand(manager, scene, next, 'Accept registration'));
    expect(scene.get(source.sceneObjectId)?.transform.position).toEqual([2, 3, 4]); await bus.undo(); expect(scene.get(source.sceneObjectId)?.transform.position).toEqual([0, 0, 0]);
    await bus.redo(); expect(manager.get().scans.find((scan) => scan.id === source.id)?.registrationStatus).toBe('accepted');
    const locked = updateScan(manager.get(), source.id, { locked: true }); manager.replace(locked); scene.update(source.sceneObjectId, { locked: true });
    const changed = updateScan(locked, source.id, { registrationTransform: identityRigid() });
    await expect(bus.execute(new RegistrationStateCommand(manager, scene, changed, 'Transform locked scan'))).rejects.toThrow(/Locked scan/);
  });

  it('records user registration adjustments against immutable source coordinates', () => {
    const setup = assemblyFixture(0); const scan = setup.scanSet.scans[0]; const after = nudgeTransform(scan.registrationTransform, 'z', 0.25);
    const adjustment = userAdjustment(scan, 'nudge', after, 'Nudge +Z 0.25 mm', 'test-user');
    expect(adjustment.before).toEqual(scan.registrationTransform); expect(adjustment.after.translation).toEqual([0, 0, 0.25]); expect(adjustment.actor).toBe('test-user');
  });
});

describe('registration reports and project persistence', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); });

  it('exports actual pairwise metrics as immutable JSON, CSV and printable HTML', async () => {
    const setup = assemblyFixture(1); const assembled = await autoAssembleCase(setup.scanSet, setup.artifacts, setup.execute); const project = projectFrom(setup, assembled.scanSet);
    const { report, historyEntry } = await createRegistrationReport(project, assembled.scanSet, setup.artifacts, 'test-user');
    expect(JSON.parse(registrationReportToJson(report))).toEqual(report); expect(registrationReportToCsv(report)).toContain(assembled.results[0].deterministicFingerprint);
    expect(registrationReportToHtml(report)).toContain('does not assert clinical approval'); expect(report.relationshipResults).toHaveLength(2); expect(historyEntry.type).toBe('registration-report');
    const manager = new RegistrationReportManager([report]); expect(() => manager.update()).toThrow(/immutable/); expect(() => manager.remove()).toThrow(/immutable/);
  });

  it('preserves scan transforms, XYZ, results, reports and corrections through save/reopen and recovery', async () => {
    const setup = assemblyFixture(1); const assembled = await autoAssembleCase(setup.scanSet, setup.artifacts, setup.execute); const project = projectFrom(setup, assembled.scanSet);
    const scan = project.caseScanSet.scans.find((item) => item.assignedRole === 'lower-arch')!; scan.userAdjustments.push(userAdjustment(scan, 'nudge', nudgeTransform(scan.registrationTransform, 'x', 0.1), 'Test correction'));
    const { report, historyEntry } = await createRegistrationReport(project, project.caseScanSet, setup.artifacts); project.registrationReports = [report]; project.history.push(historyEntry);
    const store = new ProjectStore(); const saved = store.save(project); const opened = store.open(saved.id);
    expect(opened.schemaVersion).toBe(3); expect(opened.caseScanSet).toEqual(project.caseScanSet); expect(opened.registrationReports).toEqual([report]); expect(opened.history.at(-1)).toEqual(historyEntry);
    store.autoSave(project); const recovered = store.recover(); expect(recovered?.caseScanSet).toEqual(project.caseScanSet); expect(recovered?.registrationReports).toEqual([report]);
  });
});

function assemblyFixture(biteCount: number) {
  const upper = archArtifact('upper-arch', 15, 11); upper.checksum = 'hash-upper';
  const lowerCaseTransform = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [0.35, 0.2, -5.8]), axisAngleRigid([1, 0, 0], 2 * Math.PI / 180));
  const lower = transformArtifact(upper, invertRigid(lowerCaseTransform), 'lower-arch'); lower.checksum = 'hash-lower';
  const bites = Array.from({ length: biteCount }, (_, index) => { const bite = structuredClone(upper); bite.id = crypto.randomUUID(); bite.sourceName = index ? `buccal-bite-right-${index}` : 'buccal-bite-left'; bite.checksum = `hash-bite-${index}`; return bite; });
  const artifacts = [upper, lower, ...bites]; const scene = new SceneManager(); artifacts.forEach((artifact) => scene.addFromArtifact(artifact));
  const scanSet = createCaseScanSet('case-project', scene.list(), artifacts);
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const execute = async (source: CaseScanRecord, target: CaseScanRecord, _purpose: 'pairwise' | 'bite-upper' | 'bite-lower' | 'occlusal-assembly' | 'reference' | 'pre-operative' | 'implant' | 'manual'): Promise<PairwiseRegistrationResult> => registerPair({ requestId: `${source.id}:${target.id}`, source: { artifact: artifactMap.get(source.artifactId)!, role: source.assignedRole }, target: { artifact: artifactMap.get(target.artifactId)!, role: target.assignedRole } }, { yieldControl: async () => Promise.resolve() });
  return { upper, lower, bites, artifacts, scene, scanSet, lowerCaseTransform, execute };
}

function projectFrom(setup: ReturnType<typeof assemblyFixture>, scanSet: ReturnType<typeof createCaseScanSet>) { const project = createProject('Registration persistence'); project.artifacts = structuredClone(setup.artifacts); project.scene = setup.scene.list(); project.caseScanSet = structuredClone(scanSet); return project; }
function dot(a: [number, number, number], b: [number, number, number]) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
