import type { ArtifactRecord, SceneObject } from './core';
import { indexedMesh, inspectGeometry, validateGeometryResult } from './editing-geometry';
import { CROWN_MATERIAL_PROFILES } from './morphology-core';
import type { IArtifactManager, ISceneManager, RuntimeCommand, CommandMetadata, CommandValidation } from './interfaces';
import type { RestorationStateManager } from './restoration-state';
import type {
  CrownExportRecord,
  CrownGenerationInput,
  CrownGenerationResult,
  CrownQcResult,
  RestorationApprovalState,
  RestorationProjectState,
  RestorationCheckpoint,
  RestorationHistoryEvent,
  RestorationRecord,
  RestorationVersion,
} from './restoration-types';

export interface RestorationCommandContext { scene: ISceneManager; artifacts: IArtifactManager; restorations: RestorationStateManager; }

function metadata(type: string, label: string): CommandMetadata { return { id: crypto.randomUUID(), type, label, createdAt: new Date().toISOString(), tags: ['restoration', 'crown', 'derived-artifact'] }; }
function valid(): CommandValidation { return { valid: true, errors: [] }; }
function invalid(...errors: string[]): CommandValidation { return { valid: false, errors }; }

export class RestorationStateCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata; private previous: RestorationProjectState;
  constructor(private readonly manager: RestorationStateManager, private readonly next: RestorationProjectState, type: string, label: string) { this.previous = manager.get(); this.metadata = metadata(type, label); }
  validate(): CommandValidation { return valid(); }
  execute(): void { this.previous = this.manager.get(); this.manager.replace(this.next); }
  undo(): void { this.manager.replace(this.previous); }
  redo(): void { this.manager.replace(this.next); }
}

abstract class RestorationGeometryBase implements RuntimeCommand {
  abstract readonly metadata: CommandMetadata;
  protected beforeArtifacts: ArtifactRecord[] = [];
  protected beforeScene: SceneObject[] = [];
  protected beforeState: RestorationProjectState;
  protected afterArtifacts: ArtifactRecord[] | null = null;
  protected afterScene: SceneObject[] | null = null;
  protected afterState: RestorationProjectState | null = null;
  protected constructor(protected readonly context: RestorationCommandContext) { this.beforeState = context.restorations.get(); }
  protected snapshotBefore(): void { this.beforeArtifacts = this.context.artifacts.list(); this.beforeScene = this.context.scene.list(); this.beforeState = this.context.restorations.get(); }
  protected restore(artifacts: ArtifactRecord[], scene: SceneObject[], state: RestorationProjectState): void { this.context.artifacts.replace(artifacts); this.context.scene.replace(scene); this.context.restorations.replace(state); }
  undo(): void { this.restore(this.beforeArtifacts, this.beforeScene, this.beforeState); }
  redo(): void { if (!this.afterArtifacts || !this.afterScene || !this.afterState) throw new Error('Restoration geometry command has not executed.'); this.restore(this.afterArtifacts, this.afterScene, this.afterState); }
  protected commit(artifacts: ArtifactRecord[], scene: SceneObject[], state: RestorationProjectState): void { this.afterArtifacts = structuredClone(artifacts); this.afterScene = structuredClone(scene); this.afterState = structuredClone(state); this.restore(artifacts, scene, state); }
  abstract validate(): CommandValidation | Promise<CommandValidation>;
  abstract execute(): void | Promise<void>;
}

