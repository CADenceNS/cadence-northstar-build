import type { ArtifactRecord, MeshData, Vec3 } from './core';
import { analyzeSelfIntersections, buildTopology, faceArea, faceCentroid, faceNormal, indexedMesh, type IndexedMesh } from './editing-geometry';
import { boundsOfPoints, closestPointOnMesh, cross3, distance3, dot3, meshTriangles, normalize3, scale3, subtract3 } from './geometry';
import { buildMarginCandidate, evaluateMarginQuality, rankMarginCandidates } from './margin-engine';
import {
  PREPARATION_ENGINE_VERSION,
  type AxisCandidate,
  type InsertionAxisAnalysis,
  type MarginCandidate,
  type PreparationAnalysisProgress,
  type PreparationAnalysisRequest,
  type PreparationAnalysisResponse,
  type PreparationCandidate,
  type PreparationDetectionMeasurements,
  type PreparationDetectionState,
  type PreparationKind,
  type PreparationMeasurements,
  type PreparationRecord,
  type PreparationSegmentation,
} from './preparation-types';
import {
  angleBetween,
  axialHeight,
  clamp01,
  dentalBasis,
  dilateFaces,
  erodeFaces,
  featureEdges,
  marginRegionFaces,
  meanPoint,
  median,
  orderFeaturePaths,
  pathLength,
  percentile,
  radialDistance,
  segmentationBoundaryEdges,
} from './preparation-geometry';
import { runPreparationQc } from './preparation-qc';

export interface PreparationExecutionHooks {
  signal?: AbortSignal;
  progress?: (progress: PreparationAnalysisProgress) => void;
  yieldControl?: () => Promise<void>;
}

export async function executePreparationAnalysis(request: PreparationAnalysisRequest, hooks: PreparationExecutionHooks = {}): Promise<PreparationAnalysisResponse> {
  const started = performance.now(); const yieldControl = hooks.yieldControl ?? (() => Promise.resolve());
  const progress = (stage: string, completed: number, total: number, message: string) => hooks.progress?.({ requestId: request.requestId, stage, completed, total, message });
  assertActive(hooks.signal); progress('preflight', 0, 5, 'Validating dental geometry and topology');
  const mesh = indexedMesh(request.mesh); await yieldControl(); assertActive(hooks.signal);
  if (request.mode === 'detect-preparations') {
    progress('feature-extraction', 1, 5, 'Measuring curvature and surface-normal transitions');
    const candidates = detectPreparationCandidates(mesh, request.artifactId, request.sceneObjectId, request.dentalAxis);
    await yieldControl(); assertActive(hooks.signal); progress('ranking', 4, 5, `Ranked ${candidates.length} preparation result${candidates.length === 1 ? '' : 's'}`);
    return { requestId: request.requestId, candidates, durationMs: performance.now() - started };
  }
  if (!request.preparation || !request.segmentation) throw new Error(`${request.mode} requires an identified preparation and segmentation.`);
  if (request.mode === 'detect-margins') {
    progress('margin-feature-extraction', 1, 5, 'Extracting finish-line feature paths');
    const marginCandidates = detectMarginsForPreparation(mesh, request.preparation, request.segmentation, request.dentalAxis);
    await yieldControl(); assertActive(hooks.signal); progress('margin-ranking', 4, 5, `Ranked ${marginCandidates.length} geometry-supported margin candidate${marginCandidates.length === 1 ? '' : 's'}`);
    return { requestId: request.requestId, marginCandidates, durationMs: performance.now() - started };
  }
  if (request.mode === 'analyze-axis') {
    progress('axis-search', 1, 5, 'Evaluating insertion-axis candidates and undercuts');
    const axis = analyzeInsertionAxis(mesh, request.preparation, request.segmentation, request.dentalAxis, request.manualAxis);
    await yieldControl(); assertActive(hooks.signal); progress('axis-complete', 4, 5, 'Insertion-axis evidence calculated');
    return { requestId: request.requestId, axis, durationMs: performance.now() - started };
  }
  progress('measurements', 1, 5, 'Calculating preparation measurements');
  const margin = request.margin; const measurements = calculatePreparationMeasurements(mesh, request.preparation, request.segmentation, request.dentalAxis, margin?.curve.sampledPoints ?? [], request.preoperativeMesh, request.antagonistMesh, request.adjacentMeshes);
  const artifact = artifactFromRequest(request);
  const marginQuality = margin ? evaluateMarginQuality(margin, artifact, request.segmentation.faceIds, request.dentalAxis) : null;
  const qc = runPreparationQc(request.preparation, measurements, margin, marginQuality, request.materialRuleId ?? request.preparation.materialRuleId, mesh);
  await yieldControl(); assertActive(hooks.signal); progress('qc-complete', 5, 5, `Preparation QC ${qc.overall}`);
  return { requestId: request.requestId, measurements, ...(marginQuality ? { marginQuality } : {}), qc, durationMs: performance.now() - started };
}

