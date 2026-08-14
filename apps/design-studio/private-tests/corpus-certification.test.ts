import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

import { autoAssembleCase, appendPairwiseResult } from '../src/case-assembly';
import { ArtifactManager, createProject, ProjectStore, SceneManager, type ArtifactKind, type ArtifactRecord, type DesignProject, type Vec3 } from '../src/core';
import { estimateDentalCoordinates } from '../src/dental-coordinates';
import { alignLandmarkPairs } from '../src/manual-registration';
import { createRegistrationReport, registrationReportToHtml, registrationReportToJson } from '../src/registration-reports';
import { registerPair, REGISTRATION_ENGINE_VERSION } from '../src/registration-engine';
import { applyRigid, axisAngleRigid, composeRigid, identityRigid, invertRigid, rigidFromRotationTranslation, transformDifference } from '../src/registration-math';
import { enforceRegistrationSupport, registrationResultClassification, registrationSupportDecision } from '../src/registration-support';
import { createCaseScanSet } from '../src/scan-set';
import { validateScanForRegistration } from '../src/scan-validation';
import type { CaseScanRecord, CaseScanSet, PairwiseRegistrationResult, RegistrationRelationship, RigidTransform, ScanRole } from '../src/registration-types';
import {
  appendOutlierComponent,
  compactArtifact,
  cropArtifact,
  mergeArtifacts,
  mirrorArtifact,
  missingRegionArtifact,
  pointsFromArtifact,
  PrivateCorpusLoader,
  roleArtifact,
  scaleArtifact,
  sha256,
  transformArtifact,
  type LoadedCorpusCase,
} from './corpus-helpers';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const outputRoot = resolve(process.env.CADENCE_CERTIFICATION_OUTPUT ?? '/tmp/cadence-registration-certification-v0.3');
const outputFromRepository = relative(repositoryRoot, outputRoot);
if (!outputFromRepository.startsWith('..') && !isAbsolute(outputFromRepository)) throw new Error('Private certification output must remain outside the public repository.');

