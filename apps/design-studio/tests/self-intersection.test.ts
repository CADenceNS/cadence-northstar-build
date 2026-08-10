import { describe, it } from 'node:test';
import type { SceneObject, Vec3 } from '../src/core';
import {
  analyzeSelfIntersections,
  classifyTrianglePairIntersection,
  mergeIndexed,
  meshData,
  type IndexedMesh,
  type TriangleIntersectionClassification,
} from '../src/editing-geometry';
import { validateMeshArtifact } from '../src/mesh-validation';
import { buildValidationOverlays } from '../src/validation-overlays';
import { artifactFromMesh } from './golden-geometry';
import { expect } from './test-helpers';

describe('shared-topology self-intersection corpus', () => {
  it('detects an independent non-coplanar crossing with an intersection segment', () => {
    const result = single(independentCrossing());
    expect(result.classification).toBe('non-coplanar-crossing');
    expect(result.geometry).toBe('segment');
    expect(result.points).toHaveLength(2);
  });

  it('detects a positive-area coplanar overlap', () => {
    const result = single(coplanarOverlap());
    expect(result.classification).toBe('coplanar-overlap');
    expect(result.geometry).toBe('area');
    expect(result.points.length).toBeGreaterThan(2);
  });

  it('accepts legitimate shared-vertex adjacency in one connected fan', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [-2, 0, 0], [0, -2, 0]], faces: [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1]] };
    const pair = classifyTrianglePairIntersection(mesh, 0, 2)!;
    expect(pair.classification).toBe('legitimate-shared-vertex');
    expect(pair.invalid).toBe(false);
    expect(analyzeSelfIntersections(mesh)).toHaveLength(0);
  });

  it('accepts consistently oriented shared-edge adjacency', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], faces: [[0, 1, 2], [0, 2, 3]] };
    const pair = classifyTrianglePairIntersection(mesh, 0, 1)!;
    expect(pair.classification).toBe('legitimate-shared-edge');
    expect(pair.invalid).toBe(false);
    expect(analyzeSelfIntersections(mesh)).toHaveLength(0);
  });

  it('detects a shared-vertex triangle crossing beyond the shared point', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [1, 1, -1], [1, 1, 1]], faces: [[0, 1, 2], [0, 3, 4]] };
    expect(single(mesh).classification).toBe('shared-vertex-crossing');
  });

  it('detects shared-edge faces that overlap beyond the legitimate edge', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [0.5, 1, 0]], faces: [[0, 1, 2], [1, 0, 3]] };
    expect(single(mesh).classification).toBe('shared-edge-fold-through');
  });

  it('detects disconnected triangle fans at a bow-tie vertex', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [-2, 0, 1], [0, -2, 1]], faces: [[0, 1, 2], [0, 3, 4]] };
    expect(single(mesh).classification).toBe('bow-tie-topology');
  });

  it('does not report triangles separated by a near-touching positive gap', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [0, 0, 1e-5], [2, 0, 1e-5], [0, 2, 1e-5]], faces: [[0, 1, 2], [3, 4, 5]] };
    expect(analyzeSelfIntersections(mesh)).toHaveLength(0);
  });

  it('classifies independent exact point contact as degenerate topology contact', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [0, 0, 0], [-2, 0, 0], [0, -2, 0]], faces: [[0, 1, 2], [3, 4, 5]] };
    expect(single(mesh).classification).toBe('degenerate-point-contact');
  });

  it('classifies independent exact edge contact as degenerate topology contact', () => {
    const mesh: IndexedMesh = { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [0, 0, 0], [2, 0, 0], [0, -2, 0]], faces: [[0, 1, 2], [3, 4, 5]] };
    expect(single(mesh).classification).toBe('degenerate-edge-contact');
  });

  it('reports deterministic dense mixed defects through validation, object ownership, overlay, and zoom bounds', () => {
    const dense = mergeIndexed([independentCrossing(), translate(coplanarOverlap(), [10, 0, 0]), translate(foldedEdge(), [20, 0, 0])]);
    const first = analyzeSelfIntersections(dense, 'scene-dense');
    const second = analyzeSelfIntersections(dense, 'scene-dense');
    expect(second).toEqual(first);
    expect(classes(first)).toContain('non-coplanar-crossing');
    expect(classes(first)).toContain('coplanar-overlap');
    expect(classes(first)).toContain('shared-edge-fold-through');
    expect(first.every(({ objectId }) => objectId === 'scene-dense')).toBe(true);

    const artifact = artifactFromMesh('dense-self-intersection', meshData(dense));
    const validation = validateMeshArtifact(artifact, {}, 'scene-dense');
    const check = validation.checks.find(({ id }) => id === 'self-intersections')!;
    expect(check.status).toBe('fail');
    expect(check.affectedCount).toBe(first.length);
    const overlays = buildValidationOverlays(validation, sceneObject('scene-dense', artifact.id));
    const overlay = overlays.find(({ checkId }) => checkId === 'self-intersections')!;
    expect(overlay.elementCount).toBe(first.length);
    expect(overlay.positions.length).toBeGreaterThan(0);
    expect(overlay.bounds.max[0] > overlay.bounds.min[0]).toBe(true);
  });
});

function independentCrossing(): IndexedMesh {
  return { positions: [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0.5, -1], [0, 0.5, 1], [1, 0.5, 0]], faces: [[0, 1, 2], [3, 4, 5]] };
}

function coplanarOverlap(): IndexedMesh {
  return { positions: [[0, 0, 0], [4, 0, 0], [0, 4, 0], [1, 1, 0], [5, 1, 0], [1, 5, 0]], faces: [[0, 1, 2], [3, 4, 5]] };
}

function foldedEdge(): IndexedMesh {
  return { positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0], [0.5, 1, 0]], faces: [[0, 1, 2], [1, 0, 3]] };
}

function translate(mesh: IndexedMesh, offset: Vec3): IndexedMesh {
  return { positions: mesh.positions.map(([x, y, z]) => [x + offset[0], y + offset[1], z + offset[2]]), faces: mesh.faces.map((face) => [...face]) };
}

function single(mesh: IndexedMesh) {
  const results = analyzeSelfIntersections(mesh, 'scene-fixture');
  expect(results).toHaveLength(1);
  return results[0];
}

function classes(results: Array<{ classification: TriangleIntersectionClassification }>): TriangleIntersectionClassification[] {
  return results.map(({ classification }) => classification);
}

function sceneObject(id: string, artifactId: string): SceneObject {
  return { id, name: id, type: 'reference', artifactId, visible: true, isolated: false, locked: false, selected: true, transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [1, 1, 1, 1], opacity: 1, metallic: 0, roughness: 1 }, metadata: {} };
}
