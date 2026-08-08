import type { ArtifactRecord, Quat, Vec3 } from './core';
import { dot3, length3, normalize3, scale3, subtract3 } from './geometry';
import {
  applyRigid,
  applyRigidDirection,
  axisAngleRigid,
  bestFitRigid,
  composeRigid,
  identityRigid,
  invertRigid,
  pcaRigidCandidates,
  rigidFromRotationTranslation,
  transformDifference,
} from './registration-math';
import type {
  PairwiseRegistrationResult,
  RegistrationCandidate,
  RegistrationCorrespondence,
  RegistrationMetrics,
  RegistrationOptions,
  RegistrationProgress,
  RegistrationRequest,
  RegistrationStage,
  RegistrationStageTiming,
  RigidTransform,
} from './registration-types';
import { unitScaleToMillimeters, validateOverlapPotential } from './scan-validation';
import { artifactGeometry, deterministicSample, geometryDiagonal, KdTree, type GeometryPoint } from './spatial-index';

export const REGISTRATION_ENGINE_VERSION = '1.0.1';

const DEFAULT_OPTIONS: RegistrationOptions = {
  maxIterations: 54,
  sampleLimit: 4096,
  outlierFraction: 0.2,
  convergenceTolerance: 0.0005,
  overlapThreshold: 0.1,
  usePointToPlane: true,
};

export interface RegistrationHooks {
  onProgress?: (progress: RegistrationProgress) => void;
  isCancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
}

interface CorrespondenceWork {
  sourceOriginal: GeometryPoint;
  source: Vec3;
  sourceNormal: Vec3 | null;
  target: GeometryPoint;
  distance: number;
  accepted: boolean;
}

interface RefinedCandidate {
  transform: RigidTransform;
  correspondences: CorrespondenceWork[];
  rms: number;
  overlap: number;
  fitness: number;
  precisionSupported: boolean;
  iterations: number;
  convergence: RegistrationMetrics['convergenceState'];
}

interface CoarseCandidate extends RegistrationCandidate {
  fitness: number;
  precisionSupported: boolean;
}

interface CorrespondenceEvaluation {
  correspondences: CorrespondenceWork[];
  rms: number;
  overlap: number;
  fitness: number;
  precisionSupported: boolean;
}

