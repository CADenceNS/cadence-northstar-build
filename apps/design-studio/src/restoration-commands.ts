import type { ArtifactRecord, SceneObject } from './core';
import { indexedMesh, inspectGeometry, validateGeometryResult } from './editing-geometry';
import type { IArtifactManager, ISceneManager, RuntimeCommand, CommandMetadata, CommandValidation } from './interfaces';
import type { RestorationStateManager } from './restoration-state';
import type {
  CrownExportRecord,
  CrownGenerationInput,
  CrownGenerationResult,
  CrownQcResult,
  RestorationApprovalState,
  RestorationProjectState,
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
    const version: RestorationVersion = { id: crypto.randomUUID(), restorationId, parentVersionId: null, version: 1, artifactId: artifact.id, operation: 'crown-proposal', commandId: this.metadata.id, parameters: numericParameters(this.input.parameters), inspection: this.result.inspection, createdAt };
    const record: RestorationRecord = {
      id: restorationId, preparationId: this.input.preparationId, preparationVersionId: this.lineage.preparationVersionId, approvedMarginVersionId: this.lineage.approvedMarginVersionId, insertionAxisAnalysisId: this.lineage.insertionAxisAnalysisId,
      toothNumber: this.input.toothNumber, morphologyId: this.input.parameters.morphologyId, morphologyVersion: this.beforeState.morphologyVersion, materialProfileId: this.input.materialProfileId,
      artifactId: artifact.id, sceneObjectId: object.id, parameters: structuredClone(this.input.parameters), locks: { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, anatomy: false }, topologyMap: structuredClone(this.result.topologyMap),
      thickness: structuredClone(this.result.thickness), cementSpace: structuredClone(this.result.cementSpace), seating: structuredClone(this.result.seating), mesialContact: structuredClone(this.result.mesialContact), distalContact: structuredClone(this.result.distalContact), occlusion: structuredClone(this.result.occlusion), contour: structuredClone(this.result.contour),
      qcResultIds: [], activeQcResultId: null, versionIds: [version.id], activeVersionId: version.id, exportRecordIds: [], approvalState: 'PROPOSAL_GENERATED', approvedAt: null, approvedBy: null, createdAt, updatedAt: createdAt,
    };
    const scene = [...this.beforeScene.map((value) => ({ ...value, selected: false })), object]; const state = { ...this.beforeState, restorations: [...this.beforeState.restorations, record], versions: [...this.beforeState.versions, version], activeRestorationId: restorationId };
    this.commit([...this.beforeArtifacts, artifact], scene, state);
  }
}

export interface CrownGeometryUpdate {
  mesh: ArtifactRecord['mesh'];
  operation: string;
  label: string;
  parameters?: Record<string, number | string | boolean | null>;
  analyses?: Partial<Pick<RestorationRecord, 'thickness' | 'cementSpace' | 'seating' | 'mesialContact' | 'distalContact' | 'occlusion' | 'contour' | 'topologyMap' | 'parameters'>>;
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
    const version: RestorationVersion = { id: crypto.randomUUID(), restorationId: record.id, parentVersionId: record.activeVersionId, version: versionNumber, artifactId: artifact.id, operation: this.update.operation, commandId: this.metadata.id, parameters: structuredClone(this.update.parameters ?? {}), inspection, createdAt };
    const nextRecord: RestorationRecord = { ...record, ...structuredClone(this.update.analyses ?? {}), artifactId: artifact.id, versionIds: [...record.versionIds, version.id], activeVersionId: version.id, activeQcResultId: null, qcResultIds: [], exportRecordIds: [], approvalState: 'TECHNICIAN_EDITED', approvedAt: null, approvedBy: null, updatedAt: createdAt };
    const scene = this.beforeScene.map((object) => object.id === record.sceneObjectId ? { ...object, artifactId: artifact.id, metadata: { ...object.metadata, restorationVersion: versionNumber, restorationOperation: this.update.operation } } : object);
    const state = { ...this.beforeState, restorations: this.beforeState.restorations.map((value) => value.id === record.id ? nextRecord : value), versions: [...this.beforeState.versions, version], qcResults: this.beforeState.qcResults.filter((value) => value.restorationId !== record.id), exports: this.beforeState.exports.filter((value) => value.restorationId !== record.id) };
    this.commit([...this.beforeArtifacts, artifact], scene, state);
  }
}

