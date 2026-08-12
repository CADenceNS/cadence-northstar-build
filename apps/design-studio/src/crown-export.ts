import { parseMesh, type MeshData, type Vec3 } from './core';
import { analyzeSelfIntersections, buildTopology, faceNormal, indexedMesh, inspectGeometry, meshData, type IndexedMesh } from './editing-geometry';
import { closestPointOnMesh, distance3, dot3, cross3, type Triangle3 } from './geometry';
import type { CrownExportFormat, CrownRoundTripResult } from './restoration-types';

export interface CrownExportOutput {
  format: CrownExportFormat;
  mimeType: string;
  extension: 'stl' | 'obj' | 'ply';
  bytes: Uint8Array;
  roundTrip: CrownRoundTripResult;
  reimportedMesh: MeshData;
}

function triangles(mesh: IndexedMesh): Triangle3[] { return mesh.faces.map(([a, b, c], id) => ({ id, a: mesh.positions[a], b: mesh.positions[b], c: mesh.positions[c] })); }

function binaryStl(mesh: IndexedMesh): Uint8Array {
  const bytes = new Uint8Array(84 + mesh.faces.length * 50); const view = new DataView(bytes.buffer);
  new TextEncoder().encodeInto('CADence Design Studio manufacturing export; millimeter units', bytes.subarray(0, 80)); view.setUint32(80, mesh.faces.length, true); let offset = 84;
  for (const face of mesh.faces) {
    const normal = faceNormal(mesh, face); for (const value of normal) { view.setFloat32(offset, value, true); offset += 4; }
    for (const id of face) for (const value of mesh.positions[id]) { view.setFloat32(offset, value, true); offset += 4; }
    view.setUint16(offset, 0, true); offset += 2;
  }
  return bytes;
}

function asciiStl(mesh: IndexedMesh): Uint8Array {
  const lines = ['solid cadence_crown_mm'];
  for (const face of mesh.faces) {
    const normal = faceNormal(mesh, face); lines.push(`  facet normal ${number(normal[0])} ${number(normal[1])} ${number(normal[2])}`, '    outer loop');
    for (const id of face) { const point = mesh.positions[id]; lines.push(`      vertex ${number(point[0])} ${number(point[1])} ${number(point[2])}`); }
    lines.push('    endloop', '  endfacet');
  }
  lines.push('endsolid cadence_crown_mm'); return new TextEncoder().encode(lines.join('\n'));
}

function obj(mesh: IndexedMesh): Uint8Array {
  const lines = ['# CADence Design Studio crown', '# units: millimeter', 'o restoration'];
  for (const point of mesh.positions) lines.push(`v ${number(point[0])} ${number(point[1])} ${number(point[2])}`);
  for (const face of mesh.faces) lines.push(`f ${face[0] + 1} ${face[1] + 1} ${face[2] + 1}`);
  return new TextEncoder().encode(lines.join('\n'));
}

function ply(mesh: IndexedMesh): Uint8Array {
  const lines = ['ply', 'format ascii 1.0', 'comment CADence Design Studio crown', 'comment units millimeter', `element vertex ${mesh.positions.length}`, 'property float x', 'property float y', 'property float z', `element face ${mesh.faces.length}`, 'property list uchar int vertex_indices', 'end_header'];
  for (const point of mesh.positions) lines.push(`${number(point[0])} ${number(point[1])} ${number(point[2])}`);
  for (const face of mesh.faces) lines.push(`3 ${face[0]} ${face[1]} ${face[2]}`);
  return new TextEncoder().encode(lines.join('\n'));
}

function number(value: number): string { return Number(value.toPrecision(15)).toString(); }

function weld(mesh: MeshData, tolerance = 1e-5): IndexedMesh {
  const source = mesh.sourceTopology ?? { positions: mesh.positions, indices: mesh.indices }; const positions: Vec3[] = []; const byKey = new Map<string, number>(); const sourceMap: number[] = [];
  for (let offset = 0; offset < source.positions.length; offset += 3) {
    const point: Vec3 = [source.positions[offset], source.positions[offset + 1], source.positions[offset + 2]]; const key = point.map((value) => Math.round(value / tolerance)).join(':'); let id = byKey.get(key);
    if (id === undefined) { id = positions.length; byKey.set(key, id); positions.push(point); } sourceMap.push(id);
  }
  const faces: IndexedMesh['faces'] = [];
  for (let offset = 0; offset + 2 < source.indices.length; offset += 3) { const face = [sourceMap[source.indices[offset]], sourceMap[source.indices[offset + 1]], sourceMap[source.indices[offset + 2]]] as [number, number, number]; if (new Set(face).size === 3) faces.push(face); }
  return { positions, faces };
}

function signedVolume(mesh: IndexedMesh): number { return mesh.faces.reduce((sum, [a, b, c]) => sum + dot3(mesh.positions[a], cross3(mesh.positions[b], mesh.positions[c])) / 6, 0); }

