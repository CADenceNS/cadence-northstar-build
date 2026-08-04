import type { ArtifactRecord, MeshData, Vec3 } from '../src/core';
import { applyRigid, axisAngleRigid, composeRigid, identityRigid, invertRigid, rigidFromRotationTranslation } from '../src/registration-math';
import type { RegistrationOutcome, RigidTransform, ScanRole } from '../src/registration-types';
import { artifactFromMesh, topology } from './golden-geometry';

export type RegistrationFixtureName =
  | 'exact-rigid-transform'
  | 'translation-only'
  | 'rotation-only'
  | 'combined-transform'
  | 'partial-overlap'
  | 'surface-noise'
  | 'outlier-contamination'
  | 'missing-regions'
  | 'mirrored-scan'
  | 'incorrect-units'
  | 'duplicate-scan'
  | 'insufficient-geometry'
  | 'symmetrical-ambiguous-geometry';

export interface GoldenRegistrationFixture {
  name: RegistrationFixtureName;
  source: ArtifactRecord;
  target: ArtifactRecord;
  sourceRole: ScanRole;
  targetRole: ScanRole;
  expectedTransform: RigidTransform | null;
  expectedOutcome: RegistrationOutcome | 'validation-blocked';
  translationToleranceMm: number;
  rotationToleranceDegrees: number;
  syntheticUse: 'engineering registration validation only';
}

export function goldenRegistrationCorpus(): GoldenRegistrationFixture[] {
  const base = archArtifact('target-arch', 15, 11);
  const translation = rigidFromRotationTranslation([0, 0, 0, 1], [7.5, -4.25, 2.1]);
  const rotation = axisAngleRigid([0.3, 0.7, 0.2], 18 * Math.PI / 180);
  const combined = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [12.4, -8.1, 3.75]), axisAngleRigid([0.2, 0.8, 0.5], 27 * Math.PI / 180));
  const exact = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [-5.2, 9.3, 1.1]), axisAngleRigid([0.6, 0.1, 0.7], -13 * Math.PI / 180));
  const partialTarget = archArtifact('partial-target', 17, 13); const partialSourceBase = archArtifact('partial-source-base', 17, 8, 0, 5);
  const partialTransform = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [4.2, -3.1, 2.3]), axisAngleRigid([0.1, 0.9, 0.3], 9 * Math.PI / 180));
  const noisyTransform = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [3.1, 5.4, -1.2]), axisAngleRigid([0.8, 0.2, 0.1], 11 * Math.PI / 180));
  const noisy = transformArtifact(base, invertRigid(noisyTransform), 'surface-noise-source', (point, index) => [point[0] + Math.sin(index * 1.7) * 0.025, point[1] + Math.cos(index * 0.9) * 0.025, point[2] + Math.sin(index * 0.43) * 0.018]);
  const outlierBase = addOutliers(base, 20); const outlierTransform = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], [-2.2, 4.8, 0.7]), axisAngleRigid([0.4, 0.3, 0.8], -8 * Math.PI / 180));
  const mirrored = reflectArtifact(base, 'mirrored-source'); mirrored.metadata.likelyMirrored = true;
  const cmSource = transformArtifact(base, invertRigid(translation), 'centimeter-source'); cmSource.units = 'cm'; cmSource.mesh = scaleMesh(cmSource.mesh, 0.1);
  const insufficient = artifactFromMesh('insufficient-source', topology([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]]));
  const symmetric = artifactFromMesh('symmetric-source', cubeMesh()); const symmetricTarget = transformArtifact(symmetric, axisAngleRigid([0, 0, 1], Math.PI / 2), 'symmetric-target');

  return [
    fixture('exact-rigid-transform', transformArtifact(base, invertRigid(exact), 'exact-source'), base, exact, 'accepted', 0.05, 0.1),
    fixture('translation-only', transformArtifact(base, invertRigid(translation), 'translation-source'), base, translation, 'accepted', 0.05, 0.1),
    fixture('rotation-only', transformArtifact(base, invertRigid(rotation), 'rotation-source'), base, rotation, 'accepted', 0.05, 0.1),
    fixture('combined-transform', transformArtifact(base, invertRigid(combined), 'combined-source'), base, combined, 'accepted', 0.05, 0.1),
    fixture('partial-overlap', transformArtifact(partialSourceBase, invertRigid(partialTransform), 'partial-source'), partialTarget, partialTransform, 'accepted', 0.2, 0.5),
    fixture('surface-noise', noisy, base, noisyTransform, 'accepted', 0.2, 0.5),
    fixture('outlier-contamination', transformArtifact(outlierBase, invertRigid(outlierTransform), 'outlier-source'), base, outlierTransform, 'accepted', 0.2, 0.5),
    fixture('missing-regions', transformArtifact(partialSourceBase, invertRigid(partialTransform), 'missing-source'), partialTarget, partialTransform, 'accepted', 0.2, 0.5),
    fixture('mirrored-scan', mirrored, base, null, 'validation-blocked', 0, 0),
    fixture('incorrect-units', cmSource, base, translation, 'accepted', 0.05, 0.1),
    { ...fixture('duplicate-scan', structuredClone(base), base, identityRigid(), 'validation-blocked', 0, 0), source: { ...structuredClone(base), id: 'duplicate-source' } },
    fixture('insufficient-geometry', insufficient, base, null, 'failed', 0, 0),
    fixture('symmetrical-ambiguous-geometry', symmetric, symmetricTarget, null, 'manual-review-required', 0, 0),
  ];
}

