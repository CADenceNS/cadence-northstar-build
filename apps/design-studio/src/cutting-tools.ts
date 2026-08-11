import type { Vec3 } from './core';
import { add3, boundsOfPoints, closestPointOnTriangle, cross3, distance3, dot3, normalize3, scale3, subtract3 } from './geometry';
import { buildTopology, compactMesh, faceArea, mergeIndexed, quantizedKey, triangulatePolygon, validateGeometryResult, type Face, type IndexedMesh } from './editing-geometry';
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

export function trimByClosedCurve(source: IndexedMesh, curvePoints: Vec3[], keepInside: boolean, curveClosed: boolean, toleranceMm = 1e-5): IndexedMesh {
  if (!curveClosed) throw new Error('Closed-curve trim rejects open curves. Close the model-space curve before trimming.');
  validateCurve(curvePoints, true);
  if (!(toleranceMm > 0) || !Number.isFinite(toleranceMm)) throw new Error('Closed-curve trim tolerance must be a finite value greater than zero.');
  const requestedCurve = deduplicateCurveClosure(curvePoints, toleranceMm);
  if (requestedCurve.length < 3) throw new Error('Closed-curve trim requires at least three distinct model-space points.');
  const curve = projectCurveToSource(source, requestedCurve, toleranceMm);
  const normal = polygonNormal(curve); if (!normal.some(Math.abs)) throw new Error('Closed trim curve is planar-degenerate.');
  const axes = planeAxes(normal); const origin = average(curve);
  const polygon = curve.map((point) => project2(point, origin, axes));
  validateSimplePolygon(polygon, toleranceMm);
  const segments = polygon.map((start, index) => ({ start, end: polygon[(index + 1) % polygon.length] }));
  const retained: RetainedTrimCell[] = [];
  let retainedArea = 0, removedArea = 0;
  for (const face of source.faces) {
    const triangle = face.map((id, index) => ({ point: source.positions[id], projected: project2(source.positions[id], origin, axes), barycentric: [Number(index === 0), Number(index === 1), Number(index === 2)] as Vec3 })) as [TrimVertex, TrimVertex, TrimVertex];
    let cells: TrimVertex[][] = [triangle];
    for (const segment of segments.filter(({ start, end }) => segmentTouchesPolygon(start, end, triangle.map(({ projected }) => projected), toleranceMm))) {
      cells = cells.flatMap((cell) => splitTrimCell(cell, segment.start, segment.end, toleranceMm));
    }
    for (const cell of cells) {
      const area = Math.abs(polygonArea2(cell.map(({ projected }) => projected)));
      if (area <= toleranceMm * toleranceMm) continue;
      const centroid = { x: cell.reduce((sum, vertex) => sum + vertex.projected.x, 0) / cell.length, y: cell.reduce((sum, vertex) => sum + vertex.projected.y, 0) / cell.length };
      const inside = pointInPolygon(centroid, polygon);
      if (inside === keepInside) { retained.push({ vertices: cell, sourceFace: face }); retainedArea += area; } else removedArea += area;
    }
  }
  if (!retained.length || retainedArea <= toleranceMm * toleranceMm || removedArea <= toleranceMm * toleranceMm) throw new Error('Closed-curve trim must retain and remove non-zero mesh surface regions.');
  const candidate = trimPolygonsToMesh(conformTrimCells(source, retained, toleranceMm), toleranceMm);
  const seen = new Set<string>();
  const faces = candidate.faces.filter((face) => {
    if (new Set(face).size < 3 || faceArea(candidate, face) <= toleranceMm * toleranceMm) return false;
    const key = [...face].sort((a, b) => a - b).join(':'); if (seen.has(key)) return false; seen.add(key); return true;
  });
  const result = compactMesh({ positions: candidate.positions, faces }).mesh;
  validateGeometryResult(result, { allowBoundaries: true, allowDisconnected: buildTopology(source).shells.length > 1 });
  return result;
}

