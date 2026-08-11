import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import {
  addControlPoint,
  createSpline,
  createSurfaceProjectedCurve,
  editControlPoint,
  extendCurve,
  joinCurves,
  offsetCurveOnMesh,
  projectCurveToMesh,
  removeControlPoint,
  resampleCurve,
  reverseCurve,
  setCurveClosed,
  simplifyCurve,
  smoothCurve,
  splitCurve,
  trimCurve,
} from './curve-tools';
import { closestPointOnMesh, meshTriangles } from './geometry';
import type { SurfaceCurve } from './editing-types';
import { manualMarginEvidence, snapMarginPoint } from './margin-engine';
import type { MarginCandidate, MarginCommandRecord, MarginVersion, PreparationProjectState } from './preparation-types';

export type MarginEditorOperation =
  | 'draw-manual'
  | 'draw-surface-following'
  | 'draw-magnetic'
  | 'draw-freehand'
  | 'draw-spline'
  | 'draw-point-by-point'
  | 'add-control-point'
  | 'delete-control-point'
  | 'move-control-point'
  | 'insert-control-point'
  | 'drag-section'
  | 'push'
  | 'pull'
  | 'smooth-section'
  | 'smooth-all'
  | 'simplify'
  | 'resample'
  | 'extend'
  | 'trim'
  | 'split'
  | 'join'
  | 'close-loop'
  | 'open-loop'
  | 'reverse'
  | 'surface-reproject'
  | 'local-reproject'
  | 'offset'
  | 'combine-candidates';

export function drawManualMargin(
  name: string,
  points: Vec3[],
  artifact: ArtifactRecord,
  object: SceneObject,
  mode: 'surface-following' | 'magnetic' | 'freehand' | 'spline' | 'point-by-point',
  magnet?: PreparationProjectState['settings'],
  candidatePoints: Vec3[] = [],
): SurfaceCurve {
  if (points.length < (mode === 'spline' ? 3 : 2)) throw new Error(`${mode} margin requires more model-space points.`);
  let placed = points.map((point) => [...point] as Vec3);
  if (mode === 'magnetic') {
    if (!magnet) throw new Error('Magnetic margin drawing requires snap settings.');
    placed = placed.map((point) => snapMarginPoint(point, artifact, {
      enabled: magnet.magnetEnabled, strength: magnet.magnetStrength, searchRadiusMm: magnet.magnetSearchRadiusMm,
      curvatureWeight: magnet.curvatureWeight, surfaceNormalWeight: magnet.surfaceNormalWeight, smoothing: magnet.smoothing,
    }, { candidatePoints }).point);
  }
  const projected = createSurfaceProjectedCurve(name, placed, artifact, object);
  if (mode === 'spline') {
    const spline = createSpline(name, projected.controlPoints, 12, { objectId: object.id, artifactId: artifact.id });
    const triangles = meshTriangles(artifact);
    const sampledPoints = spline.sampledPoints.map((point, index) => {
      const closest = closestPointOnMesh(point, triangles);
      if (!closest) throw new Error(`Spline sample ${index} could not be projected to the preparation surface.`);
      return closest.point;
    });
    return { ...spline, kind: 'surface-projected', controlPoints: sampledPoints, sampledPoints };
  }
  return projected;
}

export function deriveMarginVersion(parent: MarginVersion, curve: SurfaceCurve, operation: MarginEditorOperation, parameters: MarginCommandRecord['parameters'] = {}): MarginVersion {
  if (parent.locked) throw new Error('Locked margin must be explicitly unlocked before editing.'); if (curve.controlPoints.some((point) => !point.every(Number.isFinite))) throw new Error('Margin edit produced invalid model coordinates.');
  const now = new Date().toISOString(); const record: MarginCommandRecord = { commandId: crypto.randomUUID(), commandType: `margin.${operation}`, label: label(operation), executedAt: now, parameters };
  return {
    ...structuredClone(parent), id: crypto.randomUUID(), parentVersionId: parent.id, stage: 'manual-modification', curve: { ...structuredClone(curve), updatedAt: now },
    confidenceMeasurements: manualMarginEvidence(curve), manualAdjustments: [...parent.manualAdjustments, record], quality: null, qcResultId: null, approvedAt: null, approvedBy: null, locked: false, createdAt: now,
  };
}

