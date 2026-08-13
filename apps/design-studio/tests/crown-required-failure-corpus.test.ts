import { describe, it } from 'node:test';
import { analyzeOcclusion, analyzeProximalContact, autoThickenCrown, calculateThickness, simulateSeating } from '../src/crown-analysis';
import { createCrownExportRecords, validateAllCrownExports } from '../src/crown-export';
import { buildCrownSolid } from '../src/crown-geometry';
import { runCrownQc } from '../src/crown-qc';
import { indexedMesh, meshData, validateGeometryResult, type IndexedMesh } from '../src/editing-geometry';
import { CROWN_MATERIAL_PROFILES } from '../src/morphology-core';
import type { MeshData } from '../src/core';
import type { RestorationRecord } from '../src/restoration-types';
import { boxMesh, goldenCrown } from './golden-crowns';
import { expect } from './test-helpers';

const fixture = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 });

describe('required production crown failure corpus', () => {
  it('rejects no approved margin', () => {
    expect(() => buildCrownSolid({ ...fixture.input, marginPoints: [] })).toThrow(/margin|eight/i);
  });

  it('rejects an invalid margin', () => {
    const margin = structuredClone(fixture.input.marginPoints); margin[0][0] = Number.NaN;
    expect(() => buildCrownSolid({ ...fixture.input, marginPoints: margin })).toThrow(/finite|margin/i);
  });

  it('rejects a self-intersecting margin', () => {
    const margin = structuredClone(fixture.input.marginPoints); [margin[1], margin[12]] = [margin[12], margin[1]];
    expect(() => buildCrownSolid({ ...fixture.input, marginPoints: margin })).toThrow(/self-intersect|geometry|triangle/i);
  });

  it('fails an impossible seating path', () => {
    const solid = buildCrownSolid(fixture.input); const bounds = fixture.result.mesh.bounds; const blocker = boxMesh([bounds.min[0] - 2, bounds.min[1] - 2, bounds.min[2] - 2], [bounds.max[0] + 2, bounds.max[1] + 2, bounds.max[2] + 2]); const result = simulateSeating(solid, { ...fixture.input, preparationMesh: blocker });
    expect(result.status).toBe('fail'); expect(result.seated).toBe(false); expect(result.blockingVertexIds.length).toBeGreaterThan(0);
  });

  it('fails seating against a severe circumferential undercut', () => {
    const solid = buildCrownSolid(fixture.input); const bounds = fixture.result.mesh.bounds; const undercutBand = boxMesh([bounds.min[0] - 0.2, bounds.min[1] - 0.2, bounds.min[2] + 0.4], [bounds.max[0] + 0.2, bounds.max[1] + 0.2, bounds.max[2] - 0.3]); const result = simulateSeating(solid, { ...fixture.input, preparationMesh: undercutBand });
    expect(result.status).toBe('fail'); expect(result.maximumPenetrationMm).toBeGreaterThan(0);
  });

  it('requires review for insufficient restorative space', () => {
    const bounds = fixture.result.mesh.bounds; const antagonist = { objectId: 'insufficient-space', mesh: boxMesh([bounds.min[0] - 1, bounds.min[1] - 1, bounds.max[2] - 0.05], [bounds.max[0] + 1, bounds.max[1] + 1, bounds.max[2] + 2]) }; const occlusion = analyzeOcclusion(fixture.result.mesh, fixture.result.topologyMap, { ...fixture.input, antagonist }); const qc = runCrownQc({ ...record(), occlusion }, fixture.result.mesh);
    expect(occlusion.status).toBe('fail'); expect(qc.checks.find((value) => value.id === 'static-occlusion')?.status).toBe('fail'); expect(qc.overall).toBe('fail');
  });

  it('rejects missing required preparation geometry', () => {
    const empty = meshData({ positions: [], faces: [] }); expect(() => buildCrownSolid({ ...fixture.input, preparationMesh: empty })).toThrow(/preparation|geometry|vertices/i);
  });

  it('fails an extreme proximal collision', () => {
    const bounds = fixture.result.mesh.bounds; const enclosing = { objectId: 'extreme-proximal', side: 'mesial' as const, mesh: boxMesh([bounds.min[0] - 1, bounds.min[1] - 1, bounds.min[2] - 1], [bounds.max[0] + 1, bounds.max[1] + 1, bounds.max[2] + 1]) }; const result = analyzeProximalContact(fixture.result.mesh, fixture.result.topologyMap, enclosing, 'mesial', fixture.input);
    expect(result.status).toBe('fail'); expect(result.penetrationMm).toBeGreaterThan(0);
  });

  it('fails an extreme occlusal collision', () => {
    const bounds = fixture.result.mesh.bounds; const antagonist = { objectId: 'extreme-occlusal', mesh: boxMesh([bounds.min[0] - 1, bounds.min[1] - 1, bounds.min[2] - 1], [bounds.max[0] + 1, bounds.max[1] + 1, bounds.max[2] + 1]) }; const result = analyzeOcclusion(fixture.result.mesh, fixture.result.topologyMap, { ...fixture.input, antagonist });
    expect(result.status).toBe('fail'); expect(result.maximumPenetrationMm).toBeGreaterThan(0);
  });

  it('rejects thickness that is impossible to satisfy under active locks', () => {
    const deficient = deficientCrown(); expect(() => autoThickenCrown(deficient, fixture.result.topologyMap, fixture.input.materialProfileId, { ...fixtureLocks(), intaglio: true, anatomy: true })).toThrow(/unsatisfiable/i);
  });

  it('rejects corrupt generated geometry', async () => {
    const corrupt = structuredClone(fixture.result.mesh); corrupt.sourceTopology!.positions[0] = Number.NaN; await expect(validateAllCrownExports(corrupt)).rejects.toThrow(/corrupt|finite|invalid/i);
  });

  it('fails QC for a non-manifold restoration', () => {
    const source = indexedMesh(fixture.result.mesh); const nonManifold: IndexedMesh = { positions: source.positions.map((point) => [...point]), faces: [...source.faces.map((face) => [...face] as [number, number, number]), [...source.faces[0]] as [number, number, number]] }; const mesh = meshData(nonManifold); const qc = runCrownQc(record(), mesh);
    expect(qc.checks.find((value) => value.id === 'manifold-topology')?.status).toBe('fail'); expect(qc.overall).toBe('fail');
  });

  it('detects and rejects restoration self-intersection', () => {
    const crossing: IndexedMesh = { positions: [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0.5, -1], [0, 0.5, 1], [1, 0.5, 0]], faces: [[0, 1, 2], [3, 4, 5]] }; expect(() => validateGeometryResult(crossing, { allowBoundaries: true, allowDisconnected: true })).toThrow(/self-intersecting/i); const qc = runCrownQc(record(), meshData(crossing)); expect(qc.checks.find((value) => value.id === 'self-intersection')?.status).toBe('fail');
  });

  it('rejects invalid governed material parameters', () => {
    expect(() => buildCrownSolid({ ...fixture.input, parameters: { ...fixture.input.parameters, internalRadiusMm: 0.01 } })).toThrow(/Internal radius/);
  });

  it('rejects an invalid manufacturing export state', () => {
    expect(() => createCrownExportRecords({ ...record(), approvalState: 'QC_FAILED', activeQcResultId: null }, [])).toThrow(/QC|approved/i);
  });
});

