import type { ArtifactRecord, MeasurementAnchor, MeasurementKind, MeasurementRecord, SceneObject, Vec3 } from './core';
import { boundsOfTriangles, closestPointOnMesh, distance3, meshTriangles, minimumDistanceBetweenMeshes, subtract3, dot3, length3 } from './geometry';
import type { SurfaceHit } from './inspection-types';

export interface MeasurementInput {
  kind: MeasurementKind;
  anchors: MeasurementAnchor[];
  objectIds: string[];
  artifacts: ArtifactRecord[];
  scene: SceneObject[];
  precision?: number;
  name?: string;
  existingId?: string;
}

export const MEASUREMENT_LABELS: Record<MeasurementKind, string> = {
  'point-distance': 'Point-to-point distance',
  'multi-segment-distance': 'Multi-segment distance',
  'three-point-angle': 'Three-point angle',
  'bounding-dimensions': 'Object bounding dimensions',
  'surface-coordinate': 'Surface point coordinates',
  'cross-section-distance': 'Cross-section distance',
  'clearance-distance': 'Clearance distance',
  'minimum-object-distance': 'Minimum object distance',
};

export function anchorFromHit(hit: SurfaceHit): MeasurementAnchor {
  return { id: crypto.randomUUID(), position: [...hit.position], objectId: hit.objectId, artifactId: hit.artifactId, triangleIndex: hit.triangleIndex };
}

export function requiredAnchorCount(kind: MeasurementKind): number | 'multiple' {
  if (kind === 'three-point-angle') return 3;
  if (['point-distance', 'cross-section-distance'].includes(kind)) return 2;
  if (['surface-coordinate', 'clearance-distance'].includes(kind)) return 1;
  if (kind === 'multi-segment-distance') return 'multiple';
  return 0;
}

export function createMeasurement(input: MeasurementInput): MeasurementRecord {
  const now = new Date().toISOString();
  const precision = clampPrecision(input.precision ?? 2);
  const scene = new Map(input.scene.map((object) => [object.id, object]));
  const artifacts = new Map(input.artifacts.map((artifact) => [artifact.id, artifact]));
  const objectIds = [...new Set(input.objectIds)];
  let anchors = structuredClone(input.anchors);
  let value = 0;
  let values: Record<string, number> = {};
  let units: MeasurementRecord['units'] = 'mm';

  if (input.kind === 'point-distance' || input.kind === 'cross-section-distance') {
    requireAnchors(anchors, 2, input.kind);
    if (input.kind === 'cross-section-distance' && anchors[0].objectId !== anchors[1].objectId) throw new Error('Cross-section anchors must be placed on the same object.');
    value = distance3(anchors[0].position, anchors[1].position);
  } else if (input.kind === 'multi-segment-distance') {
    if (anchors.length < 2) throw new Error('Multi-segment distance requires at least two anchors.');
    value = anchors.slice(1).reduce((sum, anchor, index) => sum + distance3(anchors[index].position, anchor.position), 0);
    values.segmentCount = anchors.length - 1;
  } else if (input.kind === 'three-point-angle') {
    requireAnchors(anchors, 3, input.kind);
    const first = subtract3(anchors[0].position, anchors[1].position);
    const second = subtract3(anchors[2].position, anchors[1].position);
    const denominator = length3(first) * length3(second);
    if (!denominator) throw new Error('Angle anchors must be distinct.');
    value = Math.acos(Math.max(-1, Math.min(1, dot3(first, second) / denominator))) * 180 / Math.PI;
    units = 'degrees';
  } else if (input.kind === 'surface-coordinate') {
    requireAnchors(anchors, 1, input.kind);
    const [x, y, z] = anchors[0].position;
    values = { x, y, z };
    value = Math.hypot(x, y, z);
  } else if (input.kind === 'bounding-dimensions') {
    if (objectIds.length !== 1) throw new Error('Bounding dimensions require exactly one selected object.');
    const object = requireObject(scene, objectIds[0]); const artifact = requireArtifact(artifacts, object.artifactId);
    const bounds = boundsOfTriangles(meshTriangles(artifact, object));
    if (!bounds) throw new Error('The selected object has no measurable geometry.');
    values = { width: bounds.max[0] - bounds.min[0], height: bounds.max[1] - bounds.min[1], depth: bounds.max[2] - bounds.min[2] };
    value = Math.hypot(values.width, values.height, values.depth);
    anchors = [
      { id: crypto.randomUUID(), position: [...bounds.min], objectId: object.id, artifactId: artifact.id },
      { id: crypto.randomUUID(), position: [...bounds.max], objectId: object.id, artifactId: artifact.id },
    ];
  } else if (input.kind === 'clearance-distance') {
    requireAnchors(anchors, 1, input.kind);
    if (objectIds.length !== 2) throw new Error('Clearance distance requires exactly two selected objects.');
    const targetId = objectIds.find((id) => id !== anchors[0].objectId);
    if (!targetId) throw new Error('Place the clearance anchor on one of the selected objects.');
    const targetObject = requireObject(scene, targetId); const targetArtifact = requireArtifact(artifacts, targetObject.artifactId);
    const closest = closestPointOnMesh(anchors[0].position, meshTriangles(targetArtifact, targetObject));
    if (!closest) throw new Error('The target surface has no measurable geometry.');
    anchors.push({ id: crypto.randomUUID(), position: closest.point, objectId: targetObject.id, artifactId: targetArtifact.id, triangleIndex: closest.triangleId });
    value = closest.distance;
  } else if (input.kind === 'minimum-object-distance') {
    if (objectIds.length !== 2) throw new Error('Minimum distance requires exactly two selected objects.');
    const firstObject = requireObject(scene, objectIds[0]); const secondObject = requireObject(scene, objectIds[1]);
    const firstArtifact = requireArtifact(artifacts, firstObject.artifactId); const secondArtifact = requireArtifact(artifacts, secondObject.artifactId);
    const minimum = minimumDistanceBetweenMeshes(meshTriangles(firstArtifact, firstObject), meshTriangles(secondArtifact, secondObject));
    if (!minimum) throw new Error('Both selected objects must contain measurable geometry.');
    value = minimum.distance;
    anchors = [
      { id: crypto.randomUUID(), position: minimum.first, objectId: firstObject.id, artifactId: firstArtifact.id, triangleIndex: minimum.firstTriangle },
      { id: crypto.randomUUID(), position: minimum.second, objectId: secondObject.id, artifactId: secondArtifact.id, triangleIndex: minimum.secondTriangle },
    ];
  }

  if (!Number.isFinite(value) || Object.values(values).some((item) => !Number.isFinite(item))) throw new Error('Measurement calculation produced an invalid numeric result.');
  return {
    id: input.existingId ?? crypto.randomUUID(),
    kind: input.kind,
    name: input.name?.trim() || MEASUREMENT_LABELS[input.kind],
    anchors,
    objectIds,
    value,
    values,
    units,
    precision,
    visible: true,
    createdAt: now,
    updatedAt: now,
    metadata: input.kind === 'cross-section-distance' ? { method: 'surface anchors in the active view section' } : {},
  };
}

