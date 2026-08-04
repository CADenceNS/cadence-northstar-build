/// <reference lib="webworker" />
import type { ArtifactRecord } from './core';
import { validateMeshArtifact } from './mesh-validation';

interface ValidationRequest { id: string; artifact: ArtifactRecord; }

self.addEventListener('message', (event: MessageEvent<ValidationRequest>) => {
  const { id, artifact } = event.data;
  try { self.postMessage({ id, result: validateMeshArtifact(artifact) }); }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Mesh validation failed' }); }
});

export {};
