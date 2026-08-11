import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import { buildTopology, faceCentroid, faceNormal, indexedMesh } from './editing-geometry';
import { closestPointOnMesh, distance3, dot3, meshTriangles, normalize3, subtract3 } from './geometry';
import type { SurfaceCurve } from './editing-types';
import {
  PREPARATION_ENGINE_VERSION,
  type FinishLineClassification,
  type MarginCandidate,
  type MarginConfidenceCategory,
  type MarginQualityResult,
  type MarginSegmentEvidence,
  type MarginVersion,
  type PreparationQcCheck,
} from './preparation-types';
import {
  angleBetween,
  clamp01,
  closestCurveDistance,
  curveSelfIntersections,
  meanPoint,
  pathLength,
  pointInMargin,
  polygonSignedArea,
  type FeatureEdgeMeasurement,
  type OrderedFeaturePath,
} from './preparation-geometry';

export function buildMarginCandidate(
  preparationCandidateId: string,
  meshValue: ArtifactRecord['mesh'],
  path: OrderedFeaturePath,
  edgeMeasurements: FeatureEdgeMeasurement[],
  axisInput: Vec3,
): MarginCandidate {
  const mesh = indexedMesh(meshValue); const axis = normalize3(axisInput); const edgeMap = new Map(edgeMeasurements.map((edge) => [edge.edgeId, edge]));
  const points = path.vertexIds.flatMap((id) => mesh.positions[id] ? [[...mesh.positions[id]] as Vec3] : []);
  if (points.length < 2) throw new Error('A margin candidate requires at least two geometry-supported points.');
  const lengthMm = pathLength(points, path.closed); const closureErrorMm = path.closed ? 0 : distance3(points[0], points.at(-1)!);
  const segments: MarginSegmentEvidence[] = [];
  const segmentCount = path.closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const sourceEdgeId = path.edgeIds[index] ?? null; const feature = sourceEdgeId === null ? undefined : edgeMap.get(sourceEdgeId);
    const previous = points[(index - 1 + points.length) % points.length]; const start = points[index]; const end = points[(index + 1) % points.length]; const next = points[(index + 2) % points.length] ?? end;
    const turn = angleBetween(subtract3(start, previous), subtract3(end, start)); const nextTurn = angleBetween(subtract3(end, start), subtract3(next, end));
    const continuity = clamp01(1 - Math.max(turn, nextTurn) / 150);
    const dihedral = feature?.dihedralDegrees ?? 0; const normalTransition = feature?.normalTransition ?? 0; const surfaceSupport = feature ? Math.min(1, feature.faceIds.length / 2) : 0;
    const classification = classifyFinishLine(dihedral, normalTransition, feature?.faceIds.map((faceId) => faceNormal(mesh, mesh.faces[faceId])) ?? [], axis);
    const confidence = clamp01(0.4 * clamp01(dihedral / 90) + 0.25 * normalTransition + 0.2 * continuity + 0.15 * surfaceSupport);
    const category: MarginConfidenceCategory = !path.closed && (index === 0 || index === segmentCount - 1) ? 'discontinuous' : confidence >= 0.78 ? 'high' : confidence >= 0.55 ? 'moderate' : confidence >= 0.32 ? 'low' : 'ambiguous';
    segments.push({
      index, start: [...start], end: [...end], sourceEdgeId, dihedralDegrees: dihedral, curvatureGradient: clamp01(dihedral / 90), normalTransition,
      surfaceSupport, gapMm: distance3(start, end), confidence, category, finishLine: classification.type,
      classificationConfidence: classification.confidence, reconstructed: false,
      explanation: `Measured ${dihedral.toFixed(2)}° dihedral, ${normalTransition.toFixed(3)} normal transition, ${continuity.toFixed(3)} continuity and ${surfaceSupport.toFixed(3)} surface support.`,
    });
  }
  const meanCurvatureEvidence = average(segments.map((segment) => segment.curvatureGradient));
  const normalTransitionEvidence = average(segments.map((segment) => segment.normalTransition));
  const continuityScore = average(segments.map((segment) => clamp01(1 - segment.gapMm / Math.max(lengthMm / Math.max(1, segmentCount) * 4, 1e-6))));
  const surfaceSupport = average(segments.map((segment) => segment.surfaceSupport));
  const missingDataPercent = path.closed ? 0 : Math.min(100, closureErrorMm / Math.max(lengthMm + closureErrorMm, 1e-9) * 100);
  const confidence = clamp01(0.3 * average(segments.map((segment) => segment.confidence)) + 0.2 * meanCurvatureEvidence + 0.15 * normalTransitionEvidence + 0.15 * continuityScore + 0.1 * surfaceSupport + 0.1 * Number(path.closed));
  const failureReasons: string[] = [];
  if (!path.closed) failureReasons.push(`Candidate is open with a ${closureErrorMm.toFixed(3)} mm unsupported gap.`);
  if (path.branching) failureReasons.push('Candidate feature topology branches and requires technician review.');
  if (surfaceSupport < 0.8) failureReasons.push('Part of the candidate lacks two-sided triangle support.');
  const ambiguousSegmentIndices = segments.filter((segment) => segment.category === 'ambiguous' || segment.category === 'low' || segment.category === 'discontinuous').map((segment) => segment.index);
  return {
    id: crypto.randomUUID(), preparationCandidateId, rank: 0, points, sourceVertexIds: [...path.vertexIds], sourceEdgeIds: [...path.edgeIds], closed: path.closed,
    lengthMm, closureErrorMm, meanCurvatureEvidence, normalTransitionEvidence, continuityScore, surfaceSupport, missingDataPercent, confidence,
    failureReasons, ambiguousSegmentIndices, segments, globalFinishLine: globalFinishLine(segments), generatedAt: new Date().toISOString(),
  };
}

