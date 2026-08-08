import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import type { ArtifactRecord, MeshData, Vec3 } from '../src/core';
import { applyRigid } from '../src/registration-math';
import type { RigidTransform } from '../src/registration-types';

export interface CorpusManifestFile {
  path?: string;
  sanitized_filename?: string;
  role?: string;
  assigned_role?: string;
  sha256: string;
}

export interface CorpusCaseManifest {
  case_id: string;
  corpus_version: string;
  files: CorpusManifestFile[];
  [key: string]: unknown;
}

export interface LoadedCorpusCase {
  id: string;
  manifest: CorpusCaseManifest;
  manifestHash: string;
  artifacts: Map<string, ArtifactRecord>;
}

interface IntegrityFile {
  path: string;
  bytes: number;
  sha256: string;
}

interface IntegrityManifest {
  corpus_version: string;
  generated: string;
  files: IntegrityFile[];
}

export interface IntegrityResult {
  corpusVersion: string;
  expectedFileCount: number;
  verifiedFileCount: number;
  manifestHashes: Record<string, string>;
}

export class PrivateCorpusLoader {
  private constructor(readonly root: string) {}

  static async open(rootInput: string): Promise<PrivateCorpusLoader> {
    if (!rootInput) throw new Error('CADENCE_DENTAL_CORPUS_PATH is required; a skipped private suite is never a certification pass.');
    return new PrivateCorpusLoader(await realpath(rootInput));
  }

  async verifyIntegrity(): Promise<IntegrityResult> {
    const integrityPath = await this.protectedFile('CORPUS_INTEGRITY.json');
    const integrityBytes = await readFile(integrityPath);
    const integrity = JSON.parse(integrityBytes.toString('utf8')) as IntegrityManifest;
    if (integrity.corpus_version !== '0.3') throw new Error(`Expected private corpus version 0.3, received ${integrity.corpus_version}.`);
    if (integrity.files.length !== 23) throw new Error(`Expected 23 integrity entries, received ${integrity.files.length}.`);

    const manifestHashes: Record<string, string> = {};
    let verifiedFileCount = 0;
    for (const entry of integrity.files) {
      const path = await this.protectedFile(entry.path);
      const bytes = await readFile(path);
      const actualHash = sha256(bytes);
      if (bytes.byteLength !== entry.bytes) throw new Error(`Corpus integrity byte-length mismatch for protected entry ${verifiedFileCount}.`);
      if (actualHash !== entry.sha256) throw new Error(`Corpus integrity SHA-256 mismatch for protected entry ${verifiedFileCount}.`);
      if (entry.path.endsWith('manifest.json')) manifestHashes[entry.path.replace(/\/manifest\.json$/, '')] = actualHash;
      verifiedFileCount += 1;
    }
    return { corpusVersion: integrity.corpus_version, expectedFileCount: integrity.files.length, verifiedFileCount, manifestHashes };
  }

  async verifyOwnerAttestation(): Promise<{ status: string; confirmed: boolean; date: string }> {
    const attestation = JSON.parse(await readFile(await this.protectedFile('OWNER_ATTESTATION.json'), 'utf8')) as {
      corpus_version: string; attestation_status: string; confirmation_date: string; confirmed_statements: string[];
    };
    const confirmation = await readFile(await this.protectedFile('OWNER_ATTESTATION_CONFIRMED.txt'), 'utf8');
    const requiredStatements = [
      /private CADence software testing/i,
      /millimeters/i,
      /CASE-001/i,
      /CASE-002/i,
      /CASE-003/i,
      /must remain private/i,
    ];
    const joined = attestation.confirmed_statements.join(' ');
    const confirmed = attestation.corpus_version === '0.3'
      && attestation.attestation_status === 'confirmed_by_corpus_owner'
      && requiredStatements.every((pattern) => pattern.test(joined))
      && /CONFIRMED/i.test(confirmation);
    if (!confirmed) throw new Error('Corpus owner attestation is incomplete or unconfirmed.');
    return { status: attestation.attestation_status, confirmed, date: attestation.confirmation_date };
  }

