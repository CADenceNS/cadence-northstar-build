import type { MeshData, Vec3 } from './core';
import type { GeometryInspection } from './editing-types';

export const RESTORATION_ENGINE_VERSION = '1.0.0';
export const MORPHOLOGY_LIBRARY_VERSION = 'CADENCE-MORPHOLOGY-1.0.0';
export const CROWN_QC_RULESET_VERSION = 'CADENCE-CROWN-QC-1.0.0';

export type ToothMorphologyClass =
  | 'maxillary-central-incisor'
  | 'maxillary-lateral-incisor'
  | 'mandibular-central-incisor'
  | 'mandibular-lateral-incisor'
  | 'mandibular-incisor'
  | 'maxillary-canine'
  | 'mandibular-canine'
  | 'maxillary-first-premolar'
  | 'maxillary-second-premolar'
  | 'mandibular-first-premolar'
  | 'mandibular-second-premolar'
  | 'mandibular-premolar'
  | 'maxillary-first-molar'
  | 'maxillary-posterior-molar'
  | 'mandibular-first-molar'
  | 'mandibular-posterior-molar';

export interface MorphologyFeaturePoint {
  id: string;
  position: [number, number];
  height: number;
  width: number;
  functional: boolean;
}

export interface MorphologyGroove {
  id: string;
  start: [number, number];
  end: [number, number];
  depth: number;
  width: number;
}

export interface MorphologyDefinition {
  id: ToothMorphologyClass;
  version: string;
  label: string;
  toothNumbers: number[];
  crownDimensionsMm: { mesiodistal: number; buccolingual: number; height: number };
  facialContour: number;
  lingualContour: number;
  mesialContour: number;
  distalContour: number;
  cervicalContour: number;
  incisalAnatomy: number;
  cusps: MorphologyFeaturePoint[];
  marginalRidges: number;
  triangularRidges: number;
  transverseRidges: number;
  obliqueRidge: number;
  centralGroove: number;
  developmentalGrooves: MorphologyGroove[];
  supplementalGrooves: MorphologyGroove[];
  fossae: MorphologyFeaturePoint[];
  pits: MorphologyFeaturePoint[];
  occlusalTable: number;
  contactZones: { mesial: [number, number]; distal: [number, number] };
  embrasures: number;
  lineAngles: number;
  developmentalLobes: number;
  mamelonCount: number;
  wear: number;
  roundness: number;
  angularity: number;
  anatomyIntensity: number;
  generatorVersion: string;
  provenance: 'CADence proprietary procedural asset';
  approvalStatus: 'approved';
  compatibility: {
    minimumEngineVersion: string;
    restorationTypes: ['single-unit-tooth-supported-crown'];
    materialProfileIds: CrownMaterialId[];
  };
}

export type CrownMaterialId =
  | 'zirconia-monolithic'
  | 'zirconia-high-translucency'
  | 'lithium-disilicate'
  | 'pmma-provisional'
  | 'full-cast-metal'
  | 'pfm-coping'
  | 'hybrid-ceramic';

export interface CrownMaterialValidationRule {
  id: string;
  property: 'axial-thickness' | 'occlusal-thickness' | 'marginal-thickness' | 'internal-radius' | 'tool-access' | 'cement-space';
  severity: 'hard' | 'warning';
  explanation: string;
}

export interface CrownMaterialProfile {
  id: CrownMaterialId;
  version: string;
  label: string;
  minimumThicknessMm: { global: number; margin: number; axial: number; occlusal: number; incisal: number; cusp: number; fossa: number };
  cementGapMm: { minimum: number; maximum: number; default: number };
  marginalGapMm: { minimum: number; maximum: number; default: number };
  contactDistanceMm: { minimum: number; maximum: number; target: number };
  occlusalClearanceMm: { minimum: number; maximum: number; target: number };
  manufacturingCompensationPercent: { minimum: number; maximum: number; default: number };
  minimumInternalRadiusMm: number;
  manufacturingAllowanceMm: number;
  toolAccessAllowanceMm: number;
  minimumMillingToolDiameterMm: number | null;
  maximumSharpProjectionDegrees: number;
  compatibility: {
    restorationTypes: ['single-unit-tooth-supported-crown'];
    manufacturingModes: Array<'milled' | 'printed-pattern' | 'cast' | 'pressed' | 'layered'>;
  };
  validationRules: CrownMaterialValidationRule[];
  governance: {
    status: 'repository-governed';
    source: 'CADence Design Studio material configuration';
    clinicalApprovalClaimed: false;
  };
}