const loader = await PrivateCorpusLoader.open(process.env.CADENCE_DENTAL_CORPUS_PATH ?? '');
const integrity = await loader.verifyIntegrity();
const ownerAttestation = await loader.verifyOwnerAttestation();
const caseOne = await loader.loadCase('CASE-001');
const caseTwo = await loader.loadCase('CASE-002');
const caseThree = await loader.loadCase('CASE-003');
const repositoryCommit = (process.env.GIT_COMMIT_SHA
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' })).trim();
if (!/^[0-9a-f]{40}$/.test(repositoryCommit)) throw new Error('Private certification requires an exact 40-character repository commit SHA.');

interface TestEvidence {
  caseId: string;
  fixture: string;
  status: 'pass' | 'fail';
  durationMs: number;
  details: Record<string, unknown>;
  failure?: string;
}

const evidence: TestEvidence[] = [];
const performanceMeasurements: Array<{ caseId: string; fixture: string; durationMs: number; heapDeltaBytes: number }> = [];
let caseOneAssembly: Awaited<ReturnType<typeof autoAssembleCase>> | null = null;
let caseOneProject: DesignProject | null = null;
const pairResults = new Map<string, PairwiseRegistrationResult>();

function certificationTest(caseId: string, fixture: string, execute: () => Promise<Record<string, unknown> | void> | Record<string, unknown> | void): void {
  it(`${caseId} · ${fixture}`, async () => {
    const started = performance.now();
    try {
      const details = await execute() ?? {};
      evidence.push({ caseId, fixture, status: 'pass', durationMs: performance.now() - started, details });
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      evidence.push({ caseId, fixture, status: 'fail', durationMs: performance.now() - started, details: {}, failure });
      throw error;
    }
  });
}

async function executeRegistration(
  caseId: string,
  fixture: string,
  source: ArtifactRecord,
  sourceRole: ScanRole,
  target: ArtifactRecord,
  targetRole: ScanRole,
  expectedTransform: RigidTransform,
  translationToleranceMm: number,
  rotationToleranceDegrees: number,
  options: { allowReview?: boolean; initialTransform?: RigidTransform } = {},
): Promise<Record<string, unknown>> {
  const heapBefore = process.memoryUsage().heapUsed; const started = performance.now();
  const result = await registerPair({
    requestId: fixture,
    source: { artifact: source, role: sourceRole },
    target: { artifact: target, role: targetRole },
    ...(options.initialTransform ? { options: { initialTransform: options.initialTransform } } : {}),
  }, { yieldControl: async () => Promise.resolve() });
  const durationMs = performance.now() - started; const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
  performanceMeasurements.push({ caseId, fixture, durationMs, heapDeltaBytes });
  assert.ok(result.transform, `${fixture} returned no transform: ${result.errors.join(' ')}`);
  assert.ok(options.allowReview
    ? ['accepted', 'accepted-with-warning', 'manual-review-required'].includes(result.outcome)
    : ['accepted', 'accepted-with-warning'].includes(result.outcome), `${fixture} returned ${result.outcome}.`);
  const difference = transformDifference(result.transform, expectedTransform);
  assert.ok(difference.translationError <= translationToleranceMm, `${fixture} translation error ${difference.translationError} mm exceeds ${translationToleranceMm} mm.`);
  assert.ok(difference.rotationErrorDegrees <= rotationToleranceDegrees, `${fixture} rotation error ${difference.rotationErrorDegrees}° exceeds ${rotationToleranceDegrees}°.`);
  assert.ok(Number.isFinite(result.metrics.rmsResidual));
  assert.ok(result.metrics.confidenceScore >= 0 && result.metrics.confidenceScore <= 1);
  pairResults.set(fixture, result);
  return {
    outcome: result.outcome,
    translationErrorMm: difference.translationError,
    rotationErrorDegrees: difference.rotationErrorDegrees,
    rmsResidualMm: result.metrics.rmsResidual,
    medianResidualMm: result.metrics.medianResidual,
    p95ResidualMm: result.metrics.percentile95Residual,
    overlapPercent: result.metrics.estimatedOverlapPercent,
    confidenceScore: result.metrics.confidenceScore,
    deterministicFingerprint: result.deterministicFingerprint,
    durationMs,
    heapDeltaBytes,
  };
}

function controlledFixture(
  caseId: string,
  fixture: string,
  target: ArtifactRecord,
  role: ScanRole,
  transform: RigidTransform,
  translationToleranceMm = 0.05,
  rotationToleranceDegrees = 0.1,
  noiseAmplitude = 0,
): void {
  certificationTest(caseId, fixture, () => executeRegistration(
    caseId,
    fixture,
    transformArtifact(target, invertRigid(transform), `${fixture}-source`, noiseAmplitude),
    role,
    target,
    role,
    transform,
    translationToleranceMm,
    rotationToleranceDegrees,
  ));
}

function preflight(artifact: ArtifactRecord, role: ScanRole, allArtifacts: ArtifactRecord[] = [artifact]) {
  const scene = new SceneManager(); const object = scene.addFromArtifact(artifact, artifactKindForRole(role));
  const scanSet = createCaseScanSet('private-preflight', scene.list(), allArtifacts);
  const scan = scanSet.scans.find((item) => item.artifactId === artifact.id)!;
  scan.assignedRole = role;
  return validateScanForRegistration(artifact, object, scan, allArtifacts);
}

describe('CADence private dental registration corpus v0.3', { concurrency: false }, () => {
  certificationTest('CORPUS', 'version and complete SHA-256 integrity manifest', () => {
    assert.equal(integrity.corpusVersion, '0.3');
    assert.equal(integrity.expectedFileCount, 23); assert.equal(integrity.verifiedFileCount, 23);
    assert.equal(Object.keys(integrity.manifestHashes).length, 3);
    return { ...integrity };
  });

  certificationTest('CORPUS', 'owner attestation and private-use restrictions', () => {
    assert.equal(ownerAttestation.confirmed, true);
    return ownerAttestation;
  });

  certificationTest('CORPUS', 'all three required case manifests and eleven STL sources', () => {
    assert.equal(caseOne.artifacts.size, 3); assert.equal(caseTwo.artifacts.size, 6); assert.equal(caseThree.artifacts.size, 2);
    return { cases: 3, sourceStlFiles: 11, manifestHashes: { 'CASE-001': caseOne.manifestHash, 'CASE-002': caseTwo.manifestHash, 'CASE-003': caseThree.manifestHash } };
  });

  certificationTest('CORPUS', 'source immutability before geometry execution', async () => {
    await loader.assertSourceImmutability(); return { byteIdentical: true };
  });

  registerCaseOneTests();
  registerCaseTwoTests();
  registerCaseThreeTests();

  certificationTest('CORPUS', 'source immutability after all geometry execution', async () => {
    await loader.assertSourceImmutability(); return { byteIdentical: true };
  });
});

function registerCaseOneTests(): void {
  const upperFull = roleArtifact(caseOne, 'upper_arch'); const lowerFull = roleArtifact(caseOne, 'lower_arch'); const biteFull = roleArtifact(caseOne, 'full_bite');
  const upper = compactArtifact(upperFull, 'CASE-001-upper-derived', 4_000);
  const lower = compactArtifact(lowerFull, 'CASE-001-lower-derived', 4_000);
  const bite = compactArtifact(biteFull, 'CASE-001-bite-derived', 4_000);
  const translation = rigidFromRotationTranslation([0, 0, 0, 1], [7.5, -4.25, 2.1]);
  const rotation = axisAngleRigid([0.3, 0.7, 0.2], 18 * Math.PI / 180);
  const combined = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [12.4, -8.1, 3.75]), axisAngleRigid([0.2, 0.8, 0.5], 27 * Math.PI / 180));

  certificationTest('CASE-001', 'preserved upper-to-bite relationship', () => executeRegistration('CASE-001', 'preserved-upper-to-bite', upperFull, 'upper-arch', biteFull, 'full-bite', identityRigid(), 0.2, 0.5, { initialTransform: identityRigid() }));
  certificationTest('CASE-001', 'preserved lower-to-bite relationship', () => executeRegistration('CASE-001', 'preserved-lower-to-bite', lowerFull, 'lower-arch', biteFull, 'full-bite', identityRigid(), 0.2, 0.5, { initialTransform: identityRigid() }));

  certificationTest('CASE-001', 'upper/lower auto assembly through actual bite evidence', async () => {
    const setup = scanSetFor([upperFull, lowerFull, biteFull], ['upper-arch', 'lower-arch', 'full-bite']);
    const artifacts = new Map([upperFull, lowerFull, biteFull].map((artifact) => [artifact.id, artifact]));
    caseOneAssembly = await autoAssembleCase(setup.scanSet, [upperFull, lowerFull, biteFull], (source, target, purpose) => registerPair({
      requestId: `CASE-001-assembly-${purpose}`,
      source: { artifact: artifacts.get(source.artifactId)!, role: source.assignedRole },
      target: { artifact: artifacts.get(target.artifactId)!, role: target.assignedRole },
      options: { initialTransform: identityRigid() },
    }, { yieldControl: async () => Promise.resolve() }));
    assert.equal(caseOneAssembly.errors.length, 0); assert.equal(caseOneAssembly.results.length, 2);
    assert.ok(['accepted', 'warning'].includes(caseOneAssembly.scanSet.assemblyStatus));
    const lowerScan = caseOneAssembly.scanSet.scans.find((scan) => scan.assignedRole === 'lower-arch')!;
    const difference = transformDifference(lowerScan.registrationTransform, identityRigid());
    assert.ok(difference.translationError <= 0.2); assert.ok(difference.rotationErrorDegrees <= 0.5);
    return { assemblyStatus: caseOneAssembly.scanSet.assemblyStatus, translationErrorMm: difference.translationError, rotationErrorDegrees: difference.rotationErrorDegrees, resultCount: caseOneAssembly.results.length };
  });

  certificationTest('CASE-001', 'transform graph and confidence metrics', () => {
    assert.ok(caseOneAssembly); assert.ok(caseOneAssembly.scanSet.transformGraph.length >= 3);
    assert.ok(caseOneAssembly.scanSet.assemblyConfidence !== null && caseOneAssembly.scanSet.assemblyConfidence > 0);
    for (const result of caseOneAssembly.results) {
      assert.ok(result.metrics.inlierCount >= 6); assert.ok(Number.isFinite(result.metrics.rmsResidual)); assert.ok(result.metrics.confidenceScore > 0);
    }
    return { graphEdges: caseOneAssembly.scanSet.transformGraph.length, assemblyConfidence: caseOneAssembly.scanSet.assemblyConfidence };
  });

  certificationTest('CASE-001', 'conflicting bite relationship requires review', async () => {
    const secondBite = transformArtifact(biteFull, identityRigid(), 'CASE-001-conflicting-bite');
    const artifacts = [upperFull, lowerFull, biteFull, secondBite];
    const setup = scanSetFor(artifacts, ['upper-arch', 'lower-arch', 'full-bite', 'buccal-bite-left']);
    const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    let lowerCandidate = 0;
    const conflictTransform = rigidFromRotationTranslation([0, 0, 0, 1], [0.8, 0, 0]);
    const assembled = await autoAssembleCase(setup.scanSet, artifacts, async (source, target, purpose) => {
      const result = await registerPair({
        requestId: `CASE-001-conflicting-bite-${purpose}-${source.id}`,
        source: { artifact: artifactMap.get(source.artifactId)!, role: source.assignedRole },
        target: { artifact: artifactMap.get(target.artifactId)!, role: target.assignedRole },
        options: { initialTransform: identityRigid() },
      }, { yieldControl: async () => Promise.resolve() });
      if (purpose !== 'bite-lower' || lowerCandidate++ === 0 || !result.transform) return result;
      const transform = composeRigid(conflictTransform, result.transform);
      return {
        ...result,
        transform,
        warnings: [...result.warnings, 'Deterministic conflicting-bite fixture applies a known 0.8 mm relationship offset.'],
        deterministicFingerprint: sha256(`${result.deterministicFingerprint}:${transform.matrix.join(',')}`).slice(0, 16),
      };
    });
    assert.equal(assembled.scanSet.assemblyStatus, 'review');
    assert.match(assembled.warnings.join(' '), /Bite scans disagree/);
    const candidates = [0, 2].map((index) => composeRigid(assembled.results[index].transform!, invertRigid(assembled.results[index + 1].transform!)));
    const difference = transformDifference(candidates[0], candidates[1]);
    assert.ok(difference.translationError > 0.5); assert.equal(assembled.errors.length, 0);
    return { expectedConflictTranslationMm: 0.8, measuredCandidateDisagreementMm: difference.translationError, silentlyAccepted: false };
  });

  certificationTest('CASE-001', 'dental XYZ normalization from assembled real arches', () => {
    assert.ok(caseOneAssembly?.scanSet.dentalCoordinates);
    const coordinates = caseOneAssembly.scanSet.dentalCoordinates;
    assert.equal(coordinates.convention, 'CADENCE_DENTAL_XYZ_V1'); assert.ok(coordinates.confidence > 0);
    return { convention: coordinates.convention, confidence: coordinates.confidence };
  });

  certificationTest('CASE-001', 'manual landmark fallback against real source points', () => {
    const points = pointsFromArtifact(upper, 4); const known = combined; const target = points.map((point) => applyRigid(known, point));
    const actual = alignLandmarkPairs(points, target); const difference = transformDifference(actual, known);
    assert.ok(difference.translationError <= 1e-7); assert.ok(difference.rotationErrorDegrees <= 1e-5);
    return { translationErrorMm: difference.translationError, rotationErrorDegrees: difference.rotationErrorDegrees };
  });

  certificationTest('CASE-001', 'project save, reopen and auto-save recovery', () => {
    assert.ok(caseOneAssembly);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    const compactArtifacts = [upper, lower, bite]; const setup = scanSetFor(compactArtifacts, ['upper-arch', 'lower-arch', 'full-bite']);
    const project = createProject('CASE-001 private certification');
    project.artifacts = compactArtifacts; project.scene = setup.scene.list(); project.caseScanSet = { ...structuredClone(caseOneAssembly.scanSet), projectId: project.id };
    const store = new ProjectStore(); const saveStarted = performance.now(); const saved = store.save(project); const saveDurationMs = performance.now() - saveStarted;
    const reopenStarted = performance.now(); const opened = store.open(saved.id); const reopenDurationMs = performance.now() - reopenStarted;
    assert.equal(opened.caseScanSet.relationships.length, project.caseScanSet.relationships.length);
    store.autoSave(project); const recovered = store.recover(); assert.ok(recovered); assert.equal(recovered.caseScanSet.transformGraph.length, project.caseScanSet.transformGraph.length);
    caseOneProject = project;
    return { saveDurationMs, reopenDurationMs, recovery: true };
  });

  certificationTest('CASE-001', 'immutable registration report JSON and printable HTML', async () => {
    assert.ok(caseOneAssembly && caseOneProject);
    const { report, historyEntry } = await createRegistrationReport(caseOneProject, caseOneAssembly.scanSet, [upper, lower, bite], 'private-certification');
    const json = registrationReportToJson(report); const html = registrationReportToHtml(report);
    assert.deepEqual(JSON.parse(json), report); assert.match(html, /does not assert clinical approval/); assert.equal(historyEntry.type, 'registration-report');
    caseOneProject.registrationReports = [report]; caseOneProject.history.push(historyEntry);
    return { resultFingerprint: report.resultFingerprint, relationshipCount: report.relationshipResults.length, jsonBytes: json.length, htmlBytes: html.length };
  });

  controlledFixture('CASE-001', 'translation-only', upper, 'upper-arch', translation);
  controlledFixture('CASE-001', 'rotation-only', upper, 'upper-arch', rotation);
  controlledFixture('CASE-001', 'combined-translation-rotation', upper, 'upper-arch', combined);
  controlledFixture('CASE-001', 'large-translation', upper, 'upper-arch', rigidFromRotationTranslation([0, 0, 0, 1], [85, -63, 41]));
  controlledFixture('CASE-001', 'large-rotation', upper, 'upper-arch', axisAngleRigid([0.2, 0.9, 0.3], 127 * Math.PI / 180));

  const partialTransform = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [3.2, -2.1, 1.3]), axisAngleRigid([0.1, 0.8, 0.2], 8 * Math.PI / 180));
  const partialFixtures: Array<[string, ArtifactRecord]> = [
    ['partial-overlap', cropArtifact(upper, 'CASE-001-partial', 1, 0.15, 0.72)],
    ['left-side-bite-crop', cropArtifact(bite, 'CASE-001-bite-left', 0, 0, 0.46)],
    ['right-side-bite-crop', cropArtifact(bite, 'CASE-001-bite-right', 0, 0.54, 1)],
    ['anterior-bite-crop', cropArtifact(bite, 'CASE-001-bite-anterior', 1, 0, 0.42)],
    ['posterior-bite-crop', cropArtifact(bite, 'CASE-001-bite-posterior', 1, 0.58, 1)],
    ['missing-geometry', missingRegionArtifact(upper, 'CASE-001-upper-missing', 0, 0.38, 0.62)],
  ];
  for (const [fixture, crop] of partialFixtures) {
    const target = fixture.includes('bite') ? bite : upper;
    certificationTest('CASE-001', fixture, () => executeRegistration('CASE-001', fixture, transformArtifact(crop, invertRigid(partialTransform), `${fixture}-source`), fixture.includes('bite') ? 'full-bite' : 'upper-arch', target, fixture.includes('bite') ? 'full-bite' : 'upper-arch', partialTransform, 0.2, 0.5));
  }

  controlledFixture('CASE-001', 'positional-noise-low', upper, 'upper-arch', combined, 0.2, 0.5, 0.025);
  controlledFixture('CASE-001', 'positional-noise-high', upper, 'upper-arch', combined, 0.2, 0.5, 0.12);
  certificationTest('CASE-001', 'outlier-geometry', () => executeRegistration('CASE-001', 'outlier-geometry', appendOutlierComponent(transformArtifact(upper, invertRigid(combined), 'CASE-001-outlier-base'), 'CASE-001-outlier-source'), 'upper-arch', upper, 'upper-arch', combined, 0.2, 0.5));
  certificationTest('CASE-001', 'medium-decimation', () => executeRegistration('CASE-001', 'medium-decimation', transformArtifact(compactArtifact(upperFull, 'CASE-001-medium', 2_000), invertRigid(combined), 'CASE-001-medium-source'), 'upper-arch', upper, 'upper-arch', combined, 0.2, 0.5));
  certificationTest('CASE-001', 'heavy-decimation', () => executeRegistration('CASE-001', 'heavy-decimation', transformArtifact(compactArtifact(upperFull, 'CASE-001-heavy', 500), invertRigid(combined), 'CASE-001-heavy-source'), 'upper-arch', upper, 'upper-arch', combined, 0.2, 0.5));

  certificationTest('CASE-001', 'mirrored-scan rejection', () => {
    const result = preflight(mirrorArtifact(upper, 'CASE-001-mirrored'), 'upper-arch');
    assert.equal(result.canRegisterAutomatically, false); assert.equal(result.likelyMirrored, true);
    return { silentlyAccepted: false };
  });
  certificationTest('CASE-001', '10x-scale rejection', () => {
    const result = preflight(scaleArtifact(upper, 'CASE-001-scale-10x', 10), 'upper-arch');
    assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-001', '0.1x-scale rejection', () => {
    const result = preflight(scaleArtifact(upper, 'CASE-001-scale-0.1x', 0.1), 'upper-arch');
    assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-001', 'duplicate-scan rejection', () => {
    const duplicate = { ...structuredClone(upper), id: 'CASE-001-duplicate' }; const result = preflight(duplicate, 'upper-arch', [upper, duplicate]);
    assert.equal(result.canRegisterAutomatically, false); assert.equal(result.duplicateOf, upper.id); return { silentlyIndependent: false };
  });
  certificationTest('CASE-001', 'insufficient-overlap rejection', async () => {
    const source = cropArtifact(upper, 'CASE-001-insufficient-source', 1, 0, 0.12, 700);
    const target = cropArtifact(upper, 'CASE-001-insufficient-target', 1, 0.88, 1, 700);
    const result = await registerPair({ requestId: 'CASE-001-insufficient-overlap', source: { artifact: source, role: 'upper-arch' }, target: { artifact: target, role: 'upper-arch' } });
    const decision = registrationSupportDecision('upper-arch', 'upper-arch', 'pairwise');
    const classification = registrationResultClassification(result, decision);
    assert.equal(classification, 'Unsupported — Insufficient Evidence');
    return { algorithmOutcome: result.outcome, productionClassification: classification, silentlyProductionCertified: false };
  });
  certificationTest('CASE-001', 'real-geometry symmetry ambiguity fails closed', async () => {
    const center: Vec3 = [
      (upper.mesh.bounds.min[0] + upper.mesh.bounds.max[0]) / 2,
      (upper.mesh.bounds.min[1] + upper.mesh.bounds.max[1]) / 2,
      (upper.mesh.bounds.min[2] + upper.mesh.bounds.max[2]) / 2,
    ];
    const halfTurn = composeRigid(
      rigidFromRotationTranslation([0, 0, 0, 1], center),
      composeRigid(axisAngleRigid([0, 0, 1], Math.PI), rigidFromRotationTranslation([0, 0, 0, 1], center.map((value) => -value) as Vec3)),
    );
    const symmetric = mergeArtifacts(upper, transformArtifact(upper, halfTurn, 'CASE-001-symmetric-half'), 'CASE-001-symmetric-real-geometry');
    const source = transformArtifact(symmetric, halfTurn, 'CASE-001-symmetric-source');
    const result = await registerPair({ requestId: 'CASE-001-real-symmetry', source: { artifact: source, role: 'upper-arch' }, target: { artifact: symmetric, role: 'upper-arch' } });
    const decision = registrationSupportDecision('upper-arch', 'upper-arch', 'pairwise');
    const enforced = enforceRegistrationSupport(result, decision);
    assert.equal(registrationResultClassification(enforced, decision), 'Unsupported — Insufficient Evidence');
    assert.equal(enforced.outcome, 'manual-review-required');
    return { algorithmOutcome: result.outcome, candidateAmbiguity: result.metrics.candidateAmbiguity, productionClassification: decision.classification, silentlyProductionCertified: false };
  });
  certificationTest('CASE-001', 'cancelled registration returns no transform', async () => {
    const result = await registerPair({ requestId: 'CASE-001-cancelled', source: { artifact: upper, role: 'upper-arch' }, target: { artifact: upper, role: 'upper-arch' } }, { isCancelled: () => true });
    assert.equal(result.outcome, 'cancelled'); assert.equal(result.transform, null); return { cancelled: true };
  });
  certificationTest('CASE-001', 'deterministic repeated result', async () => {
    const source = transformArtifact(upper, invertRigid(translation), 'CASE-001-deterministic-source');
    const first = await registerPair({ requestId: 'deterministic-a', source: { artifact: source, role: 'upper-arch' }, target: { artifact: upper, role: 'upper-arch' } });
    const second = await registerPair({ requestId: 'deterministic-b', source: { artifact: source, role: 'upper-arch' }, target: { artifact: upper, role: 'upper-arch' } });
    assert.deepEqual(second.transform, first.transform); assert.deepEqual(second.metrics, first.metrics); assert.equal(second.deterministicFingerprint, first.deterministicFingerprint);
    return { deterministicFingerprint: first.deterministicFingerprint };
  });
}