export async function registerPair(request: RegistrationRequest, hooks: RegistrationHooks = {}): Promise<PairwiseRegistrationResult> {
  const options = { ...DEFAULT_OPTIONS, ...(request.options ?? {}) };
  validateOptions(options);
  const startedAt = new Date().toISOString(); const timings: RegistrationStageTiming[] = [];
  const warnings: string[] = []; const errors: string[] = [];
  const report = (stage: RegistrationStage, progress: number, message: string) => hooks.onProgress?.({ requestId: request.requestId, stage, progress, message });
  const stage = async <T>(name: RegistrationStage, progress: number, message: string, operation: () => T | Promise<T>): Promise<T> => {
    ensureActive(hooks); report(name, progress, message); const start = performance.now();
    try { return await operation(); } finally { timings.push({ stage: name, durationMs: performance.now() - start }); }
  };
  try {
    const prepared = await stage('geometry-preparation', 0.03, 'Preparing immutable source geometry', () => prepare(request.source.artifact, request.target.artifact));
    const sampled = await stage('deterministic-sampling', 0.1, 'Creating deterministic multi-resolution samples', () => ({
      source: deterministicSample(prepared.source, options.sampleLimit),
      target: deterministicSample(prepared.target, options.sampleLimit),
    }));
    if (sampled.source.length < 6 || sampled.target.length < 6) throw new RegistrationFailure('At least six valid source and target vertices are required.');
    const overlap = validateOverlapPotential(request.source.artifact, request.target.artifact);
    if (overlap.status === 'fail') throw new RegistrationFailure(overlap.explanation);

    const targetTree = new KdTree(sampled.target);
    const coarse = await stage('coarse-alignment', 0.18, 'Evaluating deterministic coarse alignment candidates', () => coarseCandidates(sampled.source, sampled.target, prepared.source, prepared.target, targetTree, request, options));
    if (!coarse.length) throw new RegistrationFailure('No rigid coarse-alignment candidate could be established.');

    const refined: RefinedCandidate[] = [];
    for (let candidateIndex = 0; candidateIndex < Math.min(4, coarse.length); candidateIndex += 1) {
      const candidate = coarse[candidateIndex];
      const result = await stage('multi-resolution-refinement', 0.25 + candidateIndex * 0.1, `Refining candidate ${candidateIndex + 1}`, () => refineCandidate(sampled.source, sampled.target, candidate.transform, options, hooks, request.requestId, candidateIndex));
      refined.push(result);
    }
    refined.sort(compareRefinedCandidates);
    let best = refined[0];
    if (options.usePointToPlane && best.correspondences.some((item) => item.target.normal)) {
      best = await stage('fine-surface-registration', 0.72, 'Applying point-to-plane surface refinement', () => pointToPlaneRefine(best, sampled.source, sampled.target, options, hooks));
    } else warnings.push('Point-to-plane refinement was not executed because valid target normals were unavailable.');

    const verified = await stage('bidirectional-verification', 0.84, 'Verifying forward and reverse surface residuals', () => verify(best, sampled.source, sampled.target, options));
    const candidates = buildCandidateResults(refined, verified.metrics.rmsResidual, sampled.source.length);
    const ambiguity = candidateAmbiguity(candidates);
    verified.metrics.candidateAmbiguity = ambiguity;
    if (ambiguity >= 0.8) warnings.push('Multiple materially different registration candidates have similar residuals; manual review is required.');
    if (verified.metrics.estimatedOverlapPercent < 30) warnings.push('Estimated overlap is below 30%; review the alignment before acceptance.');

    const outcome = classify(verified.metrics, warnings);
    const fingerprint = resultFingerprint(best.transform, verified.metrics, request.source.artifact.checksum, request.target.artifact.checksum);
    report('confidence-calculation', 0.95, 'Calculating registration confidence');
    timings.push({ stage: 'confidence-calculation', durationMs: 0 });
    report('complete', 1, `Registration ${outcome}`); timings.push({ stage: 'complete', durationMs: 0 });
    return {
      id: `registration-${fingerprint}`,
      engineVersion: REGISTRATION_ENGINE_VERSION,
      sourceArtifactId: request.source.artifact.id,
      targetArtifactId: request.target.artifact.id,
      sourceRole: request.source.role,
      targetRole: request.target.role,
      startedAt,
      completedAt: new Date().toISOString(),
      outcome,
      transform: best.transform,
      metrics: verified.metrics,
      candidates,
      correspondences: verified.correspondences,
      timings,
      warnings,
      errors,
      deterministicFingerprint: fingerprint,
    };
  } catch (error) {
    const cancelled = error instanceof RegistrationCancelled;
    const message = error instanceof Error ? error.message : 'Registration failed.';
    if (!cancelled) errors.push(message);
    const metrics = emptyMetrics(cancelled ? 'cancelled' : 'insufficient-correspondence');
    const fingerprint = resultFingerprint(null, metrics, request.source.artifact.checksum, request.target.artifact.checksum);
    return {
      id: `registration-${fingerprint}`,
      engineVersion: REGISTRATION_ENGINE_VERSION,
      sourceArtifactId: request.source.artifact.id,
      targetArtifactId: request.target.artifact.id,
      sourceRole: request.source.role,
      targetRole: request.target.role,
      startedAt,
      completedAt: new Date().toISOString(),
      outcome: cancelled ? 'cancelled' : 'failed',
      transform: null,
      metrics,
      candidates: [],
      correspondences: [],
      timings,
      warnings,
      errors,
      deterministicFingerprint: fingerprint,
    };
  }
}

function prepare(sourceArtifact: ArtifactRecord, targetArtifact: ArtifactRecord): { source: GeometryPoint[]; target: GeometryPoint[] } {
  if (sourceArtifact.units === 'unknown' || targetArtifact.units === 'unknown') throw new RegistrationFailure('Source and target units must be explicitly confirmed before registration.');
  const convert = (artifact: ArtifactRecord) => {
    const scale = unitScaleToMillimeters(artifact.units);
    return artifactGeometry(artifact).map((point) => ({ ...point, position: scale3(point.position, scale) }));
  };
  const source = convert(sourceArtifact); const target = convert(targetArtifact);
  if (!source.length || !target.length) throw new RegistrationFailure('Empty geometry cannot be registered.');
  if (![...source, ...target].every((point) => point.position.every(Number.isFinite))) throw new RegistrationFailure('Non-finite geometry cannot be registered.');
  return { source, target };
}

