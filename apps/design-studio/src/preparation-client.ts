import type { PreparationAnalysisProgress, PreparationAnalysisRequest, PreparationAnalysisResponse } from './preparation-types';

interface Pending {
  resolve(value: PreparationAnalysisResponse): void;
  reject(error: Error): void;
  progress?: (value: PreparationAnalysisProgress) => void;
  timeout: number;
  signal?: AbortSignal;
  abort?: () => void;
}

export class PreparationWorkerClient {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, Pending>();
  execute(request: PreparationAnalysisRequest, options: { signal?: AbortSignal; progress?: (value: PreparationAnalysisProgress) => void } = {}): Promise<PreparationAnalysisResponse> {
    if (this.pending.has(request.requestId)) return Promise.reject(new Error(`Preparation request ${request.requestId} is already active.`)); const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => { this.cancel(request.requestId); reject(new Error('Preparation analysis exceeded the 180 second safety timeout.')); }, 180_000);
      const pending: Pending = { resolve, reject, progress: options.progress, timeout, signal: options.signal }; this.pending.set(request.requestId, pending);
      if (options.signal) { const abort = () => this.cancel(request.requestId); pending.abort = abort; if (options.signal.aborted) abort(); else options.signal.addEventListener('abort', abort, { once: true }); }
      if (this.pending.has(request.requestId)) worker.postMessage({ type: 'execute', request });
    });
  }
  cancel(requestId: string): void { const pending = this.pending.get(requestId); if (!pending) return; this.ensureWorker().postMessage({ type: 'cancel', requestId }); window.clearTimeout(pending.timeout); this.pending.delete(requestId); pending.reject(new DOMException('Preparation analysis cancelled.', 'AbortError')); }
  dispose(): void { this.worker?.terminate(); this.worker = null; this.failAll(new Error('Preparation worker disposed.')); }
  private ensureWorker(): Worker {
    if (this.worker) return this.worker; const worker = new Worker(new URL('./preparation.worker.ts', import.meta.url), { type: 'module', name: 'cadence-preparation-worker' });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => { const message = event.data; const pending = this.pending.get(message.requestId); if (!pending) return; if (message.type === 'progress') { pending.progress?.(message.progress); return; } this.cleanup(message.requestId, pending); if (message.type === 'result') pending.resolve(message.response); else pending.reject(new Error(message.error)); };
    worker.onerror = (event) => { this.failAll(new Error(event.message || 'Preparation worker crashed.')); worker.terminate(); if (this.worker === worker) this.worker = null; };
    this.worker = worker; return worker;
  }
  private cleanup(requestId: string, pending: Pending): void { window.clearTimeout(pending.timeout); if (pending.signal && pending.abort) pending.signal.removeEventListener('abort', pending.abort); this.pending.delete(requestId); }
  private failAll(error: Error): void { for (const [id, pending] of this.pending) { this.cleanup(id, pending); pending.reject(error); } }
}

type WorkerMessage =
  | { type: 'progress'; requestId: string; progress: PreparationAnalysisProgress }
  | { type: 'result'; requestId: string; response: PreparationAnalysisResponse }
  | { type: 'error'; requestId: string; error: string };
