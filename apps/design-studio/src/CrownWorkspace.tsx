import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ArtifactManager, ArtifactRecord, SceneManager, SceneObject, Vec3 } from './core';
import { calculateThickness, analyzeContour, analyzeOcclusion, analyzeProximalContact, autoThickenCrown, optimizeProximalContact, optimizeStaticOcclusion } from './crown-analysis';
import { CrownWorkerClient } from './crown-client';
import { triggerCrownDownload, validateAllCrownExports, type CrownExportOutput } from './crown-export';
import { scaleCrownAnatomy, sculptCrownSurface } from './crown-geometry';
import { buildCrownOverlays } from './crown-overlays';
import { runCrownQc } from './crown-qc';
import { CROWN_MATERIAL_PROFILES, defaultCrownParameters, morphologyForTooth, MORPHOLOGY_DEFINITIONS, validateCrownParameters } from './morphology-core';
import {
  CrownApprovalCommand,
  CrownExportRecordCommand,
  CrownGeometryCommand,
  CrownProposalCommand,
  CrownQcCommand,
  RestorationStateCommand,
  type RestorationCommandContext,
} from './restoration-commands';
import type { RestorationStateManager } from './restoration-state';
import type { CrownExportRecord, CrownGenerationInput, CrownGenerationProgress, CrownLocks, CrownMaterialId, CrownParameters, CrownRoundTripResult, RestorationRecord } from './restoration-types';
import type { PreparationStateManager } from './preparation-state';
import type { CommandBus } from './commands';
import { indexedMesh, meshData } from './editing-geometry';
import { inverseTransformPoint, transformPoint } from './geometry';
import type { IRenderer } from './interfaces';
import type { SurfaceHit, ViewerOverlay } from './inspection-types';
import { runtimeMetrics } from './metrics';
import './crown-styles.css';

export interface CrownWorkspaceHandle { handleCanvasClick(hit: SurfaceHit): boolean; handlePointerMove(clientX: number, clientY: number): boolean; }

interface Props {
  scene: SceneObject[];
  artifacts: ArtifactRecord[];
  sceneManager: SceneManager;
  artifactManager: ArtifactManager;
  preparationManager: PreparationStateManager;
  restorationManager: RestorationStateManager;
  commandBus: CommandBus;
  renderer: IRenderer | null;
  userIdentity: string | null;
  onStatus(message: string): void;
  onOverlays(overlays: ViewerOverlay[]): void;
}

type SculptMode = 'add' | 'remove' | 'smooth';

const PARAMETER_FIELDS: Array<{ id: keyof CrownParameters; label: string; step: number; min: number; max: number; unit?: string }> = [
  { id: 'mesiodistalScale', label: 'Mesiodistal scale', step: 0.01, min: 0.7, max: 1.3 }, { id: 'buccolingualScale', label: 'Buccolingual scale', step: 0.01, min: 0.7, max: 1.3 }, { id: 'heightScale', label: 'Crown height scale', step: 0.01, min: 0.7, max: 1.3 },
  { id: 'facialContour', label: 'Facial contour', step: 0.05, min: 0, max: 2 }, { id: 'lingualContour', label: 'Lingual contour', step: 0.05, min: 0, max: 2 }, { id: 'mesialContour', label: 'Mesial contour', step: 0.05, min: 0, max: 2 }, { id: 'distalContour', label: 'Distal contour', step: 0.05, min: 0, max: 2 }, { id: 'cervicalContour', label: 'Cervical / emergence', step: 0.05, min: 0, max: 2 },
  { id: 'cuspHeight', label: 'Cusp / incisal height', step: 0.05, min: 0, max: 2 }, { id: 'cuspInclination', label: 'Cusp inclination', step: 0.05, min: 0, max: 2 }, { id: 'ridgeIntensity', label: 'Ridge intensity', step: 0.05, min: 0, max: 2 }, { id: 'grooveDepth', label: 'Groove / fossa depth', step: 0.05, min: 0, max: 2 }, { id: 'occlusalTableScale', label: 'Occlusal table', step: 0.05, min: 0.6, max: 1.4 },
  { id: 'embrasureScale', label: 'Embrasure scale', step: 0.05, min: 0, max: 2 }, { id: 'contactZoneScale', label: 'Contact-zone scale', step: 0.05, min: 0, max: 2 }, { id: 'lineAngleIntensity', label: 'Line-angle intensity', step: 0.05, min: 0, max: 2 }, { id: 'lobeIntensity', label: 'Developmental lobes', step: 0.05, min: 0, max: 2 }, { id: 'mamelonIntensity', label: 'Mamelons', step: 0.05, min: 0, max: 2 },
  { id: 'wear', label: 'Wear / attrition', step: 0.05, min: 0, max: 1 }, { id: 'roundness', label: 'Roundness', step: 0.05, min: 0, max: 1 }, { id: 'angularity', label: 'Angularity', step: 0.05, min: 0, max: 1 }, { id: 'anatomyIntensity', label: 'Anatomy intensity', step: 0.05, min: 0.1, max: 1.5 },
  { id: 'marginalGapMm', label: 'Marginal gap', step: 0.005, min: 0.01, max: 0.14, unit: 'mm' }, { id: 'cementGapMm', label: 'Cement gap', step: 0.005, min: 0.02, max: 0.22, unit: 'mm' }, { id: 'spacerStartMm', label: 'Spacer start', step: 0.1, min: 0, max: 5, unit: 'mm' }, { id: 'axialSpacerMm', label: 'Axial spacer', step: 0.005, min: 0.02, max: 0.22, unit: 'mm' }, { id: 'occlusalSpacerMm', label: 'Occlusal spacer', step: 0.005, min: 0.02, max: 0.22, unit: 'mm' }, { id: 'localReliefMm', label: 'Local relief', step: 0.01, min: 0, max: 0.3, unit: 'mm' }, { id: 'internalRadiusMm', label: 'Internal radius', step: 0.05, min: 0.1, max: 2, unit: 'mm' }, { id: 'manufacturingCompensationPercent', label: 'Manufacturing compensation', step: 0.05, min: -0.5, max: 1.5, unit: '%' },
  { id: 'targetMesialContactMm', label: 'Mesial target', step: 0.005, min: -0.05, max: 0.15, unit: 'mm' }, { id: 'targetDistalContactMm', label: 'Distal target', step: 0.005, min: -0.05, max: 0.15, unit: 'mm' }, { id: 'targetOcclusalClearanceMm', label: 'Static occlusal target', step: 0.005, min: -0.03, max: 0.25, unit: 'mm' },
];

