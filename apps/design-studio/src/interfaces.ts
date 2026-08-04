import type {
  ArtifactKind,
  ArtifactRecord,
  CameraState,
  DesignProject,
  MeshData,
  MeshFormat,
  ProjectionMode,
  SceneObject,
} from './core';
import type { Bounds3 } from './geometry';
import type { MeasurementVisual, ProjectedPoint, SurfaceHit, ViewerOverlay } from './inspection-types';

export interface RuntimeMetric {
  name: string;
  durationMs: number;
  startedAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface IRenderer {
  setScene(objects: SceneObject[], artifacts: ArtifactRecord[]): void;
  setCamera(camera: CameraState): void;
  getCamera(): CameraState;
  fitToScreen(): void;
  fitObjects(objectIds?: string[]): void;
  resetCamera(): void;
  setProjection(projection: ProjectionMode): void;
  pick(clientX: number, clientY: number): SurfaceHit | null;
  projectWorld(position: [number, number, number]): ProjectedPoint;
  setMeasurementVisuals(visuals: MeasurementVisual[]): void;
  setValidationOverlays(overlays: ViewerOverlay[]): void;
  focusBounds(bounds: Bounds3): void;
  dispose(): void;
}

export interface ISceneManager {
  subscribe(listener: () => void): () => void;
  list(): SceneObject[];
  get(id: string): SceneObject | undefined;
  addFromArtifact(artifact: ArtifactRecord, kind?: ArtifactKind): SceneObject;
  update(id: string, patch: Partial<Omit<SceneObject, 'id' | 'artifactId'>>): void;
  remove(id: string): void;
  select(id: string | null, additive?: boolean): void;
  isolate(id: string | null): void;
  replace(objects: SceneObject[]): void;
}

export interface IProjectManager {
  save(project: DesignProject): DesignProject;
  saveAs(project: DesignProject, name: string): DesignProject;
  open(id: string): DesignProject;
  listRecent(): Array<Pick<DesignProject, 'id' | 'name' | 'updatedAt'>>;
  autoSave(project: DesignProject): void;
  recover(): DesignProject | null;
  clearRecovery(): void;
}

export interface IArtifactManager {
  list(): ArtifactRecord[];
  get(id: string): ArtifactRecord | undefined;
  importFile(file: File): Promise<ArtifactRecord>;
  replace(artifacts: ArtifactRecord[]): void;
}

export interface ImportRequest {
  file: File;
  units?: ArtifactRecord['units'];
  orientation?: ArtifactRecord['orientation'];
  allowDuplicate?: boolean;
}

export interface ImportResult {
  artifact: ArtifactRecord;
  duplicateOf?: string;
  metrics: RuntimeMetric[];
}

export interface IImporter {
  supports(format: MeshFormat): boolean;
  validate(request: ImportRequest, existing: ArtifactRecord[]): Promise<void>;
  import(request: ImportRequest, existing: ArtifactRecord[]): Promise<ImportResult>;
}

export interface ExportRequest {
  project: DesignProject;
  format: 'design-project-json';
}

export interface IExporter {
  export(request: ExportRequest): Promise<Blob>;
}

export type SelectionTarget =
  | { kind: 'object'; objectId: string }
  | { kind: 'sub-object'; objectId: string; component: 'vertex' | 'edge' | 'face'; indices: number[] };

export interface SelectionSnapshot {
  activeSet: string;
  sets: Record<string, SelectionTarget[]>;
}

export interface SelectionEvent {
  previous: SelectionSnapshot;
  current: SelectionSnapshot;
  reason: string;
}

export interface ISelectionEngine {
  subscribe(listener: (event: SelectionEvent) => void): () => void;
  getSnapshot(): SelectionSnapshot;
  select(target: SelectionTarget | null, additive?: boolean): void;
  createSet(name: string, targets?: SelectionTarget[]): void;
  activateSet(name: string): void;
  deleteSet(name: string): void;
  clear(): void;
  restore(snapshot: SelectionSnapshot): void;
}

export interface CommandMetadata {
  id: string;
  type: string;
  label: string;
  createdAt: string;
  actor?: string;
  transactionId?: string;
  tags?: string[];
}

export interface CommandValidation {
  valid: boolean;
  errors: string[];
}

export interface RuntimeCommand {
  readonly metadata: CommandMetadata;
  validate(): CommandValidation | Promise<CommandValidation>;
  execute(): void | Promise<void>;
  undo(): void | Promise<void>;
  redo?(): void | Promise<void>;
}

export interface CommandHistoryEntry {
  metadata: CommandMetadata;
  executedAt: string;
  undoneAt?: string;
}

export interface ICommandBus {
  execute(command: RuntimeCommand): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  beginTransaction(label: string): string;
  commitTransaction(): void;
  rollbackTransaction(): Promise<void>;
  canUndo(): boolean;
  canRedo(): boolean;
  history(): CommandHistoryEntry[];
  subscribe(listener: () => void): () => void;
}

export interface IHistoryManager {
  push(command: RuntimeCommand): void;
  popUndo(): RuntimeCommand | undefined;
  popRedo(): RuntimeCommand | undefined;
  pushRedo(command: RuntimeCommand): void;
  clearRedo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  entries(): CommandHistoryEntry[];
}

// Compile-time structural checks for the immutable mesh contract used by importers.
export type ImportedMesh = Readonly<MeshData>;
