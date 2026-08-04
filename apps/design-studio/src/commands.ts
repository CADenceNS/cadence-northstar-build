import type { ArtifactRecord, CameraState, ProjectionMode, SceneObject } from './core';
import type { MutableCollectionStore } from './state-managers';
import type {
  CommandHistoryEntry,
  CommandMetadata,
  CommandValidation,
  IArtifactManager,
  ICommandBus,
  IHistoryManager,
  IRenderer,
  ISceneManager,
  RuntimeCommand,
} from './interfaces';

export interface RuntimeContext {
  scene: ISceneManager;
  artifacts: IArtifactManager;
  renderer: IRenderer;
}

function metadata(type: string, label: string, tags: string[] = []): CommandMetadata {
  return { id: crypto.randomUUID(), type, label, createdAt: new Date().toISOString(), tags };
}

const valid = (): CommandValidation => ({ valid: true, errors: [] });
const invalid = (...errors: string[]): CommandValidation => ({ valid: false, errors });

export class HistoryManager implements IHistoryManager {
  private undoStack: RuntimeCommand[] = [];
  private redoStack: RuntimeCommand[] = [];
  private records: CommandHistoryEntry[] = [];

  push(command: RuntimeCommand): void {
    this.undoStack.push(command);
    this.records.push({ metadata: structuredClone(command.metadata), executedAt: new Date().toISOString() });
  }
  popUndo(): RuntimeCommand | undefined { return this.undoStack.pop(); }
  popRedo(): RuntimeCommand | undefined { return this.redoStack.pop(); }
  pushRedo(command: RuntimeCommand): void { this.redoStack.push(command); }
  clearRedo(): void { this.redoStack = []; }
  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  entries(): CommandHistoryEntry[] { return structuredClone(this.records); }
  markUndone(command: RuntimeCommand): void {
    const entry = [...this.records].reverse().find((item) => item.metadata.id === command.metadata.id && !item.undoneAt);
    if (entry) entry.undoneAt = new Date().toISOString();
  }
  restoreUndo(command: RuntimeCommand): void { this.undoStack.push(command); }
}

export class CommandBus implements ICommandBus {
  private readonly listeners = new Set<() => void>();
  private transaction?: { id: string; label: string; commands: RuntimeCommand[] };

  constructor(private readonly historyManager: HistoryManager = new HistoryManager()) {}

  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private changed(): void { this.listeners.forEach((listener) => listener()); }

  async execute(command: RuntimeCommand): Promise<void> {
    const validation = await command.validate();
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    if (this.transaction && !command.metadata.transactionId) command.metadata.transactionId = this.transaction.id;
    await command.execute();
    this.historyManager.push(command);
    this.historyManager.clearRedo();
    if (this.transaction) this.transaction.commands.push(command);
    this.changed();
  }

  async undo(): Promise<void> {
    const command = this.historyManager.popUndo();
    if (!command) return;
    await command.undo();
    this.historyManager.markUndone(command);
    this.historyManager.pushRedo(command);
    this.changed();
  }

  async redo(): Promise<void> {
    const command = this.historyManager.popRedo();
    if (!command) return;
    if (command.redo) await command.redo(); else await command.execute();
    this.historyManager.restoreUndo(command);
    this.changed();
  }

  beginTransaction(label: string): string {
    if (this.transaction) throw new Error('A command transaction is already active');
    const id = crypto.randomUUID();
    this.transaction = { id, label, commands: [] };
    return id;
  }

  commitTransaction(): void {
    if (!this.transaction) throw new Error('No active command transaction');
    this.transaction = undefined;
    this.changed();
  }

  async rollbackTransaction(): Promise<void> {
    const transaction = this.transaction;
    if (!transaction) throw new Error('No active command transaction');
    for (const command of [...transaction.commands].reverse()) await command.undo();
    this.transaction = undefined;
    this.changed();
  }

  canUndo(): boolean { return this.historyManager.canUndo(); }
  canRedo(): boolean { return this.historyManager.canRedo(); }
  history(): CommandHistoryEntry[] { return this.historyManager.entries(); }
}

