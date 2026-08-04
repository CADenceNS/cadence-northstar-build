import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { createProject, ProjectStore, type MeshData, type SceneObject, type Vec3 } from '../src/core';
import { ManagedMeshImporter } from '../src/importers';
import { validateMeshArtifact } from '../src/mesh-validation';
import { buildValidationOverlays } from '../src/validation-overlays';
import { artifactFromMesh } from './golden-geometry';

const CASES = [
  { name: 'small', size: 20 },
  { name: 'medium', size: 80 },
  { name: 'large', size: 180 },
] as const;

describe('measured mesh validation performance', () => {
  for (const fixture of CASES) {
    it(`measures ${fixture.name} mesh validation and overlay generation`, () => {
      const artifact = artifactFromMesh(`performance-${fixture.name}`, grid(fixture.size));
      const object = sceneObject(artifact.id);
      const beforeHeap = process.memoryUsage().heapUsed;
      const validationStart = performance.now(); const result = validateMeshArtifact(artifact); const validationDurationMs = performance.now() - validationStart;
      const overlayStart = performance.now(); const overlays = buildValidationOverlays(result, object); const overlayDurationMs = performance.now() - overlayStart;
      const afterHeap = process.memoryUsage().heapUsed;
      const geometryPayloadBytes = (artifact.mesh.positions.length + artifact.mesh.normals.length + artifact.mesh.indices.length + (artifact.mesh.sourceTopology?.positions.length ?? 0) + (artifact.mesh.sourceTopology?.indices.length ?? 0)) * 8;
      const measurement = { case: fixture.name, triangles: artifact.mesh.indices.length / 3, vertices: (artifact.mesh.sourceTopology?.positions.length ?? 0) / 3, validationDurationMs, overlayDurationMs, geometryPayloadBytes, heapDeltaBytes: afterHeap - beforeHeap, overlayCount: overlays.length };
      console.info(`PERFORMANCE ${JSON.stringify(measurement)}`);
      expect(validationDurationMs).toBeGreaterThanOrEqual(0); expect(overlayDurationMs).toBeGreaterThanOrEqual(0); expect(Number.isFinite(afterHeap)).toBe(true); expect(result.checks).toHaveLength(20);
    });
  }

  it('measures multiple simultaneously resident meshes deterministically', () => {
    const artifacts = Array.from({ length: 4 }, (_, index) => artifactFromMesh(`performance-multiple-${index}`, grid(70, index * 100)));
    const beforeHeap = process.memoryUsage().heapUsed; const started = performance.now();
    const results = artifacts.map((artifact) => validateMeshArtifact(artifact)); const durationMs = performance.now() - started; const afterHeap = process.memoryUsage().heapUsed;
    console.info(`PERFORMANCE ${JSON.stringify({ case: 'multiple', meshes: artifacts.length, triangles: artifacts.reduce((sum, artifact) => sum + artifact.mesh.indices.length / 3, 0), validationDurationMs: durationMs, heapDeltaBytes: afterHeap - beforeHeap })}`);
    expect(new Set(results.map((result) => result.resultFingerprint)).size).toBe(1); expect(results.every((result) => result.failureCount > 0)).toBe(true);
  });

  for (const fixture of CASES) {
    it(`measures ${fixture.name} PLY import and project save/reopen`, async () => {
      const mesh = grid(fixture.size); const source = plySource(mesh); const file = new File([source], `performance-${fixture.name}.ply`, { type: 'application/octet-stream', lastModified: 1 });
      const importStart = performance.now(); const imported = await new ManagedMeshImporter().import({ file }, []); const importDurationMs = performance.now() - importStart;
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new BenchmarkStorage() });
      const project = createProject(`Performance ${fixture.name}`); project.artifacts = [imported.artifact];
      const store = new ProjectStore(); const saveStart = performance.now(); const saved = store.save(project); const saveDurationMs = performance.now() - saveStart;
      const reopenStart = performance.now(); const reopened = store.open(saved.id); const reopenDurationMs = performance.now() - reopenStart;
      console.info(`PERFORMANCE ${JSON.stringify({ case: fixture.name, triangles: mesh.indices.length / 3, importDurationMs, sourceBytes: file.size, saveDurationMs, reopenDurationMs })}`);
      expect(reopened.artifacts[0].checksum).toBe(imported.artifact.checksum); expect(importDurationMs).toBeGreaterThanOrEqual(0); expect(saveDurationMs).toBeGreaterThanOrEqual(0); expect(reopenDurationMs).toBeGreaterThanOrEqual(0);
    });
  }
});

function grid(size: number, offset = 0): MeshData {
  const sourcePositions: number[] = [];
  for (let y = 0; y <= size; y += 1) for (let x = 0; x <= size; x += 1) sourcePositions.push(x + offset, y, Math.sin(x * 0.05) * Math.cos(y * 0.05));
  const sourceIndices: number[] = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const a = y * (size + 1) + x; const b = a + 1; const c = a + size + 1; const d = c + 1;
    sourceIndices.push(a, b, d, a, d, c);
  }
  const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  for (const index of sourceIndices) { positions.push(sourcePositions[index * 3], sourcePositions[index * 3 + 1], sourcePositions[index * 3 + 2]); normals.push(0, 0, 1); indices.push(indices.length); }
  return { positions, normals, indices, bounds: { min: [offset, 0, -1], max: [offset + size, size, 1] }, sourceTopology: { positions: sourcePositions, indices: sourceIndices } };
}

function sceneObject(artifactId: string): SceneObject { return { id: `scene-${artifactId}`, name: artifactId, type: 'reference', artifactId, visible: true, isolated: false, locked: false, selected: true, transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [1, 1, 1, 1], opacity: 1, metallic: 0, roughness: 1 }, metadata: {} }; }
function plySource(mesh: MeshData): string {
  const topology = mesh.sourceTopology!; const vertices: string[] = [];
  for (let offset = 0; offset < topology.positions.length; offset += 3) vertices.push(`${topology.positions[offset]} ${topology.positions[offset + 1]} ${topology.positions[offset + 2]}`);
  const faces: string[] = []; for (let offset = 0; offset < topology.indices.length; offset += 3) faces.push(`3 ${topology.indices[offset]} ${topology.indices[offset + 1]} ${topology.indices[offset + 2]}`);
  return `ply\nformat ascii 1.0\nelement vertex ${vertices.length}\nproperty float x\nproperty float y\nproperty float z\nelement face ${faces.length}\nproperty list uchar int vertex_indices\nend_header\n${vertices.join('\n')}\n${faces.join('\n')}\n`;
}
class BenchmarkStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
