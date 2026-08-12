import { describe, it } from 'node:test';
import { buildCrownSolid } from '../src/crown-geometry';
import { buildTopology, indexedMesh, inspectGeometry } from '../src/editing-geometry';
import { MORPHOLOGY_DEFINITIONS, defaultCrownParameters, morphologyForTooth, morphologyHeight } from '../src/morphology-core';
import { generateCrownProposal } from '../src/crown-engine';
import { goldenCrown, type GoldenCrownFamily } from './golden-crowns';
import { expect } from './test-helpers';

describe('CADence procedural crown morphology and solid generation', () => {
  it('maps every permanent Universal tooth number to a governed CADence definition', () => {
    const mapped = Array.from({ length: 32 }, (_, index) => morphologyForTooth(index + 1)); expect(mapped).toHaveLength(32); expect(new Set(mapped.map((value) => value.id)).size).toBe(Object.keys(MORPHOLOGY_DEFINITIONS).length);
    mapped.forEach((value) => { expect(value.version).toBe('1.0.0'); expect(value.crownDimensionsMm.height).toBeGreaterThan(7); });
  });

  for (const family of ['maxillary-central-incisor', 'maxillary-canine', 'maxillary-first-premolar', 'maxillary-first-molar', 'mandibular-incisor', 'mandibular-premolar', 'mandibular-first-molar'] as GoldenCrownFamily[]) {
    it(`generates a deterministic actual watertight ${family} crown with intaglio`, () => {
      const first = goldenCrown(family); const second = generateCrownProposal({ ...first.input, requestId: `${first.input.requestId}-repeat` }); const topology = buildTopology(indexedMesh(first.result.mesh));
      expect(first.result.inspection.watertight).toBe(true); expect(first.result.inspection.shellCount).toBe(1); expect(first.result.inspection.selfIntersectionCount).toBe(0); expect(topology.boundaryEdges).toHaveLength(0); expect(topology.nonManifoldEdges).toHaveLength(0); expect(first.result.topologyMap.innerVertexIds.length).toBeGreaterThan(first.result.topologyMap.marginInnerVertexIds.length); expect(first.result.mesh.sourceTopology).toEqual(second.mesh.sourceTopology); expect(first.result.thickness.failingVertexIds).toHaveLength(0); expect(first.result.cementSpace.status).toBe('pass'); expect(first.result.seating.status).toBe('pass');
    });
  }

  it('responds to cusp, groove, ridge, wear, lobe and mamelon anatomy controls', () => {
    const definition = morphologyForTooth(8); const base = defaultCrownParameters(8); const samples = [[0, 0], [-0.4, -0.1], [0.3, 0.3]] as Array<[number, number]>; const original = samples.map(([x, y]) => morphologyHeight(definition, base, x, y));
    const changed = samples.map(([x, y]) => morphologyHeight(definition, { ...base, cuspHeight: 1.5, grooveDepth: 1.5, ridgeIntensity: 1.5, wear: 0.55, lobeIntensity: 1.4, mamelonIntensity: 1.4 }, x, y)); expect(changed).not.toEqual(original);
  });

  it('maps every exposed anatomy parameter to deterministic model-space geometry', () => {
    const samples = [-0.84, -0.58, -0.3, 0, 0.3, 0.58, 0.84].flatMap((x) => [-0.72, -0.36, 0, 0.36, 0.72].flatMap((y) => Math.hypot(x, y) <= 1.05 ? [[x, y] as [number, number]] : []));
    const controls = [
      ['mesiodistalScale', 1.18], ['buccolingualScale', 0.82], ['heightScale', 1.12], ['facialContour', 1.35], ['lingualContour', 1.3], ['mesialContour', 1.4], ['distalContour', 1.35], ['cervicalContour', 1.25],
      ['cuspHeight', 1.35], ['cuspInclination', 1.45], ['ridgeIntensity', 1.4], ['grooveDepth', 1.35], ['occlusalTableScale', 1.22], ['embrasureScale', 1.45], ['contactZoneScale', 1.5], ['lineAngleIntensity', 1.4],
      ['wear', 0.55], ['roundness', 0.15], ['angularity', 0.9], ['anatomyIntensity', 1.2],
    ] as const;
    const definition = morphologyForTooth(3); const base = defaultCrownParameters(3); const original = samples.map(([x, y]) => morphologyHeight(definition, base, x, y));
    for (const [parameter, value] of controls) {
      const changed = samples.map(([x, y]) => morphologyHeight(definition, { ...base, [parameter]: value }, x, y));
      expect(changed).not.toEqual(original);
    }
    const anterior = morphologyForTooth(8); const anteriorBase = defaultCrownParameters(8); const anteriorOriginal = samples.map(([x, y]) => morphologyHeight(anterior, anteriorBase, x, y));
    for (const [parameter, value] of [['lobeIntensity', 1.5], ['mamelonIntensity', 1.5]] as const) expect(samples.map(([x, y]) => morphologyHeight(anterior, { ...anteriorBase, [parameter]: value }, x, y))).not.toEqual(anteriorOriginal);
  });

  it('maps every exposed intaglio parameter to actual inner-surface coordinates', () => {
    const fixture = goldenCrown('maxillary-central-incisor'); const input = { ...fixture.input, referenceMesh: undefined, parameters: { ...fixture.input.parameters, radialSegments: 24, surfaceRings: 6 } }; const base = buildCrownSolid(input); const coordinates = (value: ReturnType<typeof buildCrownSolid>) => value.topologyMap.innerVertexIds.map((id) => value.indexed.positions[id]);
    const controls = [
      ['marginalGapMm', 0.05], ['cementGapMm', 0.1], ['spacerStartMm', 1.4], ['axialSpacerMm', 0.11], ['occlusalSpacerMm', 0.13], ['localReliefMm', 0.08], ['internalRadiusMm', 1.4], ['manufacturingCompensationPercent', 1.1],
    ] as const;
    for (const [parameter, value] of controls) expect(coordinates(buildCrownSolid({ ...input, parameters: { ...input.parameters, [parameter]: value } }))).not.toEqual(coordinates(base));
  });

  it('uses an assigned reference mesh to modify actual proposal geometry', () => {
    const fixture = goldenCrown('maxillary-central-incisor'); const without = generateCrownProposal({ ...fixture.input, requestId: 'without-reference', referenceMesh: undefined }); expect(fixture.result.mesh.sourceTopology?.positions).not.toEqual(without.mesh.sourceTopology?.positions); expect(fixture.result.contour.status).not.toBe('not-run');
  });

  it('reports exact closed-solid statistics', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const inspection = inspectGeometry(indexedMesh(fixture.result.mesh)); expect(inspection.vertexCount).toBe(fixture.result.topologyMap.outerVertexIds.length + fixture.result.topologyMap.innerVertexIds.length); expect(inspection.triangleCount).toBe(fixture.input.parameters.radialSegments * fixture.input.parameters.surfaceRings * 4); expect(inspection.volumeMm3).toBeGreaterThan(0); expect(inspection.surfaceAreaMm2).toBeGreaterThan(0);
  });
});