abstract class BaseCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata;
  protected constructor(type: string, label: string, tags: string[] = []) { this.metadata = metadata(type, label, tags); }
  validate(): CommandValidation | Promise<CommandValidation> { return valid(); }
  abstract execute(): void | Promise<void>;
  abstract undo(): void | Promise<void>;
}

export class ImportArtifactCommand extends BaseCommand {
  private addedObject?: SceneObject;
  private previousArtifacts: ArtifactRecord[] = [];
  constructor(private readonly context: RuntimeContext, private readonly artifact: ArtifactRecord) { super('artifact.import', `Import ${artifact.sourceName}`, ['artifact', 'scene']); }
  validate(): CommandValidation { return this.context.artifacts.get(this.artifact.id) ? invalid('Artifact already exists') : valid(); }
  execute(): void {
    this.previousArtifacts = this.context.artifacts.list();
    this.context.artifacts.replace([...this.previousArtifacts, structuredClone(this.artifact)]);
    this.addedObject = this.context.scene.addFromArtifact(this.artifact);
  }
  undo(): void {
    if (this.addedObject) this.context.scene.remove(this.addedObject.id);
    this.context.artifacts.replace(this.previousArtifacts);
  }
}

export class DeleteArtifactCommand extends BaseCommand {
  private previousArtifacts: ArtifactRecord[] = [];
  private previousScene: SceneObject[] = [];
  constructor(private readonly context: RuntimeContext, private readonly artifactId: string) { super('artifact.delete', 'Delete artifact', ['artifact', 'scene']); }
  validate(): CommandValidation {
    if (!this.context.artifacts.get(this.artifactId)) return invalid(`Artifact ${this.artifactId} not found`);
    const locked = this.context.scene.list().find((object) => object.artifactId === this.artifactId && object.locked);
    return locked ? invalid(`Locked object ${locked.name} cannot be deleted`) : valid();
  }
  execute(): void {
    this.previousArtifacts = this.context.artifacts.list();
    this.previousScene = this.context.scene.list();
    this.context.artifacts.replace(this.previousArtifacts.filter((artifact) => artifact.id !== this.artifactId));
    this.context.scene.replace(this.previousScene.filter((object) => object.artifactId !== this.artifactId));
  }
  undo(): void { this.context.artifacts.replace(this.previousArtifacts); this.context.scene.replace(this.previousScene); }
}

export class ToggleVisibilityCommand extends BaseCommand {
  private previous = true;
  constructor(private readonly scene: ISceneManager, private readonly objectId: string) { super('scene.visibility.toggle', 'Toggle visibility', ['scene']); }
  validate(): CommandValidation { return this.scene.get(this.objectId) ? valid() : invalid(`Scene object ${this.objectId} not found`); }
  execute(): void { const object = this.scene.get(this.objectId)!; this.previous = object.visible; this.scene.update(this.objectId, { visible: !object.visible }); }
  undo(): void { this.scene.update(this.objectId, { visible: this.previous }); }
}

export class IsolateCommand extends BaseCommand {
  private previous: SceneObject[] = [];
  constructor(private readonly scene: ISceneManager, private readonly objectId: string) { super('scene.isolate', 'Isolate object', ['scene']); }
  validate(): CommandValidation { return this.scene.get(this.objectId) ? valid() : invalid(`Scene object ${this.objectId} not found`); }
  execute(): void { this.previous = this.scene.list(); this.scene.isolate(this.objectId); }
  undo(): void { this.scene.replace(this.previous); }
}

export class RestoreVisibilityCommand extends BaseCommand {
  private previous: SceneObject[] = [];
  constructor(private readonly scene: ISceneManager) { super('scene.visibility.restore', 'Restore visibility', ['scene']); }
  execute(): void { this.previous = this.scene.list(); this.scene.isolate(null); }
  undo(): void { this.scene.replace(this.previous); }
}

export class CameraResetCommand extends BaseCommand {
  private previous?: CameraState;
  constructor(private readonly renderer: IRenderer) { super('camera.reset', 'Reset camera', ['camera']); }
  execute(): void { this.previous = this.renderer.getCamera(); this.renderer.resetCamera(); }
  undo(): void { if (this.previous) this.renderer.setCamera(this.previous); }
}

