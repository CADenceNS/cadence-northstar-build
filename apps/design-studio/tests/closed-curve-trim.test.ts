import { describe, it } from 'node:test';
import { ArtifactManager, createProject, ProjectStore, SceneManager, type Vec3 } from '../src/core';
import { CommandBus } from '../src/commands';
import { createPolyline, setCurveClosed } from '../src/curve-tools';
import { trimByClosedCurve } from '../src/cutting-tools';
import { EditingStateManager } from '../src/editing-state';
import { GeometryEditCommand } from '../src/editing-commands';
import { executeEditingOperation } from '../src/editing-operation';
import { analyzeSelfIntersections, boundaryLoops, buildTopology, faceCentroid, meshData, type IndexedMesh } from '../src/editing-geometry';
import { artifactFromMesh } from './golden-geometry';
import { expect } from './test-helpers';

const TRIM_TOLERANCE_MM = 1e-5;

describe('true closed-curve surface trim corpus', () => {
  it('inserts vertices through triangle interiors and follows the requested boundary within tolerance', () => {
    const source = flatGrid(4); const curve = rectangle(0.35, 0.35, 3.55, 3.55);
    const result = trimByClosedCurve(source, curve, true, true, TRIM_TOLERANCE_MM);
    const boundaryError = maximumTrimBoundaryError(result, curve);
    expect(boundaryError < TRIM_TOLERANCE_MM).toBe(true);
    expect(result.positions.some(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y))).toBe(true);
    expect(result.faces.length).toBeGreaterThan(source.faces.filter((face) => insideRectangle(faceCentroid(source, face), 0.35, 0.35, 3.55, 3.55)).length);
    assertTrimIntegrity(result, 1);
  });

  it('splits continuously where the curve crosses existing edges and vertices', () => {
    const source = flatGrid(4); const curve = rectangle(1, 1, 3, 3);
    const result = trimByClosedCurve(source, curve, true, true);
    const topology = buildTopology(result); const boundaryVertexIds = new Set(topology.boundaryEdges.flatMap((edge) => topology.edges[edge]));
    expect([...boundaryVertexIds].some((id) => result.positions[id][0] === 1 && result.positions[id][1] === 1)).toBe(true);
    expect(boundaryLoops(result, topology)).toHaveLength(1);
    expect(maximumTrimBoundaryError(result, curve) < TRIM_TOLERANCE_MM).toBe(true);
    assertTrimIntegrity(result, 1);
  });

  it('retains exact inside and outside regions across multiple crossed triangles', () => {
    const source = flatGrid(6); const curve = rectangle(1.25, 1.5, 4.75, 4.5);
    const inside = trimByClosedCurve(source, curve, true, true);
    const outside = trimByClosedCurve(source, curve, false, true);
    expect(inside.faces.every((face) => insideRectangle(faceCentroid(inside, face), 1.25, 1.5, 4.75, 4.5))).toBe(true);
    expect(outside.faces.every((face) => !strictlyInsideRectangle(faceCentroid(outside, face), 1.25, 1.5, 4.75, 4.5))).toBe(true);
    expect(boundaryLoops(inside)).toHaveLength(1);
    expect(boundaryLoops(outside)).toHaveLength(2);
    assertTrimIntegrity(inside, 1); assertTrimIntegrity(outside, 1);
  });

  it('constructs valid topology for a concave trim loop on both retained sides', () => {
    const source = flatGrid(6);
    const curve: Vec3[] = [[0.4, 0.4, 0], [5.6, 0.4, 0], [5.6, 2.2, 0], [2.2, 2.2, 0], [2.2, 5.6, 0], [0.4, 5.6, 0]];
    const inside = trimByClosedCurve(source, curve, true, true); const outside = trimByClosedCurve(source, curve, false, true);
    expect(boundaryLoops(inside)).toHaveLength(1); expect(boundaryLoops(outside)).toHaveLength(2);
    assertTrimIntegrity(inside, 1); assertTrimIntegrity(outside, 1);
  });

  it('preserves interpolated surface position on a high-curvature dental-like height field', () => {
    const height = (x: number, y: number) => 0.12 * ((x - 5) ** 2 + (y - 5) ** 2);
    const source = surfaceGrid(10, height);
    const curve = [[2, 2], [8, 2], [8, 8], [2, 8]].map(([x, y]) => [x, y, height(x, y)] as Vec3);
    const result = trimByClosedCurve(source, curve, true, true);
    expect(result.positions.some((point) => Math.abs(point[2]) > 0.5)).toBe(true);
    expect(result.positions.every((point) => closestSourcePlaneDistance(point, source) < 1e-8)).toBe(true);
    assertTrimIntegrity(result, 1);
  });

  it('trims a deterministic dense mesh without deleting only whole source triangles', () => {
    const source = flatGrid(40); const curve = rectangle(7.25, 6.75, 33.6, 34.2);
    const first = trimByClosedCurve(source, curve, true, true); const second = trimByClosedCurve(source, curve, true, true);
    expect(second).toEqual(first);
    expect(first.positions.some(([x, y]) => Math.abs(x - 7.25) < 1e-9 || Math.abs(y - 6.75) < 1e-9)).toBe(true);
    assertTrimIntegrity(first, 1);
  });

  it('retains local narrow regions and loops close to the source boundary', () => {
    const source = flatGrid(6);
    const narrow = trimByClosedCurve(source, rectangle(0.1, 2.45, 5.9, 2.55), true, true);
    const nearBoundary = trimByClosedCurve(source, rectangle(0.01, 0.01, 5.99, 5.99), true, true);
    expect(narrow.faces.length).toBeGreaterThan(0); expect(nearBoundary.faces.length).toBeGreaterThan(source.faces.length);
    assertTrimIntegrity(narrow, 1); assertTrimIntegrity(nearBoundary, 1);
  });

  it('projects points within tolerance onto the target surface before splitting', () => {
    const source = flatGrid(4); const curve = rectangle(0.5, 0.5, 3.5, 3.5).map(([x, y]) => [x, y, TRIM_TOLERANCE_MM * 0.5] as Vec3);
    const result = trimByClosedCurve(source, curve, true, true, TRIM_TOLERANCE_MM);
    expect(result.positions.every((point) => Math.abs(point[2]) < 1e-12)).toBe(true);
    assertTrimIntegrity(result, 1);
  });

  it('rejects open, self-crossing, degenerate, off-surface, and empty-region inputs', () => {
    const source = flatGrid(4);
    expect(() => trimByClosedCurve(source, rectangle(1, 1, 3, 3), true, false)).toThrow(/rejects open curves/);
    expect(() => trimByClosedCurve(source, [[1, 1, 0], [3, 3, 0], [1, 3, 0], [3, 1, 0]], true, true)).toThrow(/self-intersects/);
    expect(() => trimByClosedCurve(source, [[1, 1, 0], [2, 2, 0], [3, 3, 0]], true, true)).toThrow(/degenerate|zero projected area/);
    expect(() => trimByClosedCurve(source, rectangle(1, 1, 3, 3).map(([x, y]) => [x, y, 1]), true, true)).toThrow(/source surface/);
    expect(() => trimByClosedCurve(source, rectangle(0, 0, 4, 4), true, true)).toThrow(/retain and remove/);
  });

  it('creates an immutable derived artifact with exact undo, redo, save, reopen, and recovery', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
    const sourceMesh = flatGrid(6); const curvePoints = rectangle(1.2, 1.4, 4.8, 4.6); const artifact = artifactFromMesh('trim-command-source', meshData(sourceMesh));
    const artifacts = new ArtifactManager([artifact]); const scene = new SceneManager(); const object = scene.addFromArtifact(artifact); const editing = new EditingStateManager(); const bus = new CommandBus();
    const curve = setCurveClosed(createPolyline('Closed trim evidence', curvePoints, { objectId: object.id, artifactId: artifact.id }), true); editing.replace({ ...editing.get(), curves: [curve] });
    const response = await executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'cut.trim-curve', meshes: [artifact.mesh], selectionIds: [], parameters: { inside: true }, curvePoints, curveClosed: true });
    await bus.execute(new GeometryEditCommand({ artifacts, scene, editing }, object.id, 'cut.trim-curve', response.output, { allowBoundaries: true, toolParameters: { inside: true } }));
    const derivedId = scene.get(object.id)!.artifactId; const derivedMesh = structuredClone(artifacts.get(derivedId)!.mesh);
    expect(artifacts.get(artifact.id)).toEqual(artifact); expect(derivedId).not.toBe(artifact.id); expect(editing.get().curves[0].artifactId).toBe(derivedId);
    await bus.undo(); expect(scene.get(object.id)?.artifactId).toBe(artifact.id); expect(artifacts.list()).toEqual([artifact]);
    await bus.redo(); expect(scene.get(object.id)?.artifactId).toBe(derivedId); expect(artifacts.get(derivedId)?.mesh).toEqual(derivedMesh);

    const project = createProject('Closed trim persistence'); project.artifacts = artifacts.list(); project.scene = scene.list(); project.editing = editing.get();
    const store = new ProjectStore(); const saved = store.save(project); const reopened = store.open(saved.id);
    expect(reopened.artifacts.find(({ id }) => id === derivedId)?.mesh).toEqual(derivedMesh); expect(reopened.editing.curves[0].artifactId).toBe(derivedId);
    store.autoSave(reopened); const recovered = store.recover()!;
    expect(recovered.artifacts.find(({ id }) => id === derivedId)?.mesh).toEqual(derivedMesh); expect(recovered.editing.geometryVersions.at(-1)?.derivedArtifactId).toBe(derivedId);
  });
});

