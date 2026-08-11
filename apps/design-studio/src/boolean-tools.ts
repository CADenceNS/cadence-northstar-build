import type { Vec3 } from './core';
import { add3, cross3, dot3, normalize3, scale3, subtract3 } from './geometry';
import { inspectGeometry, validateGeometryResult, type Face, type IndexedMesh } from './editing-geometry';
import { removeDuplicateFaces, weldVertices } from './mesh-edit-tools';

export type BooleanOperation = 'union' | 'difference' | 'intersection';

const EPSILON = 1e-6;
const COPLANAR = 0; const FRONT = 1; const BACK = 2; const SPANNING = 3;

export function booleanMesh(first: IndexedMesh, second: IndexedMesh, operation: BooleanOperation): IndexedMesh {
  assertBooleanInput(first, 'First'); assertBooleanInput(second, 'Second');
  const a = new Node(polygonsFromMesh(first)); const b = new Node(polygonsFromMesh(second));
  let result: Polygon[];
  if (operation === 'union') result = union(a, b);
  else if (operation === 'difference') result = difference(a, b);
  else result = intersection(a, b);
  if (!result.length) throw new Error(`Boolean ${operation} produced empty output.`);
  const mesh = meshFromPolygons(result);
  validateGeometryResult(mesh, { allowBoundaries: false, allowDisconnected: operation === 'union' || operation === 'difference' });
  return mesh;
}

function union(first: Node, second: Node): Polygon[] {
  const a = first.clone(); const b = second.clone();
  a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.allPolygons()); return a.allPolygons();
}

function difference(first: Node, second: Node): Polygon[] {
  const a = first.clone(); const b = second.clone();
  a.invert(); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.allPolygons()); a.invert(); return a.allPolygons();
}

function intersection(first: Node, second: Node): Polygon[] {
  const a = first.clone(); const b = second.clone();
  a.invert(); b.clipTo(a); b.invert(); a.clipTo(b); b.clipTo(a); a.build(b.allPolygons()); a.invert(); return a.allPolygons();
}

class Vertex {
  constructor(readonly position: Vec3) {}
  clone(): Vertex { return new Vertex([...this.position]); }
  interpolate(other: Vertex, amount: number): Vertex { return new Vertex(add3(this.position, scale3(subtract3(other.position, this.position), amount))); }
}