export function moveMarginControlPoint(parent: MarginVersion, index: number, point: Vec3, artifact: ArtifactRecord): MarginVersion { return deriveMarginVersion(parent, editControlPoint(parent.curve, index, point, artifact), 'move-control-point', { index, x: point[0], y: point[1], z: point[2] }); }
export function insertMarginControlPoint(parent: MarginVersion, index: number, point: Vec3): MarginVersion { return deriveMarginVersion(parent, addControlPoint(parent.curve, point, index), 'insert-control-point', { index, x: point[0], y: point[1], z: point[2] }); }
export function addMarginControlPoint(parent: MarginVersion, point: Vec3): MarginVersion { return deriveMarginVersion(parent, addControlPoint(parent.curve, point), 'add-control-point', { x: point[0], y: point[1], z: point[2] }); }
export function deleteMarginControlPoint(parent: MarginVersion, index: number): MarginVersion { return deriveMarginVersion(parent, removeControlPoint(parent.curve, index), 'delete-control-point', { index }); }

export function dragMarginSection(parent: MarginVersion, start: number, end: number, delta: Vec3, artifact: ArtifactRecord): MarginVersion {
  if (start < 0 || end < start || end >= parent.curve.controlPoints.length) throw new Error('Margin section range is invalid.'); const triangles = meshTriangles(artifact); const points = parent.curve.controlPoints.map((point, index) => {
    if (index < start || index > end) return [...point] as Vec3; const moved = [point[0] + delta[0], point[1] + delta[1], point[2] + delta[2]] as Vec3; const closest = closestPointOnMesh(moved, triangles); if (!closest) throw new Error(`Margin section point ${index} could not be reprojected.`); return closest.point;
  });
  return deriveMarginVersion(parent, rebuildCurve(parent.curve, points), 'drag-section', { start, end, dx: delta[0], dy: delta[1], dz: delta[2] });
}

export function offsetMargin(parent: MarginVersion, distanceMm: number, artifact: ArtifactRecord): MarginVersion { return deriveMarginVersion(parent, offsetCurveOnMesh(parent.curve, distanceMm, artifact), distanceMm >= 0 ? 'push' : 'pull', { distanceMm }); }

export function smoothMargin(parent: MarginVersion, strength: number, range?: [number, number]): MarginVersion {
  if (!range) return deriveMarginVersion(parent, smoothCurve(parent.curve, 1, strength), 'smooth-all', { strength });
  const [start, end] = range; if (start < 0 || end < start || end >= parent.curve.controlPoints.length) throw new Error('Margin smoothing range is invalid.'); const smoothed = smoothCurve(parent.curve, 1, strength); const points = parent.curve.controlPoints.map((point, index) => index >= start && index <= end ? smoothed.controlPoints[index] : point);
  return deriveMarginVersion(parent, rebuildCurve(parent.curve, points), 'smooth-section', { strength, start, end });
}

export function simplifyMargin(parent: MarginVersion, toleranceMm: number): MarginVersion { return deriveMarginVersion(parent, simplifyCurve(parent.curve, toleranceMm), 'simplify', { toleranceMm }); }
export function resampleMargin(parent: MarginVersion, spacingMm: number): MarginVersion { return deriveMarginVersion(parent, resampleCurve(parent.curve, spacingMm), 'resample', { spacingMm }); }
export function extendMargin(parent: MarginVersion, startMm: number, endMm: number): MarginVersion { return deriveMarginVersion(parent, extendCurve(parent.curve, startMm, endMm), 'extend', { startMm, endMm }); }
export function trimMargin(parent: MarginVersion, startMm: number, endMm: number): MarginVersion { return deriveMarginVersion(parent, trimCurve(parent.curve, startMm, endMm), 'trim', { startMm, endMm }); }