export class CrownProposalCommand extends RestorationGeometryBase {
  readonly metadata: CommandMetadata;
  constructor(
    context: RestorationCommandContext,
    private readonly input: CrownGenerationInput,
    private readonly result: CrownGenerationResult,
    private readonly lineage: { preparationVersionId: string; approvedMarginVersionId: string; insertionAxisAnalysisId: string },
  ) { super(context); this.metadata = metadata('crown.proposal.generate', `Generate crown proposal for tooth ${input.toothNumber}`); }
  validate(): CommandValidation {
    const parent = this.context.artifacts.get(this.input.preparationArtifactId); if (!parent) return invalid(`Preparation artifact ${this.input.preparationArtifactId} not found.`);
    if (this.context.restorations.get().restorations.some((record) => record.preparationId === this.input.preparationId && record.approvalState === 'LOCKED')) return invalid('A locked restoration already exists for this preparation.');
    try { const inspection = validateGeometryResult(indexedMesh(this.result.mesh)); if (!inspection.watertight || inspection.shellCount !== 1) return invalid('Crown proposal is not a single watertight restoration solid.'); }
    catch (error) { return invalid(error instanceof Error ? error.message : String(error)); }
    return valid();
  }
  async execute(): Promise<void> {
    if (this.afterArtifacts && this.afterScene && this.afterState) { this.redo(); return; }
    this.snapshotBefore(); const parent = this.context.artifacts.get(this.input.preparationArtifactId)!; const createdAt = new Date().toISOString(); const restorationId = crypto.randomUUID();
    const artifact = await crownArtifact(parent, this.result.mesh, `Crown #${this.input.toothNumber}`, 'crown-proposal', this.metadata.id, 1, createdAt);
    const object: SceneObject = { id: crypto.randomUUID(), name: `Crown #${this.input.toothNumber}`, type: 'restoration', artifactId: artifact.id, visible: true, isolated: false, locked: false, transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [0.93, 0.91, 0.78, 1], opacity: 1, metallic: 0.02, roughness: 0.38 }, selected: true, metadata: { restorationId, toothNumber: this.input.toothNumber, materialProfile: this.input.materialProfileId, morphology: this.input.parameters.morphologyId } };
    const profile = CROWN_MATERIAL_PROFILES[this.input.materialProfileId]; const branchId = crypto.randomUUID();
    const version: RestorationVersion = { id: crypto.randomUUID(), restorationId, parentVersionId: null, version: 1, artifactId: artifact.id, operation: 'crown-proposal', commandId: this.metadata.id, branchId, checkpointName: null, morphologyVersion: this.beforeState.morphologyVersion, materialProfileId: profile.id, materialProfileVersion: profile.version, marginVersionId: this.lineage.approvedMarginVersionId, parameters: numericParameters(this.input.parameters), inspection: this.result.inspection, createdAt };
    const createdEvent = historyEvent(restorationId, version.id, 'created', this.metadata.id, null, 'Initial crown proposal created from the approved preparation and margin.', { toothNumber: this.input.toothNumber, materialProfile: profile.id, designVersion: 1 }, createdAt);
    const record: RestorationRecord = {
      id: restorationId, preparationId: this.input.preparationId, preparationVersionId: this.lineage.preparationVersionId, approvedMarginVersionId: this.lineage.approvedMarginVersionId, insertionAxisAnalysisId: this.lineage.insertionAxisAnalysisId,
      caseId: this.input.caseId, numberingSystem: this.input.numberingSystem, arch: this.input.arch, restorationType: 'SINGLE_UNIT_TOOTH_SUPPORTED_CROWN',
      toothNumber: this.input.toothNumber, morphologyId: this.input.parameters.morphologyId, morphologyVersion: this.beforeState.morphologyVersion, materialProfileId: this.input.materialProfileId, materialProfileVersion: profile.version, materialProfileSnapshot: structuredClone(profile),
      adjacentObjectIds: { mesial: this.input.adjacentMeshes.find((value) => value.side === 'mesial')?.objectId ?? null, distal: this.input.adjacentMeshes.find((value) => value.side === 'distal')?.objectId ?? null }, opposingObjectId: this.input.antagonist?.objectId ?? null, preOpObjectId: this.input.reference?.kind === 'pre-op' ? this.input.reference.objectId : null, contourReferenceObjectIds: Object.fromEntries(this.input.contourReferences.map((value) => [value.kind, this.input.contourReferences.filter((candidate) => candidate.kind === value.kind).map((candidate) => candidate.objectId)])), referenceAdaptation: structuredClone(this.input.referenceAdaptation), designVersion: 1, manufacturingState: 'QC_REQUIRED', geometryLineageRootArtifactId: artifact.derivedFrom?.rootArtifactId ?? parent.id, activeBranchId: branchId,
      artifactId: artifact.id, sceneObjectId: object.id, parameters: structuredClone(this.input.parameters), locks: { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false }, topologyMap: structuredClone(this.result.topologyMap),
      thickness: structuredClone(this.result.thickness), cementSpace: structuredClone(this.result.cementSpace), seating: structuredClone(this.result.seating), mesialContact: structuredClone(this.result.mesialContact), distalContact: structuredClone(this.result.distalContact), occlusion: structuredClone(this.result.occlusion), contour: structuredClone(this.result.contour),
      optimization: null, sculptMaskVertexIds: [], lockedAnatomyVertexIds: [], qcResultIds: [], activeQcResultId: null, versionIds: [version.id], activeVersionId: version.id, exportRecordIds: [], historyEventIds: [createdEvent.id], checkpointIds: [], approvalState: 'QC_REQUIRED', approvedAt: null, approvedBy: null, createdAt, updatedAt: createdAt,
    };
    const scene = [...this.beforeScene.map((value) => ({ ...value, selected: false })), object]; const state = { ...this.beforeState, restorations: [...this.beforeState.restorations, record], versions: [...this.beforeState.versions, version], historyEvents: [...this.beforeState.historyEvents, createdEvent], activeRestorationId: restorationId };
    this.commit([...this.beforeArtifacts, artifact], scene, state);
  }
}

