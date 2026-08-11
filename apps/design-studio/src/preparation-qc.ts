import { buildTopology, type IndexedMesh } from './editing-geometry';
import type {
  MarginQualityResult,
  MarginVersion,
  PreparationMeasurements,
  PreparationQcCheck,
  PreparationQcResult,
  PreparationQcRule,
  PreparationRecord,
} from './preparation-types';
import { PREPARATION_RULESET_VERSION } from './preparation-types';

export const PREPARATION_QC_RULES: readonly PreparationQcRule[] = [
  rule('ceramic.height', ['crown', 'bridge-abutment', 'onlay', 'overlay'], 'generic-ceramic-crown', 'heightMm', 3, 12, 'fail', 'Configured ceramic restoration preparation height envelope.'),
  rule('ceramic.convergence', ['crown', 'bridge-abutment', 'onlay', 'overlay'], 'generic-ceramic-crown', 'convergenceDegrees', 2, 24, 'warning', 'Configured convergence evidence range for the ceramic workflow.'),
  rule('ceramic.undercut', ['crown', 'bridge-abutment', 'onlay', 'overlay'], 'generic-ceramic-crown', 'undercutDepthMm', 0, 0.1, 'fail', 'Configured maximum measurable undercut depth.'),
  rule('ceramic.radius', ['crown', 'bridge-abutment', 'onlay', 'overlay'], 'generic-ceramic-crown', 'minimumLocalRadiusMm', 0.2, null, 'warning', 'Configured minimum local feature radius for this governed material profile.'),
  rule('ceramic.reduction', ['crown', 'onlay', 'overlay'], 'generic-ceramic-crown', 'occlusalReductionMm', 1, 3.5, 'warning', 'Configured pre-operative occlusal reduction range; executes only with a registered pre-operative reference.'),
  rule('ceramic.clearance', ['crown', 'bridge-abutment', 'onlay', 'overlay'], 'generic-ceramic-crown', 'antagonistClearanceMm', 1, null, 'warning', 'Configured antagonist clearance; executes only when registered opposing geometry is provided.'),

  rule('metal.height', ['coping', 'crown', 'bridge-abutment'], 'generic-metal-coping', 'heightMm', 2, 15, 'warning', 'Configured metal coping preparation height envelope.'),
  rule('metal.convergence', ['coping', 'crown', 'bridge-abutment'], 'generic-metal-coping', 'convergenceDegrees', 1, 30, 'warning', 'Configured metal coping convergence evidence range.'),
  rule('metal.undercut', ['coping', 'crown', 'bridge-abutment'], 'generic-metal-coping', 'undercutDepthMm', 0, 0.15, 'fail', 'Configured metal coping maximum undercut depth.'),
  rule('metal.radius', ['coping', 'crown', 'bridge-abutment'], 'generic-metal-coping', 'minimumLocalRadiusMm', 0.1, null, 'warning', 'Configured metal coping minimum local feature radius.'),

  rule('veneer.height', ['veneer', 'partial-coverage'], 'generic-veneer', 'heightMm', 1, 12, 'warning', 'Configured veneer/partial-coverage preparation height envelope.'),
  rule('veneer.reduction', ['veneer', 'partial-coverage'], 'generic-veneer', 'axialReductionMm', 0.2, 1.5, 'warning', 'Configured pre-operative axial reduction range; executes only with a registered pre-operative reference.'),
  rule('veneer.undercut', ['veneer', 'partial-coverage'], 'generic-veneer', 'undercutDepthMm', 0, 0.08, 'fail', 'Configured veneer maximum undercut depth.'),
] as const;

export const PREPARATION_MATERIAL_PROFILES = [
  { id: 'generic-ceramic-crown', label: 'Governed generic ceramic crown profile' },
  { id: 'generic-metal-coping', label: 'Governed generic metal coping profile' },
  { id: 'generic-veneer', label: 'Governed generic veneer profile' },
] as const;