export interface CrownParameters {
  morphologyId: ToothMorphologyClass;
  mesiodistalScale: number;
  buccolingualScale: number;
  heightScale: number;
  facialContour: number;
  lingualContour: number;
  mesialContour: number;
  distalContour: number;
  cervicalContour: number;
  cuspHeight: number;
  cuspInclination: number;
  ridgeIntensity: number;
  grooveDepth: number;
  occlusalTableScale: number;
  embrasureScale: number;
  contactZoneScale: number;
  lineAngleIntensity: number;
  lobeIntensity: number;
  mamelonIntensity: number;
  wear: number;
  roundness: number;
  angularity: number;
  anatomyIntensity: number;
  marginalGapMm: number;
  cementGapMm: number;
  spacerStartMm: number;
  axialSpacerMm: number;
  occlusalSpacerMm: number;
  localReliefMm: number;
  localSpacerOverrideMm: number;
  localSpacerCenterX: number;
  localSpacerCenterY: number;
  localSpacerRadius: number;
  sharpFeatureReliefMm: number;
  internalRadiusMm: number;
  millingToolDiameterMm: number;
  toolAccessAllowanceMm: number;
  manufacturingCompensationPercent: number;
  targetMesialContactMm: number;
  targetDistalContactMm: number;
  targetOcclusalClearanceMm: number;
  emergenceAngleDegrees: number;
  emergenceConvexity: number;
  emergenceConcavity: number;
  facialEmergence: number;
  lingualEmergence: number;
  mesialEmergence: number;
  distalEmergence: number;
  localEmergenceX: number;
  localEmergenceY: number;
  localEmergenceRadius: number;
  localEmergenceStrength: number;
  facialFullness: number;
  lingualFullness: number;
  cervicalFullness: number;
  contactProminence: number;
  attrition: number;
  flattening: number;
  incisalTranslucencySpaceMm: number;
  radialSegments: number;
  surfaceRings: number;
}

export interface CrownLocks {
  margin: boolean;
  intaglio: boolean;
  mesialContact: boolean;
  distalContact: boolean;
  occlusion: boolean;
  facialContour: boolean;
  lingualContour: boolean;
  selectedAnatomy: boolean;
  anatomy: boolean;
}

export type RestorationApprovalState =
  | 'DESIGNING'
  | 'QC_REQUIRED'
  | 'REVIEW_REQUIRED'
  | 'DRAFT'
  | 'PROPOSAL_GENERATED'
  | 'TECHNICIAN_EDITED'
  | 'QC_FAILED'
  | 'QC_PASSED'
  | 'APPROVED_FOR_EXPORT'
  | 'LOCKED';

export type CrownRegion = 'margin' | 'axial' | 'occlusal' | 'incisal' | 'cusp' | 'fossa';

export interface CrownTopologyMap {
  outerVertexIds: number[];
  innerVertexIds: number[];
  marginOuterVertexIds: number[];
  marginInnerVertexIds: number[];
  outerToInner: Record<number, number>;
  regions: Record<number, CrownRegion>;
}

export interface ThicknessSample {
  outerVertexId: number;
  innerVertexId: number;
  position: Vec3;
  thicknessMm: number;
  minimumMm: number;
  region: CrownRegion;
  status: 'pass' | 'warning' | 'fail';
}

export interface ThicknessAnalysis {
  id: string;
  globalMinimumMm: number;
  byRegion: Record<CrownRegion, number | null>;
  samples: ThicknessSample[];
  failingVertexIds: number[];
  analyzedAt: string;
}

export interface ContactPatch {
  vertexIds: number[];
  areaMm2: number;
  center: Vec3;
  heightMm: number;
  widthMm: number;
}

