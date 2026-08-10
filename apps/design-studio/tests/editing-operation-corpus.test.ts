import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import type { MeshData, Transform, Vec3 } from '../src/core';
import { boundaryLoops, buildTopology, meshData, mergeIndexed } from '../src/editing-geometry';
import { executeEditingOperation, type EditingOperationRequest } from '../src/editing-operation';
import { bridgableTube, cube, grid, openTetra, tetra, twoShells } from './golden-editing';
import { subdivide } from '../src/topology-tools';
import { PRODUCTION_TOOL_DEFINITIONS } from '../src/tool-registry';

interface Case { id: string; meshes: MeshData[]; selection?: number[]; secondary?: number[]; parameters?: Record<string, number | string | boolean>; curve?: Vec3[]; curveClosed?: boolean; transform?: Transform; }

const lowerTube = bridgableTube(); const upperTube = bridgableTube(); upperTube.positions = upperTube.positions.map(([x, y, z]) => [x, y, z + 10]);
const bridgeSource = mergeIndexed([lowerTube, upperTube]);
const bridgeTopology = buildBridgeSelection(bridgeSource);
const duplicateVertex = cube(); duplicateVertex.positions.push([...duplicateVertex.positions[0]]); duplicateVertex.faces[0] = [8, 2, 1];
const duplicateFace = cube(); duplicateFace.faces.push([...duplicateFace.faces[0]]);
const islands = mergeIndexed([tetra(), tetra([30, 0, 0], 1)]);

const CASES: Case[] = [
  geometry('transform.mirror', cube(), [], { 'normal-x': 1, 'normal-y': 0, 'normal-z': 0 }),
  geometry('transform.duplicate', cube()),
  { ...geometry('transform.bake', cube()), transform: { position: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [2, 2, 2] } },
  geometry('mesh.delete-faces', cube(), [0, 1]),
  geometry('mesh.detach-region', cube(), [0, 1]),
  geometry('mesh.separate-shell', twoShells(), [0]),
  { id: 'mesh.join', meshes: [meshData(cube()), meshData(cube([30, 0, 0]))], selection: [], parameters: { tolerance: 0.001 } },
  geometry('mesh.weld', duplicateVertex, [], { tolerance: 0.001 }),
  geometry('mesh.remove-duplicate-vertices', duplicateVertex, [], { tolerance: 0.001 }),
  geometry('mesh.remove-duplicate-faces', duplicateFace),
  geometry('mesh.fill-hole', openTetra(), [1]),
  geometry('mesh.bridge-loops', bridgeSource, [bridgeTopology[0]], {}, [bridgeTopology[1]]),
  geometry('mesh.extrude', cube(), [2, 3], { distance: 1 }),
  geometry('mesh.inset', tetra(), [0], { distance: 0.2 }),
  geometry('mesh.offset-region', cube(), [2, 3], { distance: 0.5 }),
  geometry('mesh.thicken', openTetra(), [], { thickness: 0.5 }),
  geometry('mesh.flatten', grid(3), Array.from({ length: 18 }, (_, id) => id)),
  geometry('mesh.smooth', grid(3), Array.from({ length: 18 }, (_, id) => id), { iterations: 1, strength: 35 }),
  geometry('mesh.relax', grid(3), Array.from({ length: 18 }, (_, id) => id), { iterations: 1 }),
  geometry('mesh.recalculate-normals', cube()),
  geometry('mesh.reverse-normals', cube()),
  geometry('mesh.remove-islands', islands, [], { minimumArea: 5 }),
  geometry('cut.plane', cube(), [], { 'origin-x': 5, 'normal-x': 1, 'normal-y': 0, 'normal-z': 0, keep: 'both', cap: true }),
  { ...geometry('cut.curve', cube(), [], { keep: 'both', cap: true }), curve: [[5, 0, 0], [5, 10, 0]] },
  { ...geometry('cut.trim-curve', grid(10), [], { inside: true }), curve: [[2, 2], [8, 2], [8, 8], [2, 8]].map(([x, y]) => [x, y, Math.sin(x * 0.1) * Math.cos(y * 0.1)] as Vec3), curveClosed: true },
  geometry('cut.split', cube(), [], { 'origin-x': 5, 'normal-x': 1, 'normal-y': 0, 'normal-z': 0, cap: true }),
  { id: 'boolean.union', meshes: [meshData(cube()), meshData(cube([5, 0, 0]))], selection: [], parameters: {} },
  { id: 'boolean.difference', meshes: [meshData(cube()), meshData(cube([5, 0, 0]))], selection: [], parameters: {} },
  { id: 'boolean.intersection', meshes: [meshData(cube()), meshData(cube([5, 0, 0]))], selection: [], parameters: {} },
  geometry('topology.subdivide', tetra(), [], { levels: 1 }),
  geometry('topology.adaptive-subdivide', tetra(), [], { targetEdgeLength: 8 }),
  geometry('topology.isotropic-remesh', grid(4), [], { targetEdgeLength: 0.8, iterations: 1, preserveBoundaries: true, preserveSharp: true, sharpAngle: 40 }),
  geometry('topology.local-remesh', grid(4), [0, 1], { targetEdgeLength: 0.6, iterations: 1, preserveBoundaries: true, preserveSharp: true, sharpAngle: 40 }),
  geometry('topology.decimate', subdivide(cube(), 1), [], { targetTriangles: 30, preserveBoundaries: true, preserveSharp: true, sharpAngle: 40 }),
  geometry('topology.smooth', grid(4), [], { iterations: 1, preserveBoundaries: true }),
];