export function detectPreparationCandidates(mesh: IndexedMesh, artifactId: string, sceneObjectId: string, dentalAxisInput: Vec3): PreparationCandidate[] {
  const now = new Date().toISOString(); const axis = normalizedAxis(dentalAxisInput); const topology = buildTopology(mesh); const bounds = boundsOfPoints(mesh.positions);
  const dimensions = bounds ? subtract3(bounds.max, bounds.min) : [0, 0, 0] as Vec3; const area = mesh.faces.reduce((sum, face) => sum + faceArea(mesh, face), 0);
  const baseMeasurements: PreparationDetectionMeasurements = {
    vertexCount: mesh.positions.length, triangleCount: mesh.faces.length, finiteCoordinateRatio: mesh.positions.length ? mesh.positions.filter((point) => point.every(Number.isFinite)).length / mesh.positions.length : 0,
    surfaceAreaMm2: area, boundingDimensionsMm: dimensions, candidateFeatureEdgeCount: 0, candidateLoopCount: 0, localHeightMm: Math.max(...dimensions), wallNormalDispersion: 1,
    taperDegrees: null, topologyBoundaryEdgeCount: topology.boundaryEdges.length, topologyNonManifoldEdgeCount: topology.nonManifoldEdges.length,
  };
  if (!mesh.positions.length || !mesh.faces.length) return [sentinelCandidate('INSUFFICIENT_GEOMETRY', artifactId, sceneObjectId, baseMeasurements, 'Mesh contains no analyzable triangles.', now)];
  if (baseMeasurements.finiteCoordinateRatio < 1) return [sentinelCandidate('UNSUPPORTED', artifactId, sceneObjectId, baseMeasurements, 'Mesh contains invalid or non-finite model coordinates.', now)];
  const maximumDimension = Math.max(...dimensions); const minimumPositive = Math.min(...dimensions.filter((value) => value > 1e-9));
  if (!Number.isFinite(maximumDimension) || maximumDimension > 300 || minimumPositive < 0.05) return [sentinelCandidate('UNSUPPORTED', artifactId, sceneObjectId, baseMeasurements, `Geometry scale ${dimensions.map((value) => value.toFixed(3)).join(' × ')} mm is outside supported dental analysis bounds.`, now)];
  if (topology.nonManifoldEdges.length) return [sentinelCandidate('UNSUPPORTED', artifactId, sceneObjectId, baseMeasurements, `${topology.nonManifoldEdges.length} non-manifold edges block automatic preparation analysis.`, now)];
  const duplicateFaces = duplicateFaceCount(mesh);
  if (duplicateFaces) return [sentinelCandidate('UNSUPPORTED', artifactId, sceneObjectId, baseMeasurements, `${duplicateFaces} duplicate triangles block automatic preparation analysis.`, now)];
  const intersections = analyzeSelfIntersections(mesh);
  if (intersections.length) return [sentinelCandidate('UNSUPPORTED', artifactId, sceneObjectId, baseMeasurements, `${intersections.length} self-intersecting triangle pairs block automatic preparation analysis.`, now)];
  const signedVolume = topology.boundaryEdges.length === 0 ? mesh.faces.reduce((sum, face) => sum + dot3(mesh.positions[face[0]], cross3(mesh.positions[face[1]], mesh.positions[face[2]])) / 6, 0) : null;
  if (signedVolume !== null && signedVolume < -1e-9) return [sentinelCandidate('UNSUPPORTED', artifactId, sceneObjectId, baseMeasurements, 'Closed geometry has reversed orientation consistent with a mirrored or inward-wound scan.', now)];

  const features = featureEdges(mesh, axis, 4); const paths = orderFeaturePaths(features).filter((path) => path.vertexIds.length >= 4);
  baseMeasurements.candidateFeatureEdgeCount = features.length; baseMeasurements.candidateLoopCount = paths.length;
  if (!paths.length) return [sentinelCandidate('MANUAL_IDENTIFICATION_REQUIRED', artifactId, sceneObjectId, baseMeasurements, 'No continuous curvature/normal-transition finish-line feature was supported by the geometry.', now)];
  const globalHeights = mesh.positions.map((point) => dot3(point, axis)); const lowerFeatureHeight = percentile(globalHeights, 25); const upperFeatureHeight = percentile(globalHeights, 76);
  const rawMargins = paths.map((path) => buildMarginCandidate('unassigned', meshDataView(mesh), path, features, axis)).filter((candidate) => {
    const height = median(candidate.points.map((point) => dot3(point, axis)));
    return candidate.lengthMm > Math.max(0.5, maximumDimension * 0.02) && height > lowerFeatureHeight + 1e-6 && height < upperFeatureHeight - 1e-6;
  });
  const groups = clusterMarginCandidates(rawMargins);
  if (!groups.length) return [sentinelCandidate('MANUAL_IDENTIFICATION_REQUIRED', artifactId, sceneObjectId, baseMeasurements, 'Extracted surface features did not form a preparation-sized boundary.', now)];
  let candidates: PreparationCandidate[] = groups.map((group, index) => {
    const id = crypto.randomUUID(); const margins = rankMarginCandidates(group.map((margin) => ({ ...margin, preparationCandidateId: id }))).slice(0, 3); const primary = margins[0];
    const faceIds = marginRegionFaces(mesh, primary.points, axis); const localPoints = faceIds.flatMap((faceId) => mesh.faces[faceId]?.map((vertex) => mesh.positions[vertex]) ?? []); const localBounds = boundsOfPoints(localPoints);
    const height = localBounds ? axialRange(localPoints, axis) : 0; const wallNormals = faceIds.map((faceId) => faceNormal(mesh, mesh.faces[faceId])).filter((normal) => Math.abs(dot3(normal, axis)) < 0.8);
    const wallNormalDispersion = normalDispersion(wallNormals); const taper = taperFromNormals(wallNormals, axis); const confidence = clamp01(primary.confidence * (faceIds.length ? 1 : 0.4) * (1 - Math.min(0.4, wallNormalDispersion * 0.2)));
    const ambiguityReasons = [...primary.failureReasons]; if (topology.boundaryEdges.length) ambiguityReasons.push(`Source geometry contains ${topology.boundaryEdges.length} open boundary edges; automatic preparation acceptance requires technician review.`); if (margins[1] && Math.abs(primary.confidence - margins[1].confidence) < 0.08) ambiguityReasons.push('Two margin candidates have similar measured support.'); if (!faceIds.length) ambiguityReasons.push('Candidate boundary did not isolate an axial preparation region.');
    const kind = inferPreparationKind(primary, height); const state = detectionState(confidence, margins, ambiguityReasons);
    return {
      id, artifactId, sceneObjectId, shellIndex: nearestShellIndex(mesh, topology.shells, faceIds), name: `Preparation ${index + 1}`, toothPosition: measuredToothPosition(meanPoint(primary.points), bounds, axis), kind, state,
      faceIds, boundaryVertexIds: [...primary.sourceVertexIds], proposedInsertionAxis: proposeAxis(mesh, faceIds, primary.points, axis),
      measurements: { ...baseMeasurements, localHeightMm: height, wallNormalDispersion, taperDegrees: taper }, marginCandidates: margins, ambiguityReasons, confidence, createdAt: now,
    } satisfies PreparationCandidate;
  });
  candidates = removeConcentricDuplicatePreparations(candidates, axis);
  if (candidates.length > 1) candidates = candidates.map((candidate) => ({ ...candidate, state: candidate.state === 'INSUFFICIENT_GEOMETRY' || candidate.state === 'UNSUPPORTED' ? candidate.state : 'MULTIPLE_CANDIDATES' }));
  return candidates.sort((first, second) => second.confidence - first.confidence || first.id.localeCompare(second.id));
}

