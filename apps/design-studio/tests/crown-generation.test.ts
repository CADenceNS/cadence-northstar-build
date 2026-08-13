import { describe, it } from 'node:test';
import { buildCrownSolid } from '../src/crown-geometry';
import { buildTopology, indexedMesh, inspectGeometry } from '../src/editing-geometry';
import { MORPHOLOGY_DEFINITIONS, defaultCrownParameters, morphologyForTooth, morphologyHeight } from '../src/morphology-core';
import { generateCrownProposal } from '../src/crown-engine';
import { goldenCrown, type GoldenCrownFamily } from './golden-crowns';
import { expect } from './test-helpers';
import { permanentToothDesignation, universalFromFdi, universalFromPalmer } from '../src/tooth-numbering';

describe('CADence procedural crown morphology and solid generation', () => {
  it('maps every permanent Universal tooth number to a governed CADence definition', () => {
    const mapped = Array.from({ length: 32 }, (_, index) => morphologyForTooth(index + 1)); expect(mapped).toHaveLength(32); expect(new Set(mapped.map((value) => value.id)).size).toBe(Object.values(MORPHOLOGY_DEFINITIONS).filter((value) => value.toothNumbers.length).length);
    mapped.forEach((value) => { expect(value.version).toBe('1.0.0'); expect(value.crownDimensionsMm.height).toBeGreaterThan(7); });
  });

  it('maps all 32 permanent teeth reversibly across Universal, FDI and Palmer systems', () => {
    const values = Array.from({ length: 32 }, (_, index) => permanentToothDesignation(index + 1)); expect(new Set(values.map((value) => value.fdi)).size).toBe(32); expect(new Set(values.map((value) => value.palmer)).size).toBe(32); for (const value of values) { expect(universalFromFdi(value.fdi)).toBe(value.universal); expect(universalFromPalmer(value.palmer)).toBe(value.universal); }
  });

  it('records governed anatomy applicability for every active morphology class', () => {
    const active = Object.values(MORPHOLOGY_DEFINITIONS).filter((value) => value.toothNumbers.length); expect(active).toHaveLength(14); expect(active.flatMap((value) => value.toothNumbers).sort((a, b) => a - b)).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
    for (const value of active) { expect(Object.values(value.crownDimensionsMm).every((item) => item > 0)).toBe(true); expect([value.facialContour, value.lingualContour, value.mesialContour, value.distalContour, value.cervicalContour, value.embrasures, value.lineAngles, value.developmentalLobes, value.wear, value.roundness, value.angularity, value.anatomyIntensity].every(Number.isFinite)).toBe(true); expect(value.cusps.length).toBeGreaterThan(0); expect(value.contactZones.mesial).not.toEqual(value.contactZones.distal); expect(value.generatorVersion).toMatch(/^CADENCE-/); expect(value.provenance).toBe('CADence proprietary procedural asset'); expect(value.approvalStatus).toBe('approved'); }
    const posterior = active.filter((value) => value.mamelonCount === 0 && value.cusps.length > 1); expect(posterior.every((value) => value.developmentalGrooves.length > 0 && value.fossae.length > 0 && value.occlusalTable > 0 && value.centralGroove > 0)).toBe(true); expect(posterior.some((value) => value.cusps.some((cusp) => cusp.functional) && value.cusps.some((cusp) => !cusp.functional))).toBe(true); const maxillaryMolars = active.filter((value) => value.id.startsWith('maxillary') && value.id.includes('-molar')); expect(maxillaryMolars.every((value) => value.obliqueRidge > 0)).toBe(true);
  });

  for (const family of ['maxillary-central-incisor', 'maxillary-canine', 'maxillary-first-premolar', 'maxillary-first-molar', 'mandibular-central-incisor', 'mandibular-canine', 'mandibular-first-premolar', 'mandibular-first-molar'] as GoldenCrownFamily[]) {
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
    const fixture = goldenCrown('maxillary-central-incisor'); const input = { ...fixture.input, reference: undefined, referenceAdaptation: { mode: 'none' as const, influence: 0, selectedRegion: null }, parameters: { ...fixture.input.parameters, radialSegments: 24, surfaceRings: 6 } }; const base = buildCrownSolid(input); const coordinates = (value: ReturnType<typeof buildCrownSolid>) => value.topologyMap.innerVertexIds.map((id) => value.indexed.positions[id]);
    const controls = [
      ['marginalGapMm', 0.05], ['cementGapMm', 0.1], ['spacerStartMm', 1.4], ['axialSpacerMm', 0.11], ['occlusalSpacerMm', 0.13], ['localReliefMm', 0.08], ['localSpacerOverrideMm', 0.1], ['sharpFeatureReliefMm', 0.08], ['internalRadiusMm', 1.4], ['millingToolDiameterMm', 1.4], ['toolAccessAllowanceMm', 0.6], ['manufacturingCompensationPercent', 1.1],
    ] as const;
    for (const [parameter, value] of controls) { const changed = coordinates(buildCrownSolid({ ...input, parameters: { ...input.parameters, [parameter]: value } })); if (JSON.stringify(changed) === JSON.stringify(coordinates(base))) throw new Error(`${parameter} did not alter actual inner-surface coordinates.`); }
    const localBase = { ...input, parameters: { ...input.parameters, localSpacerOverrideMm: 0.1 } }; const localCoordinates = coordinates(buildCrownSolid(localBase)); for (const [parameter, value] of [['localSpacerCenterX', 0.45], ['localSpacerCenterY', -0.4], ['localSpacerRadius', 0.9]] as const) expect(coordinates(buildCrownSolid({ ...localBase, parameters: { ...localBase.parameters, [parameter]: value } }))).not.toEqual(localCoordinates);
  });

  it('maps global, directional and local emergence controls to actual outer-surface coordinates while preserving the margin', () => {
    const fixture = goldenCrown('maxillary-central-incisor'); const input = { ...fixture.input, parameters: { ...fixture.input.parameters, radialSegments: 24, surfaceRings: 6 } }; const base = buildCrownSolid(input); const outer = (value: ReturnType<typeof buildCrownSolid>) => value.topologyMap.outerVertexIds.map((id) => value.indexed.positions[id]); const margin = (value: ReturnType<typeof buildCrownSolid>) => value.topologyMap.marginOuterVertexIds.map((id) => value.indexed.positions[id]);
    for (const [parameter, value] of [['emergenceAngleDegrees', 12], ['emergenceConvexity', 1.4], ['emergenceConcavity', 0.7], ['facialEmergence', 1.35], ['lingualEmergence', 1.3], ['mesialEmergence', 1.25], ['distalEmergence', 1.2], ['localEmergenceStrength', 0.35]] as const) { const changed = buildCrownSolid({ ...input, parameters: { ...input.parameters, [parameter]: value } }); if (JSON.stringify(outer(changed)) === JSON.stringify(outer(base))) throw new Error(`${parameter} did not alter actual outer-surface coordinates.`); expect(margin(changed)).toEqual(margin(base)); }
    const localBaseInput = { ...input, parameters: { ...input.parameters, localEmergenceStrength: 0.35 } }; const localBase = buildCrownSolid(localBaseInput); for (const [parameter, value] of [['localEmergenceX', 0.4], ['localEmergenceY', -0.35], ['localEmergenceRadius', 0.65]] as const) { const changed = buildCrownSolid({ ...localBaseInput, parameters: { ...localBaseInput.parameters, [parameter]: value } }); expect(outer(changed)).not.toEqual(outer(localBase)); expect(margin(changed)).toEqual(margin(localBase)); }
  });

  it('implements every registered pre-op/reference adaptation mode on actual model-space geometry', () => {
    const fixture = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 }); const without = generateCrownProposal({ ...fixture.input, requestId: 'reference-none', referenceAdaptation: { mode: 'none', influence: 0, selectedRegion: null } });
    for (const mode of ['copy', 'partial-copy', 'preserve-facial', 'preserve-occlusal-table', 'preserve-selected-region', 'blend'] as const) { const selectedRegion = mode === 'preserve-selected-region' ? { centerX: 0, centerY: 0, radius: 0.75 } : null; const result = generateCrownProposal({ ...fixture.input, requestId: `reference-${mode}`, referenceAdaptation: { mode, influence: 0.7, selectedRegion } }); expect(result.mesh.sourceTopology?.positions).not.toEqual(without.mesh.sourceTopology?.positions); expect(result.inspection.watertight).toBe(true); }
    const anterior = goldenCrown('maxillary-central-incisor', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 }); const anteriorWithout = generateCrownProposal({ ...anterior.input, requestId: 'reference-incisal-none', referenceAdaptation: { mode: 'none', influence: 0, selectedRegion: null } }); const incisal = generateCrownProposal({ ...anterior.input, requestId: 'reference-incisal', referenceAdaptation: { mode: 'preserve-incisal', influence: 0.7, selectedRegion: null } }); expect(incisal.mesh.sourceTopology?.positions).not.toEqual(anteriorWithout.mesh.sourceTopology?.positions);
  });

  it('uses an assigned reference mesh to modify actual proposal geometry', () => {
    const fixture = goldenCrown('maxillary-central-incisor'); const without = generateCrownProposal({ ...fixture.input, requestId: 'without-reference', reference: undefined, referenceAdaptation: { mode: 'none', influence: 0, selectedRegion: null }, contourReferences: fixture.input.contourReferences.filter((value) => value.kind !== 'pre-op') }); expect(fixture.result.mesh.sourceTopology?.positions).not.toEqual(without.mesh.sourceTopology?.positions); expect(fixture.result.contour.status).not.toBe('not-run');
  });

  it('reports exact closed-solid statistics', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const inspection = inspectGeometry(indexedMesh(fixture.result.mesh)); expect(inspection.vertexCount).toBe(fixture.result.topologyMap.outerVertexIds.length + fixture.result.topologyMap.innerVertexIds.length); expect(inspection.triangleCount).toBe(fixture.input.parameters.radialSegments * fixture.input.parameters.surfaceRings * 4); expect(inspection.volumeMm3).toBeGreaterThan(0); expect(inspection.surfaceAreaMm2).toBeGreaterThan(0);
  });
});
