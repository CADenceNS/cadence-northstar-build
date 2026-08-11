/// <reference lib="webworker" />
import { executeEditingOperation, type EditingOperationRequest } from './editing-operation';

declare const self: DedicatedWorkerGlobalScope;
const controllers = new Map<string, AbortController>();

self.onmessage = async (event: MessageEvent<{ type: 'execute'; request: EditingOperationRequest } | { type: 'cancel'; requestId: string }>) => {
  if (event.data.type === 'cancel') { controllers.get(event.data.requestId)?.abort(); return; }
  const { request } = event.data; const controller = new AbortController(); controllers.set(request.requestId, controller);
  try {
    const response = await executeEditingOperation(request, {
      signal: controller.signal,
      progress: (progress) => self.postMessage({ type: 'progress', requestId: request.requestId, progress }),
      yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
    });
    self.postMessage({ type: 'result', requestId: request.requestId, response });
  } catch (error) { self.postMessage({ type: 'error', requestId: request.requestId, error: error instanceof Error ? error.message : String(error) }); }
  finally { controllers.delete(request.requestId); }
};

export {};
