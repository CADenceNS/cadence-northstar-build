import type { MeshData, Vec3 } from './core';
import type { Bounds3 } from './geometry';

export type ComponentKind = 'object' | 'vertex' | 'edge' | 'face';
export type ComponentSelectionMode =
  | 'object'
  | 'vertex'
  | 'edge'
  | 'face'
  | 'connected-region'
  | 'shell'
  | 'boundary-loop'
  | 'edge-loop'
  | 'edge-ring'
  | 'paint'
  | 'lasso'
  | 'rectangle'
  | 'normal-angle'
  | 'connectivity';

export interface MeshComponentSelection {
  objectId: string;
  artifactId: string;
  kind: ComponentKind;
  ids: number[];
  mode: ComponentSelectionMode;
  updatedAt: string;
}

export type CoordinateMode = 'global' | 'local';

export interface TransformToolSettings {
  coordinateMode: CoordinateMode;
  pivot: Vec3 | null;
  translationSnapMm: number;
  angularSnapDegrees: number;
  surfaceSnap: boolean;
}

export interface SurfaceCurve {
  id: string;
  name: string;
  kind: 'polyline' | 'spline' | 'surface-projected';
  objectId: string | null;
  artifactId: string | null;
  controlPoints: Vec3[];
  sampledPoints: Vec3[];
  closed: boolean;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeometryInspection {
  vertexCount: number;
  triangleCount: number;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  shellCount: number;
  surfaceAreaMm2: number;
  volumeMm3: number | null;
  watertight: boolean;
  boundingDimensionsMm: Vec3;
  selfIntersectionCount: number;
}

export interface GeometryVersion {
  id: string;
  rootArtifactId: string;
  parentArtifactId: string;
  derivedArtifactId: string;
  operationId: string;
  operation: string;
  createdAt: string;
  before: GeometryInspection;
  after: GeometryInspection;
  beforeQuality: TriangleQualityReport;
  afterQuality: TriangleQualityReport;
}

export interface TriangleQualityReport {
  triangleCount: number;
  minimumAngleDegrees: number;
  averageMinimumAngleDegrees: number;
  worstAspectRatio: number;
  averageAspectRatio: number;
  belowQualityThresholdCount: number;
}

export interface EditingProjectState {
  schemaVersion: 1;
  componentSelections: MeshComponentSelection[];
  curves: SurfaceCurve[];
  geometryVersions: GeometryVersion[];
  transformSettings: TransformToolSettings;
  toolSettings: Record<string, Record<string, number | string | boolean>>;
}

export type ToolSelectionRequirement = 'none' | 'object' | 'objects:2' | 'component' | 'vertex' | 'edge' | 'face' | 'faces' | 'boundary-loop' | 'curve';
export type ToolCategory = 'selection' | 'transform' | 'curve' | 'mesh' | 'cut' | 'boolean' | 'topology';

export interface ToolParameterDefinition {
  id: string;
  label: string;
  type: 'number' | 'boolean' | 'select';
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
  units?: 'mm' | 'degrees' | 'percent' | 'triangles';
}

export interface ToolDefinition {
  id: string;
  label: string;
  category: ToolCategory;
  description: string;
  selection: ToolSelectionRequirement;
  parameters: readonly ToolParameterDefinition[];
  shortcut?: string;
  destructive: boolean;
  workerBacked: boolean;
}

export interface ToolProgress {
  phase: string;
  completed: number;
  total: number;
  message: string;
}

export interface ToolRuntimeState {
  activeToolId: string | null;
  parameters: Record<string, number | string | boolean>;
  phase: 'idle' | 'active' | 'previewing' | 'ready' | 'executing' | 'error';
  progress: ToolProgress | null;
  error: string | null;
}

export interface GeometryOperationOutput {
  mesh: MeshData;
  additionalMeshes?: MeshData[];
  beforeInspection: GeometryInspection;
  inspection: GeometryInspection;
  additionalInspections?: GeometryInspection[];
  beforeQuality: TriangleQualityReport;
  quality: TriangleQualityReport;
  additionalQualities?: TriangleQualityReport[];
  bounds: Bounds3;
  warnings: string[];
  elementMap?: {
    vertices?: Record<number, number>;
    edges?: Record<number, number>;
    faces?: Record<number, number>;
  };
}

export interface ToolCoverageEntry {
  id: string;
  label: string;
  category: ToolCategory;
  algorithm: string;
  deterministicTest: string;
  browserTest: string;
  commandIntegrated: true;
  persisted: true;
  recovery: true;
  implemented: true;
}

export function createEditingProjectState(): EditingProjectState {
  return {
    schemaVersion: 1,
    componentSelections: [],
    curves: [],
    geometryVersions: [],
    transformSettings: {
      coordinateMode: 'global',
      pivot: null,
      translationSnapMm: 0,
      angularSnapDegrees: 0,
      surfaceSnap: false,
    },
    toolSettings: {},
  };
}
