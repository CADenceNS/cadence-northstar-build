import type { Vec3 } from './core';
import type { SurfaceCurve } from './editing-types';

export const PREPARATION_ENGINE_VERSION = '1.0.0';
export const PREPARATION_RULESET_VERSION = 'CADENCE-PREP-QC-1.0.0';

export type PreparationKind =
  | 'crown'
  | 'bridge-abutment'
  | 'veneer'
  | 'inlay'
  | 'onlay'
  | 'overlay'
  | 'coping'
  | 'implant-restorative'
  | 'partial-coverage'
  | 'unknown';

export type PreparationDetectionState =
  | 'AUTO_DETECTED_HIGH_CONFIDENCE'
  | 'AUTO_DETECTED_REVIEW_REQUIRED'
  | 'MULTIPLE_CANDIDATES'
  | 'MANUAL_IDENTIFICATION_REQUIRED'
  | 'INSUFFICIENT_GEOMETRY'
  | 'UNSUPPORTED';

export type FinishLineClassification =
  | 'chamfer'
  | 'heavy-chamfer'
  | 'shoulder'
  | 'radial-shoulder'
  | 'beveled-shoulder'
  | 'knife-edge'
  | 'feather-edge'
  | 'hybrid-mixed'
  | 'indeterminate';

export type MarginConfidenceCategory =
  | 'high'
  | 'moderate'
  | 'low'
  | 'reconstructed-missing-data'
  | 'discontinuous'
  | 'ambiguous';

export interface PreparationDetectionMeasurements {
  vertexCount: number;
  triangleCount: number;
  finiteCoordinateRatio: number;
  surfaceAreaMm2: number;
  boundingDimensionsMm: Vec3;
  candidateFeatureEdgeCount: number;
  candidateLoopCount: number;
  localHeightMm: number;
  wallNormalDispersion: number;
  taperDegrees: number | null;
  topologyBoundaryEdgeCount: number;
  topologyNonManifoldEdgeCount: number;
}

export interface MarginSegmentEvidence {
  index: number;
  start: Vec3;
  end: Vec3;
  sourceEdgeId: number | null;
  dihedralDegrees: number;
  curvatureGradient: number;
  normalTransition: number;
  surfaceSupport: number;
  gapMm: number;
  confidence: number;
  category: MarginConfidenceCategory;
  finishLine: FinishLineClassification;
  classificationConfidence: number;
  reconstructed: boolean;
  explanation: string;
}

export interface MarginCandidate {
  id: string;
  preparationCandidateId: string;
  rank: number;
  points: Vec3[];
  sourceVertexIds: number[];
  sourceEdgeIds: number[];
  closed: boolean;
  lengthMm: number;
  closureErrorMm: number;
  meanCurvatureEvidence: number;
  normalTransitionEvidence: number;
  continuityScore: number;
  surfaceSupport: number;
  missingDataPercent: number;
  confidence: number;
  failureReasons: string[];
  ambiguousSegmentIndices: number[];
  segments: MarginSegmentEvidence[];
  globalFinishLine: FinishLineClassification;
  generatedAt: string;
}

export interface PreparationCandidate {
  id: string;
  artifactId: string;
  sceneObjectId: string;
  shellIndex: number;
  name: string;
  toothPosition: string;
  kind: PreparationKind;
  state: PreparationDetectionState;
  faceIds: number[];
  boundaryVertexIds: number[];
  proposedInsertionAxis: Vec3;
  measurements: PreparationDetectionMeasurements;
  marginCandidates: MarginCandidate[];
  ambiguityReasons: string[];
  confidence: number;
  createdAt: string;
}

export interface PreparationSegmentation {
  id: string;
  version: number;
  preparationId: string;
  artifactId: string;
  sceneObjectId: string;
  faceIds: number[];
  boundaryEdgeIds: number[];
  excludedFaceIds: number[];
  source: 'automatic' | 'manual' | 'refined';
  locked: boolean;
  approvedAt: string | null;
  parentVersionId: string | null;
  createdAt: string;
}

export interface AxisCandidate {
  id: string;
  direction: Vec3;
  blockedFaceIds: number[];
  undercutDepthMm: number;
  convergenceDegrees: number | null;
  accessibleMarginPercent: number;
  visibilityScore: number;
  valid: boolean;
  failureReasons: string[];
}

export interface InsertionAxisAnalysis {
  id: string;
  preparationId: string;
  segmentationVersionId: string;
  selectedAxis: Vec3;
  candidates: AxisCandidate[];
  locked: boolean;
  source: 'automatic' | 'manual';
  analyzedAt: string;
}

export interface PreparationMeasurements {
  preparationId: string;
  occlusalReductionMm: number | null;
  axialReductionMm: number | null;
  incisalReductionMm: number | null;
  buccalReductionMm: number | null;
  lingualReductionMm: number | null;
  proximalReductionMm: number | null;
  heightMm: number;
  widthMm: number;
  surfaceAreaMm2: number;
  convergenceDegrees: number | null;
  undercutDepthMm: number;
  marginCircumferenceMm: number | null;
  finishLineWidthMm: number | null;
  minimumLocalRadiusMm: number | null;
  sharpInternalFeatureCount: number;
  antagonistClearanceMm: number | null;
  adjacentClearanceMm: number | null;
  preoperativeReferenceAvailable: boolean;
  preoperativeReductionSamplesMm: number[];
  preoperativeReductionMap: Array<{ position: Vec3; reductionMm: number }>;
}

