import type { Vec3 } from './core';
import { add3, cross3, dot3, normalize3, scale3, subtract3 } from './geometry';
import { compactMesh, faceCentroid, mergeIndexed, quantizedKey, triangulatePolygon, type Face, type IndexedMesh } from './editing-geometry';
import { weldVertices } from './mesh-edit-tools';

export interface CuttingPlane { origin: Vec3; normal: Vec3; }
export interface PlaneCutOptions { keep: 'positive' | 'negative' | 'both'; cap: boolean; toleranceMm?: number; }
export interface CutResult { primary: IndexedMesh; secondary?: IndexedMesh; intersectionLoops: Vec3[][]; }

export function planeCut(source: IndexedMesh, plane: CuttingPlane, options: PlaneCutOptions): CutResult {
  if (!plane.origin.every(Number.isFinite) || !plane.normal.every(Number.isFinite)) throw new Error('Cut plane requires finite model-space coordinates.');
  const normal = normalize3(plane.normal); if (!normal.some(Math.abs)) throw new Error('Cut plane normal must be non-zero.');
  const tolerance = options.toleranceMm ?? 1e-7;
  if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new Error('Cut tolerance must be a finite value greater than zero.');
  const positivePolygons: Vec3[][] = []; const negativePolygons: Vec3[][] = []; const segments: Array<[Vec3, Vec3]> = [];
  for (const face of source.faces) {
    const triangle = face.map((id) => source.positions[id]) as [Vec3, Vec3, Vec3];
    const distances = triangle.map((point) => dot3(subtract3(point, plane.origin), normal));
    const positive = clipPolygon(triangle, distances, true, tolerance);
    const negative = clipPolygon(triangle, distances, false, tolerance);
    if (positive.length >= 3) positivePolygons.push(positive);
    if (negative.length >= 3) negativePolygons.push(negative);
    const intersections = triangleIntersections(triangle, distances, tolerance);
    if (intersections.length === 2 && Math.hypot(...subtract3(intersections[0], intersections[1])) > tolerance) segments.push([intersections[0], intersections[1]]);
  }
  const loops = connectSegments(segments, tolerance * 10);
  let positive = polygonsToMesh(positivePolygons, tolerance);
  let negative = polygonsToMesh(negativePolygons, tolerance);
  if (options.cap) {
    positive = capLoops(positive, loops, normal, false, tolerance);
    negative = capLoops(negative, loops, normal, true, tolerance);
  }
  if (!positive.faces.length || !negative.faces.length) throw new Error('Cut plane does not split the selected mesh into two non-empty sides.');
  if (options.keep === 'positive') return { primary: positive, intersectionLoops: loops };
  if (options.keep === 'negative') return { primary: negative, intersectionLoops: loops };
  return { primary: positive, secondary: negative, intersectionLoops: loops };
}

export function splitMesh(source: IndexedMesh, plane: CuttingPlane, cap = false): CutResult { return planeCut(source, plane, { keep: 'both', cap }); }