export function detectMarginsForPreparation(mesh: IndexedMesh, preparation: PreparationRecord, segmentation: PreparationSegmentation, axisInput: Vec3): MarginCandidate[] {
  const axis = normalizedAxis(axisInput); const features = featureEdges(mesh, axis, 4); const paths = orderFeaturePaths(features).filter((path) => path.vertexIds.length >= 3); const selectedFaces = new Set(segmentation.faceIds); const topology = buildTopology(mesh); const selectedVertexIds = new Set(segmentation.faceIds.flatMap((faceId) => mesh.faces[faceId] ?? [])); const selectedHeights = [...selectedVertexIds].map((vertexId) => dot3(mesh.positions[vertexId], axis)); const lowestSelectedHeight = Math.min(...selectedHeights); const selectedHeightRange = Math.max(...selectedHeights) - lowestSelectedHeight; const marginBandCeiling = lowestSelectedHeight + Math.max(0.5, selectedHeightRange * 0.25);
  const margins = paths.flatMap((path) => {
    const pathHeight = median(path.vertexIds.flatMap((vertexId) => mesh.positions[vertexId] ? [dot3(mesh.positions[vertexId], axis)] : [])); if (pathHeight > marginBandCeiling + 1e-6) return [];
    const supportedFaces = path.edgeIds.flatMap((edgeId) => topology.edgeFaces[edgeId] ?? []); if (!supportedFaces.some((faceId) => selectedFaces.has(faceId))) return [];
    const candidate = buildMarginCandidate(preparation.candidateId ?? preparation.id, meshDataView(mesh), path, features, axis); const center = meanPoint(candidate.points);
    const prepCentroids = segmentation.faceIds.flatMap((faceId) => mesh.faces[faceId] ? [faceCentroid(mesh, mesh.faces[faceId])] : []); const prepCenter = meanPoint(prepCentroids);
    const distance = radialDistance(center, prepCenter, axis); const radius = average(candidate.points.map((point) => radialDistance(point, center, axis)));
    return distance <= Math.max(radius * 1.5, 2) ? [candidate] : [];
  });
  return rankMarginCandidates(margins).slice(0, 3);
}