export type PreparationQcStatus = 'pass' | 'warning' | 'fail' | 'not-run';

export interface PreparationQcRule {
  id: string;
  version: string;
  restorationKinds: PreparationKind[];
  materialId: string;
  measurement: keyof PreparationMeasurements | 'margin-quality' | 'classification-support' | 'scan-completeness';
  minimum: number | null;
  maximum: number | null;
  severity: 'warning' | 'fail';
  explanation: string;
}

export interface PreparationQcCheck {
  id: string;
  status: PreparationQcStatus;
  measuredValue: number | string | boolean | null;
  threshold: string;
  affectedElementIds: string[];
  explanation: string;
}

export interface PreparationQcResult {
  id: string;
  preparationId: string;
  marginVersionId: string | null;
  rulesetVersion: string;
  materialId: string;
  checks: PreparationQcCheck[];
  overall: 'pass' | 'warning' | 'fail';
  warningCount: number;
  failureCount: number;
  executedAt: string;
}

export interface MarginQualityResult {
  valid: boolean;
  checks: PreparationQcCheck[];
  defectiveSegmentIndices: number[];
  orientation: 'clockwise' | 'counter-clockwise' | 'indeterminate';
  enclosureRatio: number;
}

export type MarginLineageStage =
  | 'automatic-candidate'
  | 'technician-review'
  | 'manual-modification'
  | 'qc'
  | 'approved'
  | 'locked';

export interface MarginCommandRecord {
  commandId: string;
  commandType: string;
  label: string;
  executedAt: string;
  parameters: Record<string, number | string | boolean | null>;
}

export interface MarginVersion {
  id: string;
  preparationId: string;
  parentVersionId: string | null;
  preparationVersionId: string;
  detectionEngineVersion: string;
  candidateSourceId: string | null;
  stage: MarginLineageStage;
  curve: SurfaceCurve;
  confidenceMeasurements: MarginSegmentEvidence[];
  manualAdjustments: MarginCommandRecord[];
  quality: MarginQualityResult | null;
  qcResultId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  locked: boolean;
  createdAt: string;
}

export interface PreparationRecord {
  id: string;
  candidateId: string | null;
  sceneObjectId: string;
  artifactId: string;
  name: string;
  toothNumber: string | null;
  kind: PreparationKind;
  segmentationVersionIds: string[];
  activeSegmentationVersionId: string | null;
  insertionAxisAnalysisIds: string[];
  activeInsertionAxisAnalysisId: string | null;
  marginVersionIds: string[];
  activeMarginVersionId: string | null;
  approvedMarginVersionId: string | null;
  materialRuleId: string;
  measurements: PreparationMeasurements | null;
  qcResultIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PreparationProjectState {
  schemaVersion: 1;
  engineVersion: string;
  candidates: PreparationCandidate[];
  preparations: PreparationRecord[];
  segmentations: PreparationSegmentation[];
  axes: InsertionAxisAnalysis[];
  margins: MarginVersion[];
  qcResults: PreparationQcResult[];
  rejectedMarginCandidateIds: string[];
  activePreparationId: string | null;
  bridgeGroups: Array<{ id: string; preparationIds: string[]; commonAxis: Vec3 | null; conflict: boolean; conflictDegrees: number | null }>;
  settings: {
    confidenceOverlayVisible: boolean;
    undercutOverlayVisible: boolean;
    magnetEnabled: boolean;
    magnetStrength: number;
    magnetSearchRadiusMm: number;
    curvatureWeight: number;
    surfaceNormalWeight: number;
    smoothing: number;
  };
}

export interface PreparationAnalysisRequest {
  requestId: string;
  artifactId: string;
  sceneObjectId: string;
  mesh: import('./core').MeshData;
  dentalAxis: Vec3;
  mode: 'detect-preparations' | 'detect-margins' | 'analyze-axis' | 'analyze-qc';
  preparation?: PreparationRecord;
  segmentation?: PreparationSegmentation;
  margin?: MarginVersion;
  materialRuleId?: string;
  preoperativeMesh?: import('./core').MeshData;
  antagonistMesh?: import('./core').MeshData;
  adjacentMeshes?: import('./core').MeshData[];
  manualAxis?: Vec3;
}

export interface PreparationAnalysisProgress {
  requestId: string;
  stage: string;
  completed: number;
  total: number;
  message: string;
}

export interface PreparationAnalysisResponse {
  requestId: string;
  candidates?: PreparationCandidate[];
  marginCandidates?: MarginCandidate[];
  axis?: InsertionAxisAnalysis;
  measurements?: PreparationMeasurements;
  marginQuality?: MarginQualityResult;
  qc?: PreparationQcResult;
  durationMs: number;
}

export function createPreparationProjectState(): PreparationProjectState {
  return {
    schemaVersion: 1,
    engineVersion: PREPARATION_ENGINE_VERSION,
    candidates: [], preparations: [], segmentations: [], axes: [], margins: [], qcResults: [], rejectedMarginCandidateIds: [], activePreparationId: null, bridgeGroups: [],
    settings: {
      confidenceOverlayVisible: true,
      undercutOverlayVisible: false,
      magnetEnabled: true,
      magnetStrength: 0.75,
      magnetSearchRadiusMm: 1.25,
      curvatureWeight: 0.55,
      surfaceNormalWeight: 0.35,
      smoothing: 0.2,
    },
  };
}
