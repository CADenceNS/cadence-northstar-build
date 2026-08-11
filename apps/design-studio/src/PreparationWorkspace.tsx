import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ArtifactManager, SceneManager } from './core';
import type { ArtifactRecord, MeshData, SceneObject, Vec3 } from './core';
import type { CommandBus } from './commands';
import type { EditingStateManager } from './editing-state';
import { buildTopology, faceArea, indexedMesh, meshData } from './editing-geometry';
import { boundsOfPoints, closestPointOnMesh, distance3, inverseTransformPoint, meshTriangles, transformPoint } from './geometry';
import type { IRenderer } from './interfaces';
import type { SurfaceHit, ViewerOverlay } from './inspection-types';
import {
  addMarginControlPoint,
  combineCandidateSections,
  deleteMarginControlPoint,
  deriveMarginVersion,
  dragMarginSection,
  drawManualMargin,
  extendMargin,
  insertMarginControlPoint,
  joinMargin,
  localReprojectMargin,
  moveMarginControlPoint,
  offsetMargin,
  reprojectMargin,
  resampleMargin,
  reverseMargin,
  setMarginClosed,
  simplifyMargin,
  smoothMargin,
  splitMargin,
  trimMargin,
} from './margin-editor';
import { approveMarginVersion, compareMarginVersions, evaluateMarginQuality, lockMarginVersion, manualMarginVersion, marginVersionFromCandidate } from './margin-engine';
import { MARGIN_TOOL_COVERAGE_REGISTRY } from './margin-tool-registry';
import {
  analyzeInsertionAxis,
  automaticSegmentation,
  createPreparationRecord,
  manualSegmentation,
  refineSegmentation,
  setInsertionAxis,
  setSegmentationLock,
  sharedBridgeAxis,
} from './preparation-engine';
import { PreparationWorkerClient } from './preparation-client';
import { MarginEditCommand, PreparationStateCommand } from './preparation-commands';
import { buildPreparationOverlays } from './preparation-overlays';
import { PREPARATION_MATERIAL_PROFILES } from './preparation-qc';
import type { PreparationStateManager } from './preparation-state';
import {
  type MarginCandidate,
  type MarginVersion,
  type PreparationAnalysisProgress,
  type PreparationCandidate,
  type PreparationKind,
  type PreparationProjectState,
  type PreparationRecord,
  type PreparationSegmentation,
} from './preparation-types';
import { runtimeMetrics } from './metrics';
import './preparation-styles.css';

export interface PreparationWorkspaceHandle {
  handleCanvasClick(hit: SurfaceHit): boolean;
  handlePointerMove(clientX: number, clientY: number): boolean;
}

interface Props {
  scene: SceneObject[];
  artifacts: ArtifactRecord[];
  sceneManager: SceneManager;
  artifactManager: ArtifactManager;
  editingManager: EditingStateManager;
  preparationManager: PreparationStateManager;
  commandBus: CommandBus;
  renderer: IRenderer | null;
  dentalAxis: Vec3;
  userIdentity: string | null;
  onStatus(message: string): void;
  onOverlays(overlays: ViewerOverlay[]): void;
}

type DrawMode = 'surface-following' | 'magnetic' | 'freehand' | 'spline' | 'point-by-point';

const PREPARATION_KINDS: Array<{ value: PreparationKind; label: string }> = [
  ['crown', 'Crown preparation'], ['bridge-abutment', 'Bridge abutment'], ['veneer', 'Veneer'], ['inlay', 'Inlay'], ['onlay', 'Onlay'], ['overlay', 'Overlay'], ['coping', 'Coping'],
  ['implant-restorative', 'Implant restorative'], ['partial-coverage', 'Partial coverage'], ['unknown', 'Unknown / manual classification'],
].map(([value, label]) => ({ value: value as PreparationKind, label }));