export function curveBasedCut(source: IndexedMesh, curvePoints: Vec3[], extrusionDirection: Vec3, keep: PlaneCutOptions['keep'] = 'both', cap = false): CutResult {
  validateCurve(curvePoints, false);
  const extrusion = normalize3(extrusionDirection); if (!extrusion.some(Math.abs)) throw new Error('Curve cut requires a non-zero extrusion direction.');
  const frames = curvePoints.slice(0, -1).map((start, index) => {
    const segment = subtract3(curvePoints[index + 1], start); const length = Math.hypot(...segment); if (length <= 1e-9) throw new Error(`Curve cut segment ${index} has zero length.`);
    const tangent = scale3(segment, 1 / length); const across = normalize3(subtract3(extrusion, scale3(tangent, dot3(extrusion, tangent))));
    const normal = normalize3(cross3(tangent, across)); if (!normal.some(Math.abs)) throw new Error(`Curve cut segment ${index} is parallel to the extrusion direction.`);
    return { start, tangent, across, normal, length };
  });
  const signedDistance = (point: Vec3) => {
    let closest = { score: Infinity, distance: 0 };
    for (const frame of frames) {
      const relative = subtract3(point, frame.start); const along = Math.max(0, Math.min(frame.length, dot3(relative, frame.tangent))); const extruded = dot3(relative, frame.across);
      const projection = add3(frame.start, add3(scale3(frame.tangent, along), scale3(frame.across, extruded))); const score = Math.hypot(...subtract3(point, projection));
      if (score < closest.score) closest = { score, distance: dot3(relative, frame.normal) };
    }
    return closest.distance;
  };
  const capNormal = normalize3(frames.reduce<Vec3>((sum, frame) => add3(sum, frame.normal), [0, 0, 0]));
  return implicitCut(source, signedDistance, capNormal.some(Math.abs) ? capNormal : frames[0].normal, { keep, cap, toleranceMm: 1e-7 });
}

export function trimByClosedCurve(source: IndexedMesh, curvePoints: Vec3[], keepInside = true): IndexedMesh {
  validateCurve(curvePoints, true);
  const normal = polygonNormal(curvePoints); if (!normal.some(Math.abs)) throw new Error('Closed trim curve is planar-degenerate.');
  const axes = planeAxes(normal); const origin = average(curvePoints);
  const polygon = curvePoints.map((point) => project2(point, origin, axes));
  const faces = source.faces.filter((face) => pointInPolygon(project2(faceCentroid(source, face), origin, axes), polygon) === keepInside);
  if (!faces.length || faces.length === source.faces.length) throw new Error('Closed-curve trim must retain and remove actual mesh faces.');
  return compactMesh({ positions: source.positions, faces }).mesh;
}

function clipPolygon(points: Vec3[], distances: number[], positive: boolean, tolerance: number): Vec3[] {
  const output: Vec3[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index], next = points[(index + 1) % points.length]; const currentDistance = distances[index], nextDistance = distances[(index + 1) % points.length];
    const currentInside = positive ? currentDistance >= -tolerance : currentDistance <= tolerance;
    const nextInside = positive ? nextDistance >= -tolerance : nextDistance <= tolerance;
    if (currentInside) output.push([...current]);
    if (currentInside !== nextInside) {
      const amount = currentDistance / (currentDistance - nextDistance);
      output.push(add3(current, scale3(subtract3(next, current), amount)));
    }
  }
  return deduplicateRing(output, tolerance);
}

function implicitCut(source: IndexedMesh, field: (point: Vec3) => number, capNormal: Vec3, options: PlaneCutOptions): CutResult {
  const tolerance = options.toleranceMm ?? 1e-7; const positivePolygons: Vec3[][] = []; const negativePolygons: Vec3[][] = []; const segments: Array<[Vec3, Vec3]> = [];
  for (const face of source.faces) {
    const triangle = face.map((id) => source.positions[id]) as [Vec3, Vec3, Vec3]; const distances = triangle.map(field);
    const positive = clipImplicitPolygon(triangle, distances, field, true, tolerance); const negative = clipImplicitPolygon(triangle, distances, field, false, tolerance);
    if (positive.length >= 3) positivePolygons.push(positive); if (negative.length >= 3) negativePolygons.push(negative);
    const intersections = implicitTriangleIntersections(triangle, distances, field, tolerance); if (intersections.length === 2 && Math.hypot(...subtract3(intersections[0], intersections[1])) > tolerance) segments.push([intersections[0], intersections[1]]);
  }
  const loops = connectSegments(segments, tolerance * 10); let positive = polygonsToMesh(positivePolygons, tolerance); let negative = polygonsToMesh(negativePolygons, tolerance);
  if (options.cap) { positive = capLoops(positive, loops, capNormal, false, tolerance); negative = capLoops(negative, loops, capNormal, true, tolerance); }
  if (!positive.faces.length || !negative.faces.length) throw new Error('Curve cutting surface does not split the selected mesh into two non-empty sides.');
  if (options.keep === 'positive') return { primary: positive, intersectionLoops: loops }; if (options.keep === 'negative') return { primary: negative, intersectionLoops: loops }; return { primary: positive, secondary: negative, intersectionLoops: loops };
}