export class CrownQcCommand extends RestorationStateCommand {
  constructor(manager: RestorationStateManager, restorationId: string, result: CrownQcResult) {
    const state = manager.get(); const record = state.restorations.find((value) => value.id === restorationId); if (!record) throw new Error(`Restoration ${restorationId} not found.`);
    const nextRecord: RestorationRecord = { ...record, qcResultIds: [...record.qcResultIds, result.id], activeQcResultId: result.id, approvalState: result.overall === 'fail' ? 'QC_FAILED' : 'QC_PASSED', approvedAt: null, approvedBy: null, updatedAt: new Date().toISOString() };
    super(manager, { ...state, restorations: state.restorations.map((value) => value.id === restorationId ? nextRecord : value), qcResults: [...state.qcResults, structuredClone(result)] }, 'crown.qc', `Run crown QC for tooth ${record.toothNumber}`);
  }
}

const transitions: Record<RestorationApprovalState, RestorationApprovalState[]> = {
  DRAFT: ['PROPOSAL_GENERATED'], PROPOSAL_GENERATED: ['TECHNICIAN_EDITED', 'QC_FAILED', 'QC_PASSED'], TECHNICIAN_EDITED: ['QC_FAILED', 'QC_PASSED'], QC_FAILED: ['TECHNICIAN_EDITED', 'QC_FAILED', 'QC_PASSED'], QC_PASSED: ['TECHNICIAN_EDITED', 'QC_FAILED', 'QC_PASSED', 'APPROVED_FOR_EXPORT'], APPROVED_FOR_EXPORT: ['LOCKED'], LOCKED: [],
};

export class CrownApprovalCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata; private previousState: RestorationProjectState; private previousScene: SceneObject[];
  constructor(private readonly context: RestorationCommandContext, private readonly restorationId: string, private readonly nextState: RestorationApprovalState, private readonly user: string | null) { this.metadata = metadata('crown.approval', `Set restoration ${nextState}`); this.previousState = context.restorations.get(); this.previousScene = context.scene.list(); }
  validate(): CommandValidation {
    const record = this.context.restorations.get().restorations.find((value) => value.id === this.restorationId); if (!record) return invalid(`Restoration ${this.restorationId} not found.`); if (!transitions[record.approvalState].includes(this.nextState)) return invalid(`Restoration cannot transition from ${record.approvalState} to ${this.nextState}.`);
    if (this.nextState === 'APPROVED_FOR_EXPORT') { const qc = record.activeQcResultId ? this.context.restorations.get().qcResults.find((value) => value.id === record.activeQcResultId) : undefined; if (!qc || qc.overall === 'fail' || qc.hardFailureCount) return invalid('APPROVED_FOR_EXPORT requires an active QC result with no hard failures.'); }
    if (this.nextState === 'LOCKED' && record.approvalState !== 'APPROVED_FOR_EXPORT') return invalid('Only an export-approved restoration may be locked.'); return valid();
  }
  execute(): void { this.previousState = this.context.restorations.get(); this.previousScene = this.context.scene.list(); this.apply(); }
  undo(): void { this.context.restorations.replace(this.previousState); this.context.scene.replace(this.previousScene); }
  redo(): void { this.apply(); }
  private apply(): void { const state = this.context.restorations.get(); const now = new Date().toISOString(); const record = state.restorations.find((value) => value.id === this.restorationId)!; this.context.restorations.replace({ ...state, restorations: state.restorations.map((value) => value.id === record.id ? { ...value, approvalState: this.nextState, approvedAt: this.nextState === 'APPROVED_FOR_EXPORT' || this.nextState === 'LOCKED' ? now : null, approvedBy: this.nextState === 'APPROVED_FOR_EXPORT' || this.nextState === 'LOCKED' ? this.user : null, locks: this.nextState === 'LOCKED' ? { margin: true, intaglio: true, mesialContact: true, distalContact: true, occlusion: true, anatomy: true } : value.locks, updatedAt: now } : value) }); if (record.sceneObjectId) this.context.scene.update(record.sceneObjectId, { locked: this.nextState === 'LOCKED' }); }
}

export class CrownExportRecordCommand extends RestorationStateCommand {
  constructor(manager: RestorationStateManager, restorationId: string, records: CrownExportRecord[]) {
    const state = manager.get(); const restoration = state.restorations.find((value) => value.id === restorationId); if (!restoration) throw new Error(`Restoration ${restorationId} not found.`); if (!restoration.activeVersionId) throw new Error('Restoration does not have an active immutable geometry version.'); if (records.some((record) => record.restorationId !== restorationId || record.versionId !== restoration.activeVersionId)) throw new Error('Export record lineage does not match the active restoration version.');
    const nextRecord = { ...restoration, exportRecordIds: [...restoration.exportRecordIds, ...records.map((record) => record.id)], updatedAt: new Date().toISOString() };
    super(manager, { ...state, restorations: state.restorations.map((value) => value.id === restorationId ? nextRecord : value), exports: [...state.exports, ...structuredClone(records)] }, 'crown.export.record', `Store ${records.length} immutable crown export records`);
  }
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
