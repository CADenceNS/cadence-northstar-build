import type { ArtifactRecord, SceneObject, Transform } from './core';
import { buildTopology, faceArea, inspectGeometry, indexedMesh, meshData } from './editing-geometry';
import type { EditingStateManager } from './editing-state';
import type { GeometryOperationOutput, GeometryVersion, MeshComponentSelection, SurfaceCurve } from './editing-types';
import type { IArtifactManager, ISceneManager, RuntimeCommand, CommandMetadata, CommandValidation } from './interfaces';
import { transformPoint } from './geometry';
import { triangleQuality } from './topology-tools';

export interface GeometryCommandContext { scene: ISceneManager; artifacts: IArtifactManager; editing: EditingStateManager; }
export interface GeometryCommandOptions {
  allowBoundaries?: boolean;
  allowDisconnected?: boolean;
  replaceSource?: boolean;
  additionalNames?: string[];
  consumeObjectIds?: string[];
  toolParameters?: Record<string, number | string | boolean>;
  sceneObjectPatch?: Partial<Omit<SceneObject, 'id' | 'artifactId'>>;
  preserveComponentIds?: boolean;
  transformAssociatedPoints?: boolean;
}

export class GeometryEditCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata;
  private beforeArtifacts: ArtifactRecord[] = [];
  private beforeScene: SceneObject[] = [];
  private beforeEditing: ReturnType<EditingStateManager['get']>;
  private afterArtifacts: ArtifactRecord[] | null = null;
  private afterScene: SceneObject[] | null = null;
  private afterEditing: ReturnType<EditingStateManager['get']> | null = null;

  constructor(
    private readonly context: GeometryCommandContext,
    private readonly objectId: string,
    private readonly operation: string,
    private readonly output: GeometryOperationOutput,
    private readonly options: GeometryCommandOptions = {},
  ) {
    this.metadata = { id: crypto.randomUUID(), type: `geometry.${operation}`, label: operationLabel(operation), createdAt: new Date().toISOString(), tags: ['geometry', 'derived-artifact'] };
    this.beforeEditing = this.context.editing.get();
  }

  validate(): CommandValidation {
    const object = this.context.scene.get(this.objectId);
    if (!object) return invalid(`Scene object ${this.objectId} not found.`);
    if (object.locked) return invalid(`Locked object ${object.name} cannot be modified.`);
    const parent = this.context.artifacts.get(object.artifactId);
    if (!parent) return invalid(`Artifact ${object.artifactId} not found.`);
    for (const consumedId of this.options.consumeObjectIds ?? []) {
      const consumed = this.context.scene.get(consumedId);
      if (!consumed) return invalid(`Scene object ${consumedId} not found.`);
      if (consumed.locked) return invalid(`Locked object ${consumed.name} cannot be consumed by ${operationLabel(this.operation)}.`);
    }
    try {
      const before = this.output.beforeInspection ?? inspectGeometry(indexedMesh(parent.mesh));
      const policy = { allowBoundaries: Boolean(this.options.allowBoundaries) || before.boundaryEdgeCount > 0, allowDisconnected: Boolean(this.options.allowDisconnected) || before.shellCount > 1 };
      const mesh = indexedMesh(this.output.mesh);
      validatePreparedOutput(mesh, this.output.inspection, policy);
      for (const [index, additional] of (this.output.additionalMeshes ?? []).entries()) validatePreparedOutput(indexedMesh(additional), this.output.additionalInspections?.[index], policy);
      if (this.options.replaceSource !== false && JSON.stringify(parent.mesh) === JSON.stringify(this.output.mesh)) return invalid(`${operationLabel(this.operation)} did not change geometry.`);
    } catch (error) { return invalid(error instanceof Error ? error.message : String(error)); }
    return valid();
  }

  async execute(): Promise<void> {
    if (this.afterArtifacts && this.afterScene && this.afterEditing) { this.restore(this.afterArtifacts, this.afterScene, this.afterEditing); return; }
    this.beforeArtifacts = this.context.artifacts.list(); this.beforeScene = this.context.scene.list(); this.beforeEditing = this.context.editing.get();
    const object = this.context.scene.get(this.objectId)!; const parent = this.context.artifacts.get(object.artifactId)!; const createdAt = new Date().toISOString();
    const rootArtifactId = parent.derivedFrom?.rootArtifactId ?? parent.id;
    const version = this.beforeArtifacts.filter((artifact) => artifact.id === rootArtifactId || artifact.derivedFrom?.rootArtifactId === rootArtifactId).length;
    const before = this.output.beforeInspection ?? inspectGeometry(indexedMesh(parent.mesh)); const after = this.output.inspection;
    const primary = await derivedArtifact(parent, this.output.mesh, this.operation, this.metadata.id, rootArtifactId, version, before, after, createdAt);
    const additional = await Promise.all((this.output.additionalMeshes ?? []).map(async (mesh, index) => derivedArtifact(parent, mesh, `${this.operation}.part-${index + 2}`, this.metadata.id, rootArtifactId, version + index + 1, before, this.output.additionalInspections?.[index] ?? inspectGeometry(indexedMesh(mesh)), createdAt, this.options.additionalNames?.[index])));
    const nextArtifacts = [...this.beforeArtifacts, primary, ...additional];
    const consumedObjectIds = new Set(this.options.consumeObjectIds ?? []);
    const nextScene = this.beforeScene
      .filter((value) => !consumedObjectIds.has(value.id))
      .map((value) => value.id === object.id && this.options.replaceSource !== false ? { ...value, ...structuredClone(this.options.sceneObjectPatch ?? {}), artifactId: primary.id, metadata: { ...value.metadata, ...structuredClone(this.options.sceneObjectPatch?.metadata ?? {}), geometryVersion: version, rootArtifactId } } : value);
    if (this.options.replaceSource === false) nextScene.push(sceneFromDerived(object, primary, `${object.name} copy`));
    additional.forEach((artifact, index) => nextScene.push(sceneFromDerived(object, artifact, this.options.additionalNames?.[index] ?? `${object.name} part ${index + 2}`)));
    const versionRecord: GeometryVersion = { id: crypto.randomUUID(), rootArtifactId, parentArtifactId: parent.id, derivedArtifactId: primary.id, operationId: this.metadata.id, operation: this.operation, createdAt, before, after, beforeQuality: this.output.beforeQuality ?? triangleQuality(indexedMesh(parent.mesh)), afterQuality: this.output.quality ?? triangleQuality(indexedMesh(this.output.mesh)) };
    const editing = this.context.editing.get();
    const retainedSelections = editing.componentSelections.filter((selection) => !consumedObjectIds.has(selection.objectId));
    const componentSelections = this.options.replaceSource === false ? retainedSelections : remapSelections(retainedSelections, object, primary, this.output, this.options.preserveComponentIds ?? false);
    const curves = editing.curves.filter((curve) => !curve.objectId || !consumedObjectIds.has(curve.objectId)).map((curve) => {
      if (this.options.replaceSource === false || curve.objectId !== object.id || curve.artifactId !== parent.id) return curve;
      const controlPoints = this.options.transformAssociatedPoints ? curve.controlPoints.map((point) => transformPoint(point, object)) : curve.controlPoints;
      const sampledPoints = this.options.transformAssociatedPoints ? curve.sampledPoints.map((point) => transformPoint(point, object)) : curve.sampledPoints;
      return { ...curve, artifactId: primary.id, controlPoints, sampledPoints, updatedAt: createdAt };
    });
    const afterEditing = { ...editing, componentSelections, curves, toolSettings: this.options.toolParameters ? { ...editing.toolSettings, [this.operation]: structuredClone(this.options.toolParameters) } : editing.toolSettings, geometryVersions: [...editing.geometryVersions, versionRecord] };
    this.afterArtifacts = structuredClone(nextArtifacts); this.afterScene = structuredClone(nextScene); this.afterEditing = structuredClone(afterEditing);
    this.restore(nextArtifacts, nextScene, afterEditing);
  }

  undo(): void { this.restore(this.beforeArtifacts, this.beforeScene, this.beforeEditing); }
  redo(): void { if (!this.afterArtifacts || !this.afterScene || !this.afterEditing) throw new Error('Geometry command has not executed.'); this.restore(this.afterArtifacts, this.afterScene, this.afterEditing); }
  private restore(artifacts: ArtifactRecord[], scene: SceneObject[], editing: ReturnType<EditingStateManager['get']>): void { this.context.artifacts.replace(artifacts); this.context.scene.replace(scene); this.context.editing.replace(editing); }
}