export const CrownWorkspace = forwardRef<CrownWorkspaceHandle, Props>(function CrownWorkspace(props, ref) {
  const [state, setState] = useState(() => props.restorationManager.get());
  const [preparationState, setPreparationState] = useState(() => props.preparationManager.get());
  const [worker] = useState(() => new CrownWorkerClient());
  const [preparationId, setPreparationId] = useState(() => props.preparationManager.get().activePreparationId ?? '');
  const [toothNumber, setToothNumber] = useState('8');
  const [materialId, setMaterialId] = useState<CrownMaterialId>('zirconia-monolithic');
  const [parameters, setParameters] = useState<CrownParameters>(() => defaultCrownParameters(8));
  const [mesialObjectId, setMesialObjectId] = useState(''); const [distalObjectId, setDistalObjectId] = useState(''); const [antagonistObjectId, setAntagonistObjectId] = useState(''); const [referenceObjectId, setReferenceObjectId] = useState('');
  const [progress, setProgress] = useState<CrownGenerationProgress | null>(null); const [busy, setBusy] = useState(false); const controller = useRef<AbortController | null>(null);
  const [sculptMode, setSculptMode] = useState<SculptMode | null>(null); const [sculptRadius, setSculptRadius] = useState(1.5); const [sculptStrength, setSculptStrength] = useState(0.15); const [hover, setHover] = useState<Vec3 | null>(null);
  const [morphScale, setMorphScale] = useState<Vec3>([1, 1, 1]); const [roundTrips, setRoundTrips] = useState<CrownExportOutput[]>([]);

  const preparation = preparationState.preparations.find((value) => value.id === preparationId);
  const activeRestoration = state.restorations.find((value) => value.preparationId === preparationId) ?? (!preparationId ? state.restorations.find((value) => value.id === state.activeRestorationId) : undefined);
  const activeArtifact = activeRestoration?.artifactId ? props.artifacts.find((value) => value.id === activeRestoration.artifactId) : undefined;
  const activeQc = activeRestoration?.activeQcResultId ? state.qcResults.find((value) => value.id === activeRestoration.activeQcResultId) : undefined;
  const eligiblePreparations = preparationState.preparations.filter((value) => ['crown', 'bridge-abutment'].includes(value.kind));
  const assignableObjects = props.scene.filter((object) => object.id !== preparation?.sceneObjectId && object.id !== activeRestoration?.sceneObjectId);
  const blockers = useMemo(() => preparationBlockers(preparation, preparationState), [preparation, preparationState]);
  const parameterErrors = useMemo(() => validateCrownParameters(parameters, materialId), [materialId, parameters]);

  useEffect(() => props.restorationManager.subscribe(() => setState(props.restorationManager.get())), [props.restorationManager]);
  useEffect(() => props.preparationManager.subscribe(() => setPreparationState(props.preparationManager.get())), [props.preparationManager]);
  useEffect(() => { if (!preparationId && preparationState.activePreparationId) setPreparationId(preparationState.activePreparationId); }, [preparationId, preparationState.activePreparationId]);
  useEffect(() => { try { const next = defaultCrownParameters(toothNumber, materialId); setParameters((current) => ({ ...next, radialSegments: current.radialSegments, surfaceRings: current.surfaceRings })); } catch { /* validation message is rendered below */ } }, [materialId, toothNumber]);
  useEffect(() => { setRoundTrips([]); }, [activeRestoration?.activeVersionId]);
  useEffect(() => { props.onOverlays(buildCrownOverlays(state, props.scene, props.artifacts)); }, [props.artifacts, props.onOverlays, props.scene, state]);
  useEffect(() => () => { controller.current?.abort(); worker.dispose(); props.onOverlays([]); }, [props.onOverlays, worker]);

  const context = (): RestorationCommandContext => ({ scene: props.sceneManager, artifacts: props.artifactManager, restorations: props.restorationManager });
  const execute = async (promise: Promise<void>, success: string) => { try { await promise; props.onStatus(success); } catch (error) { props.onStatus(message(error)); } };

  const generationInput = (): CrownGenerationInput => {
    if (!preparation) throw new Error('Select an approved crown preparation.'); const sourceObject = props.scene.find((value) => value.id === preparation.sceneObjectId); const sourceArtifact = props.artifacts.find((value) => value.id === preparation.artifactId); if (!sourceObject || !sourceArtifact) throw new Error('Preparation source geometry is unavailable.');
    const margin = preparation.approvedMarginVersionId ? preparationState.margins.find((value) => value.id === preparation.approvedMarginVersionId) : undefined; const axis = preparation.activeInsertionAxisAnalysisId ? preparationState.axes.find((value) => value.id === preparation.activeInsertionAxisAnalysisId) : undefined; if (!margin || !axis) throw new Error('Approved margin and insertion axis are required.');
    const relative = (objectId: string): ArtifactRecord['mesh'] | undefined => { const object = props.scene.find((value) => value.id === objectId); return object ? meshRelativeTo(object, sourceObject, props.artifacts) : undefined; };
    const adjacentMeshes = ([['mesial', mesialObjectId], ['distal', distalObjectId]] as const).flatMap(([side, objectId]) => { const mesh = relative(objectId); return mesh ? [{ objectId, side, mesh }] : []; });
    const antagonistMesh = relative(antagonistObjectId); const referenceMesh = relative(referenceObjectId);
    return {
      requestId: crypto.randomUUID(), preparationId: preparation.id, preparationArtifactId: sourceArtifact.id, preparationMesh: structuredClone(sourceArtifact.mesh), marginPoints: structuredClone(margin.curve.sampledPoints.length ? margin.curve.sampledPoints : margin.curve.controlPoints), insertionAxis: structuredClone(axis.selectedAxis), toothNumber, materialProfileId: materialId, parameters: structuredClone(parameters), adjacentMeshes,
      ...(antagonistMesh ? { antagonist: { objectId: antagonistObjectId, mesh: antagonistMesh } } : {}), ...(referenceMesh ? { referenceMesh } : {}),
    };
  };

  const generate = async () => {
    if (busy) return; if (blockers.length || parameterErrors.length) { props.onStatus([...blockers, ...parameterErrors].join(' ')); return; }
    if (activeRestoration?.approvalState === 'LOCKED') { props.onStatus('Locked restoration geometry cannot be modified.'); return; }
    const input = generationInput(); if (input.adjacentMeshes.length !== 2 || !input.antagonist) { props.onStatus('Assign mesial, distal, and antagonist surfaces before automatic crown proposal.'); return; }
    const abort = new AbortController(); controller.current = abort; setBusy(true); setProgress(null); setRoundTrips([]);
    try {
      const result = await runtimeMetrics.measureAsync('crown.proposal', () => worker.execute(input, { signal: abort.signal, progress: setProgress }), { triangles: input.preparationMesh.indices.length / 3, tooth: input.toothNumber });
      const segmentation = preparationState.segmentations.find((value) => value.id === preparation!.activeSegmentationVersionId)!; const margin = preparationState.margins.find((value) => value.id === preparation!.approvedMarginVersionId)!; const axis = preparationState.axes.find((value) => value.id === preparation!.activeInsertionAxisAnalysisId)!;
      if (activeRestoration) {
        await props.commandBus.execute(new CrownGeometryCommand(context(), activeRestoration.id, { mesh: result.mesh, operation: 'proposal-regeneration', label: `Regenerate crown #${input.toothNumber}`, parameters: parameterRecord(input.parameters), analyses: { parameters: input.parameters, topologyMap: result.topologyMap, thickness: result.thickness, cementSpace: result.cementSpace, seating: result.seating, mesialContact: result.mesialContact, distalContact: result.distalContact, occlusion: result.occlusion, contour: result.contour } }));
      } else await props.commandBus.execute(new CrownProposalCommand(context(), input, result, { preparationVersionId: segmentation.id, approvedMarginVersionId: margin.id, insertionAxisAnalysisId: axis.id }));
      runtimeMetrics.estimateMemory(props.artifactManager.list()); props.onStatus(`Generated actual crown solid for tooth ${input.toothNumber}: ${result.inspection.vertexCount} vertices, ${result.inspection.triangleCount} triangles, ${result.durationMs.toFixed(1)} ms.`);
    } catch (error) { props.onStatus(message(error)); }
    finally { setBusy(false); setProgress(null); controller.current = null; }
  };

  const updateRecordState = async (patch: Partial<RestorationRecord>, type: string, label: string) => {
    if (!activeRestoration) return; const current = props.restorationManager.get(); const next = { ...current, restorations: current.restorations.map((value) => value.id === activeRestoration.id ? { ...value, ...structuredClone(patch), updatedAt: new Date().toISOString() } : value) }; await execute(props.commandBus.execute(new RestorationStateCommand(props.restorationManager, next, type, label)), label);
  };

  const analyzedPatch = (mesh: ArtifactRecord['mesh'], record: RestorationRecord, input: CrownGenerationInput) => {
    if (!record.topologyMap) throw new Error('Active crown topology map is missing.');
    return {
      thickness: calculateThickness(mesh, record.topologyMap, record.materialProfileId),
      mesialContact: analyzeProximalContact(mesh, record.topologyMap, input.adjacentMeshes.find((item) => item.side === 'mesial'), 'mesial', input),
      distalContact: analyzeProximalContact(mesh, record.topologyMap, input.adjacentMeshes.find((item) => item.side === 'distal'), 'distal', input),
      occlusion: analyzeOcclusion(mesh, record.topologyMap, input), contour: analyzeContour(mesh, record.topologyMap, input.referenceMesh),
    };
  };

  const commitGeometry = async (mesh: ArtifactRecord['mesh'], operation: string, label: string, operationParameters: Record<string, number | string | boolean | null> = {}) => {
    if (!activeRestoration) throw new Error('Generate a crown proposal first.'); const input = generationInput(); const analyses = analyzedPatch(mesh, activeRestoration, input); await props.commandBus.execute(new CrownGeometryCommand(context(), activeRestoration.id, { mesh, operation, label, parameters: operationParameters, analyses })); setRoundTrips([]); props.onStatus(label);
  };

  const applySculpt = async (position: Vec3) => {
    if (!sculptMode || !activeRestoration?.topologyMap || !activeArtifact) return;
    try { const localCenter = activeRestoration.sceneObjectId ? inverseTransformPoint(position, props.sceneManager.get(activeRestoration.sceneObjectId)!) : position; const mesh = sculptCrownSurface(activeArtifact.mesh, activeRestoration.topologyMap, { center: localCenter, radiusMm: sculptRadius, strengthMm: sculptStrength, mode: sculptMode }, activeRestoration.locks); await commitGeometry(mesh, `sculpt-${sculptMode}`, `${sculptMode} sculpt at model-space crown surface`, { radiusMm: sculptRadius, strengthMm: sculptStrength }); }
    catch (error) { props.onStatus(message(error)); }
  };

  useImperativeHandle(ref, () => ({
    handleCanvasClick(hit) { if (!sculptMode || hit.objectId !== activeRestoration?.sceneObjectId) return false; void applySculpt(hit.position); return true; },
    handlePointerMove(clientX, clientY) { if (!sculptMode || !props.renderer) return false; const hit = props.renderer.pick(clientX, clientY); setHover(hit && hit.objectId === activeRestoration?.sceneObjectId ? hit.position : null); return true; },
  }), [activeRestoration?.sceneObjectId, props.renderer, sculptMode, sculptRadius, sculptStrength, activeArtifact?.id]);

  const applyMorph = async () => { if (!activeRestoration?.topologyMap || !activeArtifact) return; const center = centerOf(activeArtifact.mesh); try { await commitGeometry(scaleCrownAnatomy(activeArtifact.mesh, activeRestoration.topologyMap, center, morphScale, activeRestoration.locks), 'global-morph', 'Applied exact global crown morph', { scaleX: morphScale[0], scaleY: morphScale[1], scaleZ: morphScale[2] }); } catch (error) { props.onStatus(message(error)); } };
  const optimizeContact = async (side: 'mesial' | 'distal') => { if (!activeRestoration?.topologyMap || !activeArtifact) return; try { const objectId = side === 'mesial' ? mesialObjectId : distalObjectId; const target = generationInput().adjacentMeshes.find((value) => value.side === side && value.objectId === objectId); if (!target) throw new Error(`Assign a ${side} adjacent surface.`); const value = side === 'mesial' ? activeRestoration.parameters.targetMesialContactMm : activeRestoration.parameters.targetDistalContactMm; const mesh = optimizeProximalContact(activeArtifact.mesh, activeRestoration.topologyMap, target.mesh, side, value, side === 'mesial' ? activeRestoration.locks.mesialContact : activeRestoration.locks.distalContact); await commitGeometry(mesh, `contact-${side}-optimize`, `Optimized actual ${side} contact geometry`, { targetDistanceMm: value }); } catch (error) { props.onStatus(message(error)); } };
  const optimizeOcclusion = async () => { if (!activeRestoration?.topologyMap || !activeArtifact) return; try { const input = generationInput(); if (!input.antagonist) throw new Error('Assign an antagonist mesh.'); const mesh = optimizeStaticOcclusion(activeArtifact.mesh, activeRestoration.topologyMap, input.antagonist.mesh, activeRestoration.parameters.targetOcclusalClearanceMm, activeRestoration.locks.occlusion); await commitGeometry(mesh, 'occlusion-optimize', 'Optimized actual static occlusal geometry', { targetDistanceMm: activeRestoration.parameters.targetOcclusalClearanceMm }); } catch (error) { props.onStatus(message(error)); } };
  const autoThicken = async () => { if (!activeRestoration?.topologyMap || !activeArtifact) return; try { const mesh = autoThickenCrown(activeArtifact.mesh, activeRestoration.topologyMap, activeRestoration.materialProfileId, activeRestoration.locks); await commitGeometry(mesh, 'auto-thicken', 'Applied governed actual wall-thickness correction'); } catch (error) { props.onStatus(message(error)); } };

  const runQc = async () => {
    if (!activeRestoration || !activeArtifact) return; setBusy(true); try { const outputs = await runtimeMetrics.measureAsync('crown.export-preflight', () => validateAllCrownExports(activeArtifact.mesh), { formats: 4 }); const result = runCrownQc(activeRestoration, activeArtifact.mesh, outputs.map((output) => output.roundTrip)); await props.commandBus.execute(new CrownQcCommand(props.restorationManager, activeRestoration.id, result)); setRoundTrips(outputs); props.onStatus(`Crown QC ${result.overall}: ${result.failureCount} failures, ${result.warningCount} warnings; four exports round-tripped.`); }
    catch (error) { props.onStatus(message(error)); } finally { setBusy(false); }
  };
  const approve = async () => { if (!activeRestoration) return; await execute(props.commandBus.execute(new CrownApprovalCommand(context(), activeRestoration.id, 'APPROVED_FOR_EXPORT', props.userIdentity)), 'Restoration approved for manufacturing export.'); };
  const lockFinal = async () => { if (!activeRestoration) return; await execute(props.commandBus.execute(new CrownApprovalCommand(context(), activeRestoration.id, 'LOCKED', props.userIdentity)), 'Final restoration locked.'); };
  const exportAll = async () => {
    if (!activeRestoration?.activeVersionId || !activeArtifact) return; if (!['APPROVED_FOR_EXPORT', 'LOCKED'].includes(activeRestoration.approvalState)) { props.onStatus('Restoration must be APPROVED_FOR_EXPORT before manufacturing files can be downloaded.'); return; }
    try { const outputs = roundTrips.length === 4 ? roundTrips : await validateAllCrownExports(activeArtifact.mesh); if (outputs.some((output) => !output.roundTrip.passed)) throw new Error('Export round-trip validation failed; no manufacturing files were released.'); const now = new Date().toISOString(); const records: CrownExportRecord[] = outputs.map((output) => ({ id: crypto.randomUUID(), restorationId: activeRestoration.id, versionId: activeRestoration.activeVersionId!, format: output.format, fileName: `CADence-Crown-${activeRestoration.toothNumber}.${output.extension}`, createdAt: now, roundTrip: output.roundTrip })); await props.commandBus.execute(new CrownExportRecordCommand(props.restorationManager, activeRestoration.id, records)); outputs.forEach((output) => triggerCrownDownload(output, `CADence-Crown-${activeRestoration.toothNumber}-${output.format}`)); props.onStatus('Released binary STL, ASCII STL, OBJ, and PLY after successful automatic re-import validation.'); }
    catch (error) { props.onStatus(message(error)); }
  };

  const setLock = (key: keyof CrownLocks, value: boolean) => { if (!activeRestoration) return; void updateRecordState({ locks: { ...activeRestoration.locks, [key]: value } }, `crown.lock.${key}`, `${value ? 'Locked' : 'Unlocked'} ${key}`); };
  const setOverlay = (key: keyof typeof state.settings, value: number | boolean) => { const current = props.restorationManager.get(); void execute(props.commandBus.execute(new RestorationStateCommand(props.restorationManager, { ...current, settings: { ...current.settings, [key]: value } }, 'crown.overlay', `Set ${key}`)), `Updated ${key}.`); };

  return <section aria-label="Single crown design workspace" className="crown-workspace">
    <div className="panel-heading"><div><p className="eyebrow">PRODUCTION RESTORATION</p><h2>Single Crown</h2></div><span className="engine-tag">{state.engineVersion}</span></div>
    <div className="crown-flow"><span>Approved prep</span><b>→</b><span>Proposal</span><b>→</b><span>Fit &amp; anatomy</span><b>→</b><span>QC</span><b>→</b><span>Export</span></div>
    <label>Approved preparation<select aria-label="Crown preparation" value={preparationId} onChange={(event) => setPreparationId(event.target.value)}><option value="">Choose preparation</option>{eligiblePreparations.map((value) => <option key={value.id} value={value.id}>{value.name} · tooth {value.toothNumber ?? 'unset'}</option>)}</select></label>
    <div className="crown-grid two"><label>Universal tooth #<input aria-label="Crown tooth number" type="number" min="1" max="32" value={toothNumber} onChange={(event) => setToothNumber(event.target.value)}/></label><label>Material<select aria-label="Crown material" value={materialId} onChange={(event) => setMaterialId(event.target.value as CrownMaterialId)}>{Object.values(CROWN_MATERIAL_PROFILES).map((profile) => <option key={profile.id} value={profile.id}>{profile.label} · {profile.version}</option>)}</select></label></div>
    <div className="property-card"><span>Morphology</span><code>{safeMorphologyLabel(toothNumber)}</code><span>Library</span><code>{state.morphologyVersion}</code><span>Ownership</span><code>CADence procedural definitions</code></div>
    <div className="crown-grid two"><ObjectSelect label="Mesial adjacent" value={mesialObjectId} objects={assignableObjects} onChange={setMesialObjectId}/><ObjectSelect label="Distal adjacent" value={distalObjectId} objects={assignableObjects} onChange={setDistalObjectId}/><ObjectSelect label="Antagonist" value={antagonistObjectId} objects={assignableObjects} onChange={setAntagonistObjectId}/><ObjectSelect label="Pre-op / reference" value={referenceObjectId} objects={assignableObjects} onChange={setReferenceObjectId} optional/></div>
    {[...blockers, ...parameterErrors].map((value) => <p className="crown-error" key={value}>{value}</p>)}
    <details><summary>Restoration parameters and anatomy controls</summary><div className="crown-parameter-grid">{PARAMETER_FIELDS.map((field) => <label key={field.id}>{field.label}<div><input aria-label={field.label} type="number" min={field.min} max={field.max} step={field.step} value={Number(parameters[field.id])} onChange={(event) => setParameters({ ...parameters, [field.id]: Number(event.target.value) })}/>{field.unit && <span>{field.unit}</span>}</div></label>)}</div><div className="crown-grid two"><label>Radial segments<input type="number" min="24" max="192" value={parameters.radialSegments} onChange={(event) => setParameters({ ...parameters, radialSegments: Number(event.target.value) })}/></label><label>Surface rings<input type="number" min="6" max="64" value={parameters.surfaceRings} onChange={(event) => setParameters({ ...parameters, surfaceRings: Number(event.target.value) })}/></label></div></details>
    <div className="button-row wrap"><button className="primary crown-primary" disabled={busy || blockers.length > 0 || parameterErrors.length > 0} onClick={() => void generate()}>{activeRestoration ? 'REGENERATE CROWN FROM PARAMETERS' : 'AUTO DESIGN CROWN'}</button>{busy && <button onClick={() => controller.current?.abort()}>Cancel analysis</button>}</div>
    {progress && <div className="crown-progress"><progress value={progress.completed} max={Math.max(1, progress.total)}/><strong>{progress.stage}</strong><span>{progress.message}</span></div>}

    {activeRestoration && activeArtifact && <>
      <div className={`crown-state ${activeRestoration.approvalState.toLowerCase()}`}><strong>{activeRestoration.approvalState}</strong><span>v{activeRestoration.versionIds.length} · tooth {activeRestoration.toothNumber} · {activeRestoration.materialProfileId}</span><code>{activeRestoration.id}</code></div>
      <div className="section-heading"><h3>Constraint locks</h3><span>enforced by geometry commands</span></div><div className="lock-grid">{(Object.keys(activeRestoration.locks) as Array<keyof CrownLocks>).map((key) => <label key={key}><input type="checkbox" checked={activeRestoration.locks[key]} onChange={(event) => setLock(key, event.target.checked)}/>{key.replaceAll(/([A-Z])/g, ' $1')}</label>)}</div>
      <div className="section-heading"><h3>Actual anatomy editing</h3><span>derived versions</span></div>
      <div className="crown-grid three">{(['x', 'y', 'z'] as const).map((axis, index) => <label key={axis}>Morph {axis.toUpperCase()}<input type="number" min="0.7" max="1.3" step="0.01" value={morphScale[index]} onChange={(event) => setMorphScale(morphScale.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}</div><button onClick={() => void applyMorph()}>Apply global crown morph</button>
      <div className="sculpt-controls"><label>Brush radius mm<input type="number" min="0.1" step="0.1" value={sculptRadius} onChange={(event) => setSculptRadius(Number(event.target.value))}/></label><label>Strength mm<input type="number" min="0.01" step="0.01" value={sculptStrength} onChange={(event) => setSculptStrength(Number(event.target.value))}/></label><div className="button-row">{(['add', 'remove', 'smooth'] as SculptMode[]).map((mode) => <button className={sculptMode === mode ? 'active' : ''} key={mode} onClick={() => setSculptMode(sculptMode === mode ? null : mode)}>{mode} sculpt</button>)}</div>{sculptMode && <span>Click the actual crown surface to apply; hover point {hover ? hover.map((value) => value.toFixed(2)).join(', ') : '—'}</span>}</div>
      <div className="section-heading"><h3>Fit optimization</h3><span>static measured geometry</span></div><div className="button-row wrap"><button onClick={() => void optimizeContact('mesial')}>Optimize mesial contact</button><button onClick={() => void optimizeContact('distal')}>Optimize distal contact</button><button onClick={() => void optimizeOcclusion()}>Optimize static occlusion</button><button onClick={() => void autoThicken()}>Auto-thicken</button></div>
      <div className="analysis-grid"><AnalysisCard label="Cement space" status={activeRestoration.cementSpace?.status} value={activeRestoration.cementSpace ? `${activeRestoration.cementSpace.measuredMinimumMm.toFixed(3)}–${activeRestoration.cementSpace.measuredMaximumMm.toFixed(3)} mm` : 'not run'}/><AnalysisCard label="Seating" status={activeRestoration.seating?.status} value={activeRestoration.seating ? `${activeRestoration.seating.samples.length} path samples · ${activeRestoration.seating.blockingVertexIds.length} blockers` : 'not run'}/><AnalysisCard label="Mesial" status={activeRestoration.mesialContact?.status} value={contactValue(activeRestoration.mesialContact)}/><AnalysisCard label="Distal" status={activeRestoration.distalContact?.status} value={contactValue(activeRestoration.distalContact)}/><AnalysisCard label="Static occlusion" status={activeRestoration.occlusion?.status} value={activeRestoration.occlusion?.minimumDistanceMm === null || activeRestoration.occlusion?.minimumDistanceMm === undefined ? 'not run' : `${activeRestoration.occlusion.minimumDistanceMm.toFixed(3)} mm · ${activeRestoration.occlusion.contactPatches.length} patches`}/><AnalysisCard label="Minimum thickness" status={activeRestoration.thickness?.failingVertexIds.length ? 'fail' : 'pass'} value={activeRestoration.thickness ? `${activeRestoration.thickness.globalMinimumMm.toFixed(3)} mm · ${activeRestoration.thickness.failingVertexIds.length} failures` : 'not run'}/></div>
      <div className="overlay-toggles">{([['thicknessOverlayVisible', 'Thickness heatmap'], ['contactOverlayVisible', 'Contact heatmap'], ['occlusionOverlayVisible', 'Occlusion heatmap'], ['intaglioVisible', 'Intaglio surface']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(state.settings[key])} onChange={(event) => setOverlay(key, event.target.checked)}/>{label}</label>)}</div>
      <div className="section-heading"><h3>Crown QC &amp; manufacturing</h3><span>{activeQc?.rulesetVersion ?? 'not executed'}</span></div><div className="button-row wrap"><button className="primary" onClick={() => void runQc()} disabled={busy || activeRestoration.approvalState === 'LOCKED'}>Run complete crown QC + export preflight</button><button onClick={() => void approve()} disabled={activeRestoration.approvalState !== 'QC_PASSED'}>Approve for export</button><button onClick={() => void lockFinal()} disabled={activeRestoration.approvalState !== 'APPROVED_FOR_EXPORT'}>Lock final</button><button onClick={() => void exportAll()} disabled={!['APPROVED_FOR_EXPORT', 'LOCKED'].includes(activeRestoration.approvalState)}>Export STL / OBJ / PLY</button></div>
      {activeQc && <><div className={`validation-summary ${activeQc.overall}`}><strong>{activeQc.overall.toUpperCase()}</strong><span>{activeQc.failureCount} failures · {activeQc.warningCount} warnings · {activeQc.hardFailureCount} hard failures</span></div><div className="crown-qc-list">{activeQc.checks.map((item) => <article className={item.status} key={item.id}><div><strong>{item.id}</strong><span>{item.explanation}</span><code>Measured {String(item.measuredValue)} · {item.threshold}</code></div><b>{item.status}</b></article>)}</div></>}
      {!!roundTrips.length && <div className="roundtrip-list">{roundTrips.map((output) => <article className={output.roundTrip.passed ? 'pass' : 'fail'} key={output.format}><strong>{output.format}</strong><span>max deviation {output.roundTrip.maximumSurfaceDeviationMm.toFixed(6)} mm · {output.roundTrip.byteLength.toLocaleString()} bytes</span><code>{output.roundTrip.checksum}</code></article>)}</div>}
      <div className="version-list"><h3>Immutable restoration history</h3>{activeRestoration.versionIds.map((id) => { const version = state.versions.find((value) => value.id === id); return version && <article key={id}><strong>v{version.version} · {version.operation}</strong><span>{version.inspection.vertexCount} vertices · {version.inspection.triangleCount} triangles · watertight {String(version.inspection.watertight)}</span><code>{version.artifactId}</code></article>; })}</div>
    </>}
  </section>;
});

function ObjectSelect(props: { label: string; value: string; objects: SceneObject[]; onChange(value: string): void; optional?: boolean }) { return <label>{props.label}<select aria-label={props.label} value={props.value} onChange={(event) => props.onChange(event.target.value)}><option value="">{props.optional ? 'None' : 'Choose object'}</option>{props.objects.map((object) => <option key={object.id} value={object.id}>{object.name} · {object.type}</option>)}</select></label>; }
function AnalysisCard(props: { label: string; status?: string; value: string }) { return <article className={props.status ?? 'not-run'}><strong>{props.label}</strong><span>{props.value}</span><b>{props.status ?? 'not-run'}</b></article>; }
function contactValue(value: RestorationRecord['mesialContact']): string { return value?.minimumDistanceMm === null || value?.minimumDistanceMm === undefined ? 'not run' : `${value.minimumDistanceMm.toFixed(3)} mm · penetration ${value.penetrationMm.toFixed(3)} mm · ${value.patches.length} patches`; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function parameterRecord(value: CrownParameters): Record<string, number | string | boolean | null> { return Object.fromEntries(Object.entries(value)); }
function safeMorphologyLabel(toothNumber: string): string { try { const value = morphologyForTooth(toothNumber); return `${value.label} · ${value.id}@${value.version}`; } catch { return 'invalid permanent tooth number'; } }

function preparationBlockers(preparation: ReturnType<PreparationStateManager['get']>['preparations'][number] | undefined, state: ReturnType<PreparationStateManager['get']>): string[] {
  if (!preparation) return ['Select a crown preparation.']; const errors: string[] = []; const segmentation = state.segmentations.find((value) => value.id === preparation.activeSegmentationVersionId); const margin = state.margins.find((value) => value.id === preparation.approvedMarginVersionId); const axis = state.axes.find((value) => value.id === preparation.activeInsertionAxisAnalysisId); const qc = preparation.qcResultIds.length ? state.qcResults.find((value) => value.id === preparation.qcResultIds.at(-1)) : undefined;
  if (!segmentation?.locked) errors.push('Preparation region must be approved and locked.'); if (!margin || !['approved', 'locked'].includes(margin.stage) || !margin.quality?.valid) errors.push('A quality-validated approved margin is required.'); if (!axis?.locked || !axis.candidates.some((candidate) => candidate.valid && candidate.direction.every((value, index) => Math.abs(value - axis.selectedAxis[index]) < 1e-6))) errors.push('A valid locked insertion axis is required.'); if (!qc || qc.failureCount) errors.push('Preparation QC must have zero failures.'); return errors;
}

function meshRelativeTo(object: SceneObject, reference: SceneObject, artifacts: ArtifactRecord[]): ArtifactRecord['mesh'] {
  const artifact = artifacts.find((value) => value.id === object.artifactId); if (!artifact) throw new Error(`Artifact for ${object.name} is missing.`); const indexed = indexedMesh(artifact.mesh); const positions = indexed.positions.map((point) => inverseTransformPoint(transformPoint(point, object), reference)); return meshData({ positions, faces: indexed.faces.map((face) => [...face]) });
}
function centerOf(mesh: ArtifactRecord['mesh']): Vec3 { return [(mesh.bounds.min[0] + mesh.bounds.max[0]) / 2, (mesh.bounds.min[1] + mesh.bounds.max[1]) / 2, (mesh.bounds.min[2] + mesh.bounds.max[2]) / 2]; }