function coarseCandidates(source: GeometryPoint[], target: GeometryPoint[], fullSource: GeometryPoint[], fullTarget: GeometryPoint[], tree: KdTree, request: RegistrationRequest, options: RegistrationOptions): CoarseCandidate[] {
  const sourcePoints = source.map((item) => item.position); const targetPoints = target.map((item) => item.position);
  const candidates: RigidTransform[] = [];
  if (options.initialTransform) candidates.push(options.initialTransform);
  candidates.push(identityRigid());
  candidates.push(...topologyFeatureCandidates(fullSource, fullTarget, request.source.artifact, request.target.artifact));
  candidates.push(...localFeatureCandidates(source, target, tree, options));
  candidates.push(...pcaRigidCandidates(sourcePoints, targetPoints));
  const sourceCenter = mean(sourcePoints); const targetCenter = mean(targetPoints);
  candidates.push(rigidFromRotationTranslation([0, 0, 0, 1], subtract3(targetCenter, sourceCenter)));
  if (source.length === target.length && request.source.artifact.mesh.sourceTopology?.indices.length === request.target.artifact.mesh.sourceTopology?.indices.length) {
    candidates.push(bestFitRigid(sourcePoints, targetPoints));
  }
  const unique = new Map<string, RigidTransform>();
  candidates.forEach((candidate) => unique.set(candidate.matrix.map((value) => value.toFixed(6)).join(','), candidate));
  const diagonal = Math.max(geometryDiagonal(target), 1);
  return [...unique.values()].map((transform, index) => {
    const work = searchCorrespondences(source, tree, transform, Math.max(1, diagonal * 0.3));
    const evaluated = evaluateCorrespondences(work, source.length, diagonal, options);
    return { id: `coarse-${index}`, transform, rmsResidual: evaluated.rms, overlapPercent: evaluated.overlap * 100, rank: 0, ambiguous: false, fitness: evaluated.fitness, precisionSupported: evaluated.precisionSupported };
  }).filter((candidate) => Number.isFinite(candidate.rmsResidual)).sort(compareCoarseCandidates).map((candidate, rank) => ({ ...candidate, rank: rank + 1 }));
}

async function refineCandidate(source: GeometryPoint[], target: GeometryPoint[], initial: RigidTransform, options: RegistrationOptions, hooks: RegistrationHooks, requestId: string, candidateIndex: number): Promise<RefinedCandidate> {
  let transform = initial; let previousRms = Infinity; let convergence: RegistrationMetrics['convergenceState'] = 'iteration-limit'; let correspondences: CorrespondenceWork[] = [];
  const levels = [Math.min(256, source.length), Math.min(1024, source.length), source.length].filter((value, index, values) => value >= 6 && values.indexOf(value) === index);
  let iteration = 0; const targetTree = new KdTree(target); const diagonal = Math.max(geometryDiagonal(target), 1);
  const initialEvaluation = evaluateCorrespondences(searchCorrespondences(source, targetTree, initial, Math.max(1, diagonal * 0.3)), source.length, diagonal, options);
  const perLevel = Math.max(4, Math.floor(options.maxIterations / levels.length));
  for (const size of levels) {
    const level = deterministicSample(source, size);
    for (let local = 0; local < perLevel && iteration < options.maxIterations; local += 1) {
      ensureActive(hooks); iteration += 1;
      const maximum = Math.max(0.5, diagonal * Math.max(0.025, 0.25 * (1 - iteration / (options.maxIterations + 4))));
      const searched = searchCorrespondences(level, targetTree, transform, maximum);
      correspondences = evaluateCorrespondences(searched, level.length, diagonal, options).correspondences;
      if (correspondences.length < 6) { convergence = 'insufficient-correspondence'; break; }
      const delta = bestFitRigid(correspondences.map((item) => item.source), correspondences.map((item) => item.target.position));
      transform = composeRigid(delta, transform);
      const currentRms = rms(correspondences);
      hooks.onProgress?.({ requestId, stage: 'correspondence-search', progress: Math.min(0.7, 0.25 + (candidateIndex * options.maxIterations + iteration) / (4 * options.maxIterations) * 0.4), message: `Candidate ${candidateIndex + 1}, iteration ${iteration}` });
      if (Math.abs(previousRms - currentRms) <= options.convergenceTolerance && transformDifference(delta, identityRigid()).rotationErrorDegrees <= 0.005) { convergence = 'converged'; break; }
      previousRms = currentRms;
      if (hooks.yieldControl) await hooks.yieldControl(); else if (iteration % 3 === 0) await Promise.resolve();
    }
    if (convergence === 'insufficient-correspondence') break;
  }
  const refinedEvaluation = evaluateCorrespondences(searchCorrespondences(source, targetTree, transform, Math.max(0.5, diagonal * 0.08)), source.length, diagonal, options);
  const refined = candidateFromEvaluation(transform, refinedEvaluation, iteration, convergence);
  const seed = candidateFromEvaluation(initial, initialEvaluation, iteration, initialEvaluation.precisionSupported ? 'converged' : convergence);
  const refinedImprovement = (seed.fitness - refined.fitness) / Math.max(seed.fitness, 1e-9);
  return seed.precisionSupported && refinedImprovement < 0.12
    ? seed
    : compareRefinedCandidates(seed, refined) <= 0 ? seed : refined;
}

