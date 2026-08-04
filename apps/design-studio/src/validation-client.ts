import type { ArtifactRecord } from './core';
import type { MeshValidationResult } from './mesh-validation';

export class ValidationWorkerClient {
  private worker?: Worker;
  private readonly pending = new Map<string, { resolve: (value: MeshValidationResult) => void; reject: (reason: Error) => void; timeout: ReturnType<typeof setTimeout> }>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./validation.worker.ts', import.meta.url), { type: 'module', name: 'design-studio-mesh-validation' });
    worker.addEventListener('message', (event: MessageEvent<{ id: string; result?: MeshValidationResult; error?: string }>) => {
      const request = this.pending.get(event.data.id); if (!request) return;
      clearTimeout(request.timeout);
      this.pending.delete(event.data.id);
      if (event.data.result) request.resolve(event.data.result); else request.reject(new Error(event.data.error ?? 'Mesh validation worker returned no result'));
    });
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Mesh validation worker failed');
      this.failPending(error);
      worker.terminate();
      if (this.worker === worker) this.worker = undefined;
    });
    this.worker = worker;
    return worker;
  }

  validate(artifact: ArtifactRecord): Promise<MeshValidationResult> {
    const id = crypto.randomUUID();
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Mesh validation exceeded the 120 second safety limit'));
        worker.terminate();
        if (this.worker === worker) this.worker = undefined;
      }, 120_000);
      this.pending.set(id, { resolve, reject, timeout });
      try { worker.postMessage({ id, artifact }); }
      catch (error) {
        clearTimeout(timeout); this.pending.delete(id);
        reject(error instanceof Error ? error : new Error('Unable to start mesh validation'));
      }
    });
  }

  dispose(): void {
    this.worker?.terminate(); this.worker = undefined;
    this.failPending(new Error('Mesh validation worker was disposed'));
  }

  private failPending(error: Error): void {
    for (const request of this.pending.values()) { clearTimeout(request.timeout); request.reject(error); }
    this.pending.clear();
  }
}