export interface ProximalContactAnalysis {
  id: string;
  side: 'mesial' | 'distal';
  adjacentObjectId: string | null;
  minimumDistanceMm: number | null;
  penetrationMm: number;
  clearanceMm: number | null;
  patches: ContactPatch[];
  distanceSamples: Array<{ vertexId: number; position: Vec3; distanceMm: number; inside: boolean }>;
  status: 'pass' | 'warning' | 'fail' | 'not-run';
  analyzedAt: string;
}

export interface OcclusionAnalysis {
  id: string;
  antagonistObjectId: string | null;
  minimumDistanceMm: number | null;
  maximumPenetrationMm: number;
  minimumClearanceMm: number | null;
  contactPatches: ContactPatch[];
  distanceSamples: Array<{ vertexId: number; position: Vec3; distanceMm: number; inside: boolean }>;
  status: 'pass' | 'warning' | 'fail' | 'not-run';
  analyzedAt: string;
}

export interface SeatingPathSample {
  offsetMm: number;
  collisionCount: number;
  minimumClearanceMm: number | null;
  collidingVertexIds: number[];
}

export interface SeatingAnalysis {
  id: string;
  insertionAxis: Vec3;
  pathLengthMm: number;
  samples: SeatingPathSample[];
  seated: boolean;
  maximumPenetrationMm: number;
  blockingVertexIds: number[];
  status: 'pass' | 'fail';
  analyzedAt: string;
}

export interface CementSpaceAnalysis {
  id: string;
  requestedMarginalGapMm: number;
  requestedAxialGapMm: number;
  requestedOcclusalGapMm: number;
  measuredMinimumMm: number;
  measuredMaximumMm: number;
  measuredMeanMm: number;
  sampleCount: number;
  invalidSampleVertexIds: number[];
  status: 'pass' | 'fail';
}

export interface ContourAnalysis {
  id: string;
  overContouredVertexIds: number[];
  underContouredVertexIds: number[];
  maximumOverContourMm: number;
  maximumUnderContourMm: number;
  referenceObjectId: string | null;
  references: Array<{
    kind: ContourReferenceKind;
    objectId: string;
    maximumOverContourMm: number;
    maximumUnderContourMm: number;
    overContouredVertexIds: number[];
    underContouredVertexIds: number[];
  }>;
  regions: Record<ContourRegion, { maximumOverContourMm: number; maximumUnderContourMm: number; affectedVertexIds: number[] }>;
  status: 'pass' | 'warning' | 'not-run';
}

export type ContourReferenceKind = 'preparation' | 'adjacent' | 'pre-op' | 'contralateral' | 'arch';
export type ContourRegion = 'facial' | 'lingual' | 'cervical' | 'proximal';

export interface CrownReferenceAdaptation {
  mode: 'none' | 'copy' | 'partial-copy' | 'preserve-facial' | 'preserve-incisal' | 'preserve-occlusal-table' | 'preserve-selected-region' | 'blend';
  influence: number;
  selectedRegion: { centerX: number; centerY: number; radius: number } | null;
}

export interface CrownOptimizationEvidence {
  id: string;
  status: 'converged' | 'best-effort' | 'constraint-conflict';
  objectiveTerms: {
    mesialContactErrorMm: number | null;
    distalContactErrorMm: number | null;
    occlusalClearanceErrorMm: number | null;
    thicknessDeficitMm: number;
    morphologyDisplacementRmsMm: number;
  };
  constraintViolations: string[];
  iterationCount: number;
  convergenceTolerance: number;
  before: { mesialDistanceMm: number | null; distalDistanceMm: number | null; occlusalDistanceMm: number | null; minimumThicknessMm: number };
  after: { mesialDistanceMm: number | null; distalDistanceMm: number | null; occlusalDistanceMm: number | null; minimumThicknessMm: number };
  executedAt: string;
}

export interface CrownQcCheck {
  id: string;
  status: 'pass' | 'warning' | 'fail' | 'not-run';
  measuredValue: number | string | boolean | null;
  threshold: string;
  affectedElementIds: string[];
  explanation: string;
  hardFailure: boolean;
}

export interface CrownQcResult {
  id: string;
  restorationId: string;
  rulesetVersion: string;
  materialProfileId: CrownMaterialId;
  checks: CrownQcCheck[];
  overall: 'pass' | 'warning' | 'fail';
  warningCount: number;
  failureCount: number;
  hardFailureCount: number;
  executedAt: string;
}