class Plane {
  constructor(readonly normal: Vec3, readonly w: number) {}
  static fromPoints(a: Vec3, b: Vec3, c: Vec3): Plane { const normal = normalize3(cross3(subtract3(b, a), subtract3(c, a))); return new Plane(normal, dot3(normal, a)); }
  clone(): Plane { return new Plane([...this.normal], this.w); }
  flipped(): Plane { return new Plane(scale3(this.normal, -1), -this.w); }
  splitPolygon(polygon: Polygon, coplanarFront: Polygon[], coplanarBack: Polygon[], front: Polygon[], back: Polygon[]): void {
    let polygonType = COPLANAR; const types: number[] = [];
    for (const vertex of polygon.vertices) { const amount = dot3(this.normal, vertex.position) - this.w; const type = amount < -EPSILON ? BACK : amount > EPSILON ? FRONT : COPLANAR; polygonType |= type; types.push(type); }
    if (polygonType === COPLANAR) (dot3(this.normal, polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
    else if (polygonType === FRONT) front.push(polygon);
    else if (polygonType === BACK) back.push(polygon);
    else {
      const frontVertices: Vertex[] = []; const backVertices: Vertex[] = [];
      for (let index = 0; index < polygon.vertices.length; index += 1) {
        const next = (index + 1) % polygon.vertices.length; const type = types[index], nextType = types[next]; const vertex = polygon.vertices[index], nextVertex = polygon.vertices[next];
        if (type !== BACK) frontVertices.push(vertex);
        if (type !== FRONT) backVertices.push(type !== BACK ? vertex.clone() : vertex);
        if ((type | nextType) === SPANNING) {
          const denominator = dot3(this.normal, subtract3(nextVertex.position, vertex.position));
          const amount = (this.w - dot3(this.normal, vertex.position)) / denominator;
          const split = vertex.interpolate(nextVertex, amount); frontVertices.push(split); backVertices.push(split.clone());
        }
      }
      if (frontVertices.length >= 3) front.push(new Polygon(frontVertices));
      if (backVertices.length >= 3) back.push(new Polygon(backVertices));
    }
  }
}

class Polygon {
  readonly plane: Plane;
  constructor(readonly vertices: Vertex[]) {
    if (vertices.length < 3) throw new Error('Boolean polygon requires at least three vertices.');
    this.plane = Plane.fromPoints(vertices[0].position, vertices[1].position, vertices[2].position);
    if (!this.plane.normal.some(Math.abs)) throw new Error('Boolean input contains a degenerate polygon.');
  }
  clone(): Polygon { return new Polygon(this.vertices.map((vertex) => vertex.clone())); }
  flipped(): Polygon { return new Polygon([...this.vertices].reverse().map((vertex) => vertex.clone())); }
}

class Node {
  private plane: Plane | null = null;
  private front: Node | null = null;
  private back: Node | null = null;
  private polygons: Polygon[] = [];
  constructor(polygons: Polygon[] = []) { if (polygons.length) this.build(polygons); }
  clone(): Node { const node = new Node(); node.plane = this.plane?.clone() ?? null; node.front = this.front?.clone() ?? null; node.back = this.back?.clone() ?? null; node.polygons = this.polygons.map((polygon) => polygon.clone()); return node; }
  invert(): void { this.polygons = this.polygons.map((polygon) => polygon.flipped()); this.plane = this.plane?.flipped() ?? null; this.front?.invert(); this.back?.invert(); [this.front, this.back] = [this.back, this.front]; }
  clipPolygons(polygons: Polygon[]): Polygon[] {
    if (!this.plane) return polygons.slice();
    let front: Polygon[] = []; let back: Polygon[] = [];
    for (const polygon of polygons) this.plane.splitPolygon(polygon, front, back, front, back);
    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back); else back = [];
    return [...front, ...back];
  }
  clipTo(other: Node): void { this.polygons = other.clipPolygons(this.polygons); this.front?.clipTo(other); this.back?.clipTo(other); }
  allPolygons(): Polygon[] { return [...this.polygons, ...(this.front?.allPolygons() ?? []), ...(this.back?.allPolygons() ?? [])]; }
  build(polygons: Polygon[]): void {
    if (!polygons.length) return;
    if (!this.plane) this.plane = polygons[0].plane.clone();
    const front: Polygon[] = []; const back: Polygon[] = [];
    for (const polygon of polygons) this.plane.splitPolygon(polygon, this.polygons, this.polygons, front, back);
    if (front.length) { if (!this.front) this.front = new Node(); this.front.build(front); }
    if (back.length) { if (!this.back) this.back = new Node(); this.back.build(back); }
  }
}

function polygonsFromMesh(mesh: IndexedMesh): Polygon[] { return mesh.faces.map((face) => new Polygon(face.map((id) => new Vertex([...mesh.positions[id]])))); }

function meshFromPolygons(polygons: Polygon[]): IndexedMesh {
  const global = polygons.flatMap((polygon) => polygon.vertices.map((vertex) => vertex.position));
  const positions: Vec3[] = []; const faces: Face[] = [];
  for (const polygon of polygons) {
    const boundary: Vec3[] = [];
    for (let edge = 0; edge < polygon.vertices.length; edge += 1) {
      const start = polygon.vertices[edge].position; const end = polygon.vertices[(edge + 1) % polygon.vertices.length].position;
      const direction = subtract3(end, start); const denominator = dot3(direction, direction);
      const points = global.flatMap((point) => {
        const amount = denominator ? dot3(subtract3(point, start), direction) / denominator : 0;
        const projected = add3(start, scale3(direction, amount));
        return amount >= -EPSILON && amount < 1 - EPSILON && Math.hypot(...subtract3(point, projected)) <= EPSILON * 10 ? [{ point, amount }] : [];
      }).sort((a, b) => a.amount - b.amount);
      for (const value of points) if (!boundary.some((point) => Math.hypot(...subtract3(point, value.point)) <= EPSILON)) boundary.push([...value.point]);
    }
    if (boundary.length < 3) continue;
    const center = scale3(boundary.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / boundary.length);
    const offset = positions.length; positions.push(...boundary.map((point) => [...point] as Vec3), center); const centerId = offset + boundary.length;
    for (let index = 0; index < boundary.length; index += 1) faces.push([offset + index, offset + (index + 1) % boundary.length, centerId]);
  }
  return removeDuplicateFaces(weldVertices({ positions, faces }, EPSILON * 10));
}

function assertBooleanInput(mesh: IndexedMesh, label: string): void {
  const inspection = inspectGeometry(mesh);
  if (!inspection.watertight) throw new Error(`${label} Boolean input must be a closed two-manifold mesh.`);
  if (inspection.selfIntersectionCount) throw new Error(`${label} Boolean input has ${inspection.selfIntersectionCount} self-intersection${inspection.selfIntersectionCount === 1 ? '' : 's'}.`);
  const signedVolume = mesh.faces.reduce((sum, [a, b, c]) => sum + dot3(mesh.positions[a], cross3(mesh.positions[b], mesh.positions[c])) / 6, 0);
  if (!(signedVolume > EPSILON)) throw new Error(`${label} Boolean input must have consistent outward winding and positive signed volume.`);
}
