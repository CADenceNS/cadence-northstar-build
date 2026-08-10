import type { Quat, SceneObject, Transform, Vec3 } from './core';
import { cloneIndexed, indexedMesh, meshData, type IndexedMesh } from './editing-geometry';
import { add3, dot3, meshTriangles, minimumDistanceBetweenMeshes, normalize3, scale3, subtract3, transformPoint } from './geometry';
import type { ArtifactRecord } from './core';

export interface NumericTransform {
  translation: Vec3;
  rotationDegrees: Vec3;
  scale: Vec3;
  pivot: Vec3;
  coordinateMode: 'local' | 'global';
}

export interface TransformReport {
  before: Transform;
  after: Transform;
  translationMm: Vec3;
  rotationDegrees: Vec3;
  scale: Vec3;
  pivot: Vec3;
}

export function applyNumericTransform(object: SceneObject, input: NumericTransform): TransformReport {
  validateVector(input.translation, 'Translation');
  validateVector(input.rotationDegrees, 'Rotation');
  validateVector(input.scale, 'Scale');
  validateVector(input.pivot, 'Pivot');
  if (input.scale.some((value) => Math.abs(value) < 1e-9)) throw new Error('Scale cannot collapse an object axis to zero.');
  const rotation = quaternionFromEuler(input.rotationDegrees);
  const translation = input.coordinateMode === 'local' ? rotateVector(input.translation, object.transform.rotation) : input.translation;
  const combinedRotation = input.coordinateMode === 'local' ? multiplyQuaternion(object.transform.rotation, rotation) : multiplyQuaternion(rotation, object.transform.rotation);
  const relative = subtract3(object.transform.position, input.pivot);
  const scaledRelative = input.coordinateMode === 'local'
    ? rotateVector(multiplyVector(rotateVector(relative, conjugateQuaternion(object.transform.rotation)), input.scale), object.transform.rotation)
    : multiplyVector(relative, input.scale);
  const orbitRotation = input.coordinateMode === 'local' ? multiplyQuaternion(multiplyQuaternion(object.transform.rotation, rotation), conjugateQuaternion(object.transform.rotation)) : rotation;
  const rotatedPosition = add3(input.pivot, rotateVector(scaledRelative, orbitRotation));
  const after: Transform = {
    position: add3(rotatedPosition, translation),
    rotation: normalizeQuaternion(combinedRotation),
    scale: [object.transform.scale[0] * input.scale[0], object.transform.scale[1] * input.scale[1], object.transform.scale[2] * input.scale[2]],
  };
  return { before: structuredClone(object.transform), after, translationMm: [...translation], rotationDegrees: [...input.rotationDegrees], scale: [...input.scale], pivot: [...input.pivot] };
}

export function snappedNumericTransform(input: NumericTransform, translationSnapMm: number, angularSnapDegrees: number): NumericTransform {
  const snap = (value: number, interval: number) => interval > 0 ? Math.round(value / interval) * interval : value;
  return {
    ...structuredClone(input),
    translation: input.translation.map((value) => snap(value, translationSnapMm)) as Vec3,
    rotationDegrees: input.rotationDegrees.map((value) => snap(value, angularSnapDegrees)) as Vec3,
  };
}

export function uniformScale(object: SceneObject, factor: number, pivot: Vec3): TransformReport {
  if (!Number.isFinite(factor) || Math.abs(factor) < 1e-9) throw new Error('Uniform scale must be a finite non-zero value.');
  return applyNumericTransform(object, { translation: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [factor, factor, factor], pivot, coordinateMode: 'global' });
}

export function centerObjectToOrigin(object: SceneObject, artifact: ArtifactRecord): TransformReport {
  const min = artifact.mesh.bounds.min; const max = artifact.mesh.bounds.max;
  const localCenter: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const worldCenter = transformPoint(localCenter, object);
  return applyNumericTransform(object, { translation: scale3(worldCenter, -1), rotationDegrees: [0, 0, 0], scale: [1, 1, 1], pivot: worldCenter, coordinateMode: 'global' });
}

export function alignObjects(moving: SceneObject, movingArtifact: ArtifactRecord, target: SceneObject, targetArtifact: ArtifactRecord): TransformReport {
  const movingCenter = transformedBoundsCenter(moving, movingArtifact);
  const targetCenter = transformedBoundsCenter(target, targetArtifact);
  return applyNumericTransform(moving, { translation: subtract3(targetCenter, movingCenter), rotationDegrees: [0, 0, 0], scale: [1, 1, 1], pivot: movingCenter, coordinateMode: 'global' });
}

export function alignToAxis(object: SceneObject, localAxis: Vec3, globalAxis: Vec3, pivot: Vec3): TransformReport {
  const from = normalize3(rotateVector(localAxis, object.transform.rotation));
  const to = normalize3(globalAxis);
  if (!from.some(Math.abs) || !to.some(Math.abs)) throw new Error('Alignment axes must be non-zero vectors.');
  const delta = quaternionBetween(from, to);
  const euler = eulerFromQuaternion(delta);
  return applyNumericTransform(object, { translation: [0, 0, 0], rotationDegrees: euler, scale: [1, 1, 1], pivot, coordinateMode: 'global' });
}