export interface RestorationVersion {
  id: string;
  restorationId: string;
  parentVersionId: string | null;
  version: number;
  artifactId: string;
  operation: string;
  commandId: string;
  branchId: string;
  checkpointName: string | null;
  morphologyVersion: string;
  materialProfileId: CrownMaterialId;
  materialProfileVersion: string;
  marginVersionId: string;
  parameters: Record<string, number | string | boolean | null>;
  inspection: GeometryInspection;
  createdAt: string;
}

export type CrownExportFormat = 'binary-stl' | 'ascii-stl' | 'obj' | 'ply';

export interface CrownRoundTripResult {
  format: CrownExportFormat;
  checksum: string;
  byteLength: number;
  maximumSurfaceDeviationMm: number;
  meanSurfaceDeviationMm: number;
  dimensionDeviationMm: Vec3;
  volumeDeviationMm3: number;
  areaDeviationMm2: number;
  orientationPreserved: boolean;
  scalePreserved: boolean;
  triangleCountPreserved: boolean;
  watertight: boolean;
  selfIntersectionCount: number;
  passed: boolean;
  toleranceMm: number;
}

export interface CrownExportRecord {
  id: string;
  restorationId: string;
  versionId: string;
  format: CrownExportFormat;
  fileName: string;
  createdAt: string;
  roundTrip: CrownRoundTripResult;
  metadata: {
    caseId: string;
    restorationId: string;
    toothNumber: string;
    numberingSystem: ToothNumberingSystem;
    materialProfileId: CrownMaterialId;
    units: 'mm';
    geometryHash: string;
    designVersion: number;
    marginVersion: string;
    morphologyVersion: string;
    materialProfileVersion: string;
    qcResultId: string;
    exportedAt: string;
  };
}

export type ToothNumberingSystem = 'UNIVERSAL' | 'FDI' | 'PALMER';
export type DentalArch = 'MAXILLARY' | 'MANDIBULAR';
export type RestorationType = 'SINGLE_UNIT_TOOTH_SUPPORTED_CROWN';
export type ManufacturingState = 'NOT_READY' | 'QC_REQUIRED' | 'READY_FOR_EXPORT' | 'EXPORTED' | 'LOCKED';

export interface RestorationHistoryEvent {
  id: string;
  restorationId: string;
  versionId: string | null;
  type: 'created' | 'geometry-command' | 'qc' | 'approval' | 'override' | 'export' | 'checkpoint' | 'restore' | 'duplicate' | 'branch';
  commandId: string | null;
  actor: string | null;
  reason: string | null;
  details: Record<string, number | string | boolean | null>;
  createdAt: string;
}

export interface RestorationCheckpoint {
  id: string;
  restorationId: string;
  versionId: string;
  name: string;
  branchId: string;
  createdAt: string;
}

