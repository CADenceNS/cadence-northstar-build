import type { ArtifactRecord, Quat, Transform, Vec3 } from './core';

export type ScanRole =
  | 'upper-arch'
  | 'lower-arch'
  | 'buccal-bite-left'
  | 'buccal-bite-right'
  | 'buccal-bite-anterior'
  | 'full-bite'
  | 'pre-operative-upper'
  | 'pre-operative-lower'
  | 'preparation-arch'
  | 'preparation-segment'
  | 'gingiva'
  | 'implant-arch'
  | 'scan-body'
  | 'wax-up'
  | 'temporary'
  | 'facial-scan'
  | 'reference-scan'
  | 'cbct-derived-surface'
  | 'unknown';

export const SCAN_ROLES: ReadonlyArray<{ value: ScanRole; label: string }> = [
  { value: 'upper-arch', label: 'Upper arch' },
  { value: 'lower-arch', label: 'Lower arch' },
  { value: 'buccal-bite-left', label: 'Buccal bite — left' },
  { value: 'buccal-bite-right', label: 'Buccal bite — right' },
  { value: 'buccal-bite-anterior', label: 'Buccal bite — anterior' },
  { value: 'full-bite', label: 'Full bite' },
  { value: 'pre-operative-upper', label: 'Pre-operative upper' },
  { value: 'pre-operative-lower', label: 'Pre-operative lower' },
  { value: 'preparation-arch', label: 'Preparation arch' },
  { value: 'preparation-segment', label: 'Preparation segment' },
  { value: 'gingiva', label: 'Gingiva' },
  { value: 'implant-arch', label: 'Implant arch' },
  { value: 'scan-body', label: 'Scan body' },
  { value: 'wax-up', label: 'Wax-up' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'facial-scan', label: 'Facial scan' },
  { value: 'reference-scan', label: 'Reference scan' },
  { value: 'cbct-derived-surface', label: 'CBCT-derived surface' },
  { value: 'unknown', label: 'Unknown' },
];

export type RegistrationOutcome = 'accepted' | 'accepted-with-warning' | 'manual-review-required' | 'failed' | 'cancelled';
export type RegistrationStatus = 'unregistered' | 'candidate' | 'accepted' | 'warning' | 'review' | 'failed' | 'cancelled';
export type RegistrationStage =
  | 'geometry-preparation'
  | 'deterministic-sampling'
  | 'coarse-alignment'
  | 'correspondence-search'
  | 'outlier-rejection'
  | 'multi-resolution-refinement'
  | 'fine-surface-registration'
  | 'bidirectional-verification'
  | 'confidence-calculation'
  | 'complete';

export interface RigidTransform {
  /** Row-major rigid 4x4 matrix. Immutable source coordinates are never rewritten. */
  matrix: number[];
  translation: Vec3;
  rotation: Quat;
}

export interface RegistrationStageTiming {
  stage: RegistrationStage;
  durationMs: number;
}

export interface RegistrationMetrics {
  rmsResidual: number;
  medianResidual: number;
  percentile95Residual: number;
  maximumAcceptedResidual: number;
  inlierCount: number;
  outlierCount: number;
  inlierRatio: number;
  estimatedOverlapPercent: number;
  convergenceState: 'converged' | 'iteration-limit' | 'insufficient-correspondence' | 'cancelled' | 'not-run';
  iterationCount: number;
  translationMagnitude: number;
  rotationMagnitudeDegrees: number;
  bidirectionalConsistency: number;
  surfaceNormalAgreement: number | null;
  candidateAmbiguity: number;
  biteScanAgreement: number | null;
  interpenetrationIndicators: number;
  confidenceScore: number;
}

export interface RegistrationCorrespondence {
  id: number;
  source: Vec3;
  target: Vec3;
  distance: number;
  accepted: boolean;
  normalAgreement: number | null;
  penetrating: boolean;
}

export interface RegistrationCandidate {
  id: string;
  transform: RigidTransform;
  rmsResidual: number;
  overlapPercent: number;
  rank: number;
  ambiguous: boolean;
}

export interface PairwiseRegistrationResult {
  id: string;
  engineVersion: string;
  sourceArtifactId: string;
  targetArtifactId: string;
  sourceRole: ScanRole;
  targetRole: ScanRole;
  startedAt: string;
  completedAt: string;
  outcome: RegistrationOutcome;
  transform: RigidTransform | null;
  metrics: RegistrationMetrics;
  candidates: RegistrationCandidate[];
  correspondences: RegistrationCorrespondence[];
  timings: RegistrationStageTiming[];
  warnings: string[];
  errors: string[];
  deterministicFingerprint: string;
}

export interface ScanValidationIssue {
  id: string;
  status: 'pass' | 'warning' | 'fail' | 'confirmation-required';
  measuredValue: number | string | boolean | Record<string, number> | null;
  threshold: number | string | null;
  explanation: string;
}