function flatGrid(size: number): IndexedMesh { return surfaceGrid(size, () => 0); }

function surfaceGrid(size: number, height: (x: number, y: number) => number): IndexedMesh {
  const positions: Vec3[] = []; const faces: Array<[number, number, number]> = [];
  for (let y = 0; y <= size; y += 1) for (let x = 0; x <= size; x += 1) positions.push([x, y, height(x, y)]);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) { const a = y * (size + 1) + x, b = a + 1, c = a + size + 1, d = c + 1; faces.push([a, b, d], [a, d, c]); }
  return { positions, faces };
}

function rectangle(minX: number, minY: number, maxX: number, maxY: number): Vec3[] { return [[minX, minY, 0], [maxX, minY, 0], [maxX, maxY, 0], [minX, maxY, 0]]; }
function insideRectangle([x, y]: Vec3, minX: number, minY: number, maxX: number, maxY: number): boolean { return x >= minX - 1e-9 && x <= maxX + 1e-9 && y >= minY - 1e-9 && y <= maxY + 1e-9; }
function strictlyInsideRectangle([x, y]: Vec3, minX: number, minY: number, maxX: number, maxY: number): boolean { return x > minX + 1e-9 && x < maxX - 1e-9 && y > minY + 1e-9 && y < maxY - 1e-9; }

