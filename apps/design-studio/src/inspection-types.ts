import type { Vec3 } from './core';
import type { Bounds3 } from './geometry';

export interface SurfaceHit {
  position: Vec3;
  objectId: string;
  artifactId: string;
  triangleIndex: number;
  distance: number;
}

export interface ViewerOverlay {
  id: string;
  checkId: string;
  primitive: 'lines' | 'triangles' | 'points';
  positions: number[];
  color: [number, number, number, number];
  elementCount: number;
  bounds: Bounds3;
  visible: boolean;
}

export interface MeasurementVisual {
  id: string;
  points: Vec3[];
  segments: Array<[Vec3, Vec3]>;
  color: [number, number, number, number];
  visible: boolean;
}

export interface ProjectedPoint { x: number; y: number; visible: boolean; }