async function pointToPlaneRefine(candidate: RefinedCandidate, source: GeometryPoint[], target: GeometryPoint[], options: RegistrationOptions, hooks: RegistrationHooks): Promise<RefinedCandidate> {
  let transform = candidate.transform; let correspondences = candidate.correspondences; const tree = new KdTree(target); const diagonal = Math.max(geometryDiagonal(target), 1);
  let iterations = candidate.iterations; let previous = candidate.rms;
  for (let index = 0; index < Math.min(12, options.maxIterations - candidate.iterations); index += 1) {
    ensureActive(hooks); correspondences = evaluateCorrespondences(searchCorrespondences(source, tree, transform, Math.max(0.4, diagonal * 0.05)).filter((item) => item.target.normal), source.length, diagonal, options).correspondences;
    if (correspondences.length < 6) break;
    const system = normalEquations(correspondences); const solution = solveLinear(system.matrix, system.vector);
    if (!solution) break;
    const omega: Vec3 = [solution[0], solution[1], solution[2]]; const translation: Vec3 = [solution[3], solution[4], solution[5]]; const angle = length3(omega);
    const delta = composeRigid(rigidFromRotationTranslation([0, 0, 0, 1], translation), angle ? axisAngleRigid(scale3(omega, 1 / angle), angle) : identityRigid());
    transform = composeRigid(delta, transform); iterations += 1;
    const current = rms(correspondences); if (Math.abs(previous - current) <= options.convergenceTolerance) break; previous = current;
    if (hooks.yieldControl) await hooks.yieldControl();
  }
  const evaluation = evaluateCorrespondences(searchCorrespondences(source, tree, transform, Math.max(0.5, diagonal * 0.08)), source.length, diagonal, options);
  const refined = candidateFromEvaluation(transform, evaluation, iterations, candidate.convergence);
  // Surface refinement is optional and may be ill-conditioned on nearly planar
  // patches. Never replace the converged point-to-point result with a transform
  // that increases its accepted surface residual.
  return compareRefinedCandidates(refined, candidate) < 0 ? refined : candidate;
}

function verify(candidate: RefinedCandidate, source: GeometryPoint[], target: GeometryPoint[], options: RegistrationOptions): { metrics: RegistrationMetrics; correspondences: RegistrationCorrespondence[] } {
  const transform = candidate.transform;
  const targetTree = new KdTree(target); const sourceTree = new KdTree(source.map((point) => ({ ...point, position: applyRigid(transform, point.position), normal: point.normal ? applyRigidDirection(transform, point.normal) : null })));
  const diagonal = Math.max(geometryDiagonal(target), 1); const maximum = Math.max(0.5, diagonal * 0.08);
  const forwardAll = searchCorrespondences(source, targetTree, transform, maximum);
  const forwardEvaluation = evaluateCorrespondences(forwardAll, source.length, diagonal, options);
  if (!forwardEvaluation.precisionSupported) throw new RegistrationFailure(`Registration did not establish the required ${(options.overlapThreshold * 100).toFixed(1)}% precision overlap.`);
  const forward = forwardEvaluation.correspondences;
  const precisionLimit = precisionCorrespondenceRadius(diagonal);
  const reverseDistances = target.map((point) => sourceTree.nearest(point.position, precisionLimit)?.distance).filter((value): value is number => value !== undefined);
  if (forward.length < 6) throw new RegistrationFailure('Fine registration produced insufficient accepted correspondences.');
  const distances = forward.map((item) => item.distance).sort((a, b) => a - b); const acceptedIds = new Set(forward.map((item) => item.sourceOriginal.id));
  const normalValues = forward.map((item) => item.sourceNormal && item.target.normal ? Math.max(-1, Math.min(1, dot3(item.sourceNormal, item.target.normal))) : null).filter((value): value is number => value !== null);
  const penetration = forward.filter((item) => item.target.normal && dot3(subtract3(item.source, item.target.position), item.target.normal) < -0.05).length;
  const forwardRms = Math.sqrt(distances.reduce((sum, value) => sum + value * value, 0) / distances.length);
  const reverseRms = reverseDistances.length ? Math.sqrt(reverseDistances.reduce((sum, value) => sum + value * value, 0) / reverseDistances.length) : Infinity;
  const inlierRatio = forward.length / source.length; const overlap = Math.min(100, inlierRatio * 100);
  const confidence = confidenceScore(forwardRms, diagonal, inlierRatio, normalValues.length ? meanNumbers(normalValues.map((value) => Math.max(0, value))) : null, Math.abs(forwardRms - reverseRms));
  const metrics: RegistrationMetrics = {
    rmsResidual: forwardRms,
    medianResidual: percentile(distances, 0.5),
    percentile95Residual: percentile(distances, 0.95),
    maximumAcceptedResidual: distances.at(-1) ?? 0,
    inlierCount: forward.length,
    outlierCount: Math.max(0, source.length - forward.length),
    inlierRatio,
    estimatedOverlapPercent: overlap,
    convergenceState: candidate.convergence,
    iterationCount: candidate.iterations,
    translationMagnitude: length3(transform.translation),
    rotationMagnitudeDegrees: transformDifference(transform, identityRigid()).rotationErrorDegrees,
    bidirectionalConsistency: Number.isFinite(reverseRms) ? Math.max(0, 1 - Math.abs(forwardRms - reverseRms) / Math.max(forwardRms, reverseRms, 1e-9)) : 0,
    surfaceNormalAgreement: normalValues.length ? meanNumbers(normalValues) : null,
    candidateAmbiguity: 0,
    biteScanAgreement: null,
    interpenetrationIndicators: penetration,
    confidenceScore: confidence,
  };
  const display = forwardAll.filter((_, index) => index % Math.max(1, Math.floor(forwardAll.length / 256)) === 0).slice(0, 256).map((item, index) => ({
    id: index,
    source: item.source,
    target: item.target.position,
    distance: item.distance,
    accepted: acceptedIds.has(item.sourceOriginal.id),
    normalAgreement: item.sourceNormal && item.target.normal ? dot3(item.sourceNormal, item.target.normal) : null,
    penetrating: Boolean(item.target.normal && dot3(subtract3(item.source, item.target.position), item.target.normal) < -0.05),
  }));
  return { metrics, correspondences: display };
}