function clipImplicitPolygon(points: Vec3[], distances: number[], field: (point: Vec3) => number, positive: boolean, tolerance: number): Vec3[] {
  const output: Vec3[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index], next = points[(index + 1) % points.length]; const currentDistance = distances[index], nextDistance = distances[(index + 1) % points.length];
    const currentInside = positive ? currentDistance >= -tolerance : currentDistance <= tolerance; const nextInside = positive ? nextDistance >= -tolerance : nextDistance <= tolerance;
    if (currentInside) output.push([...current]); if (currentInside !== nextInside) output.push(implicitRoot(current, next, currentDistance, nextDistance, field, tolerance));
  }
  return deduplicateRing(output, tolerance);
}

function implicitTriangleIntersections(points: [Vec3, Vec3, Vec3], distances: number[], field: (point: Vec3) => number, tolerance: number): Vec3[] {
  const values: Vec3[] = [];
  for (let index = 0; index < 3; index += 1) {
    const next = (index + 1) % 3; const first = distances[index], second = distances[next]; if (Math.abs(first) <= tolerance) values.push([...points[index]]);
    if (first < -tolerance && second > tolerance || first > tolerance && second < -tolerance) values.push(implicitRoot(points[index], points[next], first, second, field, tolerance));
  }
  return deduplicateRing(values, tolerance);
}

function implicitRoot(start: Vec3, end: Vec3, startValue: number, endValue: number, field: (point: Vec3) => number, tolerance: number): Vec3 {
  let low = [...start] as Vec3, high = [...end] as Vec3, lowValue = startValue, highValue = endValue;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = scale3(add3(low, high), 0.5); const value = field(middle); if (Math.abs(value) <= tolerance) return middle;
    if (Math.sign(value) === Math.sign(lowValue)) { low = middle; lowValue = value; } else { high = middle; highValue = value; }
  }
  return Math.abs(lowValue) <= Math.abs(highValue) ? low : high;
}

function triangleIntersections(points: [Vec3, Vec3, Vec3], distances: number[], tolerance: number): Vec3[] {
  const values: Vec3[] = [];
  for (let index = 0; index < 3; index += 1) {
    const next = (index + 1) % 3; const first = distances[index], second = distances[next];
    if (Math.abs(first) <= tolerance) values.push([...points[index]]);
    if ((first < -tolerance && second > tolerance) || (first > tolerance && second < -tolerance)) values.push(add3(points[index], scale3(subtract3(points[next], points[index]), first / (first - second))));
  }
  return deduplicateRing(values, tolerance);
}

function polygonsToMesh(polygons: Vec3[][], tolerance: number): IndexedMesh {
  const positions: Vec3[] = []; const faces: Face[] = [];
  for (const polygon of polygons) {
    const offset = positions.length; positions.push(...polygon.map((point) => [...point] as Vec3));
    for (let index = 1; index + 1 < polygon.length; index += 1) faces.push([offset, offset + index, offset + index + 1]);
  }
  return weldVertices({ positions, faces }, tolerance);
}

