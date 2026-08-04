/// <reference lib="webworker" />
import { registerPair } from './registration-engine';
import type { RegistrationRequest } from './registration-types';

const cancelled = new Set<string>();

self.onmessage = (event: MessageEvent<{ type: 'register'; request: RegistrationRequest } | { type: 'cancel'; requestId: string }>) => {
  if (event.data.type === 'cancel') { cancelled.add(event.data.requestId); return; }
  const request = event.data.request;
  cancelled.delete(request.requestId);
  void registerPair(request, {
    isCancelled: () => cancelled.has(request.requestId),
    onProgress: (progress) => self.postMessage({ type: 'progress', progress }),
    yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
  }).then((result) => {
    self.postMessage({ type: 'result', requestId: request.requestId, result });
    cancelled.delete(request.requestId);
  }).catch((error: unknown) => {
    self.postMessage({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : 'Registration worker failed.' });
    cancelled.delete(request.requestId);
  });
};

export {};
