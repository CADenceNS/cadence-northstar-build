import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import type { MeasurementAnchor, MeasurementKind, SceneObject, Vec3 } from '../src/core';
import { createMeasurement, formatMeasurement } from '../src/measurements';
import { artifactFromMesh, topology } from './golden-geometry';

const mesh = topology([[0, 0, 0], [10, 0, 0], [0, 10, 0], [0, 0, 10]], [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]]);
const firstArtifact = artifactFromMesh('measurement-a', mesh);
const secondArtifact = artifactFromMesh('measurement-b', mesh);
const firstObject = sceneObject('object-a', firstArtifact.id, [0, 0, 0]);
const secondObject = sceneObject('object-b', secondArtifact.id, [20, 0, 0]);

describe('actual-geometry measurement calculations', () => {
  it('calculates point-to-point distance in millimeters', () => expect(measure('point-distance', [anchor([0, 0, 0]), anchor([3, 4, 0])]).value).toBe(5));
  it('calculates a multi-segment path', () => expect(measure('multi-segment-distance', [anchor([0, 0, 0]), anchor([3, 4, 0]), anchor([3, 4, 12])]).value).toBe(17));
  it('calculates a three-point angle', () => { const result = measure('three-point-angle', [anchor([1, 0, 0]), anchor([0, 0, 0]), anchor([0, 1, 0])]); expect(result.value).toBeCloseTo(90); expect(result.units).toBe('degrees'); });
  it('reports object bounding dimensions from loaded geometry', () => { const result = measure('bounding-dimensions', [], ['object-a']); expect(result.values).toEqual({ width: 10, height: 10, depth: 10 }); expect(formatMeasurement(result)).toBe('10.00 × 10.00 × 10.00 mm'); });
  it('reports a surface point coordinate', () => { const result = measure('surface-coordinate', [anchor([1.25, 2.5, 3.75])]); expect(result.values).toEqual({ x: 1.25, y: 2.5, z: 3.75 }); });
  it('calculates cross-section anchor distance on the same mesh', () => expect(measure('cross-section-distance', [anchor([0, 0, 0]), anchor([0, 6, 8])]).value).toBe(10));
  it('calculates local clearance to the second selected surface', () => { const result = measure('clearance-distance', [anchor([10, 0, 0])], ['object-a', 'object-b']); expect(result.value).toBeCloseTo(10); expect(result.anchors[1].objectId).toBe('object-b'); });
  it('calculates exact minimum triangle distance between selected objects', () => { const result = measure('minimum-object-distance', [], ['object-a', 'object-b']); expect(result.value).toBeCloseTo(10); expect(result.anchors).toHaveLength(2); });
  it('returns zero for intersecting triangle interiors', () => {
    const horizontal = artifactFromMesh('horizontal', topology([[-2, -2, 0], [2, -2, 0], [0, 2, 0]], [[0, 1, 2]]));
    const vertical = artifactFromMesh('vertical', topology([[0, -1, -2], [0, 1, 2], [0, 2, -2]], [[0, 1, 2]]));
    const result = createMeasurement({ kind: 'minimum-object-distance', anchors: [], objectIds: ['horizontal', 'vertical'], artifacts: [horizontal, vertical], scene: [sceneObject('horizontal', horizontal.id, [0, 0, 0]), sceneObject('vertical', vertical.id, [0, 0, 0])] });
    expect(result.value).toBe(0);
  });
  it('applies persisted quaternion rotation to geometry measurements', () => {
    const rectangle = artifactFromMesh('rectangle', topology([[0, 0, 0], [4, 0, 0], [0, 2, 0]], [[0, 1, 2]]));
    const object = sceneObject('rotated', rectangle.id, [0, 0, 0]);
    object.transform.rotation = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    const result = createMeasurement({ kind: 'bounding-dimensions', anchors: [], objectIds: [object.id], artifacts: [rectangle], scene: [object] });
    expect(result.values.width).toBeCloseTo(2);
    expect(result.values.height).toBeCloseTo(4);
  });
});

function measure(kind: MeasurementKind, anchors: MeasurementAnchor[], objectIds = ['object-a']) { return createMeasurement({ kind, anchors, objectIds, artifacts: [firstArtifact, secondArtifact], scene: [firstObject, secondObject], precision: 2 }); }
function anchor(position: Vec3): MeasurementAnchor { return { id: crypto.randomUUID(), position, objectId: 'object-a', artifactId: firstArtifact.id, triangleIndex: 0 }; }
function sceneObject(id: string, artifactId: string, position: Vec3): SceneObject { return { id, name: id, type: 'reference', artifactId, visible: true, isolated: false, locked: false, selected: true, transform: { position, rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [1, 1, 1, 1], opacity: 1, metallic: 0, roughness: 1 }, metadata: {} }; }
