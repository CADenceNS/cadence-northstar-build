import type { ArtifactRecord, SceneObject, Vec3 } from './core';

export interface Triangle3 {
  id: number;
  a: Vec3;
  b: Vec3;
  c: Vec3;
}

export interface Bounds3 { min: Vec3; max: Vec3; }

export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const subtract3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (value: Vec3, scale: number): Vec3 => [value[0] * scale, value[1] * scale, value[2] * scale];
export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length3 = (value: Vec3): number => Math.hypot(value[0], value[1], value[2]);
export const distance3 = (a: Vec3, b: Vec3): number => length3(subtract3(a, b));
export const normalize3 = (value: Vec3): Vec3 => { const length = length3(value); return length ? scale3(value, 1 / length) : [0, 0, 0]; };

export function transformPoint(point: Vec3, object: SceneObject): Vec3 {
  const scaled: Vec3 = [point[0] * object.transform.scale[0], point[1] * object.transform.scale[1], point[2] * object.transform.scale[2]];
  const [x, y, z, w] = object.transform.rotation;
  const axis: Vec3 = [x, y, z];
  const rotated = add3(add3(scale3(axis, 2 * dot3(axis, scaled)), scale3(scaled, w * w - dot3(axis, axis))), scale3(cross3(axis, scaled), 2 * w));
  return add3(rotated, object.transform.position);
}

export function meshTriangles(artifact: ArtifactRecord, object?: SceneObject): Triangle3[] {
  const topology = artifact.mesh.sourceTopology ?? { positions: artifact.mesh.positions, indices: artifact.mesh.indices };
  const triangles: Triangle3[] = [];
  for (let offset = 0; offset + 2 < topology.indices.length; offset += 3) {
    const a = readPoint(topology.positions, topology.indices[offset]);
    const b = readPoint(topology.positions, topology.indices[offset + 1]);
    const c = readPoint(topology.positions, topology.indices[offset + 2]);
    if (!a || !b || !c) continue;
    triangles.push({
      id: offset / 3,
      a: object ? transformPoint(a, object) : a,
      b: object ? transformPoint(b, object) : b,
      c: object ? transformPoint(c, object) : c,
    });
  }
  return triangles;
}

export function triangleArea(triangle: Triangle3): number {
  return length3(cross3(subtract3(triangle.b, triangle.a), subtract3(triangle.c, triangle.a))) * 0.5;
}

export function boundsOfPoints(points: Vec3[]): Bounds3 | null {
  if (!points.length) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], point[axis]);
    max[axis] = Math.max(max[axis], point[axis]);
  }
  return { min, max };
}

export function boundsOfTriangles(triangles: Triangle3[]): Bounds3 | null {
  return boundsOfPoints(triangles.flatMap((triangle) => [triangle.a, triangle.b, triangle.c]));
}

export function combineBounds(bounds: Bounds3[]): Bounds3 | null {
  if (!bounds.length) return null;
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const bound of bounds) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], bound.min[axis]);
    max[axis] = Math.max(max[axis], bound.max[axis]);
  }
  return { min, max };
}

