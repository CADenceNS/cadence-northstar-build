import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CAMERA_PRESETS, cameraForPreset, createSavedView, type DentalCameraPreset } from './camera-views';
import {
  AddCollectionRecordCommand,
  CameraResetCommand,
  CameraViewCommand,
  CommandBus,
  DeleteArtifactCommand,
  DeleteCollectionRecordCommand,
  FitObjectsCommand,
  ImportArtifactCommand,
  IsolateCommand,
  ProjectionChangeCommand,
  RestoreVisibilityCommand,
  SceneObjectUpdateCommand,
  ToggleVisibilityCommand,
  UpdateCollectionRecordCommand,
} from './commands';
import {
  ArtifactManager,
  createProject,
  DENTAL_ROLES,
  DesignProject,
  ProjectStore,
  SceneManager,
  type ArtifactKind,
  type MeasurementAnchor,
  type MeasurementKind,
  type MeasurementRecord,
  type SavedView,
  type SceneObject,
  type StoredValidationReport,
  type Vec3,
} from './core';
import { ManagedMeshImporter } from './importers';
import type { IRenderer } from './interfaces';
import { anchorFromHit, createMeasurement, formatMeasurement, MEASUREMENT_LABELS, measurementSegments, requiredAnchorCount } from './measurements';
import { runtimeMetrics } from './metrics';
import { InstrumentedRenderer } from './renderer-adapter';
import { SelectionCommand } from './selection-command';
import { SelectionEngine } from './selection';
import { MeasurementManager, ProjectHistoryManager, SavedViewManager, ValidationReportManager } from './state-managers';
import { CaseScanSetManager, RegistrationReportManager } from './state-managers';
import type { MeasurementVisual, SurfaceHit, ViewerOverlay } from './inspection-types';
import { ValidationWorkerClient } from './validation-client';
import type { MeshValidationResult } from './mesh-validation';
import { buildValidationOverlays } from './validation-overlays';
import { createValidationReport, reportToCsv, reportToHtml, reportToJson } from './validation-reports';
import { autoAssembleCase, appendPairwiseResult } from './case-assembly';
import { estimateDentalCoordinates, manuallyCorrectDentalAxes, reverseAnteriorDirection } from './dental-coordinates';
import { alignLandmarkPairs, applyNumericAdjustment, nudgeTransform, userAdjustment } from './manual-registration';
import { RegistrationStateCommand } from './registration-commands';
import { RegistrationWorkerClient } from './registration-client';
import { buildRegistrationOverlays, coordinateOverlays } from './registration-overlays';
import { composeRigid, identityRigid, invertRigid } from './registration-math';
import { createRegistrationReport, registrationReportToCsv, registrationReportToHtml, registrationReportToJson } from './registration-reports';
import { enforceRegistrationSupport, registrationSupportDecision } from './registration-support';
import { synchronizeCaseScanSet, updateScan } from './scan-set';
import { SCAN_ROLES, type CaseScanRecord, type CaseScanSet, type PairwiseRegistrationResult, type RegistrationProgress, type RigidTransform, type ScanRole, type StoredRegistrationReport } from './registration-types';
import { validateScanForRegistration } from './scan-validation';
import { EditingStateManager } from './editing-state';
import { EditingWorkspace, type EditingWorkspaceHandle } from './EditingWorkspace';
import { PreparationStateManager } from './preparation-state';
import { PreparationWorkspace, type PreparationWorkspaceHandle } from './PreparationWorkspace';
import { RestorationStateManager } from './restoration-state';
import { CrownWorkspace, type CrownWorkspaceHandle } from './CrownWorkspace';
import './styles.css';

const projectStore = new ProjectStore();
const importer = new ManagedMeshImporter();

type ValidationHistory = { current: MeshValidationResult; previous?: MeshValidationResult };
type MeasurementPlacement = { kind: MeasurementKind; editingId?: string };
type ManualPlacement = { method: 'three-point' | 'surface-points'; source: Vec3[]; target: Vec3[]; next: 'source' | 'target' };

