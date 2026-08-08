import type { Quat, Transform, Vec3 } from './core';
import { add3, cross3, dot3, length3, normalize3, scale3, subtract3 } from './geometry';
import type { RigidTransform } from './registration-types';

export const IDENTITY_RIGID: RigidTransform = {
  matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  translation: [0, 0, 0],
  rotation: [0, 0, 0, 1],
};

export function identityRigid(): RigidTransform { return structuredClone(IDENTITY_RIGID); }

export function rigidFromRotationTranslation(rotation: Quat, translation: Vec3): RigidTransform {
  const q = normalizeQuaternion(rotation);
  const [x, y, z, w] = q;
  const matrix = [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), translation[0],
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), translation[1],
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), translation[2],
    0, 0, 0, 1,
  ];
  return { matrix, translation: [...translation], rotation: q };
}

export function rigidFromMatrix(matrix: number[]): RigidTransform {
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) throw new Error('A finite 4x4 transform matrix is required.');
  const determinant = determinant3(matrix);
  if (Math.abs(determinant - 1) > 0.02) throw new Error(`Registration transform is not rigid (determinant ${determinant.toFixed(6)}).`);
  const rotation = quaternionFromMatrix(matrix);
  return rigidFromRotationTranslation(rotation, [matrix[3], matrix[7], matrix[11]]);
}

export function rigidToSceneTransform(transform: RigidTransform, scale: Vec3 = [1, 1, 1]): Transform {
  return { position: [...transform.translation], rotation: [...transform.rotation], scale: [...scale] };
}

export function sceneTransformToRigid(transform: Transform): RigidTransform {
  if (transform.scale.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Registration requires a finite positive scene scale.');
  return rigidFromRotationTranslation(transform.rotation, transform.position);
}

export function applyRigid(transform: RigidTransform, point: Vec3): Vec3 {
  const m = transform.matrix;
  return [
    m[0] * point[0] + m[1] * point[1] + m[2] * point[2] + m[3],
    m[4] * point[0] + m[5] * point[1] + m[6] * point[2] + m[7],
    m[8] * point[0] + m[9] * point[1] + m[10] * point[2] + m[11],
  ];
}

export function applyRigidDirection(transform: RigidTransform, direction: Vec3): Vec3 {
  const m = transform.matrix;
  return normalize3([
    m[0] * direction[0] + m[1] * direction[1] + m[2] * direction[2],
    m[4] * direction[0] + m[5] * direction[1] + m[6] * direction[2],
    m[8] * direction[0] + m[9] * direction[1] + m[10] * direction[2],
  ]);
}

/** Returns a transform that applies b first, then a. */
export function composeRigid(a: RigidTransform, b: RigidTransform): RigidTransform {
  const am = a.matrix; const bm = b.matrix; const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) for (let column = 0; column < 4; column += 1) {
    for (let index = 0; index < 4; index += 1) out[row * 4 + column] += am[row * 4 + index] * bm[index * 4 + column];
  }
  return rigidFromMatrix(out);
}

export function invertRigid(transform: RigidTransform): RigidTransform {
  const m = transform.matrix;
  const rotation: number[] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const t = transform.translation;
  const translation: Vec3 = [
    -(rotation[0] * t[0] + rotation[1] * t[1] + rotation[2] * t[2]),
    -(rotation[3] * t[0] + rotation[4] * t[1] + rotation[5] * t[2]),
    -(rotation[6] * t[0] + rotation[7] * t[1] + rotation[8] * t[2]),
  ];
  return rigidFromMatrix([
    rotation[0], rotation[1], rotation[2], translation[0],
    rotation[3], rotation[4], rotation[5], translation[1],
    rotation[6], rotation[7], rotation[8], translation[2],
    0, 0, 0, 1,
  ]);
}

export function bestFitRigid(source: Vec3[], target: Vec3[]): RigidTransform {
  if (source.length !== target.length || source.length < 3) throw new Error('Rigid alignment requires at least three corresponding point pairs.');
  const sourceCenter = centroid(source); const targetCenter = centroid(target);
  const covariance = new Array<number>(9).fill(0);
  for (let index = 0; index < source.length; index += 1) {
    const p = subtract3(source[index], sourceCenter); const q = subtract3(target[index], targetCenter);
    covariance[0] += p[0] * q[0]; covariance[1] += p[0] * q[1]; covariance[2] += p[0] * q[2];
    covariance[3] += p[1] * q[0]; covariance[4] += p[1] * q[1]; covariance[5] += p[1] * q[2];
    covariance[6] += p[2] * q[0]; covariance[7] += p[2] * q[1]; covariance[8] += p[2] * q[2];
  }
  const [sxx, sxy, sxz, syx, syy, syz, szx, szy, szz] = covariance;
  const trace = sxx + syy + szz;
  const horn = [
    trace, syz - szy, szx - sxz, sxy - syx,
    syz - szy, sxx - syy - szz, sxy + syx, szx + sxz,
    szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy,
    sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz,
  ];
  const eigen = largestEigenvectorSymmetric(horn, 4);
  const rotation: Quat = normalizeQuaternion([eigen[1], eigen[2], eigen[3], eigen[0]]);
  const rotatedCenter = rotateByQuaternion(sourceCenter, rotation);
  return rigidFromRotationTranslation(rotation, subtract3(targetCenter, rotatedCenter));
}