export function runPreparationQc(
  preparation: PreparationRecord,
  measurements: PreparationMeasurements,
  margin: MarginVersion | undefined,
  marginQuality: MarginQualityResult | null,
  materialId: string,
  mesh: IndexedMesh,
): PreparationQcResult {
  const rules = PREPARATION_QC_RULES.filter((ruleValue) => ruleValue.materialId === materialId && ruleValue.restorationKinds.includes(preparation.kind)); const checks: PreparationQcCheck[] = [];
  if (!rules.length) checks.push(check('qc.governed-rules', 'fail', materialId, 'matching versioned material/restoration rules required', [], `No ${PREPARATION_RULESET_VERSION} rule set supports ${preparation.kind} with material profile ${materialId}.`));
  else checks.push(check('qc.governed-rules', 'pass', rules.length, `${PREPARATION_RULESET_VERSION} matching rules > 0`, [], `${rules.length} versioned material/restoration rules were selected.`));
  for (const ruleValue of rules) checks.push(evaluateRule(ruleValue, measurements));

  checks.push(check('qc.insufficient-reduction', reductionStatus(measurements, rules, 'minimum'), reductionValue(measurements), reductionThreshold(rules, 'minimum'), [], reductionExplanation(measurements, 'minimum')));
  checks.push(check('qc.excessive-reduction', reductionStatus(measurements, rules, 'maximum'), reductionValue(measurements), reductionThreshold(rules, 'maximum'), [], reductionExplanation(measurements, 'maximum')));
  checks.push(check('qc.undercut', measurements.undercutDepthMm > maximumFor(rules, 'undercutDepthMm', Infinity) ? 'fail' : 'pass', measurements.undercutDepthMm, `<= ${display(maximumFor(rules, 'undercutDepthMm', Infinity))} mm`, [], measurements.undercutDepthMm ? 'Measured insertion-axis undercut is reported.' : 'No measurable undercut was found for the selected axis.'));
  checks.push(check('qc.draw-conflict', measurements.undercutDepthMm > 0.1 ? 'fail' : measurements.undercutDepthMm > 0 ? 'warning' : 'pass', measurements.undercutDepthMm, 'material-specific undercut rule', [], 'Draw conflict derives from measured undercut depth, not a simulated state.'));
  checks.push(check('qc.sharp-transition', measurements.sharpInternalFeatureCount ? 'warning' : 'pass', measurements.sharpInternalFeatureCount, '0 dihedral transitions > 105°', [], measurements.sharpInternalFeatureCount ? 'Sharp internal geometric transitions require review.' : 'No sharp internal transition was found.'));
  const radiusMinimum = minimumFor(rules, 'minimumLocalRadiusMm', 0);
  checks.push(check('qc.thin-preparation-feature', measurements.minimumLocalRadiusMm === null ? 'not-run' : measurements.minimumLocalRadiusMm < radiusMinimum ? 'warning' : 'pass', measurements.minimumLocalRadiusMm, `>= ${display(radiusMinimum)} mm for selected profile`, [], measurements.minimumLocalRadiusMm === null ? 'No local radius could be measured.' : 'Minimum local radius was measured from preparation topology edges.'));
  checks.push(check('qc.irregular-finish-line', marginQuality === null ? 'not-run' : marginQuality.checks.some((value) => ['margin.sharp-spikes', 'margin.curvature-discontinuity'].includes(value.id) && value.status !== 'pass') ? 'warning' : 'pass', marginQuality?.defectiveSegmentIndices.length ?? null, 'no spike/curvature defects', marginQuality?.defectiveSegmentIndices.map(String) ?? [], marginQuality ? 'Finish-line regularity is derived from exact margin segments.' : 'No margin exists to inspect.'));
  checks.push(check('qc.discontinuous-margin', marginQuality === null ? 'not-run' : marginQuality.checks.some((value) => value.id === 'margin.closed-loop' && value.status === 'fail') ? 'fail' : 'pass', margin?.curve.closed ?? null, 'closed loop', marginQuality?.checks.find((value) => value.id === 'margin.closed-loop')?.affectedElementIds ?? [], marginQuality ? 'Margin closure is checked in model coordinates.' : 'No margin exists to inspect.'));
  const topology = buildTopology(mesh);
  checks.push(check('qc.missing-scan-data', topology.boundaryEdges.length ? 'warning' : 'pass', topology.boundaryEdges.length, '0 source boundary edges near a complete scan', topology.boundaryEdges.slice(0, 256).map(String), topology.boundaryEdges.length ? 'Open source boundaries may hide preparation or margin geometry.' : 'Source mesh has no boundary edges.'));
  const unclear = margin?.confidenceMeasurements.filter((segment) => ['low', 'ambiguous', 'discontinuous', 'reconstructed-missing-data'].includes(segment.category)) ?? [];
  checks.push(check('qc.unclear-margin-region', unclear.length ? 'warning' : margin ? 'pass' : 'not-run', unclear.length, '0 low-support margin segments', unclear.map((segment) => String(segment.index)), margin ? 'Margin confidence is derived from per-segment geometry evidence.' : 'No margin exists to inspect.'));
  checks.push(check('qc.tissue-interference', 'not-run', null, 'registered distinguishable tissue geometry required', [], 'Tissue interference is not reported because no independently classified tissue surface was supplied to this analysis.'));
  checks.push(check('qc.restorative-clearance', measurements.antagonistClearanceMm === null ? 'not-run' : measurements.antagonistClearanceMm < minimumFor(rules, 'antagonistClearanceMm', 0) ? 'warning' : 'pass', measurements.antagonistClearanceMm, 'material-specific clearance rule', [], measurements.antagonistClearanceMm === null ? 'Registered antagonist geometry is required; clearance was not estimated.' : 'Clearance was measured against registered antagonist geometry.'));
  const classifications = margin?.confidenceMeasurements.map((segment) => segment.finishLine) ?? [];
  const unsupported = classifications.filter((value) => value === 'indeterminate').length;
  checks.push(check('qc.automatic-classification-support', margin ? unsupported ? 'warning' : 'pass' : 'not-run', margin ? unsupported : null, '0 indeterminate segments', margin?.confidenceMeasurements.flatMap((segment) => segment.finishLine === 'indeterminate' ? [String(segment.index)] : []) ?? [], margin ? 'Finish-line classification support is evaluated for every segment.' : 'No margin exists to classify.'));
  if (marginQuality) checks.push(...marginQuality.checks.map((value) => ({ ...value, id: `quality.${value.id}` })));
  const warningCount = checks.filter((value) => value.status === 'warning').length; const failureCount = checks.filter((value) => value.status === 'fail').length;
  return { id: crypto.randomUUID(), preparationId: preparation.id, marginVersionId: margin?.id ?? null, rulesetVersion: PREPARATION_RULESET_VERSION, materialId, checks, overall: failureCount ? 'fail' : warningCount ? 'warning' : 'pass', warningCount, failureCount, executedAt: new Date().toISOString() };
}