export function createPreparationRecord(candidate: PreparationCandidate, overrides: Partial<Pick<PreparationRecord, 'name' | 'toothNumber' | 'kind' | 'materialRuleId'>> = {}): PreparationRecord {
  if (['INSUFFICIENT_GEOMETRY', 'UNSUPPORTED'].includes(candidate.state)) throw new Error(`Cannot identify a preparation from ${candidate.state.toLowerCase().replaceAll('_', ' ')}.`);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), candidateId: candidate.id, sceneObjectId: candidate.sceneObjectId, artifactId: candidate.artifactId, name: overrides.name ?? candidate.name,
    toothNumber: overrides.toothNumber ?? null, kind: overrides.kind ?? candidate.kind, segmentationVersionIds: [], activeSegmentationVersionId: null,
    insertionAxisAnalysisIds: [], activeInsertionAxisAnalysisId: null, marginVersionIds: [], activeMarginVersionId: null, approvedMarginVersionId: null,
    materialRuleId: overrides.materialRuleId ?? 'generic-ceramic-crown', measurements: null, qcResultIds: [], createdAt: now, updatedAt: now,
  };
}

export function automaticSegmentation(candidate: PreparationCandidate, artifact: ArtifactRecord, version = 1): PreparationSegmentation {
  if (!candidate.faceIds.length) throw new Error('Automatic segmentation has no geometry-supported preparation faces.'); const mesh = indexedMesh(artifact.mesh); const now = new Date().toISOString();
  return { id: crypto.randomUUID(), version, preparationId: '', artifactId: artifact.id, sceneObjectId: candidate.sceneObjectId, faceIds: [...candidate.faceIds], boundaryEdgeIds: segmentationBoundaryEdges(mesh, candidate.faceIds), excludedFaceIds: [], source: 'automatic', locked: false, approvedAt: null, parentVersionId: null, createdAt: now };
}

export function manualSegmentation(preparationId: string, artifact: ArtifactRecord, sceneObjectId: string, faceIds: number[], parent?: PreparationSegmentation): PreparationSegmentation {
  const mesh = indexedMesh(artifact.mesh); const unique = [...new Set(faceIds)].sort((a, b) => a - b); if (!unique.length) throw new Error('Manual preparation identification requires selected mesh faces.'); if (unique.some((id) => !mesh.faces[id])) throw new Error('Manual preparation selection contains an invalid face identifier.');
  return { id: crypto.randomUUID(), version: (parent?.version ?? 0) + 1, preparationId, artifactId: artifact.id, sceneObjectId, faceIds: unique, boundaryEdgeIds: segmentationBoundaryEdges(mesh, unique), excludedFaceIds: parent?.excludedFaceIds ?? [], source: 'manual', locked: false, approvedAt: null, parentVersionId: parent?.id ?? null, createdAt: new Date().toISOString() };
}

export function refineSegmentation(segmentation: PreparationSegmentation, artifact: ArtifactRecord, operation: 'grow' | 'shrink' | 'exclude-neighbors', rings = 1): PreparationSegmentation {
  if (segmentation.locked) throw new Error('Approved preparation segmentation must be unlocked before refinement.'); const mesh = indexedMesh(artifact.mesh); let faceIds = operation === 'grow' ? dilateFaces(mesh, segmentation.faceIds, rings) : operation === 'shrink' ? erodeFaces(mesh, segmentation.faceIds, rings) : [...segmentation.faceIds];
  if (operation === 'exclude-neighbors') { const components = connectedSelectedComponents(mesh, faceIds); faceIds = components.sort((a, b) => b.length - a.length)[0] ?? []; }
  if (!faceIds.length) throw new Error('Segmentation refinement would remove the entire preparation region.');
  return { ...structuredClone(segmentation), id: crypto.randomUUID(), version: segmentation.version + 1, parentVersionId: segmentation.id, faceIds, boundaryEdgeIds: segmentationBoundaryEdges(mesh, faceIds), source: 'refined', locked: false, approvedAt: null, createdAt: new Date().toISOString() };
}

