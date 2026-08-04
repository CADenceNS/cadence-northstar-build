import type { ArtifactRecord, Vec3 } from './core';
import { cross3, dot3, normalize3, scale3, subtract3 } from './geometry';
import { applyRigid, identityRigid, pcaFrame, rigidFromMatrix } from './registration-math';
import type { CaseScanSet, DentalCoordinateSystem, ScanRole } from './registration-types';
import { unitScaleToMillimeters } from './scan-validation';
import { artifactGeometry, deterministicSample } from './spatial-index';

const COORDINATE_CONVENTION = 'CADENCE_DENTAL_XYZ_V1' as const;

export function estimateDentalCoordinates(scanSet: CaseScanSet, artifacts: ArtifactRecord[]): DentalCoordinateSystem {
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const eligible = scanSet.scans.filter((scan) => coordinateRole(scan.assignedRole) && scan.registrationStatus !== 'failed' && scan.registrationStatus !== 'cancelled');
  if (!eligible.length) throw new Error('A registered arch, preparation, implant, or pre-operative scan is required to estimate dental coordinates.');
  const preferred = eligible.find((scan) => scan.assignedRole === 'upper-arch') ?? eligible.find((scan) => scan.assignedRole === 'lower-arch') ?? eligible[0];
  const artifact = artifactMap.get(preferred.artifactId); if (!artifact) throw new Error('Coordinate source artifact was not found.');
  const scale = unitScaleToMillimeters(preferred.confirmedUnits);
  const geometry = deterministicSample(artifactGeometry(artifact), 6000).map((point) => applyRigid(preferred.registrationTransform, scale3(point.position, scale)));
  if (geometry.length < 12) throw new Error('At least 12 geometry points are required for dental coordinate estimation.');

  const frame = pcaFrame(geometry); let planeNormal = normalize3(frame.axes[2]);
  const first = frame.axes[0]; const second = frame.axes[1];
  const firstScore = archCorrelation(geometry, frame.center, first, second); const secondScore = archCorrelation(geometry, frame.center, second, first);
  let leftRight = Math.abs(firstScore) >= Math.abs(secondScore) ? first : second;
  let anteriorPosterior = Math.abs(firstScore) >= Math.abs(secondScore) ? second : first;
  const selectedCorrelation = Math.abs(firstScore) >= Math.abs(secondScore) ? firstScore : secondScore;
  if (selectedCorrelation < 0) anteriorPosterior = scale3(anteriorPosterior, -1);

  // PCA establishes the axes. Raw +X is used only to resolve the otherwise unobservable left/right sign ambiguity.
  if (dot3(leftRight, [1, 0, 0]) < 0) leftRight = scale3(leftRight, -1);
  if (dot3(cross3(leftRight, anteriorPosterior), planeNormal) < 0) planeNormal = scale3(planeNormal, -1);
  const maxillary = isMaxillary(preferred.assignedRole);
  const averageNormal = averageSourceNormal(artifact, preferred.registrationTransform);
  if (averageNormal && dot3(planeNormal, averageNormal) < 0) planeNormal = scale3(planeNormal, -1);
  // +Z is superior: toward maxillary gingiva. Mandibular geometry is therefore viewed with its occlusal normal reversed.
  if (!maxillary) planeNormal = scale3(planeNormal, -1);
  anteriorPosterior = normalize3(cross3(planeNormal, leftRight));
  leftRight = normalize3(cross3(anteriorPosterior, planeNormal));

  const origin = robustCenter(geometry);
  const matrix = [
    leftRight[0], leftRight[1], leftRight[2], -dot3(leftRight, origin),
    anteriorPosterior[0], anteriorPosterior[1], anteriorPosterior[2], -dot3(anteriorPosterior, origin),
    planeNormal[0], planeNormal[1], planeNormal[2], -dot3(planeNormal, origin),
    0, 0, 0, 1,
  ];
  const separation = Math.max(0, Math.min(1, 1 - frame.values[2] / Math.max(frame.values[1], 1e-9)));
  const symmetryEvidence = Math.min(1, Math.abs(selectedCorrelation));
  const confidence = Math.max(0, Math.min(1, 0.55 * separation + 0.45 * symmetryEvidence));
  const now = new Date().toISOString();
  return {
    version: (scanSet.dentalCoordinates?.version ?? 0) + 1,
    convention: COORDINATE_CONVENTION,
    origin,
    leftRightAxis: leftRight,
    anteriorPosteriorAxis: anteriorPosterior,
    occlusalGingivalAxis: planeNormal,
    occlusalPlaneNormal: planeNormal,
    midlineDirection: anteriorPosterior,
    anteriorDirection: scale3(anteriorPosterior, -1),
    archNormal: planeNormal,
    caseTransform: rigidFromMatrix(matrix),
    confidence,
    locked: false,
    manuallyCorrected: false,
    history: [{ id: crypto.randomUUID(), at: now, action: 'dental-coordinate-estimated', actor: null, transform: rigidFromMatrix(matrix), detail: `Robust PCA and arch-symmetry estimate using ${geometry.length} sampled points.` }],
  };
}

