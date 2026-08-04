import type { Vec3 } from './core';
import { bestFitRigid, composeRigid, eulerRigid, identityRigid, rigidFromMatrix } from './registration-math';
import type { CaseScanRecord, RigidTransform, UserRegistrationAdjustment } from './registration-types';

export function alignLandmarkPairs(source: Vec3[], target: Vec3[]): RigidTransform {
  if (source.length !== target.length || source.length < 3) throw new Error('Three or more corresponding source and target points are required.');
  return bestFitRigid(source, target);
}

export function applyNumericAdjustment(current: RigidTransform, translation: Vec3, rotationDegrees: Vec3): RigidTransform {
  if (![...translation, ...rotationDegrees].every(Number.isFinite)) throw new Error('Numeric transform values must be finite.');
  return composeRigid(eulerRigid(rotationDegrees, translation), current);
}

export function applyMatrixEntry(matrix: number[]): RigidTransform { return rigidFromMatrix(matrix); }

export function nudgeTransform(current: RigidTransform, axis: 'x' | 'y' | 'z', amount: number, rotation = false): RigidTransform {
  if (!Number.isFinite(amount)) throw new Error('Nudge amount must be finite.');
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2; const translation: Vec3 = [0, 0, 0]; const angles: Vec3 = [0, 0, 0];
  if (rotation) angles[index] = amount; else translation[index] = amount;
  return applyNumericAdjustment(current, translation, angles);
}

export function userAdjustment(scan: CaseScanRecord, method: UserRegistrationAdjustment['method'], after: RigidTransform, detail: string, actor: string | null = null): UserRegistrationAdjustment {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), actor, method, before: structuredClone(scan.registrationTransform ?? identityRigid()), after: structuredClone(after), detail };
}