export interface CrownGeometryUpdate {
  mesh: ArtifactRecord['mesh'];
  operation: string;
  label: string;
  parameters?: Record<string, number | string | boolean | null>;
  analyses?: Partial<Pick<RestorationRecord, 'caseId' | 'numberingSystem' | 'arch' | 'toothNumber' | 'morphologyId' | 'morphologyVersion' | 'materialProfileId' | 'materialProfileVersion' | 'materialProfileSnapshot' | 'adjacentObjectIds' | 'opposingObjectId' | 'preOpObjectId' | 'contourReferenceObjectIds' | 'referenceAdaptation' | 'thickness' | 'cementSpace' | 'seating' | 'mesialContact' | 'distalContact' | 'occlusion' | 'contour' | 'topologyMap' | 'parameters'>>;
}

export class CrownGeometryCommand extends RestorationGeometryBase {
  readonly metadata: CommandMetadata;
  constructor(context: RestorationCommandContext, private readonly restorationId: string, private readonly update: CrownGeometryUpdate) { super(context); this.metadata = metadata(`crown.${update.operation}`, update.label); }
  validate(): CommandValidation {
    const record = this.context.restorations.get().restorations.find((value) => value.id === this.restorationId); if (!record) return invalid(`Restoration ${this.restorationId} not found.`); if (record.approvalState === 'LOCKED') return invalid('Locked restoration geometry cannot be modified.');
    const object = record.sceneObjectId ? this.context.scene.get(record.sceneObjectId) : undefined; if (!object || object.locked) return invalid('Restoration scene object is missing or locked.'); if (!record.artifactId || !this.context.artifacts.get(record.artifactId)) return invalid('Active restoration artifact is missing.');
    try { const inspection = validateGeometryResult(indexedMesh(this.update.mesh)); if (!inspection.watertight || inspection.shellCount !== 1) return invalid('Crown edit did not produce one watertight restoration shell.'); }
    catch (error) { return invalid(error instanceof Error ? error.message : String(error)); }
    return valid();
  }
  async execute(): Promise<void> {
    if (this.afterArtifacts && this.afterScene && this.afterState) { this.redo(); return; }
    this.snapshotBefore(); const record = this.beforeState.restorations.find((value) => value.id === this.restorationId)!; const parent = this.context.artifacts.get(record.artifactId!)!; const createdAt = new Date().toISOString(); const versionNumber = record.versionIds.length + 1;
    const artifact = await crownArtifact(parent, this.update.mesh, `Crown #${record.toothNumber}`, this.update.operation, this.metadata.id, versionNumber, createdAt); const inspection = inspectGeometry(indexedMesh(artifact.mesh));
    const recordUpdate = structuredClone(this.update.analyses ?? {}); const version: RestorationVersion = { id: crypto.randomUUID(), restorationId: record.id, parentVersionId: record.activeVersionId, version: versionNumber, artifactId: artifact.id, operation: this.update.operation, commandId: this.metadata.id, branchId: record.activeBranchId, checkpointName: null, morphologyVersion: recordUpdate.morphologyVersion ?? record.morphologyVersion, materialProfileId: recordUpdate.materialProfileId ?? record.materialProfileId, materialProfileVersion: recordUpdate.materialProfileVersion ?? record.materialProfileVersion, marginVersionId: record.approvedMarginVersionId, parameters: structuredClone(this.update.parameters ?? {}), inspection, createdAt };
    const event = historyEvent(record.id, version.id, 'geometry-command', this.metadata.id, null, this.update.label, structuredClone(this.update.parameters ?? {}), createdAt);
    const nextRecord: RestorationRecord = { ...record, ...recordUpdate, artifactId: artifact.id, designVersion: versionNumber, versionIds: [...record.versionIds, version.id], activeVersionId: version.id, activeQcResultId: null, qcResultIds: [], exportRecordIds: [], historyEventIds: [...record.historyEventIds, event.id], approvalState: 'QC_REQUIRED', manufacturingState: 'QC_REQUIRED', approvedAt: null, approvedBy: null, updatedAt: createdAt };
    const scene = this.beforeScene.map((object) => object.id === record.sceneObjectId ? { ...object, artifactId: artifact.id, metadata: { ...object.metadata, restorationVersion: versionNumber, restorationOperation: this.update.operation } } : object);
    const state = { ...this.beforeState, restorations: this.beforeState.restorations.map((value) => value.id === record.id ? nextRecord : value), versions: [...this.beforeState.versions, version], historyEvents: [...this.beforeState.historyEvents, event], qcResults: this.beforeState.qcResults.filter((value) => value.restorationId !== record.id), exports: this.beforeState.exports.filter((value) => value.restorationId !== record.id) };
    this.commit([...this.beforeArtifacts, artifact], scene, state);
  }
}

