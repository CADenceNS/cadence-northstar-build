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
import type { MeasurementVisual, SurfaceHit, ViewerOverlay } from './inspection-types';
import { ValidationWorkerClient } from './validation-client';
import type { MeshValidationResult } from './mesh-validation';
import { buildValidationOverlays } from './validation-overlays';
import { createValidationReport, reportToCsv, reportToHtml, reportToJson } from './validation-reports';
import './styles.css';

const projectStore = new ProjectStore();
const importer = new ManagedMeshImporter();

type ValidationHistory = { current: MeshValidationResult; previous?: MeshValidationResult };
type MeasurementPlacement = { kind: MeasurementKind; editingId?: string };

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
  const [projectHistory] = useState(() => new ProjectHistoryManager(project.history));
  const [validationClient] = useState(() => new ValidationWorkerClient());

  const [scene, setScene] = useState<SceneObject[]>(() => sceneManager.list());
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>(() => measurementManager.list());
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => savedViewManager.list());
  const [reports, setReports] = useState<StoredValidationReport[]>(() => reportManager.list());
  const [status, setStatus] = useState('Ready');
  const [dirty, setDirty] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [metricsVersion, setMetricsVersion] = useState(0);
  const [recoveryAvailable, setRecoveryAvailable] = useState(() => Boolean(projectStore.recover()));
  const [inspectorTab, setInspectorTab] = useState<'scene' | 'measure' | 'validate'>('scene');
  const [opacityDraft, setOpacityDraft] = useState(100);
  const [placement, setPlacement] = useState<MeasurementPlacement | null>(null);
  const [pendingAnchors, setPendingAnchors] = useState<MeasurementAnchor[]>([]);
  const [previewHit, setPreviewHit] = useState<SurfaceHit | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [validationHistory, setValidationHistory] = useState<Record<string, ValidationHistory>>({});
  const [validationObjectId, setValidationObjectId] = useState('');
  const [validating, setValidating] = useState(false);
  const [overlays, setOverlays] = useState<ViewerOverlay[]>([]);
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<IRenderer | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => sceneManager.subscribe(() => {
    runtimeMetrics.measure('scene.update', () => setScene(sceneManager.list()), { objects: sceneManager.list().length });
    setDirty(true);
  }), [sceneManager]);
  useEffect(() => measurementManager.subscribe(() => { setMeasurements(measurementManager.list()); setDirty(true); }), [measurementManager]);
  useEffect(() => savedViewManager.subscribe(() => { setSavedViews(savedViewManager.list()); setDirty(true); }), [savedViewManager]);
  useEffect(() => reportManager.subscribe(() => { setReports(reportManager.list()); setDirty(true); }), [reportManager]);
  useEffect(() => projectHistory.subscribe(() => setDirty(true)), [projectHistory]);
  useEffect(() => commandBus.subscribe(() => setHistoryVersion((value) => value + 1)), [commandBus]);
  useEffect(() => runtimeMetrics.subscribe(() => setMetricsVersion((value) => value + 1)), []);
  useEffect(() => () => validationClient.dispose(), [validationClient]);

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
  useEffect(() => { viewerRef.current?.setValidationOverlays(overlays); }, [overlays]);
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
      const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, projectHistory.list());
      projectStore.autoSave(snapshot);
      setRecoveryAvailable(true);
      setStatus(`Auto-saved ${new Date().toLocaleTimeString()}`);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [artifactManager, dirty, measurements, project, projectHistory, reports, savedViews, scene]);

  const selectedObjects = useMemo(() => scene.filter((object) => object.selected), [scene]);
  const selected = selectedObjects[0];
  const artifacts = artifactManager.list();
  const artifactMap = useMemo(() => new Map(artifacts.map((artifact) => [artifact.id, artifact])), [scene, historyVersion]);
  const visibleCount = scene.filter((object) => object.visible).length;
  const triangleCount = artifacts.reduce((total, artifact) => total + artifact.mesh.indices.length / 3, 0);
  const metricSummary = useMemo(() => runtimeMetrics.summary(), [metricsVersion]);
  const selectedMeasurement = selectedMeasurementId ? measurementManager.get(selectedMeasurementId) : undefined;
  const validationTarget = sceneManager.get(validationObjectId) ?? selected;
  const validationArtifact = validationTarget ? artifactManager.get(validationTarget.artifactId) : undefined;
  const currentValidation = validationArtifact ? validationHistory[validationArtifact.id]?.current : undefined;
  const previousValidation = validationArtifact ? validationHistory[validationArtifact.id]?.previous : undefined;

  useEffect(() => { setOpacityDraft(Math.round((selected?.material.opacity ?? 1) * 100)); }, [selected?.id, selected?.material.opacity]);
  useEffect(() => { if (selected && !validationObjectId) setValidationObjectId(selected.id); }, [selected?.id]);

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
    selectionEngine.restore({ activeSet: 'Default', sets: { Default: next.scene.filter((item) => item.selected).map((item) => ({ kind: 'object', objectId: item.id })) } });
    setProject(next); setOverlays([]); setValidationHistory({}); setPlacement(null); setPendingAnchors([]); setPreviewHit(null);
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
    const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, projectHistory.list());
    const saved = runtimeMetrics.measure('project.save', () => projectStore.save(snapshot), { objects: scene.length, measurements: measurements.length, reports: reports.length });
    setProject(saved); setDirty(false); setRecoveryAvailable(false); setStatus(`Saved ${saved.name}`);
  };

  const saveAs = () => {
    const name = window.prompt('Project name', `${project.name} Copy`)?.trim(); if (!name) return;
    const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, projectHistory.list());
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
    if (!placement || !viewerRef.current) return;
    const hit = viewerRef.current.pick(event.clientX, event.clientY);
    if (!hit) { setStatus('No mesh surface was found under the pointer.'); return; }
    const next = [...pendingAnchors, anchorFromHit(hit)]; const required = requiredAnchorCount(placement.kind);
    if (required !== 'multiple' && next.length >= required) void completeMeasurement(placement.kind, next, placement.editingId);
    else setPendingAnchors(next);
  };

  const handleCanvasMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!placement || !viewerRef.current) return;
    setPreviewHit(viewerRef.current.pick(event.clientX, event.clientY));
  };

  const runValidation = async () => {
    if (!validationTarget || !validationArtifact) { setStatus('Select a scene object to validate.'); return; }
    setValidating(true); setStatus(`Validating ${validationTarget.name} in the geometry worker…`);
    try {
      const result = await runtimeMetrics.measureAsync('validation.total', () => validationClient.validate(validationArtifact), { triangles: validationArtifact.mesh.indices.length / 3 });
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
      const snapshot = snapshotProject(project, scene, artifactManager, savedViews, measurements, reports, projectHistory.list());
      const { report, historyEntry } = await createValidationReport(snapshot, validationArtifact, currentValidation, availableUserIdentity());
      reportManager.add(report); projectHistory.add(historyEntry); setStatus(`Stored immutable validation report ${report.id}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Report generation failed'); }
  };

  const exportReport = (report: StoredValidationReport, format: 'json' | 'csv' | 'html') => {
    const content = format === 'json' ? reportToJson(report) : format === 'csv' ? reportToCsv(report) : reportToHtml(report);
    downloadText(`${safeName(report.fileName)}-validation-${report.id}.${format}`, content, format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/html');
    setStatus(`Exported ${format.toUpperCase()} validation report`);
  };

  const measurementLabels = measurements.filter((measurement) => measurement.visible && measurement.anchors.length).map((measurement) => {
    const center = average(measurement.anchors.map((anchor) => anchor.position)); const projected = viewerRef.current?.projectWorld(center);
    return { measurement, projected };
  });
  const latestMemoryBytes = runtimeMetrics.latest('memory.estimate')?.metadata?.bytes;

  return <div className="studio-shell">
    <header className="topbar">
      <div className="product"><span className="product-mark">DS</span><div><strong>CADence Design Studio</strong><span>Inspection &amp; Mesh Validation</span></div></div>
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
            const artifact = artifactMap.get(object.artifactId); const role = DENTAL_ROLES.find((item) => item.value === object.type)?.label ?? object.type;
            return <article className={`scene-row ${object.selected ? 'selected' : ''} ${object.locked ? 'locked' : ''}`} key={object.id} onClick={(event) => void run(commandBus.execute(new SelectionCommand(selectionEngine, { kind: 'object', objectId: object.id }, event.ctrlKey || event.metaKey || event.shiftKey)))}>
              <div className="scene-row-main">
                <button aria-label={`${object.visible ? 'Hide' : 'Show'} ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(new ToggleVisibilityCommand(sceneManager, object.id))); }}>{object.visible ? '◉' : '○'}</button>
                <div><strong>{object.name}</strong><span>{role} · {artifact?.sourceFormat.toUpperCase() ?? '—'} · {Math.round((1 - object.material.opacity) * 100)}% transparent</span><code title={object.id}>{object.id}</code></div>
                <button aria-label={`${object.locked ? 'Unlock' : 'Lock'} ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(new SceneObjectUpdateCommand(sceneManager, object.id, { locked: !object.locked }, object.locked ? 'Unlock object' : 'Lock object'))); }}>{object.locked ? '🔒' : '🔓'}</button>
                <button aria-label={`Isolate ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(object.isolated ? new RestoreVisibilityCommand(sceneManager) : new IsolateCommand(sceneManager, object.id))); }}>{object.isolated ? '◈' : '◎'}</button>
              </div>
              <div className="scene-row-stats"><span>{object.visible ? 'Visible' : 'Hidden'}</span><span>{object.locked ? 'Locked' : 'Unlocked'}</span><span>{object.isolated ? 'Isolated' : 'Not isolated'}</span><span>{((artifact?.mesh.indices.length ?? 0) / 3).toLocaleString()} tri</span><span>{((artifact?.mesh.sourceTopology?.positions.length ?? artifact?.mesh.positions.length ?? 0) / 3).toLocaleString()} vert</span></div>
            </article>;
          })}
          {!scene.length && <div className="empty-state"><strong>No models loaded</strong><span>Import a supported dental mesh to inspect and validate it.</span></div>}
        </div>
        <div className="scene-summary"><span>{scene.length} objects</span><span>{visibleCount} visible</span><span>{triangleCount.toLocaleString()} triangles</span></div>
      </aside>

      <main className={`viewer-panel ${placement ? 'placing-measurement' : ''}`}>
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
        <canvas ref={canvasRef} aria-label="Design Studio 3D viewer" onClick={handleCanvasClick} onPointerMove={handleCanvasMove} onPointerLeave={() => setPreviewHit(null)}/>
        {!scene.length && <div className="viewer-empty"><span className="viewer-logo">DS</span><h1>Production Viewer</h1><p>Inspection, measurement, and deterministic mesh validation workspace.</p><button className="primary" onClick={() => importRef.current?.click()}>Import Models</button></div>}
        {measurementLabels.map(({ measurement, projected }) => projected?.visible && <button key={measurement.id} className="measurement-label" style={{ left: projected.x, top: projected.y }} onClick={() => { setSelectedMeasurementId(measurement.id); setInspectorTab('measure'); }}>{formatMeasurement(measurement)}</button>)}
        {placement && <div className="placement-banner"><strong>{MEASUREMENT_LABELS[placement.kind]}</strong><span>{pendingAnchors.length} anchor{pendingAnchors.length === 1 ? '' : 's'} placed</span>{placement.kind === 'multi-segment-distance' && <button onClick={() => void completeMeasurement(placement.kind, pendingAnchors, placement.editingId)} disabled={pendingAnchors.length < 2}>Finish</button>}<button onClick={() => { setPlacement(null); setPendingAnchors([]); setPreviewHit(null); setStatus('Measurement placement cancelled'); }}>Cancel</button></div>}
        <div className="statusbar" role="status"><span>{status}</span><span>{project.camera.projection}</span><span>{triangleCount.toLocaleString()} triangles</span></div>
      </main>

      <aside className="properties-panel">
        <div className="inspector-tabs" role="tablist"><button className={inspectorTab === 'scene' ? 'active' : ''} onClick={() => setInspectorTab('scene')}>Scene</button><button className={inspectorTab === 'measure' ? 'active' : ''} onClick={() => setInspectorTab('measure')}>Measure</button><button className={inspectorTab === 'validate' ? 'active' : ''} onClick={() => setInspectorTab('validate')}>Validate</button></div>

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

        <div className="property-card metrics-card" aria-label="Runtime performance metrics"><span>Commands</span><code>{commandBus.history().length}</code><span>Import</span><code>{formatMetric(metricSummary['import.total']?.averageMs)}</code><span>Validation</span><code>{formatMetric(metricSummary['validation.total']?.averageMs)}</code><span>Overlay</span><code>{formatMetric(metricSummary['validation.overlay-generation']?.averageMs)}</code><span>Frame response</span><code>{formatMetric(metricSummary['renderer.frame']?.averageMs)}</code><span>Save</span><code>{formatMetric(metricSummary['project.save']?.averageMs)}</code><span>Reopen</span><code>{formatMetric(metricSummary['project.reopen']?.averageMs)}</code><span>Mesh memory</span><code>{typeof latestMemoryBytes === 'number' ? formatBytes(latestMemoryBytes) : '—'}</code></div>
        {recoveryAvailable && <div className="recovery-card"><strong>Recovery snapshot available</strong><p>Scene, measurements, reports, views, and artifacts can be restored.</p><button onClick={recoverProject}>Recover</button></div>}
      </aside>
    </div>
  </div>;
}

function snapshotProject(project: DesignProject, scene: SceneObject[], artifacts: ArtifactManager, savedViews: SavedView[], measurements: MeasurementRecord[], reports: StoredValidationReport[], history: DesignProject['history']): DesignProject {
  return { ...structuredClone(project), schemaVersion: 2, scene: structuredClone(scene), artifacts: artifacts.list(), savedViews: structuredClone(savedViews), measurements: structuredClone(measurements), validationReports: structuredClone(reports), history: structuredClone(history), updatedAt: new Date().toISOString() };
}

function formatMetric(value?: number): string { return value === undefined ? '—' : `${value.toFixed(1)} ms`; }
function formatBytes(value: number): string { return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1024 / 1024).toFixed(1)} MiB`; }
function average(points: Vec3[]): Vec3 { const total = points.reduce<Vec3>((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]); return [total[0] / points.length, total[1] / points.length, total[2] / points.length]; }
function renderValue(value: unknown): string { return value === null ? 'not run' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function safeName(value: string): string { return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'artifact'; }
function availableUserIdentity(): string | null { return document.querySelector<HTMLMetaElement>('meta[name="cadence-user-id"]')?.content?.trim() || null; }
function downloadText(name: string, content: string, type: string): void { const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0); }