export interface RestorationRecord {
  id: string;
  caseId: string;
  numberingSystem: ToothNumberingSystem;
  arch: DentalArch;
  restorationType: RestorationType;
  preparationId: string;
  preparationVersionId: string;
  approvedMarginVersionId: string;
  insertionAxisAnalysisId: string;
  toothNumber: string;
  morphologyId: ToothMorphologyClass;
  morphologyVersion: string;
  materialProfileId: CrownMaterialId;
  materialProfileVersion: string;
  materialProfileSnapshot: CrownMaterialProfile;
  adjacentObjectIds: { mesial: string | null; distal: string | null };
  opposingObjectId: string | null;
  preOpObjectId: string | null;
  contourReferenceObjectIds?: Partial<Record<ContourReferenceKind, string[]>>;
  referenceAdaptation: CrownReferenceAdaptation;
  designVersion: number;
  manufacturingState: ManufacturingState;
  geometryLineageRootArtifactId: string;
  activeBranchId: string;
  artifactId: string | null;
  sceneObjectId: string | null;
  parameters: CrownParameters;
  locks: CrownLocks;
  topologyMap: CrownTopologyMap | null;
  thickness: ThicknessAnalysis | null;
  cementSpace: CementSpaceAnalysis | null;
  seating: SeatingAnalysis | null;
  mesialContact: ProximalContactAnalysis | null;
  distalContact: ProximalContactAnalysis | null;
  occlusion: OcclusionAnalysis | null;
  contour: ContourAnalysis | null;
  optimization: CrownOptimizationEvidence | null;
  sculptMaskVertexIds: number[];
  lockedAnatomyVertexIds: number[];
  qcResultIds: string[];
  activeQcResultId: string | null;
  versionIds: string[];
  activeVersionId: string | null;
  exportRecordIds: string[];
  historyEventIds: string[];
  checkpointIds: string[];
  approvalState: RestorationApprovalState;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestorationProjectState {
  schemaVersion: 2;
  engineVersion: string;
  morphologyVersion: string;
  restorations: RestorationRecord[];
  versions: RestorationVersion[];
  qcResults: CrownQcResult[];
  exports: CrownExportRecord[];
  historyEvents: RestorationHistoryEvent[];
  checkpoints: RestorationCheckpoint[];
  activeRestorationId: string | null;
  settings: {
    thicknessOverlayVisible: boolean;
    contactOverlayVisible: boolean;
    occlusionOverlayVisible: boolean;
    intaglioVisible: boolean;
    contourOverlayVisible: boolean;
    lockOverlayVisible: boolean;
    maskOverlayVisible: boolean;
    optimizerOverlayVisible: boolean;
    decimalPrecision: number;
  };
}

export interface CrownGenerationInput {
  requestId: string;
  preparationId: string;
  preparationArtifactId: string;
  preparationMesh: MeshData;
  marginPoints: Vec3[];
  insertionAxis: Vec3;
  toothNumber: string;
  caseId: string;
  numberingSystem: ToothNumberingSystem;
  arch: DentalArch;
  dentalAxes: { mesial: Vec3; facial: Vec3; occlusal: Vec3 };
  materialProfileId: CrownMaterialId;
  parameters: CrownParameters;
  adjacentMeshes: Array<{ objectId: string; side: 'mesial' | 'distal'; mesh: MeshData }>;
  antagonist?: { objectId: string; mesh: MeshData };
  reference?: { objectId: string; kind: 'pre-op' | 'contralateral' | 'wax-up' | 'neighbor-morphology'; mesh: MeshData };
  referenceAdaptation: CrownReferenceAdaptation;
  contourReferences: Array<{ objectId: string; kind: ContourReferenceKind; mesh: MeshData }>;
}

export interface CrownGenerationProgress {
  requestId: string;
  stage: string;
  completed: number;
  total: number;
  message: string;
}

export interface CrownGenerationPerformance {
  totalDurationMs: number;
  solidConstructionMs: number;
  morphologyGenerationMs: number;
  intaglioGenerationMs: number;
  spacerCalculationMs: number;
  thicknessAnalysisMs: number;
  cementSpaceAnalysisMs: number;
  seatingAnalysisMs: number;
  contactCalculationMs: number;
  occlusalCalculationMs: number;
  contourAnalysisMs: number;
}

export interface CrownGenerationResult {
  requestId: string;
  mesh: MeshData;
  topologyMap: CrownTopologyMap;
  inspection: GeometryInspection;
  thickness: ThicknessAnalysis;
  cementSpace: CementSpaceAnalysis;
  seating: SeatingAnalysis;
  mesialContact: ProximalContactAnalysis;
  distalContact: ProximalContactAnalysis;
  occlusion: OcclusionAnalysis;
  contour: ContourAnalysis;
  durationMs: number;
  performance: CrownGenerationPerformance;
  warnings: string[];
}

export function createRestorationProjectState(): RestorationProjectState {
  return {
    schemaVersion: 2,
    engineVersion: RESTORATION_ENGINE_VERSION,
    morphologyVersion: MORPHOLOGY_LIBRARY_VERSION,
    restorations: [],
    versions: [],
    qcResults: [],
    exports: [],
    historyEvents: [],
    checkpoints: [],
    activeRestorationId: null,
    settings: { thicknessOverlayVisible: true, contactOverlayVisible: true, occlusionOverlayVisible: true, intaglioVisible: false, contourOverlayVisible: false, lockOverlayVisible: false, maskOverlayVisible: false, optimizerOverlayVisible: false, decimalPrecision: 3 },
  };
}
