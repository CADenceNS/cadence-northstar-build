import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import { distance3 } from './geometry';
import type { CaseScanRecord, ScanValidationIssue, ScanValidationResult } from './registration-types';

const MIN_DENTAL_DIMENSION_MM = 0.5;
const MAX_DENTAL_DIMENSION_MM = 400;

export function validateScanForRegistration(
  artifact: ArtifactRecord,
  object: SceneObject,
  scan: CaseScanRecord,
  allArtifacts: ArtifactRecord[],
): ScanValidationResult {
  const issues: ScanValidationIssue[] = [];
  const topology = artifact.mesh.sourceTopology ?? { positions: artifact.mesh.positions, indices: artifact.mesh.indices };
  const finiteGeometry = topology.positions.every(Number.isFinite);
  issues.push(issue('empty-geometry', topology.positions.length >= 9 && topology.indices.length >= 3 ? 'pass' : 'fail', topology.indices.length / 3, 1, topology.indices.length >= 3 ? 'Geometry contains triangles.' : 'Registration cannot execute because the geometry is empty.'));
  issues.push(issue('numeric-coordinates', finiteGeometry ? 'pass' : 'fail', finiteGeometry, 'finite', finiteGeometry ? 'All source coordinates are finite.' : 'The source contains non-finite coordinates.'));

  const dimensions = boundsDimensions(artifact);
  issues.push(issue('bounding-dimensions', dimensions.every(Number.isFinite) ? 'pass' : 'fail', { x: dimensions[0], y: dimensions[1], z: dimensions[2] }, `${MIN_DENTAL_DIMENSION_MM}-${MAX_DENTAL_DIMENSION_MM} mm`, 'Original source bounding dimensions are reported without modifying scale.'));

  const unitsCertain = artifact.units !== 'unknown' && scan.unitsConfirmed;
  issues.push(issue('units', unitsCertain ? 'pass' : 'confirmation-required', artifact.units, 'explicit confirmation', unitsCertain ? `Source units confirmed as ${artifact.units}.` : 'Mesh files do not carry reliable units; confirm units before automatic registration.'));
  const scale = unitScaleToMillimeters(artifact.units);
  const maximumDimensionMm = Math.max(...dimensions) * scale;
  const roleMinimumDimensionMm = minimumDimensionForRole(scan.assignedRole);
  const validScale = Number.isFinite(maximumDimensionMm) && maximumDimensionMm >= roleMinimumDimensionMm && maximumDimensionMm <= MAX_DENTAL_DIMENSION_MM;
  issues.push(issue('invalid-scale', unitsCertain && validScale ? 'pass' : unitsCertain ? 'fail' : 'confirmation-required', maximumDimensionMm, `${roleMinimumDimensionMm}-${MAX_DENTAL_DIMENSION_MM} mm for ${scan.assignedRole}`, unitsCertain ? validScale ? 'Confirmed scale is plausible for the assigned scan role.' : 'Confirmed scale is outside the supported envelope for the assigned scan role.' : 'Scale cannot be validated until source units are confirmed.'));

  const transformValid = [...object.transform.position, ...object.transform.rotation, ...object.transform.scale].every(Number.isFinite)
    && object.transform.scale.every((value) => value > 0)
    && Math.abs(Math.hypot(...object.transform.rotation) - 1) < 0.02;
  issues.push(issue('invalid-transform', transformValid ? 'pass' : 'fail', transformValid, 'finite rigid transform and positive scale', transformValid ? 'Current transform is finite and structurally valid.' : 'Current scene transform is invalid for registration.'));

  const handedness = object.transform.scale[0] * object.transform.scale[1] * object.transform.scale[2];
  const likelyMirrored = handedness < 0 || artifact.metadata.likelyMirrored === true;
  issues.push(issue('mesh-handedness', likelyMirrored && !scan.mirroredConfirmed ? 'confirmation-required' : 'pass', likelyMirrored ? 'likely mirrored' : 'right-handed transform', 'non-mirrored or confirmed', likelyMirrored ? 'A mirrored transform or mirror marker was detected. Explicit confirmation is required.' : 'No negative-determinant transform was detected.'));
  issues.push(issue('axis-orientation', artifact.orientation === 'normalized' ? 'pass' : 'warning', artifact.orientation, 'estimated during dental normalization', artifact.orientation === 'normalized' ? 'The source declares normalized orientation.' : 'Raw file axes are not trusted; dental axes will be estimated from geometry after assembly.'));

  const duplicate = allArtifacts.find((candidate) => candidate.id !== artifact.id && candidate.checksum === artifact.checksum) ?? null;
  issues.push(issue('duplicate-scan', duplicate ? 'fail' : 'pass', duplicate?.id ?? false, 'unique SHA-256', duplicate ? `This source duplicates ${duplicate.sourceName}.` : 'The source hash is unique within the project.'));

  const blocking = issues.some((item) => item.status === 'fail' || item.status === 'confirmation-required');
  return { artifactId: artifact.id, issues, canRegisterAutomatically: !blocking, unitsCertain, likelyMirrored, duplicateOf: duplicate?.id ?? null };
}

export function validateOverlapPotential(source: ArtifactRecord, target: ArtifactRecord): ScanValidationIssue {
  const sourceDimensions = boundsDimensions(source).map((value) => value * unitScaleToMillimeters(source.units)) as Vec3;
  const targetDimensions = boundsDimensions(target).map((value) => value * unitScaleToMillimeters(target.units)) as Vec3;
  const sourceDiagonal = Math.hypot(...sourceDimensions); const targetDiagonal = Math.hypot(...targetDimensions);
  const ratio = Math.min(sourceDiagonal, targetDiagonal) / Math.max(sourceDiagonal, targetDiagonal, 1e-9);
  const plausible = ratio >= 0.03;
  return issue('overlap-potential', plausible ? 'pass' : 'fail', ratio, 0.03, plausible ? 'Bounding-scale ratio permits a partial-overlap registration attempt.' : 'The scan scale and extent indicate insufficient overlap potential.');
}

export function unitScaleToMillimeters(units: ArtifactRecord['units']): number {
  if (units === 'cm') return 10; if (units === 'm') return 1000; return 1;
}

export function boundsDimensions(artifact: ArtifactRecord): Vec3 {
  const { min, max } = artifact.mesh.bounds; return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
}

export function sourceBoundsDiagonal(artifact: ArtifactRecord): number { return distance3(artifact.mesh.bounds.min, artifact.mesh.bounds.max); }

function minimumDimensionForRole(role: CaseScanRecord['assignedRole']): number {
  if (['upper-arch', 'lower-arch', 'pre-operative-upper', 'pre-operative-lower'].includes(role)) return 20;
  if (['preparation-arch', 'implant-arch'].includes(role)) return 10;
  return MIN_DENTAL_DIMENSION_MM;
}

function issue(id: string, status: ScanValidationIssue['status'], measuredValue: ScanValidationIssue['measuredValue'], threshold: ScanValidationIssue['threshold'], explanation: string): ScanValidationIssue {
  return { id, status, measuredValue, threshold, explanation };
}
