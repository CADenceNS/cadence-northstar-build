import type { ArtifactRecord } from './core';
import { estimateDentalCoordinates } from './dental-coordinates';
import { averageRigid, composeRigid, identityRigid, invertRigid, transformDifference } from './registration-math';
import type {
  CaseScanRecord,
  CaseScanSet,
  PairwiseRegistrationResult,
  RegistrationRelationship,
  RegistrationStatus,
  ScanRole,
  TransformGraphEdge,
} from './registration-types';

export type PairwiseExecutor = (source: CaseScanRecord, target: CaseScanRecord, purpose: RegistrationRelationship['purpose']) => Promise<PairwiseRegistrationResult>;

export interface AssemblyProgress { completed: number; total: number; message: string; }
export interface AssemblyResult { scanSet: CaseScanSet; results: PairwiseRegistrationResult[]; warnings: string[]; errors: string[]; }

export async function autoAssembleCase(
  input: CaseScanSet,
  artifacts: ArtifactRecord[],
  execute: PairwiseExecutor,
  onProgress?: (progress: AssemblyProgress) => void,
): Promise<AssemblyResult> {
  let scanSet = structuredClone(input); const results: PairwiseRegistrationResult[] = []; const warnings: string[] = []; const errors: string[] = [];
  const upper = byRole(scanSet, 'upper-arch'); const lower = byRole(scanSet, 'lower-arch'); const bites = scanSet.scans.filter((scan) => biteRole(scan.assignedRole));
  const anchor = upper ?? lower ?? scanSet.scans.find((scan) => anchorRole(scan.assignedRole));
  if (!anchor) throw new Error('Auto Assemble Case requires at least one assigned arch, preparation, implant, or pre-operative scan.');
  scanSet = setScanTransform(scanSet, anchor.id, identityRigid(), 'accepted', null, 'Case-coordinate anchor established.');
  scanSet.transformGraph = [graphEdge(anchor.id, 'case-coordinate-system', null, identityRigid(), 'accepted')];

  const planned = relationshipPlan(scanSet, upper, lower, bites); let completed = 0;
  const run = async (source: CaseScanRecord, target: CaseScanRecord, purpose: RegistrationRelationship['purpose']) => {
    onProgress?.({ completed, total: planned.length, message: `Registering ${source.assignedRole} to ${target.assignedRole}` });
    const result = await execute(source, target, purpose); results.push(result); completed += 1;
    scanSet = appendRelationship(scanSet, source, target, purpose, result);
    onProgress?.({ completed, total: planned.length, message: `${source.assignedRole} → ${target.assignedRole}: ${result.outcome}` });
    return result;
  };

  if (upper && lower) {
    if (!bites.length) {
      warnings.push('Upper and lower arches are present without bite evidence. No occlusal relationship was fabricated.');
      scanSet.assemblyStatus = 'review';
    } else {
      const lowerCandidates = [];
      for (const bite of bites) {
        const toUpper = await run(bite, upper, 'bite-upper'); const toLower = await run(bite, lower, 'bite-lower');
        if (accepted(toUpper) && accepted(toLower) && toUpper.transform && toLower.transform) {
          const lowerToUpper = composeRigid(toUpper.transform, invertRigid(toLower.transform)); lowerCandidates.push({ bite, transform: lowerToUpper, upper: toUpper, lower: toLower });
          scanSet = setScanTransform(scanSet, bite.id, toUpper.transform, statusOf(toUpper), toUpper, 'Bite registered into the upper-arch case frame.');
        }
      }
      if (!lowerCandidates.length) {
        errors.push('Bite evidence could not establish an upper-to-lower relationship.'); scanSet.assemblyStatus = 'failed';
      } else {
        const disagreement = biteDisagreement(lowerCandidates.map((item) => item.transform));
        for (const candidate of lowerCandidates) {
          candidate.upper.metrics.biteScanAgreement = disagreement.score; candidate.lower.metrics.biteScanAgreement = disagreement.score;
        }
        if (disagreement.conflict) {
          warnings.push(`Bite scans disagree by up to ${disagreement.translation.toFixed(3)} mm and ${disagreement.rotation.toFixed(3)}°. Candidate occlusions were retained for review.`);
          scanSet.assemblyStatus = 'review';
        } else {
          const transform = averageRigid(lowerCandidates.map((item) => item.transform));
          const confidence = lowerCandidates.reduce((sum, item) => sum + (item.upper.metrics.confidenceScore + item.lower.metrics.confidenceScore) / 2, 0) / lowerCandidates.length;
          scanSet = setScanTransform(scanSet, lower.id, transform, confidence >= 0.72 ? 'accepted' : 'warning', { ...lowerCandidates[0].lower, metrics: { ...lowerCandidates[0].lower.metrics, confidenceScore: confidence, biteScanAgreement: disagreement.score } }, `Occlusal relationship solved from ${lowerCandidates.length} bite scan${lowerCandidates.length === 1 ? '' : 's'}.`);
          scanSet.transformGraph.push(graphEdge(lower.id, upper.id, null, transform, confidence >= 0.72 ? 'accepted' : 'warning'));
        }
      }
    }
  }

  for (const pair of planned.filter((item) => item.purpose !== 'bite-upper' && item.purpose !== 'bite-lower')) {
    const currentSource = scanSet.scans.find((scan) => scan.id === pair.source.id)!; const currentTarget = scanSet.scans.find((scan) => scan.id === pair.target.id)!;
    if (currentSource.registrationStatus === 'accepted' && currentSource.id !== anchor.id) continue;
    const result = await run(currentSource, currentTarget, pair.purpose);
    if (!accepted(result) || !result.transform) { if (result.outcome === 'manual-review-required') warnings.push(`${currentSource.assignedRole} registration is ambiguous and requires review.`); else errors.push(`${currentSource.assignedRole} could not be registered to ${currentTarget.assignedRole}.`); continue; }
    const targetCaseTransform = currentTarget.registrationTransform; const caseTransform = composeRigid(targetCaseTransform, result.transform);
    scanSet = setScanTransform(scanSet, currentSource.id, caseTransform, statusOf(result), result, `${currentSource.assignedRole} attached to ${currentTarget.assignedRole}.`);
    scanSet.transformGraph.push(graphEdge(currentSource.id, currentTarget.id, scanSet.relationships.at(-1)?.id ?? null, result.transform, statusOf(result)));
  }

  const successful = scanSet.scans.filter((scan) => ['accepted', 'warning'].includes(scan.registrationStatus));
  const confidenceValues = successful.map((scan) => scan.confidence?.confidenceScore).filter((value): value is number => value !== undefined && value !== null);
  scanSet.assemblyConfidence = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : anchor ? 1 : null;
  if (scanSet.assemblyStatus === 'unregistered') scanSet.assemblyStatus = errors.length ? 'failed' : warnings.length ? 'warning' : 'accepted';
  try { scanSet.dentalCoordinates = estimateDentalCoordinates(scanSet, artifacts); } catch (error) { warnings.push(error instanceof Error ? error.message : 'Dental coordinate estimation failed.'); if (scanSet.assemblyStatus === 'accepted') scanSet.assemblyStatus = 'warning'; }
  scanSet.updatedAt = new Date().toISOString();
  onProgress?.({ completed: planned.length, total: planned.length, message: `Assembly ${scanSet.assemblyStatus}` });
  return { scanSet, results, warnings, errors };
}

