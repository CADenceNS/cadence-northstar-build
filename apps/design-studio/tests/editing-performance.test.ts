import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { ArtifactManager, createProject, ProjectStore, SceneManager } from '../src/core';
import { CommandBus } from '../src/commands';
import { EditingStateManager } from '../src/editing-state';
import { GeometryEditCommand } from '../src/editing-commands';
import { executeEditingOperation } from '../src/editing-operation';
import { meshData } from '../src/editing-geometry';
import { grid } from './golden-editing';
import { artifactFromMesh } from './golden-geometry';

const CASES = [{ name: 'small', size: 10 }, { name: 'medium', size: 50 }, { name: 'large', size: 100 }] as const;

describe('measured universal editing performance and stability', () => {
  for (const fixture of CASES) it(`measures ${fixture.name} preview, command, undo, redo, save, and reopen`, async () => {
    const mesh = meshData(grid(fixture.size)); const artifact = artifactFromMesh(`editing-performance-${fixture.name}`, mesh); const artifacts = new ArtifactManager([artifact]); const scene = new SceneManager(); const object = scene.addFromArtifact(artifact); const editing = new EditingStateManager(); const bus = new CommandBus(); const ids = Array.from({ length: grid(fixture.size).faces.length }, (_, id) => id);
    const beforeHeap = process.memoryUsage().heapUsed; let yields = 0; const previewStart = performance.now();
    const response = await executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'mesh.smooth', meshes: [mesh], selectionIds: ids, parameters: { iterations: 1, strength: 20 } }, { yieldControl: async () => { yields += 1; await Promise.resolve(); } }); const previewDurationMs = performance.now() - previewStart;
    const command = new GeometryEditCommand({ scene, artifacts, editing }, object.id, 'mesh.smooth', response.output, { allowBoundaries: true }); const commandStart = performance.now(); await bus.execute(command); const commandDurationMs = performance.now() - commandStart;
    const undoStart = performance.now(); await bus.undo(); const undoDurationMs = performance.now() - undoStart; const redoStart = performance.now(); await bus.redo(); const redoDurationMs = performance.now() - redoStart;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); const project = createProject(`Editing performance ${fixture.name}`); project.scene = scene.list(); project.artifacts = artifacts.list(); project.editing = editing.get(); const store = new ProjectStore(); const saveStart = performance.now(); const saved = store.save(project); const saveDurationMs = performance.now() - saveStart; const reopenStart = performance.now(); const reopened = store.open(saved.id); const reopenDurationMs = performance.now() - reopenStart; const heapDeltaBytes = process.memoryUsage().heapUsed - beforeHeap;
    const measurement = { case: fixture.name, vertices: response.output.inspection.vertexCount, triangles: response.output.inspection.triangleCount, previewDurationMs, commandDurationMs, undoDurationMs, redoDurationMs, saveDurationMs, reopenDurationMs, heapDeltaBytes, cooperativeYields: yields };
    console.info(`EDITING_PERFORMANCE ${JSON.stringify(measurement)}`);
    expect(response.output.inspection.nonManifoldEdgeCount).toBe(0); expect(reopened.editing.geometryVersions).toHaveLength(1); expect(reopened.artifacts[0].checksum).toBe(artifact.checksum); expect(yields).toBeGreaterThan(0); expect([previewDurationMs, commandDurationMs, undoDurationMs, redoDurationMs, saveDurationMs, reopenDurationMs].every(Number.isFinite)).toBe(true);
  });

  it('measures multiple simultaneously resident meshes without source mutation', async () => {
    const meshes = Array.from({ length: 4 }, (_, index) => meshData(grid(35 + index))); const before = structuredClone(meshes); const start = performance.now(); const results = await Promise.all(meshes.map((mesh) => executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'topology.smooth', meshes: [mesh], selectionIds: [], parameters: { iterations: 1, preserveBoundaries: true } }))); const durationMs = performance.now() - start;
    console.info(`EDITING_PERFORMANCE ${JSON.stringify({ case: 'multiple', meshes: meshes.length, triangles: results.reduce((sum, result) => sum + result.output.inspection.triangleCount, 0), durationMs, heapUsedBytes: process.memoryUsage().heapUsed })}`);
    expect(meshes).toEqual(before); expect(results.every((result) => result.output.inspection.nonManifoldEdgeCount === 0)).toBe(true);
  });
});

class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