function registerCaseTwoTests(): void {
  const roles = [
    'implant_component_scanbody_variant_dess',
    'implant_component_scanbody_variant_elos',
    'lower_temporary_reference',
    'multi_unit_abutment_arch',
    'photogrammetry_scanbody_scan',
    'upper_arch_or_opposing_reference',
  ] as const;
  const full = Object.fromEntries(roles.map((role) => [role, roleArtifact(caseTwo, role)])) as Record<(typeof roles)[number], ArtifactRecord>;
  const compact = Object.fromEntries(roles.map((role) => [role, compactArtifact(full[role], `CASE-002-${role}-derived`, 1_500)])) as Record<(typeof roles)[number], ArtifactRecord>;
  const roleMap: Record<(typeof roles)[number], ScanRole> = {
    implant_component_scanbody_variant_dess: 'scan-body',
    implant_component_scanbody_variant_elos: 'scan-body',
    lower_temporary_reference: 'temporary',
    multi_unit_abutment_arch: 'implant-arch',
    photogrammetry_scanbody_scan: 'scan-body',
    upper_arch_or_opposing_reference: 'reference-scan',
  };

  certificationTest('CASE-002', 'preserved MUA-to-photogrammetry candidate requires manual review', () => executeObservedRegistration(
    'CASE-002', 'preserved-MUA-to-photogrammetry', full.multi_unit_abutment_arch, 'implant-arch', full.photogrammetry_scanbody_scan, 'scan-body', 'implant', identityRigid(),
  ));
  certificationTest('CASE-002', 'preserved temporary-to-MUA candidate requires manual review', () => executeObservedRegistration(
    'CASE-002', 'preserved-temporary-to-MUA', full.lower_temporary_reference, 'temporary', full.multi_unit_abutment_arch, 'implant-arch', 'implant', identityRigid(),
  ));
  certificationTest('CASE-002', 'preserved temporary-to-photogrammetry candidate requires manual review', () => executeObservedRegistration(
    'CASE-002', 'preserved-temporary-to-photogrammetry', full.lower_temporary_reference, 'temporary', full.photogrammetry_scanbody_scan, 'scan-body', 'reference', identityRigid(),
  ));
  certificationTest('CASE-002', 'DESS/ELOS alternative-component ambiguity is not production certified', () => executeObservedRegistration(
    'CASE-002', 'DESS-ELOS-alternative-components', full.implant_component_scanbody_variant_dess, 'scan-body', full.implant_component_scanbody_variant_elos, 'scan-body', 'implant', identityRigid(),
  ));

  const translation = rigidFromRotationTranslation([0, 0, 0, 1], [6.25, -3.5, 2.75]);
  const rotation = axisAngleRigid([0.4, 0.1, 0.8], 22 * Math.PI / 180);
  const combined = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [-8.2, 4.4, 1.6]), axisAngleRigid([0.3, 0.7, 0.2], -31 * Math.PI / 180));
  for (const role of roles) {
    controlledFixture('CASE-002', `${role}-translation-recovery`, compact[role], roleMap[role], translation);
    controlledFixture('CASE-002', `${role}-rotation-recovery`, compact[role], roleMap[role], rotation);
    controlledFixture('CASE-002', `${role}-combined-rigid-recovery`, compact[role], roleMap[role], combined);
  }

  const mua = compact.multi_unit_abutment_arch;
  const partial = cropArtifact(mua, 'CASE-002-MUA-partial', 1, 0.18, 0.72, 900);
  certificationTest('CASE-002', 'controlled partial-overlap recovery', () => executeRegistration('CASE-002', 'controlled-partial-overlap', transformArtifact(partial, invertRigid(combined), 'CASE-002-partial-source'), 'implant-arch', mua, 'implant-arch', combined, 0.2, 0.5));
  controlledFixture('CASE-002', 'controlled positional noise', mua, 'implant-arch', combined, 0.2, 0.5, 0.08);
  certificationTest('CASE-002', 'controlled outlier component', () => executeRegistration('CASE-002', 'controlled-outlier-component', appendOutlierComponent(transformArtifact(mua, invertRigid(combined), 'CASE-002-outlier-base'), 'CASE-002-outlier-source'), 'implant-arch', mua, 'implant-arch', combined, 0.2, 0.5));
  certificationTest('CASE-002', 'controlled decimation', () => executeRegistration('CASE-002', 'controlled-decimation', transformArtifact(compactArtifact(full.multi_unit_abutment_arch, 'CASE-002-MUA-decimated', 450), invertRigid(combined), 'CASE-002-decimated-source'), 'implant-arch', mua, 'implant-arch', combined, 0.2, 0.5));

  certificationTest('CASE-002', 'mirrored implant scan rejection', () => {
    const result = preflight(mirrorArtifact(mua, 'CASE-002-MUA-mirrored'), 'implant-arch');
    assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-002', '10x implant scale rejection', () => {
    const result = preflight(scaleArtifact(mua, 'CASE-002-MUA-scale-10x', 10), 'implant-arch');
    assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-002', '0.1x implant scale rejection', () => {
    const result = preflight(scaleArtifact(mua, 'CASE-002-MUA-scale-0.1x', 0.1), 'implant-arch');
    assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-002', 'duplicate implant input rejection', () => {
    const duplicate = { ...structuredClone(mua), id: 'CASE-002-duplicate' }; const result = preflight(duplicate, 'implant-arch', [mua, duplicate]);
    assert.equal(result.canRegisterAutomatically, false); return { silentlyIndependent: false };
  });
  certificationTest('CASE-002', 'cancelled implant registration', async () => {
    const result = await registerPair({ requestId: 'CASE-002-cancelled', source: { artifact: mua, role: 'implant-arch' }, target: { artifact: mua, role: 'implant-arch' } }, { isCancelled: () => true });
    assert.equal(result.outcome, 'cancelled'); assert.equal(result.transform, null); return { cancelled: true };
  });
  certificationTest('CASE-002', 'manual landmark fallback', () => {
    const points = pointsFromArtifact(mua, 4); const target = points.map((point) => applyRigid(combined, point)); const actual = alignLandmarkPairs(points, target); const difference = transformDifference(actual, combined);
    assert.ok(difference.translationError <= 1e-7); assert.ok(difference.rotationErrorDegrees <= 1e-5);
    return { translationErrorMm: difference.translationError, rotationErrorDegrees: difference.rotationErrorDegrees };
  });

  certificationTest('CASE-002', 'manual-reviewed implant transform graph', async () => {
    const artifacts = [full.multi_unit_abutment_arch, full.photogrammetry_scanbody_scan];
    const setup = scanSetFor(artifacts, ['implant-arch', 'scan-body']);
    const source = setup.scanSet.scans.find((scan) => scan.assignedRole === 'implant-arch')!;
    const target = setup.scanSet.scans.find((scan) => scan.assignedRole === 'scan-body')!;
    const result = pairResults.get('preserved-MUA-to-photogrammetry'); assert.ok(result?.transform);
    const next = appendPairwiseResult(setup.scanSet, source, target, 'implant', result, true);
    assert.ok(next.transformGraph.some((edge) => edge.sourceScanId === source.id && edge.targetScanId === target.id));
    return { graphEdges: next.transformGraph.length, acceptance: 'explicit-manual-review' };
  });

  certificationTest('CASE-002', 'XYZ normalization where valid', () => {
    const setup = scanSetFor([mua], ['implant-arch']); const scanSet = structuredClone(setup.scanSet); scanSet.scans[0].registrationStatus = 'accepted';
    const coordinates = estimateDentalCoordinates(scanSet, [mua]); assert.equal(coordinates.convention, 'CADENCE_DENTAL_XYZ_V1'); assert.ok(coordinates.confidence > 0);
    return { confidence: coordinates.confidence };
  });

  certificationTest('CASE-002', 'save, reopen, recovery and report persistence', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    const artifacts = [mua, compact.photogrammetry_scanbody_scan]; const setup = scanSetFor(artifacts, ['implant-arch', 'scan-body']);
    const source = setup.scanSet.scans[0]; const target = setup.scanSet.scans[1]; const raw = pairResults.get('preserved-MUA-to-photogrammetry'); assert.ok(raw);
    const scanSet = appendPairwiseResult(setup.scanSet, source, target, 'implant', raw, false);
    const project = createProject('CASE-002 private certification'); project.artifacts = artifacts; project.scene = setup.scene.list(); project.caseScanSet = scanSet;
    const { report, historyEntry } = await createRegistrationReport(project, scanSet, artifacts, 'private-certification'); project.registrationReports = [report]; project.history.push(historyEntry);
    const store = new ProjectStore(); const saved = store.save(project); const opened = store.open(saved.id); assert.equal(opened.registrationReports[0].resultFingerprint, report.resultFingerprint);
    store.autoSave(project); const recovered = store.recover(); assert.equal(recovered?.caseScanSet.relationships.length, 1);
    return { reportFingerprint: report.resultFingerprint, reopened: true, recovered: true };
  });

  certificationTest('CASE-002', 'no bite means no fabricated occlusal transform', async () => {
    const artifacts = [full.multi_unit_abutment_arch, full.upper_arch_or_opposing_reference];
    const setup = scanSetFor(artifacts, ['implant-arch', 'reference-scan']);
    const result = await autoAssembleCase(setup.scanSet, artifacts, async () => { throw new Error('No automatic pair was expected for unsupported occlusal inference.'); });
    assert.equal(result.scanSet.transformGraph.some((edge) => edge.targetScanId !== 'case-coordinate-system'), false);
    return { occlusalRelationshipCreated: false };
  });
}