export function App() {
  const [project, setProject] = useState<DesignProject>(() => {
    const start = performance.now();
    const recovered = projectStore.recover();
    runtimeMetrics.record({ name: 'project.recovery', durationMs: performance.now() - start, startedAt: new Date().toISOString(), metadata: { recovered: Boolean(recovered) } });
    return recovered ?? createProject('New Design Project');
  });
  const [sceneManager] = useState(() => new SceneManager(project.scene));
  const [artifactManager] = useState(() => new ArtifactManager(project.artifacts));
  const [selectionEngine] = useState(() => new SelectionEngine(sceneManager));
  const [commandBus] = useState(() => new CommandBus());
  const [measurementManager] = useState(() => new MeasurementManager(project.measurements));
  const [savedViewManager] = useState(() => new SavedViewManager(project.savedViews));
  const [reportManager] = useState(() => new ValidationReportManager(project.validationReports));
  const [caseScanManager] = useState(() => new CaseScanSetManager(synchronizeCaseScanSet(project.caseScanSet, project.scene, project.artifacts)));
  const [registrationReportManager] = useState(() => new RegistrationReportManager(project.registrationReports));
  const [projectHistory] = useState(() => new ProjectHistoryManager(project.history));
  const [editingManager] = useState(() => new EditingStateManager(project.editing));
  const [preparationManager] = useState(() => new PreparationStateManager(project.preparation));
  const [restorationManager] = useState(() => new RestorationStateManager(project.restoration));
  const [validationClient] = useState(() => new ValidationWorkerClient());
  const [registrationClient] = useState(() => new RegistrationWorkerClient());

  const [scene, setScene] = useState<SceneObject[]>(() => sceneManager.list());
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>(() => measurementManager.list());
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => savedViewManager.list());
  const [reports, setReports] = useState<StoredValidationReport[]>(() => reportManager.list());
  const [caseScanSet, setCaseScanSet] = useState<CaseScanSet>(() => caseScanManager.get());
  const [registrationReports, setRegistrationReports] = useState<StoredRegistrationReport[]>(() => registrationReportManager.list());
  const [status, setStatus] = useState('Ready');
  const [dirty, setDirty] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [metricsVersion, setMetricsVersion] = useState(0);
  const [recoveryAvailable, setRecoveryAvailable] = useState(() => Boolean(projectStore.recover()));
  const [inspectorTab, setInspectorTab] = useState<'scene' | 'measure' | 'validate' | 'register' | 'edit' | 'prepare' | 'crown'>('scene');
  const [opacityDraft, setOpacityDraft] = useState(100);
  const [placement, setPlacement] = useState<MeasurementPlacement | null>(null);
  const [pendingAnchors, setPendingAnchors] = useState<MeasurementAnchor[]>([]);
  const [previewHit, setPreviewHit] = useState<SurfaceHit | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [validationHistory, setValidationHistory] = useState<Record<string, ValidationHistory>>({});
  const [validationObjectId, setValidationObjectId] = useState('');
  const [validating, setValidating] = useState(false);
  const [overlays, setOverlays] = useState<ViewerOverlay[]>([]);
  const [editingOverlays, setEditingOverlays] = useState<ViewerOverlay[]>([]);
  const [preparationOverlays, setPreparationOverlays] = useState<ViewerOverlay[]>([]);
  const [crownOverlays, setCrownOverlays] = useState<ViewerOverlay[]>([]);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const [registrationSourceId, setRegistrationSourceId] = useState('');
  const [registrationTargetId, setRegistrationTargetId] = useState('');
  const [registrationResult, setRegistrationResult] = useState<PairwiseRegistrationResult | null>(null);
  const [registrationProgress, setRegistrationProgress] = useState<RegistrationProgress | null>(null);
  const [activeRegistrationId, setActiveRegistrationId] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);
  const [showRegistrationAfter, setShowRegistrationAfter] = useState(true);
  const [heatmapRange, setHeatmapRange] = useState(1);
  const [manualPlacement, setManualPlacement] = useState<ManualPlacement | null>(null);
  const [numericTranslation, setNumericTranslation] = useState<Vec3>([0, 0, 0]);
  const [numericRotation, setNumericRotation] = useState<Vec3>([0, 0, 0]);
  const [overlayOpacity, setOverlayOpacity] = useState(75);
  const [planeDraft, setPlaneDraft] = useState<Vec3>([0, 0, 1]);
  const [midlineDraft, setMidlineDraft] = useState<Vec3>([0, 1, 0]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<IRenderer | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef<EditingWorkspaceHandle>(null);
  const preparationRef = useRef<PreparationWorkspaceHandle>(null);
  const crownRef = useRef<CrownWorkspaceHandle>(null);

  useEffect(() => sceneManager.subscribe(() => {
    runtimeMetrics.measure('scene.update', () => setScene(sceneManager.list()), { objects: sceneManager.list().length });
    setDirty(true);
  }), [sceneManager]);
  useEffect(() => measurementManager.subscribe(() => { setMeasurements(measurementManager.list()); setDirty(true); }), [measurementManager]);
  useEffect(() => savedViewManager.subscribe(() => { setSavedViews(savedViewManager.list()); setDirty(true); }), [savedViewManager]);
  useEffect(() => reportManager.subscribe(() => { setReports(reportManager.list()); setDirty(true); }), [reportManager]);
  useEffect(() => caseScanManager.subscribe(() => { setCaseScanSet(caseScanManager.get()); setDirty(true); }), [caseScanManager]);
  useEffect(() => registrationReportManager.subscribe(() => { setRegistrationReports(registrationReportManager.list()); setDirty(true); }), [registrationReportManager]);
  useEffect(() => projectHistory.subscribe(() => setDirty(true)), [projectHistory]);
  useEffect(() => editingManager.subscribe(() => setDirty(true)), [editingManager]);
  useEffect(() => preparationManager.subscribe(() => setDirty(true)), [preparationManager]);
  useEffect(() => restorationManager.subscribe(() => setDirty(true)), [restorationManager]);
  useEffect(() => commandBus.subscribe(() => setHistoryVersion((value) => value + 1)), [commandBus]);
  useEffect(() => runtimeMetrics.subscribe(() => setMetricsVersion((value) => value + 1)), []);
  useEffect(() => () => validationClient.dispose(), [validationClient]);
  useEffect(() => () => registrationClient.dispose(), [registrationClient]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewer = new InstrumentedRenderer(canvas, project.camera, (camera) => {
      setProject((current) => ({ ...current, camera }));
      setDirty(true);
    });
    viewerRef.current = viewer;
    return () => { viewer.dispose(); viewerRef.current = null; };
  }, []);

  useEffect(() => { viewerRef.current?.setScene(scene, artifactManager.list()); }, [scene, artifactManager]);
  useEffect(() => { viewerRef.current?.setCamera(project.camera); }, [project.camera]);
  useEffect(() => { viewerRef.current?.setValidationOverlays([...overlays, ...editingOverlays, ...preparationOverlays, ...crownOverlays]); }, [crownOverlays, editingOverlays, overlays, preparationOverlays]);
  useEffect(() => {
    const next = synchronizeCaseScanSet(caseScanManager.get(), scene, artifactManager.list());
    const current = caseScanManager.get();
    if (JSON.stringify(current.scans.map((scan) => [scan.id, scan.artifactId, scan.sceneObjectId, scan.locked])) !== JSON.stringify(next.scans.map((scan) => [scan.id, scan.artifactId, scan.sceneObjectId, scan.locked]))) caseScanManager.replace(next);
  }, [artifactManager, caseScanManager, scene]);
  useEffect(() => {
    const visuals: MeasurementVisual[] = measurements.map((measurement) => ({
      id: measurement.id,
      points: measurement.anchors.map((anchor) => anchor.position),
      segments: measurementSegments(measurement),
      color: [0.15, 0.95, 0.88, 1],
      visible: measurement.visible,
    }));
    if (placement) {
      const points = [...pendingAnchors.map((anchor) => anchor.position), ...(previewHit ? [previewHit.position] : [])];
      const segments: Array<[Vec3, Vec3]> = [];
      for (let index = 1; index < points.length; index += 1) segments.push([points[index - 1], points[index]]);
      visuals.push({ id: 'measurement-live-preview', points, segments, color: [1, 0.78, 0.18, 1], visible: true });
    }
    viewerRef.current?.setMeasurementVisuals(visuals);
  }, [measurements, pendingAnchors, placement, previewHit, project.camera]);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, caseScanSet, registrationReports, projectHistory.list(), editingManager, preparationManager, restorationManager);
      projectStore.autoSave(snapshot);
      setRecoveryAvailable(true);
      setStatus(`Auto-saved ${new Date().toLocaleTimeString()}`);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [artifactManager, caseScanSet, dirty, editingManager, historyVersion, measurements, preparationManager, project, projectHistory, registrationReports, reports, restorationManager, savedViews, scene]);

  const selectedObjects = useMemo(() => scene.filter((object) => object.selected), [scene]);
  const selected = selectedObjects[0];
  const artifacts = useMemo(() => artifactManager.list(), [artifactManager, scene]);
  const artifactMap = useMemo(() => new Map(artifacts.map((artifact) => [artifact.id, artifact])), [scene, historyVersion]);
  const visibleCount = scene.filter((object) => object.visible).length;
  const triangleCount = artifacts.reduce((total, artifact) => total + artifact.mesh.indices.length / 3, 0);
  const metricSummary = useMemo(() => runtimeMetrics.summary(), [metricsVersion]);
  const selectedMeasurement = selectedMeasurementId ? measurementManager.get(selectedMeasurementId) : undefined;
  const validationTarget = sceneManager.get(validationObjectId) ?? selected;
  const validationArtifact = validationTarget ? artifactManager.get(validationTarget.artifactId) : undefined;
  const currentValidation = validationArtifact ? validationHistory[validationArtifact.id]?.current : undefined;
  const previousValidation = validationArtifact ? validationHistory[validationArtifact.id]?.previous : undefined;
  const registrationSource = caseScanSet.scans.find((scan) => scan.id === registrationSourceId);
  const registrationTarget = caseScanSet.scans.find((scan) => scan.id === registrationTargetId);
  const registrationSourceObject = registrationSource ? sceneManager.get(registrationSource.sceneObjectId) : undefined;
  const registrationTargetObject = registrationTarget ? sceneManager.get(registrationTarget.sceneObjectId) : undefined;

  useEffect(() => { setOpacityDraft(Math.round((selected?.material.opacity ?? 1) * 100)); }, [selected?.id, selected?.material.opacity]);
  useEffect(() => { if (selected && !validationObjectId) setValidationObjectId(selected.id); }, [selected?.id]);
  useEffect(() => {
    const scans = selectedObjects.map((object) => caseScanSet.scans.find((scan) => scan.sceneObjectId === object.id)).filter((scan): scan is CaseScanRecord => Boolean(scan));
    if (scans[0] && !registrationSourceId) setRegistrationSourceId(scans[0].id);
    if (scans[1] && !registrationTargetId) setRegistrationTargetId(scans[1].id);
  }, [caseScanSet.scans, registrationSourceId, registrationTargetId, selectedObjects]);

  const context = () => {
    const renderer = viewerRef.current;
    if (!renderer) throw new Error('Viewer is not ready');
    return { scene: sceneManager, artifacts: artifactManager, renderer };
  };

  const run = async (operation: Promise<void>, success?: string) => {
    try { await operation; if (success) setStatus(success); setDirty(true); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Runtime operation failed'); }
  };

  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setStatus(`Importing ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      commandBus.beginTransaction(`Import ${files.length} artifacts`);
      for (const file of files) {
        const result = await importer.import({ file }, artifactManager.list());
        await commandBus.execute(new ImportArtifactCommand(context(), result.artifact));
      }
      commandBus.commitTransaction();
      runtimeMetrics.estimateMemory(artifactManager.list());
      setProject((current) => ({ ...current, artifacts: artifactManager.list() }));
      viewerRef.current?.fitObjects();
      setStatus(`Imported ${files.length} model${files.length === 1 ? '' : 's'}`);
      setDirty(true);
    } catch (error) {
      try { await commandBus.rollbackTransaction(); } catch { /* no active transaction */ }
      setStatus(error instanceof Error ? error.message : 'Import failed');
    } finally { event.target.value = ''; }
  };

  const resetRuntime = (next: DesignProject) => {
    sceneManager.replace(next.scene); artifactManager.replace(next.artifacts);
    measurementManager.replace(next.measurements); savedViewManager.replace(next.savedViews);
    reportManager.replace(next.validationReports); projectHistory.replace(next.history);
    caseScanManager.replace(synchronizeCaseScanSet(next.caseScanSet, next.scene, next.artifacts)); registrationReportManager.replace(next.registrationReports); editingManager.replace(next.editing); preparationManager.replace(next.preparation); restorationManager.replace(next.restoration);
    selectionEngine.restore({ activeSet: 'Default', sets: { Default: next.scene.filter((item) => item.selected).map((item) => ({ kind: 'object', objectId: item.id })) } });
    setProject(next); setOverlays([]); setEditingOverlays([]); setPreparationOverlays([]); setCrownOverlays([]); setValidationHistory({}); setPlacement(null); setPendingAnchors([]); setPreviewHit(null); setRegistrationResult(null); setRegistrationProgress(null); setActiveRegistrationId(null); setManualPlacement(null);
  };

  const newProject = () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new project?')) return;
    resetRuntime(createProject('New Design Project'));
    projectStore.clearRecovery(); setRecoveryAvailable(false); setDirty(false); setStatus('New project created');
  };

  const closeProject = () => {
    if (dirty && !window.confirm('Close this project and discard unsaved changes?')) return;
    resetRuntime(createProject('No Project Open'));
    projectStore.clearRecovery(); setRecoveryAvailable(false); setDirty(false); setStatus('Project closed');
  };

  const saveProject = () => {
    const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, caseScanSet, registrationReports, projectHistory.list(), editingManager, preparationManager, restorationManager);
    const saved = runtimeMetrics.measure('project.save', () => projectStore.save(snapshot), { objects: scene.length, measurements: measurements.length, reports: reports.length });
    setProject(saved); setDirty(false); setRecoveryAvailable(false); setStatus(`Saved ${saved.name}`);
  };

  const saveAs = () => {
    const name = window.prompt('Project name', `${project.name} Copy`)?.trim(); if (!name) return;
    const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, caseScanSet, registrationReports, projectHistory.list(), editingManager, preparationManager, restorationManager);
    const saved = runtimeMetrics.measure('project.save', () => projectStore.saveAs(snapshot, name), { objects: scene.length, measurements: measurements.length, reports: reports.length });
    setProject(saved); setDirty(false); setRecoveryAvailable(false); setStatus(`Saved as ${saved.name}`);
  };

  const openProject = (id: string) => {
    if (dirty && !window.confirm('Discard unsaved changes and open another project?')) return;
    try {
      const opened = runtimeMetrics.measure('project.reopen', () => projectStore.open(id));
      resetRuntime(opened); setDirty(false); setRecentOpen(false); setStatus(`Opened ${opened.name}`);
      requestAnimationFrame(() => viewerRef.current?.fitObjects());
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to open project'); }
  };

  const recoverProject = () => {
    const start = performance.now(); const recovered = projectStore.recover();
    runtimeMetrics.record({ name: 'project.recovery', durationMs: performance.now() - start, startedAt: new Date().toISOString(), metadata: { recovered: Boolean(recovered) } });
    if (!recovered) return;
    resetRuntime(recovered); setDirty(true); setStatus('Recovered auto-saved project');
  };

  const updateSelected = (patch: Partial<Omit<SceneObject, 'id' | 'artifactId'>>, label: string) => {
    if (selected) void run(commandBus.execute(new SceneObjectUpdateCommand(sceneManager, selected.id, patch, label)), label);
  };

  const renameSelected = () => {
    if (!selected) return; const name = window.prompt('Object name', selected.name)?.trim();
    if (name && name !== selected.name) updateSelected({ name }, `Renamed ${selected.name}`);
  };

  const deleteSelected = async () => {
    if (!selectedObjects.length) return;
    try {
      commandBus.beginTransaction(`Delete ${selectedObjects.length} objects`);
      for (const object of selectedObjects) await commandBus.execute(new DeleteArtifactCommand(context(), object.artifactId));
      commandBus.commitTransaction(); setStatus(`Deleted ${selectedObjects.length} object${selectedObjects.length === 1 ? '' : 's'}`);
    } catch (error) {
      try { await commandBus.rollbackTransaction(); } catch { /* no active transaction */ }
      setStatus(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const fit = (ids?: string[]) => { const renderer = viewerRef.current; if (renderer) void run(commandBus.execute(new FitObjectsCommand(renderer, ids)), ids?.length ? 'Fit selected' : 'Fit all'); };
  const applyPreset = (preset: DentalCameraPreset) => { const renderer = viewerRef.current; if (renderer) void run(commandBus.execute(new CameraViewCommand(renderer, cameraForPreset(renderer.getCamera(), preset), `${CAMERA_PRESETS.find((item) => item.id === preset)?.label} view`))); };

  const saveCurrentView = () => {
    const renderer = viewerRef.current; if (!renderer) return;
    const name = window.prompt('Saved view name', `View ${savedViews.length + 1}`)?.trim(); if (!name) return;
    const view = createSavedView(name, renderer.getCamera());
    void run(commandBus.execute(new AddCollectionRecordCommand(savedViewManager, view, 'camera.saved-view.add', `Save view ${name}`)), `Saved view ${name}`);
  };

  const renameView = (view: SavedView) => {
    const name = window.prompt('Saved view name', view.name)?.trim(); if (!name || name === view.name) return;
    void run(commandBus.execute(new UpdateCollectionRecordCommand(savedViewManager, view.id, { name, updatedAt: new Date().toISOString() }, 'camera.saved-view.rename', `Rename view ${view.name}`)), `Renamed view to ${name}`);
  };

  const beginMeasurement = (kind: MeasurementKind, editingId?: string) => {
    const selectedIds = selectedObjects.map((object) => object.id);
    if (kind === 'bounding-dimensions' && selectedIds.length !== 1) { setStatus('Select exactly one object for bounding dimensions.'); return; }
    if (['clearance-distance', 'minimum-object-distance'].includes(kind) && selectedIds.length !== 2) { setStatus('Select exactly two objects for this measurement.'); return; }
    setInspectorTab('measure'); setPendingAnchors([]); setPreviewHit(null); setPlacement({ kind, editingId });
    setStatus(`${MEASUREMENT_LABELS[kind]} active`);
    if (requiredAnchorCount(kind) === 0) void completeMeasurement(kind, [], editingId);
  };

  const completeMeasurement = async (kind: MeasurementKind, anchors: MeasurementAnchor[], editingId?: string) => {
    try {
      const record = runtimeMetrics.measure('measurement.calculate', () => createMeasurement({
        kind,
        anchors,
        objectIds: selectedObjects.map((object) => object.id),
        artifacts: artifactManager.list(),
        scene: sceneManager.list(),
        existingId: editingId,
        name: editingId ? measurementManager.get(editingId)?.name : undefined,
        precision: editingId ? measurementManager.get(editingId)?.precision : project.settings.units === 'mm' ? 2 : 2,
      }), { kind });
      if (editingId) {
        const previous = measurementManager.get(editingId); if (!previous) throw new Error('Measurement to edit was not found.');
        record.createdAt = previous.createdAt;
        const { id: _id, ...patch } = record;
        await commandBus.execute(new UpdateCollectionRecordCommand(measurementManager, editingId, patch, 'measurement.edit', `Edit ${record.name}`));
      } else await commandBus.execute(new AddCollectionRecordCommand(measurementManager, record, 'measurement.add', `Add ${record.name}`));
      setSelectedMeasurementId(record.id); setPlacement(null); setPendingAnchors([]); setPreviewHit(null); setStatus(`${record.name}: ${formatMeasurement(record)}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Measurement failed'); setPlacement(null); setPendingAnchors([]); setPreviewHit(null); }
  };

  const handleCanvasClick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (inspectorTab === 'crown' && viewerRef.current) {
      const hit = viewerRef.current.pick(event.clientX, event.clientY);
      if (hit && crownRef.current?.handleCanvasClick(hit)) return;
    }
    if (inspectorTab === 'prepare' && viewerRef.current) {
      const hit = viewerRef.current.pick(event.clientX, event.clientY);
      if (hit && preparationRef.current?.handleCanvasClick(hit)) return;
    }
    if (inspectorTab === 'edit' && viewerRef.current) {
      const hit = viewerRef.current.pick(event.clientX, event.clientY);
      if (!hit) { setStatus('No mesh surface was found under the pointer.'); return; }
      if (editingRef.current?.handleCanvasClick(hit, event.ctrlKey || event.metaKey || event.shiftKey)) return;
    }
    if (manualPlacement && viewerRef.current) {
      const hit = viewerRef.current.pick(event.clientX, event.clientY); if (!hit) { setStatus('No mesh surface was found under the pointer.'); return; }
      const expectedObject = manualPlacement.next === 'source' ? registrationSource?.sceneObjectId : registrationTarget?.sceneObjectId;
      if (!expectedObject || hit.objectId !== expectedObject) { setStatus(`Select a point on the ${manualPlacement.next} scan.`); return; }
      setManualPlacement((current) => current ? current.next === 'source' ? { ...current, source: [...current.source, hit.position], next: 'target' } : { ...current, target: [...current.target, hit.position], next: 'source' } : null);
      setStatus(`Manual correspondence placed on ${manualPlacement.next}; choose the ${manualPlacement.next === 'source' ? 'target' : 'source'} point.`); return;
    }
    if (!placement || !viewerRef.current) return;
    const hit = viewerRef.current.pick(event.clientX, event.clientY);
    if (!hit) { setStatus('No mesh surface was found under the pointer.'); return; }
    const next = [...pendingAnchors, anchorFromHit(hit)]; const required = requiredAnchorCount(placement.kind);
    if (required !== 'multiple' && next.length >= required) void completeMeasurement(placement.kind, next, placement.editingId);
    else setPendingAnchors(next);
  };

  const handleCanvasMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (inspectorTab === 'crown' && crownRef.current?.handlePointerMove(event.clientX, event.clientY)) return;
    if (inspectorTab === 'prepare' && preparationRef.current?.handlePointerMove(event.clientX, event.clientY)) return;
    if (inspectorTab === 'edit' && editingRef.current?.handlePointerMove(event.clientX, event.clientY)) return;
    if ((!placement && !manualPlacement) || !viewerRef.current) return;
    setPreviewHit(viewerRef.current.pick(event.clientX, event.clientY));
  };

  const runValidation = async () => {
    if (!validationTarget || !validationArtifact) { setStatus('Select a scene object to validate.'); return; }
    setValidating(true); setStatus(`Validating ${validationTarget.name} in the geometry worker…`);
    try {
      const result = await runtimeMetrics.measureAsync('validation.total', () => validationClient.validate(validationArtifact, validationTarget.id), { triangles: validationArtifact.mesh.indices.length / 3 });
      const generated = runtimeMetrics.measure('validation.overlay-generation', () => buildValidationOverlays(result, validationTarget), { checks: result.checks.length });
      setValidationHistory((current) => ({ ...current, [validationArtifact.id]: { current: result, previous: current[validationArtifact.id]?.current } }));
      setOverlays((current) => [...current.filter((overlay) => !overlay.id.startsWith(`${validationArtifact.id}:`)), ...generated]);
      setSelectedCheckId(null); runtimeMetrics.estimateMemory(artifactManager.list());
      setStatus(`Validation ${result.overall}: ${result.failureCount} failures, ${result.warningCount} warnings`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Validation failed'); }
    finally { setValidating(false); }
  };

  const generateReport = async () => {
    if (!currentValidation || !validationArtifact) { setStatus('Run validation before generating a report.'); return; }
    try {
      const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, caseScanSet, registrationReports, projectHistory.list(), editingManager, preparationManager, restorationManager);
      const { report, historyEntry } = await createValidationReport(snapshot, validationArtifact, currentValidation, availableUserIdentity());
      reportManager.add(report); projectHistory.add(historyEntry); setStatus(`Stored immutable validation report ${report.id}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Report generation failed'); }
  };

  const exportReport = (report: StoredValidationReport, format: 'json' | 'csv' | 'html') => {
    const content = format === 'json' ? reportToJson(report) : format === 'csv' ? reportToCsv(report) : reportToHtml(report);
    downloadText(`${safeName(report.fileName)}-validation-${report.id}.${format}`, content, format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/html');
    setStatus(`Exported ${format.toUpperCase()} validation report`);
  };

  const artifactForScan = (scan: CaseScanRecord) => {
    const artifact = artifactManager.get(scan.artifactId); if (!artifact) throw new Error(`Artifact ${scan.artifactId} was not found.`);
    return { ...artifact, units: scan.confirmedUnits };
  };

  const applyRegistrationState = async (next: CaseScanSet, label: string, type?: string) => {
    await commandBus.execute(new RegistrationStateCommand(caseScanManager, sceneManager, next, label, type));
    setDirty(true);
  };

  const validateRegistrationScan = (scan: CaseScanRecord) => {
    const artifact = artifactForScan(scan); const object = sceneManager.get(scan.sceneObjectId); if (!object) throw new Error('Scan scene object was not found.');
    return validateScanForRegistration(artifact, object, scan, artifactManager.list());
  };

  const setScanRole = async (scan: CaseScanRecord, role: ScanRole) => {
    const next = updateScan(caseScanSet, scan.id, { assignedRole: role, registrationHistory: [...scan.registrationHistory, { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'scan-role-assigned', actor: availableUserIdentity(), transform: scan.registrationTransform, detail: `Assigned ${role}.` }] });
    await run(applyRegistrationState(next, `Assign ${role}`, 'registration.scan.role'), `Assigned ${role}`);
  };

  const confirmScanUnits = async (scan: CaseScanRecord, units: CaseScanRecord['confirmedUnits']) => {
    if (units === 'unknown') { setStatus('Choose mm, cm, or m before confirming units.'); return; }
    const next = updateScan(caseScanSet, scan.id, { confirmedUnits: units, unitsConfirmed: true, registrationHistory: [...scan.registrationHistory, { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'units-confirmed', actor: availableUserIdentity(), transform: scan.registrationTransform, detail: `Confirmed ${units}; original source remains ${scan.originalUnits}.` }] });
    await run(applyRegistrationState(next, `Confirm ${units} units`, 'registration.scan.units'), `Confirmed ${units} units without modifying source geometry`);
  };

  const executePair = async (source: CaseScanRecord, target: CaseScanRecord, purpose: 'pairwise' | 'bite-upper' | 'bite-lower' | 'occlusal-assembly' | 'reference' | 'pre-operative' | 'implant' | 'manual', initial?: RigidTransform) => {
    const sourceValidation = validateRegistrationScan(source); const targetValidation = validateRegistrationScan(target);
    if (!sourceValidation.canRegisterAutomatically) throw new Error(sourceValidation.issues.filter((issue) => issue.status === 'fail' || issue.status === 'confirmation-required').map((issue) => `${source.assignedRole}: ${issue.explanation}`).join(' '));
    if (!targetValidation.canRegisterAutomatically) throw new Error(targetValidation.issues.filter((issue) => issue.status === 'fail' || issue.status === 'confirmation-required').map((issue) => `${target.assignedRole}: ${issue.explanation}`).join(' '));
    const requestId = crypto.randomUUID(); setActiveRegistrationId(requestId); setRegistrationProgress({ requestId, stage: 'geometry-preparation', progress: 0, message: 'Queued' });
    const rawResult = await registrationClient.register({ requestId, source: { artifact: artifactForScan(source), role: source.assignedRole }, target: { artifact: artifactForScan(target), role: target.assignedRole }, options: initial ? { initialTransform: initial } : undefined }, setRegistrationProgress);
    const result = enforceRegistrationSupport(rawResult, registrationSupportDecision(source.assignedRole, target.assignedRole, purpose));
    setActiveRegistrationId(null); setRegistrationProgress(null);
    for (const timing of result.timings) runtimeMetrics.record({ name: `registration.${timing.stage}`, durationMs: timing.durationMs, startedAt: result.startedAt, metadata: { source: source.id, target: target.id } });
    return result;
  };

  const refreshRegistrationOverlays = (result: PairwiseRegistrationResult, source: CaseScanRecord, target: CaseScanRecord, after = showRegistrationAfter) => {
    const generated = runtimeMetrics.measure('registration.heatmap', () => buildRegistrationOverlays(result, artifactForScan(source), artifactForScan(target), { sourceCaseTransform: source.registrationTransform, targetCaseTransform: target.registrationTransform, showAfter: after, heatmapRange, dentalCoordinates: caseScanSet.dentalCoordinates }), { correspondences: result.correspondences.length });
    setOverlays(generated.map((overlay) => ({ ...overlay, color: [overlay.color[0], overlay.color[1], overlay.color[2], overlay.color[3] * overlayOpacity / 100] })));
  };

  const registerSelectedPair = async (localRefine = false) => {
    if (!registrationSource || !registrationTarget || registrationSource.id === registrationTarget.id) { setStatus('Choose two different source and target scans.'); return; }
    setStatus(`Registering ${registrationSource.assignedRole} to ${registrationTarget.assignedRole}…`);
    try {
      const initial = localRefine ? composeRelative(registrationSource.registrationTransform, registrationTarget.registrationTransform) : undefined;
      const result = await executePair(registrationSource, registrationTarget, localRefine ? 'manual' : 'pairwise', initial);
      const next = appendPairwiseResult(caseScanSet, registrationSource, registrationTarget, localRefine ? 'manual' : 'pairwise', result, false);
      await applyRegistrationState(next, localRefine ? 'Local registration refinement' : 'Register selected pair', 'registration.pair.run');
      setRegistrationResult(result); refreshRegistrationOverlays(result, registrationSource, registrationTarget);
      setStatus(`${result.outcome}: RMS ${formatRegistrationNumber(result.metrics.rmsResidual)} mm · overlap ${formatRegistrationNumber(result.metrics.estimatedOverlapPercent)}%`);
    } catch (error) { setActiveRegistrationId(null); setRegistrationProgress(null); setStatus(error instanceof Error ? error.message : 'Registration failed'); }
  };

  const autoAssemble = async () => {
    if (!caseScanSet.scans.length) { setStatus('Import and classify scans before assembly.'); return; }
    setAssembling(true); setStatus('Auto Assemble Case validating scan roles and units…');
    try {
      const result = await runtimeMetrics.measureAsync('registration.assembly', () => autoAssembleCase(caseScanSet, artifactManager.list(), (source, target, purpose) => executePair(source, target, purpose, composeRelative(source.registrationTransform, target.registrationTransform)), (progress) => setStatus(`AUTO ASSEMBLE CASE ${progress.completed}/${progress.total}: ${progress.message}`)), { scans: caseScanSet.scans.length });
      await applyRegistrationState(result.scanSet, 'Auto Assemble Case', 'registration.case.auto-assemble');
      const last = result.results.at(-1) ?? null; setRegistrationResult(last);
      if (last) { const source = result.scanSet.scans.find((scan) => scan.artifactId === last.sourceArtifactId); const target = result.scanSet.scans.find((scan) => scan.artifactId === last.targetArtifactId); if (source && target) refreshRegistrationOverlays(last, source, target); }
      else if (result.scanSet.dentalCoordinates) setOverlays(coordinateOverlays(result.scanSet.dentalCoordinates));
      setStatus(`Assembly ${result.scanSet.assemblyStatus}: ${result.errors.length} errors · ${result.warnings.length} warnings`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Case assembly failed'); }
    finally { setAssembling(false); setActiveRegistrationId(null); setRegistrationProgress(null); }
  };

  const acceptRegistration = async () => {
    if (!registrationResult || !registrationSource || !registrationTarget || !registrationResult.transform) { setStatus('No successful registration candidate is available to accept.'); return; }
    if (registrationResult.outcome === 'failed' || registrationResult.outcome === 'cancelled') { setStatus('Failed or cancelled registration cannot be accepted.'); return; }
    const next = appendPairwiseResult(caseScanSet, registrationSource, registrationTarget, 'pairwise', registrationResult, true);
    await run(applyRegistrationState(next, 'Accept registration', 'registration.accept'), 'Registration accepted and added to the transform graph');
  };

  const rejectRegistration = async () => {
    if (!registrationResult || !registrationSource || !registrationTarget) return;
    const relationshipId = `${registrationSource.id}:${registrationTarget.id}:pairwise`; const next = structuredClone(caseScanSet);
    next.relationships = next.relationships.map((relationship) => relationship.id === relationshipId ? { ...relationship, status: 'failed', acceptedResultId: null, updatedAt: new Date().toISOString() } : relationship);
    next.scans = next.scans.map((scan) => scan.id === registrationSource.id ? { ...scan, registrationStatus: 'review', registrationHistory: [...scan.registrationHistory, { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'registration-rejected', actor: availableUserIdentity(), transform: scan.registrationTransform, resultId: registrationResult.id, detail: 'User rejected the candidate without deleting prior history.' }] } : scan);
    await run(applyRegistrationState(next, 'Reject registration', 'registration.reject'), 'Registration rejected; prior transforms preserved');
  };

  const restorePreviousRegistration = async () => {
    if (!registrationSource || !registrationTarget) return;
    const relationship = [...caseScanSet.relationships].reverse().find((item) => item.sourceScanId === registrationSource.id && item.targetScanId === registrationTarget.id);
    const previous = [...(relationship?.results ?? [])].reverse().find((result) => result.id !== registrationResult?.id && result.transform && (result.outcome === 'accepted' || result.outcome === 'accepted-with-warning'));
    if (!previous) { setStatus('No previous accepted registration exists for this pair.'); return; }
    setRegistrationResult(previous); const next = appendPairwiseResult(caseScanSet, registrationSource, registrationTarget, relationship?.purpose ?? 'pairwise', previous, true);
    await run(applyRegistrationState(next, 'Restore previous registration', 'registration.restore'), 'Previous registration restored'); refreshRegistrationOverlays(previous, registrationSource, registrationTarget);
  };

  const setRegistrationLock = async (locked: boolean) => {
    if (!registrationSource) return; const next = updateScan(caseScanSet, registrationSource.id, { locked, registrationHistory: [...registrationSource.registrationHistory, { id: crypto.randomUUID(), at: new Date().toISOString(), action: locked ? 'registration-locked' : 'registration-unlocked', actor: availableUserIdentity(), transform: registrationSource.registrationTransform }] });
    await run(applyRegistrationState(next, locked ? 'Lock registration' : 'Unlock registration', 'registration.lock'), locked ? 'Registration locked' : 'Registration unlocked');
  };

  const resetRegistrationTransform = async () => {
    if (!registrationSource) return; const next = updateScan(caseScanSet, registrationSource.id, { registrationTransform: identityRigid(), registrationStatus: 'unregistered', confidence: null, registrationHistory: [...registrationSource.registrationHistory, { id: crypto.randomUUID(), at: new Date().toISOString(), action: 'registration-reset', actor: availableUserIdentity(), transform: identityRigid(), detail: 'Reset to imported coordinates; source artifact unchanged.' }] });
    await run(applyRegistrationState(next, 'Reset registration transform', 'registration.reset'), 'Reset to imported coordinates');
  };

  const applyManualTransform = async (after: RigidTransform, method: Parameters<typeof userAdjustment>[1], detail: string) => {
    if (!registrationSource) return; const adjustment = userAdjustment(registrationSource, method, after, detail, availableUserIdentity());
    const next = updateScan(caseScanSet, registrationSource.id, { registrationTransform: after, registrationStatus: 'review', confidence: null, userAdjustments: [...registrationSource.userAdjustments, adjustment], registrationHistory: [...registrationSource.registrationHistory, { id: crypto.randomUUID(), at: adjustment.at, action: `manual-${method}`, actor: adjustment.actor, transform: after, detail }] });
    await run(applyRegistrationState(next, detail, 'registration.manual'), `${detail}; confidence must be recalculated`);
  };

  const applyManualLandmarks = async () => {
    if (!manualPlacement || !registrationSource) return;
    if (manualPlacement.source.length < 3 || manualPlacement.source.length !== manualPlacement.target.length) { setStatus('Place at least three corresponding source and target points.'); return; }
    try {
      const delta = alignLandmarkPairs(manualPlacement.source, manualPlacement.target); const after = composeTransforms(delta, registrationSource.registrationTransform);
      await applyManualTransform(after, manualPlacement.method, `${manualPlacement.method === 'three-point' ? 'Three-point' : 'Surface-point'} manual alignment`); setManualPlacement(null);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Manual alignment failed'); }
  };

  const applyNumericTransform = async () => {
    if (!registrationSource) return;
    try { await applyManualTransform(applyNumericAdjustment(registrationSource.registrationTransform, numericTranslation, numericRotation), 'numeric-transform', 'Applied numeric translation and rotation'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Numeric transform failed'); }
  };

  const recalculateCoordinates = async () => {
    try { const coordinates = estimateDentalCoordinates(caseScanSet, artifactManager.list()); const next = { ...structuredClone(caseScanSet), dentalCoordinates: coordinates, updatedAt: new Date().toISOString() }; await applyRegistrationState(next, 'Recalculate dental coordinates', 'registration.coordinates.recalculate'); setOverlays(coordinateOverlays(coordinates)); setStatus(`Dental XYZ estimated at ${(coordinates.confidence * 100).toFixed(1)}% confidence`); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Dental coordinate estimation failed'); }
  };

  const reverseCoordinates = async () => {
    if (!caseScanSet.dentalCoordinates) return; try { const coordinates = reverseAnteriorDirection(caseScanSet.dentalCoordinates, availableUserIdentity()); const next = { ...structuredClone(caseScanSet), dentalCoordinates: coordinates, updatedAt: new Date().toISOString() }; await applyRegistrationState(next, 'Reverse anterior direction', 'registration.coordinates.reverse'); setOverlays(coordinateOverlays(coordinates)); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Coordinate correction failed'); }
  };

  const correctCoordinates = async () => {
    if (!caseScanSet.dentalCoordinates) { setStatus('Estimate dental coordinates before manual correction.'); return; }
    try { const coordinates = manuallyCorrectDentalAxes(caseScanSet.dentalCoordinates, planeDraft, midlineDraft, availableUserIdentity()); const next = { ...structuredClone(caseScanSet), dentalCoordinates: coordinates, updatedAt: new Date().toISOString() }; await applyRegistrationState(next, 'Correct dental plane and midline', 'registration.coordinates.manual'); setOverlays(coordinateOverlays(coordinates)); setStatus('Dental plane and midline corrected'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Coordinate correction failed'); }
  };

  const nudgeRegistration = async (axis: 'x' | 'y' | 'z', amount: number, rotation = false) => {
    if (!registrationSource) return; try { await applyManualTransform(nudgeTransform(registrationSource.registrationTransform, axis, amount, rotation), 'nudge', `${rotation ? 'Rotate' : 'Translate'} ${axis.toUpperCase()} ${amount}${rotation ? '°' : ' mm'}`); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Nudge failed'); }
  };

  const showCandidate = (index: number) => {
    if (!registrationResult || !registrationSource || !registrationTarget) return; const candidate = registrationResult.candidates[index]; if (!candidate) return;
    const viewed = { ...structuredClone(registrationResult), transform: candidate.transform, metrics: { ...registrationResult.metrics, rmsResidual: candidate.rmsResidual } }; setRegistrationResult(viewed); refreshRegistrationOverlays(viewed, registrationSource, registrationTarget, true); setStatus(`Viewing candidate ${candidate.rank}: RMS ${candidate.rmsResidual.toFixed(4)} mm`);
  };

  const toggleRegistrationOverlay = (id: string, visible: boolean) => setOverlays((current) => current.map((overlay) => overlay.id === id ? { ...overlay, visible } : overlay));

  const lockCoordinates = async () => {
    if (!caseScanSet.dentalCoordinates) return; const coordinates = { ...structuredClone(caseScanSet.dentalCoordinates), locked: !caseScanSet.dentalCoordinates.locked }; const next = { ...structuredClone(caseScanSet), dentalCoordinates: coordinates, updatedAt: new Date().toISOString() }; await run(applyRegistrationState(next, coordinates.locked ? 'Lock dental coordinates' : 'Unlock dental coordinates', 'registration.coordinates.lock'), coordinates.locked ? 'Dental coordinates locked' : 'Dental coordinates unlocked');
  };

  const resetCoordinates = async () => { const next = { ...structuredClone(caseScanSet), dentalCoordinates: null, updatedAt: new Date().toISOString() }; await run(applyRegistrationState(next, 'Reset dental coordinates', 'registration.coordinates.reset'), 'Returned to imported coordinate frame'); setOverlays([]); };

  const generateRegistrationReport = async () => {
    try { const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, caseScanSet, registrationReports, projectHistory.list(), editingManager, preparationManager, restorationManager); const { report, historyEntry } = await createRegistrationReport(snapshot, caseScanSet, artifactManager.list(), availableUserIdentity()); registrationReportManager.add(report); projectHistory.add(historyEntry); setStatus(`Stored immutable registration report ${report.id}`); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Registration report generation failed'); }
  };

  const exportRegistrationReport = (report: StoredRegistrationReport, format: 'json' | 'csv' | 'html') => {
    const content = format === 'json' ? registrationReportToJson(report) : format === 'csv' ? registrationReportToCsv(report) : registrationReportToHtml(report);
    downloadText(`registration-${report.id}.${format}`, content, format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/html'); setStatus(`Exported ${format.toUpperCase()} registration report`);
  };

  const measurementLabels = measurements.filter((measurement) => measurement.visible && measurement.anchors.length).map((measurement) => {
    const center = average(measurement.anchors.map((anchor) => anchor.position)); const projected = viewerRef.current?.projectWorld(center);
    return { measurement, projected };
  });
  const registrationLabels = overlays.filter((overlay) => overlay.visible && overlay.label && overlay.labelPosition && ['dental-x', 'dental-y', 'dental-z', 'dental-midline'].includes(overlay.checkId)).map((overlay) => ({ overlay, projected: viewerRef.current?.projectWorld(overlay.labelPosition!) }));
  const latestMemoryBytes = runtimeMetrics.latest('memory.estimate')?.metadata?.bytes;
  const sourceRegistrationValidation = registrationSource ? safeScanValidation(() => validateRegistrationScan(registrationSource)) : null;
  const targetRegistrationValidation = registrationTarget ? safeScanValidation(() => validateRegistrationScan(registrationTarget)) : null;
  const selectedRelationship = registrationSource && registrationTarget ? [...caseScanSet.relationships].reverse().find((relationship) => relationship.sourceScanId === registrationSource.id && relationship.targetScanId === registrationTarget.id) : undefined;

  return <div className="studio-shell">
    <header className="topbar">
      <div className="product"><span className="product-mark">DS</span><div><strong>CADence Design Studio</strong><span>Registration · Editing · Preparation · Single Crown</span></div></div>
      <div className="project-title"><input aria-label="Project name" value={project.name} onChange={(event) => { setProject({ ...project, name: event.target.value }); setDirty(true); }}/><span>{dirty ? 'Unsaved changes' : 'Saved'} · Schema v{project.schemaVersion}</span></div>
      <div className="top-actions">
        <button onClick={newProject}>New</button><button onClick={() => setRecentOpen(!recentOpen)}>Open</button><button onClick={closeProject}>Close</button>
        <button onClick={() => void run(commandBus.undo(), 'Undid last command')} disabled={!commandBus.canUndo()}>Undo</button>
        <button onClick={() => void run(commandBus.redo(), 'Redid command')} disabled={!commandBus.canRedo()}>Redo</button>
        <button onClick={saveProject} className="primary">Save</button><button onClick={saveAs}>Save As</button>
      </div>
    </header>

    {recentOpen && <section className="recent-panel" aria-label="Recent projects"><h2>Recent projects</h2>{projectStore.listRecent().map((item) => <button key={item.id} onClick={() => openProject(item.id)}><strong>{item.name}</strong><span>{new Date(item.updatedAt).toLocaleString()}</span></button>)}{!projectStore.listRecent().length && <p>No saved projects yet.</p>}</section>}

    <div className="workspace">
      <aside className="scene-panel" aria-label="Production scene tree">
        <div className="panel-heading"><div><p className="eyebrow">PROJECT</p><h2>Scene Tree</h2></div><button className="icon-button" onClick={() => importRef.current?.click()} aria-label="Import models">＋</button></div>
        <input ref={importRef} className="visually-hidden" type="file" accept=".stl,.obj,.ply" multiple onChange={importFiles}/>
        <button className="import-zone" onClick={() => importRef.current?.click()}><strong>Import models</strong><span>STL · OBJ · ASCII PLY</span></button>
        <div className="scene-actions"><button onClick={() => fit(selectedObjects.map((object) => object.id))} disabled={!selectedObjects.length}>Fit selected</button><button onClick={() => fit()}>Fit all</button><button onClick={() => void run(commandBus.execute(new RestoreVisibilityCommand(sceneManager)), 'Restored visibility')}>Restore all</button></div>
        <div className="scene-list">
          {scene.map((object) => {
            const artifact = artifactMap.get(object.artifactId); const caseScan = caseScanSet.scans.find((scan) => scan.sceneObjectId === object.id); const role = DENTAL_ROLES.find((item) => item.value === object.type)?.label ?? object.type;
            return <article className={`scene-row ${object.selected ? 'selected' : ''} ${object.locked ? 'locked' : ''}`} key={object.id} onClick={(event) => void run(commandBus.execute(new SelectionCommand(selectionEngine, { kind: 'object', objectId: object.id }, event.ctrlKey || event.metaKey || event.shiftKey)))}>
              <div className="scene-row-main">
                <button aria-label={`${object.visible ? 'Hide' : 'Show'} ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(new ToggleVisibilityCommand(sceneManager, object.id))); }}>{object.visible ? '◉' : '○'}</button>
                <div><strong>{object.name}</strong><span>{role} · {artifact?.sourceFormat.toUpperCase() ?? '—'} · {Math.round((1 - object.material.opacity) * 100)}% transparent</span><code title={object.id}>{object.id}</code></div>
                <button aria-label={`${object.locked ? 'Unlock' : 'Lock'} ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(new SceneObjectUpdateCommand(sceneManager, object.id, { locked: !object.locked }, object.locked ? 'Unlock object' : 'Lock object'))); }}>{object.locked ? '🔒' : '🔓'}</button>
                <button aria-label={`Isolate ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(object.isolated ? new RestoreVisibilityCommand(sceneManager) : new IsolateCommand(sceneManager, object.id))); }}>{object.isolated ? '◈' : '◎'}</button>
              </div>
              <div className="scene-row-stats"><span>{object.visible ? 'Visible' : 'Hidden'}</span><span>{object.locked ? 'Locked' : 'Unlocked'}</span><span>{object.isolated ? 'Isolated' : 'Not isolated'}</span><span>{caseScan?.registrationStatus ?? 'unregistered'}</span><span>{caseScan?.unitsConfirmed ? caseScan.confirmedUnits : 'units unconfirmed'}</span><span>{((artifact?.mesh.indices.length ?? 0) / 3).toLocaleString()} tri</span><span>{((artifact?.mesh.sourceTopology?.positions.length ?? artifact?.mesh.positions.length ?? 0) / 3).toLocaleString()} vert</span></div>
            </article>;
          })}
          {!scene.length && <div className="empty-state"><strong>No models loaded</strong><span>Import a supported dental mesh to inspect and validate it.</span></div>}
        </div>
        <div className="scene-summary"><span>{scene.length} objects</span><span>{visibleCount} visible</span><span>{triangleCount.toLocaleString()} triangles</span></div>
      </aside>

      <main className={`viewer-panel ${placement || manualPlacement ? 'placing-measurement' : ''}`}>
        <div className="viewer-toolbar">
          <label className="compact-select">Dental view<select aria-label="Dental camera preset" defaultValue="" onChange={(event) => { if (event.target.value) applyPreset(event.target.value as DentalCameraPreset); event.target.value = ''; }}><option value="" disabled>Choose preset</option>{CAMERA_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
          <button onClick={() => fit(selectedObjects.map((object) => object.id))} disabled={!selectedObjects.length}>Fit selected</button><button onClick={() => fit()}>Fit all</button>
          <button onClick={() => viewerRef.current && void run(commandBus.execute(new CameraResetCommand(viewerRef.current)), 'Camera reset')}>Reset</button>
          <span className="divider"/>
          <button className={project.camera.projection === 'perspective' ? 'active' : ''} onClick={() => viewerRef.current && void run(commandBus.execute(new ProjectionChangeCommand(viewerRef.current, 'perspective')))}>Perspective</button>
          <button className={project.camera.projection === 'orthographic' ? 'active' : ''} onClick={() => viewerRef.current && void run(commandBus.execute(new ProjectionChangeCommand(viewerRef.current, 'orthographic')))}>Orthographic</button>
          <button onClick={saveCurrentView}>Save view</button>
          <span className="viewer-help">Drag orbit · Shift-drag pan · Wheel zoom</span>
        </div>
        <canvas ref={canvasRef} aria-label="Design Studio 3D viewer" onClick={handleCanvasClick} onPointerDownCapture={(event) => { if (inspectorTab === 'edit' && editingRef.current?.handlePointerDown(event.clientX, event.clientY)) { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerMoveCapture={(event) => { if (inspectorTab === 'edit' && editingRef.current?.handlePointerMove(event.clientX, event.clientY)) { event.preventDefault(); event.stopPropagation(); } }} onPointerMove={handleCanvasMove} onPointerUpCapture={(event) => { if (inspectorTab === 'edit' && editingRef.current?.handlePointerUp(event.clientX, event.clientY)) { event.preventDefault(); event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } }} onPointerLeave={() => setPreviewHit(null)}/>
        {!scene.length && <div className="viewer-empty"><span className="viewer-logo">DS</span><h1>Production Viewer</h1><p>Inspection, measurement, and deterministic mesh validation workspace.</p><button className="primary" onClick={() => importRef.current?.click()}>Import Models</button></div>}
        {measurementLabels.map(({ measurement, projected }) => projected?.visible && <button key={measurement.id} className="measurement-label" style={{ left: projected.x, top: projected.y }} onClick={() => { setSelectedMeasurementId(measurement.id); setInspectorTab('measure'); }}>{formatMeasurement(measurement)}</button>)}
        {registrationLabels.map(({ overlay, projected }) => projected?.visible && <span key={overlay.id} className="registration-label" style={{ left: projected.x, top: projected.y }}>{overlay.label}</span>)}
        {placement && <div className="placement-banner"><strong>{MEASUREMENT_LABELS[placement.kind]}</strong><span>{pendingAnchors.length} anchor{pendingAnchors.length === 1 ? '' : 's'} placed</span>{placement.kind === 'multi-segment-distance' && <button onClick={() => void completeMeasurement(placement.kind, pendingAnchors, placement.editingId)} disabled={pendingAnchors.length < 2}>Finish</button>}<button onClick={() => { setPlacement(null); setPendingAnchors([]); setPreviewHit(null); setStatus('Measurement placement cancelled'); }}>Cancel</button></div>}
        {manualPlacement && <div className="placement-banner"><strong>{manualPlacement.method === 'three-point' ? 'Three-point alignment' : 'Surface-point alignment'}</strong><span>{manualPlacement.source.length} complete pairs · next: {manualPlacement.next}</span><button onClick={() => void applyManualLandmarks()} disabled={manualPlacement.source.length < 3 || manualPlacement.source.length !== manualPlacement.target.length}>Apply</button><button onClick={() => setManualPlacement(null)}>Cancel</button></div>}
        <div className="statusbar" role="status"><span>{status}</span><span>{project.camera.projection}</span><span>{triangleCount.toLocaleString()} triangles</span></div>
      </main>

      <aside className="properties-panel">
        <div className="inspector-tabs" role="tablist"><button className={inspectorTab === 'scene' ? 'active' : ''} onClick={() => setInspectorTab('scene')}>Scene</button><button className={inspectorTab === 'register' ? 'active' : ''} onClick={() => setInspectorTab('register')}>Register</button><button className={inspectorTab === 'edit' ? 'active' : ''} onClick={() => setInspectorTab('edit')}>Edit</button><button className={inspectorTab === 'prepare' ? 'active' : ''} onClick={() => setInspectorTab('prepare')}>Prepare</button><button className={inspectorTab === 'crown' ? 'active' : ''} onClick={() => setInspectorTab('crown')}>Crown</button><button className={inspectorTab === 'measure' ? 'active' : ''} onClick={() => setInspectorTab('measure')}>Measure</button><button className={inspectorTab === 'validate' ? 'active' : ''} onClick={() => setInspectorTab('validate')}>Validate</button></div>

        {inspectorTab === 'edit' && <EditingWorkspace ref={editingRef} scene={scene} artifacts={artifacts} sceneManager={sceneManager} artifactManager={artifactManager} selectionEngine={selectionEngine} editingManager={editingManager} commandBus={commandBus} renderer={viewerRef.current} onStatus={setStatus} onOverlays={setEditingOverlays}/>}

        {inspectorTab === 'prepare' && <PreparationWorkspace ref={preparationRef} scene={scene} artifacts={artifacts} sceneManager={sceneManager} artifactManager={artifactManager} editingManager={editingManager} preparationManager={preparationManager} commandBus={commandBus} renderer={viewerRef.current} dentalAxis={caseScanSet.dentalCoordinates?.occlusalGingivalAxis ?? [0, 0, 1]} userIdentity={availableUserIdentity()} onStatus={setStatus} onOverlays={setPreparationOverlays}/>}

        {inspectorTab === 'crown' && <CrownWorkspace ref={crownRef} scene={scene} artifacts={artifacts} sceneManager={sceneManager} artifactManager={artifactManager} preparationManager={preparationManager} restorationManager={restorationManager} commandBus={commandBus} renderer={viewerRef.current} userIdentity={availableUserIdentity()} onStatus={setStatus} onOverlays={setCrownOverlays}/>}

        {inspectorTab === 'scene' && <section aria-label="Scene object inspector">
          <div className="panel-heading"><div><p className="eyebrow">INSPECTOR</p><h2>Object Properties</h2></div></div>
          {selected ? <>
            <div className="selection-count">{selectedObjects.length} object{selectedObjects.length === 1 ? '' : 's'} selected</div>
            <label>Name<div className="input-action"><input value={selected.name} readOnly/><button onClick={renameSelected}>Rename</button></div></label>
            <label>Dental role<select value={selected.type} onChange={(event) => updateSelected({ type: event.target.value as ArtifactKind }, 'Changed dental role')}>{DENTAL_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
            <label>Transparency<div className="range-action"><input aria-label="Transparency percent" type="range" min="0" max="92" step="1" value={100 - opacityDraft} onChange={(event) => setOpacityDraft(100 - Number(event.target.value))}/><span>{100 - opacityDraft}% transparent</span><button onClick={() => updateSelected({ material: { ...selected.material, opacity: opacityDraft / 100 } }, 'Changed transparency')}>Apply</button></div></label>
            <button onClick={() => { setOpacityDraft(100); updateSelected({ material: { ...selected.material, opacity: 1 } }, 'Reset transparency'); }}>Reset transparency</button>
            <div className="property-card"><span>Object ID</span><code>{selected.id}</code><span>Artifact ID</span><code>{selected.artifactId}</code><span>Format</span><code>{artifactMap.get(selected.artifactId)?.sourceFormat.toUpperCase()}</code><span>Triangles</span><code>{((artifactMap.get(selected.artifactId)?.mesh.indices.length ?? 0) / 3).toLocaleString()}</code><span>Vertices</span><code>{((artifactMap.get(selected.artifactId)?.mesh.sourceTopology?.positions.length ?? artifactMap.get(selected.artifactId)?.mesh.positions.length ?? 0) / 3).toLocaleString()}</code></div>
            <button onClick={() => void run(commandBus.execute(new SceneObjectUpdateCommand(sceneManager, selected.id, { locked: !selected.locked }, selected.locked ? 'Unlock object' : 'Lock object')))}>{selected.locked ? 'Unlock object' : 'Lock object'}</button>
            <button onClick={() => void run(commandBus.execute(selected.isolated ? new RestoreVisibilityCommand(sceneManager) : new IsolateCommand(sceneManager, selected.id)))}>{selected.isolated ? 'Restore all visibility' : 'Isolate selected'}</button>
            <button onClick={() => fit(selectedObjects.map((object) => object.id))}>Fit selected</button>
            <button aria-label={selectedObjects.length === 1 ? 'Remove artifact' : 'Delete selected artifacts'} onClick={() => void deleteSelected()} className="danger">Delete selected</button>
          </> : <div className="empty-state"><strong>No selection</strong><span>Select one or more scene objects to inspect them.</span></div>}
          <div className="section-heading"><h3>Saved user views</h3><button onClick={saveCurrentView}>＋ Save</button></div>
          <div className="compact-list">{savedViews.map((view) => <article key={view.id}><button onClick={() => viewerRef.current && void run(commandBus.execute(new CameraViewCommand(viewerRef.current, view.camera, `Restore ${view.name}`)), `Restored ${view.name}`)}><strong>{view.name}</strong><span>{view.camera.projection}</span></button><button aria-label={`Rename view ${view.name}`} onClick={() => renameView(view)}>✎</button><button aria-label={`Delete view ${view.name}`} onClick={() => void run(commandBus.execute(new DeleteCollectionRecordCommand(savedViewManager, view.id, 'camera.saved-view.delete', `Delete view ${view.name}`)), `Deleted ${view.name}`)}>×</button></article>)}{!savedViews.length && <p>No saved views.</p>}</div>
        </section>}

        {inspectorTab === 'register' && <section aria-label="Scan registration workspace" className="registration-workspace">
          <div className="panel-heading"><div><p className="eyebrow">GEOMETRIC ASSEMBLY</p><h2>Scan Registration</h2></div></div>
          <button className="primary auto-assemble" onClick={() => void autoAssemble()} disabled={assembling || Boolean(activeRegistrationId)}>{assembling ? 'ASSEMBLING CASE…' : 'AUTO ASSEMBLE CASE'}</button>
          <div className={`assembly-summary ${caseScanSet.assemblyStatus}`}><strong>{caseScanSet.assemblyStatus.toUpperCase()}</strong><span>{caseScanSet.scans.length} scans · {caseScanSet.relationships.length} relationships</span><span>Confidence: {caseScanSet.assemblyConfidence === null ? 'not calculated' : `${(caseScanSet.assemblyConfidence * 100).toFixed(1)}%`}</span></div>

          <div className="registration-pair-grid">
            <label>Source scan<select aria-label="Registration source" value={registrationSourceId} onChange={(event) => setRegistrationSourceId(event.target.value)}><option value="">Choose source</option>{caseScanSet.scans.map((scan) => <option key={scan.id} value={scan.id}>{sceneManager.get(scan.sceneObjectId)?.name ?? scan.assignedRole}</option>)}</select></label>
            <button aria-label="Swap source and target" onClick={() => { const source = registrationSourceId; setRegistrationSourceId(registrationTargetId); setRegistrationTargetId(source); }}>⇄</button>
            <label>Target scan<select aria-label="Registration target" value={registrationTargetId} onChange={(event) => setRegistrationTargetId(event.target.value)}><option value="">Choose target</option>{caseScanSet.scans.map((scan) => <option key={scan.id} value={scan.id}>{sceneManager.get(scan.sceneObjectId)?.name ?? scan.assignedRole}</option>)}</select></label>
          </div>

          {registrationSource && <div className="scan-ownership-card">
            <h3>Source ownership</h3>
            <label>Assigned scan role<select aria-label="Source scan role" value={registrationSource.assignedRole} onChange={(event) => void setScanRole(registrationSource, event.target.value as ScanRole)}>{SCAN_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
            <label>Confirmed units<select aria-label="Source units" value={registrationSource.confirmedUnits} onChange={(event) => { const next = updateScan(caseScanSet, registrationSource.id, { confirmedUnits: event.target.value as CaseScanRecord['confirmedUnits'], unitsConfirmed: false }); void run(applyRegistrationState(next, 'Select source units', 'registration.scan.units-draft'), 'Units selected; confirmation required'); }}><option value="unknown">Unknown</option><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></select></label>
            <button onClick={() => void confirmScanUnits(registrationSource, registrationSource.confirmedUnits)}>Confirm source units</button>
            <div className="property-card"><span>Artifact ID</span><code>{registrationSource.artifactId}</code><span>File hash</span><code>{registrationSource.fileHash}</code><span>Original units</span><code>{registrationSource.originalUnits}</code><span>Registration status</span><code>{registrationSource.registrationStatus}</code><span>Source immutable</span><code>yes</code></div>
          </div>}
          {registrationTarget && <div className="scan-ownership-card compact">
            <h3>Target validation</h3>
            <label>Assigned scan role<select aria-label="Target scan role" value={registrationTarget.assignedRole} onChange={(event) => void setScanRole(registrationTarget, event.target.value as ScanRole)}>{SCAN_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
            <label>Confirmed units<select aria-label="Target units" value={registrationTarget.confirmedUnits} onChange={(event) => { const next = updateScan(caseScanSet, registrationTarget.id, { confirmedUnits: event.target.value as CaseScanRecord['confirmedUnits'], unitsConfirmed: false }); void run(applyRegistrationState(next, 'Select target units', 'registration.scan.units-draft'), 'Units selected; confirmation required'); }}><option value="unknown">Unknown</option><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option></select></label>
            <button onClick={() => void confirmScanUnits(registrationTarget, registrationTarget.confirmedUnits)}>Confirm target units</button>
          </div>}

          <div className="scan-validation-grid">{[sourceRegistrationValidation, targetRegistrationValidation].map((validation, index) => validation && <article key={index}><strong>{index ? 'Target' : 'Source'} preflight</strong>{validation.issues.map((issue) => <span className={issue.status} key={issue.id}><b>{issue.id}</b> {issue.status}</span>)}</article>)}</div>

          <div className="button-row wrap registration-actions">
            <button className="primary" onClick={() => void registerSelectedPair()} disabled={!registrationSource || !registrationTarget || Boolean(activeRegistrationId)}>Register selected pair</button>
            <button onClick={() => void registerSelectedPair()} disabled={!selectedRelationship || Boolean(activeRegistrationId)}>Re-run registration</button>
            <button onClick={() => activeRegistrationId && registrationClient.cancel(activeRegistrationId)} disabled={!activeRegistrationId}>Cancel registration</button>
            <button onClick={() => void acceptRegistration()} disabled={!registrationResult?.transform}>Accept registration</button>
            <button onClick={() => void rejectRegistration()} disabled={!registrationResult}>Reject registration</button>
            <button onClick={() => void restorePreviousRegistration()}>Restore previous registration</button>
            <button onClick={() => void setRegistrationLock(!registrationSource?.locked)} disabled={!registrationSource}>{registrationSource?.locked ? 'Unlock registration' : 'Lock registration'}</button>
            <button onClick={() => void resetRegistrationTransform()} disabled={!registrationSource}>Reset transform</button>
            <button onClick={() => viewerRef.current?.fitObjects([registrationSource?.sceneObjectId, registrationTarget?.sceneObjectId].filter((id): id is string => Boolean(id)))}>Fit registered pair</button>
            <button onClick={() => { const source = registrationSourceObject, target = registrationTargetObject; if (source) void run(commandBus.execute(new ToggleVisibilityCommand(sceneManager, source.id))); if (target) void run(commandBus.execute(new ToggleVisibilityCommand(sceneManager, target.id))); }}>Toggle source and target</button>
            <button onClick={() => { setShowRegistrationAfter(false); if (registrationResult && registrationSource && registrationTarget) refreshRegistrationOverlays(registrationResult, registrationSource, registrationTarget, false); }}>Before</button>
            <button onClick={() => { setShowRegistrationAfter(true); if (registrationResult && registrationSource && registrationTarget) refreshRegistrationOverlays(registrationResult, registrationSource, registrationTarget, true); }}>After</button>
          </div>
          {registrationProgress && <div className="registration-progress"><progress max="1" value={registrationProgress.progress}/><span>{registrationProgress.stage}: {registrationProgress.message}</span></div>}

          {registrationResult && <>
            <div className={`registration-result ${registrationResult.outcome}`}><strong>{registrationResult.outcome}</strong><span>Engine {registrationResult.engineVersion}</span><code>{registrationResult.deterministicFingerprint}</code></div>
            <div className="confidence-grid" aria-label="Registration confidence measurements">
              <span>RMS residual<code>{formatRegistrationNumber(registrationResult.metrics.rmsResidual)} mm</code></span><span>Median<code>{formatRegistrationNumber(registrationResult.metrics.medianResidual)} mm</code></span><span>95th percentile<code>{formatRegistrationNumber(registrationResult.metrics.percentile95Residual)} mm</code></span><span>Maximum accepted<code>{formatRegistrationNumber(registrationResult.metrics.maximumAcceptedResidual)} mm</code></span>
              <span>Inliers<code>{registrationResult.metrics.inlierCount}</code></span><span>Outliers<code>{registrationResult.metrics.outlierCount}</code></span><span>Inlier ratio<code>{(registrationResult.metrics.inlierRatio * 100).toFixed(1)}%</code></span><span>Overlap<code>{registrationResult.metrics.estimatedOverlapPercent.toFixed(1)}%</code></span>
              <span>Convergence<code>{registrationResult.metrics.convergenceState}</code></span><span>Iterations<code>{registrationResult.metrics.iterationCount}</code></span><span>Translation<code>{formatRegistrationNumber(registrationResult.metrics.translationMagnitude)} mm</code></span><span>Rotation<code>{formatRegistrationNumber(registrationResult.metrics.rotationMagnitudeDegrees)}°</code></span>
              <span>Bidirectional consistency<code>{registrationResult.metrics.bidirectionalConsistency.toFixed(3)}</code></span><span>Normal agreement<code>{registrationResult.metrics.surfaceNormalAgreement === null ? 'not available' : registrationResult.metrics.surfaceNormalAgreement.toFixed(3)}</code></span><span>Candidate ambiguity<code>{registrationResult.metrics.candidateAmbiguity.toFixed(3)}</code></span><span>Bite agreement<code>{registrationResult.metrics.biteScanAgreement === null ? 'not applicable' : registrationResult.metrics.biteScanAgreement.toFixed(3)}</code></span><span>Interpenetration indicators<code>{registrationResult.metrics.interpenetrationIndicators}</code></span><span>Final confidence<code>{(registrationResult.metrics.confidenceScore * 100).toFixed(1)}%</code></span>
            </div>
            <details><summary>Transform matrix</summary><code className="matrix-code">{registrationResult.transform?.matrix.map((value) => value.toFixed(8)).join('  ') ?? 'No accepted transform'}</code></details>
            <div className="candidate-list"><h3>Candidate registrations</h3>{registrationResult.candidates.map((candidate, index) => <button key={candidate.id} onClick={() => showCandidate(index)}>Candidate {candidate.rank} · RMS {candidate.rmsResidual.toFixed(4)} mm {candidate.ambiguous ? '· ambiguous' : ''}</button>)}</div>
            {[...registrationResult.warnings, ...registrationResult.errors].map((message) => <p className="registration-warning" key={message}>{message}</p>)}
          </>}

          <div className="section-heading"><h3>Registration visualization</h3><button onClick={() => setOverlays([])}>Clear visualizations</button></div>
          <label>Overlay transparency <input aria-label="Registration overlay transparency" type="range" min="10" max="100" value={overlayOpacity} onChange={(event) => { const value = Number(event.target.value); setOverlayOpacity(value); setOverlays((current) => current.map((overlay) => ({ ...overlay, color: [overlay.color[0], overlay.color[1], overlay.color[2], value / 100] }))); }}/><span>{overlayOpacity}%</span></label>
          <label>Heatmap range (mm)<input aria-label="Heatmap range" type="number" min="0.01" step="0.1" value={heatmapRange} onChange={(event) => { const value = Math.max(0.01, Number(event.target.value)); setHeatmapRange(value); if (registrationResult && registrationSource && registrationTarget) window.setTimeout(() => refreshRegistrationOverlays(registrationResult, registrationSource, registrationTarget), 0); }}/></label>
          <div className="overlay-list">{overlays.map((overlay) => <article key={overlay.id}><label><input type="checkbox" checked={overlay.visible} onChange={(event) => toggleRegistrationOverlay(overlay.id, event.target.checked)}/>{overlay.label ?? overlay.checkId} ({overlay.elementCount})</label><button onClick={() => viewerRef.current?.focusBounds(overlay.bounds)}>Zoom</button></article>)}</div>

          <div className="section-heading"><h3>Manual registration fallback</h3><span>versioned</span></div>
          <div className="button-row wrap"><button onClick={() => setManualPlacement({ method: 'three-point', source: [], target: [], next: 'source' })}>Three-point landmark alignment</button><button onClick={() => setManualPlacement({ method: 'surface-points', source: [], target: [], next: 'source' })}>Corresponding surface points</button><button onClick={() => void registerSelectedPair(true)}>Local re-refinement</button></div>
          <div className="numeric-transform"><h4>Numeric transform entry</h4>{(['x', 'y', 'z'] as const).map((axis, index) => <label key={`t-${axis}`}>T{axis.toUpperCase()} mm<input aria-label={`Translation ${axis.toUpperCase()}`} type="number" step="0.1" value={numericTranslation[index]} onChange={(event) => setNumericTranslation(numericTranslation.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}{(['x', 'y', 'z'] as const).map((axis, index) => <label key={`r-${axis}`}>R{axis.toUpperCase()} °<input aria-label={`Rotation ${axis.toUpperCase()}`} type="number" step="0.1" value={numericRotation[index]} onChange={(event) => setNumericRotation(numericRotation.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}<button onClick={() => void applyNumericTransform()}>Apply numeric transform</button></div>
          <div className="nudge-grid">{(['x', 'y', 'z'] as const).flatMap((axis) => [<button key={`${axis}-minus`} onClick={() => void nudgeRegistration(axis, -0.1)}>−0.1 mm {axis.toUpperCase()}</button>, <button key={`${axis}-plus`} onClick={() => void nudgeRegistration(axis, 0.1)}>+0.1 mm {axis.toUpperCase()}</button>, <button key={`${axis}-rminus`} onClick={() => void nudgeRegistration(axis, -0.1, true)}>−0.1° {axis.toUpperCase()}</button>, <button key={`${axis}-rplus`} onClick={() => void nudgeRegistration(axis, 0.1, true)}>+0.1° {axis.toUpperCase()}</button>])}</div>

          <div className="section-heading"><h3>Dental XYZ coordinates</h3><span>{caseScanSet.dentalCoordinates?.convention ?? 'not estimated'}</span></div>
          <div className="button-row wrap"><button onClick={() => void recalculateCoordinates()}>Recalculate dental coordinates</button><button onClick={() => void lockCoordinates()} disabled={!caseScanSet.dentalCoordinates}>{caseScanSet.dentalCoordinates?.locked ? 'Unlock coordinate system' : 'Lock coordinate system'}</button><button onClick={() => void reverseCoordinates()} disabled={!caseScanSet.dentalCoordinates}>Reverse anterior direction</button><button onClick={() => void resetCoordinates()}>Reset to imported coordinates</button></div>
          {caseScanSet.dentalCoordinates && <><div className="property-card"><span>Origin</span><code>{caseScanSet.dentalCoordinates.origin.map((value) => value.toFixed(4)).join(', ')}</code><span>+X patient left</span><code>{caseScanSet.dentalCoordinates.leftRightAxis.map((value) => value.toFixed(4)).join(', ')}</code><span>+Y posterior</span><code>{caseScanSet.dentalCoordinates.anteriorPosteriorAxis.map((value) => value.toFixed(4)).join(', ')}</code><span>+Z superior</span><code>{caseScanSet.dentalCoordinates.occlusalGingivalAxis.map((value) => value.toFixed(4)).join(', ')}</code><span>Confidence</span><code>{(caseScanSet.dentalCoordinates.confidence * 100).toFixed(1)}%</code></div><div className="numeric-transform"><h4>Manual plane and midline correction</h4>{(['x', 'y', 'z'] as const).map((axis, index) => <label key={`p-${axis}`}>Plane {axis.toUpperCase()}<input type="number" step="0.01" value={planeDraft[index]} onChange={(event) => setPlaneDraft(planeDraft.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}{(['x', 'y', 'z'] as const).map((axis, index) => <label key={`m-${axis}`}>Midline {axis.toUpperCase()}<input type="number" step="0.01" value={midlineDraft[index]} onChange={(event) => setMidlineDraft(midlineDraft.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}<button onClick={() => void correctCoordinates()}>Apply plane and midline</button></div></>}

          <div className="section-heading"><h3>Transform graph</h3><span>{caseScanSet.transformGraph.length} edges</span></div>
          <div className="transform-graph">{caseScanSet.scans.map((scan) => <article className={`${scan.registrationStatus} ${scan.locked ? 'locked' : ''} ${scan.userAdjustments.length ? 'manual' : ''}`} key={scan.id}><strong>{SCAN_ROLES.find((role) => role.value === scan.assignedRole)?.label}</strong><span>{scan.registrationStatus}{scan.userAdjustments.length ? ' · manually modified' : ''}{scan.locked ? ' · locked' : ''}</span><code>{scan.id}</code></article>)}{caseScanSet.transformGraph.map((edge) => <article className={edge.status} key={edge.id}><strong>{edge.sourceScanId} → {edge.targetScanId}</strong><span>{edge.status}</span></article>)}</div>

          <button className="primary" onClick={() => void generateRegistrationReport()}>Generate immutable registration report</button>
          <div className="report-list">{registrationReports.map((report) => <article key={report.id}><div><strong>Registration report</strong><span>{report.finalResult} · engine {report.engineVersion}</span><code>{report.id}</code></div><div className="button-row"><button onClick={() => exportRegistrationReport(report, 'json')}>JSON</button><button onClick={() => exportRegistrationReport(report, 'csv')}>CSV</button><button onClick={() => exportRegistrationReport(report, 'html')}>Print HTML</button></div></article>)}{!registrationReports.length && <p>No registration reports stored.</p>}</div>
        </section>}

        {inspectorTab === 'measure' && <section aria-label="Measurement workspace">
          <div className="panel-heading"><div><p className="eyebrow">GEOMETRY</p><h2>Measurements</h2></div></div>
          <div className="measurement-tools">{(Object.keys(MEASUREMENT_LABELS) as MeasurementKind[]).map((kind) => <button key={kind} onClick={() => beginMeasurement(kind)}>{MEASUREMENT_LABELS[kind]}</button>)}</div>
          <div className="section-heading"><h3>Measurement list</h3><span>{measurements.length}</span></div>
          <div className="measurement-list">{measurements.map((measurement) => <article className={selectedMeasurementId === measurement.id ? 'selected' : ''} key={measurement.id} onClick={() => setSelectedMeasurementId(measurement.id)}><div><strong>{measurement.name}</strong><span>{formatMeasurement(measurement)} · {measurement.objectIds.length} object association{measurement.objectIds.length === 1 ? '' : 's'}</span></div><button aria-label={`${measurement.visible ? 'Hide' : 'Show'} measurement ${measurement.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(new UpdateCollectionRecordCommand(measurementManager, measurement.id, { visible: !measurement.visible, updatedAt: new Date().toISOString() }, 'measurement.visibility', `${measurement.visible ? 'Hide' : 'Show'} ${measurement.name}`))); }}>{measurement.visible ? '◉' : '○'}</button></article>)}{!measurements.length && <div className="empty-state"><strong>No measurements</strong><span>Choose a tool and place anchors on loaded geometry.</span></div>}</div>
          {selectedMeasurement && <div className="measurement-editor"><h3>Edit measurement</h3><label>Name<div className="input-action"><input value={selectedMeasurement.name} readOnly/><button onClick={() => { const name = window.prompt('Measurement name', selectedMeasurement.name)?.trim(); if (name) void run(commandBus.execute(new UpdateCollectionRecordCommand(measurementManager, selectedMeasurement.id, { name, updatedAt: new Date().toISOString() }, 'measurement.rename', `Rename ${selectedMeasurement.name}`))); }}>Rename</button></div></label><label>Decimal precision<select value={selectedMeasurement.precision} onChange={(event) => void run(commandBus.execute(new UpdateCollectionRecordCommand(measurementManager, selectedMeasurement.id, { precision: Number(event.target.value), updatedAt: new Date().toISOString() }, 'measurement.precision', `Set precision for ${selectedMeasurement.name}`)))}>{[0, 1, 2, 3, 4, 5, 6].map((value) => <option key={value}>{value}</option>)}</select></label><div className="button-row"><button onClick={() => beginMeasurement(selectedMeasurement.kind, selectedMeasurement.id)}>Re-place anchors</button><button className="danger" onClick={() => void run(commandBus.execute(new DeleteCollectionRecordCommand(measurementManager, selectedMeasurement.id, 'measurement.delete', `Delete ${selectedMeasurement.name}`)), `Deleted ${selectedMeasurement.name}`)}>Delete</button></div><div className="property-card"><span>Associated objects</span><code>{selectedMeasurement.objectIds.join(', ') || 'None'}</code><span>Anchors</span><code>{selectedMeasurement.anchors.length}</code><span>Value</span><code>{formatMeasurement(selectedMeasurement)}</code></div></div>}
        </section>}

        {inspectorTab === 'validate' && <section aria-label="Mesh validation workspace">
          <div className="panel-heading"><div><p className="eyebrow">DETERMINISTIC QC</p><h2>Mesh Validation</h2></div></div>
          <label>Artifact<select aria-label="Validation object" value={validationTarget?.id ?? ''} onChange={(event) => setValidationObjectId(event.target.value)}><option value="" disabled>Select object</option>{scene.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</select></label>
          <div className="button-row"><button className="primary" onClick={() => void runValidation()} disabled={!validationTarget || validating}>{validating ? 'Validating…' : currentValidation ? 'Re-run validation' : 'Run validation'}</button><button onClick={() => setOverlays((current) => current.map((overlay) => ({ ...overlay, visible: false })))}>Clear overlays</button></div>
          {currentValidation && <>
            <div className={`validation-summary ${currentValidation.overall}`}><strong>{currentValidation.overall.toUpperCase()}</strong><span>{currentValidation.failureCount} failures · {currentValidation.warningCount} warnings · {currentValidation.durationMs.toFixed(1)} ms</span><code>{currentValidation.resultFingerprint}</code></div>
            {previousValidation && <div className="comparison-card"><strong>Previous vs current</strong><span>Failures {previousValidation.failureCount} → {currentValidation.failureCount}</span><span>Warnings {previousValidation.warningCount} → {currentValidation.warningCount}</span><span>{previousValidation.resultFingerprint === currentValidation.resultFingerprint ? 'Deterministic result unchanged' : 'Result changed'}</span></div>}
            <div className="validation-results">{currentValidation.checks.map((check) => {
              const overlay = overlays.find((item) => item.id === `${currentValidation.artifactId}:${check.id}`);
              return <article className={`${check.status} ${selectedCheckId === check.id ? 'selected' : ''}`} key={check.id} onClick={() => { setSelectedCheckId(check.id); if (overlay) setOverlays((current) => current.map((item) => item.id === overlay.id ? { ...item, visible: true } : item)); }}><div><strong>{check.id}</strong><span>{check.explanation}</span><code>Measured: {renderValue(check.measuredValue)} · Threshold: {renderValue(check.threshold)} · Affected: {check.affectedCount}</code></div><b>{check.status}</b>{overlay && <div className="overlay-actions"><label><input type="checkbox" checked={overlay.visible} onChange={(event) => { event.stopPropagation(); setOverlays((current) => current.map((item) => item.id === overlay.id ? { ...item, visible: event.target.checked } : item)); }}/> overlay ({overlay.elementCount})</label><button onClick={(event) => { event.stopPropagation(); viewerRef.current?.focusBounds(overlay.bounds); }}>Zoom</button></div>}</article>;
            })}</div>
            <button onClick={() => void generateReport()} className="primary">Generate immutable report</button>
          </>}
          <div className="section-heading"><h3>Project reports</h3><span>{reports.length}</span></div>
          <div className="report-list">{reports.map((report) => <article key={report.id}><div><strong>{report.fileName}</strong><span>{report.overall} · engine {report.engineVersion}</span><code>{report.id}</code></div><div className="button-row"><button onClick={() => exportReport(report, 'json')}>JSON</button><button onClick={() => exportReport(report, 'csv')}>CSV</button><button onClick={() => exportReport(report, 'html')}>Print HTML</button></div></article>)}{!reports.length && <p>No validation reports stored.</p>}</div>
        </section>}

        <div className="property-card metrics-card" aria-label="Runtime performance metrics"><span>Commands</span><code>{commandBus.history().length}</code><span>Import</span><code>{formatMetric(metricSummary['import.total']?.averageMs)}</code><span>Validation</span><code>{formatMetric(metricSummary['validation.total']?.averageMs)}</code><span>Overlay</span><code>{formatMetric(metricSummary['validation.overlay-generation']?.averageMs)}</code><span>Frame response</span><code>{formatMetric(metricSummary['renderer.frame']?.averageMs)}</code><span>Save</span><code>{formatMetric(metricSummary['project.save']?.averageMs)}</code><span>Reopen</span><code>{formatMetric(metricSummary['project.reopen']?.averageMs)}</code><span>Mesh memory</span><code>{typeof latestMemoryBytes === 'number' ? formatBytes(latestMemoryBytes) : '—'}</code><span>Registration</span><code>{formatMetric(metricSummary['registration.assembly']?.averageMs ?? metricSummary['registration.fine']?.averageMs)}</code><span>Registration heatmap</span><code>{formatMetric(metricSummary['registration.heatmap']?.averageMs)}</code></div>
        {recoveryAvailable && <div className="recovery-card"><strong>Recovery snapshot available</strong><p>Scene, measurements, registration, preparation, crown versions, QC, views, and artifacts can be restored.</p><button onClick={recoverProject}>Recover</button></div>}
      </aside>
    </div>
  </div>;
}

function snapshotProject(project: DesignProject, scene: SceneObject[], artifacts: ArtifactManager, savedViews: SavedView[], measurements: MeasurementRecord[], reports: StoredValidationReport[], caseScanSet: CaseScanSet, registrationReports: StoredRegistrationReport[], history: DesignProject['history'], editing: EditingStateManager, preparation: PreparationStateManager, restoration: RestorationStateManager): DesignProject {
  return { ...structuredClone(project), schemaVersion: 6, scene: structuredClone(scene), artifacts: artifacts.list(), savedViews: structuredClone(savedViews), measurements: structuredClone(measurements), validationReports: structuredClone(reports), caseScanSet: structuredClone(caseScanSet), registrationReports: structuredClone(registrationReports), history: structuredClone(history), editing: editing.get(), preparation: preparation.get(), restoration: restoration.get(), updatedAt: new Date().toISOString() };
}

function formatMetric(value?: number): string { return value === undefined ? '—' : `${value.toFixed(1)} ms`; }
function formatBytes(value: number): string { return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1024 / 1024).toFixed(1)} MiB`; }
function average(points: Vec3[]): Vec3 { const total = points.reduce<Vec3>((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]); return [total[0] / points.length, total[1] / points.length, total[2] / points.length]; }
function renderValue(value: unknown): string { return value === null ? 'not run' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function safeName(value: string): string { return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'artifact'; }
function availableUserIdentity(): string | null { return document.querySelector<HTMLMetaElement>('meta[name="cadence-user-id"]')?.content?.trim() || null; }
function downloadText(name: string, content: string, type: string): void { const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
function composeRelative(sourceCase: RigidTransform, targetCase: RigidTransform): RigidTransform { return composeRigid(invertRigid(targetCase), sourceCase); }
function composeTransforms(delta: RigidTransform, current: RigidTransform): RigidTransform { return composeRigid(delta, current); }
function formatRegistrationNumber(value: number): string { return Number.isFinite(value) ? value.toFixed(4) : 'not available'; }
function safeScanValidation(operation: () => ReturnType<typeof validateScanForRegistration>): ReturnType<typeof validateScanForRegistration> | null { try { return operation(); } catch { return null; } }