export function reverseAnteriorDirection(coordinates: DentalCoordinateSystem, actor: string | null = null): DentalCoordinateSystem {
  if (coordinates.locked) throw new Error('The dental coordinate system is locked.');
  const anteriorPosterior = scale3(coordinates.anteriorPosteriorAxis, -1); const leftRight = scale3(coordinates.leftRightAxis, -1);
  const matrix = coordinateMatrix(leftRight, anteriorPosterior, coordinates.occlusalGingivalAxis, coordinates.origin);
  return { ...structuredClone(coordinates), version: coordinates.version + 1, leftRightAxis: leftRight, anteriorPosteriorAxis: anteriorPosterior, midlineDirection: anteriorPosterior, anteriorDirection: scale3(anteriorPosterior, -1), caseTransform: rigidFromMatrix(matrix), manuallyCorrected: true, history: [...coordinates.history, { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'reverse-anterior-direction', actor, transform: rigidFromMatrix(matrix), detail: 'User reversed the anterior/posterior direction.' }] };
}

export function manuallyCorrectDentalAxes(coordinates: DentalCoordinateSystem, planeNormal: Vec3, midlineDirection: Vec3, actor: string | null = null): DentalCoordinateSystem {
  if (coordinates.locked) throw new Error('The dental coordinate system is locked.');
  const z = normalize3(planeNormal); let y = normalize3(subtract3(midlineDirection, scale3(z, dot3(midlineDirection, z))));
  if (!Math.hypot(...y)) throw new Error('Midline direction cannot be parallel to the occlusal-plane normal.');
  let x = normalize3(cross3(y, z)); y = normalize3(cross3(z, x)); x = normalize3(x);
  const matrix = coordinateMatrix(x, y, z, coordinates.origin); const transform = rigidFromMatrix(matrix);
  return { ...structuredClone(coordinates), version: coordinates.version + 1, leftRightAxis: x, anteriorPosteriorAxis: y, occlusalGingivalAxis: z, occlusalPlaneNormal: z, midlineDirection: y, anteriorDirection: scale3(y, -1), archNormal: z, caseTransform: transform, manuallyCorrected: true, history: [...coordinates.history, { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'manual-coordinate-correction', actor, transform, detail: 'User corrected the occlusal plane and dental midline.' }] };
}

export function resetDentalCoordinates(): DentalCoordinateSystem | null { return null; }

export function coordinateVisualizationLines(coordinates: DentalCoordinateSystem, length = 35): Array<{ id: string; start: Vec3; end: Vec3; label: string }> {
  const origin = coordinates.origin;
  return [
    { id: 'dental-x', start: origin, end: add(origin, scale3(coordinates.leftRightAxis, length)), label: '+X Left' },
    { id: 'dental-y', start: origin, end: add(origin, scale3(coordinates.anteriorPosteriorAxis, length)), label: '+Y Posterior' },
    { id: 'dental-z', start: origin, end: add(origin, scale3(coordinates.occlusalGingivalAxis, length)), label: '+Z Superior' },
    { id: 'dental-midline', start: add(origin, scale3(coordinates.midlineDirection, -length)), end: add(origin, scale3(coordinates.midlineDirection, length)), label: 'Dental Midline' },
  ];
}

function coordinateRole(role: ScanRole): boolean { return ['upper-arch', 'lower-arch', 'pre-operative-upper', 'pre-operative-lower', 'preparation-arch', 'implant-arch'].includes(role); }
function isMaxillary(role: ScanRole): boolean { return ['upper-arch', 'pre-operative-upper'].includes(role); }
function archCorrelation(points: Vec3[], center: Vec3, lateral: Vec3, anteriorPosterior: Vec3): number {
  const pairs = points.map((point) => { const relative = subtract3(point, center); return { lateral: Math.abs(dot3(relative, lateral)), depth: dot3(relative, anteriorPosterior) }; });
  const lateralMean = pairs.reduce((sum, item) => sum + item.lateral, 0) / pairs.length; const depthMean = pairs.reduce((sum, item) => sum + item.depth, 0) / pairs.length;
  let covariance = 0; let firstVariance = 0; let secondVariance = 0;
  for (const pair of pairs) { const x = pair.lateral - lateralMean, y = pair.depth - depthMean; covariance += x * y; firstVariance += x * x; secondVariance += y * y; }
  return covariance / Math.sqrt(Math.max(1e-12, firstVariance * secondVariance));
}
function robustCenter(points: Vec3[]): Vec3 { const sorted = [0, 1, 2].map((axis) => points.map((point) => point[axis]).sort((a, b) => a - b)); const middle = Math.floor(points.length / 2); return sorted.map((values) => points.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2) as Vec3; }
function averageSourceNormal(artifact: ArtifactRecord, transform: CaseScanSet['scans'][number]['registrationTransform']): Vec3 | null {
  const points = deterministicSample(artifactGeometry(artifact), 3000).filter((point) => point.normal); if (!points.length) return null;
  const sum = points.reduce<Vec3>((value, point) => { const normal = point.normal!; return [value[0] + normal[0], value[1] + normal[1], value[2] + normal[2]]; }, [0, 0, 0]);
  const matrix = transform.matrix; return normalize3([matrix[0] * sum[0] + matrix[1] * sum[1] + matrix[2] * sum[2], matrix[4] * sum[0] + matrix[5] * sum[1] + matrix[6] * sum[2], matrix[8] * sum[0] + matrix[9] * sum[1] + matrix[10] * sum[2]]);
}
function coordinateMatrix(x: Vec3, y: Vec3, z: Vec3, origin: Vec3): number[] { return [x[0], x[1], x[2], -dot3(x, origin), y[0], y[1], y[2], -dot3(y, origin), z[0], z[1], z[2], -dot3(z, origin), 0, 0, 0, 1]; }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

export const DENTAL_COORDINATE_IDENTITY = identityRigid();