export class CrownQcCommand extends RestorationStateCommand {
  constructor(manager: RestorationStateManager, restorationId: string, result: CrownQcResult) {
    const state = manager.get(); const record = state.restorations.find((value) => value.id === restorationId); if (!record) throw new Error(`Restoration ${restorationId} not found.`);
    const now = new Date().toISOString(); const event = historyEvent(record.id, record.activeVersionId, 'qc', null, null, `Crown QC completed with ${result.overall}.`, { qcResultId: result.id, failures: result.failureCount, warnings: result.warningCount }, now);
    const nextRecord: RestorationRecord = { ...record, qcResultIds: [...record.qcResultIds, result.id], activeQcResultId: result.id, historyEventIds: [...record.historyEventIds, event.id], approvalState: result.overall === 'fail' ? 'QC_FAILED' : 'REVIEW_REQUIRED', manufacturingState: result.overall === 'fail' ? 'QC_REQUIRED' : 'NOT_READY', approvedAt: null, approvedBy: null, updatedAt: now };
    super(manager, { ...state, restorations: state.restorations.map((value) => value.id === restorationId ? nextRecord : value), qcResults: [...state.qcResults, structuredClone(result)], historyEvents: [...state.historyEvents, event] }, 'crown.qc', `Run crown QC for tooth ${record.toothNumber}`);
  }
}

