export type MarginProductionStatus = 'IMPLEMENTED_PENDING_CERTIFICATION' | 'PRODUCTION_READY';

export interface MarginToolCoverageEntry {
  toolId: string;
  productionStatus: MarginProductionStatus;
  inputRequirements: string;
  algorithm: string;
  geometryBehavior: string;
  commandCoverage: string;
  undoRedo: true;
  persistence: true;
  recovery: true;
  deterministicTests: string;
  browserTests: string;
  performanceTest: string;
  knownSupportedConditions: string;
  failClosedConditions: string;
}

type ToolSeed = [string, string, string, string, string];

const seeds: ToolSeed[] = [
  ['preparation.auto-detect', 'Finite manifold dental mesh and dental Z axis', 'Curvature/normal-transition feature graph, closed-path clustering and measured ranking', 'Produces non-destructive candidate face regions and boundary paths', 'Empty, invalid-scale, duplicate, self-intersecting, non-manifold or unsupported evidence'],
  ['preparation.manual-identify', 'Selected real mesh faces', 'Indexed face identity and connected topology', 'Stores a versioned non-destructive preparation segmentation', 'Empty or invalid face selection'],
  ['preparation.grow', 'Unlocked segmentation', 'Face-neighbor ring dilation', 'Adds only topology-adjacent preparation faces', 'Locked or empty result'],
  ['preparation.shrink', 'Unlocked segmentation', 'Face-neighbor boundary erosion', 'Removes topology-boundary preparation faces', 'Locked or empty result'],
  ['preparation.exclude-neighbors', 'Unlocked segmentation', 'Largest connected selected-face component', 'Excludes disconnected neighboring regions', 'Locked or empty result'],
  ['preparation.lock-region', 'Non-empty segmentation', 'Immutable version transition', 'Approves and locks one segmentation version', 'Empty segmentation'],
  ['axis.auto-propose', 'Preparation segmentation', 'Dental-axis/top-region vector proposal and multi-axis draw scoring', 'Creates measured axis candidates without mesh mutation', 'No axial wall evidence'],
  ['axis.manual-define', 'Finite non-zero direction', 'Normalized model-space direction', 'Creates a new manual axis analysis version', 'Zero/non-finite or locked axis'],
  ['axis.recalculate', 'Preparation segmentation', 'Undercut, convergence, visibility and boundary-accessibility recomputation', 'Replaces no prior axis history', 'Missing segmentation'],
  ['axis.lock', 'Analyzed axis', 'Immutable axis state transition', 'Prevents subsequent direction mutation', 'Unanalyzed axis'],
  ['axis.bridge-common-draw', 'At least two preparation axes', 'Pairwise angular compatibility and normalized mean direction', 'Reports common path or explicit conflict', 'Axis conflict above measured 12 degree compatibility rule'],
  ['margin.auto-detect', 'Identified preparation and segmentation', 'Multi-stage curvature, normal-transition, path continuity, closure and ranking pipeline', 'Creates up to three retained model-space candidates', 'No supported finish-line feature'],
  ['margin.preview-candidate', 'Ranked margin candidate', 'Geometry-supported source vertex/edge path', 'Renders actual model-space candidate segments', 'Missing candidate geometry'],
  ['margin.compare-candidates', 'Two retained candidates', 'Bidirectional curve distance and measured evidence comparison', 'Reports geometric differences without mutation', 'Missing sampled geometry'],
  ['margin.accept-candidate', 'Geometry-supported candidate', 'Candidate-to-surface-curve conversion', 'Creates immutable automatic-candidate margin version', 'Candidate with no points'],
  ['margin.reject-candidate', 'Retained candidate', 'Explicit state exclusion', 'Preserves candidate evidence while recording rejection', 'Unknown candidate'],
  ['margin.combine-sections', 'Two compatible selected candidate sections', 'Oriented section concatenation with endpoint distance validation', 'Creates a model-space combined curve without fabricated gap bridging', 'Sections over 1 mm apart'],
  ['margin.confidence-map', 'Per-segment candidate evidence', 'Measured dihedral, curvature gradient, normal transition, continuity and support weighting', 'Colors each actual segment by evidence category', 'Missing segment evidence'],
  ['margin.finish-line-classify', 'Two-sided local surface support', 'Local dihedral/axial-normal transition classifier', 'Stores classification and confidence per segment plus global mixed state', 'Insufficient or indeterminate evidence'],
  ['margin.draw-surface', 'Two or more surface hits', 'Closest-point model-space projection', 'Creates a surface-associated margin curve', 'Hit without source triangles'],
  ['margin.draw-magnetic', 'Surface hits and snap configuration', 'Weighted feature/candidate/surface/user-anchor nearest target', 'Moves points only within configured model-space search radius', 'No snap target leaves point unsnapped'],
  ['margin.draw-freehand', 'Pointer samples on selected source mesh', 'Surface-hit sampling and projection', 'Creates actual source-associated polyline', 'Fewer than two points'],
  ['margin.draw-spline', 'Three or more surface hits', 'Catmull-Rom interpolation followed by source association', 'Creates model-space spline samples', 'Fewer than three points'],
  ['margin.draw-point-by-point', 'Two or more surface hits', 'Ordered model-space control points', 'Creates explicit surface curve', 'Fewer than two points'],
  ['margin.add-control-point', 'Unlocked active margin', 'Ordered control-point append', 'Creates a new margin lineage version', 'Invalid point or locked margin'],
  ['margin.delete-control-point', 'Unlocked active margin', 'Validated ordered control-point removal', 'Creates a new margin lineage version', 'Minimum point count or locked margin'],
  ['margin.move-control-point', 'Unlocked active margin and surface point', 'Closest-point surface-constrained replacement', 'Creates a new margin lineage version', 'Invalid point or locked margin'],
  ['margin.insert-control-point', 'Unlocked active margin', 'Ordered indexed insertion', 'Creates a new margin lineage version', 'Invalid index or locked margin'],
  ['margin.drag-section', 'Unlocked margin section and delta', 'Section translation with per-point surface reprojection', 'Creates a new surface-supported margin lineage version', 'Invalid range, reprojection failure or locked margin'],
  ['margin.push', 'Unlocked margin and numeric offset', 'Tangent/corresponding surface-normal offset with reprojection', 'Creates an outward offset margin version', 'Undefined normal or locked margin'],
  ['margin.pull', 'Unlocked margin and numeric offset', 'Tangent/corresponding surface-normal offset with reprojection', 'Creates an inward offset margin version', 'Undefined normal or locked margin'],
  ['margin.smooth-section', 'Unlocked selected margin range', 'Local neighbor averaging', 'Changes only selected control points in a new version', 'Invalid range or locked margin'],
  ['margin.smooth-all', 'Unlocked active margin', 'Closed/open neighbor averaging', 'Creates a smoothed lineage version', 'Locked margin'],
  ['margin.simplify', 'Unlocked active margin and tolerance', 'Ramer-Douglas-Peucker simplification', 'Creates simplified actual model-space geometry', 'Point-count collapse or locked margin'],
  ['margin.resample', 'Unlocked active margin and spacing', 'Arc-length equidistant resampling', 'Creates measured-spacing curve geometry', 'Non-positive spacing or locked margin'],
  ['margin.extend', 'Unlocked open margin', 'Endpoint tangent extension', 'Extends actual endpoints in model coordinates', 'Closed curve, negative distance or locked margin'],
  ['margin.trim', 'Unlocked margin and arc interval', 'Arc-length interval clipping', 'Creates open trimmed curve geometry', 'Invalid interval or locked margin'],
  ['margin.split', 'Unlocked open margin and interior control point', 'Ordered control-point partition', 'Creates two actual curve sections', 'Closed curve, endpoint split or locked margin'],
  ['margin.join', 'Two associated open curves', 'Closest compatible endpoint orientation and tolerance join', 'Creates one actual combined curve', 'Association mismatch, gap above tolerance or locked margin'],
  ['margin.close', 'Unlocked margin with at least three points', 'Explicit loop closure', 'Adds real closing segment', 'Too few points or locked margin'],
  ['margin.open', 'Unlocked closed margin', 'Explicit loop opening', 'Removes logical closing segment', 'Locked margin'],
  ['margin.reverse', 'Unlocked active margin', 'Control/sample order reversal', 'Changes loop direction without point drift', 'Locked margin'],
  ['margin.surface-reproject', 'Margin and source mesh', 'Closest point for every control point', 'Restores whole curve surface association', 'Missing source triangles or locked margin'],
  ['margin.local-reproject', 'Selected control indices and source mesh', 'Closest point for selected controls only', 'Reprojects only the specified region', 'Invalid index, missing surface or locked margin'],
  ['margin.offset-numeric', 'Unlocked margin and finite millimeter value', 'Model-space surface-normal/tangent offset', 'Creates exact numeric offset lineage version', 'Non-finite value or locked margin'],
  ['margin.restore-automatic', 'Prior automatic candidate version', 'Immutable lineage restoration', 'Creates no fabricated candidate and preserves later versions', 'Missing prior candidate'],
  ['margin.restore-approved', 'Prior approved version', 'Immutable lineage restoration', 'Restores a deep-cloned approved curve as a new active version', 'Missing prior approval'],
  ['margin.quality', 'Active margin and source mesh', 'Closure, crossing, duplicate, spike, curvature, attachment, jump, orientation and enclosure checks', 'Reports exact defective segment identifiers', 'Missing margin/source geometry'],
  ['preparation.measure', 'Preparation segmentation and optional registered comparisons', 'Model-space topology, area, height, width, taper, undercut and nearest-surface distances', 'Stores deterministic measurements; unavailable comparisons remain null', 'Missing segmentation'],
  ['preparation.qc', 'Preparation measurements, margin quality and governed profile', 'Versioned material/restoration rule evaluation', 'Stores immutable QC result', 'Missing rule profile fails; missing comparison evidence is not-run'],
  ['margin.approve', 'Valid margin quality and zero QC failures', 'Validated immutable lineage transition', 'Creates approved version without overwriting history', 'Any margin/QC failure'],
  ['margin.lock', 'Approved margin', 'Immutable lineage lock transition', 'Prevents edits until explicit historical unlock', 'Unapproved margin'],
  ['margin.unlock', 'Locked margin', 'Audited immutable lineage transition', 'Creates unlocked child version while preserving locked parent', 'Unknown margin'],
  ['preparation.batch-qc', 'Multiple identified preparations', 'Independent deterministic QC per preparation', 'Stores separate results and preserves independent locks', 'Any missing segmentation is reported, never skipped'],
] as const;

export const MARGIN_TOOL_COVERAGE_REGISTRY: readonly MarginToolCoverageEntry[] = seeds.map(([toolId, inputRequirements, algorithm, geometryBehavior, failClosedConditions]) => ({
  toolId,
  productionStatus: 'IMPLEMENTED_PENDING_CERTIFICATION',
  inputRequirements,
  algorithm,
  geometryBehavior,
  commandCoverage: 'PreparationStateCommand or MarginEditCommand through the shared CommandBus',
  undoRedo: true,
  persistence: true,
  recovery: true,
  deterministicTests: 'preparation-margin-intelligence.test.ts and preparation-failure-corpus.test.ts',
  browserTests: 'design-studio-preparation-margin.spec.mjs',
  performanceTest: 'preparation-performance.test.ts',
  knownSupportedConditions: 'Finite millimeter STL/OBJ/PLY geometry with explicit preparation identification or measured automatic evidence',
  failClosedConditions,
}));
