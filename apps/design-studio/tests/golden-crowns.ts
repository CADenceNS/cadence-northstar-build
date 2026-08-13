import type { ArtifactRecord, MeshData, SceneObject, Vec3 } from '../src/core';
import { indexedMesh, meshData, type IndexedMesh } from '../src/editing-geometry';
import { generateCrownProposal } from '../src/crown-engine';
import { defaultCrownParameters } from '../src/morphology-core';
import type { CrownGenerationInput, CrownGenerationResult, CrownMaterialId } from '../src/restoration-types';
import { goldenPreparation } from './golden-preparations';

export type GoldenCrownFamily = 'maxillary-central-incisor' | 'maxillary-canine' | 'maxillary-first-premolar' | 'maxillary-first-molar' | 'mandibular-central-incisor' | 'mandibular-canine' | 'mandibular-first-premolar' | 'mandibular-first-molar';

const TOOTH_BY_FAMILY: Record<GoldenCrownFamily, number> = {
  'maxillary-central-incisor': 8, 'maxillary-canine': 6, 'maxillary-first-premolar': 5, 'maxillary-first-molar': 3,
  'mandibular-central-incisor': 25, 'mandibular-canine': 22, 'mandibular-first-premolar': 21, 'mandibular-first-molar': 19,
};

export interface GoldenCrownCase {
  family: GoldenCrownFamily;
  toothNumber: number;
  preparation: ReturnType<typeof goldenPreparation>;
  mesial: ArtifactRecord;
  distal: ArtifactRecord;
  antagonist: ArtifactRecord;
  reference: ArtifactRecord;
  input: CrownGenerationInput;
  result: CrownGenerationResult;
}

export function goldenCrown(family: GoldenCrownFamily, materialId: CrownMaterialId = 'zirconia-monolithic', resolution: { radialSegments?: number; surfaceRings?: number } = {}): GoldenCrownCase {
  const toothNumber = TOOTH_BY_FAMILY[family]; const preparation = goldenPreparation(family.includes('molar') ? 'heavy-chamfer' : 'chamfer-crown', Math.max(32, resolution.radialSegments ?? 32));
  const parameters = { ...defaultCrownParameters(toothNumber, materialId), radialSegments: resolution.radialSegments ?? 32, surfaceRings: resolution.surfaceRings ?? 8 };
  const base: CrownGenerationInput = { requestId: `golden-${family}-base`, preparationId: `preparation-${family}`, preparationArtifactId: preparation.artifact.id, preparationMesh: preparation.artifact.mesh, marginPoints: preparation.trueMargins[0], insertionAxis: [0, 0, 1], toothNumber: String(toothNumber), caseId: `golden-case-${family}`, numberingSystem: 'UNIVERSAL', arch: toothNumber <= 16 ? 'MAXILLARY' : 'MANDIBULAR', dentalAxes: { mesial: [1, 0, 0], facial: [0, -1, 0], occlusal: [0, 0, 1] }, materialProfileId: materialId, parameters, adjacentMeshes: [], referenceAdaptation: { mode: 'none', influence: 0, selectedRegion: null }, contourReferences: [{ objectId: preparation.artifact.id, kind: 'preparation', mesh: preparation.artifact.mesh }] };
  const proposal = generateCrownProposal(base); const referenceMesh = inflatedReference(proposal.mesh, 0.12); const adapted = generateCrownProposal({ ...base, requestId: `${base.requestId}-reference`, reference: { objectId: `reference-${family}`, kind: 'pre-op', mesh: referenceMesh }, referenceAdaptation: { mode: 'blend', influence: 0.65, selectedRegion: null }, contourReferences: [...base.contourReferences, { objectId: `reference-${family}`, kind: 'pre-op', mesh: referenceMesh }] }); const bounds = adapted.mesh.bounds; const contact = 0.025; const sideWidth = 4; const verticalPadding = 2;
  const mesialMesh = boxMesh([bounds.min[0] - sideWidth, bounds.min[1] - 1, bounds.min[2] - verticalPadding], [bounds.min[0] - contact, bounds.max[1] + 1, bounds.max[2] + verticalPadding]);
  const distalMesh = boxMesh([bounds.max[0] + contact, bounds.min[1] - 1, bounds.min[2] - verticalPadding], [bounds.max[0] + sideWidth, bounds.max[1] + 1, bounds.max[2] + verticalPadding]);
  const antagonistMesh = boxMesh([bounds.min[0] - 1, bounds.min[1] - 1, bounds.max[2] + 0.04], [bounds.max[0] + 1, bounds.max[1] + 1, bounds.max[2] + 3]);
  const mesial = artifact(`mesial-${family}`, mesialMesh, 'reference'); const distal = artifact(`distal-${family}`, distalMesh, 'reference'); const antagonist = artifact(`antagonist-${family}`, antagonistMesh, 'opposing'); const reference = artifact(`reference-${family}`, referenceMesh, 'reference');
  const input: CrownGenerationInput = { ...base, requestId: `golden-${family}`, adjacentMeshes: [{ objectId: `object-${mesial.id}`, side: 'mesial', mesh: mesial.mesh }, { objectId: `object-${distal.id}`, side: 'distal', mesh: distal.mesh }], antagonist: { objectId: `object-${antagonist.id}`, mesh: antagonist.mesh }, reference: { objectId: `object-${reference.id}`, kind: 'pre-op', mesh: reference.mesh }, referenceAdaptation: { mode: 'blend', influence: 0.65, selectedRegion: null }, contourReferences: [{ objectId: `object-${mesial.id}`, kind: 'adjacent', mesh: mesial.mesh }, { objectId: `object-${distal.id}`, kind: 'adjacent', mesh: distal.mesh }, { objectId: `object-${reference.id}`, kind: 'pre-op', mesh: reference.mesh }] };
  const result = generateCrownProposal(input); return { family, toothNumber, preparation, mesial, distal, antagonist, reference, input, result };
}

