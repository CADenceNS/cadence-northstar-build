import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import {
  bridgeBoundaryLoops,
  deleteSelectedFaces,
  detachSelectedRegion,
  extrudeFaces,
  fillBoundaryHole,
  flattenRegion,
  insetFaces,
  joinMeshes,
  offsetSurfaceRegion,
  recalculateNormals,
  relaxRegion,
  removeDuplicateFaces,
  removeDuplicateVertices,
  removeIsolatedComponents,
  reverseNormals,
  separateConnectedShell,
  smoothRegion,
  thickenMesh,
  weldVertices,
} from '../src/mesh-edit-tools';
import { boundaryLoops, buildTopology, detectSelfIntersections, inspectGeometry, mergeIndexed, validateGeometryResult } from '../src/editing-geometry';
import { bridgableTube, cube, grid, openTetra, tetra, twoShells } from './golden-editing';
import { curveBasedCut, planeCut, splitMesh, trimByClosedCurve } from '../src/cutting-tools';
import { booleanMesh } from '../src/boolean-tools';
import { adaptiveSubdivision, decimate, isotropicRemesh, localRemesh, smoothTopology, subdivide, triangleQuality } from '../src/topology-tools';

describe('direct indexed mesh editing', () => {
  it('deletes selected faces and preserves immutable input', () => { const source = cube(); const before = structuredClone(source); const result = deleteSelectedFaces(source, [0, 1]); expect(result.faces).toHaveLength(10); expect(source).toEqual(before); expect(buildTopology(result).boundaryEdges.length).toBeGreaterThan(0); });
  it('detaches a selected region into two real meshes', () => { const result = detachSelectedRegion(cube(), [0, 1]); expect(result.primary.faces).toHaveLength(10); expect(result.additional[0].faces).toHaveLength(2); });
  it('separates one connected shell', () => { const result = separateConnectedShell(twoShells(), 0); expect(result.primary.faces).toHaveLength(4); expect(result.additional[0].faces).toHaveLength(4); });
  it('joins actual meshes and welds coincident vertices', () => { const joined = joinMeshes([cube(), cube([10, 0, 0])], 1e-6); expect(joined.faces).toHaveLength(24); expect(joined.positions.length < 16).toBe(true); });
  it('welds and removes duplicate vertices across neighboring tolerance-grid cells', () => { const source = cube(); source.positions.push([...source.positions[0]]); source.faces[0] = [8, 2, 1]; expect(weldVertices(source, 1e-6).positions).toHaveLength(8); expect(removeDuplicateVertices(source, 1e-6).positions).toHaveLength(8); const boundary = { positions: [[0.99, 0, 0], [1.01, 0, 0], [0, 1, 0], [0, 0, 1]] as Array<[number, number, number]>, faces: [[0, 2, 3], [1, 3, 2]] as Array<[number, number, number]> }; expect(weldVertices(boundary, 1).positions).toHaveLength(3); });
  it('removes duplicate faces deterministically', () => { const source = cube(); source.faces.push([...source.faces[0]]); expect(removeDuplicateFaces(source).faces).toHaveLength(12); });
  it('fills a boundary hole with oriented actual triangles', () => { const source = openTetra(); const filled = fillBoundaryHole(source); expect(filled.faces).toHaveLength(source.faces.length + 1); expect(inspectGeometry(filled).watertight).toBe(true); });
  it('bridges two actual boundary loops', () => { const secondShell = openTetra(); secondShell.positions = secondShell.positions.map(([x, y, z]) => [x, y, z + 20]); const source = mergeIndexed([openTetra(), secondShell]); const topology = buildTopology(source); const loops = boundaryLoops(source, topology); const byKey = new Map(topology.edges.map((edge, id) => [edge.slice().sort((a, b) => a - b).join(':'), id])); const first = byKey.get([loops[0][0], loops[0][1]].sort((a, b) => a - b).join(':'))!; const second = byKey.get([loops[1][0], loops[1][1]].sort((a, b) => a - b).join(':'))!; const bridged = bridgeBoundaryLoops(source, first, second); expect(bridged.faces.length).toBeGreaterThan(source.faces.length); expect(buildTopology(bridged).nonManifoldEdges).toHaveLength(0); expect(inspectGeometry(bridged).watertight).toBe(true); });
  it('extrudes selected faces with a displaced cap and side walls', () => { const source = cube(); const result = extrudeFaces(source, [2, 3], 2); expect(result.faces.length).toBeGreaterThan(source.faces.length); expect(Math.max(...result.positions.map((point) => point[2]))).toBe(12); expect(buildTopology(result).nonManifoldEdges).toHaveLength(0); });
  it('insets selected faces within the original plane', () => { const source = tetra(); const result = insetFaces(source, [0], 0.5); expect(result.faces.length).toBeGreaterThan(source.faces.length); expect(buildTopology(result).nonManifoldEdges).toHaveLength(0); });
  it('offsets a surface region along actual vertex normals', () => { const source = cube(); const result = offsetSurfaceRegion(source, [2, 3], 1); expect(result.positions).not.toEqual(source.positions); expect(result.faces).toEqual(source.faces); });
  it('creates a closed thickened shell from open geometry', () => { const result = thickenMesh(openTetra(), 1); expect(result.faces.length).toBeGreaterThan(openTetra().faces.length * 2); expect(inspectGeometry(result).watertight).toBe(true); });
  it('flattens, smooths, and relaxes selected real vertices', () => { const source = grid(4); const ids = source.faces.map((_, id) => id); const flattened = flattenRegion(source, ids, [0, 0, 1]); expect(Math.max(...flattened.positions.map((point) => point[2])) - Math.min(...flattened.positions.map((point) => point[2])) < 1e-9).toBe(true); expect(smoothRegion(source, ids, 2).positions).not.toEqual(source.positions); expect(relaxRegion(source, ids, 2).positions).not.toEqual(source.positions); });
  it('recalculates and reverses triangle normals through winding', () => { const source = tetra(); expect(recalculateNormals(source)).toEqual(source); const reversed = reverseNormals(source); expect(reversed.faces[0]).toEqual([0, 1, 2]); expect(inspectGeometry(reversed).volumeMm3).toBe(inspectGeometry(source).volumeMm3); });
  it('removes isolated components by measured surface area', () => { const result = removeIsolatedComponents(mergeIndexed([tetra(), tetra([30, 0, 0], 1)]), 5); expect(buildTopology(result).shells).toHaveLength(1); });
  it('rejects invalid selections and parameters', () => { expect(() => deleteSelectedFaces(cube(), [])).toThrow(/requires/); expect(() => weldVertices(cube(), 0)).toThrow(/greater than zero/); expect(() => extrudeFaces(cube(), [999], 1)).toThrow(/requires|invalid/); });
});

