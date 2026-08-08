import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { enforceRegistrationSupport, registrationResultClassification, registrationSupportDecision } from '../src/registration-support';
import type { PairwiseRegistrationResult } from '../src/registration-types';
import { identityRigid } from '../src/registration-math';

describe('evidence-based registration support matrix', () => {
  it('production-certifies only corpus-proven bite-to-arch relationships', () => {
    const upper = registrationSupportDecision('full-bite', 'upper-arch', 'bite-upper');
    const lower = registrationSupportDecision('buccal-bite-left', 'lower-arch', 'bite-lower');
    expect(upper.classification).toBe('Production Certified');
    expect(lower.classification).toBe('Production Certified');
    expect(upper.automaticAcceptance).toBe(true);
    expect(upper.evidenceCaseIds).toEqual(['CASE-001']);
  });

  it('requires manual review for heterogeneous implant-workflow surfaces', () => {
    const decision = registrationSupportDecision('scan-body', 'implant-arch', 'implant');
    expect(decision.classification).toBe('Supported — Manual Review Required');
    expect(decision.automaticAcceptance).toBe(false);
    expect(decision.manualRegistrationAvailable).toBe(true);
    expect(decision.evidenceCaseIds).toEqual(['CASE-002']);
  });

  it('fails closed for a direct upper/lower occlusal inference without bite evidence', () => {
    const decision = registrationSupportDecision('upper-arch', 'lower-arch', 'occlusal-assembly');
    expect(decision.classification).toBe('Unsupported — Insufficient Evidence');
    expect(decision.automaticAcceptance).toBe(false);
    expect(decision.evidenceCaseIds).toEqual(['CASE-003']);
  });

  it('converts an algorithmic implant candidate into an explicit review result', () => {
    const raw = acceptedResult();
    const decision = registrationSupportDecision('scan-body', 'implant-arch', 'implant');
    const governed = enforceRegistrationSupport(raw, decision);
    expect(governed.outcome).toBe('manual-review-required');
    expect(governed.transform).toEqual(raw.transform);
    expect(governed.warnings.join(' ')).toMatch(/Manual Review Required/);
    expect(registrationResultClassification(governed, decision)).toBe('Supported — Manual Review Required');
  });

  it('reports failed execution distinctly from unsupported evidence', () => {
    const failed = { ...acceptedResult(), outcome: 'failed' as const, transform: null };
    const decision = registrationSupportDecision('unknown', 'upper-arch', 'pairwise');
    expect(registrationResultClassification(failed, decision)).toBe('Failed');
  });
});

function acceptedResult(): PairwiseRegistrationResult {
  return {
    id: 'result', engineVersion: 'test', sourceArtifactId: 'source', targetArtifactId: 'target', sourceRole: 'scan-body', targetRole: 'implant-arch',
    startedAt: '2026-08-04T00:00:00.000Z', completedAt: '2026-08-04T00:00:01.000Z', outcome: 'accepted', transform: identityRigid(),
    metrics: {
      rmsResidual: 0.1, medianResidual: 0.08, percentile95Residual: 0.2, maximumAcceptedResidual: 0.3, inlierCount: 100, outlierCount: 10,
      inlierRatio: 0.9, estimatedOverlapPercent: 90, convergenceState: 'converged', iterationCount: 4, translationMagnitude: 0, rotationMagnitudeDegrees: 0,
      bidirectionalConsistency: 1, surfaceNormalAgreement: 1, candidateAmbiguity: 0, biteScanAgreement: null, interpenetrationIndicators: 0, confidenceScore: 0.95,
    },
    candidates: [], correspondences: [], timings: [], warnings: [], errors: [], deterministicFingerprint: 'fingerprint',
  };
}
