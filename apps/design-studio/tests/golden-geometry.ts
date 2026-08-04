import type { ArtifactRecord, MeshData, Vec3 } from '../src/core';
import { cross3, normalize3, subtract3 } from '../src/geometry';

export type GoldenFixtureName = 'valid-watertight' | 'open-mesh' | 'non-manifold-edge' | 'degenerate-triangle' | 'duplicate-triangle' | 'duplicate-vertex' | 'disconnected-shell' | 'reversed-winding' | 'empty-mesh' | 'invalid-numeric-coordinate' | 'small-isolated-component';

export interface GoldenFixture { name: GoldenFixtureName; artifact: ArtifactRecord; expectedCheck: string; syntheticUse: 'automated geometry validation only'; }

const tetraVertices: Vec3[] = [[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10]];
const tetraFaces = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];

export function goldenGeometryCorpus(): GoldenFixture[] {
  const valid = topology(tetraVertices, tetraFaces);
  const open = topology(tetraVertices, tetraFaces.slice(0, 3));
  const nonManifold = topology([...tetraVertices, [0, -10, 0]], [...tetraFaces, [0, 1, 4]]);
  const degenerate = topology(tetraVertices, [...tetraFaces, [0, 0, 1]]);
  const duplicateTriangle = topology(tetraVertices, [...tetraFaces, [...tetraFaces[0]]]);
  const duplicateVertex = topology([...tetraVertices, [0, 0, 0]], [[4, 2, 1], ...tetraFaces.slice(1)]);
  const disconnected = combineTopology(topology(tetraVertices, tetraFaces), topology(tetraVertices.map(([x, y, z]) => [x + 30, y, z]), tetraFaces));
  const reversed = topology(tetraVertices, tetraFaces.map(([a, b, c]) => [a, c, b]));
  const empty: MeshData = { positions: [], normals: [], indices: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] }, sourceTopology: { positions: [], indices: [] } };
  const invalid = topology([[Number.NaN, 0, 0], [10, 0, 0], [0, 10, 0]], [[0, 1, 2]], false);
  const tinyVertices = tetraVertices.map(([x, y, z]) => [x * 0.001 + 40, y * 0.001, z * 0.001] as Vec3);
  const small = combineTopology(valid, topology(tinyVertices, tetraFaces));
  return [
    fixture('valid-watertight', valid, 'watertight-status'),
    fixture('open-mesh', open, 'open-boundaries'),
    fixture('non-manifold-edge', nonManifold, 'non-manifold-edges'),
    fixture('degenerate-triangle', degenerate, 'degenerate-triangles'),
    fixture('duplicate-triangle', duplicateTriangle, 'duplicate-triangles'),
    fixture('duplicate-vertex', duplicateVertex, 'duplicate-vertices'),
    fixture('disconnected-shell', disconnected, 'disconnected-shells'),
    fixture('reversed-winding', reversed, 'inverted-normal-candidates'),
    fixture('empty-mesh', empty, 'empty-geometry'),
    fixture('invalid-numeric-coordinate', invalid, 'invalid-numeric-coordinates'),
    fixture('small-isolated-component', small, 'extremely-small-components'),
  ];
}

export function artifactFromMesh(name: string, mesh: MeshData): ArtifactRecord {
  return { id: `artifact-${name}`, sourceName: `${name}.ply`, sourceFormat: 'ply', checksum: `sha256-${name}`, importedAt: '2026-08-04T00:00:00.000Z', byteLength: mesh.positions.length * 8, units: 'mm', orientation: 'source', metadata: { syntheticFixture: true }, history: [{ at: '2026-08-04T00:00:00.000Z', action: 'generated-test-fixture' }], mesh };
}

export function topology(vertices: Vec3[], faces: number[][], calculateNormals = true): MeshData {
  const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  for (const face of faces) {
    const points = face.map((index) => vertices[index]) as [Vec3, Vec3, Vec3];
    const normal = calculateNormals && points.every(Boolean) ? normalize3(cross3(subtract3(points[1], points[0]), subtract3(points[2], points[0]))) : [0, 0, 1] as Vec3;
    for (const point of points) { positions.push(...point); normals.push(...normal); indices.push(indices.length); }
  }
  const finite = vertices.filter((point) => point.every(Number.isFinite));
  const min: Vec3 = finite.length ? [Math.min(...finite.map((point) => point[0])), Math.min(...finite.map((point) => point[1])), Math.min(...finite.map((point) => point[2]))] : [0, 0, 0];
  const max: Vec3 = finite.length ? [Math.max(...finite.map((point) => point[0])), Math.max(...finite.map((point) => point[1])), Math.max(...finite.map((point) => point[2]))] : [0, 0, 0];
  return { positions, normals, indices, bounds: { min, max }, sourceTopology: { positions: vertices.flat(), indices: faces.flat() } };
}

function fixture(name: GoldenFixtureName, mesh: MeshData, expectedCheck: string): GoldenFixture { return { name, artifact: artifactFromMesh(name, mesh), expectedCheck, syntheticUse: 'automated geometry validation only' }; }
function combineTopology(first: MeshData, second: MeshData): MeshData {
  const firstSource = first.sourceTopology!; const secondSource = second.sourceTopology!; const offset = firstSource.positions.length / 3;
  const sourcePositions = [...firstSource.positions, ...secondSource.positions]; const sourceIndices = [...firstSource.indices, ...secondSource.indices.map((index) => index + offset)];
  return { positions: [...first.positions, ...second.positions], normals: [...first.normals, ...second.normals], indices: [...first.indices, ...second.indices.map((index) => index + first.positions.length / 3)], bounds: { min: [Math.min(first.bounds.min[0], second.bounds.min[0]), Math.min(first.bounds.min[1], second.bounds.min[1]), Math.min(first.bounds.min[2], second.bounds.min[2])], max: [Math.max(first.bounds.max[0], second.bounds.max[0]), Math.max(first.bounds.max[1], second.bounds.max[1]), Math.max(first.bounds.max[2], second.bounds.max[2])] }, sourceTopology: { positions: sourcePositions, indices: sourceIndices } };
}
