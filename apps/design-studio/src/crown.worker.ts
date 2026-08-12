/// <reference lib="webworker" />
import { generateCrownProposal } from './crown-engine';
import type { CrownGenerationInput } from './restoration-types';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<string>();

scope.onmessage = (event: MessageEvent<{ type: 'execute'; request: CrownGenerationInput } | { type: 'cancel'; requestId: string }>) => {
  const message = event.data;
  if (message.type === 'cancel') { cancelled.add(message.requestId); return; }
  const { request } = message; cancelled.delete(request.requestId);
  try {
    const response = generateCrownProposal(request, {
      cancelled: () => cancelled.has(request.requestId),
      progress: (progress) => scope.postMessage({ type: 'progress', requestId: request.requestId, progress }),
    });
    if (!cancelled.has(request.requestId)) scope.postMessage({ type: 'result', requestId: request.requestId, response });
  } catch (error) {
    scope.postMessage({ type: 'error', requestId: request.requestId, error: error instanceof Error ? error.message : String(error) });
  } finally { cancelled.delete(request.requestId); }
};

export {};
