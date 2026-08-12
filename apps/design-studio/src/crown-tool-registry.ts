export interface CrownToolCoverageEntry {
  toolId: string;
  label: string;
  productionStatus: 'IMPLEMENTED_PENDING_CERTIFICATION' | 'PRODUCTION_READY';
  inputRequirements: string;
  geometryAlgorithm: string;
  commandCoverage: string;
  undoRedo: true;
  persistence: true;
  recovery: true;
  deterministicEvidence: string;
  browserEvidence: string;
  failClosedConditions: string;
}

type Seed = [string, string, string, string, string];

const seeds: Seed[] = [
  ['crown.proposal', 'Automatic crown proposal', 'Approved preparation, margin, insertion axis, tooth number and material', 'Preparation-axis ray sampling plus governed procedural outer anatomy and paired closed intaglio topology', 'Missing approval lineage, invalid parameters, open/non-manifold/self-intersecting output'],
  ['crown.reference-adapt', 'Pre-op/reference adaptation', 'Assigned finite reference mesh', 'Insertion-axis surface sampling blended into the external crown height field', 'Reference samples outside supported surface coverage remain explicit'],
  ['crown.emergence', 'Cervical and emergence contour', 'Generated crown and unlocked anatomy', 'Radial cervical contour field constrained to the approved margin ring', 'Locked margin/anatomy or corrupt output'],
  ['crown.intaglio', 'Generate intaglio', 'Preparation mesh, approved margin and insertion axis', 'Barycentric preparation surface sampling with governed relief along the insertion axis', 'Uncovered preparation surface, invalid axis or non-positive internal clearance'],
  ['crown.cement-space', 'Generate cement space', 'Governed material profile and finite gap parameters', 'Marginal-to-axial-to-occlusal spacer interpolation measured against actual preparation samples', 'Out-of-profile gaps or invalid samples'],
  ['crown.seating', 'Simulate seating path', 'Crown intaglio, preparation and insertion axis', 'Multi-position signed closest-surface collision sampling from unseated to fully seated', 'Any path collision or impossible full seat'],
  ['crown.contact-mesial', 'Measure mesial contact', 'Mesial adjacent mesh', 'Signed closest-triangle distance, penetration and connected contact-patch area', 'Missing adjacent mesh or governed distance failure'],
  ['crown.contact-distal', 'Measure distal contact', 'Distal adjacent mesh', 'Signed closest-triangle distance, penetration and connected contact-patch area', 'Missing adjacent mesh or governed distance failure'],
  ['crown.contact-optimize-mesial', 'Optimize mesial contact', 'Unlocked mesial contact and adjacent mesh', 'Constrained nearest-surface displacement with post-edit integrity validation', 'Locked contact, empty candidate set or corrupt output'],
  ['crown.contact-optimize-distal', 'Optimize distal contact', 'Unlocked distal contact and adjacent mesh', 'Constrained nearest-surface displacement with post-edit integrity validation', 'Locked contact, empty candidate set or corrupt output'],
  ['crown.occlusion-static', 'Measure static occlusion', 'Assigned antagonist mesh', 'Signed closest-triangle distance and connected static contact patches on occlusal/incisal vertices', 'Missing antagonist or governed clearance failure'],
  ['crown.occlusion-optimize', 'Optimize static occlusion', 'Unlocked occlusion and antagonist', 'Constrained occlusal-surface displacement to governed static clearance', 'Locked occlusion or corrupt output'],
  ['crown.anatomy-parameters', 'Edit anatomy parameters', 'Unlocked crown anatomy', 'Regeneration from versioned morphology cusp/ridge/groove/fossa parameters', 'Locked anatomy or parameter outside supported range'],
  ['crown.morph-global', 'Global crown morph', 'Unlocked crown anatomy', 'Outer-topology model-space anisotropic scaling with margin/intaglio preservation', 'Scale outside 0.7–1.3 or corrupt output'],
  ['crown.sculpt-add', 'Local add sculpt', 'Model-space brush hit on unlocked outer surface', 'Compact-support vertex-normal displacement on actual indexed crown vertices', 'Brush misses crown, locked anatomy/margin or corrupt output'],
  ['crown.sculpt-remove', 'Local remove sculpt', 'Model-space brush hit on unlocked outer surface', 'Negative compact-support vertex-normal displacement on actual indexed crown vertices', 'Brush misses crown, locked anatomy/margin or corrupt output'],
  ['crown.sculpt-smooth', 'Local smooth sculpt', 'Model-space brush hit on unlocked outer surface', 'Topology-neighbor Laplacian blend with compact brush falloff', 'Brush misses crown, locked anatomy/margin or corrupt output'],
  ['crown.lock-margin', 'Margin lock', 'Active restoration', 'Versioned lock state enforced before all geometry commands', 'Locked constraint conflict'],
  ['crown.lock-intaglio', 'Intaglio lock', 'Active restoration', 'Versioned lock state enforced before intaglio-affecting generation', 'Locked constraint conflict'],
  ['crown.lock-contact', 'Contact locks', 'Active restoration', 'Independent mesial/distal optimization locks', 'Locked contact rejects automatic/manual correction'],
  ['crown.lock-occlusion', 'Occlusion lock', 'Active restoration', 'Static occlusion edit lock enforced at command validation', 'Locked occlusion rejects correction'],
  ['crown.lock-anatomy', 'Anatomy lock', 'Active restoration', 'Anatomy morph/sculpt lock enforced at geometry boundary', 'Locked anatomy rejects morphing and sculpting'],
  ['crown.thickness', 'Minimum-thickness analysis', 'Mapped outer and intaglio vertices', 'Actual Euclidean paired-wall measurement by margin/axial/occlusal/incisal/cusp/fossa region', 'Missing topology correspondence'],
  ['crown.auto-thicken', 'Automatic thickening', 'Thickness failures and unlocked compatible constraints', 'Outer-vertex displacement to governed regional minimum with topology validation', 'Intaglio/anatomy lock conflict or corrupt output'],
  ['crown.contour', 'Over/under-contour analysis', 'Assigned pre-op/reference mesh', 'Signed closest-surface comparison for every outer crown vertex', 'No reference reports not-run rather than fabricated pass'],
  ['crown.qc', 'Complete crown QC', 'Current measured crown state', 'Versioned hard/warning rules over geometry, fit, contacts, occlusion, thickness, material and export evidence', 'Any hard geometry corruption or missing mandatory evidence'],
  ['crown.approve', 'Approve for export', 'Active QC result with zero hard failures', 'Explicit guarded restoration state transition', 'QC failure or missing round-trip export evidence'],
  ['crown.lock-final', 'Lock final restoration', 'APPROVED_FOR_EXPORT restoration', 'Immutable state transition plus scene-object geometry lock', 'Any earlier approval state'],
  ['crown.export', 'Manufacturing export', 'Approved current restoration version', 'Binary/ASCII STL, indexed OBJ and indexed PLY serialization in millimeter model coordinates', 'Invalid topology, units, orientation, approval or material evidence'],
  ['crown.round-trip', 'Automatic export round trip', 'Generated export bytes', 'Immediate parser re-import and bidirectional surface/dimension/area/volume/topology comparison', 'Deviation over tolerance, topology drift, open shell or self-intersection'],
] as const;

export const CROWN_TOOL_COVERAGE_REGISTRY: readonly CrownToolCoverageEntry[] = seeds.map(([toolId, label, inputRequirements, geometryAlgorithm, failClosedConditions]) => ({
  toolId,
  label,
  productionStatus: 'IMPLEMENTED_PENDING_CERTIFICATION',
  inputRequirements,
  geometryAlgorithm,
  commandCoverage: 'CrownProposalCommand, CrownGeometryCommand, RestorationStateCommand, CrownQcCommand, CrownApprovalCommand or CrownExportRecordCommand through the shared CommandBus',
  undoRedo: true,
  persistence: true,
  recovery: true,
  deterministicEvidence: 'crown-generation.test.ts, crown-analysis-qc.test.ts, crown-export.test.ts and crown-failure-performance.test.ts',
  browserEvidence: 'design-studio-single-crown.spec.mjs anterior and posterior technician workflows',
  failClosedConditions,
}));
