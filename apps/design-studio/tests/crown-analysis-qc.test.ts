import { describe, it } from 'node:test';
import { analyzeOcclusion, analyzeProximalContact, autoThickenCrown, optimizeCrownConstraints, optimizeProximalContact, optimizeStaticOcclusion } from '../src/crown-analysis';
import { runCrownQc } from '../src/crown-qc';
import { validateAllCrownExports } from '../src/crown-export';
import { indexedMesh, meshData } from '../src/editing-geometry';
import type { RestorationRecord } from '../src/restoration-types';
import { CROWN_MATERIAL_PROFILES } from '../src/morphology-core';
import { goldenCrown } from './golden-crowns';
import { expect } from './test-helpers';

describe('single-crown fit, material and QC engines', () => {
  it('measures actual mesial and distal adjacent-surface contact patches', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const { result } = fixture; expect(result.mesialContact.status).toBe('pass'); expect(result.distalContact.status).toBe('pass'); expect(result.mesialContact.minimumDistanceMm).toBeCloseTo(0.025, 2); expect(result.distalContact.minimumDistanceMm).toBeCloseTo(0.025, 2); expect(result.mesialContact.patches.length).toBeGreaterThan(0); expect(result.distalContact.patches.length).toBeGreaterThan(0); expect(result.mesialContact.patches[0].areaMm2).toBeGreaterThan(0);
  });

  it('measures static antagonist clearance and patches without claiming motion', () => {
    const fixture = goldenCrown('maxillary-first-molar'); expect(fixture.result.occlusion.status).toBe('pass'); expect(fixture.result.occlusion.minimumDistanceMm).toBeCloseTo(0.04, 2); expect(fixture.result.occlusion.contactPatches.length).toBeGreaterThan(0); expect(fixture.result.occlusion.maximumPenetrationMm).toBe(0);
  });

  it('optimizes proximal and static occlusal geometry while preserving topology', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const mesial = fixture.input.adjacentMeshes.find((value) => value.side === 'mesial')!; const contacted = optimizeProximalContact(fixture.result.mesh, fixture.result.topologyMap, mesial.mesh, 'mesial', 0.02, false); const contactResult = analyzeProximalContact(contacted, fixture.result.topologyMap, mesial, 'mesial', fixture.input); expect(contactResult.minimumDistanceMm).toBeLessThanOrEqual(0.03);
    const occluded = optimizeStaticOcclusion(fixture.result.mesh, fixture.result.topologyMap, fixture.input.antagonist!.mesh, 0.03, false); const occlusion = analyzeOcclusion(occluded, fixture.result.topologyMap, { ...fixture.input, antagonist: fixture.input.antagonist }); expect(occlusion.minimumDistanceMm).toBeLessThanOrEqual(0.05);
  });

  it('moves penetrating occlusal vertices outward to the governed static-clearance range', () => {
    const fixture = goldenCrown('maxillary-central-incisor'); const antagonist = indexedMesh(fixture.input.antagonist!.mesh); const penetratingMesh = meshData({ positions: antagonist.positions.map(([x, y, z]) => [x, y, z - 0.24]), faces: antagonist.faces }); const penetrating = { objectId: 'penetrating-antagonist', mesh: penetratingMesh }; const before = analyzeOcclusion(fixture.result.mesh, fixture.result.topologyMap, { ...fixture.input, antagonist: penetrating }); expect(before.maximumPenetrationMm).toBeGreaterThan(0.05);
    const corrected = optimizeStaticOcclusion(fixture.result.mesh, fixture.result.topologyMap, penetratingMesh, 0.03, false); const after = analyzeOcclusion(corrected, fixture.result.topologyMap, { ...fixture.input, antagonist: penetrating }); expect(after.status).toBe('pass'); expect(after.maximumPenetrationMm).toBeLessThanOrEqual(0.03);
  });

  it('rejects optimization when the corresponding constraint is locked', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const mesial = fixture.input.adjacentMeshes.find((value) => value.side === 'mesial')!; expect(() => optimizeProximalContact(fixture.result.mesh, fixture.result.topologyMap, mesial.mesh, 'mesial', 0.02, true)).toThrow(/lock/i); expect(() => optimizeStaticOcclusion(fixture.result.mesh, fixture.result.topologyMap, fixture.input.antagonist!.mesh, 0.03, true)).toThrow(/lock/i);
  });

  it('jointly optimizes proximal, static occlusal and thickness constraints with measured convergence evidence', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const result = optimizeCrownConstraints(fixture.result.mesh, fixture.result.topologyMap, fixture.input, { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false });
    expect(result.evidence.iterationCount).toBeGreaterThan(0); expect(result.evidence.status).toBe('converged'); expect(result.evidence.constraintViolations).toHaveLength(0); expect(result.evidence.objectiveTerms.morphologyDisplacementRmsMm).toBeGreaterThanOrEqual(0); expect(result.analyses.thickness.failingVertexIds).toHaveLength(0); expect(indexedMesh(result.mesh).faces).toEqual(indexedMesh(fixture.result.mesh).faces);
  });

  it('does not reapply contact or occlusal displacement after individual tools satisfy governed ranges', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const mesial = fixture.input.adjacentMeshes.find((value) => value.side === 'mesial')!; const distal = fixture.input.adjacentMeshes.find((value) => value.side === 'distal')!;
    let mesh = optimizeProximalContact(fixture.result.mesh, fixture.result.topologyMap, mesial.mesh, 'mesial', fixture.input.parameters.targetMesialContactMm, false); mesh = optimizeProximalContact(mesh, fixture.result.topologyMap, distal.mesh, 'distal', fixture.input.parameters.targetDistalContactMm, false); mesh = optimizeStaticOcclusion(mesh, fixture.result.topologyMap, fixture.input.antagonist!.mesh, fixture.input.parameters.targetOcclusalClearanceMm, false);
    const before = indexedMesh(mesh); const result = optimizeCrownConstraints(mesh, fixture.result.topologyMap, fixture.input, { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false }); const after = indexedMesh(result.mesh);
    expect(result.evidence.status).toBe('converged'); expect(result.evidence.constraintViolations).toHaveLength(0); expect(after.positions).toEqual(before.positions); expect(after.faces).toEqual(before.faces);
  });

  it('reports a lock conflict instead of fabricating joint optimization success', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const antagonist = indexedMesh(fixture.input.antagonist!.mesh); const penetrating = meshData({ positions: antagonist.positions.map(([x, y, z]) => [x, y, z - 0.4]), faces: antagonist.faces }); const input = { ...fixture.input, antagonist: { objectId: 'locked-antagonist', mesh: penetrating } };
    const result = optimizeCrownConstraints(fixture.result.mesh, fixture.result.topologyMap, input, { margin: true, intaglio: false, mesialContact: true, distalContact: true, occlusion: true, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false }); expect(result.evidence.status).toBe('constraint-conflict'); expect(result.evidence.constraintViolations.length).toBeGreaterThan(0);
  });

  it('auto-thickens a deficient outer wall or reports lock conflicts', () => {
    const fixture = goldenCrown('maxillary-central-incisor'); const first = fixture.result.topologyMap.outerVertexIds.find((id) => fixture.result.topologyMap.regions[id] !== 'margin')!; const inner = fixture.result.topologyMap.outerToInner[first]; const source = fixture.result.mesh.sourceTopology!; const positions = [...source.positions]; positions[first * 3] = positions[inner * 3]; positions[first * 3 + 1] = positions[inner * 3 + 1]; positions[first * 3 + 2] = positions[inner * 3 + 2] + 0.3; const deficient = { ...fixture.result.mesh, sourceTopology: { positions, indices: [...source.indices] } };
    expect(() => autoThickenCrown(deficient, fixture.result.topologyMap, 'zirconia-monolithic', { margin: true, intaglio: true, anatomy: true })).toThrow(/unsatisfiable/i); const corrected = autoThickenCrown(deficient, fixture.result.topologyMap, 'zirconia-monolithic', { margin: true, intaglio: true, anatomy: false }); expect(corrected.sourceTopology?.positions[first * 3 + 2]).toBeGreaterThan(positions[first * 3 + 2]);
  });

  it('passes complete hard QC with all four measured export round trips', async () => {
    const fixture = goldenCrown('maxillary-first-molar'); const outputs = await validateAllCrownExports(fixture.result.mesh); const record = restoration(fixture); const qc = runCrownQc(record, fixture.result.mesh, outputs.map((value) => value.roundTrip)); expect(qc.hardFailureCount).toBe(0); expect(qc.failureCount).toBe(0); expect(qc.overall === 'pass' || qc.overall === 'warning').toBe(true); expect(qc.checks.find((value) => value.id === 'self-intersection')?.status).toBe('pass'); expect(qc.checks.find((value) => value.id === 'export-integrity')?.status).toBe('pass');
  });

  it('fails closed when mandatory contact, seating or export evidence is missing', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const record = restoration(fixture); const qc = runCrownQc({ ...record, seating: { ...record.seating!, status: 'fail', seated: false, blockingVertexIds: [1] }, mesialContact: { ...record.mesialContact!, status: 'not-run' } }, fixture.result.mesh, []); expect(qc.overall).toBe('fail'); expect(qc.hardFailureCount).toBeGreaterThanOrEqual(3);
  });
});