const transitions: Record<RestorationApprovalState, RestorationApprovalState[]> = {
  DESIGNING: ['QC_REQUIRED'], QC_REQUIRED: ['QC_FAILED', 'REVIEW_REQUIRED'], QC_FAILED: ['DESIGNING', 'QC_REQUIRED', 'QC_FAILED', 'REVIEW_REQUIRED'], REVIEW_REQUIRED: ['DESIGNING', 'QC_REQUIRED', 'QC_FAILED', 'APPROVED_FOR_EXPORT'],
  DRAFT: ['DESIGNING', 'PROPOSAL_GENERATED'], PROPOSAL_GENERATED: ['DESIGNING', 'TECHNICIAN_EDITED', 'QC_FAILED', 'QC_PASSED', 'QC_REQUIRED'], TECHNICIAN_EDITED: ['DESIGNING', 'QC_FAILED', 'QC_PASSED', 'QC_REQUIRED'], QC_PASSED: ['DESIGNING', 'QC_FAILED', 'QC_PASSED', 'REVIEW_REQUIRED', 'APPROVED_FOR_EXPORT'], APPROVED_FOR_EXPORT: ['LOCKED'], LOCKED: [],
};

export class CrownApprovalCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata; private previousState: RestorationProjectState; private previousScene: SceneObject[];
  constructor(private readonly context: RestorationCommandContext, private readonly restorationId: string, private readonly nextState: RestorationApprovalState, private readonly user: string | null) { this.metadata = metadata('crown.approval', `Set restoration ${nextState}`); this.previousState = context.restorations.get(); this.previousScene = context.scene.list(); }
  validate(): CommandValidation {
    const record = this.context.restorations.get().restorations.find((value) => value.id === this.restorationId); if (!record) return invalid(`Restoration ${this.restorationId} not found.`); if (!transitions[record.approvalState].includes(this.nextState)) return invalid(`Restoration cannot transition from ${record.approvalState} to ${this.nextState}.`);
    if (this.nextState === 'APPROVED_FOR_EXPORT') { const qc = record.activeQcResultId ? this.context.restorations.get().qcResults.find((value) => value.id === record.activeQcResultId) : undefined; if (!qc || qc.overall === 'fail' || qc.hardFailureCount || qc.failureCount) return invalid('APPROVED_FOR_EXPORT requires an active QC result with no failures.'); }
    if (this.nextState === 'LOCKED' && record.approvalState !== 'APPROVED_FOR_EXPORT') return invalid('Only an export-approved restoration may be locked.'); return valid();
  }
  execute(): void { this.previousState = this.context.restorations.get(); this.previousScene = this.context.scene.list(); this.apply(); }
  undo(): void { this.context.restorations.replace(this.previousState); this.context.scene.replace(this.previousScene); }
  redo(): void { this.apply(); }
  private apply(): void { const state = this.context.restorations.get(); const now = new Date().toISOString(); const record = state.restorations.find((value) => value.id === this.restorationId)!; const event = historyEvent(record.id, record.activeVersionId, 'approval', this.metadata.id, this.user, `Restoration transitioned from ${record.approvalState} to ${this.nextState}.`, { from: record.approvalState, to: this.nextState }, now); this.context.restorations.replace({ ...state, historyEvents: [...state.historyEvents, event], restorations: state.restorations.map((value) => value.id === record.id ? { ...value, approvalState: this.nextState, manufacturingState: this.nextState === 'LOCKED' ? 'LOCKED' : this.nextState === 'APPROVED_FOR_EXPORT' ? 'READY_FOR_EXPORT' : value.manufacturingState, historyEventIds: [...value.historyEventIds, event.id], approvedAt: this.nextState === 'APPROVED_FOR_EXPORT' || this.nextState === 'LOCKED' ? now : null, approvedBy: this.nextState === 'APPROVED_FOR_EXPORT' || this.nextState === 'LOCKED' ? this.user : null, locks: this.nextState === 'LOCKED' ? { margin: true, intaglio: true, mesialContact: true, distalContact: true, occlusion: true, facialContour: true, lingualContour: true, selectedAnatomy: true, anatomy: true } : value.locks, updatedAt: now } : value) }); if (record.sceneObjectId) this.context.scene.update(record.sceneObjectId, { locked: this.nextState === 'LOCKED' }); }
}