function capLoops(source: IndexedMesh, loops: Vec3[][], normal: Vec3, reverse: boolean, tolerance: number): IndexedMesh {
  const capMeshes: IndexedMesh[] = [];
  for (const loop of loops.filter((value) => value.length >= 3)) {
    const points = loop.map((point) => [...point] as Vec3); let faces = triangulatePolygon(points); const candidate = faces[0]; const candidateNormal = normalize3(cross3(subtract3(points[candidate[1]], points[candidate[0]]), subtract3(points[candidate[2]], points[candidate[0]]))); const wantsPositive = reverse;
    if ((dot3(candidateNormal, normal) > 0) !== wantsPositive) faces = faces.map(([a, b, c]) => [a, c, b]);
    capMeshes.push({ positions: points, faces });
  }
  return weldVertices(mergeIndexed([source, ...capMeshes]), tolerance);
}

function connectSegments(segments: Array<[Vec3, Vec3]>, tolerance: number): Vec3[][] {
  const nodes = new Map<string, Vec3>(); const adjacency = new Map<string, Set<string>>();
  for (const [a, b] of segments) {
    const ka = quantizedKey(a, tolerance), kb = quantizedKey(b, tolerance); if (ka === kb) continue;
    nodes.set(ka, a); nodes.set(kb, b); (adjacency.get(ka) ?? adjacency.set(ka, new Set()).get(ka)!).add(kb); (adjacency.get(kb) ?? adjacency.set(kb, new Set()).get(kb)!).add(ka);
  }
  const unused = new Set<string>(); for (const [a, values] of adjacency) for (const b of values) unused.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  const loops: Vec3[][] = [];
  while (unused.size) {
    const first = [...unused].sort()[0]; const [start, next] = first.split('|'); const keys = [start]; let previous = start; let current = next; unused.delete(first);
    while (current !== start && keys.length <= adjacency.size + 1) {
      keys.push(current); const candidates = [...(adjacency.get(current) ?? [])].filter((candidate) => candidate !== previous && unused.has(current < candidate ? `${current}|${candidate}` : `${candidate}|${current}`)).sort();
      if (!candidates.length) break; const candidate = candidates[0]; unused.delete(current < candidate ? `${current}|${candidate}` : `${candidate}|${current}`); previous = current; current = candidate;
    }
    if (current === start && keys.length >= 3) loops.push(keys.map((key) => nodes.get(key)!));
  }
  return loops;
}

function deduplicateRing(points: Vec3[], tolerance: number): Vec3[] {
  const result: Vec3[] = [];
  for (const point of points) if (!result.some((existing) => Math.hypot(...subtract3(existing, point)) <= tolerance)) result.push(point);
  return result;
}

function validateCurve(points: Vec3[], closed: boolean): void {
  const minimum = closed ? 3 : 2;
  if (points.length < minimum || points.some((point) => !point.every(Number.isFinite))) throw new Error(`${closed ? 'Closed' : 'Open'} curve cut requires at least ${minimum} finite model-space points.`);
}

function polygonNormal(points: Vec3[]): Vec3 {
  const normal: Vec3 = [0, 0, 0];
  for (let index = 0; index < points.length; index += 1) { const current = points[index], next = points[(index + 1) % points.length]; normal[0] += (current[1] - next[1]) * (current[2] + next[2]); normal[1] += (current[2] - next[2]) * (current[0] + next[0]); normal[2] += (current[0] - next[0]) * (current[1] + next[1]); }
  return normalize3(normal);
}

function planeAxes(normal: Vec3): [Vec3, Vec3] { const tangent = normalize3(Math.abs(normal[0]) < 0.9 ? cross3(normal, [1, 0, 0]) : cross3(normal, [0, 1, 0])); return [tangent, normalize3(cross3(normal, tangent))]; }
function project2(point: Vec3, origin: Vec3, axes: [Vec3, Vec3]) { const relative = subtract3(point, origin); return { x: dot3(relative, axes[0]), y: dot3(relative, axes[1]) }; }
function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean { let inside = false; for (let first = 0, second = polygon.length - 1; first < polygon.length; second = first++) { const a = polygon[first], b = polygon[second]; if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x) inside = !inside; } return inside; }
function average(points: Vec3[]): Vec3 { return scale3(points.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / points.length); }