export function setSegmentationLock(segmentation: PreparationSegmentation, locked: boolean): PreparationSegmentation {
  if (locked && !segmentation.faceIds.length) throw new Error('An empty preparation segmentation cannot be approved.');
  return { ...structuredClone(segmentation), id: crypto.randomUUID(), version: segmentation.version + 1, parentVersionId: segmentation.id, locked, approvedAt: locked ? new Date().toISOString() : null, createdAt: new Date().toISOString() };
}

export function analyzeInsertionAxis(mesh: IndexedMesh, preparation: PreparationRecord, segmentation: PreparationSegmentation, dentalAxisInput: Vec3, manualAxis?: Vec3): InsertionAxisAnalysis {
  if (!segmentation.faceIds.length) throw new Error('Insertion-axis analysis requires a non-empty preparation segmentation.'); const dentalAxis = normalizedAxis(dentalAxisInput); const proposed = manualAxis ? normalizedAxis(manualAxis) : proposeAxis(mesh, segmentation.faceIds, [], dentalAxis); const basis = dentalBasis(proposed);
  const directions: Vec3[] = [proposed]; for (const degrees of [5, -5, 10, -10]) { const tangent = degrees > 0 ? basis.u : basis.v; const radians = Math.abs(degrees) * Math.PI / 180; directions.push(normalize3([proposed[0] * Math.cos(radians) + tangent[0] * Math.sin(radians), proposed[1] * Math.cos(radians) + tangent[1] * Math.sin(radians), proposed[2] * Math.cos(radians) + tangent[2] * Math.sin(radians)])); }
  const candidates = directions.map((direction) => evaluateAxis(mesh, segmentation.faceIds, direction)); candidates.sort((a, b) => Number(b.valid) - Number(a.valid) || b.visibilityScore - a.visibilityScore || a.undercutDepthMm - b.undercutDepthMm);
  return { id: crypto.randomUUID(), preparationId: preparation.id, segmentationVersionId: segmentation.id, selectedAxis: [...candidates[0].direction], candidates, locked: false, source: manualAxis ? 'manual' : 'automatic', analyzedAt: new Date().toISOString() };
}

export function setInsertionAxis(axis: InsertionAxisAnalysis, direction: Vec3, locked = axis.locked): InsertionAxisAnalysis {
  if (axis.locked && direction.some((value, index) => Math.abs(value - axis.selectedAxis[index]) > 1e-9)) throw new Error('Insertion axis is locked.'); const normalized = normalizedAxis(direction);
  return { ...structuredClone(axis), id: crypto.randomUUID(), selectedAxis: normalized, source: 'manual', locked, analyzedAt: new Date().toISOString() };
}

export function sharedBridgeAxis(analyses: InsertionAxisAnalysis[]): { commonAxis: Vec3 | null; conflict: boolean; conflictDegrees: number | null } {
  if (analyses.length < 2) throw new Error('Shared bridge path-of-draw analysis requires at least two preparation axes.'); const axes = analyses.map((analysis) => analysis.selectedAxis); let maximum = 0; for (let first = 0; first < axes.length; first += 1) for (let second = first + 1; second < axes.length; second += 1) maximum = Math.max(maximum, angleBetween(axes[first], axes[second]));
  const mean = normalize3(axes.reduce<Vec3>((sum, axis) => [sum[0] + axis[0], sum[1] + axis[1], sum[2] + axis[2]], [0, 0, 0])); return { commonAxis: maximum <= 12 ? mean : null, conflict: maximum > 12, conflictDegrees: maximum };
}