export function closestPointOnTriangle(point: Vec3, triangle: Triangle3): Vec3 {
  const ab = subtract3(triangle.b, triangle.a);
  const ac = subtract3(triangle.c, triangle.a);
  const ap = subtract3(point, triangle.a);
  const d1 = dot3(ab, ap); const d2 = dot3(ac, ap);
  if (d1 <= 0 && d2 <= 0) return triangle.a;
  const bp = subtract3(point, triangle.b);
  const d3 = dot3(ab, bp); const d4 = dot3(ac, bp);
  if (d3 >= 0 && d4 <= d3) return triangle.b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return add3(triangle.a, scale3(ab, d1 / (d1 - d3)));
  const cp = subtract3(point, triangle.c);
  const d5 = dot3(ab, cp); const d6 = dot3(ac, cp);
  if (d6 >= 0 && d5 <= d6) return triangle.c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return add3(triangle.a, scale3(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    return add3(triangle.b, scale3(subtract3(triangle.c, triangle.b), (d4 - d3) / ((d4 - d3) + (d5 - d6))));
  }
  const denominator = 1 / (va + vb + vc);
  return add3(triangle.a, add3(scale3(ab, vb * denominator), scale3(ac, vc * denominator)));
}

export function closestPointOnMesh(point: Vec3, triangles: Triangle3[]): { point: Vec3; triangleId: number; distance: number } | null {
  let closest: { point: Vec3; triangleId: number; distance: number } | null = null;
  for (const triangle of triangles) {
    const candidate = closestPointOnTriangle(point, triangle);
    const distance = distance3(point, candidate);
    if (!closest || distance < closest.distance) closest = { point: candidate, triangleId: triangle.id, distance };
  }
  return closest;
}

export function intersectRayTriangle(origin: Vec3, direction: Vec3, triangle: Triangle3): number | null {
  const epsilon = 1e-9;
  const edge1 = subtract3(triangle.b, triangle.a);
  const edge2 = subtract3(triangle.c, triangle.a);
  const p = cross3(direction, edge2);
  const determinant = dot3(edge1, p);
  if (Math.abs(determinant) < epsilon) return null;
  const inverse = 1 / determinant;
  const t = subtract3(origin, triangle.a);
  const u = dot3(t, p) * inverse;
  if (u < 0 || u > 1) return null;
  const q = cross3(t, edge1);
  const v = dot3(direction, q) * inverse;
  if (v < 0 || u + v > 1) return null;
  const distance = dot3(edge2, q) * inverse;
  return distance > epsilon ? distance : null;
}

export function minimumDistanceBetweenMeshes(first: Triangle3[], second: Triangle3[]): { distance: number; first: Vec3; second: Vec3; firstTriangle: number; secondTriangle: number } | null {
  if (!first.length || !second.length) return null;
  const firstTree = buildTree(first);
  const secondTree = buildTree(second);
  let best = { distance: Infinity, first: first[0].a, second: second[0].a, firstTriangle: first[0].id, secondTriangle: second[0].id };
  const stack: Array<[TriangleNode, TriangleNode]> = [[firstTree, secondTree]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (boundsDistance(a.bounds, b.bounds) > best.distance) continue;
    if (a.triangles && b.triangles) {
      for (const firstTriangle of a.triangles) for (const secondTriangle of b.triangles) {
        const candidate = triangleDistance(firstTriangle, secondTriangle);
        if (candidate.distance < best.distance) {
          best = { ...candidate, firstTriangle: firstTriangle.id, secondTriangle: secondTriangle.id };
          if (best.distance === 0) return best;
        }
      }
      continue;
    }
    const aChildren = a.children ?? [a];
    const bChildren = b.children ?? [b];
    const pairs = aChildren.flatMap((left) => bChildren.map((right) => [left, right] as [TriangleNode, TriangleNode]));
    pairs.sort((left, right) => boundsDistance(right[0].bounds, right[1].bounds) - boundsDistance(left[0].bounds, left[1].bounds));
    stack.push(...pairs);
  }
  return best;
}

interface TriangleNode { bounds: Bounds3; triangles?: Triangle3[]; children?: [TriangleNode, TriangleNode]; }

function buildTree(triangles: Triangle3[]): TriangleNode {
  const bounds = boundsOfTriangles(triangles)!;
  if (triangles.length <= 16) return { bounds, triangles };
  const extent = subtract3(bounds.max, bounds.min);
  const axis = extent[1] > extent[0] && extent[1] >= extent[2] ? 1 : extent[2] > extent[0] ? 2 : 0;
  const sorted = [...triangles].sort((a, b) => centroid(a)[axis] - centroid(b)[axis]);
  const middle = Math.floor(sorted.length / 2);
  return { bounds, children: [buildTree(sorted.slice(0, middle)), buildTree(sorted.slice(middle))] };
}

function triangleDistance(first: Triangle3, second: Triangle3): { distance: number; first: Vec3; second: Vec3 } {
  const firstEdges: Array<[Vec3, Vec3]> = [[first.a, first.b], [first.b, first.c], [first.c, first.a]];
  const secondEdges: Array<[Vec3, Vec3]> = [[second.a, second.b], [second.b, second.c], [second.c, second.a]];
  for (const edge of firstEdges) {
    const intersection = segmentTriangleIntersection(edge[0], edge[1], second);
    if (intersection) return { distance: 0, first: intersection, second: intersection };
  }
  for (const edge of secondEdges) {
    const intersection = segmentTriangleIntersection(edge[0], edge[1], first);
    if (intersection) return { distance: 0, first: intersection, second: intersection };
  }
  let best = { distance: Infinity, first: first.a, second: second.a };
  for (const point of [first.a, first.b, first.c]) {
    const target = closestPointOnTriangle(point, second); const distance = distance3(point, target);
    if (distance < best.distance) best = { distance, first: point, second: target };
  }
  for (const point of [second.a, second.b, second.c]) {
    const target = closestPointOnTriangle(point, first); const distance = distance3(point, target);
    if (distance < best.distance) best = { distance, first: target, second: point };
  }
  for (const edgeA of firstEdges) for (const edgeB of secondEdges) {
    const candidate = segmentDistance(edgeA[0], edgeA[1], edgeB[0], edgeB[1]);
    if (candidate.distance < best.distance) best = candidate;
  }
  return best;
}

function segmentTriangleIntersection(start: Vec3, end: Vec3, triangle: Triangle3): Vec3 | null {
  const segment = subtract3(end, start); const length = length3(segment);
  if (!length) return null;
  const direction = scale3(segment, 1 / length);
  const distance = intersectRayTriangle(start, direction, triangle);
  return distance !== null && distance <= length + 1e-9 ? add3(start, scale3(direction, distance)) : null;
}

function segmentDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): { distance: number; first: Vec3; second: Vec3 } {
  const d1 = subtract3(q1, p1); const d2 = subtract3(q2, p2); const r = subtract3(p1, p2);
  const a = dot3(d1, d1); const e = dot3(d2, d2); const f = dot3(d2, r); const epsilon = 1e-12;
  let s = 0; let t = 0;
  if (a <= epsilon && e <= epsilon) return { distance: distance3(p1, p2), first: p1, second: p2 };
  if (a <= epsilon) t = clamp(f / e, 0, 1);
  else {
    const c = dot3(d1, r);
    if (e <= epsilon) s = clamp(-c / a, 0, 1);
    else {
      const b = dot3(d1, d2); const denominator = a * e - b * b;
      if (denominator !== 0) s = clamp((b * f - c * e) / denominator, 0, 1);
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const first = add3(p1, scale3(d1, s)); const second = add3(p2, scale3(d2, t));
  return { distance: distance3(first, second), first, second };
}

function boundsDistance(first: Bounds3, second: Bounds3): number {
  let squared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const gap = first.max[axis] < second.min[axis] ? second.min[axis] - first.max[axis] : second.max[axis] < first.min[axis] ? first.min[axis] - second.max[axis] : 0;
    squared += gap * gap;
  }
  return Math.sqrt(squared);
}

function centroid(triangle: Triangle3): Vec3 { return scale3(add3(add3(triangle.a, triangle.b), triangle.c), 1 / 3); }
function readPoint(positions: number[], index: number): Vec3 | null {
  const offset = index * 3;
  if (!Number.isInteger(index) || offset < 0 || offset + 2 >= positions.length) return null;
  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