function maximumTrimBoundaryError(mesh: IndexedMesh, curve: Vec3[]): number {
  const topology = buildTopology(mesh); const ids = new Set(topology.boundaryEdges.flatMap((edge) => topology.edges[edge]));
  return Math.max(...[...ids].map((id) => Math.min(...curve.map((start, index) => pointSegmentDistance(mesh.positions[id], start, curve[(index + 1) % curve.length])))));
}

function pointSegmentDistance(point: Vec3, start: Vec3, end: Vec3): number {
  const segment: Vec3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]]; const lengthSquared = segment[0] ** 2 + segment[1] ** 2 + segment[2] ** 2;
  const amount = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - start[0]) * segment[0] + (point[1] - start[1]) * segment[1] + (point[2] - start[2]) * segment[2]) / lengthSquared)) : 0;
  return Math.hypot(point[0] - start[0] - segment[0] * amount, point[1] - start[1] - segment[1] * amount, point[2] - start[2] - segment[2] * amount);
}

function closestSourcePlaneDistance(point: Vec3, source: IndexedMesh): number {
  let distance = Infinity;
  for (const face of source.faces) {
    const [a, b, c] = face.map((id) => source.positions[id]); const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal: Vec3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]; const length = Math.hypot(...normal);
    if (length) distance = Math.min(distance, Math.abs((point[0] - a[0]) * normal[0] + (point[1] - a[1]) * normal[1] + (point[2] - a[2]) * normal[2]) / length);
  }
  return distance;
}

function assertTrimIntegrity(mesh: IndexedMesh, shellCount: number): void {
  const topology = buildTopology(mesh); expect(topology.nonManifoldEdges).toHaveLength(0); expect(topology.shells).toHaveLength(shellCount); expect(analyzeSelfIntersections(mesh)).toHaveLength(0); expect(boundaryLoops(mesh, topology).length).toBeGreaterThan(0);
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); }
}