export class EditingStateCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata;
  private previous: ReturnType<EditingStateManager['get']>;
  constructor(private readonly manager: EditingStateManager, private readonly next: ReturnType<EditingStateManager['get']>, type: string, label: string) { this.previous = manager.get(); this.metadata = { id: crypto.randomUUID(), type, label, createdAt: new Date().toISOString(), tags: ['editing-state'] }; }
  validate(): CommandValidation { return valid(); }
  execute(): void { this.previous = this.manager.get(); this.manager.replace(this.next); }
  undo(): void { this.manager.replace(this.previous); }
}

export class CurveStateCommand extends EditingStateCommand {
  static add(manager: EditingStateManager, curve: SurfaceCurve): CurveStateCommand { const state = manager.get(); if (state.curves.some((value) => value.id === curve.id)) throw new Error(`Curve ${curve.id} already exists.`); return new CurveStateCommand(manager, { ...state, curves: [...state.curves, structuredClone(curve)] }, 'curve.add', `Add ${curve.name}`); }
  static update(manager: EditingStateManager, curve: SurfaceCurve): CurveStateCommand { const state = manager.get(); if (!state.curves.some((value) => value.id === curve.id)) throw new Error(`Curve ${curve.id} not found.`); return new CurveStateCommand(manager, { ...state, curves: state.curves.map((value) => value.id === curve.id ? structuredClone(curve) : value) }, 'curve.update', `Update ${curve.name}`); }
  static remove(manager: EditingStateManager, curveId: string): CurveStateCommand { const state = manager.get(); const curve = state.curves.find((value) => value.id === curveId); if (!curve) throw new Error(`Curve ${curveId} not found.`); return new CurveStateCommand(manager, { ...state, curves: state.curves.filter((value) => value.id !== curveId) }, 'curve.delete', `Delete ${curve.name}`); }
}