  async loadCase(caseId: 'CASE-001' | 'CASE-002' | 'CASE-003'): Promise<LoadedCorpusCase> {
    const manifestPath = await this.protectedFile(`${caseId}/manifest.json`);
    const manifestBytes = await readFile(manifestPath);
    const manifest = JSON.parse(manifestBytes.toString('utf8')) as CorpusCaseManifest;
    if (manifest.case_id !== caseId || manifest.corpus_version !== '0.3') throw new Error(`${caseId} manifest identity or version is invalid.`);
    const artifacts = new Map<string, ArtifactRecord>();
    for (let index = 0; index < manifest.files.length; index += 1) {
      const entry = manifest.files[index];
      const role = entry.role ?? entry.assigned_role;
      if (!role) throw new Error(`${caseId} manifest source ${index} has no assigned role.`);
      if (artifacts.has(role)) throw new Error(`${caseId} contains a duplicate manifest role ${role}.`);
      artifacts.set(role, await this.loadArtifact(caseId, entry, index));
    }
    return { id: caseId, manifest, manifestHash: sha256(manifestBytes), artifacts };
  }

  async assertSourceImmutability(): Promise<void> {
    const integrity = JSON.parse(await readFile(await this.protectedFile('CORPUS_INTEGRITY.json'), 'utf8')) as IntegrityManifest;
    for (let index = 0; index < integrity.files.length; index += 1) {
      const entry = integrity.files[index];
      const path = await this.protectedFile(entry.path);
      const bytes = await readFile(path);
      if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256) throw new Error(`Protected corpus source changed at integrity entry ${index}.`);
    }
  }

  private async loadArtifact(caseId: string, entry: CorpusManifestFile, ordinal: number): Promise<ArtifactRecord> {
    const declared = entry.path ?? entry.sanitized_filename;
    if (!declared) throw new Error(`${caseId} source ${ordinal} has no protected path.`);
    const path = await this.resolveSource(caseId, declared);
    const bytes = await readFile(path);
    const hash = sha256(bytes);
    if (hash !== entry.sha256) throw new Error(`${caseId} source hash mismatch at ordinal ${ordinal}.`);
    const mesh = binaryStlMesh(bytes, `${caseId} source ${ordinal}`);
    const role = entry.role ?? entry.assigned_role ?? 'unknown';
    return {
      id: `${caseId}-artifact-${ordinal}`,
      sourceName: `${caseId}-${role}-${ordinal}.stl`,
      sourceFormat: 'stl',
      checksum: hash,
      importedAt: '2026-08-04T00:00:00.000Z',
      byteLength: bytes.byteLength,
      units: 'mm',
      orientation: 'source',
      metadata: { privateCorpusCase: caseId, manifestRole: role },
      history: [{ at: '2026-08-04T00:00:00.000Z', action: 'private-corpus-load' }],
      mesh,
    };
  }

  private async resolveSource(caseId: string, declared: string): Promise<string> {
    const candidates = [resolve(this.root, declared), resolve(this.root, caseId, declared), resolve(this.root, caseId, 'source', declared)];
    for (const candidate of candidates) {
      this.assertContained(candidate);
      try {
        const actual = await realpath(candidate);
        this.assertContained(actual);
        if (!(await stat(actual)).isFile()) continue;
        return actual;
      } catch {
        // Try the next protected, manifest-derived location.
      }
    }
    throw new Error(`${caseId} source ${sha256(declared).slice(0, 8)} is unavailable inside the protected corpus root.`);
  }

  private async protectedFile(relativePath: string): Promise<string> {
    const candidate = resolve(this.root, relativePath);
    this.assertContained(candidate);
    const actual = await realpath(candidate);
    this.assertContained(actual);
    return actual;
  }

  private assertContained(candidate: string): void {
    const pathFromRoot = relative(this.root, candidate);
    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) throw new Error('Protected corpus path escaped its configured root.');
  }
}

export function roleArtifact(corpusCase: LoadedCorpusCase, role: string): ArtifactRecord {
  const artifact = corpusCase.artifacts.get(role);
  if (!artifact) throw new Error(`${corpusCase.id} is missing required role ${role}.`);
  return artifact;
}

