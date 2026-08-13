import { describe, it } from 'node:test';
import { generateCrownProposal } from '../src/crown-engine';
import { indexedMesh, meshData } from '../src/editing-geometry';
import type { CrownGenerationInput } from '../src/restoration-types';
import { boxMesh, goldenCrown } from './golden-crowns';
import { goldenPreparation } from './golden-preparations';
import { expect } from './test-helpers';

const base = goldenCrown('maxillary-first-molar', 'zirconia-monolithic', { radialSegments: 24, surfaceRings: 6 });

describe('deterministic golden crown case corpus', () => {
  const scenarios: Array<{ name: string; input(): CrownGenerationInput; verify(result: ReturnType<typeof generateCrownProposal>): void }> = [
    { name: 'normal preparation', input: () => request('normal', base.input), verify: verifyValid },
    { name: 'short preparation', input: () => scalePreparation(request('short', base.input), 1, 1, 0.78), verify: verifyValid },
    { name: 'tall preparation', input: () => scalePreparation(request('tall', base.input), 1, 1, 1.18), verify: verifyValid },
    { name: 'narrow preparation', input: () => scalePreparation(request('narrow', base.input), 0.86, 0.86, 1), verify: verifyValid },
    { name: 'wide preparation', input: () => scalePreparation(request('wide', base.input), 1.12, 1.12, 1), verify: verifyValid },
    { name: 'deep finish line', input: () => replacePreparation(request('deep-finish-line', base.input), goldenPreparation('shoulder', 32)), verify: verifyValid },
    { name: 'irregular finish line', input: () => { const value = replacePreparation(request('irregular', base.input), goldenPreparation('irregular', 48)); return { ...value, parameters: { ...value.parameters, radialSegments: 48 } }; }, verify: verifyValid },
    { name: 'limited occlusal clearance', input: () => { const value = request('limited-clearance', base.input); const bounds = base.result.mesh.bounds; return { ...value, antagonist: { objectId: 'limited-antagonist', mesh: boxMesh([bounds.min[0] - 1, bounds.min[1] - 1, bounds.max[2] - 0.08], [bounds.max[0] + 1, bounds.max[1] + 1, bounds.max[2] + 2]) } }; }, verify: (result) => { verifyValid(result); expect(result.occlusion.maximumPenetrationMm).toBeGreaterThan(0); } },
    { name: 'tight proximal space', input: () => { const value = request('tight-proximal', base.input); const bounds = base.result.mesh.bounds; return { ...value, adjacentMeshes: [{ objectId: 'tight-mesial', side: 'mesial', mesh: boxMesh([bounds.min[0] - 3, bounds.min[1] - 1, bounds.min[2] - 1], [bounds.min[0] + 0.08, bounds.max[1] + 1, bounds.max[2] + 1]) }, { objectId: 'tight-distal', side: 'distal', mesh: boxMesh([bounds.max[0] - 0.08, bounds.min[1] - 1, bounds.min[2] - 1], [bounds.max[0] + 3, bounds.max[1] + 1, bounds.max[2] + 1]) }] }; }, verify: (result) => { verifyValid(result); expect(Math.max(result.mesialContact.penetrationMm, result.distalContact.penetrationMm)).toBeGreaterThan(0); } },
    { name: 'missing adjacent tooth', input: () => ({ ...request('missing-adjacent', base.input), adjacentMeshes: [] }), verify: (result) => { verifyValid(result); expect(result.mesialContact.status).toBe('not-run'); expect(result.distalContact.status).toBe('not-run'); } },
    { name: 'missing antagonist', input: () => ({ ...request('missing-antagonist', base.input), antagonist: undefined }), verify: (result) => { verifyValid(result); expect(result.occlusion.status).toBe('not-run'); } },
    { name: 'noisy scan', input: () => replacePreparation(request('noisy-scan', base.input), goldenPreparation('noisy-scan', 32)), verify: verifyValid },
    { name: 'multiple morphology parameters', input: () => { const value = request('morphology-parameters', base.input); return { ...value, parameters: { ...value.parameters, cuspHeight: 1.3, grooveDepth: 1.25, ridgeIntensity: 1.2, facialFullness: 1.12, attrition: 0.3 } }; }, verify: (result) => { verifyValid(result); expect(result.mesh.sourceTopology?.positions).not.toEqual(base.result.mesh.sourceTopology?.positions); } },
    { name: 'alternative governed material profile', input: () => { const fixture = goldenCrown('maxillary-first-molar', 'lithium-disilicate', { radialSegments: 24, surfaceRings: 6 }); return request('alternative-material', fixture.input); }, verify: (result) => { verifyValid(result); expect(result.thickness.globalMinimumMm).toBeGreaterThanOrEqual(1); } },
  ];

  for (const scenario of scenarios) it(`generates measurable actual final geometry for ${scenario.name}`, () => {
    const input = scenario.input(); const result = generateCrownProposal(input); const repeat = generateCrownProposal({ ...input, requestId: `${input.requestId}-repeat` }); scenario.verify(result); expect(result.mesh.sourceTopology).toEqual(repeat.mesh.sourceTopology); expect(result.inspection.boundingDimensionsMm.every((value) => value > 0 && Number.isFinite(value))).toBe(true);
  });
});

function request(name: string, input: CrownGenerationInput): CrownGenerationInput { return { ...structuredClone(input), requestId: `golden-corpus-${name}` }; }

function replacePreparation(input: CrownGenerationInput, preparation: ReturnType<typeof goldenPreparation>): CrownGenerationInput {
  return { ...input, preparationArtifactId: preparation.artifact.id, preparationMesh: structuredClone(preparation.artifact.mesh), marginPoints: structuredClone(preparation.trueMargins[0]), contourReferences: input.contourReferences.map((value) => value.kind === 'preparation' ? { ...value, objectId: preparation.artifact.id, mesh: structuredClone(preparation.artifact.mesh) } : value) };
}

function scalePreparation(input: CrownGenerationInput, x: number, y: number, z: number): CrownGenerationInput {
  const indexed = indexedMesh(input.preparationMesh); const scale = (point: [number, number, number]): [number, number, number] => [point[0] * x, point[1] * y, point[2] * z]; const mesh = meshData({ positions: indexed.positions.map(scale), faces: indexed.faces.map((face) => [...face]) });
  return { ...input, preparationMesh: mesh, marginPoints: input.marginPoints.map(scale), contourReferences: input.contourReferences.map((value) => value.kind === 'preparation' ? { ...value, mesh } : value) };
}

function verifyValid(result: ReturnType<typeof generateCrownProposal>): void {
  expect(result.inspection.watertight).toBe(true); expect(result.inspection.shellCount).toBe(1); expect(result.inspection.selfIntersectionCount).toBe(0); expect(result.inspection.volumeMm3).toBeGreaterThan(0); expect(result.inspection.surfaceAreaMm2).toBeGreaterThan(0); expect(result.thickness.failingVertexIds).toHaveLength(0); expect(result.cementSpace.status).toBe('pass');
}