export function calculatePreparationMeasurements(mesh: IndexedMesh, preparation: PreparationRecord, segmentation: PreparationSegmentation, axisInput: Vec3, marginPoints: Vec3[], preoperativeMesh?: MeshData, antagonistMesh?: MeshData, adjacentMeshes: MeshData[] = []): PreparationMeasurements {
  const axis = normalizedAxis(axisInput); const faces = segmentation.faceIds.flatMap((faceId) => mesh.faces[faceId] ? [mesh.faces[faceId]] : []); if (!faces.length) throw new Error('Preparation measurements require segmented triangle geometry.');
  const vertices = [...new Set(faces.flat())].map((id) => mesh.positions[id]); const center = meanPoint(vertices); const heights = vertices.map((point) => axialHeight(point, axis, center)); const heightMm = Math.max(...heights) - Math.min(...heights); const widthMm = Math.max(...vertices.map((point) => radialDistance(point, center, axis))) * 2;
  const wallNormals = faces.map((face) => faceNormal(mesh, face)).filter((normal) => Math.abs(dot3(normal, axis)) < 0.85); const convergenceDegrees = taperFromNormals(wallNormals, axis); const area = faces.reduce((sum, face) => sum + faceArea(mesh, face), 0); const topology = buildTopology(mesh);
  const boundaryEdges = segmentationBoundaryEdges(mesh, segmentation.faceIds); const boundaryLengths = boundaryEdges.map((id) => { const edge = topology.edges[id]; return distance3(mesh.positions[edge[0]], mesh.positions[edge[1]]); });
  const localRadii = topology.edges.flatMap((edge, id) => topology.edgeFaces[id].some((faceId) => segmentation.faceIds.includes(faceId)) ? [distance3(mesh.positions[edge[0]], mesh.positions[edge[1]]) / 2] : []);
  const sharpInternalFeatureCount = topology.edges.filter((_, id) => topology.edgeFaces[id].length === 2 && topology.edgeFaces[id].every((faceId) => segmentation.faceIds.includes(faceId)) && angleBetween(faceNormal(mesh, mesh.faces[topology.edgeFaces[id][0]]), faceNormal(mesh, mesh.faces[topology.edgeFaces[id][1]])) > 105).length;
  let reductions: number[] = []; let reductionMap: PreparationMeasurements['preoperativeReductionMap'] = [];
  if (preoperativeMesh) { const preoperativeTriangles = meshTriangles(artifactForMesh(preoperativeMesh)); reductionMap = sample(vertices, 512).flatMap((point) => { const closest = closestPointOnMesh(point, preoperativeTriangles); return closest ? [{ position: [...point], reductionMm: closest.distance }] : []; }); reductions = reductionMap.map((value) => value.reductionMm); }
  const averageReduction = reductions.length ? average(reductions) : null; const maximumHeight = Math.max(...heights); const occlusalPoints = vertices.filter((_, index) => heights[index] >= maximumHeight - Math.max(0.2, heightMm * 0.2));
  const occlusalReduction = preoperativeMesh && occlusalPoints.length ? average(occlusalPoints.flatMap((point) => { const closest = closestPointOnMesh(point, meshTriangles(artifactForMesh(preoperativeMesh))); return closest ? [closest.distance] : []; })) : null;
  return {
    preparationId: preparation.id, occlusalReductionMm: occlusalReduction, axialReductionMm: averageReduction, incisalReductionMm: preparation.kind === 'veneer' ? occlusalReduction : null,
    buccalReductionMm: averageReduction, lingualReductionMm: averageReduction, proximalReductionMm: averageReduction, heightMm, widthMm, surfaceAreaMm2: area,
    convergenceDegrees, undercutDepthMm: evaluateAxis(mesh, segmentation.faceIds, axis).undercutDepthMm, marginCircumferenceMm: marginPoints.length >= 2 ? pathLength(marginPoints, true) : null,
    finishLineWidthMm: boundaryLengths.length ? median(boundaryLengths) : null, minimumLocalRadiusMm: localRadii.length ? Math.min(...localRadii) : null,
    sharpInternalFeatureCount, antagonistClearanceMm: antagonistMesh ? minimumVertexClearance(vertices, antagonistMesh) : null, adjacentClearanceMm: adjacentMeshes.length ? Math.min(...adjacentMeshes.map((value) => minimumVertexClearance(vertices, value))) : null, preoperativeReferenceAvailable: Boolean(preoperativeMesh), preoperativeReductionSamplesMm: reductions, preoperativeReductionMap: reductionMap,
  };
}

function evaluateAxis(mesh: IndexedMesh, faceIds: number[], directionInput: Vec3): AxisCandidate {
  const direction = normalizedAxis(directionInput); const topology = buildTopology(mesh); const faceSet = new Set(faceIds); const faces = faceIds.flatMap((faceId) => mesh.faces[faceId] ? [{ faceId, face: mesh.faces[faceId] }] : []); const centroids = faces.map(({ face }) => faceCentroid(mesh, face)); const center = meanPoint(centroids);
  const wall = faces.map(({ faceId, face }) => ({ faceId, centroid: faceCentroid(mesh, face), normal: faceNormal(mesh, face) })).filter(({ normal }) => Math.abs(dot3(normal, direction)) < 0.88);
  const blocked = wall.filter(({ normal }) => dot3(normal, direction) < -0.12); const undercutDepthMm = blocked.reduce((maximum, value) => Math.max(maximum, Math.abs(axialHeight(value.centroid, direction, center)) * Math.abs(dot3(value.normal, direction))), 0);
  const convergence = taperFromNormals(wall.map((value) => value.normal), direction); const visibilityScore = wall.length ? 1 - blocked.length / wall.length : 0; const boundaryFaces = faces.filter(({ faceId }) => topology.faceNeighbors[faceId].some((neighbor) => !faceSet.has(neighbor))); const accessibleMarginPercent = boundaryFaces.length ? boundaryFaces.filter(({ face }) => dot3(faceNormal(mesh, face), direction) > -0.25).length / boundaryFaces.length * 100 : 0;
  const failureReasons: string[] = []; if (!wall.length) failureReasons.push('No axial-wall faces could be measured.'); if (visibilityScore < 0.8) failureReasons.push(`${((1 - visibilityScore) * 100).toFixed(1)}% of measured wall faces conflict with this draw direction.`); if (accessibleMarginPercent < 75) failureReasons.push(`Only ${accessibleMarginPercent.toFixed(1)}% of the segmented boundary is accessible along this axis.`);
  return { id: crypto.randomUUID(), direction, blockedFaceIds: blocked.map((value) => value.faceId), undercutDepthMm, convergenceDegrees: convergence, accessibleMarginPercent, visibilityScore, valid: !failureReasons.length, failureReasons };
}