function registerCaseThreeTests(): void {
  const upperFull = roleArtifact(caseThree, 'presurgical_upper_arch_unaligned');
  const lowerFull = roleArtifact(caseThree, 'presurgical_lower_arch_unaligned');
  const upper = compactArtifact(upperFull, 'CASE-003-upper-derived', 2_000);
  const lower = compactArtifact(lowerFull, 'CASE-003-lower-derived', 2_000);
  const translation = rigidFromRotationTranslation([0, 0, 0, 1], [11.5, -6.25, 3.4]);
  const rotation = axisAngleRigid([0.2, 0.7, 0.4], 47 * Math.PI / 180);
  const upsideDown = axisAngleRigid([1, 0, 0], Math.PI);

  certificationTest('CASE-003', 'upper arch loads with finite real geometry', () => {
    assert.ok(upperFull.mesh.sourceTopology!.positions.length > 0); assert.ok(upperFull.mesh.bounds.max.every(Number.isFinite));
    return { triangleCount: upperFull.mesh.sourceTopology!.indices.length / 3 };
  });
  certificationTest('CASE-003', 'lower arch loads with finite real geometry', () => {
    assert.ok(lowerFull.mesh.sourceTopology!.positions.length > 0); assert.ok(lowerFull.mesh.bounds.max.every(Number.isFinite));
    return { triangleCount: lowerFull.mesh.sourceTopology!.indices.length / 3 };
  });
  certificationTest('CASE-003', 'upper independent XYZ normalization', () => independentCoordinateEvidence(upper, 'upper-arch'));
  certificationTest('CASE-003', 'lower independent XYZ normalization', () => independentCoordinateEvidence(lower, 'lower-arch'));
  controlledFixture('CASE-003', 'upper translation recovery', upper, 'upper-arch', translation);
  controlledFixture('CASE-003', 'lower translation recovery', lower, 'lower-arch', translation);
  controlledFixture('CASE-003', 'upper rotation recovery', upper, 'upper-arch', rotation);
  controlledFixture('CASE-003', 'lower rotation recovery', lower, 'lower-arch', rotation);
  controlledFixture('CASE-003', 'upside-down orientation recovery', upper, 'upper-arch', upsideDown);

  certificationTest('CASE-003', 'partial presurgical arch recovery', () => {
    const partial = cropArtifact(upper, 'CASE-003-upper-partial', 1, 0.12, 0.68, 1_000);
    return executeRegistration('CASE-003', 'partial-presurgical-arch', transformArtifact(partial, invertRigid(rotation), 'CASE-003-partial-source'), 'upper-arch', upper, 'upper-arch', rotation, 0.2, 0.5);
  });
  certificationTest('CASE-003', 'missing anterior/posterior region recovery', () => {
    const partial = missingRegionArtifact(upper, 'CASE-003-upper-missing', 1, 0.3, 0.7, 1_000);
    return executeRegistration('CASE-003', 'missing-presurgical-region', transformArtifact(partial, invertRigid(rotation), 'CASE-003-missing-source'), 'upper-arch', upper, 'upper-arch', rotation, 0.2, 0.5);
  });
  certificationTest('CASE-003', 'mirrored arch rejection', () => {
    const result = preflight(mirrorArtifact(upper, 'CASE-003-upper-mirrored'), 'upper-arch'); assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-003', '10x scale rejection', () => {
    const result = preflight(scaleArtifact(upper, 'CASE-003-upper-10x', 10), 'upper-arch'); assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-003', '0.1x scale rejection', () => {
    const result = preflight(scaleArtifact(upper, 'CASE-003-upper-0.1x', 0.1), 'upper-arch'); assert.equal(result.canRegisterAutomatically, false); return { silentlyAccepted: false };
  });
  certificationTest('CASE-003', 'manual alignment fallback', () => {
    const points = pointsFromArtifact(upper, 4); const target = points.map((point) => applyRigid(rotation, point)); const actual = alignLandmarkPairs(points, target); const difference = transformDifference(actual, rotation);
    assert.ok(difference.translationError <= 1e-7); assert.ok(difference.rotationErrorDegrees <= 1e-5); return difference;
  });
  certificationTest('CASE-003', 'upper/lower assembly fails closed without bite evidence', async () => {
    const setup = scanSetFor([upperFull, lowerFull], ['upper-arch', 'lower-arch']); let calls = 0;
    const result = await autoAssembleCase(setup.scanSet, [upperFull, lowerFull], async () => { calls += 1; throw new Error('Pairwise registration must not run without bite evidence.'); });
    assert.equal(calls, 0); assert.equal(result.scanSet.assemblyStatus, 'review'); assert.match(result.warnings.join(' '), /without bite evidence/);
    assert.equal(result.scanSet.transformGraph.some((edge) => edge.targetScanId !== 'case-coordinate-system'), false);
    return { result: 'INSUFFICIENT OCCLUSAL EVIDENCE / MANUAL REVIEW REQUIRED', inventedOcclusion: false };
  });
  certificationTest('CASE-003', 'save, reopen and crash recovery preserve fail-closed state', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    const setup = scanSetFor([upper, lower], ['upper-arch', 'lower-arch']); const project = createProject('CASE-003 private certification');
    project.artifacts = [upper, lower]; project.scene = setup.scene.list(); project.caseScanSet = { ...setup.scanSet, assemblyStatus: 'review' };
    const store = new ProjectStore(); const saved = store.save(project); assert.equal(store.open(saved.id).caseScanSet.assemblyStatus, 'review');
    store.autoSave(project); assert.equal(store.recover()?.caseScanSet.assemblyStatus, 'review'); return { reopened: true, recovered: true, inventedOcclusion: false };
  });
}

