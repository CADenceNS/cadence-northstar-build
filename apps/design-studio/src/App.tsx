import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArtifactManager, createProject, DesignProject, ProjectStore, SceneManager, type ArtifactKind, type SceneObject } from './core';
import {
  CameraResetCommand,
  CommandBus,
  DeleteArtifactCommand,
  ImportArtifactCommand,
  IsolateCommand,
  ProjectionChangeCommand,
  RestoreVisibilityCommand,
  ToggleVisibilityCommand,
} from './commands';
import { ManagedMeshImporter } from './importers';
import type { IRenderer } from './interfaces';
import { runtimeMetrics } from './metrics';
import { InstrumentedRenderer } from './renderer-adapter';
import { SelectionCommand } from './selection-command';
import { SelectionEngine } from './selection';
import './styles.css';

const projectStore = new ProjectStore();
const importer = new ManagedMeshImporter();

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
  const [scene, setScene] = useState<SceneObject[]>(() => sceneManager.list());
  const [status, setStatus] = useState('Ready');
  const [dirty, setDirty] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [metricsVersion, setMetricsVersion] = useState(0);
  const [recoveryAvailable, setRecoveryAvailable] = useState(() => Boolean(projectStore.recover()));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<IRenderer | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => sceneManager.subscribe(() => {
    runtimeMetrics.measure('scene.update', () => setScene(sceneManager.list()), { objects: sceneManager.list().length });
    setDirty(true);
  }), [sceneManager]);
  useEffect(() => commandBus.subscribe(() => setHistoryVersion((value) => value + 1)), [commandBus]);
  useEffect(() => runtimeMetrics.subscribe(() => setMetricsVersion((value) => value + 1)), []);

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

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      const snapshot = snapshotProject(project, scene, artifactManager);
      projectStore.autoSave(snapshot);
      setRecoveryAvailable(true);
      setStatus(`Auto-saved ${new Date().toLocaleTimeString()}`);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [artifactManager, dirty, project, scene]);

  const selected = useMemo(() => scene.find((object) => object.selected), [scene]);
  const visibleCount = scene.filter((object) => object.visible).length;
  const artifacts = artifactManager.list();
  const triangleCount = artifacts.reduce((total, artifact) => total + artifact.mesh.indices.length / 3, 0);
  const metricSummary = useMemo(() => runtimeMetrics.summary(), [metricsVersion]);
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
      setProject((current) => ({ ...current, artifacts: artifactManager.list() }));
      viewerRef.current?.fitToScreen();
      setStatus(`Imported ${files.length} model${files.length === 1 ? '' : 's'}`);
      setDirty(true);
    } catch (error) {
      try { await commandBus.rollbackTransaction(); } catch { /* no active transaction */ }
      setStatus(error instanceof Error ? error.message : 'Import failed');
    } finally { event.target.value = ''; }
  };

  const newProject = () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new project?')) return;
    const next = createProject('New Design Project');
    sceneManager.replace([]);
    artifactManager.replace([]);
    selectionEngine.clear();
    setProject(next);
    projectStore.clearRecovery();
    setRecoveryAvailable(false);
    setDirty(false);
    setStatus('New project created');
  };

  const saveProject = () => {
    const saved = projectStore.save(snapshotProject(project, scene, artifactManager));
    setProject(saved); setDirty(false); setRecoveryAvailable(false); setStatus(`Saved ${saved.name}`);
  };

  const saveAs = () => {
    const name = window.prompt('Project name', `${project.name} Copy`)?.trim();
    if (!name) return;
    const saved = projectStore.saveAs(snapshotProject(project, scene, artifactManager), name);
    setProject(saved); setDirty(false); setRecoveryAvailable(false); setStatus(`Saved as ${saved.name}`);
  };

  const openProject = (id: string) => {
    if (dirty && !window.confirm('Discard unsaved changes and open another project?')) return;
    try {
      const opened = projectStore.open(id);
      sceneManager.replace(opened.scene);
      artifactManager.replace(opened.artifacts);
      selectionEngine.restore({ activeSet: 'Default', sets: { Default: opened.scene.filter((item) => item.selected).map((item) => ({ kind: 'object', objectId: item.id })) } });
      setProject(opened); setDirty(false); setRecentOpen(false); setStatus(`Opened ${opened.name}`);
      requestAnimationFrame(() => viewerRef.current?.fitToScreen());
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to open project'); }
  };

  const recoverProject = () => {
    const start = performance.now();
    const recovered = projectStore.recover();
    runtimeMetrics.record({ name: 'project.recovery', durationMs: performance.now() - start, startedAt: new Date().toISOString(), metadata: { recovered: Boolean(recovered) } });
    if (!recovered) return;
    sceneManager.replace(recovered.scene); artifactManager.replace(recovered.artifacts);
    selectionEngine.restore({ activeSet: 'Default', sets: { Default: recovered.scene.filter((item) => item.selected).map((item) => ({ kind: 'object', objectId: item.id })) } });
    setProject(recovered); setDirty(true); setStatus('Recovered auto-saved project');
  };

  const setObjectKind = (kind: ArtifactKind) => { if (selected) sceneManager.update(selected.id, { type: kind }); };
  const setOpacity = (opacity: number) => { if (selected) sceneManager.update(selected.id, { material: { ...selected.material, opacity } }); };

  return <div className="studio-shell">
    <header className="topbar">
      <div className="product"><span className="product-mark">DS</span><div><strong>CADence Design Studio</strong><span>Core Runtime</span></div></div>
      <div className="project-title"><input aria-label="Project name" value={project.name} onChange={(event) => { setProject({ ...project, name: event.target.value }); setDirty(true); }}/><span>{dirty ? 'Unsaved changes' : 'Saved'} · Schema v{project.schemaVersion}</span></div>
      <div className="top-actions">
        <button onClick={newProject}>New</button><button onClick={() => setRecentOpen(!recentOpen)}>Open</button>
        <button onClick={() => void run(commandBus.undo(), 'Undid last command')} disabled={!commandBus.canUndo()}>Undo</button>
        <button onClick={() => void run(commandBus.redo(), 'Redid command')} disabled={!commandBus.canRedo()}>Redo</button>
        <button onClick={saveProject} className="primary">Save</button><button onClick={saveAs}>Save As</button>
      </div>
    </header>

    {recentOpen && <section className="recent-panel" aria-label="Recent projects"><h2>Recent projects</h2>{projectStore.listRecent().map((item) => <button key={item.id} onClick={() => openProject(item.id)}><strong>{item.name}</strong><span>{new Date(item.updatedAt).toLocaleString()}</span></button>)}{!projectStore.listRecent().length && <p>No saved projects yet.</p>}</section>}

    <div className="workspace">
      <aside className="scene-panel">
        <div className="panel-heading"><div><p className="eyebrow">PROJECT</p><h2>Scene</h2></div><button className="icon-button" onClick={() => importRef.current?.click()} aria-label="Import models">＋</button></div>
        <input ref={importRef} className="visually-hidden" type="file" accept=".stl,.obj,.ply" multiple onChange={importFiles}/>
        <button className="import-zone" onClick={() => importRef.current?.click()}><strong>Import models</strong><span>STL · OBJ · ASCII PLY</span></button>
        <div className="scene-list">
          {scene.map((object) => <article className={`scene-row ${object.selected ? 'selected' : ''}`} key={object.id} onClick={(event) => void run(commandBus.execute(new SelectionCommand(selectionEngine, { kind: 'object', objectId: object.id }, event.ctrlKey || event.metaKey || event.shiftKey)))}>
            <button aria-label={`${object.visible ? 'Hide' : 'Show'} ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(new ToggleVisibilityCommand(sceneManager, object.id))); }}>{object.visible ? '◉' : '○'}</button>
            <div><strong>{object.name}</strong><span>{object.type} · {Math.round(object.material.opacity * 100)}%</span></div>
            <button aria-label={`Isolate ${object.name}`} onClick={(event) => { event.stopPropagation(); void run(commandBus.execute(object.isolated ? new RestoreVisibilityCommand(sceneManager) : new IsolateCommand(sceneManager, object.id))); }}>◎</button>
          </article>)}
          {!scene.length && <div className="empty-state"><strong>No models loaded</strong><span>Import an upper, lower, opposing, or bite model.</span></div>}
        </div>
        <div className="scene-summary"><span>{scene.length} objects</span><span>{visibleCount} visible</span><span>{triangleCount.toLocaleString()} triangles</span></div>
      </aside>

      <main className="viewer-panel">
        <div className="viewer-toolbar">
          <button onClick={() => viewerRef.current?.fitToScreen()}>Fit</button>
          <button onClick={() => viewerRef.current && void run(commandBus.execute(new CameraResetCommand(viewerRef.current)))}>Reset camera</button>
          <span className="divider"/>
          <button className={project.camera.projection === 'perspective' ? 'active' : ''} onClick={() => viewerRef.current && void run(commandBus.execute(new ProjectionChangeCommand(viewerRef.current, 'perspective')))}>Perspective</button>
          <button className={project.camera.projection === 'orthographic' ? 'active' : ''} onClick={() => viewerRef.current && void run(commandBus.execute(new ProjectionChangeCommand(viewerRef.current, 'orthographic')))}>Orthographic</button>
          <span className="viewer-help">Drag to orbit · Shift-drag to pan · Wheel to zoom</span>
        </div>
        <canvas ref={canvasRef} aria-label="Design Studio 3D viewer"/>
        {!scene.length && <div className="viewer-empty"><span className="viewer-logo">DS</span><h1>Production Viewer</h1><p>Load one or more dental meshes to begin.</p><button className="primary" onClick={() => importRef.current?.click()}>Import Models</button></div>}
        <div className="statusbar"><span>{status}</span><span>{project.camera.projection}</span><span>{triangleCount.toLocaleString()} triangles</span></div>
      </main>

      <aside className="properties-panel">
        <div className="panel-heading"><div><p className="eyebrow">INSPECTOR</p><h2>Properties</h2></div></div>
        {selected ? <>
          <label>Name<input value={selected.name} onChange={(event) => sceneManager.update(selected.id, { name: event.target.value })}/></label>
          <label>Object type<select value={selected.type} onChange={(event) => setObjectKind(event.target.value as ArtifactKind)}><option value="upper">Upper arch</option><option value="lower">Lower arch</option><option value="opposing">Opposing</option><option value="bite">Bite</option><option value="reference">Reference</option><option value="unknown">Unknown</option></select></label>
          <label>Transparency<input type="range" min="0.08" max="1" step="0.01" value={selected.material.opacity} onChange={(event) => setOpacity(Number(event.target.value))}/><span>{Math.round(selected.material.opacity * 100)}%</span></label>
          <div className="property-card"><span>Object ID</span><code>{selected.id}</code><span>Artifact</span><code>{selected.artifactId}</code></div>
          <button onClick={() => void run(commandBus.execute(selected.isolated ? new RestoreVisibilityCommand(sceneManager) : new IsolateCommand(sceneManager, selected.id)))}>{selected.isolated ? 'Show all models' : 'Isolate model'}</button>
          <button onClick={() => void run(commandBus.execute(new DeleteArtifactCommand(context(), selected.artifactId)), 'Artifact removed')} className="danger">Remove artifact</button>
        </> : <div className="empty-state"><strong>No selection</strong><span>Select one or more scene objects to inspect them.</span></div>}
        <div className="property-card" aria-label="Runtime metrics"><span>Commands</span><code>{commandBus.history().length}</code><span>Last import</span><code>{formatMetric(metricSummary['import.total']?.averageMs)}</code><span>GPU upload</span><code>{formatMetric(metricSummary['renderer.gpu-upload']?.averageMs)}</code><span>Frame</span><code>{formatMetric(metricSummary['renderer.frame']?.averageMs)}</code></div>
        {recoveryAvailable && <div className="recovery-card"><strong>Recovery snapshot available</strong><p>An auto-saved project can be restored.</p><button onClick={recoverProject}>Recover</button></div>}
      </aside>
    </div>
  </div>;
}

function snapshotProject(project: DesignProject, scene: SceneObject[], artifacts: ArtifactManager): DesignProject {
  return { ...structuredClone(project), scene: structuredClone(scene), artifacts: artifacts.list(), updatedAt: new Date().toISOString() };
}

function formatMetric(value?: number): string { return value === undefined ? '—' : `${value.toFixed(1)} ms`; }