function rule(id: string, restorationKinds: PreparationQcRule['restorationKinds'], materialId: string, measurement: PreparationQcRule['measurement'], minimum: number | null, maximum: number | null, severity: PreparationQcRule['severity'], explanation: string): PreparationQcRule { return { id, version: PREPARATION_RULESET_VERSION, restorationKinds, materialId, measurement, minimum, maximum, severity, explanation }; }
function check(id: string, status: PreparationQcCheck['status'], measuredValue: PreparationQcCheck['measuredValue'], threshold: string, affectedElementIds: string[], explanation: string): PreparationQcCheck { return { id, status, measuredValue, threshold, affectedElementIds, explanation }; }

function evaluateRule(ruleValue: PreparationQcRule, measurements: PreparationMeasurements): PreparationQcCheck {
  const raw = measurements[ruleValue.measurement as keyof PreparationMeasurements]; const value = typeof raw === 'number' ? raw : null;
  if (value === null) return check(`rule.${ruleValue.id}`, 'not-run', null, threshold(ruleValue), [], `${ruleValue.explanation} Required registered comparison geometry was unavailable, so no value was inferred.`);
  const outside = ruleValue.minimum !== null && value < ruleValue.minimum || ruleValue.maximum !== null && value > ruleValue.maximum;
  return check(`rule.${ruleValue.id}`, outside ? ruleValue.severity : 'pass', value, threshold(ruleValue), [], `${ruleValue.explanation} Measured ${value.toFixed(4)}.`);
}

function threshold(ruleValue: PreparationQcRule): string { return `${ruleValue.minimum === null ? '−∞' : ruleValue.minimum} to ${ruleValue.maximum === null ? '+∞' : ruleValue.maximum}`; }
function minimumFor(rules: PreparationQcRule[], measurement: PreparationQcRule['measurement'], fallback: number): number { return rules.filter((ruleValue) => ruleValue.measurement === measurement && ruleValue.minimum !== null).reduce((value, ruleValue) => Math.max(value, ruleValue.minimum!), fallback); }
function maximumFor(rules: PreparationQcRule[], measurement: PreparationQcRule['measurement'], fallback: number): number { return rules.filter((ruleValue) => ruleValue.measurement === measurement && ruleValue.maximum !== null).reduce((value, ruleValue) => Math.min(value, ruleValue.maximum!), fallback); }
function reductionRule(rules: PreparationQcRule[]): PreparationQcRule | undefined { return rules.find((ruleValue) => ['occlusalReductionMm', 'axialReductionMm', 'incisalReductionMm'].includes(String(ruleValue.measurement))); }
function reductionValue(measurements: PreparationMeasurements): number | null { return measurements.occlusalReductionMm ?? measurements.axialReductionMm ?? measurements.incisalReductionMm; }
function reductionThreshold(rules: PreparationQcRule[], side: 'minimum' | 'maximum'): string { const ruleValue = reductionRule(rules); const value = ruleValue?.[side] ?? null; return value === null ? 'configured reference required' : `${side === 'minimum' ? '>=' : '<='} ${value} mm`; }
function reductionStatus(measurements: PreparationMeasurements, rules: PreparationQcRule[], side: 'minimum' | 'maximum'): PreparationQcCheck['status'] { const value = reductionValue(measurements); const ruleValue = reductionRule(rules); const limit = ruleValue?.[side] ?? null; if (value === null || limit === null) return 'not-run'; return side === 'minimum' ? value < limit ? ruleValue!.severity : 'pass' : value > limit ? ruleValue!.severity : 'pass'; }
function reductionExplanation(measurements: PreparationMeasurements, side: 'minimum' | 'maximum'): string { return measurements.preoperativeReferenceAvailable ? `${side === 'minimum' ? 'Insufficient' : 'Excessive'} reduction is compared to the registered pre-operative surface.` : 'No registered pre-operative reference exists; reduction was not estimated.'; }
function display(value: number): string { return Number.isFinite(value) ? value.toFixed(3) : 'configured'; }