export function crownSceneObject(artifactValue: ArtifactRecord, type: SceneObject['type']): SceneObject { return { id: `object-${artifactValue.id}`, name: artifactValue.sourceName, type, artifactId: artifactValue.id, visible: true, isolated: false, locked: false, selected: false, transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [0.8, 0.82, 0.9, 1], opacity: 1, metallic: 0, roughness: 0.7 }, metadata: {} }; }

export function boxMesh(min: Vec3, max: Vec3): MeshData {
  if (min.some((value, axis) => !Number.isFinite(value) || value >= max[axis])) throw new Error('Golden box requires finite increasing bounds.');
  const positions: Vec3[] = [[min[0], min[1], min[2]], [max[0], min[1], min[2]], [max[0], max[1], min[2]], [min[0], max[1], min[2]], [min[0], min[1], max[2]], [max[0], min[1], max[2]], [max[0], max[1], max[2]], [min[0], max[1], max[2]]];
  const faces: IndexedMesh['faces'] = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]; return meshData({ positions, faces });
}

export function artifact(id: string, mesh: MeshData, kind: SceneObject['type']): ArtifactRecord {
  const now = new Date(0).toISOString(); return { id: `artifact-${id}`, sourceName: `${id}.ply`, sourceFormat: 'ply', checksum: `golden-${id}`, importedAt: now, byteLength: (mesh.sourceTopology?.positions.length ?? mesh.positions.length) * 8, units: 'mm', orientation: 'normalized', metadata: { golden: true, role: kind }, history: [{ at: now, action: 'generated-golden-crown-fixture' }], mesh };
}

function inflatedReference(mesh: MeshData, amount: number): MeshData {
  const indexed = indexedMesh(mesh); const center: Vec3 = [(mesh.bounds.min[0] + mesh.bounds.max[0]) / 2, (mesh.bounds.min[1] + mesh.bounds.max[1]) / 2, (mesh.bounds.min[2] + mesh.bounds.max[2]) / 2];
  const positions = indexed.positions.map((point) => { const vector: Vec3 = [point[0] - center[0], point[1] - center[1], point[2] - center[2]]; const length = Math.hypot(...vector) || 1; return [point[0] + vector[0] / length * amount, point[1] + vector[1] / length * amount, point[2] + vector[2] / length * amount] as Vec3; }); return meshData({ positions, faces: indexed.faces.map((face) => [...face]) });
}