export class TransformEditCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata;
  private beforeTransform: Transform | null = null;
  private beforeEditing: ReturnType<EditingStateManager['get']> | null = null;
  constructor(private readonly scene: ISceneManager, private readonly editing: EditingStateManager, private readonly objectId: string, private readonly after: Transform, private readonly toolId: string, label: string, private readonly parameters: Record<string, number | string | boolean>) {
    this.metadata = { id: crypto.randomUUID(), type: toolId, label, createdAt: new Date().toISOString(), tags: ['transform', 'editing-state'] };
  }
  validate(): CommandValidation {
    const object = this.scene.get(this.objectId); if (!object) return invalid(`Scene object ${this.objectId} not found.`); if (object.locked) return invalid(`Locked object ${object.name} cannot be transformed.`);
    const values = [...this.after.position, ...this.after.rotation, ...this.after.scale]; if (!values.every(Number.isFinite) || this.after.scale.some((value) => Math.abs(value) < 1e-9)) return invalid('Transform command requires finite, non-collapsing numeric values.'); if (Math.abs(Math.hypot(...this.after.rotation) - 1) > 1e-6) return invalid('Transform command requires a normalized rotation quaternion.'); return valid();
  }
  execute(): void {
    const object = this.scene.get(this.objectId)!;
    if (!this.beforeTransform) { this.beforeTransform = structuredClone(object.transform); this.beforeEditing = this.editing.get(); }
    this.scene.update(this.objectId, { transform: structuredClone(this.after) }); const state = this.editing.get(); this.editing.replace({ ...state, toolSettings: { ...state.toolSettings, [this.toolId]: structuredClone(this.parameters) } });
  }
  undo(): void { if (!this.beforeTransform || !this.beforeEditing) return; this.scene.update(this.objectId, { transform: structuredClone(this.beforeTransform) }); this.editing.replace(this.beforeEditing); }
  redo(): void { this.scene.update(this.objectId, { transform: structuredClone(this.after) }); const state = this.editing.get(); this.editing.replace({ ...state, toolSettings: { ...state.toolSettings, [this.toolId]: structuredClone(this.parameters) } }); }
}

async function derivedArtifact(parent: ArtifactRecord, mesh: ArtifactRecord['mesh'], operation: string, operationId: string, rootArtifactId: string, version: number, before: ReturnType<typeof inspectGeometry>, after: ReturnType<typeof inspectGeometry>, createdAt: string, name?: string): Promise<ArtifactRecord> {
  const id = crypto.randomUUID(); const checksum = await geometryChecksum(mesh);
  return {
    ...structuredClone(parent), id, sourceName: name ?? `${baseName(parent.sourceName)} [${operation} v${version}]`, checksum, importedAt: createdAt, byteLength: geometryByteLength(mesh), metadata: { ...parent.metadata, derived: true, geometryVersion: version, rootArtifactId, parentArtifactId: parent.id, operation },
    history: [...parent.history, { at: createdAt, action: 'derived-geometry-version', detail: `${operation}; parent=${parent.id}; operation=${operationId}` }], mesh: structuredClone(mesh),
    derivedFrom: { rootArtifactId, parentArtifactId: parent.id, version, operationId, operation, createdAt, before, after },
  };
}

