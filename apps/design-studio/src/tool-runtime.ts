import type { ICommandBus, RuntimeCommand } from './interfaces';
import type { ToolDefinition, ToolProgress, ToolRuntimeState } from './editing-types';

export interface ToolPointerEvent {
  type: 'down' | 'move' | 'up';
  clientX: number;
  clientY: number;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface ToolKeyboardEvent {
  type: 'down' | 'up';
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface ToolExecutor<Context, Preview> {
  definition: ToolDefinition;
  validate(context: Context, parameters: Record<string, number | string | boolean>): void | Promise<void>;
  preview(context: Context, parameters: Record<string, number | string | boolean>, signal: AbortSignal, progress: (value: ToolProgress) => void): Preview | Promise<Preview>;
  createCommand(context: Context, preview: Preview, parameters: Record<string, number | string | boolean>): RuntimeCommand | Promise<RuntimeCommand>;
  pointer?(context: Context, event: ToolPointerEvent, parameters: Record<string, number | string | boolean>): void | Promise<void>;
  keyboard?(context: Context, event: ToolKeyboardEvent, parameters: Record<string, number | string | boolean>): void | Promise<void>;
  cancel?(context: Context): void | Promise<void>;
}

export class ToolRuntime<Context, Preview = unknown> {
  private executors = new Map<string, ToolExecutor<Context, Preview>>();
  private state: ToolRuntimeState = { activeToolId: null, parameters: {}, phase: 'idle', progress: null, error: null };
  private previewValue: Preview | null = null;
  private controller: AbortController | null = null;
  private readonly listeners = new Set<(state: ToolRuntimeState, preview: Preview | null) => void>();

  constructor(private readonly commandBus: ICommandBus) {}

  register(executor: ToolExecutor<Context, Preview>): void {
    if (this.executors.has(executor.definition.id)) throw new Error(`Tool ${executor.definition.id} is already registered.`);
    this.executors.set(executor.definition.id, executor);
  }

  unregister(id: string): void { this.executors.delete(id); }

  definitions(): ToolDefinition[] { return [...this.executors.values()].map((executor) => structuredClone(executor.definition)); }
  getState(): ToolRuntimeState { return structuredClone(this.state); }
  getPreview(): Preview | null { return this.previewValue === null ? null : structuredClone(this.previewValue); }
  subscribe(listener: (state: ToolRuntimeState, preview: Preview | null) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async activate(id: string, context: Context, persisted: Record<string, number | string | boolean> = {}): Promise<void> {
    const executor = this.executors.get(id); if (!executor) throw new Error(`Tool ${id} is not registered.`);
    await this.cancel(context);
    const defaults = Object.fromEntries(executor.definition.parameters.map((parameter) => [parameter.id, parameter.defaultValue]));
    this.state = { activeToolId: id, parameters: { ...defaults, ...persisted }, phase: 'active', progress: null, error: null };
    try { await executor.validate(context, this.state.parameters); this.changed(); }
    catch (error) { this.fail(error); throw error; }
  }

  setParameter(id: string, value: number | string | boolean): void {
    const definition = this.activeExecutor()?.definition.parameters.find((parameter) => parameter.id === id);
    if (!definition) throw new Error(`Parameter ${id} is not defined for the active tool.`);
    if (definition.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || definition.min !== undefined && value < definition.min || definition.max !== undefined && value > definition.max)) throw new Error(`${definition.label} is outside its accepted numeric range.`);
    this.state.parameters[id] = value; this.previewValue = null; this.state.phase = 'active'; this.state.error = null; this.changed();
  }

  async preview(context: Context): Promise<Preview> {
    const executor = this.activeExecutor();
    this.controller?.abort(); const controller = new AbortController(); this.controller = controller; this.state.phase = 'previewing'; this.state.error = null; this.changed();
    try {
      await executor.validate(context, this.state.parameters);
      if (controller.signal.aborted || this.controller !== controller) throw new DOMException('Tool preview cancelled.', 'AbortError');
      const value = await executor.preview(context, structuredClone(this.state.parameters), controller.signal, (progress) => { if (this.controller !== controller) return; this.state.progress = structuredClone(progress); this.changed(); });
      if (controller.signal.aborted || this.controller !== controller) throw new DOMException('Tool preview cancelled.', 'AbortError');
      this.previewValue = structuredClone(value); this.state.phase = 'ready'; this.state.progress = null; this.changed(); return value;
    } catch (error) { if (isAbort(error)) { this.state.phase = 'active'; this.state.progress = null; this.changed(); } else this.fail(error); throw error; }
  }

  async confirm(context: Context): Promise<void> {
    const executor = this.activeExecutor();
    try {
      const preview = this.previewValue ?? await this.preview(context);
      this.state.phase = 'executing'; this.changed();
      const command = await executor.createCommand(context, preview, structuredClone(this.state.parameters));
      await this.commandBus.execute(command);
      this.previewValue = null; this.state.phase = 'active'; this.state.progress = null; this.state.error = null; this.changed();
    } catch (error) { this.fail(error); throw error; }
  }

  async cancel(context: Context): Promise<void> {
    this.controller?.abort(); this.controller = null;
    const executor = this.state.activeToolId ? this.executors.get(this.state.activeToolId) : undefined;
    if (executor?.cancel) await executor.cancel(context);
    this.previewValue = null; this.state = { activeToolId: null, parameters: {}, phase: 'idle', progress: null, error: null }; this.changed();
  }

  async handlePointer(context: Context, event: ToolPointerEvent): Promise<void> { const executor = this.activeExecutor(); if (executor.pointer) await executor.pointer(context, event, this.state.parameters); }
  async handleKeyboard(context: Context, event: ToolKeyboardEvent): Promise<void> {
    if (event.type === 'down' && event.key === 'Escape') { await this.cancel(context); return; }
    if (event.type === 'down' && event.key === 'Enter' && this.state.phase === 'ready') { await this.confirm(context); return; }
    const executor = this.activeExecutor(); if (executor.keyboard) await executor.keyboard(context, event, this.state.parameters);
  }

  private activeExecutor(): ToolExecutor<Context, Preview> {
    const executor = this.state.activeToolId ? this.executors.get(this.state.activeToolId) : undefined;
    if (!executor) throw new Error('Activate a tool before using the tool runtime.'); return executor;
  }
  private fail(error: unknown): void { this.state.phase = 'error'; this.state.progress = null; this.state.error = error instanceof Error ? error.message : String(error); this.changed(); }
  private changed(): void { const state = this.getState(); const preview = this.getPreview(); this.listeners.forEach((listener) => listener(state, preview)); }
}

function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError' || error instanceof Error && /cancel/i.test(error.message); }
