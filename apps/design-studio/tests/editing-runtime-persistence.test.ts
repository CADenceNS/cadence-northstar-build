import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { ArtifactManager, createProject, ProjectStore, SceneManager } from '../src/core';
import { artifactFromMesh } from './golden-geometry';
import { cube } from './golden-editing';
import { indexedMesh, meshData } from '../src/editing-geometry';
import { booleanMesh } from '../src/boolean-tools';
import { CommandBus } from '../src/commands';
import { EditingStateManager } from '../src/editing-state';
import { GeometryEditCommand, TransformEditCommand } from '../src/editing-commands';
import { executeEditingOperation, type EditingOperationRequest } from '../src/editing-operation';
import { createPolyline } from '../src/curve-tools';
import { ToolRuntime, type ToolExecutor } from '../src/tool-runtime';
import { toolDefinition, PRODUCTION_TOOL_DEFINITIONS, TOOL_COVERAGE_REGISTRY } from '../src/tool-registry';
import type { GeometryOperationOutput } from '../src/editing-types';

describe('derived geometry command and immutable lineage', () => {
  it('creates a validated derived version and supports undo and redo', async () => {
    const runtime = setup(); const before = structuredClone(runtime.artifact); const response = await executeEditingOperation(request(runtime.artifact.mesh, 'transform.mirror', [], { 'origin-x': 0, 'origin-y': 0, 'origin-z': 0, 'normal-x': 1, 'normal-y': 0, 'normal-z': 0 }));
    await runtime.bus.execute(new GeometryEditCommand(runtime, runtime.object.id, 'transform.mirror', response.output));
    expect(runtime.artifacts.get(before.id)).toEqual(before); expect(runtime.artifacts.list()).toHaveLength(2); const derived = runtime.artifacts.get(runtime.scene.get(runtime.object.id)!.artifactId)!;
    expect(derived.derivedFrom?.parentArtifactId).toBe(before.id); expect(derived.derivedFrom?.before.vertexCount).toBe(8); expect(derived.derivedFrom?.after.watertight).toBe(true); expect(runtime.editing.get().geometryVersions).toHaveLength(1); expect(runtime.editing.get().geometryVersions[0].afterQuality.triangleCount).toBe(12);
    await runtime.bus.undo(); expect(runtime.artifacts.list()).toEqual([before]); expect(runtime.scene.get(runtime.object.id)?.artifactId).toBe(before.id);
    await runtime.bus.redo(); expect(runtime.artifacts.list()).toHaveLength(2); expect(runtime.scene.get(runtime.object.id)?.artifactId).toBe(derived.id);
  });

  it('creates additional derived parts without mutating the source', async () => {
    const runtime = setup(); const response = await executeEditingOperation(request(runtime.artifact.mesh, 'cut.split', [], { 'origin-x': 5, 'origin-y': 0, 'origin-z': 0, 'normal-x': 1, 'normal-y': 0, 'normal-z': 0, cap: true }));
    await runtime.bus.execute(new GeometryEditCommand(runtime, runtime.object.id, 'cut.split', response.output, { additionalNames: ['Split B'] }));
    expect(runtime.artifacts.list()).toHaveLength(3); expect(runtime.scene.list()).toHaveLength(2); expect(runtime.artifacts.get(runtime.artifact.id)).toEqual(runtime.artifact); expect(runtime.editing.get().geometryVersions[0].after.watertight).toBe(true);
  });

  it('duplicates into a new derived object through command history', async () => {
    const runtime = setup(); const response = await executeEditingOperation(request(runtime.artifact.mesh, 'transform.duplicate'));
    await runtime.bus.execute(new GeometryEditCommand(runtime, runtime.object.id, 'transform.duplicate', response.output, { replaceSource: false }));
    expect(runtime.scene.list()).toHaveLength(2); expect(runtime.artifacts.list()).toHaveLength(2); await runtime.bus.undo(); expect(runtime.scene.list()).toHaveLength(1); await runtime.bus.redo(); expect(runtime.scene.list()).toHaveLength(2);
  });

  it('bakes an object transform once, resets the scene transform, and carries source-local curves into the derived version', async () => {
    const runtime = setup(); const transform = { position: [5, 0, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], scale: [2, 2, 2] as [number, number, number] }; runtime.scene.update(runtime.object.id, { transform });
    const curve = createPolyline('Associated', [[0, 0, 0], [1, 0, 0]], { objectId: runtime.object.id, artifactId: runtime.artifact.id }); runtime.editing.replace({ ...runtime.editing.get(), curves: [curve] });
    const response = await executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'transform.bake', meshes: [runtime.artifact.mesh], selectionIds: [], parameters: {}, transform });
    await runtime.bus.execute(new GeometryEditCommand(runtime, runtime.object.id, 'transform.bake', response.output, { sceneObjectPatch: { transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } }, transformAssociatedPoints: true, preserveComponentIds: true }));
    const derivedObject = runtime.scene.get(runtime.object.id)!; const derived = runtime.artifacts.get(derivedObject.artifactId)!; expect(derivedObject.transform).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }); expect(derived.mesh.sourceTopology!.positions.slice(0, 3)).toEqual([5, 0, 0]); expect(runtime.editing.get().curves[0].controlPoints).toEqual([[5, 0, 0], [7, 0, 0]]); expect(runtime.editing.get().curves[0].artifactId).toBe(derived.id);
    await runtime.bus.undo(); expect(runtime.scene.get(runtime.object.id)?.transform).toEqual(transform); expect(runtime.editing.get().curves[0]).toEqual(curve);
  });

  it('preserves outward winding when baking a reflected transform', async () => { const runtime = setup(); const transform = { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], scale: [-1, 1, 1] as [number, number, number] }; const response = await executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'transform.bake', meshes: [runtime.artifact.mesh], selectionIds: [], parameters: {}, transform }); expect(response.output.inspection.watertight).toBe(true); expect(booleanMesh(indexedMesh(response.output.mesh), cube([20, 0, 0]), 'union').faces.length).toBeGreaterThan(0); });

  it('joins selected objects by consuming the secondary scene object while preserving both source artifacts', async () => {
    const runtime = setup(); const secondary = artifactFromMesh('editing-command-secondary', meshData(cube([30, 0, 0]))); runtime.artifacts.replace([...runtime.artifacts.list(), secondary]); const secondaryObject = runtime.scene.addFromArtifact(secondary);
    runtime.editing.setSelections([{ objectId: secondaryObject.id, artifactId: secondary.id, kind: 'face', ids: [0], mode: 'face', updatedAt: '2026-08-08T00:00:00.000Z' }]);
    const response = await executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'mesh.join', meshes: [runtime.artifact.mesh, secondary.mesh], selectionIds: [], parameters: { tolerance: 0.001 } });
    const command = new GeometryEditCommand(runtime, runtime.object.id, 'mesh.join', response.output, { allowDisconnected: true, consumeObjectIds: [secondaryObject.id] });
    runtime.scene.update(secondaryObject.id, { locked: true }); await expect(runtime.bus.execute(command)).rejects.toThrow(/Locked object/); runtime.scene.update(secondaryObject.id, { locked: false });
    await runtime.bus.execute(command); expect(runtime.scene.list()).toHaveLength(1); expect(runtime.artifacts.list()).toHaveLength(3); expect(runtime.artifacts.get(runtime.artifact.id)).toEqual(runtime.artifact); expect(runtime.artifacts.get(secondary.id)).toEqual(secondary); expect(runtime.editing.get().componentSelections).toHaveLength(0);
    await runtime.bus.undo(); expect(runtime.scene.list()).toHaveLength(2); expect(runtime.artifacts.list()).toHaveLength(2); await runtime.bus.redo(); expect(runtime.scene.list()).toHaveLength(1); expect(runtime.artifacts.list()).toHaveLength(3);
  });

  it('rejects locked objects and corrupt operation output', async () => {
    const runtime = setup(); runtime.scene.update(runtime.object.id, { locked: true }); const response = await executeEditingOperation(request(runtime.artifact.mesh, 'transform.mirror', [], { 'normal-x': 1, 'normal-y': 0, 'normal-z': 0 }));
    await expect(runtime.bus.execute(new GeometryEditCommand(runtime, runtime.object.id, 'transform.mirror', response.output))).rejects.toThrow(/Locked object/);
    runtime.scene.update(runtime.object.id, { locked: false }); const corrupt = structuredClone(response.output); corrupt.mesh.sourceTopology!.positions[0] = Number.NaN;
    await expect(runtime.bus.execute(new GeometryEditCommand(runtime, runtime.object.id, 'corrupt', corrupt))).rejects.toThrow(/invalid coordinate/);
  });

  it('persists numeric transform parameters atomically with undo and redo', async () => {
    const runtime = setup(); const after = { ...runtime.object.transform, position: [1.25, -2, 3] as [number, number, number] }; const command = new TransformEditCommand(runtime.scene, runtime.editing, runtime.object.id, after, 'transform.move', 'Move', { x: 1.25, y: -2, z: 3 });
    await runtime.bus.execute(command); expect(runtime.scene.get(runtime.object.id)?.transform).toEqual(after); expect(runtime.editing.get().toolSettings['transform.move']).toEqual({ x: 1.25, y: -2, z: 3 }); await runtime.bus.undo(); expect(runtime.scene.get(runtime.object.id)?.transform).toEqual(runtime.object.transform); expect(runtime.editing.get().toolSettings['transform.move']).toBe(undefined); await runtime.bus.redo(); expect(runtime.scene.get(runtime.object.id)?.transform).toEqual(after); expect(runtime.editing.get().toolSettings['transform.move']?.x).toBe(1.25);
  });
});