export function compactArtifact(source: ArtifactRecord, name: string, maxTriangles = 4_000): ArtifactRecord {
  const topology = source.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  const triangleCount = Math.floor(topology.indices.length / 3);
  const stride = Math.max(1, Math.ceil(triangleCount / maxTriangles));
  return selectTriangles(source, name, (_center, triangle) => triangle % stride === 0, maxTriangles);
}

export function cropArtifact(source: ArtifactRecord, name: string, axis: 0 | 1 | 2, minimumPortion: number, maximumPortion: number, maxTriangles = 4_000): ArtifactRecord {
  const min = source.mesh.bounds.min[axis]; const extent = source.mesh.bounds.max[axis] - min;
  const lower = min + extent * minimumPortion; const upper = min + extent * maximumPortion;
  return selectTriangles(source, name, (center) => center[axis] >= lower && center[axis] <= upper, maxTriangles);
}

export function missingRegionArtifact(source: ArtifactRecord, name: string, axis: 0 | 1 | 2, missingMinimum: number, missingMaximum: number, maxTriangles = 4_000): ArtifactRecord {
  const min = source.mesh.bounds.min[axis]; const extent = source.mesh.bounds.max[axis] - min;
  const lower = min + extent * missingMinimum; const upper = min + extent * missingMaximum;
  return selectTriangles(source, name, (center) => center[axis] < lower || center[axis] > upper, maxTriangles);
}

export function transformArtifact(source: ArtifactRecord, sourceTransform: RigidTransform, name: string, noiseAmplitude = 0): ArtifactRecord {
  const topology = source.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  const positions: number[] = [];
  for (let offset = 0; offset < topology.positions.length; offset += 3) {
    const point = applyRigid(sourceTransform, [topology.positions[offset], topology.positions[offset + 1], topology.positions[offset + 2]]);
    const index = offset / 3;
    positions.push(
      point[0] + Math.sin(index * 1.731) * noiseAmplitude,
      point[1] + Math.cos(index * 0.917) * noiseAmplitude,
      point[2] + Math.sin(index * 0.431) * noiseAmplitude * 0.7,
    );
  }
  return derivedArtifact(source, name, positions, Array.from(topology.indices), { sourceTransform: sourceTransform.matrix.join(','), noiseAmplitude });
}

export function scaleArtifact(source: ArtifactRecord, name: string, factor: number): ArtifactRecord {
  const topology = source.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  return derivedArtifact(source, name, Array.from(topology.positions, (value) => value * factor), Array.from(topology.indices), { scaleFactor: factor });
}

export function mirrorArtifact(source: ArtifactRecord, name: string): ArtifactRecord {
  const topology = source.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  const positions: number[] = [];
  for (let offset = 0; offset < topology.positions.length; offset += 3) positions.push(-topology.positions[offset], topology.positions[offset + 1], topology.positions[offset + 2]);
  const artifact = derivedArtifact(source, name, positions, Array.from(topology.indices), { likelyMirrored: true });
  artifact.metadata.likelyMirrored = true;
  return artifact;
}

export function appendOutlierComponent(source: ArtifactRecord, name: string, triangleCount = 60): ArtifactRecord {
  const topology = source.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  const positions = Array.from(topology.positions); const indices = Array.from(topology.indices);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const base = positions.length / 3; const x = 250 + triangle * 0.75;
    positions.push(x, 210, 180, x + 0.4, 210, 180, x, 210.4, 180);
    indices.push(base, base + 1, base + 2);
  }
  return derivedArtifact(source, name, positions, indices, { outlierTriangleCount: triangleCount });
}

export function mergeArtifacts(first: ArtifactRecord, second: ArtifactRecord, name: string): ArtifactRecord {
  const firstTopology = first.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  const secondTopology = second.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  const positions = [...Array.from(firstTopology.positions), ...Array.from(secondTopology.positions)];
  const offset = firstTopology.positions.length / 3;
  const indices = [...Array.from(firstTopology.indices), ...Array.from(secondTopology.indices, (index) => index + offset)];
  return derivedArtifact(first, name, positions, indices, { mergedArtifactId: second.id });
}