export class CrownExportRecordCommand extends RestorationStateCommand {
  constructor(manager: RestorationStateManager, restorationId: string, records: CrownExportRecord[]) {
    const state = manager.get(); const restoration = state.restorations.find((value) => value.id === restorationId); if (!restoration) throw new Error(`Restoration ${restorationId} not found.`); if (!restoration.activeVersionId) throw new Error('Restoration does not have an active immutable geometry version.'); if (records.some((record) => record.restorationId !== restorationId || record.versionId !== restoration.activeVersionId)) throw new Error('Export record lineage does not match the active restoration version.');
    const now = new Date().toISOString(); const event = historyEvent(restoration.id, restoration.activeVersionId, 'export', null, restoration.approvedBy, `Stored ${records.length} immutable manufacturing exports.`, { formats: records.map((record) => record.format).join(','), exportCount: records.length }, now);
    const nextRecord = { ...restoration, exportRecordIds: [...restoration.exportRecordIds, ...records.map((record) => record.id)], historyEventIds: [...restoration.historyEventIds, event.id], manufacturingState: 'EXPORTED' as const, updatedAt: now };
    super(manager, { ...state, restorations: state.restorations.map((value) => value.id === restorationId ? nextRecord : value), exports: [...state.exports, ...structuredClone(records)], historyEvents: [...state.historyEvents, event] }, 'crown.export.record', `Store ${records.length} immutable crown export records`);
  }
}

export class CrownCheckpointCommand extends RestorationStateCommand {
  constructor(manager: RestorationStateManager, restorationId: string, name: string) {
    const state = manager.get(); const record = state.restorations.find((value) => value.id === restorationId); if (!record?.activeVersionId) throw new Error('A named checkpoint requires an active restoration geometry version.'); const cleaned = name.trim(); if (!cleaned) throw new Error('Checkpoint name is required.'); if (record.approvalState === 'LOCKED') throw new Error('A locked final restoration cannot add a design checkpoint.');
    const now = new Date().toISOString(); const checkpoint: RestorationCheckpoint = { id: crypto.randomUUID(), restorationId, versionId: record.activeVersionId, name: cleaned, branchId: record.activeBranchId, createdAt: now }; const event = historyEvent(record.id, record.activeVersionId, 'checkpoint', null, null, `Created checkpoint ${cleaned}.`, { checkpointId: checkpoint.id, name: cleaned }, now);
    const nextRecord = { ...record, checkpointIds: [...record.checkpointIds, checkpoint.id], historyEventIds: [...record.historyEventIds, event.id], updatedAt: now };
    super(manager, { ...state, restorations: state.restorations.map((value) => value.id === record.id ? nextRecord : value), checkpoints: [...state.checkpoints, checkpoint], historyEvents: [...state.historyEvents, event] }, 'crown.history.checkpoint', `Create crown checkpoint ${cleaned}`);
  }
}