function surfaceDeviation(first: IndexedMesh, second: IndexedMesh): { maximum: number; mean: number } {
  const firstTriangles = triangles(first); const secondTriangles = triangles(second); const values: number[] = [];
  for (const point of first.positions) { const closest = closestPointOnMesh(point, secondTriangles); if (closest) values.push(closest.distance); }
  for (const point of second.positions) { const closest = closestPointOnMesh(point, firstTriangles); if (closest) values.push(closest.distance); }
  return { maximum: values.length ? Math.max(...values) : Infinity, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Infinity };
}

async function checksum(bytes: Uint8Array): Promise<string> { const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; const digest = await crypto.subtle.digest('SHA-256', buffer); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''); }

function formatMetadata(format: CrownExportFormat): { format: 'stl' | 'obj' | 'ply'; mimeType: string; extension: 'stl' | 'obj' | 'ply' } {
  if (format === 'binary-stl' || format === 'ascii-stl') return { format: 'stl', mimeType: 'model/stl', extension: 'stl' };
  if (format === 'obj') return { format: 'obj', mimeType: 'text/plain', extension: 'obj' };
  return { format: 'ply', mimeType: 'application/octet-stream', extension: 'ply' };
}

export async function exportAndValidateCrown(meshDataValue: MeshData, format: CrownExportFormat, toleranceMm = 0.001): Promise<CrownExportOutput> {
  const source = indexedMesh(meshDataValue); const sourceInspection = inspectGeometry(source); const sourceTopology = buildTopology(source);
  if (!sourceInspection.watertight || sourceInspection.shellCount !== 1 || sourceTopology.nonManifoldEdges.length || analyzeSelfIntersections(source).length) throw new Error('Manufacturing export rejected corrupt, open, disconnected, non-manifold, or self-intersecting crown geometry.');
  const bytes = format === 'binary-stl' ? binaryStl(source) : format === 'ascii-stl' ? asciiStl(source) : format === 'obj' ? obj(source) : ply(source); const metadata = formatMetadata(format);
  const parsed = parseMesh(bytes, metadata.format); const restored = weld(parsed); const restoredInspection = inspectGeometry(restored); const deviation = surfaceDeviation(source, restored);
  const dimensions = sourceInspection.boundingDimensionsMm; const restoredDimensions = restoredInspection.boundingDimensionsMm; const dimensionDeviation = dimensions.map((value, axis) => Math.abs(value - restoredDimensions[axis])) as Vec3;
  const volumeDeviation = Math.abs((sourceInspection.volumeMm3 ?? 0) - (restoredInspection.volumeMm3 ?? 0)); const areaDeviation = Math.abs(sourceInspection.surfaceAreaMm2 - restoredInspection.surfaceAreaMm2);
  const orientationPreserved = Math.sign(signedVolume(source)) === Math.sign(signedVolume(restored)); const scalePreserved = dimensionDeviation.every((value) => value <= toleranceMm); const intersections = analyzeSelfIntersections(restored).length;
  const roundTrip: CrownRoundTripResult = {
    format, checksum: await checksum(bytes), byteLength: bytes.byteLength, maximumSurfaceDeviationMm: deviation.maximum, meanSurfaceDeviationMm: deviation.mean, dimensionDeviationMm: dimensionDeviation,
    volumeDeviationMm3: volumeDeviation, areaDeviationMm2: areaDeviation, orientationPreserved, scalePreserved, triangleCountPreserved: source.faces.length === restored.faces.length,
    watertight: restoredInspection.watertight, selfIntersectionCount: intersections,
    passed: deviation.maximum <= toleranceMm && dimensionDeviation.every((value) => value <= toleranceMm) && volumeDeviation <= Math.max(0.001, (sourceInspection.volumeMm3 ?? 0) * 0.0001) && areaDeviation <= Math.max(0.001, sourceInspection.surfaceAreaMm2 * 0.0001) && orientationPreserved && scalePreserved && source.faces.length === restored.faces.length && restoredInspection.watertight && restoredInspection.shellCount === 1 && intersections === 0,
    toleranceMm,
  };
  return { format, mimeType: metadata.mimeType, extension: metadata.extension, bytes, roundTrip, reimportedMesh: meshData(restored) };
}

export async function validateAllCrownExports(mesh: MeshData, toleranceMm = 0.001): Promise<CrownExportOutput[]> {
  const formats: CrownExportFormat[] = ['binary-stl', 'ascii-stl', 'obj', 'ply']; const outputs: CrownExportOutput[] = [];
  for (const format of formats) outputs.push(await exportAndValidateCrown(mesh, format, toleranceMm));
  return outputs;
}

export function triggerCrownDownload(output: CrownExportOutput, fileName: string): void {
  const blob = new Blob([output.bytes.slice().buffer], { type: output.mimeType }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${fileName}.${output.extension}`; link.click(); URL.revokeObjectURL(url);
}
