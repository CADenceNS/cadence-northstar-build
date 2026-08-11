import type { ToolProgress } from './editing-types';
import type { EditingOperationRequest, EditingOperationResponse } from './editing-operation';

interface Pending { resolve(value: EditingOperationResponse): void; reject(error: Error): void; progress?: (value: ToolProgress) => void; signal?: AbortSignal; abort?: () => void; }

export class EditingWorkerClient {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, Pending>();
  execute(request: EditingOperationRequest, options: { signal?: AbortSignal; progress?: (value: ToolProgress) => void } = {}): Promise<EditingOperationResponse> {
    if (this.pending.has(request.requestId)) throw new Error(`Editing request ${request.requestId} is already active.`);
    const worker = this.getWorker();
    return new Promise((resolve, reject) => {
      const pending: Pending = { resolve, reject, ...options };
      this.pending.set(request.requestId, pending);
      if (options.signal) {
        const abort = () => {
          if (!this.pending.has(request.requestId)) return;
          this.pending.delete(request.requestId); worker.terminate(); this.worker = null;
          reject(new DOMException('Geometry operation cancelled and its worker was terminated.', 'AbortError'));
          this.failAll(new DOMException('Geometry worker restarted after cancellation.', 'AbortError'));
        };
        pending.abort = abort;
        if (options.signal.aborted) abort(); else options.signal.addEventListener('abort', abort, { once: true });
      }
      if (this.pending.has(request.requestId)) worker.postMessage({ type: 'execute', request });
    });
  }
  dispose(): void { this.worker?.terminate(); this.worker = null; this.failAll(new Error('Editing worker disposed.')); }
  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./editing.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => this.received(event.data as WorkerMessage); worker.onerror = (event) => this.failAll(new Error(event.message || 'Editing worker failed.'));
    this.worker = worker; return worker;
  }
  private received(message: WorkerMessage): void { const pending = this.pending.get(message.requestId); if (!pending) return; if (message.type === 'progress') { pending.progress?.(message.progress); return; } this.pending.delete(message.requestId); if (pending.signal && pending.abort) pending.signal.removeEventListener('abort', pending.abort); if (message.type === 'result') pending.resolve(message.response); else pending.reject(new Error(message.error)); }
  private failAll(error: Error): void { for (const pending of this.pending.values()) { if (pending.signal && pending.abort) pending.signal.removeEventListener('abort', pending.abort); pending.reject(error); } this.pending.clear(); }
}

type WorkerMessage = { type: 'progress'; requestId: string; progress: ToolProgress } | { type: 'result'; requestId: string; response: EditingOperationResponse } | { type: 'error'; requestId: string; error: string };