export class CrownRestoreVersionCommand extends RestorationGeometryBase {
  readonly metadata: CommandMetadata;
  constructor(context: RestorationCommandContext, private readonly restorationId: string, private readonly versionId: string) { super(context); this.metadata = metadata('crown.history.restore', `Restore crown version ${versionId}`); }
  validate(): CommandValidation {
    const state = this.context.restorations.get(); const record = state.restorations.find((value) => value.id === this.restorationId); const version = state.versions.find((value) => value.id === this.versionId && value.restorationId === this.restorationId);
    if (!record || !version) return invalid('Requested restoration version does not exist.'); if (record.approvalState === 'LOCKED') return invalid('A locked restoration cannot restore an earlier version.'); if (!this.context.artifacts.get(version.artifactId)) return invalid('Requested restoration-version artifact is unavailable.'); return valid();
  }
  execute(): void {
    if (this.afterArtifacts && this.afterScene && this.afterState) { this.redo(); return; } this.snapshotBefore(); const record = this.beforeState.restorations.find((value) => value.id === this.restorationId)!; const version = this.beforeState.versions.find((value) => value.id === this.versionId)!; const now = new Date().toISOString(); const event = historyEvent(record.id, version.id, 'restore', this.metadata.id, null, `Restored crown geometry version ${version.version}.`, { restoredVersion: version.version }, now);
    const nextRecord: RestorationRecord = { ...record, artifactId: version.artifactId, activeVersionId: version.id, activeBranchId: version.branchId, designVersion: version.version, activeQcResultId: null, qcResultIds: [], exportRecordIds: [], approvalState: 'QC_REQUIRED', manufacturingState: 'QC_REQUIRED', historyEventIds: [...record.historyEventIds, event.id], updatedAt: now };
    const scene = this.beforeScene.map((object) => object.id === record.sceneObjectId ? { ...object, artifactId: version.artifactId, metadata: { ...object.metadata, restorationVersion: version.version, restorationOperation: 'restore-version' } } : object); const state = { ...this.beforeState, restorations: this.beforeState.restorations.map((value) => value.id === record.id ? nextRecord : value), historyEvents: [...this.beforeState.historyEvents, event] };
    this.commit(this.beforeArtifacts, scene, state);
  }
}

export class CrownBranchCommand extends RestorationGeometryBase {
  readonly metadata: CommandMetadata;
  constructor(context: RestorationCommandContext, private readonly restorationId: string, private readonly operation: 'duplicate' | 'branch', private readonly label: string) { super(context); this.metadata = metadata(`crown.history.${operation}`, `${operation} crown design ${label}`); }
  validate(): CommandValidation {
    const state = this.context.restorations.get(); const source = state.restorations.find((value) => value.id === this.restorationId); if (!source?.activeVersionId) return invalid('A branch or duplicate requires an active restoration version.');
    if (!source.sceneObjectId || !this.context.scene.get(source.sceneObjectId)) return invalid('A branch or duplicate requires an active restoration scene object.'); if (!source.artifactId || !this.context.artifacts.get(source.artifactId)) return invalid('A branch or duplicate requires an immutable active geometry artifact.'); return valid();
  }
  execute(): void {
    if (this.afterArtifacts && this.afterScene && this.afterState) { this.redo(); return; } this.snapshotBefore(); const source = this.beforeState.restorations.find((value) => value.id === this.restorationId)!; const sourceObject = this.beforeScene.find((value) => value.id === source.sceneObjectId)!; const now = new Date().toISOString(); const branchId = crypto.randomUUID(); const nextId = crypto.randomUUID();
    const sourceVersions = source.versionIds.map((id) => this.beforeState.versions.find((value) => value.id === id)).filter((value): value is RestorationVersion => Boolean(value && value.version <= source.designVersion)); const versionIds = new Map(sourceVersions.map((value) => [value.id, crypto.randomUUID()]));
    const versions = sourceVersions.map((value) => ({ ...structuredClone(value), id: versionIds.get(value.id)!, restorationId: nextId, parentVersionId: value.parentVersionId ? versionIds.get(value.parentVersionId) ?? null : null, branchId })); const activeVersionId = versionIds.get(source.activeVersionId!)!; const objectId = crypto.randomUUID();
    const object: SceneObject = { ...structuredClone(sourceObject), id: objectId, name: this.label, selected: true, locked: false, metadata: { ...structuredClone(sourceObject.metadata), restorationId: nextId, sourceRestorationId: source.id, branchId } };
    const event = historyEvent(nextId, activeVersionId, this.operation, this.metadata.id, null, `${this.operation === 'branch' ? 'Branched' : 'Duplicated'} restoration ${source.id} as ${this.label}.`, { sourceRestorationId: source.id, branchId, label: this.label }, now);
    const duplicate: RestorationRecord = { ...structuredClone(source), id: nextId, activeBranchId: branchId, sceneObjectId: objectId, versionIds: versions.map((value) => value.id), activeVersionId, historyEventIds: [event.id], checkpointIds: [], qcResultIds: [], activeQcResultId: null, exportRecordIds: [], approvalState: 'QC_REQUIRED', manufacturingState: 'QC_REQUIRED', approvedAt: null, approvedBy: null, createdAt: now, updatedAt: now };
    const scene = [...this.beforeScene.map((value) => ({ ...value, selected: false })), object]; const state = { ...this.beforeState, restorations: [...this.beforeState.restorations, duplicate], versions: [...this.beforeState.versions, ...versions], historyEvents: [...this.beforeState.historyEvents, event], activeRestorationId: duplicate.id }; this.commit(this.beforeArtifacts, scene, state);
  }
}