export function splitMargin(parent: MarginVersion, controlPointIndex: number): [MarginVersion, SurfaceCurve] {
  const [first, second] = splitCurve(parent.curve, controlPointIndex); return [deriveMarginVersion(parent, first, 'split', { controlPointIndex }), second];
}

export function joinMargin(parent: MarginVersion, second: SurfaceCurve, toleranceMm: number): MarginVersion { return deriveMarginVersion(parent, joinCurves(parent.curve, second, toleranceMm), 'join', { toleranceMm, secondCurveId: second.id }); }
export function setMarginClosed(parent: MarginVersion, closed: boolean): MarginVersion { return deriveMarginVersion(parent, setCurveClosed(parent.curve, closed), closed ? 'close-loop' : 'open-loop'); }
export function reverseMargin(parent: MarginVersion): MarginVersion { return deriveMarginVersion(parent, reverseCurve(parent.curve), 'reverse'); }
export function reprojectMargin(parent: MarginVersion, artifact: ArtifactRecord, object: SceneObject): MarginVersion { return deriveMarginVersion(parent, projectCurveToMesh(parent.curve, artifact, object, object), 'surface-reproject'); }

export function localReprojectMargin(parent: MarginVersion, artifact: ArtifactRecord, indices: number[]): MarginVersion {
  const triangles = meshTriangles(artifact); const selected = new Set(indices); const points = parent.curve.controlPoints.map((point, index) => {
    if (!selected.has(index)) return [...point] as Vec3; const closest = closestPointOnMesh(point, triangles); if (!closest) throw new Error(`Margin point ${index} could not be reprojected.`); return closest.point;
  });
  return deriveMarginVersion(parent, rebuildCurve(parent.curve, points), 'local-reproject', { indices: indices.join(',') });
}

export function combineCandidateSections(candidates: MarginCandidate[], sections: Array<{ candidateId: string; start: number; end: number }>, name = 'Combined margin candidate'): SurfaceCurve {
  if (sections.length < 2) throw new Error('Combining candidates requires at least two explicitly selected sections.'); const points: Vec3[] = [];
  for (const section of sections) {
    const candidate = candidates.find((value) => value.id === section.candidateId); if (!candidate) throw new Error(`Margin candidate ${section.candidateId} not found.`); if (section.start < 0 || section.end < section.start || section.end >= candidate.points.length) throw new Error('Candidate section range is invalid.'); const values = candidate.points.slice(section.start, section.end + 1).map((point) => [...point] as Vec3); if (points.length && distance(points.at(-1)!, values.at(-1)!) < distance(points.at(-1)!, values[0])) values.reverse(); if (points.length && distance(points.at(-1)!, values[0]) > 1) throw new Error('Candidate sections are more than 1 mm apart and cannot be silently bridged.'); if (points.length) values.shift(); points.push(...values);
  }
  const now = new Date().toISOString(); return { id: crypto.randomUUID(), name, kind: 'surface-projected', objectId: null, artifactId: null, controlPoints: points, sampledPoints: points, closed: distance(points[0], points.at(-1)!) <= 0.1, visible: true, createdAt: now, updatedAt: now };
}

function rebuildCurve(curve: SurfaceCurve, points: Vec3[]): SurfaceCurve {
  if (curve.kind === 'spline' && points.length >= 3) return { ...createSpline(curve.name, points, 12, curve.objectId && curve.artifactId ? { objectId: curve.objectId, artifactId: curve.artifactId } : undefined), id: curve.id, closed: curve.closed, visible: curve.visible, createdAt: curve.createdAt, updatedAt: new Date().toISOString() };
  return { ...structuredClone(curve), controlPoints: points.map((point) => [...point]), sampledPoints: points.map((point) => [...point]), updatedAt: new Date().toISOString() };
}
function distance(first: Vec3, second: Vec3): number { return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]); }
function label(value: string): string { return value.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '); }