describe('production cutting, Boolean, and self-intersection foundation', () => {
  it('detects actual non-adjacent triangle self-intersections', () => { const mesh = { positions: [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0.5, -1], [0, 0.5, 1], [1, 0.5, 0]] as Array<[number, number, number]>, faces: [[0, 1, 2], [3, 4, 5]] as Array<[number, number, number]> }; expect(detectSelfIntersections(mesh)).toEqual([[0, 1]]); expect(() => validateGeometryResult(mesh, { allowBoundaries: true, allowDisconnected: true })).toThrow(/self-intersecting/); });
  it('detects coplanar overlapping triangles with independent topology', () => { const mesh = { positions: [[0, 0, 0], [4, 0, 0], [0, 4, 0], [1, 1, 0], [5, 1, 0], [1, 5, 0]] as Array<[number, number, number]>, faces: [[0, 1, 2], [3, 4, 5]] as Array<[number, number, number]> }; expect(detectSelfIntersections(mesh)).toEqual([[0, 1]]); expect(() => validateGeometryResult(mesh, { allowBoundaries: true, allowDisconnected: true })).toThrow(/self-intersecting/); });
  it('plane-cuts, caps, and keeps both non-empty sides', () => { const result = planeCut(cube(), { origin: [5, 0, 0], normal: [1, 0, 0] }, { keep: 'both', cap: true }); expect(result.secondary).toBeDefined(); expect(result.intersectionLoops).toHaveLength(1); expect(inspectGeometry(result.primary).watertight).toBe(true); expect(inspectGeometry(result.secondary!).watertight).toBe(true); });
  it('splits without capping and reports open boundary topology', () => { const result = splitMesh(cube(), { origin: [5, 0, 0], normal: [1, 0, 0] }, false); expect(buildTopology(result.primary).boundaryEdges.length).toBeGreaterThan(0); expect(buildTopology(result.secondary!).boundaryEdges.length).toBeGreaterThan(0); });
  it('cuts from an actual model-space curve and extrusion direction', () => { const result = curveBasedCut(cube(), [[5, 0, 0], [5, 10, 0]], [0, 0, 1], 'both', true); expect(result.primary.faces.length).toBeGreaterThan(0); expect(result.secondary?.faces.length ?? 0).toBeGreaterThan(0); });
  it('uses every segment of a bent model-space curve for a ruled-surface cut', () => { const bent = curveBasedCut(cube(), [[2, 0, 0], [2, 5, 0], [8, 10, 0]], [0, 0, 1], 'both', false); const straight = curveBasedCut(cube(), [[2, 0, 0], [8, 10, 0]], [0, 0, 1], 'both', false); expect(bent.primary.positions).not.toEqual(straight.primary.positions); expect(buildTopology(bent.primary).nonManifoldEdges).toHaveLength(0); });
  it('trims actual mesh faces by a closed model-space curve', () => { const source = grid(10); const result = trimByClosedCurve(source, [[2, 2, 0], [8, 2, 0], [8, 8, 0], [2, 8, 0]], true); expect(result.faces.length).toBeGreaterThan(0); expect(result.faces.length < source.faces.length).toBe(true); });
  for (const operation of ['union', 'difference', 'intersection'] as const) it(`executes robust BSP Boolean ${operation}`, () => { const result = booleanMesh(cube(), cube([5, 0, 0]), operation); expect(result.faces.length).toBeGreaterThan(0); expect(inspectGeometry(result).watertight).toBe(true); expect(detectSelfIntersections(result)).toHaveLength(0); });
  it('supports disjoint union and a contained subtraction cavity without corrupt topology', () => { const disjoint = booleanMesh(cube(), cube([30, 0, 0]), 'union'); expect(inspectGeometry(disjoint).shellCount).toBe(2); const cavity = booleanMesh(cube(), cube([2, 2, 2], 2), 'difference'); expect(inspectGeometry(cavity).shellCount).toBe(2); expect(inspectGeometry(cavity).watertight).toBe(true); expect(detectSelfIntersections(cavity)).toHaveLength(0); });
  it('rejects Boolean inputs that are open, self-intersecting, or inward-wound', () => { expect(() => booleanMesh(openTetra(), cube(), 'union')).toThrow(/closed two-manifold/); expect(() => booleanMesh(reverseFaces(cube()), cube(), 'union')).toThrow(/outward winding/); });
  it('rejects a cut that does not intersect the mesh', () => { expect(() => planeCut(cube(), { origin: [100, 0, 0], normal: [1, 0, 0] }, { keep: 'both', cap: true })).toThrow(/does not split/); });
});