function deficientCrown(): MeshData {
  const source = indexedMesh(fixture.result.mesh); const positions = source.positions.map((point) => [...point] as [number, number, number]); const outer = fixture.result.topologyMap.outerVertexIds.find((id) => fixture.result.topologyMap.regions[id] !== 'margin')!; const inner = fixture.result.topologyMap.outerToInner[outer]; positions[outer] = [positions[inner][0], positions[inner][1], positions[inner][2] + 0.05]; return meshData({ positions, faces: source.faces.map((face) => [...face]) });
}

function fixtureLocks() { return { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false }; }

function record(): RestorationRecord {
  const now = new Date(0).toISOString(); const profile = CROWN_MATERIAL_PROFILES[fixture.input.materialProfileId]; return {
    id: 'failure-restoration', caseId: fixture.input.caseId, numberingSystem: fixture.input.numberingSystem, arch: fixture.input.arch, restorationType: 'SINGLE_UNIT_TOOTH_SUPPORTED_CROWN', preparationId: fixture.input.preparationId, preparationVersionId: 'segmentation', approvedMarginVersionId: 'margin', insertionAxisAnalysisId: 'axis', toothNumber: String(fixture.toothNumber), morphologyId: fixture.input.parameters.morphologyId, morphologyVersion: 'CADENCE-MORPHOLOGY-1.0.0', materialProfileId: fixture.input.materialProfileId, materialProfileVersion: profile.version, materialProfileSnapshot: structuredClone(profile), adjacentObjectIds: { mesial: fixture.input.adjacentMeshes[0]?.objectId ?? null, distal: fixture.input.adjacentMeshes[1]?.objectId ?? null }, opposingObjectId: fixture.input.antagonist?.objectId ?? null, preOpObjectId: fixture.input.reference?.objectId ?? null, referenceAdaptation: fixture.input.referenceAdaptation, designVersion: 1, manufacturingState: 'QC_REQUIRED', geometryLineageRootArtifactId: fixture.preparation.artifact.id, activeBranchId: 'main', artifactId: 'crown', sceneObjectId: 'crown-object', parameters: fixture.input.parameters, locks: fixtureLocks(), topologyMap: fixture.result.topologyMap, thickness: calculateThickness(fixture.result.mesh, fixture.result.topologyMap, fixture.input.materialProfileId), cementSpace: fixture.result.cementSpace, seating: fixture.result.seating, mesialContact: fixture.result.mesialContact, distalContact: fixture.result.distalContact, occlusion: fixture.result.occlusion, contour: fixture.result.contour, optimization: null, sculptMaskVertexIds: [], lockedAnatomyVertexIds: [], qcResultIds: [], activeQcResultId: null, versionIds: ['v1'], activeVersionId: 'v1', exportRecordIds: [], historyEventIds: [], checkpointIds: [], approvalState: 'QC_REQUIRED', approvedAt: null, approvedBy: null, createdAt: now, updatedAt: now,
  };
}
