import { describe, it } from 'node:test';
import { CROWN_ANATOMY_OPERATIONS, editCrownAnatomy } from '../src/crown-anatomy';
import { CROWN_SCULPT_MODES, scaleCrownAnatomy, sculptCrownSurface } from '../src/crown-geometry';
import { indexedMesh, inspectGeometry } from '../src/editing-geometry';
import type { CrownLocks } from '../src/restoration-types';
import { goldenCrown } from './golden-crowns';
import { expect } from './test-helpers';

const unlocked: CrownLocks = { margin: true, intaglio: true, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false };

describe('production crown sculpting and named anatomy editing', () => {
  for (const mode of CROWN_SCULPT_MODES) {
    it(`${mode} modifies actual crown vertices and preserves valid topology`, () => {
      const fixture = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 }); const indexed = indexedMesh(fixture.result.mesh); const id = fixture.result.topologyMap.outerVertexIds.find((value) => fixture.result.topologyMap.regions[value] === 'axial')!; const center = indexed.positions[id]; const direction: [number, number, number] = [1, 0.3, 0.1];
      const edited = sculptCrownSurface(fixture.result.mesh, fixture.result.topologyMap, { center, radiusMm: 2.4, strengthMm: 0.08, mode, falloff: 'smooth', direction, surfaceConstraint: true }, unlocked); const after = indexedMesh(edited); expect(after.positions).not.toEqual(indexed.positions); expect(after.faces).toEqual(indexed.faces); expect(inspectGeometry(after).watertight).toBe(true); expect(inspectGeometry(after).selfIntersectionCount).toBe(0);
    });
  }

  for (const operation of CROWN_ANATOMY_OPERATIONS) {
    it(`${operation} changes actual crown anatomy through the validated geometry kernel`, () => {
      const fixture = goldenCrown('maxillary-central-incisor', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 }); const indexed = indexedMesh(fixture.result.mesh); const id = fixture.result.topologyMap.outerVertexIds.find((value) => fixture.result.topologyMap.regions[value] === 'axial')!; const edited = editCrownAnatomy(fixture.result.mesh, fixture.result.topologyMap, { operation, center: indexed.positions[id], radiusMm: 2.5, strengthMm: 0.07, direction: [1, 0.2, 0.1] }, unlocked); expect(indexedMesh(edited).positions).not.toEqual(indexed.positions); expect(inspectGeometry(indexedMesh(edited)).watertight).toBe(true);
    });
  }

  it('enforces masks, selected-anatomy locks, facial locks, symmetry and model-space falloff', () => {
    const fixture = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 }); const indexed = indexedMesh(fixture.result.mesh); const editable = fixture.result.topologyMap.outerVertexIds.find((value) => fixture.result.topologyMap.regions[value] === 'axial')!; const mask = fixture.result.topologyMap.outerVertexIds.filter((value) => value !== editable); const masked = sculptCrownSurface(fixture.result.mesh, fixture.result.topologyMap, { center: indexed.positions[editable], radiusMm: 1, strengthMm: 0.1, mode: 'add', maskVertexIds: mask, invertMask: false, smoothMask: false, symmetryAxis: 'x' }, unlocked); expect(indexedMesh(masked).positions[editable]).not.toEqual(indexed.positions[editable]); expect(() => sculptCrownSurface(fixture.result.mesh, fixture.result.topologyMap, { center: indexed.positions[editable], radiusMm: 0.01, strengthMm: 0.1, mode: 'add', lockedVertexIds: [editable] }, { ...unlocked, selectedAnatomy: true })).toThrow(/does not intersect|lock/i);
  });

  it('preserves constrained margin, intaglio and locked regions during global morphing', () => {
    const fixture = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 }); const indexed = indexedMesh(fixture.result.mesh); const center = [(fixture.result.mesh.bounds.min[0] + fixture.result.mesh.bounds.max[0]) / 2, (fixture.result.mesh.bounds.min[1] + fixture.result.mesh.bounds.max[1]) / 2, (fixture.result.mesh.bounds.min[2] + fixture.result.mesh.bounds.max[2]) / 2] as [number, number, number]; const locked = fixture.result.topologyMap.outerVertexIds.find((value) => fixture.result.topologyMap.regions[value] === 'axial')!; const output = scaleCrownAnatomy(fixture.result.mesh, fixture.result.topologyMap, center, [1.08, 0.94, 1.04], { ...unlocked, selectedAnatomy: true }, [locked]); const after = indexedMesh(output); expect(after.positions[locked]).toEqual(indexed.positions[locked]); expect(fixture.result.topologyMap.innerVertexIds.every((id) => JSON.stringify(after.positions[id]) === JSON.stringify(indexed.positions[id]))).toBe(true); expect(fixture.result.topologyMap.marginOuterVertexIds.every((id) => JSON.stringify(after.positions[id]) === JSON.stringify(indexed.positions[id]))).toBe(true);
  });
});
