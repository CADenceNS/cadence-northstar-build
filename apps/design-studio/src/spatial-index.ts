import type { ArtifactRecord, Vec3 } from './core';
import { add3, cross3, distance3, normalize3, subtract3 } from './geometry';

export interface GeometryPoint { id: number; position: Vec3; normal: Vec3 | null; }
export interface NearestPoint { point: GeometryPoint; distance: number; }

interface KdNode {
  point: GeometryPoint;
  axis: 0 | 1 | 2;
  left: KdNode | null;
  right: KdNode | null;
}

export class KdTree {
  private readonly root: KdNode | null;
  constructor(points: GeometryPoint[]) { this.root = build([...points], 0); }

  nearest(position: Vec3, maximumDistance = Infinity): NearestPoint | null {
    let best: NearestPoint | null = null; let bestSquared = maximumDistance * maximumDistance;
    const visit = (node: KdNode | null) => {
      if (!node) return;
      const dx = position[0] - node.point.position[0], dy = position[1] - node.point.position[1], dz = position[2] - node.point.position[2];
      const squared = dx * dx + dy * dy + dz * dz;
      if (squared < bestSquared) { bestSquared = squared; best = { point: node.point, distance: Math.sqrt(squared) }; }
      const difference = position[node.axis] - node.point.position[node.axis];
      const near = difference <= 0 ? node.left : node.right; const far = difference <= 0 ? node.right : node.left;
      visit(near); if (difference * difference < bestSquared) visit(far);
    };
    visit(this.root); return best;
  }
}

export function artifactGeometry(artifact: ArtifactRecord): GeometryPoint[] {
  const topology = artifact.mesh.sourceTopology ?? { positions: artifact.mesh.positions, indices: artifact.mesh.indices };
  const vertexCount = Math.floor(topology.positions.length / 3);
  const normals: Vec3[] = Array.from({ length: vertexCount }, () => [0, 0, 0]);
  for (let offset = 0; offset + 2 < topology.indices.length; offset += 3) {
    const ids = [topology.indices[offset], topology.indices[offset + 1], topology.indices[offset + 2]];
    if (ids.some((id) => !Number.isInteger(id) || id < 0 || id >= vertexCount)) continue;
    const points = ids.map((id) => readPoint(topology.positions, id));
    const normal = cross3(subtract3(points[1], points[0]), subtract3(points[2], points[0]));
    for (const id of ids) normals[id] = add3(normals[id], normal);
  }
  return Array.from({ length: vertexCount }, (_, id) => ({
    id,
    position: readPoint(topology.positions, id),
    normal: Math.hypot(...normals[id]) > 1e-12 ? normalize3(normals[id]) : null,
  }));
}

export function deterministicSample(points: GeometryPoint[], limit: number): GeometryPoint[] {
  if (points.length <= limit) return points.map((point) => structuredClone(point));
  const selected: GeometryPoint[] = []; const used = new Set<number>();
  const golden = 0.6180339887498949;
  for (let index = 0; index < limit; index += 1) {
    let candidate = Math.floor(((index * golden) % 1) * points.length);
    while (used.has(candidate)) candidate = (candidate + 1) % points.length;
    used.add(candidate); selected.push(structuredClone(points[candidate]));
  }
  return selected.sort((a, b) => a.id - b.id);
}

export function geometryDiagonal(points: GeometryPoint[]): number {
  if (!points.length) return 0;
  const min: Vec3 = [Infinity, Infinity, Infinity]; const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) for (let axis = 0; axis < 3; axis += 1) {
    min[axis] = Math.min(min[axis], point.position[axis]); max[axis] = Math.max(max[axis], point.position[axis]);
  }
  return distance3(min, max);
}

function build(points: GeometryPoint[], depth: number): KdNode | null {
  if (!points.length) return null;
  const axis = (depth % 3) as 0 | 1 | 2;
  points.sort((a, b) => a.position[axis] - b.position[axis] || a.id - b.id);
  const middle = Math.floor(points.length / 2);
  return { point: points[middle], axis, left: build(points.slice(0, middle), depth + 1), right: build(points.slice(middle + 1), depth + 1) };
}

function readPoint(positions: number[], index: number): Vec3 {
  const offset = index * 3; return [positions[offset], positions[offset + 1], positions[offset + 2]];
}