function searchCorrespondences(source: GeometryPoint[], target: KdTree, transform: RigidTransform, maximumDistance: number): CorrespondenceWork[] {
  const work: CorrespondenceWork[] = [];
  for (const item of source) {
    const position = applyRigid(transform, item.position); const nearest = target.nearest(position, maximumDistance); if (!nearest) continue;
    work.push({ sourceOriginal: item, source: position, sourceNormal: item.normal ? applyRigidDirection(transform, item.normal) : null, target: nearest.point, distance: nearest.distance, accepted: true });
  }
  return work;
}

function rejectOutliers(values: CorrespondenceWork[], fraction: number): CorrespondenceWork[] {
  if (values.length < 6) return [];
  const sorted = [...values].sort((a, b) => a.distance - b.distance || a.sourceOriginal.id - b.sourceOriginal.id);
  const median = percentile(sorted.map((item) => item.distance), 0.5); const deviations = sorted.map((item) => Math.abs(item.distance - median)).sort((a, b) => a - b); const mad = percentile(deviations, 0.5);
  const robustLimit = median + Math.max(1e-6, 3 * 1.4826 * mad);
  const robust = sorted.filter((item) => item.distance <= robustLimit);
  if (robust.length >= 6) return robust;
  const trimCount = Math.max(6, Math.floor(sorted.length * (1 - fraction)));
  return sorted.slice(0, trimCount);
}

function evaluateCorrespondences(values: CorrespondenceWork[], sourceCount: number, diagonal: number, options: RegistrationOptions): CorrespondenceEvaluation {
  const precisionLimit = precisionCorrespondenceRadius(diagonal);
  const precise = values.filter((item) => item.distance <= precisionLimit);
  const minimumCount = Math.max(6, Math.ceil(sourceCount * options.overlapThreshold));
  const precisionSupported = precise.length >= minimumCount;
  const correspondences = rejectOutliers(precisionSupported ? precise : values, options.outlierFraction);
  const residual = rms(correspondences);
  const overlap = correspondences.length / Math.max(1, sourceCount);
  const fitness = precisionSupported
    ? residual / Math.max(overlap, options.overlapThreshold)
    : 1_000_000 + residual / Math.max(overlap, 1e-9);
  return { correspondences, rms: residual, overlap, fitness, precisionSupported };
}

function precisionCorrespondenceRadius(diagonal: number): number {
  return Math.max(0.5, Math.min(1.5, diagonal * 0.006));
}

function candidateFromEvaluation(transform: RigidTransform, evaluation: CorrespondenceEvaluation, iterations: number, convergence: RegistrationMetrics['convergenceState']): RefinedCandidate {
  return {
    transform,
    correspondences: evaluation.correspondences,
    rms: evaluation.rms,
    overlap: evaluation.overlap,
    fitness: evaluation.fitness,
    precisionSupported: evaluation.precisionSupported,
    iterations,
    convergence,
  };
}

function compareCoarseCandidates(first: CoarseCandidate, second: CoarseCandidate): number {
  return first.fitness - second.fitness || second.overlapPercent - first.overlapPercent || first.rmsResidual - second.rmsResidual;
}

function compareRefinedCandidates(first: RefinedCandidate, second: RefinedCandidate): number {
  return first.fitness - second.fitness || second.overlap - first.overlap || first.rms - second.rms;
}

function normalEquations(values: CorrespondenceWork[]): { matrix: number[][]; vector: number[] } {
  const matrix = Array.from({ length: 6 }, () => new Array<number>(6).fill(0)); const vector = new Array<number>(6).fill(0);
  for (const item of values) {
    const normal = item.target.normal!; const row = [...cross(item.source, normal), ...normal]; const residual = dot3(normal, subtract3(item.target.position, item.source));
    for (let a = 0; a < 6; a += 1) { vector[a] += row[a] * residual; for (let b = 0; b < 6; b += 1) matrix[a][b] += row[a] * row[b]; }
  }
  for (let index = 0; index < 6; index += 1) matrix[index][index] += 1e-9;
  return { matrix, vector };
}

