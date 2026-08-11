/// <reference lib="webworker" />
import type { ArtifactRecord } from './core';
import { validateMeshArtifact } from './mesh-validation';

interface ValidationRequest { id: string; artifact: ArtifactRecord; objectId: string | null; }

self.addEventListener('message', (event: MessageEvent<ValidationRequest>) => {
  const { id, artifact, objectId } = event.data;
  try { self.postMessage({ id, result: validateMeshArtifact(artifact, {}, objectId) }); }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Mesh validation failed' }); }
});

export {};