export function pointsFromArtifact(artifact: ArtifactRecord, count = 4): Vec3[] {
  const topology = artifact.mesh.sourceTopology! as unknown as { positions: ArrayLike<number> };
  const vertexCount = topology.positions.length / 3;
  return Array.from({ length: count }, (_, index) => {
    const vertex = Math.min(vertexCount - 1, Math.floor((index + 1) * vertexCount / (count + 1)));
    const offset = vertex * 3;
    return [topology.positions[offset], topology.positions[offset + 1], topology.positions[offset + 2]];
  });
}

function selectTriangles(source: ArtifactRecord, name: string, include: (center: Vec3, triangle: number) => boolean, maxTriangles: number): ArtifactRecord {
  const topology = source.mesh.sourceTopology! as unknown as { positions: ArrayLike<number>; indices: ArrayLike<number> };
  const candidates: number[] = [];
  for (let offset = 0; offset + 2 < topology.indices.length; offset += 3) {
    const ids = [topology.indices[offset], topology.indices[offset + 1], topology.indices[offset + 2]];
    const center: Vec3 = [0, 0, 0];
    for (const id of ids) for (let axis = 0; axis < 3; axis += 1) center[axis] += topology.positions[id * 3 + axis] / 3;
    if (include(center, offset / 3)) candidates.push(offset);
  }
  if (!candidates.length) throw new Error(`${name} crop selected no real triangles.`);
  const stride = Math.max(1, Math.ceil(candidates.length / maxTriangles));
  const positions: number[] = []; const indices: number[] = [];
  for (let candidate = 0; candidate < candidates.length && indices.length / 3 < maxTriangles; candidate += stride) {
    const offset = candidates[candidate];
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const id = topology.indices[offset + vertex]; const next = positions.length / 3;
      positions.push(topology.positions[id * 3], topology.positions[id * 3 + 1], topology.positions[id * 3 + 2]); indices.push(next);
    }
  }
  return derivedArtifact(source, name, positions, indices, { selectedTriangleCount: indices.length / 3 });
}

function derivedArtifact(source: ArtifactRecord, name: string, positions: number[], indices: number[], metadata: Record<string, string | number | boolean>): ArtifactRecord {
  const bounds = boundsFor(positions);
  const fingerprint = sha256(JSON.stringify({ source: source.checksum, name, positions, indices, metadata }));
  return {
    ...source,
    id: `${name}-${fingerprint.slice(0, 12)}`,
    sourceName: `${name}.stl`,
    checksum: fingerprint,
    byteLength: positions.length * 8 + indices.length * 4,
    metadata: { ...source.metadata, ...metadata, derivedFromHash: source.checksum },
    history: [...source.history, { at: '2026-08-04T00:00:00.000Z', action: 'deterministic-private-fixture', detail: name }],
    mesh: { positions: [], normals: [], indices: [], bounds, sourceTopology: { positions, indices } },
  };
}

function binaryStlMesh(bytes: Uint8Array, label: string): MeshData {
  if (bytes.byteLength < 84) throw new Error(`${label} is not a complete binary STL.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  if (84 + triangleCount * 50 !== bytes.byteLength) throw new Error(`${label} is not a structurally exact binary STL.`);
  const positions = new Float32Array(triangleCount * 9); const indices = new Uint32Array(triangleCount * 3);
  const min: Vec3 = [Infinity, Infinity, Infinity]; const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let byteOffset = 84; let positionOffset = 0;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    byteOffset += 12;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      for (let axis = 0; axis < 3; axis += 1) {
        const value = view.getFloat32(byteOffset, true);
        if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite coordinate.`);
        positions[positionOffset] = value; min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
        positionOffset += 1; byteOffset += 4;
      }
      indices[triangle * 3 + vertex] = triangle * 3 + vertex;
    }
    byteOffset += 2;
  }
  return { positions: [], normals: [], indices: [], bounds: { min, max }, sourceTopology: { positions, indices } } as unknown as MeshData;
}

function boundsFor(positions: number[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity]; const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], positions[offset + axis]); max[axis] = Math.max(max[axis], positions[offset + axis]);
  }
  return { min, max };
}

export function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}