function solveLinear(input: number[][], rhs: number[]): number[] | null {
  const matrix = input.map((row, index) => [...row, rhs[index]]); const size = rhs.length;
  for (let column = 0; column < size; column += 1) {
    let pivot = column; for (let row = column + 1; row < size; row += 1) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    if (Math.abs(matrix[pivot][column]) < 1e-12) return null;
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column]; for (let index = column; index <= size; index += 1) matrix[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) if (row !== column) { const factor = matrix[row][column]; for (let index = column; index <= size; index += 1) matrix[row][index] -= factor * matrix[column][index]; }
  }
  return matrix.map((row) => row[size]);
}

function buildCandidateResults(refined: RefinedCandidate[], _bestRms: number, sourceCount: number): RegistrationCandidate[] {
  return refined.slice(0, 3).map((candidate, index) => ({
    id: `candidate-${index + 1}`,
    transform: candidate.transform,
    rmsResidual: candidate.rms,
    overlapPercent: candidate.overlap * 100,
    rank: index + 1,
    ambiguous: index > 0 && candidate.fitness <= refined[0].fitness * 1.05,
  }));
}

/**
 * Establishes transform hypotheses from rigid-invariant local distance signatures.
 * This gives partial scans and scans containing remote outliers a deterministic
 * coarse path without assuming common vertex identifiers or mutating geometry.
 */
function localFeatureCandidates(source: GeometryPoint[], target: GeometryPoint[], targetTree: KdTree, options: RegistrationOptions): RigidTransform[] {
  const sourceFeatures = localFeatures(deterministicSample(source, Math.min(768, source.length)));
  const targetFeatures = localFeatures(deterministicSample(target, Math.min(768, target.length)));
  if (sourceFeatures.length < 6 || targetFeatures.length < 6) return [];

  const potential: Array<{ source: GeometryPoint; target: GeometryPoint; score: number; ratio: number }> = [];
  for (const sourceFeature of sourceFeatures) {
    let best: { feature: LocalFeature; score: number } | null = null;
    let second = Infinity;
    for (const targetFeature of targetFeatures) {
      const score = signatureDistance(sourceFeature.signature, targetFeature.signature);
      if (!best || score < best.score) { second = best?.score ?? Infinity; best = { feature: targetFeature, score }; }
      else if (score < second) second = score;
    }
    if (!best) continue;
    const ratio = best.score / Math.max(second, 1e-9);
    if (best.score <= 0.12 && (ratio <= 0.96 || best.score <= 0.012)) potential.push({ source: sourceFeature.point, target: best.feature.point, score: best.score, ratio });
  }

  // A target feature may contribute only its strongest match. This prevents a
  // repeated flat patch from overwhelming the coarse rigid estimate.
  const uniqueTargets = new Map<number, (typeof potential)[number]>();
  for (const match of potential.sort((a, b) => a.score - b.score || a.ratio - b.ratio || a.source.id - b.source.id)) {
    const existing = uniqueTargets.get(match.target.id);
    if (!existing || match.score < existing.score) uniqueTargets.set(match.target.id, match);
  }
  const matches = [...uniqueTargets.values()].sort((a, b) => a.score - b.score || a.source.id - b.source.id).slice(0, 32);
  if (matches.length < 3) return [];

  const hypotheses: Array<{ transform: RigidTransform; rms: number; overlap: number }> = [];
  const consider = (selected: typeof matches) => {
    if (selected.length < 3 || triangleArea(selected[0].source.position, selected[1].source.position, selected[2].source.position) < 1e-4 || triangleArea(selected[0].target.position, selected[1].target.position, selected[2].target.position) < 1e-4) return;
    let transform: RigidTransform;
    try { transform = bestFitRigid(selected.map((item) => item.source.position), selected.map((item) => item.target.position)); } catch { return; }
    const diagonal = Math.max(geometryDiagonal(target), 1);
    const work = rejectOutliers(searchCorrespondences(source, targetTree, transform, Math.max(0.75, diagonal * 0.08)), options.outlierFraction);
    if (work.length < 6) return;
    hypotheses.push({ transform, rms: rms(work), overlap: work.length / source.length });
  };
  if (matches.length >= 6) consider(matches.filter((item) => item.score <= Math.max(0.02, matches[Math.min(matches.length - 1, 11)].score)).slice(0, 20));
  let evaluated = 0;
  for (let first = 0; first < Math.min(14, matches.length) && evaluated < 160; first += 1) {
    for (let second = first + 1; second < Math.min(20, matches.length) && evaluated < 160; second += 1) {
      for (let third = second + 1; third < Math.min(24, matches.length) && evaluated < 160; third += 1) {
        consider([matches[first], matches[second], matches[third]]); evaluated += 1;
      }
    }
  }
  return hypotheses.sort((a, b) => b.overlap - a.overlap || a.rms - b.rms).slice(0, 8).map((item) => item.transform);
}

interface LocalFeature { point: GeometryPoint; signature: number[] }

