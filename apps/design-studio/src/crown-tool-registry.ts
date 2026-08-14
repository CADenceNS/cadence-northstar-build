import { CROWN_ANATOMY_OPERATIONS } from './crown-anatomy';
import { CROWN_SCULPT_MODES } from './crown-geometry';
import { CROWN_MATERIAL_PROFILES } from './morphology-core';

export interface CrownToolCoverageEntry {
  toolId: string;
  label: string;
  category: string;
  productionStatus: 'IMPLEMENTED_PENDING_CERTIFICATION' | 'PRODUCTION_READY';
  geometryOperation: string;
  inputRequirements: string;
  algorithm: string;
  commandCoverage: string;
  undoRedo: true;
  persistence: true;
  recovery: true;
  qcDependencies: string[];
  deterministicEvidence: string[];
  browserEvidence: string[];
  performanceEvidence: string[];
  failClosedConditions: string;
}

type Seed = Omit<CrownToolCoverageEntry, 'productionStatus' | 'undoRedo' | 'persistence' | 'recovery'>;

const direct = (toolId: string, label: string, category: string, geometryOperation: string, inputRequirements: string, algorithm: string, deterministicEvidence: string[], browserEvidence: string[], failClosedConditions: string, commandCoverage = 'CrownGeometryCommand through the shared CommandBus'): Seed => ({
  toolId, label, category, geometryOperation, inputRequirements, algorithm, commandCoverage,
  qcDependencies: ['crown-qc.ts measured topology and restoration-specific gates'], deterministicEvidence, browserEvidence,
  performanceEvidence: ['crown-failure-performance.test.ts measured operation timing and heap evidence'], failClosedConditions,
});

const generationEvidence = ['crown-generation.test.ts']; const analysisEvidence = ['crown-analysis-qc.test.ts', 'crown-required-failure-corpus.test.ts']; const editingEvidence = ['crown-sculpt-anatomy.test.ts']; const historyEvidence = ['crown-history-materials.test.ts', 'crown-command-persistence.test.ts']; const browserEvidence = ['design-studio-single-crown.spec.mjs'];