export function formatMeasurement(measurement: MeasurementRecord): string {
  const precision = clampPrecision(measurement.precision);
  if (measurement.kind === 'bounding-dimensions') return `${measurement.values.width.toFixed(precision)} × ${measurement.values.height.toFixed(precision)} × ${measurement.values.depth.toFixed(precision)} mm`;
  if (measurement.kind === 'surface-coordinate') return `X ${measurement.values.x.toFixed(precision)} · Y ${measurement.values.y.toFixed(precision)} · Z ${measurement.values.z.toFixed(precision)} mm`;
  return `${measurement.value.toFixed(precision)} ${measurement.units === 'degrees' ? '°' : 'mm'}`;
}

export function measurementSegments(measurement: MeasurementRecord): Array<[Vec3, Vec3]> {
  const segments: Array<[Vec3, Vec3]> = [];
  for (let index = 1; index < measurement.anchors.length; index += 1) segments.push([measurement.anchors[index - 1].position, measurement.anchors[index].position]);
  if (measurement.kind === 'bounding-dimensions' && measurement.anchors.length === 2) segments.push([measurement.anchors[0].position, measurement.anchors[1].position]);
  return segments;
}

function requireAnchors(anchors: MeasurementAnchor[], count: number, kind: MeasurementKind): void { if (anchors.length !== count) throw new Error(`${MEASUREMENT_LABELS[kind]} requires ${count} surface anchor${count === 1 ? '' : 's'}.`); }
function requireObject(scene: Map<string, SceneObject>, id: string): SceneObject { const object = scene.get(id); if (!object) throw new Error(`Scene object ${id} not found.`); return object; }
function requireArtifact(artifacts: Map<string, ArtifactRecord>, id: string): ArtifactRecord { const artifact = artifacts.get(id); if (!artifact) throw new Error(`Artifact ${id} not found.`); return artifact; }
function clampPrecision(value: number): number { return Math.max(0, Math.min(6, Math.round(value))); }
