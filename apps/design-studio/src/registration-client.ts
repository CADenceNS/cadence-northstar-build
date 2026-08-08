import type { PairwiseRegistrationResult, RegistrationProgress, RegistrationRequest } from './registration-types';

interface PendingRegistration {
  resolve: (result: PairwiseRegistrationResult) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: RegistrationProgress) => void;
  timeout: number;
}

export class RegistrationWorkerClient {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, PendingRegistration>();

  register(request: RegistrationRequest, onProgress?: (progress: RegistrationProgress) => void): Promise<PairwiseRegistrationResult> {
    if (this.pending.has(request.requestId)) return Promise.reject(new Error(`Registration request ${request.requestId} is already active.`));
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(request.requestId);
        worker.postMessage({ type: 'cancel', requestId: request.requestId });
        reject(new Error('Registration exceeded the 180 second safety timeout.'));
      }, 180_000);
      this.pending.set(request.requestId, { resolve, reject, onProgress, timeout });
      worker.postMessage({ type: 'register', request });
    });
  }

  cancel(requestId: string): void {
    if (!this.pending.has(requestId)) return;
    this.ensureWorker().postMessage({ type: 'cancel', requestId });
  }

  dispose(): void {
    this.worker?.terminate(); this.worker = null;
    for (const pending of this.pending.values()) { window.clearTimeout(pending.timeout); pending.reject(new Error('Registration worker was disposed.')); }
    this.pending.clear();
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./registration.worker.ts', import.meta.url), { type: 'module', name: 'cadence-registration-worker' });
    worker.onmessage = (event: MessageEvent<{ type: 'progress'; progress: RegistrationProgress } | { type: 'result'; requestId: string; result: PairwiseRegistrationResult } | { type: 'error'; requestId: string; message: string }>) => {
      if (event.data.type === 'progress') { this.pending.get(event.data.progress.requestId)?.onProgress?.(event.data.progress); return; }
      const pending = this.pending.get(event.data.requestId); if (!pending) return;
      window.clearTimeout(pending.timeout); this.pending.delete(event.data.requestId);
      if (event.data.type === 'result') pending.resolve(event.data.result); else pending.reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Registration worker crashed.');
      for (const pending of this.pending.values()) { window.clearTimeout(pending.timeout); pending.reject(error); }
      this.pending.clear(); worker.terminate(); if (this.worker === worker) this.worker = null;
    };
    this.worker = worker; return worker;
  }
}
