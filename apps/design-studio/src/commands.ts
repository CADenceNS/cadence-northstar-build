import type { ArtifactRecord, CameraState, ProjectionMode, SceneObject } from './core';
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
  validate(): CommandValidation { return this.context.artifacts.get(this.artifactId) ? valid() : invalid(`Artifact ${this.artifactId} not found`); }
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
