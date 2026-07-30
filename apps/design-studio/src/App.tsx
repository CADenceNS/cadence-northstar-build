import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArtifactManager, createProject, DesignProject, ProjectStore, SceneManager, type ArtifactKind, type CameraState, type SceneObject } from './core';
import { ViewerRuntime } from './viewer';
import './styles.css';

const projectStore = new ProjectStore();

export function App() {
  const [project, setProject] = useState<DesignProject>(() => projectStore.recover() ?? createProject('New Design Project'));
  const [sceneManager] = useState(() => new SceneManager(project.scene));
  const [artifactManager] = useState(() => new ArtifactManager(project.artifacts));
  const [scene, setScene] = useState<SceneObject[]>(() => sceneManager.list());
  const [status, setStatus] = useState('Ready');
  const [dirty, setDirty] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(() => Boolean(projectStore.recover()));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<ViewerRuntime | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => sceneManager.subscribe(() => { setScene(sceneManager.list()); setDirty(true); }), [sceneManager]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewer = new ViewerRuntime(canvas, project.camera, (camera) => {
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
  const triangleCount = useMemo(() => artifactManager.list().reduce((total, artifact) => total + artifact.mesh.indices.length / 3, 0), [scene, artifactManager]);

  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setStatus(`Importing ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      for (const file of files) {
        const artifact = await artifactManager.importFile(file);
        sceneManager.addFromArtifact(artifact);
      }
      setProject((current) => ({ ...current, artifacts: artifactManager.list() }));
      viewerRef.current?.fitToScreen();
      setStatus(`Imported ${files.length} model${files.length === 1 ? '' : 's'}`);
      setDirty(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Import failed');
    } finally {
      event.target.value = '';
    }
  };

  const newProject = () => {
    if (dirty && !window.confirm('Discard unsaved changes and create a new project?')) return;
    const next = createProject('New Design Project');
    sceneManager.replace([]);
    artifactManager.replace([]);
    setProject(next);
    projectStore.clearRecovery();
    setRecoveryAvailable(false);
    setDirty(false);
    setStatus('New project created');
  };

  const saveProject = () => {
    const saved = projectStore.save(snapshotProject(project, scene, artifactManager));
    setProject(saved);
    setDirty(false);
    setRecoveryAvailable(false);
    setStatus(`Saved ${saved.name}`);
  };

  const saveAs = () => {
    const name = window.prompt('Project name', `${project.name} Copy`)?.trim();
    if (!name) return;
    const saved = projectStore.saveAs(snapshotProject(project, scene, artifactManager), name);
    setProject(saved);
    setDirty(false);
    setRecoveryAvailable(false);
    setStatus(`Saved as ${saved.name}`);
  };

  const openProject = (id: string) => {
    if (dirty && !window.confirm('Discard unsaved changes and open another project?')) return;
    try {
      const opened = projectStore.open(id);
      sceneManager.replace(opened.scene);
      artifactManager.replace(opened.artifacts);
      setProject(opened);
      setDirty(false);
      setRecentOpen(false);
      setStatus(`Opened ${opened.name}`);
      requestAnimationFrame(() => viewerRef.current?.fitToScreen());
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to open project'); }
  };

  const recoverProject = () => {
    const recovered = projectStore.recover();
    if (!recovered) return;
    sceneManager.replace(recovered.scene);
    artifactManager.replace(recovered.artifacts);
    setProject(recovered);
    setDirty(true);
    setStatus('Recovered auto-saved project');
  };

  const setObjectKind = (kind: ArtifactKind) => { if (selected) sceneManager.update(selected.id, { type: kind }); };
  const setOpacity = (opacity: number) => { if (selected) sceneManager.update(selected.id, { material: { ...selected.material, opacity } }); };

  return <div className="studio-shell">
    <header className="topbar">
      <div className="product"><span className="product-mark">DS</span><div><strong>CADence Design Studio</strong><span>Runtime Foundation</span></div></div>
      <div className="project-title"><input aria-label="Project name" value={project.name} onChange={(event) => { setProject({ ...project, name: event.target.value }); setDirty(true); }}/><span>{dirty ? 'Unsaved changes' : 'Saved'} · Schema v{project.schemaVersion}</span></div>
      <div className="top-actions">
        <button onClick={newProject}>New</button>
        <button onClick={() => setRecentOpen(!recentOpen)}>Open</button>
        <button onClick={saveProject} className="primary">Save</button>
        <button onClick={saveAs}>Save As</button>
      </div>
    </header>

    {recentOpen && <section className="recent-panel" aria-label="Recent projects">
      <h2>Recent projects</h2>
      {projectStore.listRecent().map((item) => <button key={item.id} onClick={() => openProject(item.id)}><strong>{item.name}</strong><span>{new Date(item.updatedAt).toLocaleString()}</span></button>)}
      {!projectStore.listRecent().length && <p>No saved projects yet.</p>}
    </section>}

    <div className="workspace">
      <aside className="scene-panel">
        <div className="panel-heading"><div><p className="eyebrow">PROJECT</p><h2>Scene</h2></div><button className="icon-button" onClick={() => importRef.current?.click()} aria-label="Import models">＋</button></div>
        <input ref={importRef} className="visually-hidden" type="file" accept=".stl,.obj,.ply" multiple onChange={importFiles}/>
        <button className="import-zone" onClick={() => importRef.current?.click()}><strong>Import models</strong><span>STL · OBJ · ASCII PLY</span></button>
        <div className="scene-list">
          {scene.map((object) => <article className={`scene-row ${object.selected ? 'selected' : ''}`} key={object.id} onClick={() => sceneManager.select(object.id)}>
            <button aria-label={`${object.visible ? 'Hide' : 'Show'} ${object.name}`} onClick={(event) => { event.stopPropagation(); sceneManager.update(object.id, { visible: !object.visible }); }}>{object.visible ? '◉' : '○'}</button>
            <div><strong>{object.name}</strong><span>{object.type} · {Math.round(object.material.opacity * 100)}%</span></div>
            <button aria-label={`Isolate ${object.name}`} onClick={(event) => { event.stopPropagation(); sceneManager.isolate(object.isolated ? null : object.id); }}>◎</button>
          </article>)}
          {!scene.length && <div className="empty-state"><strong>No models loaded</strong><span>Import an upper, lower, opposing, or bite model.</span></div>}
        </div>
        <div className="scene-summary"><span>{scene.length} objects</span><span>{visibleCount} visible</span><span>{triangleCount.toLocaleString()} triangles</span></div>
      </aside>

      <main className="viewer-panel">
        <div className="viewer-toolbar">
          <button onClick={() => viewerRef.current?.fitToScreen()}>Fit</button>
          <button onClick={() => viewerRef.current?.resetCamera()}>Reset camera</button>
          <span className="divider"/>
          <button className={project.camera.projection === 'perspective' ? 'active' : ''} onClick={() => viewerRef.current?.setProjection('perspective')}>Perspective</button>
          <button className={project.camera.projection === 'orthographic' ? 'active' : ''} onClick={() => viewerRef.current?.setProjection('orthographic')}>Orthographic</button>
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
          <button onClick={() => sceneManager.isolate(selected.isolated ? null : selected.id)}>{selected.isolated ? 'Show all models' : 'Isolate model'}</button>
          <button onClick={() => sceneManager.remove(selected.id)} className="danger">Remove from scene</button>
        </> : <div className="empty-state"><strong>No selection</strong><span>Select a scene object to inspect it.</span></div>}
        {recoveryAvailable && <div className="recovery-card"><strong>Recovery snapshot available</strong><p>An auto-saved project can be restored.</p><button onClick={recoverProject}>Recover</button></div>}
      </aside>
    </div>
  </div>;
}

function snapshotProject(project: DesignProject, scene: SceneObject[], artifacts: ArtifactManager): DesignProject {
  return { ...structuredClone(project), scene: structuredClone(scene), artifacts: artifacts.list(), updatedAt: new Date().toISOString() };
}