const core: Seed[] = [
  direct('crown.project-model', 'Restoration project model', 'project', 'Persist versioned restoration metadata and lineage', 'Approved preparation lineage and project identity', 'Schema-v2 normalized restoration entity with governed profile snapshots and immutable event references', historyEvidence, browserEvidence, 'Missing preparation, margin, axis, profile, or source lineage', 'CrownProposalCommand and RestorationStateCommand'),
  direct('crown.morphology', 'CADence procedural morphology', 'proposal', 'Generate governed editable crown anatomy for every permanent tooth position', 'Tooth number, dental axes, governed morphology parameters and material profile', 'Versioned CADence-owned parametric definitions evaluate cusps, ridges, grooves, fossae, contours, contacts, wear and anterior anatomy into model-space crown geometry', ['crown-generation.test.ts', 'crown-golden-corpus.test.ts'], browserEvidence, 'Unsupported tooth, incompatible profile, invalid parameter, or unvalidated geometry', 'CrownProposalCommand and CrownGeometryCommand'),
  direct('crown.proposal', 'Automatic crown proposal', 'proposal', 'Generate an actual closed crown solid', 'Approved preparation, margin, insertion axis, dental axes, tooth and material', 'Preparation-axis surface sampling, CADence parametric morphology, paired intaglio topology and strict geometry validation', generationEvidence, browserEvidence, 'Missing approval lineage, invalid parameters, or corrupt output', 'CrownProposalCommand'),
  direct('crown.reference-adaptation', 'Pre-op/reference adaptation', 'proposal', 'Adapt outer crown vertices to assigned reference geometry', 'Finite pre-op, contralateral, neighbor or wax-up reference plus mode/influence', 'Reference sampling with whole, partial, facial, incisal, occlusal-table or selected-region influence masks', generationEvidence, browserEvidence, 'Reference samples outside coverage or invalid influence'),
  direct('crown.emergence', 'Cervical and emergence design', 'proposal', 'Modify cervical model-space contour without moving the approved margin ring', 'Directional/local emergence parameters and approved margin', 'Parameterized angle, convexity, concavity, directional fullness and compact local field', generationEvidence, browserEvidence, 'Invalid parameters, margin movement, or corrupt output'),
  direct('crown.intaglio', 'Intaglio and cement-space engine', 'fit', 'Generate actual internal crown geometry', 'Preparation, margin, axis, material, spacer and relief parameters', 'Barycentric preparation sampling, local spacer field, relief, rounded internal transitions, tool-radius/access compensation', generationEvidence, browserEvidence, 'Out-of-profile gap, invalid radius/tool access, collision, inversion, open margin, or corrupt output'),
  direct('crown.seating', 'Seating-path simulation', 'fit', 'Measure full insertion path against preparation geometry', 'Crown intaglio, preparation and insertion axis', 'Multi-position signed closest-surface collision sampling', analysisEvidence, browserEvidence, 'Any full-path collision or impossible seat'),
  direct('crown.contact-mesial', 'Mesial contact analysis', 'contact', 'Measure actual mesial surface distance and contact patches', 'Mesial adjacent mesh', 'Signed closest-triangle distances and connected patch area, height, width and location', analysisEvidence, browserEvidence, 'Missing adjacent mesh or out-of-profile result'),
  direct('crown.contact-distal', 'Distal contact analysis', 'contact', 'Measure actual distal surface distance and contact patches', 'Distal adjacent mesh', 'Signed closest-triangle distances and connected patch area, height, width and location', analysisEvidence, browserEvidence, 'Missing adjacent mesh or out-of-profile result'),
  direct('crown.contact-optimize', 'Dynamic proximal contact correction', 'contact', 'Move local proximal crown vertices to governed distance targets', 'Adjacent mesh, target and unlocked side', 'Bounded nearest-surface displacement with deterministic backtracking to the largest topology-valid step', analysisEvidence, browserEvidence, 'Lock conflict, empty surface, or corrupt output'),
  direct('crown.occlusion-static', 'Static occlusion analysis', 'occlusion', 'Measure actual antagonist distance and patches', 'Assigned antagonist mesh', 'Signed closest-triangle distance on cusp, fossa, table and incisal vertices', analysisEvidence, browserEvidence, 'Missing antagonist or out-of-profile result'),
  direct('crown.occlusion-correct', 'Static occlusal correction', 'occlusion', 'Move local occlusal and incisal crown vertices to clearance target', 'Antagonist, target and unlocked occlusion', 'Bounded nearest-surface displacement with deterministic backtracking and geometry validation', analysisEvidence, browserEvidence, 'Occlusion lock or corrupt output'),
  direct('crown.optimizer-joint', 'Joint proximal and occlusal optimizer', 'optimization', 'Jointly optimize mesial, distal, occlusal and thickness geometry', 'Both adjacent meshes, antagonist, targets, material and locks', 'Deterministic bounded iteration minimizing target errors, thickness deficits and morphology RMS displacement with convergence evidence', ['crown-analysis-qc.test.ts'], browserEvidence, 'Missing target surfaces, lock conflict, non-convergence, or corrupt output'),
  direct('crown.morph-global', 'Global crown morph', 'anatomy', 'Scale unlocked outer crown geometry in model coordinates', 'Active crown, numeric XYZ scales and locks', 'Anisotropic model-space outer topology scaling with margin, intaglio and region locks', editingEvidence, browserEvidence, 'Scale outside 0.7–1.3, lock conflict, or corrupt output'),
  direct('crown.thickness', 'Minimum-thickness engine', 'analysis', 'Measure paired outer and intaglio wall thickness and correct local deficits', 'Mapped crown topology and material profile', 'Exact paired-vertex measurements by region plus lock-aware outward correction', analysisEvidence, browserEvidence, 'Missing correspondence, unsatisfiable lock conflict, or corrupt output'),
  direct('crown.contour-analysis', 'Multi-reference contour analysis', 'analysis', 'Compare crown against preparation, adjacent, pre-op, contralateral and arch surfaces', 'One or more assigned model-space references', 'Signed closest-surface comparison grouped by source and facial, lingual, cervical and proximal region', ['crown-history-materials.test.ts'], browserEvidence, 'No reference reports not-run; invalid geometry never reports pass'),
  direct('crown.contour-correct', 'Localized contour correction', 'analysis', 'Move out-of-tolerance crown vertices toward assigned references', 'Contour evidence, reference meshes and unlocked regions', 'Bounded nearest-reference displacement with lock and topology validation', ['crown-history-materials.test.ts'], browserEvidence, 'No editable deviation, lock conflict, or corrupt output'),
  direct('crown.qc', 'Complete crown QC', 'qc', 'Run measured restoration-specific QC', 'Current geometry, fit analyses, profile and export round trips', 'Versioned hard and warning gates over margin, intaglio, seating, spacing, thickness, contacts, occlusion, contour, topology, dimensions, tooling and export', analysisEvidence, browserEvidence, 'Any hard failure or missing mandatory evidence', 'CrownQcCommand'),
  direct('crown.approval', 'Final restoration approval', 'approval', 'Transition QC-reviewed crown to export approval and final lock', 'Active no-failure QC result and user identity', 'Explicit auditable guarded state machine; hard corruption cannot be overridden', historyEvidence, browserEvidence, 'Missing or failed QC, invalid transition, or locked record', 'CrownApprovalCommand'),
  direct('crown.history', 'Restoration history and checkpoints', 'history', 'Checkpoint, compare, restore, duplicate and branch immutable versions', 'Active restoration geometry version', 'Versioned derived artifacts, event lineage, branch IDs and command snapshots', historyEvidence, browserEvidence, 'Missing version or artifact, empty checkpoint name, or final lock', 'CrownCheckpointCommand, CrownRestoreVersionCommand, CrownBranchCommand and CommandBus undo and redo'),
  direct('crown.export', 'Manufacturing export', 'export', 'Serialize and re-import binary STL, ASCII STL, OBJ and PLY', 'APPROVED_FOR_EXPORT current crown with QC', 'Strict preflight, model-coordinate serialization, immediate parser re-import and bidirectional tolerance comparison with immutable manufacturing metadata', ['crown-export.test.ts', 'crown-history-materials.test.ts'], browserEvidence, 'Invalid topology, approval, metadata, or round-trip deviation', 'CrownExportRecordCommand'),
];

