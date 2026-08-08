import type { PairwiseRegistrationResult, RegistrationRelationship, ScanRole } from './registration-types';

export type RegistrationSupportClassification =
  | 'Production Certified'
  | 'Supported — Manual Review Required'
  | 'Unsupported — Insufficient Evidence'
  | 'Failed';

export interface RegistrationSupportDecision {
  classification: Exclude<RegistrationSupportClassification, 'Failed'>;
  automaticAcceptance: boolean;
  manualRegistrationAvailable: boolean;
  evidenceCaseIds: string[];
  explanation: string;
}

const BITE_ROLES = new Set<ScanRole>(['buccal-bite-left', 'buccal-bite-right', 'buccal-bite-anterior', 'full-bite']);
const ARCH_ROLES = new Set<ScanRole>(['upper-arch', 'lower-arch']);
const IMPLANT_WORKFLOW_ROLES = new Set<ScanRole>(['implant-arch', 'scan-body', 'gingiva', 'temporary', 'reference-scan']);

export function registrationSupportDecision(
  sourceRole: ScanRole,
  targetRole: ScanRole,
  purpose: RegistrationRelationship['purpose'],
): RegistrationSupportDecision {
  if (BITE_ROLES.has(sourceRole) && ARCH_ROLES.has(targetRole) && (purpose === 'bite-upper' || purpose === 'bite-lower' || purpose === 'pairwise')) {
    return {
      classification: 'Production Certified',
      automaticAcceptance: true,
      manualRegistrationAvailable: true,
      evidenceCaseIds: ['CASE-001'],
      explanation: 'Private-corpus certification covers bite-surface registration into preserved upper and lower arch coordinates.',
    };
  }

  if (purpose === 'occlusal-assembly' || (ARCH_ROLES.has(sourceRole) && ARCH_ROLES.has(targetRole))) {
    return {
      classification: 'Unsupported — Insufficient Evidence',
      automaticAcceptance: false,
      manualRegistrationAvailable: true,
      evidenceCaseIds: ['CASE-003'],
      explanation: 'No direct upper/lower occlusal relationship may be inferred without accepted bite evidence.',
    };
  }

  if (IMPLANT_WORKFLOW_ROLES.has(sourceRole) && IMPLANT_WORKFLOW_ROLES.has(targetRole)) {
    return {
      classification: 'Supported — Manual Review Required',
      automaticAcceptance: false,
      manualRegistrationAvailable: true,
      evidenceCaseIds: ['CASE-002'],
      explanation: 'The implant and photogrammetry corpus supports candidate generation, but limited heterogeneous-surface overlap requires user review.',
    };
  }

  if (purpose === 'manual') {
    return {
      classification: 'Supported — Manual Review Required',
      automaticAcceptance: false,
      manualRegistrationAvailable: true,
      evidenceCaseIds: ['CASE-001', 'CASE-002', 'CASE-003'],
      explanation: 'Landmark and numeric manual registration are available, but the relationship is not automatically production certified.',
    };
  }

  return {
    classification: 'Unsupported — Insufficient Evidence',
    automaticAcceptance: false,
    manualRegistrationAvailable: true,
    evidenceCaseIds: [],
    explanation: `No private-corpus evidence production-certifies ${sourceRole} to ${targetRole} for ${purpose}.`,
  };
}

export function registrationResultClassification(result: PairwiseRegistrationResult, decision: RegistrationSupportDecision): RegistrationSupportClassification {
  if (result.outcome === 'failed' || result.outcome === 'cancelled') return 'Failed';
  if (decision.classification !== 'Production Certified') return decision.classification;
  if (result.outcome === 'manual-review-required') return 'Supported — Manual Review Required';
  return 'Production Certified';
}

export function enforceRegistrationSupport(result: PairwiseRegistrationResult, decision: RegistrationSupportDecision): PairwiseRegistrationResult {
  if (result.outcome === 'failed' || result.outcome === 'cancelled' || decision.automaticAcceptance) return result;
  const message = `${decision.classification}: ${decision.explanation}`;
  return {
    ...structuredClone(result),
    outcome: 'manual-review-required',
    warnings: result.warnings.includes(message) ? result.warnings : [...result.warnings, message],
  };
}