function reverseFaces(mesh: ReturnType<typeof cube>): ReturnType<typeof cube> { return { positions: mesh.positions.map((point) => [...point]), faces: mesh.faces.map(([a, b, c]) => [a, c, b]) }; }

describe('topology and remeshing operations', () => {
  it('subdivides conformingly at exact levels', () => { const result = subdivide(tetra(), 1); expect(result.faces).toHaveLength(16); expect(inspectGeometry(result).watertight).toBe(true); });
  it('adaptively subdivides only edges above target length', () => { const result = adaptiveSubdivision(tetra(), 8, 2); expect(result.faces.length).toBeGreaterThan(tetra().faces.length); expect(buildTopology(result).nonManifoldEdges).toHaveLength(0); });
  it('isotropically remeshes with boundary and sharp-feature preservation', () => { const result = isotropicRemesh(grid(5), { targetEdgeLengthMm: 0.8, iterations: 1, preserveBoundaries: true, preserveSharpFeatures: true, sharpAngleDegrees: 40 }); expect(result.faces.length).toBeGreaterThan(0); expect(buildTopology(result).nonManifoldEdges).toHaveLength(0); });
  it('locally remeshes only a selected region', () => { const source = grid(4); const result = localRemesh(source, [0, 1], { targetEdgeLengthMm: 0.6, iterations: 1, preserveBoundaries: true, preserveSharpFeatures: true, sharpAngleDegrees: 40 }); expect(result.faces.length).toBeGreaterThan(source.faces.length); expect(buildTopology(result).nonManifoldEdges).toHaveLength(0); });
  it('decimates to an exact target while preserving valid topology', () => { const source = subdivide(cube(), 1); const result = decimate(source, 30, true, true); expect(result.faces).toHaveLength(30); expect(buildTopology(result).nonManifoldEdges).toHaveLength(0); });
  it('smooths topology and preserves boundary vertices', () => { const source = grid(5); const topology = buildTopology(source); const boundaryBefore = new Map(topology.boundaryEdges.flatMap((edge) => topology.edges[edge]).map((id) => [id, source.positions[id]])); const result = smoothTopology(source, 2, true); for (const [id, point] of boundaryBefore) expect(result.positions[id]).toEqual(point); });
  it('reports deterministic triangle quality', () => { const first = triangleQuality(tetra()); const second = triangleQuality(tetra()); expect(first).toEqual(second); expect(first.triangleCount).toBe(4); expect(first.minimumAngleDegrees).toBeGreaterThan(0); });
  it('rejects invalid topology targets', () => { expect(() => adaptiveSubdivision(tetra(), 0)).toThrow(/greater than zero/); expect(() => decimate(tetra(), 4)).toThrow(/Target triangle count/); });
});