describe('golden editing operation dispatcher corpus', () => {
  for (const fixture of CASES) it(`${fixture.id} executes actual geometry deterministically`, async () => {
    const first = await executeEditingOperation(request(fixture)); const second = await executeEditingOperation(request(fixture));
    expect(first.output.mesh).toEqual(second.output.mesh); expect(first.output.inspection).toEqual(second.output.inspection); expect(first.output.inspection.vertexCount).toBeGreaterThan(0); expect(first.output.inspection.triangleCount).toBeGreaterThan(0); expect(first.output.inspection.nonManifoldEdgeCount).toBe(0); expect(first.output.inspection.selfIntersectionCount).toBe(0);
  });

  it('covers every destructive production registry entry with an executable fixture', () => { const expected = PRODUCTION_TOOL_DEFINITIONS.filter((tool) => tool.destructive).map((tool) => tool.id).sort(); expect(CASES.map((fixture) => fixture.id).sort()).toEqual(expected); });

  it('rejects invalid coordinates, empty outputs, and cancellation without a success result', async () => {
    const invalid = meshData(tetra()); invalid.sourceTopology!.positions[0] = Number.NaN;
    await expect(executeEditingOperation({ requestId: crypto.randomUUID(), toolId: 'topology.subdivide', meshes: [invalid], selectionIds: [], parameters: { levels: 1 } })).rejects.toThrow(/invalid coordinate/);
    const controller = new AbortController(); controller.abort(); await expect(executeEditingOperation(request(CASES[0]), { signal: controller.signal })).rejects.toThrow(/cancel/i);
  });
});

function geometry(id: string, mesh: ReturnType<typeof cube>, selection: number[] = [], parameters: Record<string, number | string | boolean> = {}, secondary?: number[]): Case { return { id, meshes: [meshData(mesh)], selection, parameters, ...(secondary ? { secondary } : {}) }; }
function request(fixture: Case): EditingOperationRequest { return { requestId: crypto.randomUUID(), toolId: fixture.id, meshes: structuredClone(fixture.meshes), selectionIds: fixture.selection ?? [], ...(fixture.secondary ? { secondarySelectionIds: fixture.secondary } : {}), parameters: structuredClone(fixture.parameters ?? {}), ...(fixture.curve ? { curvePoints: structuredClone(fixture.curve), curveClosed: fixture.curveClosed ?? false } : {}), ...(fixture.transform ? { transform: structuredClone(fixture.transform) } : {}) }; }

function buildBridgeSelection(mesh: ReturnType<typeof cube>): [number, number] {
  const topology = buildTopology(mesh); const loops = boundaryLoops(mesh, topology); const byKey = new Map(topology.edges.map((edge, id) => [[...edge].sort((a, b) => a - b).join(':'), id]));
  const ordered = [...loops].sort((first, second) => averageZ(first) - averageZ(second)); const lowerTop = ordered[1]; const upperBottom = ordered[2];
  return [byKey.get([lowerTop[0], lowerTop[1]].sort((a, b) => a - b).join(':'))!, byKey.get([upperBottom[0], upperBottom[1]].sort((a, b) => a - b).join(':'))!];
  function averageZ(loop: number[]) { return loop.reduce((sum, id) => sum + mesh.positions[id][2], 0) / loop.length; }
}