export class ProjectionChangeCommand extends BaseCommand {
  private previous?: ProjectionMode;
  constructor(private readonly renderer: IRenderer, private readonly projection: ProjectionMode) { super('camera.projection.change', `Set ${projection} projection`, ['camera']); }
  execute(): void { this.previous = this.renderer.getCamera().projection; this.renderer.setProjection(this.projection); }
  undo(): void { if (this.previous) this.renderer.setProjection(this.previous); }
}

export class SceneObjectUpdateCommand extends BaseCommand {
  private previous?: SceneObject;
  constructor(
    private readonly scene: ISceneManager,
    private readonly objectId: string,
    private readonly patch: Partial<Omit<SceneObject, 'id' | 'artifactId'>>,
    label = 'Update scene object',
    private readonly transformRelated = false,
  ) { super('scene.object.update', label, ['scene']); }
  validate(): CommandValidation {
    const object = this.scene.get(this.objectId);
    if (!object) return invalid(`Scene object ${this.objectId} not found`);
    if (object.locked && (this.transformRelated || this.patch.transform !== undefined)) return invalid(`Locked object ${object.name} cannot be transformed`);
    return valid();
  }
  execute(): void { this.previous = this.scene.get(this.objectId); this.scene.update(this.objectId, this.patch); }
  undo(): void {
    if (!this.previous) return;
    const { id: _id, artifactId: _artifactId, ...previous } = this.previous;
    this.scene.update(this.objectId, previous);
  }
}

export class FitObjectsCommand extends BaseCommand {
  private previous?: CameraState;
  constructor(private readonly renderer: IRenderer, private readonly objectIds?: string[]) { super('camera.fit', objectIds?.length ? 'Fit selected' : 'Fit all', ['camera']); }
  execute(): void { this.previous = this.renderer.getCamera(); this.renderer.fitObjects(this.objectIds); }
  undo(): void { if (this.previous) this.renderer.setCamera(this.previous); }
}

export class CameraViewCommand extends BaseCommand {
  private previous?: CameraState;
  constructor(private readonly renderer: IRenderer, private readonly camera: CameraState, label: string) { super('camera.view.change', label, ['camera']); }
  execute(): void { this.previous = this.renderer.getCamera(); this.renderer.setCamera(this.camera); }
  undo(): void { if (this.previous) this.renderer.setCamera(this.previous); }
}

export class AddCollectionRecordCommand<T extends { id: string }> extends BaseCommand {
  constructor(private readonly store: MutableCollectionStore<T>, private readonly value: T, type: string, label: string) { super(type, label); }
  validate(): CommandValidation { return this.store.get(this.value.id) ? invalid(`Record ${this.value.id} already exists`) : valid(); }
  execute(): void { this.store.add(this.value); }
  undo(): void { this.store.remove(this.value.id); }
}

export class UpdateCollectionRecordCommand<T extends { id: string }> extends BaseCommand {
  private previous?: T;
  constructor(private readonly store: MutableCollectionStore<T>, private readonly id: string, private readonly patch: Partial<Omit<T, 'id'>>, type: string, label: string) { super(type, label); }
  validate(): CommandValidation { return this.store.get(this.id) ? valid() : invalid(`Record ${this.id} not found`); }
  execute(): void { this.previous = this.store.get(this.id); this.store.update(this.id, this.patch); }
  undo(): void { if (this.previous) this.store.replace(this.store.list().map((value) => value.id === this.id ? this.previous! : value)); }
}

export class DeleteCollectionRecordCommand<T extends { id: string }> extends BaseCommand {
  private previous?: T;
  constructor(private readonly store: MutableCollectionStore<T>, private readonly id: string, type: string, label: string) { super(type, label); }
  validate(): CommandValidation { return this.store.get(this.id) ? valid() : invalid(`Record ${this.id} not found`); }
  execute(): void { this.previous = this.store.get(this.id); this.store.remove(this.id); }
  undo(): void { if (this.previous) this.store.add(this.previous); }
}
