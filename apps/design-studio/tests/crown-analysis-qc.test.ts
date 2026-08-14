import { describe, it } from 'node:test';
import { analyzeOcclusion, analyzeProximalContact, autoThickenCrown, optimizeCrownConstraints, optimizeProximalContact, optimizeStaticOcclusion } from '../src/crown-analysis';
import { generateCrownProposal } from '../src/crown-engine';
import { runCrownQc } from '../src/crown-qc';
import { validateAllCrownExports } from '../src/crown-export';
import { indexedMesh, inspectGeometry, meshData } from '../src/editing-geometry';
import type { MeshData, Vec3 } from '../src/core';
import type { CrownGenerationInput, RestorationRecord } from '../src/restoration-types';
import { CROWN_MATERIAL_PROFILES, defaultCrownParameters } from '../src/morphology-core';
import { boxMesh, goldenCrown } from './golden-crowns';
import { goldenPreparation } from './golden-preparations';
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

  it('distributes a large proximal correction across valid surface support without foldover', () => {
    const fixture = goldenCrown('maxillary-first-molar'); const bounds = fixture.result.mesh.bounds; const distalMesh = boxMesh([bounds.max[0] + 0.6, bounds.min[1] - 1, bounds.min[2] - 2], [bounds.max[0] + 4.6, bounds.max[1] + 1, bounds.max[2] + 2]); const input = { ...fixture.input, adjacentMeshes: fixture.input.adjacentMeshes.map((value) => value.side === 'distal' ? { ...value, mesh: distalMesh } : value) }; const mesial = input.adjacentMeshes.find((value) => value.side === 'mesial')!; const distal = input.adjacentMeshes.find((value) => value.side === 'distal')!;
    let mesh = optimizeProximalContact(fixture.result.mesh, fixture.result.topologyMap, mesial.mesh, 'mesial', input.parameters.targetMesialContactMm, false); mesh = optimizeProximalContact(mesh, fixture.result.topologyMap, distal.mesh, 'distal', input.parameters.targetDistalContactMm, false); mesh = optimizeStaticOcclusion(mesh, fixture.result.topologyMap, input.antagonist!.mesh, input.parameters.targetOcclusalClearanceMm, false); const result = optimizeCrownConstraints(mesh, fixture.result.topologyMap, input, { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false });
    expect(result.evidence.status).toBe('converged'); expect(result.evidence.constraintViolations).toHaveLength(0); expect(result.analyses.distalContact.minimumDistanceMm).toBeGreaterThanOrEqual(-0.05); expect(result.analyses.distalContact.minimumDistanceMm).toBeLessThanOrEqual(0.15); expect(inspectGeometry(indexedMesh(result.mesh)).selfIntersectionCount).toBe(0);
  });

  it('optimizes contacts measured on a tilted-axis cervical boundary without changing the intaglio', () => {
    const preparation = goldenPreparation('shoulder', 48); const insertionAxis: Vec3 = [-0.0625513828161217, -0.0018173213431290827, 0.998040090302452]; const parameters = { ...defaultCrownParameters(3, 'zirconia-monolithic'), anatomyIntensity: 0.78 }; const mesial = boxMesh([-9, -7, -2], [-4.51, 7, 12]); const distal = boxMesh([4.51, -7, -2], [9, 7, 12]); const antagonist = boxMesh([-7, -7, 8.73], [7, 7, 11.73]); const reference = browserReferenceCrown(44, 8.1);
    const input: CrownGenerationInput = { requestId: 'tilted-axis-contact-regression', preparationId: 'preparation', preparationArtifactId: preparation.artifact.id, preparationMesh: preparation.artifact.mesh, marginPoints: preparation.trueMargins[0], insertionAxis, toothNumber: '3', caseId: 'tilted-axis-case', numberingSystem: 'UNIVERSAL', arch: 'MAXILLARY', dentalAxes: { mesial: [1, 0, 0], facial: [0, -1, 0], occlusal: insertionAxis }, materialProfileId: 'zirconia-monolithic', parameters, adjacentMeshes: [{ objectId: 'mesial', side: 'mesial', mesh: mesial }, { objectId: 'distal', side: 'distal', mesh: distal }], antagonist: { objectId: 'antagonist', mesh: antagonist }, reference: { objectId: 'pre-op', kind: 'pre-op', mesh: reference }, referenceAdaptation: { mode: 'blend', influence: 0.55, selectedRegion: null }, contourReferences: [{ objectId: preparation.artifact.id, kind: 'preparation', mesh: preparation.artifact.mesh }, { objectId: 'mesial', kind: 'adjacent', mesh: mesial }, { objectId: 'distal', kind: 'adjacent', mesh: distal }, { objectId: 'pre-op', kind: 'pre-op', mesh: reference }] };
    const sourceBefore = indexedMesh(preparation.artifact.mesh); const proposal = generateCrownProposal(input); const proposalIndexed = indexedMesh(proposal.mesh); const intaglioBefore = proposal.topologyMap.innerVertexIds.map((id) => proposalIndexed.positions[id]); let mesh = optimizeProximalContact(proposal.mesh, proposal.topologyMap, mesial, 'mesial', parameters.targetMesialContactMm, false); mesh = optimizeProximalContact(mesh, proposal.topologyMap, distal, 'distal', parameters.targetDistalContactMm, false); mesh = optimizeStaticOcclusion(mesh, proposal.topologyMap, antagonist, parameters.targetOcclusalClearanceMm, false); const result = optimizeCrownConstraints(mesh, proposal.topologyMap, input, { margin: true, intaglio: false, mesialContact: false, distalContact: false, occlusion: false, facialContour: false, lingualContour: false, selectedAnatomy: false, anatomy: false }); const resultIndexed = indexedMesh(result.mesh);
    expect(result.evidence.status).toBe('converged'); expect(result.evidence.constraintViolations).toHaveLength(0); expect(result.analyses.mesialContact.status).toBe('pass'); expect(result.analyses.distalContact.status).toBe('pass'); expect(result.analyses.occlusion.status).toBe('pass'); expect(inspectGeometry(resultIndexed).selfIntersectionCount).toBe(0); expect(proposal.topologyMap.innerVertexIds.map((id) => resultIndexed.positions[id])).toEqual(intaglioBefore); expect(indexedMesh(preparation.artifact.mesh)).toEqual(sourceBefore);
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

function browserReferenceCrown(segments: number, height: number): MeshData {
  const positions: Vec3[] = []; const faces: Array<[number, number, number]> = []; const rings = [{ z: 0, radius: 4.6 }, { z: height * 0.45, radius: 5 }, { z: height, radius: 3.3 }];
  for (const ring of rings) for (let index = 0; index < segments; index += 1) { const angle = index / segments * Math.PI * 2; positions.push([Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius * 0.9, ring.z]); }
  for (let ring = 0; ring < rings.length - 1; ring += 1) for (let index = 0; index < segments; index += 1) { const next = (index + 1) % segments; const a = ring * segments + index, b = ring * segments + next, c = (ring + 1) * segments + index, d = (ring + 1) * segments + next; faces.push([a, b, d], [a, d, c]); }
  return meshData({ positions, faces });
}
