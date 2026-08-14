import { CROWN_MATERIAL_PROFILES } from './morphology-core';
import { createRestorationProjectState, type CrownLocks, type RestorationProjectState, type RestorationRecord, type RestorationVersion } from './restoration-types';

export const DEFAULT_CROWN_LOCKS: CrownLocks = { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false };

export class RestorationStateManager {
  private state: RestorationProjectState;
  private readonly listeners = new Set<() => void>();
  constructor(initial: RestorationProjectState = createRestorationProjectState()) { this.state = normalizeRestorationState(initial); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get(): RestorationProjectState { return structuredClone(this.state); }
  replace(value: RestorationProjectState): void { this.state = normalizeRestorationState(value); this.listeners.forEach((listener) => listener()); }
  update(patch: Partial<Omit<RestorationProjectState, 'schemaVersion' | 'engineVersion' | 'morphologyVersion'>>): void { this.replace({ ...this.state, ...structuredClone(patch) }); }
}

export function normalizeRestorationState(value: Partial<RestorationProjectState> | null | undefined): RestorationProjectState {
  const defaults = createRestorationProjectState();
  if (!value || typeof value !== 'object') return defaults;
  return {
    ...defaults,
    ...structuredClone(value),
    schemaVersion: 2,
    engineVersion: defaults.engineVersion,
    morphologyVersion: defaults.morphologyVersion,
    restorations: Array.isArray(value.restorations) ? value.restorations.map((record) => normalizeRecord(record)) : [],
    versions: Array.isArray(value.versions) ? value.versions.map((version) => normalizeVersion(version, value.restorations ?? [])) : [],
    qcResults: Array.isArray(value.qcResults) ? structuredClone(value.qcResults) : [],
    exports: Array.isArray(value.exports) ? structuredClone(value.exports) : [],
    historyEvents: Array.isArray(value.historyEvents) ? structuredClone(value.historyEvents) : [],
    checkpoints: Array.isArray(value.checkpoints) ? structuredClone(value.checkpoints) : [],
    settings: { ...defaults.settings, ...(value.settings ?? {}) },
  };
}

function normalizeRecord(recordValue: RestorationRecord | Partial<RestorationRecord>): RestorationRecord {
  const record = structuredClone(recordValue) as RestorationRecord; const tooth = Number(record.toothNumber); const profile = CROWN_MATERIAL_PROFILES[record.materialProfileId] ?? CROWN_MATERIAL_PROFILES['zirconia-monolithic'];
  return {
    ...record,
    caseId: record.caseId ?? 'case-unassigned',
    numberingSystem: record.numberingSystem ?? 'UNIVERSAL',
    arch: record.arch ?? (Number.isFinite(tooth) && tooth <= 16 ? 'MAXILLARY' : 'MANDIBULAR'),
    restorationType: record.restorationType ?? 'SINGLE_UNIT_TOOTH_SUPPORTED_CROWN',
    materialProfileId: profile.id,
    materialProfileVersion: record.materialProfileVersion ?? profile.version,
    materialProfileSnapshot: record.materialProfileSnapshot ?? structuredClone(profile),
    adjacentObjectIds: record.adjacentObjectIds ?? { mesial: record.mesialContact?.adjacentObjectId ?? null, distal: record.distalContact?.adjacentObjectId ?? null },
    opposingObjectId: record.opposingObjectId ?? record.occlusion?.antagonistObjectId ?? null,
    preOpObjectId: record.preOpObjectId ?? record.contour?.referenceObjectId ?? null,
    contourReferenceObjectIds: record.contourReferenceObjectIds ?? (record.preOpObjectId ? { 'pre-op': [record.preOpObjectId] } : {}),
    referenceAdaptation: record.referenceAdaptation ?? { mode: 'none', influence: 0, selectedRegion: null },
    designVersion: record.designVersion ?? record.versionIds?.length ?? 0,
    manufacturingState: record.manufacturingState ?? (record.approvalState === 'LOCKED' ? 'LOCKED' : record.approvalState === 'APPROVED_FOR_EXPORT' ? 'READY_FOR_EXPORT' : 'QC_REQUIRED'),
    geometryLineageRootArtifactId: record.geometryLineageRootArtifactId ?? record.artifactId ?? '',
    activeBranchId: record.activeBranchId ?? 'main',
    locks: { ...DEFAULT_CROWN_LOCKS, ...(record.locks ?? {}) },
    optimization: record.optimization ?? null,
    sculptMaskVertexIds: record.sculptMaskVertexIds ?? [],
    lockedAnatomyVertexIds: record.lockedAnatomyVertexIds ?? [],
    historyEventIds: record.historyEventIds ?? [],
    checkpointIds: record.checkpointIds ?? [],
    contour: record.contour ? {
      ...record.contour,
      references: record.contour.references ?? [],
      regions: record.contour.regions ?? {
        facial: { maximumOverContourMm: 0, maximumUnderContourMm: 0, affectedVertexIds: [] },
        lingual: { maximumOverContourMm: 0, maximumUnderContourMm: 0, affectedVertexIds: [] },
        cervical: { maximumOverContourMm: 0, maximumUnderContourMm: 0, affectedVertexIds: [] },
        proximal: { maximumOverContourMm: 0, maximumUnderContourMm: 0, affectedVertexIds: [] },
      },
    } : null,
  };
}

function normalizeVersion(versionValue: RestorationVersion | Partial<RestorationVersion>, records: Partial<RestorationRecord>[]): RestorationVersion {
  const version = structuredClone(versionValue) as RestorationVersion; const record = records.find((value) => value.id === version.restorationId); const profile = CROWN_MATERIAL_PROFILES[record?.materialProfileId ?? 'zirconia-monolithic'];
  return {
    ...version,
    branchId: version.branchId ?? 'main',
    checkpointName: version.checkpointName ?? null,
    morphologyVersion: version.morphologyVersion ?? record?.morphologyVersion ?? defaultsMorphologyVersion(),
    materialProfileId: version.materialProfileId ?? profile.id,
    materialProfileVersion: version.materialProfileVersion ?? profile.version,
    marginVersionId: version.marginVersionId ?? record?.approvedMarginVersionId ?? 'unknown-margin-version',
  };
}

function defaultsMorphologyVersion(): string { return createRestorationProjectState().morphologyVersion; }
