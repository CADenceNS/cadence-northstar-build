import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import { add3, closestPointOnMesh, cross3, distance3, inverseTransformPoint, meshTriangles, normalize3, scale3, subtract3, transformPoint } from './geometry';
import type { SurfaceCurve } from './editing-types';

export function createPolyline(name: string, points: Vec3[], association?: { objectId: string; artifactId: string }): SurfaceCurve {
  validatePoints(points, 2);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), name: requiredName(name), kind: 'polyline', objectId: association?.objectId ?? null, artifactId: association?.artifactId ?? null,
    controlPoints: clonePoints(points), sampledPoints: clonePoints(points), closed: false, visible: true, createdAt: now, updatedAt: now,
  };
}

export function createSpline(name: string, points: Vec3[], segmentsPerSpan = 12, association?: { objectId: string; artifactId: string }): SurfaceCurve {
  validatePoints(points, 3);
  const curve = createPolyline(name, points, association);
  return { ...curve, kind: 'spline', sampledPoints: catmullRom(points, segmentsPerSpan), updatedAt: new Date().toISOString() };
}

export function createSurfaceProjectedCurve(name: string, points: Vec3[], artifact: ArtifactRecord, object: SceneObject): SurfaceCurve {
  const projected = projectPoints(points, artifact);
  const curve = createPolyline(name, projected, { objectId: object.id, artifactId: artifact.id });
  return { ...curve, kind: 'surface-projected', controlPoints: projected, sampledPoints: projected };
}

export function editControlPoint(curve: SurfaceCurve, index: number, point: Vec3, artifact?: ArtifactRecord, _object?: SceneObject): SurfaceCurve {
  if (!curve.controlPoints[index]) throw new Error(`Control point ${index} is unavailable.`);
  validatePoints([point], 1);
  const points = clonePoints(curve.controlPoints);
  points[index] = curve.kind === 'surface-projected' && artifact ? projectPoints([point], artifact)[0] : [...point];
  return resampleForKind(curve, points);
}

export function addControlPoint(curve: SurfaceCurve, point: Vec3, index = curve.controlPoints.length): SurfaceCurve {
  validatePoints([point], 1);
  if (index < 0 || index > curve.controlPoints.length) throw new Error('Control-point insertion index is outside the curve.');
  const points = clonePoints(curve.controlPoints); points.splice(index, 0, [...point]);
  return resampleForKind(curve, points);
}

export function removeControlPoint(curve: SurfaceCurve, index: number): SurfaceCurve {
  if (!curve.controlPoints[index]) throw new Error(`Control point ${index} is unavailable.`);
  const minimum = curve.kind === 'spline' ? 3 : 2;
  if (curve.controlPoints.length <= minimum) throw new Error(`${curve.kind === 'spline' ? 'Spline' : 'Polyline'} curves require at least ${minimum} control points.`);
  const points = clonePoints(curve.controlPoints); points.splice(index, 1);
  return resampleForKind(curve, points);
}

export function smoothCurve(curve: SurfaceCurve, iterations = 1, strength = 0.5): SurfaceCurve {
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error('Curve smoothing strength must be between zero and one.');
  let points = clonePoints(curve.controlPoints);
  for (let iteration = 0; iteration < Math.max(1, Math.floor(iterations)); iteration += 1) {
    points = points.map((point, index) => {
      if (!curve.closed && (index === 0 || index === points.length - 1)) return point;
      const previous = points[(index - 1 + points.length) % points.length]; const next = points[(index + 1) % points.length];
      const average = scale3(add3(previous, next), 0.5);
      return add3(scale3(point, 1 - strength), scale3(average, strength));
    });
  }
  return resampleForKind(curve, points);
}

export function simplifyCurve(curve: SurfaceCurve, toleranceMm: number): SurfaceCurve {
  if (!(toleranceMm > 0) || !Number.isFinite(toleranceMm)) throw new Error('Curve simplification tolerance must be greater than zero.');
  let points = ramerDouglasPeucker(curve.closed ? [...curve.controlPoints, curve.controlPoints[0]] : curve.controlPoints, toleranceMm);
  if (curve.closed && points.length > 1 && distance3(points[0], points.at(-1)!) <= 1e-9) points = points.slice(0, -1);
  if (points.length < (curve.closed ? 3 : 2)) throw new Error('Curve simplification removed too many points.');
  return resampleForKind(curve, points);
}