export interface ScanValidationResult {
  artifactId: string;
  issues: ScanValidationIssue[];
  canRegisterAutomatically: boolean;
  unitsCertain: boolean;
  likelyMirrored: boolean;
  duplicateOf: string | null;
}

export interface ScanRegistrationHistoryEntry {
  id: string;
  at: string;
  action: string;
  actor: string | null;
  transform: RigidTransform | null;
  resultId?: string;
  detail?: string;
}

export interface UserRegistrationAdjustment {
  id: string;
  at: string;
  actor: string | null;
  method: 'three-point' | 'surface-points' | 'translation' | 'rotation' | 'nudge' | 'numeric-transform' | 'plane' | 'midline' | 'reverse-anterior';
  before: RigidTransform;
  after: RigidTransform;
  detail: string;
}

export interface CaseScanRecord {
  id: string;
  artifactId: string;
  sceneObjectId: string;
  fileHash: string;
  originalUnits: ArtifactRecord['units'];
  confirmedUnits: ArtifactRecord['units'];
  assignedRole: ScanRole;
  registrationTransform: RigidTransform;
  parentCaseId: string;
  registrationStatus: RegistrationStatus;
  confidence: RegistrationMetrics | null;
  validation: ScanValidationResult | null;
  registrationHistory: ScanRegistrationHistoryEntry[];
  userAdjustments: UserRegistrationAdjustment[];
  locked: boolean;
  unitsConfirmed: boolean;
  mirroredConfirmed: boolean;
}

export interface RegistrationRelationship {
  id: string;
  sourceScanId: string;
  targetScanId: string;
  purpose: 'pairwise' | 'bite-upper' | 'bite-lower' | 'occlusal-assembly' | 'reference' | 'pre-operative' | 'implant' | 'manual';
  status: RegistrationStatus;
  acceptedResultId: string | null;
  currentTransform: RigidTransform | null;
  results: PairwiseRegistrationResult[];
  locked: boolean;
  manuallyModified: boolean;
  updatedAt: string;
}

export interface DentalCoordinateSystem {
  version: number;
  convention: 'CADENCE_DENTAL_XYZ_V1';
  /** +X patient left, +Y posterior, +Z occlusal-to-gingival for the maxillary arch. */
  origin: Vec3;
  leftRightAxis: Vec3;
  anteriorPosteriorAxis: Vec3;
  occlusalGingivalAxis: Vec3;
  occlusalPlaneNormal: Vec3;
  midlineDirection: Vec3;
  anteriorDirection: Vec3;
  archNormal: Vec3;
  caseTransform: RigidTransform;
  confidence: number;
  locked: boolean;
  manuallyCorrected: boolean;
  history: ScanRegistrationHistoryEntry[];
}

export interface TransformGraphEdge {
  id: string;
  sourceScanId: string;
  targetScanId: string | 'case-coordinate-system';
  relationshipId: string | null;
  transform: RigidTransform;
  status: RegistrationStatus;
}

export interface CaseScanSet {
  schemaVersion: 1;
  id: string;
  projectId: string;
  caseId: string | null;
  scans: CaseScanRecord[];
  relationships: RegistrationRelationship[];
  transformGraph: TransformGraphEdge[];
  dentalCoordinates: DentalCoordinateSystem | null;
  assemblyStatus: RegistrationStatus;
  assemblyConfidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredRegistrationReport {
  reportSchemaVersion: 1;
  id: string;
  projectId: string;
  caseId: string | null;
  engineVersion: string;
  generatedAt: string;
  generatedBy: string | null;
  artifactIds: string[];
  fileHashes: Record<string, string>;
  sourceTargetRoles: Array<{ source: ScanRole; target: ScanRole }>;
  transformMatrices: Record<string, number[]>;
  relationshipResults: PairwiseRegistrationResult[];
  assemblyStatus: RegistrationStatus;
  assemblyConfidence: number | null;
  biteAgreement: number | null;
  coordinateSystem: DentalCoordinateSystem | null;
  userCorrections: UserRegistrationAdjustment[];
  finalResult: RegistrationOutcome;
  resultFingerprint: string;
}

export interface RegistrationProgress {
  requestId: string;
  stage: RegistrationStage;
  progress: number;
  message: string;
}

export interface RegistrationOptions {
  maxIterations: number;
  sampleLimit: number;
  outlierFraction: number;
  convergenceTolerance: number;
  overlapThreshold: number;
  usePointToPlane: boolean;
  initialTransform?: RigidTransform;
}

export interface RegistrationRequest {
  requestId: string;
  source: { artifact: ArtifactRecord; role: ScanRole };
  target: { artifact: ArtifactRecord; role: ScanRole };
  options?: Partial<RegistrationOptions>;
}

export interface RegistrationStateSnapshot {
  scanSet: CaseScanSet;
  sceneTransforms: Record<string, Transform>;
}