export function archArtifact(name: string, columns: number, rows: number, startRow = 0, rowCount = rows): ArtifactRecord {
  const vertices: Vec3[] = []; const faces: number[][] = [];
  const endRow = Math.min(rows, startRow + rowCount);
  for (let row = startRow; row < endRow; row += 1) for (let column = 0; column < columns; column += 1) {
    const lateral = (column - (columns - 1) / 2) * 1.35;
    const depth = row * 1.45 + 0.035 * lateral * lateral;
    const height = 0.24 * Math.sin(column * 0.71) + 0.17 * Math.cos(row * 0.63) + 0.012 * lateral * row + (column === 2 && row === startRow + 2 ? 0.8 : 0);
    vertices.push([lateral, depth, height]);
  }
  const localRows = endRow - startRow;
  for (let row = 0; row < localRows - 1; row += 1) for (let column = 0; column < columns - 1; column += 1) {
    const a = row * columns + column, b = a + 1, c = a + columns, d = c + 1; faces.push([a, c, b], [b, c, d]);
  }
  return artifactFromMesh(name, topology(vertices, faces));
}

export function transformArtifact(artifact: ArtifactRecord, transform: RigidTransform, name: string, modifier?: (point: Vec3, index: number) => Vec3): ArtifactRecord {
  const source = artifact.mesh.sourceTopology!; const vertices: Vec3[] = [];
  for (let offset = 0; offset < source.positions.length; offset += 3) { const transformed = applyRigid(transform, [source.positions[offset], source.positions[offset + 1], source.positions[offset + 2]]); vertices.push(modifier ? modifier(transformed, offset / 3) : transformed); }
  const mesh = topology(vertices, chunk(source.indices, 3)); const next = artifactFromMesh(name, mesh); next.checksum = `sha256-${name}`; return next;
}

function fixture(name: RegistrationFixtureName, source: ArtifactRecord, target: ArtifactRecord, expectedTransform: RigidTransform | null, expectedOutcome: GoldenRegistrationFixture['expectedOutcome'], translationToleranceMm: number, rotationToleranceDegrees: number): GoldenRegistrationFixture {
  return { name, source, target, sourceRole: 'preparation-arch', targetRole: 'pre-operative-upper', expectedTransform, expectedOutcome, translationToleranceMm, rotationToleranceDegrees, syntheticUse: 'engineering registration validation only' };
}

function reflectArtifact(artifact: ArtifactRecord, name: string): ArtifactRecord {
  const source = artifact.mesh.sourceTopology!; const vertices: Vec3[] = [];
  for (let offset = 0; offset < source.positions.length; offset += 3) vertices.push([-source.positions[offset], source.positions[offset + 1], source.positions[offset + 2]]);
  return artifactFromMesh(name, topology(vertices, chunk(source.indices, 3)));
}

function addOutliers(artifact: ArtifactRecord, count: number): ArtifactRecord {
  const source = artifact.mesh.sourceTopology!; const vertices = chunk(source.positions, 3) as Vec3[]; const faces = chunk(source.indices, 3);
  for (let index = 0; index < count; index += 1) {
    const base = vertices.length; const x = 80 + index * 1.3; vertices.push([x, 50, 30], [x + 0.5, 50, 30], [x, 50.5, 30]); faces.push([base, base + 1, base + 2]);
  }
  return artifactFromMesh('outlier-base', topology(vertices, faces));
}

function scaleMesh(mesh: MeshData, factor: number): MeshData {
  const source = mesh.sourceTopology!; const vertices = chunk(source.positions, 3).map((point) => point.map((value) => value * factor) as Vec3); return topology(vertices, chunk(source.indices, 3));
}

function cubeMesh(): MeshData {
  const vertices: Vec3[] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]; return topology(vertices, faces);
}

function chunk<T>(values: T[], size: number): T[][] { const result: T[][] = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result; }