interface Point2 { x: number; y: number; }
interface TrimVertex { point: Vec3; projected: Point2; barycentric: Vec3; }
interface RetainedTrimCell { vertices: TrimVertex[]; sourceFace: Face; }

function deduplicateCurveClosure(points: Vec3[], tolerance: number): Vec3[] {
  const values: Vec3[] = [];
  for (const point of points) if (!values.length || distance3(values.at(-1)!, point) > tolerance) values.push([...point]);
  if (values.length > 1 && distance3(values[0], values.at(-1)!) <= tolerance) values.pop();
  return values;
}

function projectCurveToSource(source: IndexedMesh, curve: Vec3[], tolerance: number): Vec3[] {
  if (!source.faces.length) throw new Error('Closed-curve trim requires triangle geometry.');
  const bounds = boundsOfPoints(source.positions); const diagonal = bounds ? distance3(bounds.min, bounds.max) : 0;
  const projectionTolerance = Math.max(tolerance, diagonal * 1e-7);
  const projectedCurve: Vec3[] = [];
  for (let pointId = 0; pointId < curve.length; pointId += 1) {
    let closest = Infinity; let closestPoint: Vec3 | null = null;
    for (let faceId = 0; faceId < source.faces.length; faceId += 1) {
      const [a, b, c] = source.faces[faceId];
      const projected = closestPointOnTriangle(curve[pointId], { id: faceId, a: source.positions[a], b: source.positions[b], c: source.positions[c] });
      const distance = distance3(curve[pointId], projected);
      if (distance < closest) { closest = distance; closestPoint = projected; }
      if (closest <= projectionTolerance) break;
    }
    if (closest > projectionTolerance) throw new Error(`Closed trim curve point ${pointId} is ${closest.toFixed(6)} mm from the source surface, above the ${projectionTolerance.toFixed(6)} mm projection tolerance.`);
    projectedCurve.push(closestPoint!);
  }
  return projectedCurve;
}

function validateSimplePolygon(polygon: Point2[], tolerance: number): void {
  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length;
    if (distance2(polygon[index], polygon[next]) <= tolerance) throw new Error(`Closed trim curve segment ${index} has zero projected length.`);
    for (let other = index + 1; other < polygon.length; other += 1) {
      const otherNext = (other + 1) % polygon.length;
      if (index === other || next === other || otherNext === index) continue;
      if (segmentsIntersect2(polygon[index], polygon[next], polygon[other], polygon[otherNext], tolerance)) throw new Error(`Closed trim curve self-intersects between segments ${index} and ${other}.`);
    }
  }
  if (Math.abs(polygonArea2(polygon)) <= tolerance * tolerance) throw new Error('Closed trim curve has zero projected area.');
}

function splitTrimCell(cell: TrimVertex[], lineStart: Point2, lineEnd: Point2, tolerance: number): TrimVertex[][] {
  const distances = cell.map(({ projected }) => crossPoint2(lineStart, lineEnd, projected));
  if (distances.every((value) => value >= -tolerance) || distances.every((value) => value <= tolerance)) return [cell];
  return [clipTrimHalfPlane(cell, lineStart, lineEnd, true, tolerance), clipTrimHalfPlane(cell, lineStart, lineEnd, false, tolerance)]
    .filter((value) => value.length >= 3 && Math.abs(polygonArea2(value.map(({ projected }) => projected))) > tolerance * tolerance);
}