function proposeAxis(mesh: IndexedMesh, faceIds: number[], margin: Vec3[], fallbackInput: Vec3): Vec3 {
  const fallback = normalizedAxis(fallbackInput); const points = faceIds.flatMap((faceId) => mesh.faces[faceId]?.map((vertex) => mesh.positions[vertex]) ?? []); if (!points.length) return fallback; const center = margin.length ? meanPoint(margin) : meanPoint(points); const heights = points.map((point) => axialHeight(point, fallback, center)); const threshold = percentile(heights, 85); const top = meanPoint(points.filter((_, index) => heights[index] >= threshold)); const proposed = normalize3(subtract3(top, center)); return proposed.some((value) => Math.abs(value) > 1e-8) && dot3(proposed, fallback) >= 0 ? proposed : fallback;
}

function clusterMarginCandidates(values: MarginCandidate[]): MarginCandidate[][] {
  const groups: MarginCandidate[][] = [];
  for (const candidate of [...values].sort((a, b) => b.confidence - a.confidence)) {
    const center = meanPoint(candidate.points); const radius = average(candidate.points.map((point) => distance3(point, center))); const group = groups.find((current) => { const reference = current[0]; const otherCenter = meanPoint(reference.points); const otherRadius = average(reference.points.map((point) => distance3(point, otherCenter))); return distance3(center, otherCenter) <= Math.max(0.25, Math.max(radius, otherRadius) * 0.45); });
    if (group) group.push(candidate); else groups.push([candidate]);
  }
  return groups.filter((group) => group[0].points.length >= 4);
}

function removeConcentricDuplicatePreparations(values: PreparationCandidate[], axis: Vec3): PreparationCandidate[] {
  const retained: PreparationCandidate[] = [];
  for (const candidate of [...values].sort((a, b) => b.confidence - a.confidence)) {
    const margin = candidate.marginCandidates[0]; if (!margin) continue; const center = meanPoint(margin.points); const radius = average(margin.points.map((point) => radialDistance(point, center, axis)));
    const duplicate = retained.some((other) => { const otherMargin = other.marginCandidates[0]; const otherCenter = meanPoint(otherMargin.points); const otherRadius = average(otherMargin.points.map((point) => radialDistance(point, otherCenter, axis))); return distance3(center, otherCenter) < Math.max(radius, otherRadius) * 0.3 && Math.abs(radius - otherRadius) < Math.max(radius, otherRadius) * 0.35; });
    if (!duplicate) retained.push(candidate);
  }
  return retained;
}

function detectionState(confidence: number, margins: MarginCandidate[], ambiguity: string[]): PreparationDetectionState {
  if (!margins.length) return 'MANUAL_IDENTIFICATION_REQUIRED'; if (margins.length > 1 && Math.abs(margins[0].confidence - margins[1].confidence) < 0.08) return 'MULTIPLE_CANDIDATES'; if (confidence >= 0.68 && margins[0].closed && !ambiguity.length) return 'AUTO_DETECTED_HIGH_CONFIDENCE'; return 'AUTO_DETECTED_REVIEW_REQUIRED';
}

function inferPreparationKind(margin: MarginCandidate, height: number): PreparationKind {
  if (!margin.closed) return 'partial-coverage'; if (['knife-edge', 'feather-edge'].includes(margin.globalFinishLine) && height < 4) return 'veneer'; return 'crown';
}

function sentinelCandidate(state: PreparationDetectionState, artifactId: string, sceneObjectId: string, measurements: PreparationDetectionMeasurements, reason: string, createdAt: string): PreparationCandidate {
  return { id: crypto.randomUUID(), artifactId, sceneObjectId, shellIndex: -1, name: 'Manual preparation identification', toothPosition: 'unresolved', kind: 'unknown', state, faceIds: [], boundaryVertexIds: [], proposedInsertionAxis: [0, 0, 1], measurements, marginCandidates: [], ambiguityReasons: [reason], confidence: 0, createdAt };
}

