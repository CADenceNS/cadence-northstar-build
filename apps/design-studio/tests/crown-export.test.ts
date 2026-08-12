import { describe, it } from 'node:test';
import { exportAndValidateCrown, validateAllCrownExports } from '../src/crown-export';
import { buildTopology, indexedMesh } from '../src/editing-geometry';
import { goldenCrown } from './golden-crowns';
import { expect } from './test-helpers';

describe('manufacturing crown export and automatic re-import validation', () => {
  for (const format of ['binary-stl', 'ascii-stl', 'obj', 'ply'] as const) {
    it(`round-trips actual crown geometry through ${format}`, async () => {
      const fixture = goldenCrown('maxillary-central-incisor'); const output = await exportAndValidateCrown(fixture.result.mesh, format); const topology = buildTopology(indexedMesh(output.reimportedMesh)); expect(output.bytes.length).toBeGreaterThan(1000); expect(output.roundTrip.passed).toBe(true); expect(output.roundTrip.maximumSurfaceDeviationMm).toBeLessThanOrEqual(0.001); expect(output.roundTrip.watertight).toBe(true); expect(output.roundTrip.selfIntersectionCount).toBe(0); expect(topology.boundaryEdges).toHaveLength(0); expect(topology.nonManifoldEdges).toHaveLength(0);
    });
  }

  it('produces deterministic bytes and checksums for all formats', async () => {
    const fixture = goldenCrown('maxillary-first-molar'); const first = await validateAllCrownExports(fixture.result.mesh); const second = await validateAllCrownExports(fixture.result.mesh); expect(first.map((value) => [...value.bytes])).toEqual(second.map((value) => [...value.bytes])); expect(first.map((value) => value.roundTrip.checksum)).toEqual(second.map((value) => value.roundTrip.checksum));
  });

  it('rejects non-watertight manufacturing output before serialization', async () => {
    const fixture = goldenCrown('maxillary-central-incisor'); const source = fixture.result.mesh.sourceTopology!; const invalid = { ...fixture.result.mesh, sourceTopology: { positions: source.positions, indices: source.indices.slice(3) } }; await expect(exportAndValidateCrown(invalid, 'binary-stl')).rejects.toThrow(/corrupt|open/i);
  });
});