/**
 * Creates rigid coarse candidates from triangle edge-length signatures. Source
 * topology is immutable, and exact triangle subsets survive deterministic
 * cropping and decimation even when vertex identifiers and centroids change.
 */
function topologyFeatureCandidates(source: GeometryPoint[], target: GeometryPoint[], sourceArtifact: ArtifactRecord, targetArtifact: ArtifactRecord): RigidTransform[] {
  const sourceIndices = (sourceArtifact.mesh.sourceTopology ?? { indices: sourceArtifact.mesh.indices }).indices;
  const targetIndices = (targetArtifact.mesh.sourceTopology ?? { indices: targetArtifact.mesh.indices }).indices;
  const targetFeatures = new Map<string, Array<[Vec3, Vec3, Vec3]>>();
  for (const offset of sampledTriangleOffsets(targetIndices.length, 4_096)) {
    const triangle = triangleAt(target, targetIndices, offset); if (!triangle) continue;
    const key = triangleSignature(triangle); const values = targetFeatures.get(key) ?? [];
    if (values.length < 8) values.push(triangle); targetFeatures.set(key, values);
  }
  const candidates: RigidTransform[] = [];
  for (const offset of sampledTriangleOffsets(sourceIndices.length, 4_096)) {
    const sourceTriangle = triangleAt(source, sourceIndices, offset); if (!sourceTriangle) continue;
    const targets = targetFeatures.get(triangleSignature(sourceTriangle)); if (!targets) continue;
    for (const targetTriangle of targets) {
      const candidate = triangleRigidCandidate(sourceTriangle, targetTriangle);
      if (candidate) candidates.push(candidate);
      if (candidates.length >= 24) return candidates;
    }
  }
  return candidates;
}

function sampledTriangleOffsets(indexCount: number, limit: number): number[] {
  const triangleCount = Math.floor(indexCount / 3); const stride = Math.max(1, Math.ceil(triangleCount / limit)); const offsets: number[] = [];
  for (let triangle = 0; triangle < triangleCount && offsets.length < limit; triangle += stride) offsets.push(triangle * 3);
  return offsets;
}

function triangleAt(points: GeometryPoint[], indices: number[], offset: number): [Vec3, Vec3, Vec3] | null {
  const ids = [indices[offset], indices[offset + 1], indices[offset + 2]];
  if (ids.some((id) => !Number.isInteger(id) || id < 0 || id >= points.length)) return null;
  const triangle = ids.map((id) => points[id].position) as [Vec3, Vec3, Vec3];
  return triangleArea(...triangle) > 1e-8 ? triangle : null;
}

function triangleSignature(triangle: [Vec3, Vec3, Vec3]): string {
  const lengths = [length3(subtract3(triangle[0], triangle[1])), length3(subtract3(triangle[1], triangle[2])), length3(subtract3(triangle[2], triangle[0]))].sort((a, b) => a - b);
  return lengths.map((value) => value.toFixed(5)).join(':');
}

function triangleRigidCandidate(source: [Vec3, Vec3, Vec3], target: [Vec3, Vec3, Vec3]): RigidTransform | null {
  // Only cyclic permutations preserve triangle winding. Reversed permutations
  // can fit one isolated triangle through a 180° rotation while inverting the
  // surrounding surface orientation and producing a false coarse candidate.
  const permutations: Array<[number, number, number]> = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  let best: { transform: RigidTransform; residual: number } | null = null;
  for (const permutation of permutations) {
    const ordered = permutation.map((index) => target[index]) as [Vec3, Vec3, Vec3];
    try {
      const transform = bestFitRigid(source, ordered);
      const residual = Math.max(...source.map((point, index) => length3(subtract3(applyRigid(transform, point), ordered[index]))));
      if (!best || residual < best.residual) best = { transform, residual };
    } catch {
      // Degenerate permutations do not establish a rigid candidate.
    }
  }
  return best && best.residual <= 0.01 ? best.transform : null;
}

function localFeatures(points: GeometryPoint[]): LocalFeature[] {
  return points.map((point) => {
    const distances = points.filter((candidate) => candidate.id !== point.id).map((candidate) => length3(subtract3(candidate.position, point.position))).sort((a, b) => a - b).slice(0, 12);
    const scale = Math.max(distances.at(-1) ?? 1, 1e-9);
    return { point, signature: distances.map((distance) => distance / scale) };
  }).filter((feature) => feature.signature.length >= 6);
}

function signatureDistance(first: number[], second: number[]): number {
  const count = Math.min(first.length, second.length); if (!count) return Infinity;
  return Math.sqrt(first.slice(0, count).reduce((sum, value, index) => sum + (value - second[index]) ** 2, 0) / count);
}

function triangleArea(a: Vec3, b: Vec3, c: Vec3): number { return length3(cross(subtract3(b, a), subtract3(c, a))) * 0.5; }

