import { parseMesh, type ArtifactRecord, type MeshFormat } from './core';
import type { IImporter, ImportRequest, ImportResult } from './interfaces';
import { runtimeMetrics } from './metrics';

const SUPPORTED = new Set<MeshFormat>(['stl', 'obj', 'ply']);
const MAX_SOURCE_BYTES = 512 * 1024 * 1024;

export class ManagedMeshImporter implements IImporter {
  supports(format: MeshFormat): boolean { return SUPPORTED.has(format); }

  async validate(request: ImportRequest, existing: ArtifactRecord[]): Promise<void> {
    const format = extensionOf(request.file.name);
    if (!format || !this.supports(format)) throw new Error('Only STL, OBJ and PLY files are supported.');
    if (!request.file.size) throw new Error('The selected file is empty.');
    if (request.file.size > MAX_SOURCE_BYTES) throw new Error('The selected file exceeds the 512 MB import limit.');
    if (!['mm', 'cm', 'm', 'unknown', undefined].includes(request.units)) throw new Error('Unsupported source units.');
    if (!['source', 'normalized', undefined].includes(request.orientation)) throw new Error('Unsupported orientation state.');
    const bytes = new Uint8Array(await request.file.arrayBuffer());
    const checksum = await checksumOf(bytes);
    const duplicate = existing.find((artifact) => artifact.checksum === checksum);
    if (duplicate && !request.allowDuplicate) throw new Error(`Duplicate source detected: ${duplicate.sourceName}`);
  }

  async import(request: ImportRequest, existing: ArtifactRecord[]): Promise<ImportResult> {
    await this.validate(request, existing);
    const startedAt = performance.now();
    const bytes = new Uint8Array(await request.file.arrayBuffer());
    const format = extensionOf(request.file.name);
    if (!format) throw new Error('File extension is required.');

    const checksumStart = performance.now();
    const checksum = await checksumOf(bytes);
    const checksumMetric = { name: 'import.checksum', durationMs: performance.now() - checksumStart, startedAt: new Date().toISOString(), metadata: { bytes: bytes.byteLength } };
    runtimeMetrics.record(checksumMetric);

    const duplicate = existing.find((artifact) => artifact.checksum === checksum);
    const parseStart = performance.now();
    const mesh = parseMesh(bytes, format);
    const parseMetric = { name: 'import.parse', durationMs: performance.now() - parseStart, startedAt: new Date().toISOString(), metadata: { format, triangles: mesh.indices.length / 3, bytes: bytes.byteLength } };
    runtimeMetrics.record(parseMetric);

    validateMesh(mesh.positions, mesh.normals, mesh.indices);
    const now = new Date().toISOString();
    const artifact: ArtifactRecord = {
      id: crypto.randomUUID(), sourceName: request.file.name, sourceFormat: format, checksum, importedAt: now,
      byteLength: bytes.byteLength, units: request.units ?? inferUnits(request.file.name), orientation: request.orientation ?? 'source',
      metadata: { vertexCount: mesh.positions.length / 3, triangleCount: mesh.indices.length / 3, format, sourceLastModified: request.file.lastModified, sourceMimeType: request.file.type || 'application/octet-stream' },
      history: [{ at: now, action: 'imported', detail: `${format.toUpperCase()} source preserved by SHA-256 checksum` }],
      mesh: {
        positions: [...mesh.positions],
        normals: [...mesh.normals],
        indices: [...mesh.indices],
        bounds: { min: [...mesh.bounds.min] as ArtifactRecord['mesh']['bounds']['min'], max: [...mesh.bounds.max] as ArtifactRecord['mesh']['bounds']['max'] },
        sourceTopology: mesh.sourceTopology ? { positions: [...mesh.sourceTopology.positions], indices: [...mesh.sourceTopology.indices] } : undefined,
      },
    };

    const totalMetric = { name: 'import.total', durationMs: performance.now() - startedAt, startedAt: new Date().toISOString(), metadata: { format, bytes: bytes.byteLength, triangles: mesh.indices.length / 3 } };
    runtimeMetrics.record(totalMetric);
    runtimeMetrics.estimateMemory([artifact]);
    return { artifact: structuredClone(artifact), duplicateOf: duplicate?.id, metrics: [checksumMetric, parseMetric, totalMetric] };
  }
}

function extensionOf(name: string): MeshFormat | null { const extension = name.split('.').pop()?.toLowerCase(); return extension && SUPPORTED.has(extension as MeshFormat) ? extension as MeshFormat : null; }
function inferUnits(name: string): ArtifactRecord['units'] { const value = name.toLowerCase(); if (/(^|[_\-.])cm([_\-.]|$)/.test(value)) return 'cm'; if (/(^|[_\-.])m([_\-.]|$)/.test(value)) return 'm'; return 'mm'; }
function validateMesh(positions: number[], normals: number[], indices: number[]): void { if (!positions.length || positions.length % 3) throw new Error('Mesh positions are invalid.'); if (normals.length !== positions.length) throw new Error('Mesh normals do not match vertex data.'); if (!indices.length || indices.length % 3) throw new Error('Mesh does not contain complete triangles.'); if (![...positions, ...normals].every(Number.isFinite)) throw new Error('Mesh contains non-finite geometry values.'); const vertexCount = positions.length / 3; if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= vertexCount)) throw new Error('Mesh contains an invalid index.'); }
async function checksumOf(bytes: Uint8Array): Promise<string> { const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; const digest = await crypto.subtle.digest('SHA-256', buffer); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''); }