export function alignToPlane(object: SceneObject, localNormal: Vec3, planeNormal: Vec3, pivot: Vec3, planeOrigin: Vec3 = pivot): TransformReport {
  validateVector(planeOrigin, 'Plane origin'); const from = normalize3(rotateVector(localNormal, object.transform.rotation)); const to = normalize3(planeNormal); if (!from.some(Math.abs) || !to.some(Math.abs)) throw new Error('Alignment normals must be non-zero vectors.'); const delta = quaternionBetween(from, to);
  return applyNumericTransform(object, { translation: subtract3(planeOrigin, pivot), rotationDegrees: eulerFromQuaternion(delta), scale: [1, 1, 1], pivot, coordinateMode: 'global' });
}

export function surfaceSnapObject(object: SceneObject, sourceArtifact: ArtifactRecord, targetObject: SceneObject, targetArtifact: ArtifactRecord): TransformReport {
  const closest = minimumDistanceBetweenMeshes(meshTriangles(sourceArtifact, object), meshTriangles(targetArtifact, targetObject));
  if (!closest) throw new Error('Surface snapping requires triangle geometry on both selected objects.');
  return applyNumericTransform(object, { translation: subtract3(closest.second, closest.first), rotationDegrees: [0, 0, 0], scale: [1, 1, 1], pivot: closest.first, coordinateMode: 'global' });
}

export function resetTransform(object: SceneObject): TransformReport {
  const after: Transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  return { before: structuredClone(object.transform), after, translationMm: scale3(object.transform.position, -1), rotationDegrees: [0, 0, 0], scale: [1, 1, 1], pivot: [0, 0, 0] };
}

export function bakeTransform(artifact: ArtifactRecord, object: SceneObject): IndexedMesh {
  const source = indexedMesh(artifact.mesh);
  return {
    positions: source.positions.map((point) => transformPoint(point, object)),
    faces: source.faces.map((face) => [...face]),
  };
}

export function mirrorGeometry(artifact: ArtifactRecord, planeOrigin: Vec3, planeNormal: Vec3): IndexedMesh {
  validateVector(planeOrigin, 'Mirror plane origin');
  const normal = normalize3(planeNormal);
  if (!normal.some(Math.abs)) throw new Error('Mirror plane normal must be non-zero.');
  const mesh = cloneIndexed(indexedMesh(artifact.mesh));
  mesh.positions = mesh.positions.map((point) => {
    const distance = dot3(subtract3(point, planeOrigin), normal);
    return subtract3(point, scale3(normal, 2 * distance));
  });
  mesh.faces = mesh.faces.map(([a, b, c]) => [a, c, b]);
  return mesh;
}

export function duplicateGeometry(artifact: ArtifactRecord): ReturnType<typeof meshData> {
  return meshData(cloneIndexed(indexedMesh(artifact.mesh)));
}

export function quaternionFromEuler(degrees: Vec3): Quat {
  const [x, y, z] = degrees.map((value) => value * Math.PI / 360);
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return normalizeQuaternion([
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ]);
}

export function multiplyQuaternion(first: Quat, second: Quat): Quat {
  const [ax, ay, az, aw] = first; const [bx, by, bz, bw] = second;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

function conjugateQuaternion(value: Quat): Quat { return [-value[0], -value[1], -value[2], value[3]]; }
function multiplyVector(first: Vec3, second: Vec3): Vec3 { return [first[0] * second[0], first[1] * second[1], first[2] * second[2]]; }

export function rotateVector(vector: Vec3, rotation: Quat): Vec3 {
  const [x, y, z, w] = rotation;
  const q: Vec3 = [x, y, z];
  return add3(add3(scale3(q, 2 * dot3(q, vector)), scale3(vector, w * w - dot3(q, q))), scale3([
    q[1] * vector[2] - q[2] * vector[1],
    q[2] * vector[0] - q[0] * vector[2],
    q[0] * vector[1] - q[1] * vector[0],
  ], 2 * w));
}

function quaternionBetween(from: Vec3, to: Vec3): Quat {
  const dot = Math.max(-1, Math.min(1, dot3(from, to)));
  if (dot > 1 - 1e-9) return [0, 0, 0, 1];
  if (dot < -1 + 1e-9) {
    const axis = Math.abs(from[0]) < 0.9 ? normalize3([0, -from[2], from[1]]) : normalize3([-from[1], from[0], 0]);
    return [axis[0], axis[1], axis[2], 0];
  }
  const cross: Vec3 = [from[1] * to[2] - from[2] * to[1], from[2] * to[0] - from[0] * to[2], from[0] * to[1] - from[1] * to[0]];
  return normalizeQuaternion([cross[0], cross[1], cross[2], 1 + dot]);
}

function eulerFromQuaternion([x, y, z, w]: Quat): Vec3 {
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
  const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x))));
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
  return [roll, pitch, yaw].map((value) => value * 180 / Math.PI) as Vec3;
}

function normalizeQuaternion(value: Quat): Quat {
  const length = Math.hypot(...value);
  if (!length) return [0, 0, 0, 1];
  return value.map((item) => item / length) as Quat;
}

function transformedBoundsCenter(object: SceneObject, artifact: ArtifactRecord): Vec3 {
  const center = artifact.mesh.bounds.min.map((value, axis) => (value + artifact.mesh.bounds.max[axis]) / 2) as Vec3;
  return transformPoint(center, object);
}

function validateVector(value: Vec3, label: string): void {
  if (!value.every(Number.isFinite)) throw new Error(`${label} must contain finite numeric values.`);
}
