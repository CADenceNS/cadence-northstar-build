import type { ArtifactKind, ArtifactRecord, SceneObject } from './core';
import { identityRigid } from './registration-math';
import type { CaseScanRecord, CaseScanSet, RegistrationMetrics, ScanRole } from './registration-types';

export function createCaseScanSet(projectId: string, scene: SceneObject[] = [], artifacts: ArtifactRecord[] = []): CaseScanSet {
  const now = new Date().toISOString(); const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    projectId,
    caseId: null,
    scans: scene.flatMap((object) => {
      const artifact = artifactMap.get(object.artifactId); return artifact ? [createCaseScanRecord(projectId, object, artifact)] : [];
    }),
    relationships: [],
    transformGraph: [],
    dentalCoordinates: null,
    assemblyStatus: 'unregistered',
    assemblyConfidence: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createCaseScanRecord(parentCaseId: string, object: SceneObject, artifact: ArtifactRecord): CaseScanRecord {
  return {
    id: crypto.randomUUID(),
    artifactId: artifact.id,
    sceneObjectId: object.id,
    fileHash: artifact.checksum,
    originalUnits: artifact.units,
    confirmedUnits: artifact.units,
    assignedRole: inferScanRole(artifact.sourceName, object.type),
    registrationTransform: identityRigid(),
    parentCaseId,
    registrationStatus: 'unregistered',
    confidence: null,
    validation: null,
    registrationHistory: [{ id: crypto.randomUUID(), at: new Date().toISOString(), action: 'scan-added', actor: null, transform: identityRigid(), detail: 'Immutable artifact added to the case scan set.' }],
    userAdjustments: [],
    locked: object.locked,
    unitsConfirmed: artifact.units !== 'unknown',
    mirroredConfirmed: false,
  };
}

export function synchronizeCaseScanSet(scanSet: CaseScanSet, scene: SceneObject[], artifacts: ArtifactRecord[]): CaseScanSet {
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact])); const existing = new Map(scanSet.scans.map((scan) => [scan.artifactId, scan]));
  const scans = scene.flatMap((object) => {
    const artifact = artifactMap.get(object.artifactId); if (!artifact) return [];
    const current = existing.get(artifact.id); return [current ? { ...structuredClone(current), sceneObjectId: object.id, locked: object.locked } : createCaseScanRecord(scanSet.projectId, object, artifact)];
  });
  const scanIds = new Set(scans.map((scan) => scan.id));
  return {
    ...structuredClone(scanSet),
    scans,
    relationships: scanSet.relationships.filter((relationship) => scanIds.has(relationship.sourceScanId) && scanIds.has(relationship.targetScanId)),
    transformGraph: scanSet.transformGraph.filter((edge) => scanIds.has(edge.sourceScanId) && (edge.targetScanId === 'case-coordinate-system' || scanIds.has(edge.targetScanId))),
    updatedAt: new Date().toISOString(),
  };
}

export function updateScan(scanSet: CaseScanSet, scanId: string, patch: Partial<Omit<CaseScanRecord, 'id' | 'artifactId' | 'fileHash' | 'parentCaseId'>>): CaseScanSet {
  if (!scanSet.scans.some((scan) => scan.id === scanId)) throw new Error(`Case scan ${scanId} was not found.`);
  return { ...structuredClone(scanSet), scans: scanSet.scans.map((scan) => scan.id === scanId ? { ...structuredClone(scan), ...structuredClone(patch) } : structuredClone(scan)), updatedAt: new Date().toISOString() };
}

export function inferScanRole(name: string, kind: ArtifactKind = 'unknown'): ScanRole {
  const value = name.toLowerCase();
  if (/buccal.*left|left.*bite/.test(value)) return 'buccal-bite-left';
  if (/buccal.*right|right.*bite/.test(value)) return 'buccal-bite-right';
  if (/anterior.*bite|bite.*anterior/.test(value)) return 'buccal-bite-anterior';
  if (/full.*bite|bite.*full|occlusion/.test(value) || kind === 'bite') return 'full-bite';
  if (/pre.?op.*upper|maxilla.*pre/.test(value)) return 'pre-operative-upper';
  if (/pre.?op.*lower|mandib.*pre/.test(value)) return 'pre-operative-lower';
  if (/prep.*segment|segment.*prep/.test(value)) return 'preparation-segment';
  if (/prep/.test(value) || kind === 'preparation') return 'preparation-arch';
  if (/implant.*arch/.test(value)) return 'implant-arch';
  if (/scan.?body/.test(value) || kind === 'scan-body') return 'scan-body';
  if (/gingiva/.test(value) || kind === 'gingiva') return 'gingiva';
  if (/wax/.test(value) || kind === 'wax-up') return 'wax-up';
  if (/temp/.test(value)) return 'temporary';
  if (/facial|face.?scan/.test(value)) return 'facial-scan';
  if (/cbct/.test(value)) return 'cbct-derived-surface';
  if (/reference/.test(value) || kind === 'reference') return 'reference-scan';
  if (/upper|maxilla/.test(value) || kind === 'upper') return 'upper-arch';
  if (/lower|mandib/.test(value) || kind === 'lower') return 'lower-arch';
  return 'unknown';
}

export function emptyRegistrationMetrics(): RegistrationMetrics {
  return { rmsResidual: Infinity, medianResidual: Infinity, percentile95Residual: Infinity, maximumAcceptedResidual: Infinity, inlierCount: 0, outlierCount: 0, inlierRatio: 0, estimatedOverlapPercent: 0, convergenceState: 'not-run', iterationCount: 0, translationMagnitude: 0, rotationMagnitudeDegrees: 0, bidirectionalConsistency: 0, surfaceNormalAgreement: null, candidateAmbiguity: 0, biteScanAgreement: null, interpenetrationIndicators: 0, confidenceScore: 0 };
}
