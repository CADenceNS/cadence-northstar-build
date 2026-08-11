import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import { faceCentroid, indexedMesh } from './editing-geometry';
import { boundsOfPoints, transformPoint } from './geometry';
import type { ViewerOverlay } from './inspection-types';
import type { MarginConfidenceCategory, PreparationProjectState } from './preparation-types';

const CONFIDENCE_COLORS: Record<MarginConfidenceCategory, [number, number, number, number]> = {
  high: [0.15, 0.95, 0.46, 1],
  moderate: [0.95, 0.82, 0.18, 1],
  low: [1, 0.42, 0.12, 1],
  'reconstructed-missing-data': [0.74, 0.32, 1, 1],
  discontinuous: [1, 0.1, 0.2, 1],
  ambiguous: [0.95, 0.25, 0.78, 1],
};

export function buildPreparationOverlays(
  state: PreparationProjectState,
  scene: SceneObject[],
  artifacts: ArtifactRecord[],
  options: { previewCandidateId?: string | null; confidenceMinimum?: number; showSegmentation?: boolean; showAxis?: boolean; showUndercuts?: boolean } = {},
): ViewerOverlay[] {
  const preparation = state.preparations.find((value) => value.id === state.activePreparationId); if (!preparation) return [];
  const object = scene.find((value) => value.id === preparation.sceneObjectId); const artifact = artifacts.find((value) => value.id === preparation.artifactId); if (!object || !artifact) return [];
  const mesh = indexedMesh(artifact.mesh); const overlays: ViewerOverlay[] = [];
  const segmentation = state.segmentations.find((value) => value.id === preparation.activeSegmentationVersionId);
  if (segmentation && options.showSegmentation !== false) {
    const points = segmentation.faceIds.flatMap((faceId) => mesh.faces[faceId]?.map((vertex) => transformPoint(mesh.positions[vertex], object)) ?? []); const bounds = boundsOfPoints(points);
    if (bounds) overlays.push({ id: `prep-segmentation-${segmentation.id}`, checkId: 'preparation-segmentation', primitive: 'triangles', positions: points.flat(), color: [0.15, 0.72, 1, 0.28], elementCount: segmentation.faceIds.length, bounds, visible: true, label: `${preparation.name} region v${segmentation.version}` });
  }
  const candidate = options.previewCandidateId ? state.candidates.flatMap((value) => value.marginCandidates).find((value) => value.id === options.previewCandidateId) : undefined;
  if (candidate) overlays.push(...confidenceOverlays(candidate.segments.map((segment) => ({ ...segment, start: transformPoint(segment.start, object), end: transformPoint(segment.end, object) })), `candidate-${candidate.id}`, options.confidenceMinimum ?? 0));
  const margin = state.margins.find((value) => value.id === preparation.activeMarginVersionId);
  if (margin) {
    const segments = margin.confidenceMeasurements.map((segment) => ({ ...segment, start: transformPoint(segment.start, object), end: transformPoint(segment.end, object) }));
    if (state.settings.confidenceOverlayVisible) overlays.push(...confidenceOverlays(segments, `margin-${margin.id}`, options.confidenceMinimum ?? 0));
    else {
      const points = margin.curve.sampledPoints.map((point) => transformPoint(point, object)); const bounds = boundsOfPoints(points);
      if (bounds) overlays.push({ id: `margin-line-${margin.id}`, checkId: 'approved-margin', primitive: 'lines', positions: linePositions(points, margin.curve.closed), color: margin.locked ? [0.2, 0.95, 0.9, 1] : [1, 0.75, 0.15, 1], elementCount: points.length, bounds, visible: true, label: `${preparation.name} margin` });
    }
  }
  const axis = state.axes.find((value) => value.id === preparation.activeInsertionAxisAnalysisId);
  if (axis && options.showAxis !== false) {
    const centers = segmentation?.faceIds.flatMap((faceId) => mesh.faces[faceId] ? [faceCentroid(mesh, mesh.faces[faceId])] : []) ?? []; const center: Vec3 = centers.length ? centers.reduce<Vec3>((sum, point) => [sum[0] + point[0] / centers.length, sum[1] + point[1] / centers.length, sum[2] + point[2] / centers.length], [0, 0, 0]) : [0, 0, 0]; const length = Math.max(...artifact.mesh.bounds.max.map((value, index) => Math.abs(value - artifact.mesh.bounds.min[index])), 5); const end: Vec3 = [center[0] + axis.selectedAxis[0] * length, center[1] + axis.selectedAxis[1] * length, center[2] + axis.selectedAxis[2] * length]; const points: Vec3[] = [transformPoint(center, object), transformPoint(end, object)]; const bounds = boundsOfPoints(points);
    if (bounds) overlays.push({ id: `prep-axis-${axis.id}`, checkId: 'insertion-axis', primitive: 'lines', positions: points.flat(), color: [0.2, 0.9, 1, 1], elementCount: 1, bounds, visible: true, label: 'Insertion axis', labelPosition: points[1] });
  }
  if (axis && (options.showUndercuts || state.settings.undercutOverlayVisible)) {
    const selected = axis.candidates.find((value) => vectorsEqual(value.direction, axis.selectedAxis)) ?? axis.candidates[0]; const points = selected?.blockedFaceIds.flatMap((faceId) => mesh.faces[faceId]?.map((vertex) => transformPoint(mesh.positions[vertex], object)) ?? []) ?? []; const bounds = boundsOfPoints(points);
    if (bounds) overlays.push({ id: `prep-undercut-${axis.id}`, checkId: 'insertion-undercut', primitive: 'triangles', positions: points.flat(), color: [1, 0.08, 0.16, 0.62], elementCount: selected.blockedFaceIds.length, bounds, visible: true, label: `${selected.blockedFaceIds.length} undercut faces` });
  }
  return overlays;
}

function confidenceOverlays(segments: Array<{ index: number; start: Vec3; end: Vec3; category: MarginConfidenceCategory; confidence: number }>, prefix: string, minimum: number): ViewerOverlay[] {
  return (Object.keys(CONFIDENCE_COLORS) as MarginConfidenceCategory[]).flatMap((category) => {
    const values = segments.filter((segment) => segment.category === category && segment.confidence >= minimum); const points = values.flatMap((segment) => [segment.start, segment.end]); const bounds = boundsOfPoints(points); if (!bounds) return [];
    return [{ id: `${prefix}-${category}`, checkId: `margin-confidence-${category}`, primitive: 'lines' as const, positions: points.flat(), color: CONFIDENCE_COLORS[category], elementCount: values.length, bounds, visible: true, label: `${category.replaceAll('-', ' ')} (${values.length})` }];
  });
}

function linePositions(points: Vec3[], closed: boolean): number[] { const values: number[] = []; for (let index = 1; index < points.length; index += 1) values.push(...points[index - 1], ...points[index]); if (closed && points.length > 2) values.push(...points.at(-1)!, ...points[0]); return values; }
function vectorsEqual(first: Vec3, second: Vec3): boolean { return first.every((value, index) => Math.abs(value - second[index]) < 1e-8); }