export function resampleCurve(curve: SurfaceCurve, spacingMm: number): SurfaceCurve {
  if (!(spacingMm > 0) || !Number.isFinite(spacingMm)) throw new Error('Curve resampling spacing must be greater than zero.');
  const source = curve.sampledPoints.length >= 2 ? curve.sampledPoints : curve.controlPoints;
  const sampled = sampleByDistance(source, spacingMm, curve.closed);
  return { ...structuredClone(curve), controlPoints: clonePoints(sampled), sampledPoints: clonePoints(sampled), updatedAt: new Date().toISOString() };
}

export function offsetCurve(curve: SurfaceCurve, distanceMm: number, surfaceNormal: Vec3 = [0, 0, 1]): SurfaceCurve {
  if (!Number.isFinite(distanceMm)) throw new Error('Curve offset must be a finite millimeter value.');
  const normal = normalize3(surfaceNormal);
  if (!normal.some(Math.abs)) throw new Error('Curve offset requires a non-zero surface normal.');
  const points = curve.controlPoints.map((point, index) => {
    const previous = curve.controlPoints[Math.max(0, index - 1)]; const next = curve.controlPoints[Math.min(curve.controlPoints.length - 1, index + 1)];
    const tangent = normalize3(subtract3(next, previous));
    const offsetDirection = normalize3(cross3(normal, tangent));
    return add3(point, scale3(offsetDirection, distanceMm));
  });
  return resampleForKind(curve, points);
}

export function offsetCurveOnMesh(curve: SurfaceCurve, distanceMm: number, artifact: ArtifactRecord): SurfaceCurve {
  if (!Number.isFinite(distanceMm)) throw new Error('Curve offset must be a finite millimeter value.'); const triangles = meshTriangles(artifact); if (!triangles.length) throw new Error('Surface-associated curve offset requires triangle geometry.');
  let points = curve.controlPoints.map((point, index) => {
    const previous = curve.controlPoints[Math.max(0, index - 1)]; const next = curve.controlPoints[Math.min(curve.controlPoints.length - 1, index + 1)]; const tangent = normalize3(subtract3(next, previous)); const closest = closestPointOnMesh(point, triangles); const triangle = closest ? triangles.find((value) => value.id === closest.triangleId) : undefined; if (!triangle) throw new Error(`Curve control point ${index} could not resolve a source surface normal.`);
    const normal = normalize3(cross3(subtract3(triangle.b, triangle.a), subtract3(triangle.c, triangle.a))); const direction = normalize3(cross3(normal, tangent)); if (!direction.some(Math.abs)) throw new Error(`Curve control point ${index} has an undefined surface-offset direction.`); return add3(point, scale3(direction, distanceMm));
  });
  if (curve.kind === 'surface-projected') points = projectPoints(points, artifact);
  return resampleForKind(curve, points);
}

export function extendCurve(curve: SurfaceCurve, startMm: number, endMm = startMm): SurfaceCurve {
  if (![startMm, endMm].every((value) => Number.isFinite(value) && value >= 0)) throw new Error('Curve extension distances must be finite, non-negative millimeter values.');
  const points = clonePoints(curve.controlPoints);
  if (curve.closed) throw new Error('A closed curve cannot be extended.');
  const startDirection = normalize3(subtract3(points[0], points[1]));
  const endDirection = normalize3(subtract3(points.at(-1)!, points.at(-2)!));
  points[0] = add3(points[0], scale3(startDirection, startMm));
  points[points.length - 1] = add3(points.at(-1)!, scale3(endDirection, endMm));
  return resampleForKind(curve, points);
}

export function trimCurve(curve: SurfaceCurve, startDistanceMm: number, endDistanceMm: number): SurfaceCurve {
  const total = curveLength(curve.controlPoints, curve.closed);
  if (![startDistanceMm, endDistanceMm].every(Number.isFinite) || startDistanceMm < 0 || endDistanceMm <= startDistanceMm || endDistanceMm > total) throw new Error(`Curve trim range must lie between 0 and ${total.toFixed(3)} mm.`);
  const path = curve.closed ? [...clonePoints(curve.controlPoints), [...curve.controlPoints[0]] as Vec3] : clonePoints(curve.controlPoints); const points: Vec3[] = [pointAtDistance(path, startDistanceMm)]; let traveled = 0;
  for (let index = 1; index < path.length - 1; index += 1) { traveled += distance3(path[index - 1], path[index]); if (traveled > startDistanceMm + 1e-9 && traveled < endDistanceMm - 1e-9) points.push([...path[index]]); }
  points.push(pointAtDistance(path, endDistanceMm));
  validatePoints(points, 2);
  return { ...resampleForKind(curve, points), closed: false };
}