export function compareRestorationVersions(first: RestorationVersion, second: RestorationVersion) {
  if (first.restorationId !== second.restorationId) throw new Error('Only versions from the same restoration can be compared.');
  return {
    fromVersion: first.version, toVersion: second.version,
    vertexCountChange: second.inspection.vertexCount - first.inspection.vertexCount,
    triangleCountChange: second.inspection.triangleCount - first.inspection.triangleCount,
    surfaceAreaChangeMm2: second.inspection.surfaceAreaMm2 - first.inspection.surfaceAreaMm2,
    volumeChangeMm3: (second.inspection.volumeMm3 ?? 0) - (first.inspection.volumeMm3 ?? 0),
    watertightChanged: second.inspection.watertight !== first.inspection.watertight,
    parameterChanges: Object.fromEntries([...new Set([...Object.keys(first.parameters), ...Object.keys(second.parameters)])].flatMap((key) => first.parameters[key] === second.parameters[key] ? [] : [[key, { from: first.parameters[key] ?? null, to: second.parameters[key] ?? null }]])),
  };
}

async function crownArtifact(parent: ArtifactRecord, mesh: ArtifactRecord['mesh'], name: string, operation: string, commandId: string, version: number, createdAt: string): Promise<ArtifactRecord> {
  const inspection = inspectGeometry(indexedMesh(mesh)); const id = crypto.randomUUID(); const rootArtifactId = parent.derivedFrom?.rootArtifactId ?? parent.id;
  return {
    id, sourceName: `${name} [${operation} v${version}]`, sourceFormat: 'stl', checksum: await geometryChecksum(mesh), importedAt: createdAt, byteLength: geometryByteLength(mesh), units: 'mm', orientation: 'normalized',
    metadata: { restoration: true, derived: true, operation, version, rootArtifactId, parentArtifactId: parent.id, vertexCount: inspection.vertexCount, triangleCount: inspection.triangleCount, watertight: inspection.watertight },
    history: [...parent.history, { at: createdAt, action: 'derived-restoration-version', detail: `${operation}; parent=${parent.id}; command=${commandId}` }], mesh: structuredClone(mesh),
    derivedFrom: { rootArtifactId, parentArtifactId: parent.id, version, operationId: commandId, operation, createdAt, before: inspectGeometry(indexedMesh(parent.mesh)), after: inspection },
  };
}

async function geometryChecksum(mesh: ArtifactRecord['mesh']): Promise<string> { const source = mesh.sourceTopology ?? { positions: mesh.positions, indices: mesh.indices }; const bytes = new TextEncoder().encode(JSON.stringify(source)); const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; const digest = await crypto.subtle.digest('SHA-256', buffer); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''); }
function geometryByteLength(mesh: ArtifactRecord['mesh']): number { const source = mesh.sourceTopology ?? { positions: mesh.positions, indices: mesh.indices }; return (source.positions.length + source.indices.length) * 8; }
function numericParameters(parameters: CrownGenerationInput['parameters']): Record<string, number | string | boolean | null> { return Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, value])); }
function historyEvent(restorationId: string, versionId: string | null, type: RestorationHistoryEvent['type'], commandId: string | null, actor: string | null, reason: string, details: RestorationHistoryEvent['details'], createdAt: string): RestorationHistoryEvent { return { id: crypto.randomUUID(), restorationId, versionId, type, commandId, actor, reason, details, createdAt }; }