function measuredToothPosition(center: Vec3, bounds: ReturnType<typeof boundsOfPoints>, axis: Vec3): string {
  if (!bounds) return 'unresolved'; const origin = scale3([bounds.min[0] + bounds.max[0], bounds.min[1] + bounds.max[1], bounds.min[2] + bounds.max[2]], 0.5); const basis = dentalBasis(axis, origin); const relative = subtract3(center, origin); return `dental-X ${dot3(relative, basis.u).toFixed(2)} mm · dental-Y ${dot3(relative, basis.v).toFixed(2)} mm`;
}

function nearestShellIndex(mesh: IndexedMesh, shells: number[][], faceIds: number[]): number { const selected = new Set(faceIds); let best = -1, count = 0; shells.forEach((shell, index) => { const overlap = shell.filter((faceId) => selected.has(faceId)).length; if (overlap > count) { count = overlap; best = index; } }); return best; }
function axialRange(points: Vec3[], axis: Vec3): number { const heights = points.map((point) => dot3(point, axis)); return heights.length ? Math.max(...heights) - Math.min(...heights) : 0; }
function normalDispersion(normals: Vec3[]): number { if (!normals.length) return 1; const averageNormal = normalize3(normals.reduce<Vec3>((sum, normal) => [sum[0] + normal[0], sum[1] + normal[1], sum[2] + normal[2]], [0, 0, 0])); return average(normals.map((normal) => 1 - Math.abs(dot3(normal, averageNormal)))); }
function taperFromNormals(normals: Vec3[], axis: Vec3): number | null { if (!normals.length) return null; const wallTilts = normals.map((normal) => Math.asin(Math.min(1, Math.abs(dot3(normalize3(normal), axis)))) * 180 / Math.PI); return median(wallTilts) * 2; }
function duplicateFaceCount(mesh: IndexedMesh): number { const seen = new Set<string>(); let count = 0; for (const face of mesh.faces) { const key = [...face].sort((a, b) => a - b).join(':'); if (seen.has(key)) count += 1; else seen.add(key); } return count; }
function connectedSelectedComponents(mesh: IndexedMesh, faceIds: number[]): number[][] { const topology = buildTopology(mesh); const selected = new Set(faceIds); const remaining = new Set(faceIds); const components: number[][] = []; while (remaining.size) { const queue = [[...remaining][0]], current: number[] = []; while (queue.length) { const id = queue.shift()!; if (!remaining.delete(id)) continue; current.push(id); for (const neighbor of topology.faceNeighbors[id] ?? []) if (selected.has(neighbor) && remaining.has(neighbor)) queue.push(neighbor); } components.push(current.sort((a, b) => a - b)); } return components; }
function artifactFromRequest(request: PreparationAnalysisRequest): ArtifactRecord { return { id: request.artifactId, sourceName: 'Preparation source', sourceFormat: 'stl', checksum: 'worker-owned-source', importedAt: new Date(0).toISOString(), byteLength: 0, units: 'mm', orientation: 'normalized', metadata: {}, history: [], mesh: request.mesh }; }
function artifactForMesh(mesh: MeshData): ArtifactRecord { return { id: 'analysis-reference', sourceName: 'registered pre-operative reference', sourceFormat: 'stl', checksum: 'reference', importedAt: new Date(0).toISOString(), byteLength: 0, units: 'mm', orientation: 'normalized', metadata: {}, history: [], mesh }; }
function minimumVertexClearance(vertices: Vec3[], mesh: MeshData): number { const triangles = meshTriangles(artifactForMesh(mesh)); let minimum = Infinity; for (const point of sample(vertices, 512)) { const closest = closestPointOnMesh(point, triangles); if (closest) minimum = Math.min(minimum, closest.distance); } return Number.isFinite(minimum) ? minimum : 0; }
function meshDataView(mesh: IndexedMesh): MeshData { return { positions: mesh.positions.flat(), normals: mesh.positions.flatMap(() => [0, 0, 1]), indices: mesh.faces.flat(), bounds: boundsOfPoints(mesh.positions) ?? { min: [0, 0, 0], max: [0, 0, 0] }, sourceTopology: { positions: mesh.positions.flat(), indices: mesh.faces.flat() } }; }
function sample<T>(values: T[], maximum: number): T[] { if (values.length <= maximum) return values; const step = values.length / maximum; return Array.from({ length: maximum }, (_, index) => values[Math.floor(index * step)]); }
function normalizedAxis(axis: Vec3): Vec3 { const normalized = normalize3(axis); if (!normalized.some((value) => Math.abs(value) > 1e-9)) throw new Error('Preparation analysis requires a non-zero dental insertion axis.'); return normalized; }
function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function assertActive(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('Preparation analysis cancelled.', 'AbortError'); }

export const PREPARATION_ALGORITHM_ID = `cadence-preparation-engine-${PREPARATION_ENGINE_VERSION}`;