export function pcaFrame(points: Vec3[]): { center: Vec3; axes: [Vec3, Vec3, Vec3]; values: Vec3 } {
  if (points.length < 3) throw new Error('PCA requires at least three geometry points.');
  const center = centroid(points); const covariance = new Array<number>(9).fill(0);
  for (const point of points) {
    const p = subtract3(point, center);
    covariance[0] += p[0] * p[0]; covariance[1] += p[0] * p[1]; covariance[2] += p[0] * p[2];
    covariance[3] += p[1] * p[0]; covariance[4] += p[1] * p[1]; covariance[5] += p[1] * p[2];
    covariance[6] += p[2] * p[0]; covariance[7] += p[2] * p[1]; covariance[8] += p[2] * p[2];
  }
  const decomposition = eigenSymmetric(covariance, 3).sort((a, b) => b.value - a.value);
  let first = normalize3(decomposition[0].vector as Vec3);
  let second = normalize3(decomposition[1].vector as Vec3);
  let third = normalize3(cross3(first, second));
  second = normalize3(cross3(third, first));
  first = normalize3(first); third = normalize3(third);
  return { center, axes: [first, second, third], values: [decomposition[0].value, decomposition[1].value, decomposition[2].value] };
}

export function pcaRigidCandidates(source: Vec3[], target: Vec3[]): RigidTransform[] {
  const sourceFrame = pcaFrame(source); const targetFrame = pcaFrame(target);
  const signs: Array<[number, number, number]> = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  return signs.map((sign) => {
    const sourceAxes = sourceFrame.axes;
    const targetAxes = targetFrame.axes.map((axis, index) => scale3(axis, sign[index])) as [Vec3, Vec3, Vec3];
    const rotation = new Array<number>(9).fill(0);
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
      rotation[row * 3 + column] = targetAxes[0][row] * sourceAxes[0][column]
        + targetAxes[1][row] * sourceAxes[1][column]
        + targetAxes[2][row] * sourceAxes[2][column];
    }
    const q = quaternionFromMatrix([rotation[0], rotation[1], rotation[2], 0, rotation[3], rotation[4], rotation[5], 0, rotation[6], rotation[7], rotation[8], 0, 0, 0, 0, 1]);
    const translated = subtract3(targetFrame.center, rotateByQuaternion(sourceFrame.center, q));
    return rigidFromRotationTranslation(q, translated);
  });
}

export function axisAngleRigid(axis: Vec3, radians: number, translation: Vec3 = [0, 0, 0]): RigidTransform {
  const normalized = normalize3(axis); const half = radians / 2; const sine = Math.sin(half);
  return rigidFromRotationTranslation([normalized[0] * sine, normalized[1] * sine, normalized[2] * sine, Math.cos(half)], translation);
}

export function eulerRigid(rotationDegrees: Vec3, translation: Vec3): RigidTransform {
  const toRadians = Math.PI / 180;
  const x = axisAngleRigid([1, 0, 0], rotationDegrees[0] * toRadians);
  const y = axisAngleRigid([0, 1, 0], rotationDegrees[1] * toRadians);
  const z = axisAngleRigid([0, 0, 1], rotationDegrees[2] * toRadians);
  return composeRigid(rigidFromRotationTranslation(composeRigid(z, composeRigid(y, x)).rotation, translation), identityRigid());
}

export function averageRigid(transforms: RigidTransform[]): RigidTransform {
  if (!transforms.length) throw new Error('At least one transform is required.');
  const translation = centroid(transforms.map((item) => item.translation));
  const reference = transforms[0].rotation; const sum: Quat = [0, 0, 0, 0];
  for (const transform of transforms) {
    const sign = quaternionDot(reference, transform.rotation) < 0 ? -1 : 1;
    for (let index = 0; index < 4; index += 1) sum[index] += transform.rotation[index] * sign;
  }
  return rigidFromRotationTranslation(normalizeQuaternion(sum), translation);
}