export function rankMarginCandidates(values: MarginCandidate[]): MarginCandidate[] {
  return values
    .map((candidate) => structuredClone(candidate))
    .sort((first, second) => candidateScore(second) - candidateScore(first) || second.lengthMm - first.lengthMm || first.id.localeCompare(second.id))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function candidateScore(candidate: MarginCandidate): number {
  return 0.45 * candidate.confidence + 0.15 * candidate.continuityScore + 0.15 * candidate.surfaceSupport + 0.15 * Number(candidate.closed) + 0.1 * (1 - candidate.missingDataPercent / 100) - 0.05 * Number(candidate.failureReasons.length > 0);
}

export function marginVersionFromCandidate(candidate: MarginCandidate, preparationId: string, preparationVersionId: string, object: SceneObject, stage: MarginVersion['stage'] = 'automatic-candidate'): MarginVersion {
  const now = new Date().toISOString();
  const curve: SurfaceCurve = {
    id: crypto.randomUUID(), name: `Margin candidate ${candidate.rank}`, kind: 'surface-projected', objectId: object.id, artifactId: object.artifactId,
    controlPoints: candidate.points.map((point) => [...point]), sampledPoints: candidate.points.map((point) => [...point]), closed: candidate.closed, visible: true, createdAt: now, updatedAt: now,
  };
  return {
    id: crypto.randomUUID(), preparationId, parentVersionId: null, preparationVersionId, detectionEngineVersion: PREPARATION_ENGINE_VERSION, candidateSourceId: candidate.id,
    stage, curve, confidenceMeasurements: structuredClone(candidate.segments), manualAdjustments: [], quality: null, qcResultId: null, approvedAt: null, approvedBy: null, locked: false, createdAt: now,
  };
}

export function manualMarginVersion(curve: SurfaceCurve, preparationId: string, preparationVersionId: string, parentVersionId: string | null): MarginVersion {
  return {
    id: crypto.randomUUID(), preparationId, parentVersionId, preparationVersionId, detectionEngineVersion: PREPARATION_ENGINE_VERSION, candidateSourceId: null,
    stage: 'manual-modification', curve: structuredClone(curve), confidenceMeasurements: manualMarginEvidence(curve), manualAdjustments: [], quality: null,
    qcResultId: null, approvedAt: null, approvedBy: null, locked: false, createdAt: new Date().toISOString(),
  };
}

export function evaluateMarginQuality(margin: MarginVersion, artifact: ArtifactRecord, segmentationFaceIds: number[], axisInput: Vec3): MarginQualityResult {
  const curve = margin.curve; const points = curve.sampledPoints.length >= 2 ? curve.sampledPoints : curve.controlPoints; const axis = normalize3(axisInput); const mesh = indexedMesh(artifact.mesh); const triangles = meshTriangles(artifact);
  const checks: PreparationQcCheck[] = []; const defective = new Set<number>();
  const add = (id: string, status: PreparationQcCheck['status'], measuredValue: PreparationQcCheck['measuredValue'], threshold: string, ids: number[], explanation: string) => {
    ids.forEach((idValue) => defective.add(idValue)); checks.push({ id, status, measuredValue, threshold, affectedElementIds: ids.map(String), explanation });
  };
  const closure = curve.closed ? 0 : distance3(points[0], points.at(-1)!);
  add('margin.closed-loop', curve.closed && points.length >= 3 ? 'pass' : 'fail', closure, 'closed model-space loop', curve.closed ? [] : [Math.max(0, points.length - 2)], curve.closed ? 'Margin is explicitly closed.' : `Margin is open by ${closure.toFixed(3)} mm.`);
  const intersections = curveSelfIntersections(points, axis, curve.closed);
  add('margin.self-intersection', intersections.length ? 'fail' : 'pass', intersections.length, '0 crossings', intersections.flat(), intersections.length ? 'Projected margin segments cross.' : 'No non-adjacent segment crossing was found.');
  const duplicateSegments = duplicateSegmentIndices(points, curve.closed);
  add('margin.duplicate-segments', duplicateSegments.length ? 'fail' : 'pass', duplicateSegments.length, '0 duplicate segments', duplicateSegments, duplicateSegments.length ? 'Repeated geometric segments were found.' : 'Segments are unique.');
  const spikes = sharpSpikeIndices(points, curve.closed, 22);
  add('margin.sharp-spikes', spikes.length ? 'fail' : 'pass', spikes.length, 'interior turn >= 22°', spikes, spikes.length ? 'Margin contains sharp reversal spikes.' : 'No sharp reversal spike was found.');
  const discontinuities = curvatureDiscontinuityIndices(points, curve.closed, 115);
  add('margin.curvature-discontinuity', discontinuities.length ? 'warning' : 'pass', discontinuities.length, 'turn <= 115°', discontinuities, discontinuities.length ? 'Abrupt local direction changes require review.' : 'Local direction changes remain continuous.');
  const detached = points.flatMap((point, index) => { const closest = closestPointOnMesh(point, triangles); return !closest || closest.distance > 0.15 ? [index] : []; });
  add('margin.surface-detachment', detached.length ? 'fail' : 'pass', detached.length, '<= 0.15 mm from source surface', detached, detached.length ? 'Control or sampled points detach from source geometry.' : 'Every margin point remains surface supported.');
  const missing = margin.confidenceMeasurements.filter((segment) => segment.reconstructed || ['reconstructed-missing-data', 'discontinuous'].includes(segment.category)).map((segment) => segment.index);
  add('margin.missing-geometry', missing.length ? 'warning' : 'pass', missing.length, '0 unverified segments', missing, missing.length ? 'One or more margin sections cross missing or reconstructed geometry.' : 'All margin sections retain direct geometry support.');
  const lengths = segmentLengths(points, curve.closed); const medianLength = medianValue(lengths); const jumps = lengths.flatMap((value, index) => value > Math.max(2, medianLength * 5) ? [index] : []);
  add('margin.implausible-jump', jumps.length ? 'fail' : 'pass', jumps.length, `<= max(2 mm, 5× median ${medianLength.toFixed(3)} mm)`, jumps, jumps.length ? 'Implausibly long local jumps were found.' : 'No implausible local jump was found.');
  const signedArea = polygonSignedArea(points, axis); const orientation = Math.abs(signedArea) < 1e-9 ? 'indeterminate' : signedArea > 0 ? 'counter-clockwise' : 'clockwise';
  add('margin.loop-orientation', orientation === 'indeterminate' ? 'fail' : 'pass', orientation, 'determinable orientation', orientation === 'indeterminate' ? [0] : [], orientation === 'indeterminate' ? 'Loop orientation cannot be determined.' : `Loop orientation is ${orientation}.`);
  add('margin.multiple-loops', 'pass', 1, 'exactly 1 loop', [], 'This version owns one explicit margin loop.');
  const segmentationCentroids = segmentationFaceIds.flatMap((faceId) => mesh.faces[faceId] ? [faceCentroid(mesh, mesh.faces[faceId])] : []);
  const enclosureRatio = segmentationCentroids.length ? segmentationCentroids.filter((point) => pointInMargin(point, points, axis)).length / segmentationCentroids.length : 0;
  const enclosureStatus = segmentationCentroids.length && enclosureRatio >= 0.5 ? 'pass' : 'fail';
  add('margin.preparation-enclosure', enclosureStatus, enclosureRatio, '>= 0.5 segmented face centroids enclosed in axial projection', enclosureStatus === 'pass' ? [] : [0], enclosureStatus === 'pass' ? 'Margin encloses the measured preparation region in axial projection.' : 'Margin does not enclose enough of the preparation segmentation.');
  const ambiguous = margin.confidenceMeasurements.filter((segment) => ['low', 'ambiguous', 'discontinuous', 'reconstructed-missing-data'].includes(segment.category)).map((segment) => segment.index);
  add('margin.local-boundary-ambiguity', ambiguous.length ? 'warning' : 'pass', ambiguous.length, '0 low-support regions', ambiguous, ambiguous.length ? 'Low-support margin regions require technician review.' : 'No low-support margin region was recorded.');
  return { valid: !checks.some((check) => check.status === 'fail'), checks, defectiveSegmentIndices: [...defective].sort((a, b) => a - b), orientation, enclosureRatio };
}

export function snapMarginPoint(
  point: Vec3,
  artifact: ArtifactRecord,
  options: { enabled: boolean; strength: number; searchRadiusMm: number; curvatureWeight: number; surfaceNormalWeight: number; smoothing: number },
  sources: { featurePoints?: Vec3[]; candidatePoints?: Vec3[]; userAnchors?: Vec3[] } = {},
): { point: Vec3; target: 'surface' | 'feature' | 'candidate' | 'anchor' | 'none'; distanceMm: number } {
  if (!options.enabled) return { point: [...point], target: 'none', distanceMm: 0 };
  const triangles = meshTriangles(artifact); const surface = closestPointOnMesh(point, triangles); const candidates: Array<{ point: Vec3; target: 'surface' | 'feature' | 'candidate' | 'anchor'; distance: number; weight: number }> = [];
  if (surface && surface.distance <= options.searchRadiusMm) candidates.push({ point: surface.point, target: 'surface', distance: surface.distance, weight: 0.4 + options.surfaceNormalWeight });
  const add = (values: Vec3[] | undefined, target: 'feature' | 'candidate' | 'anchor', weight: number) => {
    if (!values?.length) return; const nearest = values.map((value) => ({ value, distance: distance3(point, value) })).sort((a, b) => a.distance - b.distance)[0];
    if (nearest.distance <= options.searchRadiusMm) candidates.push({ point: nearest.value, target, distance: nearest.distance, weight });
  };
  add(sources.featurePoints, 'feature', 0.5 + options.curvatureWeight); add(sources.candidatePoints, 'candidate', 0.75); add(sources.userAnchors, 'anchor', 1.25);
  const selected = candidates.sort((first, second) => first.distance / Math.max(first.weight, 1e-6) - second.distance / Math.max(second.weight, 1e-6))[0];
  if (!selected) return { point: [...point], target: 'none', distanceMm: 0 };
  const strength = clamp01(options.strength * selected.weight); return { point: point.map((value, index) => value + (selected.point[index] - value) * strength) as Vec3, target: selected.target, distanceMm: selected.distance };
}

export function approveMarginVersion(margin: MarginVersion, userId: string | null, qcFailureCount: number): MarginVersion {
  if (!margin.quality?.valid) throw new Error('An invalid margin cannot be approved. Run margin quality and repair every failure first.');
  if (qcFailureCount > 0) throw new Error(`Margin approval is blocked by ${qcFailureCount} Preparation QC failure${qcFailureCount === 1 ? '' : 's'}.`);
  return { ...structuredClone(margin), id: crypto.randomUUID(), parentVersionId: margin.id, stage: 'approved', approvedAt: new Date().toISOString(), approvedBy: userId, locked: false, createdAt: new Date().toISOString() };
}

export function lockMarginVersion(margin: MarginVersion, locked: boolean): MarginVersion {
  if (locked && margin.stage !== 'approved' && margin.stage !== 'locked') throw new Error('Only an approved margin can be locked.');
  return { ...structuredClone(margin), id: crypto.randomUUID(), parentVersionId: margin.id, stage: locked ? 'locked' : 'manual-modification', locked, createdAt: new Date().toISOString() };
}

export function compareMarginVersions(first: MarginVersion, second: MarginVersion): { meanDistanceMm: number; maximumDistanceMm: number; lengthChangeMm: number; changedPointCount: number } {
  const a = first.curve.sampledPoints; const b = second.curve.sampledPoints; if (!a.length || !b.length) throw new Error('Margin comparison requires sampled geometry in both versions.');
  const distances = a.map((point) => closestCurveDistance(point, b, second.curve.closed));
  return { meanDistanceMm: average(distances), maximumDistanceMm: Math.max(...distances), lengthChangeMm: pathLength(b, second.curve.closed) - pathLength(a, first.curve.closed), changedPointCount: distances.filter((distance) => distance > 1e-6).length };
}

function classifyFinishLine(dihedral: number, normalTransition: number, normals: Vec3[], axis: Vec3): { type: FinishLineClassification; confidence: number } {
  const axisComponents = normals.map((normal) => Math.abs(dot3(normalize3(normal), axis))); const spread = axisComponents.length ? Math.max(...axisComponents) - Math.min(...axisComponents) : 0;
  let type: FinishLineClassification = 'indeterminate'; let center = 0;
  if (dihedral >= 105) { type = 'beveled-shoulder'; center = 120; }
  else if (dihedral >= 82 && spread >= 0.45) { type = 'shoulder'; center = 90; }
  else if (dihedral >= 70 && normalTransition >= 0.28) { type = 'radial-shoulder'; center = 75; }
  else if (dihedral >= 54) { type = 'heavy-chamfer'; center = 62; }
  else if (dihedral >= 30) { type = 'chamfer'; center = 43; }
  else if (dihedral >= 14) { type = 'knife-edge'; center = 21; }
  else if (dihedral >= 4) { type = 'feather-edge'; center = 9; }
  const confidence = type === 'indeterminate' ? clamp01(dihedral / 16) * 0.35 : clamp01(1 - Math.abs(dihedral - center) / Math.max(center, 15)) * (0.65 + 0.35 * clamp01(normalTransition + spread));
  return { type, confidence };
}

function globalFinishLine(segments: MarginSegmentEvidence[]): FinishLineClassification {
  const supported = segments.filter((segment) => segment.finishLine !== 'indeterminate' && segment.classificationConfidence >= 0.35); if (!supported.length) return 'indeterminate';
  const counts = new Map<FinishLineClassification, number>(); supported.forEach((segment) => counts.set(segment.finishLine, (counts.get(segment.finishLine) ?? 0) + 1));
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]); return ordered[0][1] / supported.length >= 0.7 ? ordered[0][0] : 'hybrid-mixed';
}