function sceneFromDerived(source: SceneObject, artifact: ArtifactRecord, name: string): SceneObject { return { ...structuredClone(source), id: crypto.randomUUID(), artifactId: artifact.id, name, selected: false, isolated: false, metadata: { ...source.metadata, rootArtifactId: artifact.derivedFrom?.rootArtifactId ?? artifact.id, geometryVersion: artifact.derivedFrom?.version ?? 1 } }; }

function remapSelections(values: MeshComponentSelection[], object: SceneObject, artifact: ArtifactRecord, output: GeometryOperationOutput, preserveIds: boolean): MeshComponentSelection[] {
  const mesh = indexedMesh(artifact.mesh); const topology = buildTopology(mesh);
  return values.flatMap((selection) => {
    if (selection.objectId !== object.id || selection.artifactId !== object.artifactId) return selection;
    const count = selection.kind === 'vertex' ? mesh.positions.length : selection.kind === 'edge' ? topology.edges.length : selection.kind === 'face' ? mesh.faces.length : Infinity;
    const map = selection.kind === 'vertex' ? output.elementMap?.vertices : selection.kind === 'edge' ? output.elementMap?.edges : selection.kind === 'face' ? output.elementMap?.faces : undefined;
    if (!map && !preserveIds) return [];
    const ids = selection.ids.flatMap((id) => map?.[id] !== undefined ? [map[id]] : id < count ? [id] : []);
    return { ...selection, artifactId: artifact.id, ids, updatedAt: new Date().toISOString() };
  });
}

async function geometryChecksum(mesh: ArtifactRecord['mesh']): Promise<string> { const source = mesh.sourceTopology ?? { positions: mesh.positions, indices: mesh.indices }; const bytes = new TextEncoder().encode(JSON.stringify(source)); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''); }
function geometryByteLength(mesh: ArtifactRecord['mesh']): number { const source = mesh.sourceTopology ?? { positions: mesh.positions, indices: mesh.indices }; return (source.positions.length + source.indices.length) * 8; }
function baseName(name: string): string { return name.replace(/\s+\[[^\]]+\]$/, ''); }
function operationLabel(value: string): string { return value.split(/[.-]/).map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(' '); }
function valid(): CommandValidation { return { valid: true, errors: [] }; }
function invalid(...errors: string[]): CommandValidation { return { valid: false, errors }; }

export function operationOutput(mesh: ReturnType<typeof indexedMesh>, additional: ReturnType<typeof indexedMesh>[] = [], warnings: string[] = []): GeometryOperationOutput {
  const data = meshData(mesh); const inspection = inspectGeometry(mesh); const quality = triangleQuality(mesh); return { mesh: data, additionalMeshes: additional.map(meshData), beforeInspection: inspection, inspection, additionalInspections: additional.map(inspectGeometry), beforeQuality: quality, quality, additionalQualities: additional.map(triangleQuality), bounds: data.bounds, warnings };
}

function validatePreparedOutput(mesh: ReturnType<typeof indexedMesh>, inspection: GeometryOperationOutput['inspection'] | undefined, policy: { allowBoundaries: boolean; allowDisconnected: boolean }): void {
  if (!inspection) throw new Error('Geometry command is missing worker inspection evidence.'); if (!mesh.positions.length || !mesh.faces.length) throw new Error('Geometry operation produced empty output.'); const degenerate = mesh.faces.filter((face) => new Set(face).size < 3 || faceArea(mesh, face) <= 1e-9).length; if (degenerate) throw new Error(`Geometry operation produced ${degenerate} degenerate triangle${degenerate === 1 ? '' : 's'}.`);
  const topology = buildTopology(mesh); if (topology.nonManifoldEdges.length || inspection.nonManifoldEdgeCount !== topology.nonManifoldEdges.length) throw new Error(`Geometry operation produced ${topology.nonManifoldEdges.length} non-manifold edge${topology.nonManifoldEdges.length === 1 ? '' : 's'}.`); if (!policy.allowBoundaries && topology.boundaryEdges.length) throw new Error(`Geometry operation produced ${topology.boundaryEdges.length} open boundary edge${topology.boundaryEdges.length === 1 ? '' : 's'}.`); if (!policy.allowDisconnected && topology.shells.length > 1) throw new Error(`Geometry operation produced ${topology.shells.length} disconnected components.`); if (inspection.vertexCount !== mesh.positions.length || inspection.triangleCount !== mesh.faces.length || inspection.boundaryEdgeCount !== topology.boundaryEdges.length || inspection.shellCount !== topology.shells.length) throw new Error('Geometry command inspection evidence does not match its indexed mesh.'); if (inspection.selfIntersectionCount) throw new Error(`Geometry operation produced ${inspection.selfIntersectionCount} self-intersecting triangle pair${inspection.selfIntersectionCount === 1 ? '' : 's'}.`);
}