export function splitCurve(curve: SurfaceCurve, controlPointIndex: number): [SurfaceCurve, SurfaceCurve] {
  if (curve.closed) throw new Error('Open a closed curve before splitting it.');
  if (controlPointIndex <= 0 || controlPointIndex >= curve.controlPoints.length - 1) throw new Error('Curve split point must be an interior control point.');
  const first = { ...resampleForKind(curve, curve.controlPoints.slice(0, controlPointIndex + 1)), id: crypto.randomUUID(), name: `${curve.name} A`, createdAt: new Date().toISOString() };
  const second = { ...resampleForKind(curve, curve.controlPoints.slice(controlPointIndex)), id: crypto.randomUUID(), name: `${curve.name} B`, createdAt: new Date().toISOString() };
  return [first, second];
}

export function joinCurves(first: SurfaceCurve, second: SurfaceCurve, toleranceMm = 0.1): SurfaceCurve {
  if (first.closed || second.closed) throw new Error('Only open curves can be joined.');
  if (first.objectId !== second.objectId || first.artifactId !== second.artifactId) throw new Error('Curves must share the same geometry association before joining.');
  const candidates: Array<{ distance: number; points: Vec3[] }> = [
    { distance: distance3(first.controlPoints.at(-1)!, second.controlPoints[0]), points: [...first.controlPoints, ...second.controlPoints.slice(1)] },
    { distance: distance3(first.controlPoints.at(-1)!, second.controlPoints.at(-1)!), points: [...first.controlPoints, ...[...second.controlPoints].reverse().slice(1)] },
    { distance: distance3(first.controlPoints[0], second.controlPoints[0]), points: [...[...first.controlPoints].reverse(), ...second.controlPoints.slice(1)] },
    { distance: distance3(first.controlPoints[0], second.controlPoints.at(-1)!), points: [...second.controlPoints, ...first.controlPoints.slice(1)] },
  ].sort((a, b) => a.distance - b.distance);
  if (candidates[0].distance > toleranceMm) throw new Error(`Curve endpoints are ${candidates[0].distance.toFixed(3)} mm apart, above the ${toleranceMm} mm join tolerance.`);
  return { ...resampleForKind(first, candidates[0].points), id: crypto.randomUUID(), name: `${first.name} + ${second.name}`, createdAt: new Date().toISOString() };
}

export function reverseCurve(curve: SurfaceCurve): SurfaceCurve {
  return { ...structuredClone(curve), controlPoints: clonePoints(curve.controlPoints).reverse(), sampledPoints: clonePoints(curve.sampledPoints).reverse(), updatedAt: new Date().toISOString() };
}

export function setCurveClosed(curve: SurfaceCurve, closed: boolean): SurfaceCurve {
  if (closed && curve.controlPoints.length < 3) throw new Error('A closed curve requires at least three control points.');
  return { ...resampleForKind({ ...curve, closed }, curve.controlPoints), closed, updatedAt: new Date().toISOString() };
}

export function projectCurveToMesh(curve: SurfaceCurve, artifact: ArtifactRecord, object: SceneObject, sourceObject?: SceneObject): SurfaceCurve {
  const worldPoints = sourceObject ? curve.controlPoints.map((point) => transformPoint(point, sourceObject)) : clonePoints(curve.controlPoints);
  const targetLocalPoints = worldPoints.map((point) => inverseTransformPoint(point, object));
  const controlPoints = projectPoints(targetLocalPoints, artifact);
  return { ...resampleForKind(curve, controlPoints), kind: 'surface-projected', objectId: object.id, artifactId: artifact.id, updatedAt: new Date().toISOString() };
}

export function renameCurve(curve: SurfaceCurve, name: string): SurfaceCurve { return { ...structuredClone(curve), name: requiredName(name), updatedAt: new Date().toISOString() }; }

export function curveLength(points: Vec3[], closed = false): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance3(points[index - 1], points[index]);
  if (closed && points.length > 2) length += distance3(points.at(-1)!, points[0]);
  return length;
}

function projectPoints(points: Vec3[], artifact: ArtifactRecord): Vec3[] {
  validatePoints(points, 1);
  const triangles = meshTriangles(artifact);
  if (!triangles.length) throw new Error('Surface projection requires triangle geometry.');
  return points.map((point) => {
    const closest = closestPointOnMesh(point, triangles);
    if (!closest) throw new Error('A curve control point could not be projected to the source mesh.');
    return closest.point;
  });
}