describe('tool runtime command enforcement and cancellation', () => {
  it('activates, previews, confirms, undoes, and redoes an actual geometry tool', async () => {
    const runtime = setup(); const tools = new ToolRuntime<typeof runtime, GeometryOperationOutput>(runtime.bus); tools.register(executor(runtime.artifact.mesh));
    await tools.activate('transform.mirror', runtime); tools.setParameter('normal-x', 1); tools.setParameter('normal-z', 0); const preview = await tools.preview(runtime); expect(preview.inspection.watertight).toBe(true); await tools.confirm(runtime); expect(runtime.artifacts.list()).toHaveLength(2); expect(runtime.editing.get().toolSettings['transform.mirror']?.['normal-x']).toBe(1); expect(runtime.editing.get().toolSettings['transform.mirror']?.['normal-z']).toBe(0); await runtime.bus.undo(); expect(runtime.artifacts.list()).toHaveLength(1); expect(runtime.editing.get().toolSettings['transform.mirror']).toBe(undefined); await runtime.bus.redo(); expect(runtime.artifacts.list()).toHaveLength(2); expect(runtime.editing.get().toolSettings['transform.mirror']?.['normal-x']).toBe(1);
  });
  it('cancels a long preview without creating a command or mutation', async () => {
    const runtime = setup(); const tools = new ToolRuntime<typeof runtime, GeometryOperationOutput>(runtime.bus); const definition = { ...toolDefinition('topology.subdivide'), parameters: [] };
    tools.register({ definition, validate() {}, preview: (_context, _parameters, signal) => new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true }); }), createCommand() { throw new Error('cancelled preview cannot create a command'); } });
    await tools.activate(definition.id, runtime); const pending = tools.preview(runtime); await tools.cancel(runtime); await expect(pending).rejects.toThrow(/cancel/i); expect(runtime.artifacts.list()).toHaveLength(1); expect(runtime.bus.history()).toHaveLength(0);
  });
  it('handles Escape cancellation and validates numeric parameters', async () => { const runtime = setup(); const tools = new ToolRuntime<typeof runtime, GeometryOperationOutput>(runtime.bus); tools.register(executor(runtime.artifact.mesh)); await tools.activate('transform.mirror', runtime); expect(() => tools.setParameter('normal-x', Number.NaN)).toThrow(/numeric range/); await tools.handleKeyboard(runtime, { type: 'down', key: 'Escape', shiftKey: false, ctrlKey: false, altKey: false }); expect(tools.getState().activeToolId).toBe(null); });
});