const sculpt: Seed[] = CROWN_SCULPT_MODES.map((mode) => direct(`crown.sculpt.${mode}`, `${mode} sculpt`, 'sculpt', `Modify actual outer crown vertices using ${mode}`, 'Model-space surface hit, brush settings, masks and unlocked constraints', `Compact model-space brush kernel implementing ${mode}, selectable falloff, mask, surface constraint and symmetry`, editingEvidence, browserEvidence, 'Brush miss, invalid numeric input, lock conflict, or corrupt output'));
const anatomy: Seed[] = CROWN_ANATOMY_OPERATIONS.map((operation) => direct(`crown.anatomy.${operation}`, operation, 'anatomy', `Apply actual ${operation} anatomy edit`, 'Model-space crown surface target, numeric brush and locks', `Named anatomy operation mapped to the validated model-space sculpt kernel with operation-specific mode and falloff`, editingEvidence, browserEvidence, 'Invalid operation, brush miss, lock conflict, or corrupt output'));
const locks: Seed[] = ['margin', 'intaglio', 'mesial-contact', 'distal-contact', 'occlusion', 'facial-contour', 'lingual-contour', 'selected-anatomy', 'anatomy', 'mask', 'overlay'].map((name) => direct(`crown.lock.${name}`, `${name} lock`, 'constraint', `Persist and enforce the ${name} constraint`, 'Active restoration and lock state', 'Versioned constraint state enforced at geometry-operation boundaries and visualized in the workspace', editingEvidence, browserEvidence, 'Conflicting operation is rejected and reported', 'RestorationStateCommand plus CrownGeometryCommand validation'));
const materials: Seed[] = Object.values(CROWN_MATERIAL_PROFILES).map((profile) => direct(`crown.material.${profile.id}`, profile.label, 'material', `Apply governed ${profile.label} profile snapshot`, 'Restoration material selection', 'Versioned configuration supplies thickness, cement, radius, allowance, tool access, contact, occlusion and validation rules', ['crown-history-materials.test.ts'], browserEvidence, 'Invalid parameter, profile compatibility, or failed QC', 'CrownProposalCommand and CrownGeometryCommand'));

export const CROWN_TOOL_COVERAGE_REGISTRY: readonly CrownToolCoverageEntry[] = [...core, ...sculpt, ...anatomy, ...locks, ...materials].map((seed) => ({
  ...seed,
  productionStatus: 'PRODUCTION_READY',
  undoRedo: true,
  persistence: true,
  recovery: true,
}));