export function manualMarginEvidence(curve: SurfaceCurve): MarginSegmentEvidence[] {
  const points = curve.sampledPoints.length >= 2 ? curve.sampledPoints : curve.controlPoints; const count = curve.closed ? points.length : points.length - 1;
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({ index, start: [...points[index]], end: [...points[(index + 1) % points.length]], sourceEdgeId: null, dihedralDegrees: 0, curvatureGradient: 0, normalTransition: 0, surfaceSupport: 1, gapMm: distance3(points[index], points[(index + 1) % points.length]), confidence: 0, category: 'ambiguous', finishLine: 'indeterminate', classificationConfidence: 0, reconstructed: false, explanation: 'Manually authored segment has no automatic finish-line confidence until re-analysis.' }));
}

function duplicateSegmentIndices(points: Vec3[], closed: boolean): number[] {
  const seen = new Map<string, number>(); const duplicates: number[] = []; const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) { const first = quantized(points[index]), second = quantized(points[(index + 1) % points.length]); const key = [first, second].sort().join('|'); if (seen.has(key)) duplicates.push(index); else seen.set(key, index); }
  return duplicates;
}

function sharpSpikeIndices(points: Vec3[], closed: boolean, minimumDegrees: number): number[] {
  return points.flatMap((point, index) => {
    if (!closed && (index === 0 || index === points.length - 1)) return [];
    const previous = points[(index - 1 + points.length) % points.length], next = points[(index + 1) % points.length]; const angle = angleBetween(subtract3(previous, point), subtract3(next, point)); return angle < minimumDegrees ? [index] : [];
  });
}

function curvatureDiscontinuityIndices(points: Vec3[], closed: boolean, maximumTurnDegrees: number): number[] {
  return points.flatMap((point, index) => { if (!closed && (index === 0 || index === points.length - 1)) return []; const previous = points[(index - 1 + points.length) % points.length], next = points[(index + 1) % points.length]; const turn = 180 - angleBetween(subtract3(previous, point), subtract3(next, point)); return turn > maximumTurnDegrees ? [index] : []; });
}

function segmentLengths(points: Vec3[], closed: boolean): number[] { const count = closed ? points.length : points.length - 1; return Array.from({ length: Math.max(0, count) }, (_, index) => distance3(points[index], points[(index + 1) % points.length])); }
function medianValue(values: number[]): number { const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return 0; const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function quantized(point: Vec3): string { return point.map((value) => Math.round(value * 1e6)).join(':'); }
function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
