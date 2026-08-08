import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { SceneManager } from '../src/core';
import { registerPair, REGISTRATION_ENGINE_VERSION } from '../src/registration-engine';
import { transformDifference } from '../src/registration-math';
import { createCaseScanSet } from '../src/scan-set';
import { validateScanForRegistration } from '../src/scan-validation';
import { goldenRegistrationCorpus } from './golden-registration';

describe('deterministic golden registration corpus', () => {
  for (const fixture of goldenRegistrationCorpus()) {
    it(`${fixture.name} produces its documented deterministic outcome`, async () => {
      const sourceBefore = structuredClone(fixture.source); const targetBefore = structuredClone(fixture.target);
      if (fixture.expectedOutcome === 'validation-blocked') {
        const scene = new SceneManager(); const sourceObject = scene.addFromArtifact(fixture.source); scene.addFromArtifact(fixture.target);
        const scanSet = createCaseScanSet('registration-corpus', scene.list(), [fixture.source, fixture.target]);
        const scan = scanSet.scans.find((item) => item.artifactId === fixture.source.id)!;
        const validation = validateScanForRegistration(fixture.source, sourceObject, scan, [fixture.source, fixture.target]);
        expect(validation.canRegisterAutomatically).toBe(false);
        if (fixture.name === 'mirrored-scan') expect(validation.issues.find((issue) => issue.id === 'mesh-handedness')?.status).toBe('confirmation-required');
        if (fixture.name === 'duplicate-scan') expect(validation.issues.find((issue) => issue.id === 'duplicate-scan')?.status).toBe('fail');
      } else {
        const result = await executeFixture(fixture);
        expect(result.outcome, fixture.name).toBe(fixture.expectedOutcome);
        expect(result.engineVersion).toBe(REGISTRATION_ENGINE_VERSION);
        if (fixture.expectedTransform && result.transform) {
          const difference = transformDifference(result.transform, fixture.expectedTransform);
          expect(difference.translationError <= fixture.translationToleranceMm, `${fixture.name}: translation ${difference.translationError}`).toBe(true);
          expect(difference.rotationErrorDegrees <= fixture.rotationToleranceDegrees, `${fixture.name}: rotation ${difference.rotationErrorDegrees}`).toBe(true);
        }
        if (result.transform) {
          expect(result.metrics.iterationCount).toBeGreaterThan(0);
          expect(result.metrics.inlierCount).toBeGreaterThanOrEqual(6);
          expect(result.metrics.estimatedOverlapPercent).toBeGreaterThan(0);
          expect(result.metrics.confidenceScore).toBeGreaterThan(0);
        }
      }
      expect(fixture.source).toEqual(sourceBefore); expect(fixture.target).toEqual(targetBefore);
    });
  }

  it('re-running the same pair produces identical transforms, metrics and fingerprints', async () => {
    const fixture = goldenRegistrationCorpus().find((item) => item.name === 'combined-transform')!;
    const first = await executeFixture(fixture); const second = await executeFixture(fixture);
    expect(second.transform).toEqual(first.transform); expect(second.metrics).toEqual(first.metrics);
    expect(second.candidates).toEqual(first.candidates); expect(second.deterministicFingerprint).toBe(first.deterministicFingerprint);
  });

  it('emits real stage progress and records each measured stage duration', async () => {
    const fixture = goldenRegistrationCorpus().find((item) => item.name === 'translation-only')!; const stages: string[] = [];
    const result = await registerPair(request(fixture), { onProgress: (progress) => stages.push(progress.stage), yieldControl: async () => Promise.resolve() });
    for (const stage of ['geometry-preparation', 'deterministic-sampling', 'coarse-alignment', 'multi-resolution-refinement', 'fine-surface-registration', 'bidirectional-verification', 'confidence-calculation', 'complete']) expect(stages).toContain(stage);
    expect(result.timings.every((timing) => timing.durationMs >= 0)).toBe(true);
  });

  it('cancels without returning a transform or a false accepted result', async () => {
    const fixture = goldenRegistrationCorpus()[0];
    const result = await registerPair(request(fixture), { isCancelled: () => true });
    expect(result.outcome).toBe('cancelled'); expect(result.transform).toBe(null); expect(result.metrics.convergenceState).toBe('cancelled');
  });

  it('does not silently infer unknown source units', async () => {
    const fixture = goldenRegistrationCorpus()[0]; const source = structuredClone(fixture.source); source.units = 'unknown';
    const result = await registerPair({ ...request(fixture), source: { ...request(fixture).source, artifact: source } });
    expect(result.outcome).toBe('failed'); expect(result.errors.join(' ')).toMatch(/units must be explicitly confirmed/);
  });
});

type Fixture = ReturnType<typeof goldenRegistrationCorpus>[number];
function request(fixture: Fixture) { return { requestId: fixture.name, source: { artifact: fixture.source, role: fixture.sourceRole }, target: { artifact: fixture.target, role: fixture.targetRole } }; }
function executeFixture(fixture: Fixture) { return registerPair(request(fixture), { yieldControl: async () => Promise.resolve() }); }