export function appendPairwiseResult(scanSet: CaseScanSet, source: CaseScanRecord, target: CaseScanRecord, purpose: RegistrationRelationship['purpose'], result: PairwiseRegistrationResult, acceptResult = false): CaseScanSet {
  let next = appendRelationship(structuredClone(scanSet), source, target, purpose, result);
  if (acceptResult && accepted(result) && result.transform) {
    const transform = composeRigid(target.registrationTransform, result.transform);
    next = setScanTransform(next, source.id, transform, statusOf(result), result, `Accepted registration to ${target.assignedRole}.`);
    next.transformGraph.push(graphEdge(source.id, target.id, next.relationships.at(-1)?.id ?? null, result.transform, statusOf(result)));
  }
  return next;
}

export function relationshipPlan(scanSet: CaseScanSet, upper = byRole(scanSet, 'upper-arch'), lower = byRole(scanSet, 'lower-arch'), bites = scanSet.scans.filter((scan) => biteRole(scan.assignedRole))): Array<{ source: CaseScanRecord; target: CaseScanRecord; purpose: RegistrationRelationship['purpose'] }> {
  const pairs: Array<{ source: CaseScanRecord; target: CaseScanRecord; purpose: RegistrationRelationship['purpose'] }> = [];
  if (upper && lower) for (const bite of bites) { pairs.push({ source: bite, target: upper, purpose: 'bite-upper' }, { source: bite, target: lower, purpose: 'bite-lower' }); }
  for (const scan of scanSet.scans) {
    if (scan.id === upper?.id || scan.id === lower?.id || biteRole(scan.assignedRole)) continue;
    const target = targetForRole(scan.assignedRole, scanSet); if (target && target.id !== scan.id) pairs.push({ source: scan, target, purpose: purposeForRole(scan.assignedRole) });
  }
  return pairs;
}

