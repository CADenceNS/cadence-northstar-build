import type { SceneObject, Vec3 } from './core';
import { boundsOfPoints, transformPoint } from './geometry';
import type { ViewerOverlay } from './inspection-types';
import type { MeshValidationResult } from './mesh-validation';

const COLORS: Record<string, [number, number, number, number]> = {
  'boundary-edges': [1, 0.35, 0.18, 1],
  'non-manifold-edges': [1, 0, 0.65, 1],
  'degenerate-triangles': [1, 0.82, 0.1, 0.78],
  'duplicate-triangles': [0.75, 0.2, 1, 0.75],
  'disconnected-shells': [0.1, 0.8, 1, 0.72],
  'inconsistent-triangle-winding': [1, 0.5, 0, 1],
  'extremely-small-components': [0.2, 1, 0.4, 0.78],
  'self-intersections': [1, 0.05, 0.05, 1],
};

export const VALIDATION_OVERLAY_CHECKS = Object.keys(COLORS);

export function buildValidationOverlays(result: MeshValidationResult, object: SceneObject): ViewerOverlay[] {
  const start = performance.now();
  const overlays: ViewerOverlay[] = [];
  for (const check of result.checks.filter((item) => VALIDATION_OVERLAY_CHECKS.includes(item.id) && item.affectedElementIds.length)) {
    if (check.id === 'self-intersections') {
      const modelPoints = result.selfIntersections.flatMap((intersection) => intersectionOverlaySegments(intersection.points, intersection.geometry));
      const points = modelPoints.map((point) => transformPoint(point, object));
      const bounds = boundsOfPoints(points); if (!bounds) continue;
      overlays.push({ id: `${result.artifactId}:${check.id}`, checkId: check.id, primitive: 'lines', positions: points.flat(), color: COLORS[check.id], elementCount: result.selfIntersections.length, bounds, visible: true });
      continue;
    }
    const isEdge = check.id === 'boundary-edges' || check.id === 'non-manifold-edges' || check.id === 'inconsistent-triangle-winding';
    const points: Vec3[] = [];
    if (isEdge) {
      for (const id of check.affectedElementIds.filter((value) => value.startsWith('edge:'))) {
        const edge = result.topology.edgeVertices[id]; if (!edge) continue;
        const first = readCanonical(result, edge[0]); const second = readCanonical(result, edge[1]);
        if (first && second) points.push(transformPoint(first, object), transformPoint(second, object));
      }
    } else {
      for (const id of check.affectedElementIds.filter((value) => value.startsWith('triangle:'))) {
        const triangle = result.topology.trianglePositions[Number(id.slice(9))];
        if (!triangle?.length) continue;
        points.push(transformPoint([triangle[0], triangle[1], triangle[2]], object), transformPoint([triangle[3], triangle[4], triangle[5]], object), transformPoint([triangle[6], triangle[7], triangle[8]], object));
      }
    }
    const bounds = boundsOfPoints(points); if (!bounds) continue;
    overlays.push({
      id: `${result.artifactId}:${check.id}`,
      checkId: check.id,
      primitive: isEdge ? 'lines' : 'triangles',
      positions: points.flat(),
      color: COLORS[check.id],
      elementCount: check.affectedCount,
      bounds,
      visible: true,
    });
  }
  void start;
  return overlays;
}

function intersectionOverlaySegments(points: Vec3[], geometry: 'point' | 'segment' | 'area' | 'topology'): Vec3[] {
  if (!points.length) return [];
  if (geometry === 'point' || geometry === 'topology' || points.length === 1) {
    const point = points[0], size = 0.1;
    return [
      [point[0] - size, point[1], point[2]], [point[0] + size, point[1], point[2]],
      [point[0], point[1] - size, point[2]], [point[0], point[1] + size, point[2]],
      [point[0], point[1], point[2] - size], [point[0], point[1], point[2] + size],
    ];
  }
  if (geometry === 'segment' || points.length === 2) return [points[0], points[1]];
  const segments: Vec3[] = [];
  for (let index = 0; index < points.length; index += 1) segments.push(points[index], points[(index + 1) % points.length]);
  return segments;
}

function readCanonical(result: MeshValidationResult, index: number): Vec3 | null {
  const offset = index * 3; const values = result.topology.canonicalPositions;
  return offset + 2 < values.length ? [values[offset], values[offset + 1], values[offset + 2]] : null;
}