function clipTrimHalfPlane(cell: TrimVertex[], lineStart: Point2, lineEnd: Point2, positive: boolean, tolerance: number): TrimVertex[] {
  const output: TrimVertex[] = [];
  for (let index = 0; index < cell.length; index += 1) {
    const current = cell[index], next = cell[(index + 1) % cell.length];
    const currentDistance = crossPoint2(lineStart, lineEnd, current.projected), nextDistance = crossPoint2(lineStart, lineEnd, next.projected);
    const currentInside = positive ? currentDistance >= -tolerance : currentDistance <= tolerance;
    const nextInside = positive ? nextDistance >= -tolerance : nextDistance <= tolerance;
    if (currentInside) output.push(current);
    if (currentInside !== nextInside) {
      const amount = currentDistance / (currentDistance - nextDistance);
      output.push({ point: add3(current.point, scale3(subtract3(next.point, current.point), amount)), projected: { x: current.projected.x + (next.projected.x - current.projected.x) * amount, y: current.projected.y + (next.projected.y - current.projected.y) * amount }, barycentric: add3(current.barycentric, scale3(subtract3(next.barycentric, current.barycentric), amount)) });
    }
  }
  return deduplicateTrimRing(output, tolerance);
}

function deduplicateTrimRing(points: TrimVertex[], tolerance: number): TrimVertex[] {
  const output: TrimVertex[] = [];
  for (const point of points) if (!output.length || distance2(output.at(-1)!.projected, point.projected) > tolerance) output.push(point);
  if (output.length > 1 && distance2(output[0].projected, output.at(-1)!.projected) <= tolerance) output.pop();
  return output;
}

function conformTrimCells(source: IndexedMesh, cells: RetainedTrimCell[], tolerance: number): Vec3[][] {
  const splitPoints = new Map<string, Array<{ amount: number; point: Vec3 }>>();
  for (const cell of cells) for (const vertex of cell.vertices) for (const edge of sourceEdgesAtVertex(source, cell.sourceFace, vertex, tolerance)) {
    const values = splitPoints.get(edge.key) ?? [];
    if (!values.some(({ amount }) => Math.abs(amount - edge.amount) <= tolerance)) values.push({ amount: edge.amount, point: vertex.point });
    splitPoints.set(edge.key, values);
  }
  for (const values of splitPoints.values()) values.sort((first, second) => first.amount - second.amount);
  return cells.map((cell) => {
    const points: Vec3[] = [];
    for (let index = 0; index < cell.vertices.length; index += 1) {
      const current = cell.vertices[index], next = cell.vertices[(index + 1) % cell.vertices.length];
      points.push(current.point);
      const currentEdges = new Map(sourceEdgesAtVertex(source, cell.sourceFace, current, tolerance).map((edge) => [edge.key, edge]));
      const common = sourceEdgesAtVertex(source, cell.sourceFace, next, tolerance).find((edge) => currentEdges.has(edge.key));
      if (!common) continue;
      const start = currentEdges.get(common.key)!;
      const low = Math.min(start.amount, common.amount), high = Math.max(start.amount, common.amount);
      const interior = (splitPoints.get(common.key) ?? []).filter(({ amount }) => amount > low + tolerance && amount < high - tolerance);
      if (common.amount < start.amount) interior.reverse();
      points.push(...interior.map(({ point }) => point));
    }
    return deduplicateRing(points, tolerance);
  }).filter((points) => points.length >= 3);
}

function trimPolygonsToMesh(polygons: Vec3[][], tolerance: number): IndexedMesh {
  const positions: Vec3[] = []; const faces: Face[] = [];
  for (const polygon of polygons) {
    const offset = positions.length;
    const center = average(polygon);
    positions.push(...polygon.map((point) => [...point] as Vec3), center);
    const centerId = offset + polygon.length;
    for (let index = 0; index < polygon.length; index += 1) faces.push([offset + index, offset + (index + 1) % polygon.length, centerId]);
  }
  return weldVertices({ positions, faces }, tolerance);
}