function targetForRole(role: ScanRole, scanSet: CaseScanSet): CaseScanRecord | undefined {
  const roleOrder: Partial<Record<ScanRole, ScanRole[]>> = {
    'pre-operative-upper': ['upper-arch', 'preparation-arch'],
    'pre-operative-lower': ['lower-arch', 'preparation-arch'],
    'preparation-arch': ['pre-operative-upper', 'pre-operative-lower', 'upper-arch', 'lower-arch'],
    'preparation-segment': ['preparation-arch'],
    gingiva: ['implant-arch'],
    'scan-body': ['implant-arch'],
    'wax-up': ['preparation-arch', 'pre-operative-upper', 'pre-operative-lower'],
    temporary: ['preparation-arch', 'pre-operative-upper', 'pre-operative-lower'],
    'reference-scan': ['upper-arch', 'lower-arch', 'preparation-arch'],
    'facial-scan': ['reference-scan', 'upper-arch', 'lower-arch'],
    'cbct-derived-surface': ['reference-scan', 'implant-arch', 'upper-arch', 'lower-arch'],
    'implant-arch': ['upper-arch', 'lower-arch', 'pre-operative-upper', 'pre-operative-lower'],
  };
  for (const targetRole of roleOrder[role] ?? []) { const target = byRole(scanSet, targetRole); if (target) return target; }
  return undefined;
}

function purposeForRole(role: ScanRole): RegistrationRelationship['purpose'] {
  if (['pre-operative-upper', 'pre-operative-lower', 'preparation-arch', 'preparation-segment'].includes(role)) return 'pre-operative';
  if (['gingiva', 'scan-body', 'implant-arch'].includes(role)) return 'implant';
  if (['reference-scan', 'facial-scan', 'cbct-derived-surface', 'wax-up', 'temporary'].includes(role)) return 'reference';
  return 'pairwise';
}

function appendRelationship(scanSet: CaseScanSet, source: CaseScanRecord, target: CaseScanRecord, purpose: RegistrationRelationship['purpose'], result: PairwiseRegistrationResult): CaseScanSet {
  const id = `${source.id}:${target.id}:${purpose}`; const existing = scanSet.relationships.find((relationship) => relationship.id === id);
  const relationship: RegistrationRelationship = {
    id,
    sourceScanId: source.id,
    targetScanId: target.id,
    purpose,
    status: statusOf(result),
    acceptedResultId: accepted(result) ? result.id : null,
    currentTransform: accepted(result) ? result.transform : existing?.currentTransform ?? null,
    results: [...(existing?.results ?? []).filter((item) => item.id !== result.id), structuredClone(result)],
    locked: existing?.locked ?? false,
    manuallyModified: existing?.manuallyModified ?? false,
    updatedAt: new Date().toISOString(),
  };
  return { ...scanSet, relationships: [...scanSet.relationships.filter((item) => item.id !== id), relationship], updatedAt: new Date().toISOString() };
}

function setScanTransform(scanSet: CaseScanSet, scanId: string, transform: CaseScanRecord['registrationTransform'], status: RegistrationStatus, result: PairwiseRegistrationResult | null, detail: string): CaseScanSet {
  return {
    ...scanSet,
    scans: scanSet.scans.map((scan) => scan.id !== scanId ? scan : {
      ...scan,
      registrationTransform: structuredClone(transform),
      registrationStatus: status,
      confidence: result?.metrics ?? scan.confidence,
      registrationHistory: [...scan.registrationHistory, {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        action: 'registration-transform-updated',
        actor: null,
        transform: structuredClone(transform),
        ...(result ? { resultId: result.id } : {}),
        detail,
      }],
    }),
    updatedAt: new Date().toISOString(),
  };
}

function graphEdge(sourceScanId: string, targetScanId: TransformGraphEdge['targetScanId'], relationshipId: string | null, transform: TransformGraphEdge['transform'], status: RegistrationStatus): TransformGraphEdge {
  return { id: crypto.randomUUID(), sourceScanId, targetScanId, relationshipId, transform: structuredClone(transform), status };
}
function byRole(scanSet: CaseScanSet, role: ScanRole): CaseScanRecord | undefined { return scanSet.scans.find((scan) => scan.assignedRole === role); }
function biteRole(role: ScanRole): boolean { return ['buccal-bite-left', 'buccal-bite-right', 'buccal-bite-anterior', 'full-bite'].includes(role); }
function anchorRole(role: ScanRole): boolean { return ['preparation-arch', 'pre-operative-upper', 'pre-operative-lower', 'implant-arch'].includes(role); }
function accepted(result: PairwiseRegistrationResult): boolean { return result.outcome === 'accepted' || result.outcome === 'accepted-with-warning'; }
function statusOf(result: PairwiseRegistrationResult): RegistrationStatus { if (result.outcome === 'accepted') return 'accepted'; if (result.outcome === 'accepted-with-warning') return 'warning'; if (result.outcome === 'manual-review-required') return 'review'; return result.outcome; }

function biteDisagreement(transforms: CaseScanRecord['registrationTransform'][]): { translation: number; rotation: number; score: number; conflict: boolean } {
  let translation = 0; let rotation = 0;
  for (let first = 0; first < transforms.length; first += 1) for (let second = first + 1; second < transforms.length; second += 1) {
    const difference = transformDifference(transforms[first], transforms[second]); translation = Math.max(translation, difference.translationError); rotation = Math.max(rotation, difference.rotationErrorDegrees);
  }
  return { translation, rotation, score: Math.max(0, 1 - translation / 0.5 - rotation / 1), conflict: translation > 0.5 || rotation > 1 };
}