async function executeObservedRegistration(
  caseId: string,
  fixture: string,
  source: ArtifactRecord,
  sourceRole: ScanRole,
  target: ArtifactRecord,
  targetRole: ScanRole,
  purpose: RegistrationRelationship['purpose'],
  preservedTransform: RigidTransform,
): Promise<Record<string, unknown>> {
  const heapBefore = process.memoryUsage().heapUsed; const started = performance.now();
  const result = await registerPair({
    requestId: fixture,
    source: { artifact: source, role: sourceRole },
    target: { artifact: target, role: targetRole },
    options: { initialTransform: preservedTransform },
  }, { yieldControl: async () => Promise.resolve() });
  const durationMs = performance.now() - started; const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
  performanceMeasurements.push({ caseId, fixture, durationMs, heapDeltaBytes });
  assert.ok(result.transform); assert.ok(['accepted', 'accepted-with-warning', 'manual-review-required'].includes(result.outcome));
  const decision = registrationSupportDecision(sourceRole, targetRole, purpose);
  const classification = registrationResultClassification(result, decision);
  assert.equal(classification, 'Supported — Manual Review Required');
  const difference = transformDifference(result.transform, preservedTransform);
  pairResults.set(fixture, result);
  return {
    outcome: result.outcome,
    supportClassification: classification,
    translationDeviationFromPreservedMm: difference.translationError,
    rotationDeviationFromPreservedDegrees: difference.rotationErrorDegrees,
    rmsResidualMm: result.metrics.rmsResidual,
    p95ResidualMm: result.metrics.percentile95Residual,
    overlapPercent: result.metrics.estimatedOverlapPercent,
    confidenceScore: result.metrics.confidenceScore,
    durationMs,
    heapDeltaBytes,
  };
}