function restoration(fixture: ReturnType<typeof goldenCrown>): RestorationRecord {
  const now = new Date(0).toISOString(); const profile = CROWN_MATERIAL_PROFILES[fixture.input.materialProfileId]; return { id: 'restoration', caseId: fixture.input.caseId, numberingSystem: fixture.input.numberingSystem, arch: fixture.input.arch, restorationType: 'SINGLE_UNIT_TOOTH_SUPPORTED_CROWN', preparationId: fixture.input.preparationId, preparationVersionId: 'segmentation', approvedMarginVersionId: 'margin', insertionAxisAnalysisId: 'axis', toothNumber: String(fixture.toothNumber), morphologyId: fixture.input.parameters.morphologyId, morphologyVersion: 'CADENCE-MORPHOLOGY-1.0.0', materialProfileId: fixture.input.materialProfileId, materialProfileVersion: profile.version, materialProfileSnapshot: structuredClone(profile), adjacentObjectIds: { mesial: fixture.input.adjacentMeshes.find((value) => value.side === 'mesial')?.objectId ?? null, distal: fixture.input.adjacentMeshes.find((value) => value.side === 'distal')?.objectId ?? null }, opposingObjectId: fixture.input.antagonist?.objectId ?? null, preOpObjectId: fixture.input.reference?.objectId ?? null, referenceAdaptation: fixture.input.referenceAdaptation, designVersion: 1, manufacturingState: 'QC_REQUIRED', geometryLineageRootArtifactId: fixture.preparation.artifact.id, activeBranchId: 'main', artifactId: 'crown', sceneObjectId: 'crown-object', parameters: fixture.input.parameters, locks: { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false }, topologyMap: fixture.result.topologyMap, thickness: fixture.result.thickness, cementSpace: fixture.result.cementSpace, seating: fixture.result.seating, mesialContact: fixture.result.mesialContact, distalContact: fixture.result.distalContact, occlusion: fixture.result.occlusion, contour: fixture.result.contour, optimization: null, sculptMaskVertexIds: [], lockedAnatomyVertexIds: [], qcResultIds: [], activeQcResultId: null, versionIds: ['v1'], activeVersionId: 'v1', exportRecordIds: [], historyEventIds: [], checkpointIds: [], approvalState: 'QC_REQUIRED', approvedAt: null, approvedBy: null, createdAt: now, updatedAt: now };
}