describe('editing persistence and coverage registry', () => {
  it('persists selections, curves, tool settings, lineage, save/reopen, and recovery', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); const project = createProject('Editing persistence'); project.editing.componentSelections = [{ objectId: 'scene-1', artifactId: 'artifact-1', kind: 'face', ids: [1, 2], mode: 'connected-region', updatedAt: '2026-08-08T00:00:00.000Z' }]; project.editing.curves = [createPolyline('Margin-independent curve', [[0, 0, 0], [1, 0, 0]])]; project.editing.toolSettings['mesh.smooth'] = { iterations: 3, strength: 40 };
    const store = new ProjectStore(); const saved = store.save(project); const opened = store.open(saved.id); expect(opened.schemaVersion).toBe(6); expect(opened.editing).toEqual(project.editing); store.autoSave(opened); expect(store.recover()?.editing).toEqual(project.editing);
  });
  it('migrates older projects to independently owned editing, preparation, and restoration state', () => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); const project = createProject('Old'); const old = { ...project, schemaVersion: 3 }; delete (old as Partial<typeof project>).editing; delete (old as Partial<typeof project>).preparation; delete (old as Partial<typeof project>).restoration; localStorage.setItem(`cadence.design-studio.project.${project.id}`, JSON.stringify(old)); const opened = new ProjectStore().open(project.id); expect(opened.schemaVersion).toBe(6); expect(opened.editing.schemaVersion).toBe(1); expect(opened.editing.curves).toHaveLength(0); expect(opened.preparation.schemaVersion).toBe(1); expect(opened.preparation.preparations).toHaveLength(0); expect(opened.restoration.schemaVersion).toBe(1); expect(opened.restoration.restorations).toHaveLength(0); });
  it('registers every production tool with traceable command, persistence, recovery, deterministic, and browser evidence', () => { expect(PRODUCTION_TOOL_DEFINITIONS.length).toBe(TOOL_COVERAGE_REGISTRY.length); expect(new Set(PRODUCTION_TOOL_DEFINITIONS.map((value) => value.id)).size).toBe(PRODUCTION_TOOL_DEFINITIONS.length); for (const entry of TOOL_COVERAGE_REGISTRY) { expect(entry.implemented).toBe(true); expect(entry.commandIntegrated).toBe(true); expect(entry.persisted).toBe(true); expect(entry.recovery).toBe(true); expect(entry.deterministicTest).toMatch(/editing-(?:operation-corpus|selection-transform-curve)\.test\.ts#/); expect(entry.browserTest).toMatch(/design-studio-editing-core\.spec\.mjs#.+/); } });
  it('requires worker-backed execution for every destructive registered tool', () => { expect(PRODUCTION_TOOL_DEFINITIONS.filter((value) => value.destructive).every((value) => value.workerBacked)).toBe(true); });
  it('returns byte-for-byte deterministic geometry for repeated requests', async () => { const mesh = meshData(cube()); const first = await executeEditingOperation(request(mesh, 'topology.subdivide', [], { levels: 1 })); const second = await executeEditingOperation(request(mesh, 'topology.subdivide', [], { levels: 1 })); expect(second.output.mesh).toEqual(first.output.mesh); expect(second.output.inspection).toEqual(first.output.inspection); });
});

function setup() { const artifact = artifactFromMesh('editing-command-cube', meshData(cube())); const artifacts = new ArtifactManager([artifact]); const scene = new SceneManager(); const object = scene.addFromArtifact(artifact); const editing = new EditingStateManager(); const bus = new CommandBus(); return { artifact, artifacts, scene, object, editing, bus }; }
function request(mesh: ReturnType<typeof meshData>, toolId: string, selectionIds: number[] = [], parameters: Record<string, number | string | boolean> = {}): EditingOperationRequest { return { requestId: crypto.randomUUID(), toolId, meshes: [mesh], selectionIds, parameters }; }
function executor(mesh: ReturnType<typeof meshData>): ToolExecutor<ReturnType<typeof setup>, GeometryOperationOutput> { return { definition: toolDefinition('transform.mirror'), validate() {}, async preview(_context, parameters, signal, progress) { return (await executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'transform.mirror', meshes: [mesh], selectionIds: [], parameters }, { signal, progress })).output; }, createCommand(context, preview, parameters) { return new GeometryEditCommand(context, context.object.id, 'transform.mirror', preview, { toolParameters: parameters }); } }; }

class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