function independentCoordinateEvidence(artifact: ArtifactRecord, role: ScanRole): Record<string, unknown> {
  const setup = scanSetFor([artifact], [role]); const scanSet = structuredClone(setup.scanSet); scanSet.scans[0].registrationStatus = 'accepted';
  const coordinates = estimateDentalCoordinates(scanSet, [artifact]);
  assert.equal(coordinates.convention, 'CADENCE_DENTAL_XYZ_V1'); assert.ok(coordinates.confidence > 0);
  return { convention: coordinates.convention, confidence: coordinates.confidence };
}

function scanSetFor(artifacts: ArtifactRecord[], roles: ScanRole[]): { scene: SceneManager; scanSet: CaseScanSet } {
  assert.equal(artifacts.length, roles.length);
  const scene = new SceneManager();
  artifacts.forEach((artifact, index) => scene.addFromArtifact(artifact, artifactKindForRole(roles[index])));
  const scanSet = createCaseScanSet(`private-${sha256(roles.join('|')).slice(0, 8)}`, scene.list(), artifacts);
  scanSet.scans.forEach((scan) => {
    const index = artifacts.findIndex((artifact) => artifact.id === scan.artifactId);
    scan.assignedRole = roles[index]; scan.unitsConfirmed = true; scan.confirmedUnits = 'mm';
  });
  return { scene, scanSet };
}