function candidateAmbiguity(candidates: RegistrationCandidate[]): number {
  if (candidates.length < 2 || !Number.isFinite(candidates[1].rmsResidual)) return 0;
  const fitness = (candidate: RegistrationCandidate) => candidate.rmsResidual / Math.max(candidate.overlapPercent / 100, 1e-6);
  const firstFitness = fitness(candidates[0]); const secondFitness = fitness(candidates[1]);
  const difference = (secondFitness - firstFitness) / Math.max(firstFitness, 1e-6);
  const transformDelta = transformDifference(candidates[1].transform, candidates[0].transform);
  return difference <= 0.05 && (transformDelta.rotationErrorDegrees > 2 || transformDelta.translationError > 0.5) ? Math.max(0, 1 - difference / 0.05) : 0;
}

function classify(metrics: RegistrationMetrics, warnings: string[]): PairwiseRegistrationResult['outcome'] {
  if (metrics.inlierCount < 6 || metrics.estimatedOverlapPercent < 10 || !Number.isFinite(metrics.rmsResidual)) return 'failed';
  if (metrics.candidateAmbiguity >= 0.8) return 'manual-review-required';
  if (metrics.confidenceScore < 0.45) return 'manual-review-required';
  if (warnings.length || metrics.confidenceScore < 0.72 || metrics.rmsResidual > 0.5) return 'accepted-with-warning';
  return 'accepted';
}

function confidenceScore(rmsValue: number, diagonal: number, inlierRatio: number, normalAgreement: number | null, bidirectionalDifference: number): number {
  const residualScore = Math.exp(-rmsValue / Math.max(0.15, diagonal * 0.005)); const overlapScore = Math.min(1, inlierRatio / 0.65);
  const normalScore = normalAgreement === null ? 0.65 : Math.max(0, Math.min(1, (normalAgreement + 1) / 2));
  const bidirectionalScore = Math.exp(-bidirectionalDifference / Math.max(0.1, rmsValue));
  return clamp(residualScore * 0.4 + overlapScore * 0.3 + normalScore * 0.15 + bidirectionalScore * 0.15, 0, 1);
}

function rms(values: CorrespondenceWork[]): number { return values.length ? Math.sqrt(values.reduce((sum, item) => sum + item.distance * item.distance, 0) / values.length) : Infinity; }
function percentile(values: number[], portion: number): number { if (!values.length) return Infinity; const sorted = [...values].sort((a, b) => a - b); const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(portion * sorted.length) - 1)); return sorted[index]; }
function mean(points: Vec3[]): Vec3 { if (!points.length) return [0, 0, 0]; return scale3(points.reduce<Vec3>((sum, item) => [sum[0] + item[0], sum[1] + item[1], sum[2] + item[2]], [0, 0, 0]), 1 / points.length); }
function meanNumbers(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

function emptyMetrics(state: RegistrationMetrics['convergenceState']): RegistrationMetrics {
  return { rmsResidual: Infinity, medianResidual: Infinity, percentile95Residual: Infinity, maximumAcceptedResidual: Infinity, inlierCount: 0, outlierCount: 0, inlierRatio: 0, estimatedOverlapPercent: 0, convergenceState: state, iterationCount: 0, translationMagnitude: 0, rotationMagnitudeDegrees: 0, bidirectionalConsistency: 0, surfaceNormalAgreement: null, candidateAmbiguity: 0, biteScanAgreement: null, interpenetrationIndicators: 0, confidenceScore: 0 };
}

function resultFingerprint(transform: RigidTransform | null, metrics: RegistrationMetrics, sourceHash: string, targetHash: string): string {
  const payload = JSON.stringify({ sourceHash, targetHash, matrix: transform?.matrix.map((value) => round(value, 8)) ?? null, metrics: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, typeof value === 'number' && Number.isFinite(value) ? round(value, 8) : value])) });
  let first = 0x811c9dc5; let second = 0x9e3779b9;
  for (let index = 0; index < payload.length; index += 1) { first ^= payload.charCodeAt(index); first = Math.imul(first, 0x01000193); second ^= first + payload.charCodeAt(index); second = Math.imul(second, 0x85ebca6b); }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function round(value: number, precision: number): number { const factor = 10 ** precision; return Math.round(value * factor) / factor; }
function validateOptions(options: RegistrationOptions): void { if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1 || options.maxIterations > 500) throw new Error('Iteration limit must be between 1 and 500.'); if (options.sampleLimit < 32 || options.sampleLimit > 100_000) throw new Error('Sample limit must be between 32 and 100,000.'); if (options.outlierFraction < 0 || options.outlierFraction >= 0.8) throw new Error('Outlier fraction must be at least 0 and below 0.8.'); }
function ensureActive(hooks: RegistrationHooks): void { if (hooks.isCancelled?.()) throw new RegistrationCancelled('Registration cancelled by user.'); }
class RegistrationFailure extends Error {}
class RegistrationCancelled extends Error {}