function resampleForKind(curve: SurfaceCurve, points: Vec3[]): SurfaceCurve {
  validatePoints(points, curve.kind === 'spline' ? 3 : 2);
  return { ...structuredClone(curve), controlPoints: clonePoints(points), sampledPoints: curve.kind === 'spline' ? catmullRom(points, 12, curve.closed) : clonePoints(points), updatedAt: new Date().toISOString() };
}

function catmullRom(points: Vec3[], segmentsPerSpan: number, closed = false): Vec3[] {
  const result: Vec3[] = [];
  const count = points.length;
  const spans = closed ? count : count - 1;
  for (let span = 0; span < spans; span += 1) {
    const p0 = points[(span - 1 + count) % count] ?? points[0];
    const p1 = points[span % count]; const p2 = points[(span + 1) % count];
    const p3 = points[(span + 2) % count] ?? points.at(-1)!;
    for (let segment = 0; segment < segmentsPerSpan; segment += 1) {
      const t = segment / segmentsPerSpan; const t2 = t * t; const t3 = t2 * t;
      result.push([0, 1, 2].map((axis) => 0.5 * ((2 * p1[axis]) + (-p0[axis] + p2[axis]) * t + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3)) as Vec3);
    }
  }
  result.push(closed ? [...result[0]] : [...points.at(-1)!]);
  return result;
}

function sampleByDistance(points: Vec3[], spacing: number, closed: boolean): Vec3[] {
  const source = closed ? [...clonePoints(points), [...points[0]] as Vec3] : clonePoints(points);
  const result: Vec3[] = [[...source[0]]];
  let remaining = spacing;
  for (let index = 1; index < source.length; index += 1) {
    let start = source[index - 1]; const end = source[index]; let segment = distance3(start, end);
    while (segment >= remaining && segment > 0) {
      const ratio = remaining / segment;
      start = add3(start, scale3(subtract3(end, start), ratio)); result.push(start); segment = distance3(start, end); remaining = spacing;
    }
    remaining -= segment;
  }
  if (closed && result.length > 1 && distance3(result[0], result.at(-1)!) <= 1e-9) result.pop();
  if (!closed && distance3(result.at(-1)!, source.at(-1)!) > 1e-9) result.push(source.at(-1)!);
  return result;
}

function pointAtDistance(path: Vec3[], distance: number): Vec3 {
  let traveled = 0;
  for (let index = 1; index < path.length; index += 1) { const length = distance3(path[index - 1], path[index]); if (traveled + length >= distance - 1e-12) return length ? add3(path[index - 1], scale3(subtract3(path[index], path[index - 1]), Math.max(0, Math.min(1, (distance - traveled) / length)))) : [...path[index]]; traveled += length; }
  return [...path.at(-1)!];
}

function ramerDouglasPeucker(points: Vec3[], tolerance: number): Vec3[] {
  if (points.length <= 2) return clonePoints(points);
  let maximum = 0; let index = 0;
  for (let item = 1; item < points.length - 1; item += 1) {
    const distance = pointLineDistance(points[item], points[0], points.at(-1)!);
    if (distance > maximum) { maximum = distance; index = item; }
  }
  if (maximum <= tolerance) return [[...points[0]], [...points.at(-1)!]];
  return [...ramerDouglasPeucker(points.slice(0, index + 1), tolerance).slice(0, -1), ...ramerDouglasPeucker(points.slice(index), tolerance)];
}

function pointLineDistance(point: Vec3, start: Vec3, end: Vec3): number {
  const line = subtract3(end, start); const denominator = Math.max(1e-12, line[0] ** 2 + line[1] ** 2 + line[2] ** 2);
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * line[0] + (point[1] - start[1]) * line[1] + (point[2] - start[2]) * line[2]) / denominator));
  return distance3(point, add3(start, scale3(line, t)));
}

function requiredName(name: string): string { const value = name.trim(); if (!value) throw new Error('Curve name is required.'); return value; }
function clonePoints(points: Vec3[]): Vec3[] { return points.map((point) => [...point]); }
function validatePoints(points: Vec3[], minimum: number): void {
  if (points.length < minimum) throw new Error(`Curve operation requires at least ${minimum} model-space point${minimum === 1 ? '' : 's'}.`);
  if (points.some((point) => !point.every(Number.isFinite))) throw new Error('Curve points must contain finite model-space coordinates.');
}