function artifactKindForRole(role: ScanRole): ArtifactKind {
  if (role === 'upper-arch' || role === 'pre-operative-upper') return 'upper';
  if (role === 'lower-arch' || role === 'pre-operative-lower') return 'lower';
  if (role.includes('bite')) return 'bite';
  if (role === 'scan-body') return 'scan-body';
  if (role === 'implant-arch') return 'implant-component';
  if (role === 'temporary' || role === 'reference-scan') return 'reference';
  return 'unknown';
}

after(async () => {
  await loader.assertSourceImmutability();
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });
  const supportMatrix = [
    matrixRow('full-bite', 'upper-arch', 'bite-upper'),
    matrixRow('full-bite', 'lower-arch', 'bite-lower'),
    matrixRow('scan-body', 'implant-arch', 'implant'),
    matrixRow('temporary', 'implant-arch', 'implant'),
    matrixRow('upper-arch', 'lower-arch', 'occlusal-assembly'),
    matrixRow('unknown', 'upper-arch', 'pairwise'),
  ];
  const failures = evidence.filter((item) => item.status === 'fail');
  const safetyFixtures = evidence.filter((item) => /rejection|insufficient|duplicate|conflict|ambig|fails closed|no bite|cancelled/i.test(item.fixture));
  const runtimeValidationRunId = process.env.CADENCE_RUNTIME_VALIDATION_RUN_ID ?? null;
  const runtimeValidationResult = process.env.CADENCE_RUNTIME_VALIDATION_RESULT ?? 'not-run';
  const sprintValidationRunId = process.env.CADENCE_SPRINT_VALIDATION_RUN_ID ?? null;
  const sprintValidationResult = process.env.CADENCE_SPRINT_VALIDATION_RESULT ?? 'not-run';
  const workflowsPassed = Boolean(runtimeValidationRunId && sprintValidationRunId)
    && runtimeValidationResult === 'success'
    && sprintValidationResult === 'success';
  const report = {
    reportSchemaVersion: 1,
    corpusVersion: integrity.corpusVersion,
    corpusIntegrity: { status: 'pass', expectedFileCount: integrity.expectedFileCount, verifiedFileCount: integrity.verifiedFileCount },
    ownerAttestation,
    manifestHashes: { 'CASE-001': caseOne.manifestHash, 'CASE-002': caseTwo.manifestHash, 'CASE-003': caseThree.manifestHash },
    repositoryCommit,
    registrationEngineVersion: REGISTRATION_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceGeometryIncluded: false,
    originalIdentifyingFilenamesIncluded: false,
    deterministicTestCount: evidence.length,
    passedTestCount: evidence.length - failures.length,
    failedTestCount: failures.length,
    realGeometryFixtureCount: evidence.filter((item) => item.caseId.startsWith('CASE-')).length,
    cases: {
      'CASE-001': summarizeCase('CASE-001'),
      'CASE-002': summarizeCase('CASE-002'),
      'CASE-003': summarizeCase('CASE-003'),
    },
    tests: evidence,
    performanceMeasurements,
    safetyResults: safetyFixtures,
    supportMatrix,
    unsupportedWorkflows: supportMatrix.filter((item) => item.classification === 'Unsupported — Insufficient Evidence'),
    correctiveCommits: (process.env.CADENCE_CORRECTIVE_COMMITS ?? '').split(',').filter(Boolean),
    workflowValidation: {
      runtimeValidationRunId,
      runtimeValidationResult,
      sprintValidationRunId,
      sprintValidationResult,
    },
    finalProductionCertificationDecision: failures.length
      ? 'FAILED'
      : workflowsPassed
        ? 'PRODUCTION CERTIFIED — PRIVATE CORPUS AND EXACT-HEAD WORKFLOWS PASSED'
        : 'PRIVATE CORPUS TESTS PASSED — WORKFLOW CERTIFICATION PENDING',
    limitations: [
      'No clinical approval, manufacturing approval, implant manufacturing accuracy, or regulatory acceptance is asserted.',
      'Self-intersection detection and automatic implant-component recognition are outside this certification scope.',
      'CASE-002 heterogeneous-surface relationships require manual review.',
      'CASE-003 provides no verified upper/lower occlusal relationship.',
    ],
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const html = certificationHtml(report);
  await writeFile(resolve(outputRoot, 'CADENCE_REGISTRATION_CERTIFICATION_v0.3.json'), json, { mode: 0o600 });
  await writeFile(resolve(outputRoot, 'CADENCE_REGISTRATION_CERTIFICATION_v0.3.html'), html, { mode: 0o600 });
});