function sourceEdgesAtVertex(source: IndexedMesh, face: Face, vertex: TrimVertex, tolerance: number): Array<{ key: string; amount: number }> {
  const values: Array<{ key: string; amount: number }> = [];
  for (let omitted = 0; omitted < 3; omitted += 1) {
    if (Math.abs(vertex.barycentric[omitted]) > tolerance * 10) continue;
    const ids = [face[(omitted + 1) % 3], face[(omitted + 2) % 3]].sort((a, b) => a - b);
    const start = source.positions[ids[0]], end = source.positions[ids[1]], direction = subtract3(end, start), denominator = dot3(direction, direction);
    const amount = denominator ? dot3(subtract3(vertex.point, start), direction) / denominator : 0;
    values.push({ key: `${ids[0]}:${ids[1]}`, amount: Math.max(0, Math.min(1, amount)) });
  }
  return values;
}

function segmentTouchesPolygon(start: Point2, end: Point2, polygon: Point2[], tolerance: number): boolean {
  if (pointInTriangle2(start, polygon, tolerance) || pointInTriangle2(end, polygon, tolerance)) return true;
  for (let index = 0; index < polygon.length; index += 1) if (segmentsIntersect2(start, end, polygon[index], polygon[(index + 1) % polygon.length], tolerance)) return true;
  return false;
}

function pointInTriangle2(point: Point2, triangle: Point2[], tolerance: number): boolean {
  const values = triangle.map((start, index) => crossPoint2(start, triangle[(index + 1) % triangle.length], point));
  return !(values.some((value) => value < -tolerance) && values.some((value) => value > tolerance));
}

function segmentsIntersect2(a: Point2, b: Point2, c: Point2, d: Point2, tolerance: number): boolean {
  const values = [crossPoint2(a, b, c), crossPoint2(a, b, d), crossPoint2(c, d, a), crossPoint2(c, d, b)];
  if (values[0] * values[1] < -tolerance * tolerance && values[2] * values[3] < -tolerance * tolerance) return true;
  return Math.abs(values[0]) <= tolerance && pointOnSegment2(c, a, b, tolerance)
    || Math.abs(values[1]) <= tolerance && pointOnSegment2(d, a, b, tolerance)
    || Math.abs(values[2]) <= tolerance && pointOnSegment2(a, c, d, tolerance)
    || Math.abs(values[3]) <= tolerance && pointOnSegment2(b, c, d, tolerance);
}

function pointOnSegment2(point: Point2, start: Point2, end: Point2, tolerance: number): boolean {
  return point.x >= Math.min(start.x, end.x) - tolerance && point.x <= Math.max(start.x, end.x) + tolerance && point.y >= Math.min(start.y, end.y) - tolerance && point.y <= Math.max(start.y, end.y) + tolerance;
}

function crossPoint2(a: Point2, b: Point2, c: Point2): number { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function polygonArea2(points: Point2[]): number { return points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y; }, 0) * 0.5; }
function distance2(a: Point2, b: Point2): number { return Math.hypot(a.x - b.x, a.y - b.y); }

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
  if (normal.some(Math.abs)) return normalize3(normal);
  for (let first = 0; first < points.length - 2; first += 1) for (let second = first + 1; second < points.length - 1; second += 1) for (let third = second + 1; third < points.length; third += 1) {
    const fallback = cross3(subtract3(points[second], points[first]), subtract3(points[third], points[first]));
    if (fallback.some(Math.abs)) return normalize3(fallback);
  }
  return [0, 0, 0];
}

function planeAxes(normal: Vec3): [Vec3, Vec3] { const tangent = normalize3(Math.abs(normal[0]) < 0.9 ? cross3(normal, [1, 0, 0]) : cross3(normal, [0, 1, 0])); return [tangent, normalize3(cross3(normal, tangent))]; }
function project2(point: Vec3, origin: Vec3, axes: [Vec3, Vec3]) { const relative = subtract3(point, origin); return { x: dot3(relative, axes[0]), y: dot3(relative, axes[1]) }; }
function pointInPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>): boolean { let inside = false; for (let first = 0, second = polygon.length - 1; first < polygon.length; second = first++) { const a = polygon[first], b = polygon[second]; if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x) inside = !inside; } return inside; }
function average(points: Vec3[]): Vec3 { return scale3(points.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / points.length); }
