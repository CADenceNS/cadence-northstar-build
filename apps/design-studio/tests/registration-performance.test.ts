import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { registerPair } from '../src/registration-engine';
import { axisAngleRigid, composeRigid, invertRigid, rigidFromRotationTranslation } from '../src/registration-math';
import { archArtifact, transformArtifact } from './golden-registration';

describe('measured registration performance and stability', () => {
  for (const fixture of [
    { name: 'small', columns: 15, rows: 11 },
    { name: 'medium', columns: 31, rows: 25 },
    { name: 'large', columns: 65, rows: 50 },
  ]) {
    it(`measures ${fixture.name} scan registration without blocking cooperative yields`, async () => {
      const target = archArtifact(`${fixture.name}-target`, fixture.columns, fixture.rows);
      const known = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [5.5, -3.25, 1.4]), axisAngleRigid([0.2, 0.8, 0.4], 12 * Math.PI / 180));
      const source = transformArtifact(target, invertRigid(known), `${fixture.name}-source`); let yields = 0;
      const heapBefore = process.memoryUsage().heapUsed; const started = performance.now();
      const result = await registerPair({ requestId: fixture.name, source: { artifact: source, role: 'preparation-arch' }, target: { artifact: target, role: 'pre-operative-upper' } }, { yieldControl: async () => { yields += 1; await Promise.resolve(); } });
      const durationMs = performance.now() - started; const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
      console.log('REGISTRATION_PERFORMANCE', JSON.stringify({ case: fixture.name, vertices: target.mesh.sourceTopology!.positions.length / 3, triangles: target.mesh.sourceTopology!.indices.length / 3, durationMs, heapDeltaBytes, cooperativeYields: yields, stageTimings: result.timings }));
      expect(result.outcome).toBe('accepted'); expect(result.metrics.rmsResidual < 0.05).toBe(true); expect(yields).toBeGreaterThan(0); expect(durationMs).toBeGreaterThan(0);
    });
  }

  it('measures multiple simultaneously resident scan registrations deterministically', async () => {
    const target = archArtifact('multi-target', 31, 25); const transforms = [
      rigidFromRotationTranslation([0, 0, 0, 1], [2, 0, 0]),
      composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [-3, 1, 0.5]), axisAngleRigid([0, 0, 1], 6 * Math.PI / 180)),
      composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [1, -4, -0.4]), axisAngleRigid([1, 0, 0], -5 * Math.PI / 180)),
    ];
    const sources = transforms.map((transform, index) => transformArtifact(target, invertRigid(transform), `multi-source-${index}`)); const started = performance.now();
    const results = [];
    for (let index = 0; index < sources.length; index += 1) results.push(await registerPair({ requestId: `multi-${index}`, source: { artifact: sources[index], role: 'reference-scan' }, target: { artifact: target, role: 'upper-arch' } }, { yieldControl: async () => Promise.resolve() }));
    const durationMs = performance.now() - started;
    console.log('REGISTRATION_PERFORMANCE', JSON.stringify({ case: 'multiple', meshes: sources.length + 1, verticesPerMesh: target.mesh.sourceTopology!.positions.length / 3, durationMs, outcomes: results.map((result) => result.outcome) }));
    expect(results.every((result) => result.outcome === 'accepted')).toBe(true); expect(new Set(results.map((result) => result.deterministicFingerprint)).size).toBe(3);
  });
});