export function transformDifference(actual: RigidTransform, expected: RigidTransform): { translationError: number; rotationErrorDegrees: number } {
  const delta = composeRigid(actual, invertRigid(expected));
  return { translationError: length3(delta.translation), rotationErrorDegrees: quaternionAngleDegrees(delta.rotation) };
}

export function quaternionAngleDegrees(rotation: Quat): number {
  const q = normalizeQuaternion(rotation); return 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180 / Math.PI;
}

export function determinant3(matrix: number[]): number {
  const a = matrix[0], b = matrix[1], c = matrix[2], d = matrix[4], e = matrix[5], f = matrix[6], g = matrix[8], h = matrix[9], i = matrix[10];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

export function centroid(points: Vec3[]): Vec3 {
  if (!points.length) return [0, 0, 0];
  return scale3(points.reduce<Vec3>((sum, point) => add3(sum, point), [0, 0, 0]), 1 / points.length);
}

export function rotateByQuaternion(point: Vec3, rotation: Quat): Vec3 {
  const [x, y, z, w] = normalizeQuaternion(rotation); const axis: Vec3 = [x, y, z];
  return add3(add3(scale3(axis, 2 * dot3(axis, point)), scale3(point, w * w - dot3(axis, axis))), scale3(cross3(axis, point), 2 * w));
}

export function normalizeQuaternion(value: Quat): Quat {
  const length = Math.hypot(...value); if (!length) return [0, 0, 0, 1];
  const normalized = value.map((component) => component / length) as Quat;
  return normalized[3] < 0 ? normalized.map((component) => -component) as Quat : normalized;
}

function quaternionDot(a: Quat, b: Quat): number { return a.reduce((sum, value, index) => sum + value * b[index], 0); }

function quaternionFromMatrix(matrix: number[]): Quat {
  const m00 = matrix[0], m11 = matrix[5], m22 = matrix[10]; const trace = m00 + m11 + m22;
  let x: number; let y: number; let z: number; let w: number;
  if (trace > 0) { const s = Math.sqrt(trace + 1) * 2; w = 0.25 * s; x = (matrix[9] - matrix[6]) / s; y = (matrix[2] - matrix[8]) / s; z = (matrix[4] - matrix[1]) / s; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (matrix[9] - matrix[6]) / s; x = 0.25 * s; y = (matrix[1] + matrix[4]) / s; z = (matrix[2] + matrix[8]) / s; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (matrix[2] - matrix[8]) / s; x = (matrix[1] + matrix[4]) / s; y = 0.25 * s; z = (matrix[6] + matrix[9]) / s; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (matrix[4] - matrix[1]) / s; x = (matrix[2] + matrix[8]) / s; y = (matrix[6] + matrix[9]) / s; z = 0.25 * s; }
  return normalizeQuaternion([x, y, z, w]);
}

function largestEigenvectorSymmetric(matrix: number[], size: number): number[] {
  const values = eigenSymmetric(matrix, size); return values.reduce((best, current) => current.value > best.value ? current : best).vector;
}

function eigenSymmetric(input: number[], size: number): Array<{ value: number; vector: number[] }> {
  const matrix = [...input]; const vectors = new Array<number>(size * size).fill(0);
  for (let index = 0; index < size; index += 1) vectors[index * size + index] = 1;
  for (let sweep = 0; sweep < 80; sweep += 1) {
    let p = 0; let q = 1; let maximum = 0;
    for (let row = 0; row < size; row += 1) for (let column = row + 1; column < size; column += 1) {
      const value = Math.abs(matrix[row * size + column]); if (value > maximum) { maximum = value; p = row; q = column; }
    }
    if (maximum < 1e-12) break;
    const app = matrix[p * size + p], aqq = matrix[q * size + q], apq = matrix[p * size + q];
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app); const cosine = Math.cos(angle), sine = Math.sin(angle);
    for (let index = 0; index < size; index += 1) {
      const mip = matrix[index * size + p], miq = matrix[index * size + q];
      matrix[index * size + p] = cosine * mip - sine * miq; matrix[index * size + q] = sine * mip + cosine * miq;
    }
    for (let index = 0; index < size; index += 1) {
      const mpi = matrix[p * size + index], mqi = matrix[q * size + index];
      matrix[p * size + index] = cosine * mpi - sine * mqi; matrix[q * size + index] = sine * mpi + cosine * mqi;
    }
    for (let index = 0; index < size; index += 1) {
      const vip = vectors[index * size + p], viq = vectors[index * size + q];
      vectors[index * size + p] = cosine * vip - sine * viq; vectors[index * size + q] = sine * vip + cosine * viq;
    }
  }
  return Array.from({ length: size }, (_, column) => ({
    value: matrix[column * size + column],
    vector: Array.from({ length: size }, (_, row) => vectors[row * size + column]),
  }));
}