export const PreparationWorkspace = forwardRef<PreparationWorkspaceHandle, Props>(function PreparationWorkspace(props, ref) {
  const [state, setState] = useState(() => props.preparationManager.get());
  const [worker] = useState(() => new PreparationWorkerClient());
  const [progress, setProgress] = useState<PreparationAnalysisProgress | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [selectedMarginCandidateId, setSelectedMarginCandidateId] = useState('');
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [drawPoints, setDrawPoints] = useState<Vec3[]>([]);
  const [hoverPoint, setHoverPoint] = useState<Vec3 | null>(null);
  const [controlIndex, setControlIndex] = useState(0);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [numericValue, setNumericValue] = useState(0.2);
  const [secondaryValue, setSecondaryValue] = useState(1);
  const [vectorDraft, setVectorDraft] = useState<Vec3>([0, 0, 0.2]);
  const [axisDraft, setAxisDraft] = useState<Vec3>(props.dentalAxis);
  const [confidenceMinimum, setConfidenceMinimum] = useState(0);
  const [comparison, setComparison] = useState<string | null>(null);
  const [problemIndex, setProblemIndex] = useState(0);
  const [preoperativeObjectId, setPreoperativeObjectId] = useState('');
  const [showSegmentation, setShowSegmentation] = useState(true);
  const [showAxis, setShowAxis] = useState(true);
  const [showUndercuts, setShowUndercuts] = useState(false);

  const selectedObjects = useMemo(() => props.scene.filter((object) => object.selected), [props.scene]);
  const activePreparation = state.preparations.find((value) => value.id === state.activePreparationId);
  const selectedObject = selectedObjects[0] ?? props.scene.find((object) => object.id === activePreparation?.sceneObjectId);
  const selectedArtifact = selectedObject ? props.artifacts.find((artifact) => artifact.id === selectedObject.artifactId) : undefined;
  const selectedCandidate = state.candidates.find((value) => value.id === selectedCandidateId) ?? state.candidates.find((value) => value.sceneObjectId === selectedObject?.id && !['INSUFFICIENT_GEOMETRY', 'UNSUPPORTED'].includes(value.state));
  const segmentation = state.segmentations.find((value) => value.id === activePreparation?.activeSegmentationVersionId);
  const insertionAxis = state.axes.find((value) => value.id === activePreparation?.activeInsertionAxisAnalysisId);
  const activeMargin = state.margins.find((value) => value.id === activePreparation?.activeMarginVersionId);
  const activeQc = activePreparation?.qcResultIds.length ? state.qcResults.find((value) => value.id === activePreparation.qcResultIds.at(-1)) : undefined;
  const marginCandidates = selectedCandidate?.marginCandidates.filter((candidate) => !state.rejectedMarginCandidateIds.includes(candidate.id)) ?? [];
  const selectedMarginCandidate = marginCandidates.find((value) => value.id === selectedMarginCandidateId) ?? marginCandidates[0];
  const problematicSegments = activeMargin?.confidenceMeasurements.filter((segment) => ['low', 'ambiguous', 'discontinuous', 'reconstructed-missing-data'].includes(segment.category)) ?? [];

  useEffect(() => props.preparationManager.subscribe(() => setState(props.preparationManager.get())), [props.preparationManager]);
  useEffect(() => () => {
    controller.current?.abort();
    worker.dispose();
    props.onOverlays([]);
  }, [props.onOverlays, worker]);
  useEffect(() => { if (!selectedCandidateId && selectedCandidate) setSelectedCandidateId(selectedCandidate.id); }, [selectedCandidate, selectedCandidateId]);
  useEffect(() => { if (!selectedMarginCandidateId && marginCandidates[0]) setSelectedMarginCandidateId(marginCandidates[0].id); }, [marginCandidates, selectedMarginCandidateId]);
  useEffect(() => {
    const overlays = buildPreparationOverlays(state, props.scene, props.artifacts, { previewCandidateId: selectedMarginCandidate?.id ?? null, confidenceMinimum, showSegmentation, showAxis, showUndercuts });
    if (drawMode && selectedObject && drawPoints.length) {
      const local = [...drawPoints, ...(hoverPoint ? [hoverPoint] : [])]; const points = local.map((point) => transformPoint(point, selectedObject)); const bounds = boundsOfPoints(points);
      if (bounds) {
        overlays.push({ id: 'margin-manual-anchors', checkId: 'margin-manual-live', primitive: 'points', positions: points.flat(), color: [1, 0.76, 0.1, 1], elementCount: points.length, bounds, visible: true, label: `${drawMode} margin anchors` });
        if (points.length > 1) overlays.push({ id: 'margin-manual-preview', checkId: 'margin-manual-live', primitive: 'lines', positions: points.flatMap((point, index) => index ? [...points[index - 1], ...point] : []), color: [0.15, 0.95, 0.88, 1], elementCount: points.length - 1, bounds, visible: true, label: 'Live model-space margin preview' });
      }
    }
    const map = activePreparation?.measurements?.preoperativeReductionMap ?? [];
    if (map.length && selectedObject) {
      const points = map.map((value) => transformPoint(value.position, selectedObject)); const bounds = boundsOfPoints(points); if (bounds) overlays.push({ id: 'preoperative-reduction-map', checkId: 'preoperative-reduction-map', primitive: 'points', positions: points.flat(), color: [0.95, 0.18, 0.72, 0.75], elementCount: points.length, bounds, visible: true, label: 'Measured pre-operative reduction samples' });
    }
    props.onOverlays(overlays);
  }, [activePreparation?.measurements, confidenceMinimum, drawMode, drawPoints, hoverPoint, props.artifacts, props.scene, selectedMarginCandidate?.id, showAxis, showSegmentation, showUndercuts, state]);

  useImperativeHandle(ref, () => ({
    handleCanvasClick(hit) {
      if (!drawMode || !selectedObject || hit.objectId !== selectedObject.id) return false;
      const local = inverseTransformPoint(hit.position, selectedObject); setDrawPoints((current) => [...current, local]); props.onStatus(`${drawMode} margin point ${drawPoints.length + 1} placed on actual source geometry.`); return true;
    },
    handlePointerMove(clientX, clientY) {
      if (!drawMode || !props.renderer || !selectedObject) return false; const hit = props.renderer.pick(clientX, clientY); setHoverPoint(hit?.objectId === selectedObject.id ? inverseTransformPoint(hit.position, selectedObject) : null); return true;
    },
  }), [drawMode, drawPoints.length, props.renderer, selectedObject]);

  const execute = async (operation: Promise<void>, success: string) => { try { await operation; props.onStatus(success); } catch (error) { props.onStatus(message(error)); } };
  const commitState = async (next: PreparationProjectState, type: string, label: string, success = label) => execute(props.commandBus.execute(new PreparationStateCommand(props.preparationManager, next, type, label)), success);

  const runAnalysis = async (mode: 'detect-preparations' | 'detect-margins' | 'analyze-axis' | 'analyze-qc', manualAxis?: Vec3) => {
    if (!selectedObject || !selectedArtifact) { props.onStatus('Select a source mesh object first.'); return; }
    if (busyRequestId) { props.onStatus('A preparation analysis is already active.'); return; }
    if (mode !== 'detect-preparations' && (!activePreparation || !segmentation)) { props.onStatus('Identify and segment a preparation first.'); return; }
    const requestId = crypto.randomUUID(); const abort = new AbortController(); controller.current = abort; setBusyRequestId(requestId); setProgress(null);
    const preoperative = props.scene.find((object) => object.id === preoperativeObjectId); const antagonist = props.scene.find((object) => ['opposing', 'bite'].includes(object.type) && object.id !== selectedObject.id); const adjacent = props.scene.filter((object) => object.id !== selectedObject.id && object.id !== preoperative?.id && object.id !== antagonist?.id && ['upper', 'lower', 'preparation', 'reference'].includes(object.type)).slice(0, 4);
    const started = performance.now();
    try {
      const response = await worker.execute({
        requestId, artifactId: selectedArtifact.id, sceneObjectId: selectedObject.id, mesh: structuredClone(selectedArtifact.mesh), dentalAxis: props.dentalAxis, mode,
        ...(activePreparation ? { preparation: activePreparation } : {}), ...(segmentation ? { segmentation } : {}), ...(activeMargin ? { margin: activeMargin } : {}), ...(manualAxis ? { manualAxis } : {}),
        materialRuleId: activePreparation?.materialRuleId,
        ...(preoperative ? { preoperativeMesh: meshRelativeTo(preoperative, selectedObject, props.artifacts) } : {}),
        ...(antagonist ? { antagonistMesh: meshRelativeTo(antagonist, selectedObject, props.artifacts) } : {}),
        adjacentMeshes: adjacent.map((object) => meshRelativeTo(object, selectedObject, props.artifacts)),
      }, { signal: abort.signal, progress: setProgress });
      runtimeMetrics.record({ name: `preparation.${mode}`, durationMs: response.durationMs, startedAt: new Date(Date.now() - response.durationMs).toISOString(), metadata: { triangles: selectedArtifact.mesh.indices.length / 3 } });
      if (mode === 'detect-preparations') {
        const candidates = response.candidates ?? []; const next = props.preparationManager.get(); const value = { ...next, candidates: [...next.candidates.filter((candidate) => candidate.sceneObjectId !== selectedObject.id), ...candidates] }; await commitState(value, 'preparation.detect', 'Auto Detect Prep', `Preparation detection produced ${candidates.length} explicit result${candidates.length === 1 ? '' : 's'}.`); setSelectedCandidateId(candidates[0]?.id ?? '');
      } else if (mode === 'detect-margins') {
        const candidates = response.marginCandidates ?? []; const next = props.preparationManager.get(); const candidateId = activePreparation!.candidateId; if (!candidateId) throw new Error('Active preparation has no candidate lineage record.');
        await commitState({ ...next, candidates: next.candidates.map((candidate) => candidate.id === candidateId ? { ...candidate, marginCandidates: candidates } : candidate) }, 'margin.detect', 'Auto Detect Margin', `Margin detection retained ${candidates.length} ranked candidate${candidates.length === 1 ? '' : 's'}.`); setSelectedMarginCandidateId(candidates[0]?.id ?? '');
      } else if (mode === 'analyze-axis') {
        if (!response.axis) throw new Error('Insertion-axis worker returned no analysis.'); const next = props.preparationManager.get(); await commitState({ ...next, axes: [...next.axes, response.axis], preparations: next.preparations.map((value) => value.id === activePreparation!.id ? { ...value, insertionAxisAnalysisIds: [...value.insertionAxisAnalysisIds, response.axis!.id], activeInsertionAxisAnalysisId: response.axis!.id, updatedAt: new Date().toISOString() } : value) }, 'preparation.axis', manualAxis ? 'Define manual insertion axis' : 'Analyze insertion axis', 'Insertion-axis evidence and undercuts calculated.');
      } else {
        if (!response.measurements || !response.qc) throw new Error('Preparation QC worker returned incomplete evidence.'); const next = props.preparationManager.get(); const marginId = activeMargin?.id; const margins = marginId && response.marginQuality ? next.margins.map((value) => value.id === marginId ? { ...value, quality: response.marginQuality!, qcResultId: response.qc!.id, stage: 'qc' as const } : value) : next.margins;
        await commitState({ ...next, margins, qcResults: [...next.qcResults, response.qc], preparations: next.preparations.map((value) => value.id === activePreparation!.id ? { ...value, measurements: response.measurements!, qcResultIds: [...value.qcResultIds, response.qc!.id], updatedAt: new Date().toISOString() } : value) }, 'preparation.qc', 'Run Preparation QC', `Preparation QC ${response.qc.overall}: ${response.qc.failureCount} failures and ${response.qc.warningCount} warnings.`);
      }
      runtimeMetrics.record({ name: 'preparation.ui-roundtrip', durationMs: performance.now() - started, startedAt: new Date().toISOString(), metadata: { mode } });
    } catch (error) { props.onStatus(message(error)); }
    finally { setBusyRequestId(null); setProgress(null); controller.current = null; }
  };

  const identifyCandidate = async () => {
    if (!selectedCandidate || !selectedArtifact) { props.onStatus('Select a geometry-supported preparation candidate.'); return; }
    try {
      const record = createPreparationRecord(selectedCandidate); const segmentationValue = { ...automaticSegmentation(selectedCandidate, selectedArtifact), preparationId: record.id }; record.segmentationVersionIds = [segmentationValue.id]; record.activeSegmentationVersionId = segmentationValue.id;
      const next = props.preparationManager.get(); await commitState({ ...next, preparations: [...next.preparations, record], segmentations: [...next.segmentations, segmentationValue], activePreparationId: record.id }, 'preparation.identify', 'Identify preparation', `Identified ${record.name} from ${segmentationValue.faceIds.length} actual mesh faces.`);
    } catch (error) { props.onStatus(message(error)); }
  };

  const identifyManual = async () => {
    if (!selectedObject || !selectedArtifact) { props.onStatus('Select a source object first.'); return; }
    const selection = props.editingManager.get().componentSelections.find((value) => value.objectId === selectedObject.id && value.kind === 'face'); if (!selection?.ids.length) { props.onStatus('Select actual preparation faces in the Edit workspace, then return to Manual Identification.'); return; }
    try {
      const candidate = manualCandidate(selectedObject, selectedArtifact, selection.ids, props.dentalAxis); const record = createPreparationRecord(candidate, { kind: 'unknown' }); const segmentationValue = manualSegmentation(record.id, selectedArtifact, selectedObject.id, selection.ids); record.segmentationVersionIds = [segmentationValue.id]; record.activeSegmentationVersionId = segmentationValue.id; const next = props.preparationManager.get();
      await commitState({ ...next, candidates: [...next.candidates, candidate], preparations: [...next.preparations, record], segmentations: [...next.segmentations, segmentationValue], activePreparationId: record.id }, 'preparation.manual-identify', 'Manual preparation identification', `Manually identified preparation from ${selection.ids.length} selected mesh faces.`); setSelectedCandidateId(candidate.id);
    } catch (error) { props.onStatus(message(error)); }
  };

  const updatePreparation = async (patch: Partial<PreparationRecord>, label: string) => {
    if (!activePreparation) return; const next = props.preparationManager.get(); await commitState({ ...next, preparations: next.preparations.map((value) => value.id === activePreparation.id ? { ...value, ...structuredClone(patch), updatedAt: new Date().toISOString() } : value) }, 'preparation.update', label);
  };

  const refine = async (operation: 'grow' | 'shrink' | 'exclude-neighbors') => {
    if (!activePreparation || !segmentation || !selectedArtifact) return; try { const value = refineSegmentation(segmentation, selectedArtifact, operation, Math.max(1, Math.round(secondaryValue))); const next = props.preparationManager.get(); await commitState({ ...next, segmentations: [...next.segmentations, value], preparations: next.preparations.map((item) => item.id === activePreparation.id ? { ...item, segmentationVersionIds: [...item.segmentationVersionIds, value.id], activeSegmentationVersionId: value.id, updatedAt: new Date().toISOString() } : item) }, `preparation.segmentation.${operation}`, `${operation} preparation region`, `Preparation region v${value.version}: ${value.faceIds.length} faces.`); } catch (error) { props.onStatus(message(error)); }
  };

  const lockRegion = async () => {
    if (!activePreparation || !segmentation) return; try { const value = setSegmentationLock(segmentation, !segmentation.locked); const next = props.preparationManager.get(); await commitState({ ...next, segmentations: [...next.segmentations, value], preparations: next.preparations.map((item) => item.id === activePreparation.id ? { ...item, segmentationVersionIds: [...item.segmentationVersionIds, value.id], activeSegmentationVersionId: value.id, updatedAt: new Date().toISOString() } : item) }, 'preparation.segmentation.lock', value.locked ? 'Lock preparation region' : 'Unlock preparation region'); } catch (error) { props.onStatus(message(error)); }
  };

  const acceptMarginCandidate = async () => {
    if (!activePreparation || !segmentation || !selectedObject || !selectedMarginCandidate) { props.onStatus('Select a ranked margin candidate first.'); return; } const version = marginVersionFromCandidate(selectedMarginCandidate, activePreparation.id, segmentation.id, selectedObject);
    await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, version, version.curve, 'margin.accept-candidate', `Accept margin candidate ${selectedMarginCandidate.rank}`)), `Accepted candidate ${selectedMarginCandidate.rank} for technician review.`);
  };

  const rejectMarginCandidate = async () => { if (!selectedMarginCandidate) return; const next = props.preparationManager.get(); await commitState({ ...next, rejectedMarginCandidateIds: [...new Set([...next.rejectedMarginCandidateIds, selectedMarginCandidate.id])] }, 'margin.reject-candidate', `Reject margin candidate ${selectedMarginCandidate.rank}`); setSelectedMarginCandidateId(''); };

  const compareCandidates = () => {
    if (marginCandidates.length < 2 || !activePreparation || !segmentation || !selectedObject) { props.onStatus('Two ranked candidates are required for comparison.'); return; }
    const first = marginVersionFromCandidate(marginCandidates[0], activePreparation.id, segmentation.id, selectedObject); const second = marginVersionFromCandidate(marginCandidates[1], activePreparation.id, segmentation.id, selectedObject); const result = compareMarginVersions(first, second); setComparison(`Candidates 1/2 · mean ${result.meanDistanceMm.toFixed(4)} mm · max ${result.maximumDistanceMm.toFixed(4)} mm · length Δ ${result.lengthChangeMm.toFixed(4)} mm`);
  };

  const combineCandidates = async () => {
    if (marginCandidates.length < 2 || !activePreparation || !segmentation || !selectedObject) { props.onStatus('Two candidates are required.'); return; }
    try {
      const firstEnd = Number(window.prompt('Candidate 1 ending point index', String(Math.floor(marginCandidates[0].points.length / 2))) ?? ''); const secondStart = Number(window.prompt('Candidate 2 starting point index', String(Math.floor(marginCandidates[1].points.length / 2))) ?? '');
      const curve = combineCandidateSections(marginCandidates, [{ candidateId: marginCandidates[0].id, start: 0, end: firstEnd }, { candidateId: marginCandidates[1].id, start: secondStart, end: marginCandidates[1].points.length - 1 }]); curve.objectId = selectedObject.id; curve.artifactId = selectedObject.artifactId; const version = manualMarginVersion(curve, activePreparation.id, segmentation.id, activeMargin?.id ?? null);
      await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, version, curve, 'margin.combine-candidates', 'Combine candidate sections')), 'Combined explicit candidate sections without bridging unsupported geometry.');
    } catch (error) { props.onStatus(message(error)); }
  };

  const finishDrawing = async () => {
    if (!drawMode || !activePreparation || !segmentation || !selectedObject || !selectedArtifact) return;
    try { const curve = drawManualMargin(`${activePreparation.name} manual margin`, drawPoints, selectedArtifact, selectedObject, drawMode, state.settings, marginCandidates.flatMap((candidate) => candidate.points)); const version = manualMarginVersion(curve, activePreparation.id, segmentation.id, activeMargin?.id ?? null); await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, version, curve, `margin.draw-${drawMode}`, `Draw ${drawMode} margin`)), `Created ${drawMode} model-space margin.`); cancelDrawing(); } catch (error) { props.onStatus(message(error)); }
  };
  const cancelDrawing = () => { setDrawMode(null); setDrawPoints([]); setHoverPoint(null); };

  const applyMarginEdit = async (operation: string) => {
    if (!activeMargin || !selectedArtifact || !selectedObject) { props.onStatus('Accept or draw a margin before editing.'); return; }
    try {
      let version: MarginVersion; let related: MarginVersion[] = []; let additionalCurves: import('./editing-types').SurfaceCurve[] = [];
      if (operation === 'add') version = addMarginControlPoint(activeMargin, vectorDraft);
      else if (operation === 'delete') version = deleteMarginControlPoint(activeMargin, controlIndex);
      else if (operation === 'move') version = moveMarginControlPoint(activeMargin, controlIndex, vectorDraft, selectedArtifact);
      else if (operation === 'insert') version = insertMarginControlPoint(activeMargin, controlIndex, vectorDraft);
      else if (operation === 'drag') version = dragMarginSection(activeMargin, rangeStart, rangeEnd, vectorDraft, selectedArtifact);
      else if (operation === 'push') version = offsetMargin(activeMargin, Math.abs(numericValue), selectedArtifact);
      else if (operation === 'pull') version = offsetMargin(activeMargin, -Math.abs(numericValue), selectedArtifact);
      else if (operation === 'smooth-section') version = smoothMargin(activeMargin, clamp(numericValue, 0, 1), [rangeStart, rangeEnd]);
      else if (operation === 'smooth-all') version = smoothMargin(activeMargin, clamp(numericValue, 0, 1));
      else if (operation === 'simplify') version = simplifyMargin(activeMargin, Math.abs(numericValue));
      else if (operation === 'resample') version = resampleMargin(activeMargin, Math.abs(numericValue));
      else if (operation === 'extend') version = extendMargin(activeMargin, Math.abs(numericValue), Math.abs(secondaryValue));
      else if (operation === 'trim') version = trimMargin(activeMargin, Math.max(0, numericValue), Math.max(numericValue, secondaryValue));
      else if (operation === 'split') { const [first, secondCurve] = splitMargin(activeMargin, controlIndex); const second = manualMarginVersion(secondCurve, activeMargin.preparationId, activeMargin.preparationVersionId, activeMargin.id); version = first; related = [second]; additionalCurves = [secondCurve]; }
      else if (operation === 'join') { const other = state.margins.find((value) => value.preparationId === activeMargin.preparationId && value.id !== activeMargin.id && value.curve.id !== activeMargin.curve.id); if (!other) throw new Error('A second split or manually created margin curve is required.'); version = joinMargin(activeMargin, other.curve, Math.abs(numericValue)); }
      else if (operation === 'close') version = setMarginClosed(activeMargin, true);
      else if (operation === 'open') version = setMarginClosed(activeMargin, false);
      else if (operation === 'reverse') version = reverseMargin(activeMargin);
      else if (operation === 'reproject') version = reprojectMargin(activeMargin, selectedArtifact, selectedObject);
      else if (operation === 'local-reproject') version = localReprojectMargin(activeMargin, selectedArtifact, Array.from({ length: rangeEnd - rangeStart + 1 }, (_, index) => rangeStart + index));
      else if (operation === 'offset') version = offsetMargin(activeMargin, numericValue, selectedArtifact);
      else throw new Error(`Unknown margin operation ${operation}.`);
      await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, version, version.curve, `margin.${operation}`, `Margin ${operation}`, related, additionalCurves)), `Margin ${operation} created version ${version.id}.`);
    } catch (error) { props.onStatus(message(error)); }
  };

  const restoreVersion = async (kind: 'automatic' | 'approved' | 'previous') => {
    if (!activeMargin) return; const source = kind === 'previous' ? state.margins.find((value) => value.id === activeMargin.parentVersionId) : [...state.margins].reverse().find((value) => value.preparationId === activeMargin.preparationId && (kind === 'automatic' ? value.stage === 'automatic-candidate' : ['approved', 'locked'].includes(value.stage))); if (!source) { props.onStatus(`No ${kind} margin version exists.`); return; }
    const restored = deriveMarginVersion(activeMargin, source.curve, kind === 'automatic' ? 'draw-manual' : 'surface-reproject', { restoredVersionId: source.id });
    await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, restored, restored.curve, `margin.restore-${kind}`, `Restore ${kind} margin`)), `Restored ${kind} margin as a new immutable lineage version.`);
  };

  const runMarginQuality = async () => {
    if (!activeMargin || !activePreparation || !segmentation || !selectedArtifact) return; try { const quality = evaluateMarginQuality(activeMargin, selectedArtifact, segmentation.faceIds, insertionAxis?.selectedAxis ?? props.dentalAxis); const updated = { ...activeMargin, quality, stage: 'qc' as const }; await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, updated, updated.curve, 'margin.quality', 'Validate margin quality')), quality.valid ? 'Margin quality passed.' : `Margin quality failed at ${quality.defectiveSegmentIndices.length} segment references.`); } catch (error) { props.onStatus(message(error)); }
  };

  const approve = async () => {
    if (!activeMargin || !activeQc) { props.onStatus('Run margin quality and Preparation QC before approval.'); return; }
    try { const approved = approveMarginVersion(activeMargin, props.userIdentity, activeQc.failureCount); await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, approved, approved.curve, 'margin.approve', 'Approve margin')), 'Margin approved from measured quality and QC evidence.'); } catch (error) { props.onStatus(message(error)); }
  };
  const toggleMarginLock = async () => { if (!activeMargin) return; try { const value = lockMarginVersion(activeMargin, !activeMargin.locked); await execute(props.commandBus.execute(new MarginEditCommand(props.preparationManager, props.editingManager, value, value.curve, activeMargin.locked ? 'margin.unlock' : 'margin.lock', activeMargin.locked ? 'Unlock margin with history' : 'Lock approved margin')), value.locked ? 'Approved margin locked.' : 'Margin unlocked in a new history version.'); } catch (error) { props.onStatus(message(error)); } };

  const selectAxisCandidate = async (direction: Vec3) => { if (!insertionAxis) return; try { const value = setInsertionAxis(insertionAxis, direction); const next = props.preparationManager.get(); await commitState({ ...next, axes: [...next.axes, value], preparations: next.preparations.map((item) => item.id === activePreparation?.id ? { ...item, insertionAxisAnalysisIds: [...item.insertionAxisAnalysisIds, value.id], activeInsertionAxisAnalysisId: value.id } : item) }, 'preparation.axis.select', 'Select insertion-axis candidate'); } catch (error) { props.onStatus(message(error)); } };
  const toggleAxisLock = async () => { if (!insertionAxis) return; const value = { ...structuredClone(insertionAxis), id: crypto.randomUUID(), locked: !insertionAxis.locked, analyzedAt: new Date().toISOString() }; const next = props.preparationManager.get(); await commitState({ ...next, axes: [...next.axes, value], preparations: next.preparations.map((item) => item.id === activePreparation?.id ? { ...item, insertionAxisAnalysisIds: [...item.insertionAxisAnalysisIds, value.id], activeInsertionAxisAnalysisId: value.id } : item) }, 'preparation.axis.lock', value.locked ? 'Lock insertion axis' : 'Unlock insertion axis'); };

  const analyzeBridge = async () => { try { const analyses = state.preparations.flatMap((preparation) => { const axisId = preparation.activeInsertionAxisAnalysisId; const value = state.axes.find((axis) => axis.id === axisId); return value ? [value] : []; }); const result = sharedBridgeAxis(analyses); const next = props.preparationManager.get(); const group = { id: crypto.randomUUID(), preparationIds: analyses.map((analysis) => analysis.preparationId), commonAxis: result.commonAxis, conflict: result.conflict, conflictDegrees: result.conflictDegrees }; await commitState({ ...next, bridgeGroups: [...next.bridgeGroups, group] }, 'preparation.bridge-axis', 'Analyze shared bridge path', result.conflict ? `Bridge path conflict: ${result.conflictDegrees?.toFixed(2)}°.` : 'Common bridge path-of-draw calculated.'); } catch (error) { props.onStatus(message(error)); } };

  const runBatchQc = async () => {
    if (busyRequestId) { props.onStatus('A preparation analysis is already active.'); return; }
    const snapshot = props.preparationManager.get();
    try {
      const inputs = snapshot.preparations.map((preparation) => {
        const segmentationValue = snapshot.segmentations.find((value) => value.id === preparation.activeSegmentationVersionId); const marginValue = snapshot.margins.find((value) => value.id === preparation.activeMarginVersionId); const object = props.scene.find((value) => value.id === preparation.sceneObjectId); const artifact = object ? props.artifacts.find((value) => value.id === object.artifactId) : undefined;
        if (!segmentationValue || !marginValue || !object || !artifact) throw new Error(`${preparation.name} is missing an active segmentation, margin, scene object, or source artifact; batch QC did not skip it.`);
        return { preparation, segmentation: segmentationValue, margin: marginValue, object, artifact };
      });
      if (inputs.length < 2) throw new Error('Batch QC requires at least two identified preparations.');
      const batchId = crypto.randomUUID(); const abort = new AbortController(); controller.current = abort; setBusyRequestId(batchId); let next = snapshot; let failures = 0; let warnings = 0;
      for (let index = 0; index < inputs.length; index += 1) {
        const input = inputs[index]; const response = await worker.execute({ requestId: `${batchId}-${index}`, artifactId: input.artifact.id, sceneObjectId: input.object.id, mesh: structuredClone(input.artifact.mesh), dentalAxis: props.dentalAxis, mode: 'analyze-qc', preparation: input.preparation, segmentation: input.segmentation, margin: input.margin, materialRuleId: input.preparation.materialRuleId, adjacentMeshes: inputs.filter((value) => value.preparation.id !== input.preparation.id).map((value) => meshRelativeTo(value.object, input.object, props.artifacts)) }, { signal: abort.signal, progress: (value) => setProgress({ ...value, message: `${input.preparation.name}: ${value.message}` }) });
        if (!response.measurements || !response.qc || !response.marginQuality) throw new Error(`${input.preparation.name} returned incomplete batch-QC evidence.`);
        failures += response.qc.failureCount; warnings += response.qc.warningCount;
        next = { ...next, margins: next.margins.map((value) => value.id === input.margin.id ? { ...value, quality: response.marginQuality!, qcResultId: response.qc!.id, stage: 'qc' as const } : value), qcResults: [...next.qcResults, response.qc], preparations: next.preparations.map((value) => value.id === input.preparation.id ? { ...value, measurements: response.measurements!, qcResultIds: [...value.qcResultIds, response.qc!.id], updatedAt: new Date().toISOString() } : value) };
      }
      await commitState(next, 'preparation.batch-qc', 'Run batch preparation QC', `Batch QC completed for ${inputs.length} preparations: ${failures} failures and ${warnings} warnings.`);
    } catch (error) { props.onStatus(message(error)); }
    finally { setBusyRequestId(null); setProgress(null); controller.current = null; }
  };

  const focusProblem = () => { if (!problematicSegments.length || !props.renderer || !selectedObject) return; const segment = problematicSegments[problemIndex % problematicSegments.length]; const points = [transformPoint(segment.start, selectedObject), transformPoint(segment.end, selectedObject)]; const bounds = boundsOfPoints(points); if (bounds) props.renderer.focusBounds(expandBounds(bounds, 1)); setProblemIndex((value) => value + 1); };
  const focusControl = () => { const point = activeMargin?.curve.controlPoints[controlIndex]; if (!point || !selectedObject || !props.renderer) return; const world = transformPoint(point, selectedObject); props.renderer.focusBounds({ min: [world[0] - 1, world[1] - 1, world[2] - 1], max: [world[0] + 1, world[1] + 1, world[2] + 1] }); };

  return <section aria-label="Preparation and margin workspace" className="preparation-workspace">
    <div className="panel-heading"><div><p className="eyebrow">PRODUCTION GEOMETRY</p><h2>Preparation &amp; Margin</h2></div><span className="engine-badge">engine {state.engineVersion}</span></div>
    <ol className="prep-workflow" aria-label="Technician preparation workflow"><li>Identify</li><li>Margin</li><li>Confidence</li><li>Axis</li><li>QC</li><li>Approve</li></ol>

    <div className="section-heading"><h3>Preparation Workspace</h3><span>{state.preparations.length} prep{state.preparations.length === 1 ? '' : 's'}</span></div>
    <label>Active preparation<select aria-label="Active preparation" value={activePreparation?.id ?? ''} onChange={(event) => void commitState({ ...state, activePreparationId: event.target.value || null }, 'preparation.activate', 'Select preparation')}><option value="">Choose preparation</option>{state.preparations.map((preparation) => <option key={preparation.id} value={preparation.id}>{preparation.name} · {preparation.toothNumber ?? 'unassigned'}</option>)}</select></label>
    <div className="button-row wrap"><button className="primary" onClick={() => void runAnalysis('detect-preparations')} disabled={!selectedObject || Boolean(busyRequestId)}>Auto Detect Prep</button><button onClick={() => void identifyCandidate()} disabled={!selectedCandidate?.faceIds.length}>Accept preparation candidate</button><button onClick={() => void identifyManual()} disabled={!selectedObject}>Manual Identification</button><button onClick={() => busyRequestId && controller.current?.abort()} disabled={!busyRequestId}>Cancel analysis</button></div>
    {progress && <div className="tool-progress"><progress max={progress.total} value={progress.completed}/><span>{progress.stage}: {progress.message}</span></div>}
    <label>Detected candidate<select aria-label="Preparation candidate" value={selectedCandidate?.id ?? ''} onChange={(event) => setSelectedCandidateId(event.target.value)}><option value="">Choose candidate</option>{state.candidates.filter((candidate) => candidate.sceneObjectId === selectedObject?.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.state} · {(candidate.confidence * 100).toFixed(1)}%</option>)}</select></label>
    {selectedCandidate && <div className={`preparation-result ${selectedCandidate.state.toLowerCase()}`}><strong>{selectedCandidate.state}</strong><span>{selectedCandidate.toothPosition}</span><span>{selectedCandidate.faceIds.length} region faces · {selectedCandidate.marginCandidates.length} initial margin paths</span>{selectedCandidate.ambiguityReasons.map((reason) => <p key={reason}>{reason}</p>)}</div>}

    {activePreparation && <>
      <div className="prep-identity"><label>Preparation class<select value={activePreparation.kind} onChange={(event) => void updatePreparation({ kind: event.target.value as PreparationKind }, 'Classify preparation')}>{PREPARATION_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label><button onClick={() => { const name = window.prompt('Preparation name', activePreparation.name)?.trim(); if (name) void updatePreparation({ name }, 'Rename preparation'); }}>Rename</button><button onClick={() => { const toothNumber = window.prompt('Tooth number', activePreparation.toothNumber ?? '')?.trim(); if (toothNumber !== undefined) void updatePreparation({ toothNumber: toothNumber || null }, 'Assign tooth number'); }}>Assign tooth</button></div>
      <label>Governed QC profile<select value={activePreparation.materialRuleId} onChange={(event) => void updatePreparation({ materialRuleId: event.target.value }, 'Select governed material profile')}>{PREPARATION_MATERIAL_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
      <label>Registered pre-operative reference<select value={preoperativeObjectId} onChange={(event) => setPreoperativeObjectId(event.target.value)}><option value="">No verified pre-op reference</option>{props.scene.filter((object) => object.id !== activePreparation.sceneObjectId).map((object) => <option key={object.id} value={object.id}>{object.name} · {object.type}</option>)}</select></label>

      <div className="section-heading"><h3>Segmentation</h3><span>{segmentation ? `v${segmentation.version} · ${segmentation.faceIds.length} faces` : 'required'}</span></div>
      <label>Refinement rings<input type="number" min="1" max="20" value={secondaryValue} onChange={(event) => setSecondaryValue(Number(event.target.value))}/></label>
      <div className="button-row wrap"><button onClick={() => void refine('grow')} disabled={!segmentation || segmentation.locked}>Grow region</button><button onClick={() => void refine('shrink')} disabled={!segmentation || segmentation.locked}>Shrink region</button><button onClick={() => void refine('exclude-neighbors')} disabled={!segmentation || segmentation.locked}>Neighbor / tissue exclusion</button><button onClick={() => void lockRegion()} disabled={!segmentation}>{segmentation?.locked ? 'Unlock region' : 'Lock approved region'}</button><label><input type="checkbox" checked={showSegmentation} onChange={(event) => setShowSegmentation(event.target.checked)}/> Region overlay</label></div>

      <div className="section-heading"><h3>Automatic Margin Candidates</h3><span>{marginCandidates.length} retained</span></div>
      <div className="button-row wrap"><button className="primary" onClick={() => void runAnalysis('detect-margins')} disabled={!segmentation || Boolean(busyRequestId)}>Auto Detect Margin</button><button onClick={compareCandidates} disabled={marginCandidates.length < 2}>Compare candidates</button><button onClick={() => void combineCandidates()} disabled={marginCandidates.length < 2}>Combine valid sections</button><button onClick={() => { setDrawMode('point-by-point'); setDrawPoints([]); }}>Start manual margin</button></div>
      <label>Candidate selector<select value={selectedMarginCandidate?.id ?? ''} onChange={(event) => setSelectedMarginCandidateId(event.target.value)}><option value="">Choose candidate</option>{marginCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>Candidate {candidate.rank} · {(candidate.confidence * 100).toFixed(1)}% · {candidate.globalFinishLine}</option>)}</select></label>
      {selectedMarginCandidate && <div className="candidate-evidence"><span>Closed <code>{String(selectedMarginCandidate.closed)}</code></span><span>Length <code>{selectedMarginCandidate.lengthMm.toFixed(3)} mm</code></span><span>Curvature <code>{selectedMarginCandidate.meanCurvatureEvidence.toFixed(3)}</code></span><span>Normal transition <code>{selectedMarginCandidate.normalTransitionEvidence.toFixed(3)}</code></span><span>Continuity <code>{selectedMarginCandidate.continuityScore.toFixed(3)}</code></span><span>Support <code>{selectedMarginCandidate.surfaceSupport.toFixed(3)}</code></span><span>Missing <code>{selectedMarginCandidate.missingDataPercent.toFixed(2)}%</code></span><span>Class <code>{selectedMarginCandidate.globalFinishLine}</code></span></div>}
      <div className="button-row"><button onClick={() => void acceptMarginCandidate()} disabled={!selectedMarginCandidate}>Accept candidate</button><button onClick={() => void rejectMarginCandidate()} disabled={!selectedMarginCandidate}>Reject candidate</button></div>{comparison && <p className="comparison-card">{comparison}</p>}

      <div className="section-heading"><h3>Manual Margin &amp; Magnet</h3><span>{drawMode ?? 'inactive'}</span></div>
      <div className="button-row wrap">{(['surface-following', 'magnetic', 'freehand', 'spline', 'point-by-point'] as DrawMode[]).map((mode) => <button className={drawMode === mode ? 'active' : ''} key={mode} onClick={() => { setDrawMode(mode); setDrawPoints([]); }}>{mode.replaceAll('-', ' ')}</button>)}<button onClick={() => void finishDrawing()} disabled={!drawMode || drawPoints.length < (drawMode === 'spline' ? 3 : 2)}>Confirm drawn margin</button><button onClick={cancelDrawing} disabled={!drawMode}>Cancel draw</button></div>
      <label><input type="checkbox" checked={state.settings.magnetEnabled} onChange={(event) => void commitState({ ...state, settings: { ...state.settings, magnetEnabled: event.target.checked } }, 'margin.magnet.toggle', 'Toggle margin magnet')}/> Snap enabled</label>
      <div className="magnet-grid">{([['magnetStrength', 'Magnet strength', 0, 1, 0.05], ['magnetSearchRadiusMm', 'Search radius mm', 0.01, 10, 0.05], ['curvatureWeight', 'Curvature weight', 0, 1, 0.05], ['surfaceNormalWeight', 'Normal weight', 0, 1, 0.05], ['smoothing', 'Smoothing', 0, 1, 0.05]] as const).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} value={state.settings[key]} onChange={(event) => void commitState({ ...state, settings: { ...state.settings, [key]: Number(event.target.value) } }, 'margin.magnet.settings', `Set ${label}`)}/></label>)}</div>

      {activeMargin && <>
        <div className="section-heading"><h3>Margin Editor</h3><span>{activeMargin.stage} · {activeMargin.locked ? 'locked' : 'editable'}</span></div>
        <div className="margin-numeric-grid"><label>Control index<input type="number" min="0" max={Math.max(0, activeMargin.curve.controlPoints.length - 1)} value={controlIndex} onChange={(event) => setControlIndex(Number(event.target.value))}/></label><label>Range start<input type="number" min="0" value={rangeStart} onChange={(event) => setRangeStart(Number(event.target.value))}/></label><label>Range end<input type="number" min="0" value={rangeEnd} onChange={(event) => setRangeEnd(Number(event.target.value))}/></label><label>Numeric mm / strength<input type="number" step="0.01" value={numericValue} onChange={(event) => setNumericValue(Number(event.target.value))}/></label><label>Second numeric value<input type="number" step="0.01" value={secondaryValue} onChange={(event) => setSecondaryValue(Number(event.target.value))}/></label>{(['X', 'Y', 'Z'] as const).map((axisName, index) => <label key={axisName}>{axisName}<input type="number" step="0.01" value={vectorDraft[index]} onChange={(event) => setVectorDraft((current) => current.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}</div>
        <div className="margin-tool-grid">{[
          ['add', 'Add point'], ['delete', 'Delete point'], ['move', 'Move point'], ['insert', 'Insert point'], ['drag', 'Drag section'], ['push', 'Push margin'], ['pull', 'Pull margin'], ['smooth-section', 'Smooth section'], ['smooth-all', 'Smooth entire'], ['simplify', 'Simplify'], ['resample', 'Resample'], ['extend', 'Extend'], ['trim', 'Trim'], ['split', 'Split'], ['join', 'Join'], ['close', 'Close loop'], ['open', 'Open loop'], ['reverse', 'Reverse'], ['reproject', 'Surface reproject'], ['local-reproject', 'Local reproject'], ['offset', 'Numeric offset'],
        ].map(([id, label]) => <button key={id} onClick={() => void applyMarginEdit(id)} disabled={activeMargin.locked}>{label}</button>)}</div>
        <div className="button-row wrap"><button onClick={focusControl}>Precision magnification</button><button onClick={() => void restoreVersion('automatic')}>Restore automatic candidate</button><button onClick={() => void restoreVersion('approved')}>Restore previous approved</button><button onClick={() => void restoreVersion('previous')}>Restore parent version</button></div>
        <div className="section-heading"><h3>Confidence &amp; Finish Line</h3><span>{problematicSegments.length} problem regions</span></div>
        <label><input type="checkbox" checked={state.settings.confidenceOverlayVisible} onChange={(event) => void commitState({ ...state, settings: { ...state.settings, confidenceOverlayVisible: event.target.checked } }, 'margin.confidence.toggle', 'Toggle confidence map')}/> Confidence map</label><label>Visualization minimum<input type="range" min="0" max="1" step="0.05" value={confidenceMinimum} onChange={(event) => setConfidenceMinimum(Number(event.target.value))}/><span>{confidenceMinimum.toFixed(2)}</span></label><button onClick={focusProblem} disabled={!problematicSegments.length}>Step through problem regions</button>
        <div className="segment-table">{activeMargin.confidenceMeasurements.slice(0, 80).map((segment) => <article className={segment.category} key={segment.index}><strong>Segment {segment.index}</strong><span>{segment.finishLine} · {(segment.classificationConfidence * 100).toFixed(1)}%</span><code>confidence {segment.confidence.toFixed(3)} · dihedral {segment.dihedralDegrees.toFixed(2)}° · normal {segment.normalTransition.toFixed(3)}</code></article>)}</div>
      </>}

      <div className="section-heading"><h3>Insertion Axis / Path of Draw</h3><span>{insertionAxis ? `${insertionAxis.source} · ${insertionAxis.locked ? 'locked' : 'unlocked'}` : 'not analyzed'}</span></div>
      <div className="axis-grid">{(['X', 'Y', 'Z'] as const).map((axisName, index) => <label key={axisName}>Axis {axisName}<input type="number" step="0.01" value={axisDraft[index]} onChange={(event) => setAxisDraft((current) => current.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}</div>
      <div className="button-row wrap"><button className="primary" onClick={() => void runAnalysis('analyze-axis')}>Insertion Axis</button><button onClick={() => void runAnalysis('analyze-axis', axisDraft)}>Apply numeric manual axis</button><button onClick={() => void runAnalysis('analyze-axis', props.dentalAxis)}>Reset</button><button onClick={() => void runAnalysis('analyze-axis')}>Recalculate</button><button onClick={() => void toggleAxisLock()} disabled={!insertionAxis}>{insertionAxis?.locked ? 'Unlock axis' : 'Lock axis'}</button><button onClick={() => void analyzeBridge()} disabled={state.preparations.length < 2}>Common bridge path</button><label><input type="checkbox" checked={showAxis} onChange={(event) => setShowAxis(event.target.checked)}/> Axis gizmo</label><label><input type="checkbox" checked={showUndercuts} onChange={(event) => setShowUndercuts(event.target.checked)}/> Undercuts</label></div>
      {insertionAxis && <div className="axis-candidates">{insertionAxis.candidates.map((candidate, index) => <button key={candidate.id} onClick={() => void selectAxisCandidate(candidate.direction)}><strong>Axis {index + 1} {candidate.valid ? 'valid' : 'review'}</strong><span>undercut {candidate.undercutDepthMm.toFixed(3)} mm · visibility {(candidate.visibilityScore * 100).toFixed(1)}% · margin access {candidate.accessibleMarginPercent.toFixed(1)}%</span><code>{candidate.direction.map((value) => value.toFixed(5)).join(', ')}</code></button>)}</div>}

      <div className="section-heading"><h3>Preparation Analysis &amp; QC</h3><span>{activeQc?.overall ?? 'not run'}</span></div>
      <div className="button-row wrap"><button onClick={() => void runAnalysis('analyze-qc')}>Prep Analysis</button><button className="primary" onClick={() => void runAnalysis('analyze-qc')}>QC</button><button onClick={() => void runBatchQc()} disabled={state.preparations.length < 2 || Boolean(busyRequestId)}>Batch QC</button><button onClick={() => void runMarginQuality()} disabled={!activeMargin}>Margin completeness</button><button onClick={() => void approve()} disabled={!activeMargin || !activeQc}>Approve</button><button onClick={() => void toggleMarginLock()} disabled={!activeMargin}>{activeMargin?.locked ? 'Unlock' : 'Lock'}</button></div>
      {activePreparation.measurements && <div className="prep-measurements">{Object.entries(activePreparation.measurements).filter(([key]) => !['preoperativeReductionSamplesMm', 'preoperativeReductionMap', 'preparationId'].includes(key)).map(([key, value]) => <span key={key}>{key}<code>{typeof value === 'number' ? value.toFixed(4) : String(value)}</code></span>)}</div>}
      {activeQc && <div className={`qc-summary ${activeQc.overall}`}><strong>{activeQc.overall.toUpperCase()}</strong><span>{activeQc.failureCount} failures · {activeQc.warningCount} warnings · rules {activeQc.rulesetVersion}</span>{activeQc.checks.map((check) => <article className={check.status} key={check.id}><b>{check.id}</b><span>{check.explanation}</span><code>{String(check.measuredValue)} · {check.threshold}</code></article>)}</div>}

      <div className="section-heading"><h3>Margin History</h3><span>{activePreparation.marginVersionIds.length} versions</span></div>
      <div className="margin-history">{activePreparation.marginVersionIds.map((id) => state.margins.find((value) => value.id === id)).filter((value): value is MarginVersion => Boolean(value)).map((version) => <button className={version.id === activePreparation.activeMarginVersionId ? 'active' : ''} key={version.id} onClick={() => void commitState({ ...state, preparations: state.preparations.map((value) => value.id === activePreparation.id ? { ...value, activeMarginVersionId: version.id } : value) }, 'margin.version.activate', 'Activate margin version')}><strong>{version.stage}</strong><span>{version.createdAt} · {version.locked ? 'locked' : 'unlocked'}</span><code>{version.id}</code></button>)}</div>
    </>}

    <details className="tool-coverage"><summary>Margin Tool Coverage Registry · {MARGIN_TOOL_COVERAGE_REGISTRY.length} tools</summary>{MARGIN_TOOL_COVERAGE_REGISTRY.map((entry) => <article key={entry.toolId}><strong>{entry.toolId}</strong><span>{entry.productionStatus}</span><code>{entry.algorithm}</code></article>)}</details>
  </section>;
});

function manualCandidate(object: SceneObject, artifact: ArtifactRecord, faceIds: number[], axis: Vec3): PreparationCandidate {
  const mesh = indexedMesh(artifact.mesh); const topology = buildTopology(mesh); const points = [...new Set(faceIds.flatMap((faceId) => mesh.faces[faceId] ?? []))].map((id) => mesh.positions[id]); const bounds = boundsOfPoints(points) ?? { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 }; const dimensions = bounds.max.map((value, index) => value - bounds.min[index]) as Vec3; const area = faceIds.reduce((sum, faceId) => sum + (mesh.faces[faceId] ? faceArea(mesh, mesh.faces[faceId]) : 0), 0); const now = new Date().toISOString();
  return { id: crypto.randomUUID(), artifactId: artifact.id, sceneObjectId: object.id, shellIndex: -1, name: `${object.name} preparation`, toothPosition: 'manually assigned', kind: 'unknown', state: 'AUTO_DETECTED_REVIEW_REQUIRED', faceIds: [...faceIds], boundaryVertexIds: [], proposedInsertionAxis: [...axis], measurements: { vertexCount: mesh.positions.length, triangleCount: mesh.faces.length, finiteCoordinateRatio: 1, surfaceAreaMm2: area, boundingDimensionsMm: dimensions, candidateFeatureEdgeCount: 0, candidateLoopCount: 0, localHeightMm: Math.max(...dimensions), wallNormalDispersion: 1, taperDegrees: null, topologyBoundaryEdgeCount: topology.boundaryEdges.length, topologyNonManifoldEdgeCount: topology.nonManifoldEdges.length }, marginCandidates: [], ambiguityReasons: ['Preparation was identified by explicit technician face selection.'], confidence: 0, createdAt: now };
}

function meshRelativeTo(object: SceneObject, target: SceneObject, artifacts: ArtifactRecord[]): MeshData {
  const artifact = artifacts.find((value) => value.id === object.artifactId); if (!artifact) throw new Error(`Artifact ${object.artifactId} is unavailable.`); const source = indexedMesh(artifact.mesh); const determinant = object.transform.scale.reduce((product, value) => product * value, 1) / target.transform.scale.reduce((product, value) => product * value, 1);
  return meshData({ positions: source.positions.map((point) => inverseTransformPoint(transformPoint(point, object), target)), faces: source.faces.map(([a, b, c]) => determinant < 0 ? [a, c, b] : [a, b, c]) });
}
function expandBounds(bounds: { min: Vec3; max: Vec3 }, amount: number) { return { min: bounds.min.map((value) => value - amount) as Vec3, max: bounds.max.map((value) => value + amount) as Vec3 }; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