function summarizeCase(caseId: string) {
  const tests = evidence.filter((item) => item.caseId === caseId); const failed = tests.filter((item) => item.status === 'fail');
  return { result: failed.length ? 'Failed' : 'Passed', testCount: tests.length, passed: tests.length - failed.length, failed: failed.length };
}

function matrixRow(source: ScanRole, target: ScanRole, purpose: RegistrationRelationship['purpose']) {
  const decision = registrationSupportDecision(source, target, purpose);
  return { source, target, purpose, ...decision };
}

function certificationHtml(report: Record<string, unknown>): string {
  const tests = evidence.map((item) => `<tr><td>${escapeHtml(item.caseId)}</td><td>${escapeHtml(item.fixture)}</td><td>${item.status}</td><td>${item.durationMs.toFixed(2)}</td><td><code>${escapeHtml(JSON.stringify(item.details))}</code></td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>CADence Registration Certification v0.3</title><style>body{font:14px system-ui;margin:36px;color:#172033}h1{color:#080038}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3df;padding:6px;text-align:left;vertical-align:top}code{font-size:10px;overflow-wrap:anywhere}.notice{padding:12px;background:#fff4d6}</style></head><body><h1>CADence Private Dental Registration Certification v0.3</h1><p><strong>Repository commit:</strong> <code>${escapeHtml(repositoryCommit)}</code><br><strong>Engine:</strong> ${escapeHtml(REGISTRATION_ENGINE_VERSION)}<br><strong>Decision:</strong> ${escapeHtml(String(report.finalProductionCertificationDecision))}</p><div class="notice">This report contains non-identifying engineering measurements only. It contains no STL geometry and asserts no clinical, manufacturing, or regulatory approval.</div><h2>Deterministic tests</h2><table><thead><tr><th>Case</th><th>Fixture</th><th>Status</th><th>Duration ms</th><th>Measured evidence</th></tr></thead><tbody>${tests}</tbody></table></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
