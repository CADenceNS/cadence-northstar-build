import type { ArtifactRecord, Vec3 } from './core';
import { coordinateVisualizationLines } from './dental-coordinates';
import { boundsOfPoints } from './geometry';
import type { ViewerOverlay } from './inspection-types';
import { applyRigid, composeRigid } from './registration-math';
import type { DentalCoordinateSystem, PairwiseRegistrationResult, RigidTransform } from './registration-types';
import { unitScaleToMillimeters } from './scan-validation';
import { artifactGeometry, deterministicSample } from './spatial-index';

export interface RegistrationOverlayOptions {
  sourceCaseTransform: RigidTransform;
  targetCaseTransform: RigidTransform;
  showAfter: boolean;
  heatmapRange: number;
  dentalCoordinates?: DentalCoordinateSystem | null;
}

export function buildRegistrationOverlays(
  result: PairwiseRegistrationResult,
  sourceArtifact: ArtifactRecord,
  targetArtifact: ArtifactRecord,
  options: RegistrationOverlayOptions,
): ViewerOverlay[] {
  const overlays: ViewerOverlay[] = [];
  const sourceScale = unitScaleToMillimeters(sourceArtifact.units); const targetScale = unitScaleToMillimeters(targetArtifact.units);
  const sourceTransform = options.showAfter && result.transform ? composeRigid(options.targetCaseTransform, result.transform) : options.sourceCaseTransform;
  const sourcePoints = deterministicSample(artifactGeometry(sourceArtifact), 1500).map((point) => applyRigid(sourceTransform, point.position.map((value) => value * sourceScale) as Vec3));
  const targetPoints = deterministicSample(artifactGeometry(targetArtifact), 1500).map((point) => applyRigid(options.targetCaseTransform, point.position.map((value) => value * targetScale) as Vec3));
  overlays.push(pointsOverlay(`${result.id}:source`, 'registration-source', sourcePoints, [0.1, 0.75, 1, 0.72], 'Source scan'));
  overlays.push(pointsOverlay(`${result.id}:target`, 'registration-target', targetPoints, [1, 0.45, 0.15, 0.72], 'Target scan'));

  const converted = result.correspondences.map((item) => ({ ...item, source: applyRigid(options.targetCaseTransform, item.source), target: applyRigid(options.targetCaseTransform, item.target) }));
  overlays.push(linesOverlay(`${result.id}:correspondences`, 'registration-correspondences', converted.flatMap((item) => [item.source, item.target]), [0.95, 0.95, 0.2, 0.55], 'Correspondence samples'));
  overlays.push(pointsOverlay(`${result.id}:overlap`, 'registration-overlap', converted.filter((item) => item.accepted).map((item) => item.source), [0.1, 1, 0.4, 0.9], 'Overlap region'));
  overlays.push(pointsOverlay(`${result.id}:non-overlap`, 'registration-non-overlap', converted.filter((item) => !item.accepted).map((item) => item.source), [1, 0.15, 0.12, 0.9], 'Non-overlap region'));
  overlays.push(pointsOverlay(`${result.id}:penetration`, 'registration-penetration', converted.filter((item) => item.penetrating).map((item) => item.source), [1, 0.05, 0.75, 0.95], 'Penetration indicators'));

  const heatRange = Math.max(0.01, options.heatmapRange); const buckets = [0.2, 0.4, 0.6, 0.8, 1];
  const colors: Array<[number, number, number, number]> = [[0.1, 0.4, 1, 0.95], [0.1, 0.9, 0.8, 0.95], [0.4, 1, 0.2, 0.95], [1, 0.75, 0.1, 0.95], [1, 0.1, 0.05, 0.95]];
  buckets.forEach((limit, index) => {
    const lower = index ? buckets[index - 1] * heatRange : 0; const upper = limit * heatRange;
    overlays.push(pointsOverlay(`${result.id}:heatmap:${index}`, 'registration-heatmap', converted.filter((item) => item.distance >= lower && item.distance <= upper).map((item) => item.source), colors[index], `Residual ${lower.toFixed(2)}–${upper.toFixed(2)} mm`));
  });

  if (result.metrics.biteScanAgreement !== null && result.metrics.biteScanAgreement < 0.8) {
    overlays.push(linesOverlay(`${result.id}:bite-inconsistency`, 'registration-bite-inconsistency', converted.filter((item) => item.distance > result.metrics.percentile95Residual).flatMap((item) => [item.source, item.target]), [1, 0, 0.85, 0.9], 'Bite inconsistency'));
  }
  if (options.dentalCoordinates) overlays.push(...coordinateOverlays(options.dentalCoordinates));
  return overlays.filter((overlay) => overlay.positions.length > 0);
}

export function coordinateOverlays(coordinates: DentalCoordinateSystem): ViewerOverlay[] {
  const lines = coordinateVisualizationLines(coordinates);
  const colors: Record<string, [number, number, number, number]> = { 'dental-x': [1, 0.2, 0.2, 1], 'dental-y': [0.2, 1, 0.3, 1], 'dental-z': [0.2, 0.5, 1, 1], 'dental-midline': [1, 0.9, 0.1, 0.95] };
  const overlays: ViewerOverlay[] = lines.map((line) => ({ ...linesOverlay(line.id, line.id, [line.start, line.end], colors[line.id] ?? [1, 1, 1, 1], line.label), labelPosition: line.end }));
  const origin = coordinates.origin; const x = coordinates.leftRightAxis; const y = coordinates.anteriorPosteriorAxis; const size = 30;
  const corners = [
    add(add(origin, multiply(x, size)), multiply(y, size)), add(add(origin, multiply(x, -size)), multiply(y, size)),
    add(add(origin, multiply(x, -size)), multiply(y, -size)), add(add(origin, multiply(x, size)), multiply(y, -size)),
  ];
  overlays.push(linesOverlay('occlusal-plane', 'dental-occlusal-plane', [corners[0], corners[1], corners[1], corners[2], corners[2], corners[3], corners[3], corners[0]], [0.15, 0.95, 1, 0.7], 'Occlusal plane'));
  return overlays;
}

function pointsOverlay(id: string, checkId: string, points: Vec3[], color: [number, number, number, number], label: string): ViewerOverlay {
  const bounds = boundsOfPoints(points) ?? { min: [0, 0, 0], max: [0, 0, 0] };
  return { id, checkId, primitive: 'points', positions: points.flat(), color, elementCount: points.length, bounds, visible: true, label, labelPosition: points[0] };
}
function linesOverlay(id: string, checkId: string, points: Vec3[], color: [number, number, number, number], label: string): ViewerOverlay {
  const bounds = boundsOfPoints(points) ?? { min: [0, 0, 0], max: [0, 0, 0] };
  return { id, checkId, primitive: 'lines', positions: points.flat(), color, elementCount: points.length / 2, bounds, visible: true, label, labelPosition: points[0] };
}
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function multiply(value: Vec3, amount: number): Vec3 { return [value[0] * amount, value[1] * amount, value[2] * amount]; }
