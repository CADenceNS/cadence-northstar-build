import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import type { ArtifactManager, SceneManager } from './core';
import type { CommandBus } from './commands';
import { SelectionCommand } from './selection-command';
import type { SelectionEngine } from './selection';
import type { IRenderer } from './interfaces';
import type { SurfaceHit, ViewerOverlay } from './inspection-types';
import { ComponentSelectionEngine, growComponentSelection, invertSelection, paintSelect, screenSelect, selectionFromSurfaceHit, shrinkComponentSelection } from './component-selection';
import { boundaryLoops, buildTopology, edgeKey, indexedMesh, inspectGeometry, meshData } from './editing-geometry';
import type { EditingStateManager } from './editing-state';
import { CurveStateCommand, EditingStateCommand, GeometryEditCommand, TransformEditCommand } from './editing-commands';
import type { ComponentSelectionMode, EditingProjectState, GeometryOperationOutput, SurfaceCurve, ToolDefinition, ToolRuntimeState } from './editing-types';
import { EditingWorkerClient } from './editing-client';
import type { EditingOperationRequest } from './editing-operation';
import { ToolRuntime, type ToolExecutor } from './tool-runtime';
import { PRODUCTION_TOOL_DEFINITIONS } from './tool-registry';
import {
  alignObjects,
  alignToAxis,
  alignToPlane,
  applyNumericTransform,
  centerObjectToOrigin,
  resetTransform,
  snappedNumericTransform,
  surfaceSnapObject,
  uniformScale,
} from './transform-tools';
import {
  addControlPoint,
  createPolyline,
  createSpline,
  createSurfaceProjectedCurve,
  editControlPoint,
  extendCurve,
  joinCurves,
  offsetCurve,
  offsetCurveOnMesh,
  projectCurveToMesh,
  removeControlPoint,
  resampleCurve,
  reverseCurve,
  setCurveClosed,
  simplifyCurve,
  smoothCurve,
  splitCurve,
  trimCurve,
} from './curve-tools';
import { add3, boundsOfPoints, inverseTransformPoint, scale3, transformPoint } from './geometry';
import './editing-styles.css';

export interface EditingWorkspaceHandle {
  handleCanvasClick(hit: SurfaceHit, additive: boolean): boolean;
  handlePointerDown(clientX: number, clientY: number): boolean;
  handlePointerMove(clientX: number, clientY: number): boolean;
  handlePointerUp(clientX: number, clientY: number): boolean;
}

interface Props {
  scene: SceneObject[];
  artifacts: ArtifactRecord[];
  sceneManager: SceneManager;
  artifactManager: ArtifactManager;
  selectionEngine: SelectionEngine;
  editingManager: EditingStateManager;
  commandBus: CommandBus;
  renderer: IRenderer | null;
  onStatus(message: string): void;
  onOverlays(overlays: ViewerOverlay[]): void;
}

interface EditingContext extends Props { selectedObjects: SceneObject[]; editing: EditingProjectState; activeCurveId: string; }

const INITIAL_TOOL_STATE: ToolRuntimeState = { activeToolId: null, parameters: {}, phase: 'idle', progress: null, error: null };
const PICK_MODES = new Set<ComponentSelectionMode>(['vertex', 'edge', 'face', 'connected-region', 'shell', 'boundary-loop', 'edge-loop', 'edge-ring', 'normal-angle', 'connectivity']);
const SELECTION_COMMANDS = new Set(['select.grow', 'select.shrink', 'select.invert']);
const TOPOLOGY_STABLE_OPERATIONS = new Set(['transform.mirror', 'transform.bake', 'mesh.offset-region', 'mesh.flatten', 'mesh.smooth', 'mesh.relax', 'mesh.recalculate-normals', 'mesh.reverse-normals', 'topology.smooth']);

export const EditingWorkspace = forwardRef<EditingWorkspaceHandle, Props>(function EditingWorkspace(props, ref) {
  const [editing, setEditing] = useState(() => props.editingManager.get());
  const [componentEngine] = useState(() => new ComponentSelectionEngine(editing.componentSelections));
  const [worker] = useState(() => new EditingWorkerClient());
  const [runtime] = useState(() => new ToolRuntime<EditingContext, GeometryOperationOutput>(props.commandBus));
  const [runtimeState, setRuntimeState] = useState<ToolRuntimeState>(INITIAL_TOOL_STATE);
  const [preview, setPreview] = useState<GeometryOperationOutput | null>(null);
  const [category, setCategory] = useState<ToolDefinition['category']>('selection');
  const [selectionMode, setSelectionMode] = useState<ComponentSelectionMode>('object');
  const [directToolId, setDirectToolId] = useState<string | null>(null);
  const [directParameters, setDirectParameters] = useState<Record<string, number | string | boolean>>({});
  const [curvePlacement, setCurvePlacement] = useState<'polyline' | 'spline' | 'surface-projected' | null>(null);
  const [curvePoints, setCurvePoints] = useState<Vec3[]>([]);
  const [curvePointDraft, setCurvePointDraft] = useState<Vec3>([0, 0, 0]);
  const [selectedCurveId, setSelectedCurveId] = useState<string>('');
  const [secondaryCurveId, setSecondaryCurveId] = useState<string>('');
  const [controlPointIndex, setControlPointIndex] = useState(0);
  const drag = useRef<{ mode: 'paint' | 'lasso' | 'rectangle'; points: Array<{ x: number; y: number }> } | null>(null);
  const suppressClick = useRef(false);

  const selectedObjects = useMemo(() => props.scene.filter((object) => object.selected), [props.scene]);
  const context = (): EditingContext => ({ ...props, selectedObjects, editing: props.editingManager.get(), activeCurveId: selectedCurveId });
  const activeDefinition = useMemo(() => PRODUCTION_TOOL_DEFINITIONS.find((tool) => tool.id === (runtimeState.activeToolId ?? directToolId)) ?? null, [directToolId, runtimeState.activeToolId]);
  const activeParameters = runtimeState.activeToolId ? runtimeState.parameters : directParameters;
  const selectedCurve = editing.curves.find((curve) => curve.id === selectedCurveId) ?? editing.curves[0];

  useEffect(() => props.editingManager.subscribe(() => { const next = props.editingManager.get(); setEditing(next); componentEngine.replace(next.componentSelections); }), [componentEngine, props.editingManager]);
  useEffect(() => componentEngine.subscribe((selections) => { if (JSON.stringify(selections) !== JSON.stringify(props.editingManager.get().componentSelections)) props.editingManager.setSelections(selections); }), [componentEngine, props.editingManager]);
  useEffect(() => runtime.subscribe((state, value) => { setRuntimeState(state); setPreview(value); }), [runtime]);
  useEffect(() => {
    const definitions = PRODUCTION_TOOL_DEFINITIONS.filter((tool) => tool.destructive);
    for (const definition of definitions) runtime.register(geometryExecutor(definition, worker));
    return () => { for (const definition of definitions) runtime.unregister(definition.id); worker.dispose(); };
  }, [runtime, worker]);
  useEffect(() => { if (!selectedCurveId && editing.curves[0]) setSelectedCurveId(editing.curves[0].id); }, [editing.curves, selectedCurveId]);
  useEffect(() => {
    props.onOverlays([...buildEditingOverlays(editing, props.scene, props.artifacts), ...buildCurvePlacementOverlays(curvePlacement, curvePoints, selectedObjects[0])]);
  }, [curvePlacement, curvePoints, editing, props.artifacts, props.scene, selectedObjects]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null; if (target?.matches('input,select,textarea,[contenteditable="true"]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); void (event.shiftKey ? props.commandBus.redo() : props.commandBus.undo()); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); void props.commandBus.redo(); return; }
      const shortcuts: Record<string, string> = { '1': 'select.object', '2': 'select.vertex', '3': 'select.edge', '4': 'select.face', g: 'transform.move', r: 'transform.rotate', s: 'transform.scale', Delete: 'mesh.delete-faces' };
      const id = shortcuts[event.key] ?? shortcuts[event.key.toLowerCase()]; const definition = PRODUCTION_TOOL_DEFINITIONS.find((tool) => tool.id === id);
      if (definition) { event.preventDefault(); void selectTool(definition); return; }
      if (event.key === 'Escape') { event.preventDefault(); void cancelTool(); return; }
      if (event.key === 'Enter' && runtimeState.phase === 'ready') { event.preventDefault(); void confirmGeometry(); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [props.commandBus, runtimeState.phase, editing, selectedObjects, directToolId]);
  useEffect(() => {
    if (!preview || !selectedObjects[0]) { props.renderer?.setScene(props.scene, props.artifacts); return; }
    const source = props.artifacts.find((artifact) => artifact.id === selectedObjects[0].artifactId); if (!source) return;
    const temporary: ArtifactRecord = { ...structuredClone(source), id: `preview-${selectedObjects[0].id}`, sourceName: `${source.sourceName} preview`, mesh: structuredClone(preview.mesh), metadata: { ...source.metadata, transientPreview: true } };
    props.renderer?.setScene(props.scene.map((object) => object.id === selectedObjects[0].id ? { ...object, artifactId: temporary.id } : object), [...props.artifacts, temporary]);
    return () => props.renderer?.setScene(props.scene, props.artifacts);
  }, [preview, props.artifacts, props.renderer, props.scene, selectedObjects]);
  useEffect(() => {
    if (!directToolId?.startsWith('transform.') || ['transform.custom-pivot', 'transform.coordinate-mode', 'transform.translation-snap', 'transform.angular-snap'].includes(directToolId) || !selectedObjects[0]) return;
    try {
      const after = directTransform(directToolId); props.renderer?.setScene(props.scene.map((object) => object.id === selectedObjects[0].id ? { ...object, transform: after } : object), props.artifacts);
      return () => props.renderer?.setScene(props.scene, props.artifacts);
    } catch { return; }
  }, [directParameters, directToolId, editing.transformSettings, props.artifacts, props.renderer, props.scene, selectedObjects]);

  useImperativeHandle(ref, () => ({
    handleCanvasClick(hit, additive) {
      if (suppressClick.current) { suppressClick.current = false; return true; }
      const object = props.sceneManager.get(hit.objectId); if (!object) return false;
      const localPosition = inverseTransformPoint(hit.position, object);
      if (curvePlacement) {
        const source = selectedObjects[0];
        if (!source || source.id !== object.id) { props.onStatus('Place curve control points on the selected source object.'); return true; }
        setCurvePoints((points) => [...points, localPosition]); props.onStatus(`${curvePlacement} point ${curvePoints.length + 1} placed in source-model coordinates`); return true;
      }
      if (selectionMode === 'object') { void execute(props.commandBus.execute(new SelectionCommand(props.selectionEngine, { kind: 'object', objectId: hit.objectId }, additive)), props.onStatus, 'Object selected'); return true; }
      const artifact = props.artifactManager.get(hit.artifactId); if (!artifact) return false;
      try {
        const selection = selectionMode === 'paint' ? paintSelect(artifact, object, [localPosition], numberValue(directParameters.radius, 2))
          : PICK_MODES.has(selectionMode) ? selectionFromSurfaceHit(artifact, object, hit.triangleIndex, localPosition, selectionMode as Parameters<typeof selectionFromSurfaceHit>[4], numberValue(directParameters.angle, 30)) : null;
        if (!selection) return false;
        const next = props.editingManager.get(); const existing = additive ? next.componentSelections.filter((value) => value.objectId !== object.id) : [];
        const current = additive ? next.componentSelections.find((value) => value.objectId === object.id && value.kind === selection.kind) : undefined;
        const combined = current ? { ...selection, ids: [...new Set([...current.ids, ...selection.ids])].sort((a, b) => a - b) } : selection;
        const state = { ...next, componentSelections: [...existing, combined], ...(directToolId ? { toolSettings: { ...next.toolSettings, [directToolId]: structuredClone(directParameters) } } : {}) };
        void execute(props.commandBus.execute(new EditingStateCommand(props.editingManager, state, 'selection.component', `Select ${selection.mode}`)), props.onStatus, `${selection.ids.length} ${selection.kind} elements selected`); return true;
      } catch (error) { props.onStatus(message(error)); return true; }
    },
    handlePointerDown(clientX, clientY) { if (!['paint', 'lasso', 'rectangle'].includes(selectionMode)) return false; drag.current = { mode: selectionMode as 'paint' | 'lasso' | 'rectangle', points: [{ x: clientX, y: clientY }] }; return true; },
    handlePointerMove(clientX, clientY) { if (!drag.current) return false; drag.current.points.push({ x: clientX, y: clientY }); return true; },
    handlePointerUp(clientX, clientY) { const value = drag.current; if (!value) return false; value.points.push({ x: clientX, y: clientY }); drag.current = null; suppressClick.current = true; if (value.mode === 'paint') applyPaintSelection(value.points); else applyScreenSelection(value.mode, value.points); return true; },
  }), [curvePlacement, curvePoints.length, directParameters, directToolId, selectionMode, props]);

  async function selectTool(definition: ToolDefinition) {
    setCategory(definition.category); setPreview(null); props.renderer?.setScene(props.scene, props.artifacts);
    if (definition.category === 'selection') {
      if (SELECTION_COMMANDS.has(definition.id)) {
        setDirectToolId(definition.id); setDirectParameters({ ...defaultParameters(definition), ...(editing.toolSettings[definition.id] ?? {}) }); props.onStatus(`${definition.label} ready`); return;
      }
      const mode = definition.id.replace('select.', '') as ComponentSelectionMode;
      setSelectionMode(mode); setDirectToolId(definition.id); setDirectParameters({ ...defaultParameters(definition), ...(editing.toolSettings[definition.id] ?? {}) }); props.onStatus(`${definition.label} selection active`); return;
    }
    if (definition.destructive) {
      setDirectToolId(null); try { await runtime.activate(definition.id, context(), editing.toolSettings[definition.id]); props.onStatus(`${definition.label} active — preview before confirming`); } catch (error) { props.onStatus(message(error)); }
      return;
    }
    setDirectToolId(definition.id); setDirectParameters({ ...defaultParameters(definition), ...(editing.toolSettings[definition.id] ?? {}) });
    if (definition.id === 'curve.polyline') beginCurve('polyline'); else if (definition.id === 'curve.spline') beginCurve('spline'); else if (definition.id === 'curve.surface-projected') beginCurve('surface-projected');
    else {
      if (['curve.edit-point', 'curve.add-point'].includes(definition.id) && selectedCurve) setCurvePointDraft(selectedCurve.controlPoints[Math.min(controlPointIndex, selectedCurve.controlPoints.length - 1)] ?? selectedCurve.controlPoints.at(-1)!);
      props.onStatus(`${definition.label} active`);
    }
  }

  async function selectionAction(action: 'grow' | 'shrink' | 'invert', parameters: Record<string, number | string | boolean>) {
    const currentState = props.editingManager.get();
    if (!currentState.componentSelections.length) { props.onStatus('Select mesh components before modifying the selection.'); return; }
    try {
      const rings = numberValue(parameters.rings, 1); if (!Number.isInteger(rings) || rings < 1 || rings > 50) throw new Error('Selection ring count must be an integer from 1 to 50.');
      const componentSelections = currentState.componentSelections.map((current) => {
        const artifact = props.artifactManager.get(current.artifactId); if (!artifact) throw new Error(`Selected artifact ${current.artifactId} is unavailable.`); const mesh = indexedMesh(artifact.mesh);
        if (current.kind === 'object') throw new Error(`${action} requires vertex, edge, or face components.`);
        const ids = action === 'grow' ? growComponentSelection(mesh, current.kind, current.ids, rings) : action === 'shrink' ? shrinkComponentSelection(mesh, current.kind, current.ids, rings) : invertSelection(mesh, current.kind, current.ids);
        return { ...current, ids, updatedAt: new Date().toISOString() };
      });
      const next = { ...currentState, componentSelections, toolSettings: { ...currentState.toolSettings, [`select.${action}`]: structuredClone(parameters) } };
      await props.commandBus.execute(new EditingStateCommand(props.editingManager, next, `selection.${action}`, `${action} selection`)); props.onStatus(`${action} selection: ${componentSelections.reduce((sum, value) => sum + value.ids.length, 0)} elements`);
    } catch (error) { props.onStatus(message(error)); }
  }

  function applyScreenSelection(mode: 'lasso' | 'rectangle', points: Array<{ x: number; y: number }>) {
    const object = selectedObjects[0]; const renderer = props.renderer; if (!object || !renderer) { props.onStatus('Select one object before screen-region selection.'); return; }
    const artifact = props.artifactManager.get(object.artifactId); if (!artifact) return;
    const polygon = mode === 'rectangle' ? rectanglePolygon(points[0], points.at(-1)!) : points;
    try { const selection = screenSelect(artifact, object, polygon, renderer, mode); const current = props.editingManager.get(); const next = { ...current, componentSelections: [selection], ...(directToolId ? { toolSettings: { ...current.toolSettings, [directToolId]: structuredClone(directParameters) } } : {}) }; void execute(props.commandBus.execute(new EditingStateCommand(props.editingManager, next, `selection.${mode}`, `${mode} selection`)), props.onStatus, `${selection.ids.length} faces selected`); } catch (error) { props.onStatus(message(error)); }
  }

  function applyPaintSelection(points: Array<{ x: number; y: number }>) {
    const object = selectedObjects[0]; const renderer = props.renderer; if (!object || !renderer) { props.onStatus('Select one object before painting mesh faces.'); return; }
    const artifact = props.artifactManager.get(object.artifactId); if (!artifact) return;
    try {
      const samples = points.flatMap((point) => { const hit = renderer.pick(point.x, point.y); return hit?.objectId === object.id ? [inverseTransformPoint(hit.position, object)] : []; });
      if (!samples.length) throw new Error('The paint stroke did not intersect the selected mesh.');
      const selection = paintSelect(artifact, object, samples, numberValue(directParameters.radius, 2)); const current = props.editingManager.get(); const previous = current.componentSelections.find((value) => value.objectId === object.id && value.kind === 'face'); const combined = previous ? { ...selection, ids: [...new Set([...previous.ids, ...selection.ids])].sort((a, b) => a - b) } : selection;
      const next = { ...current, componentSelections: [...current.componentSelections.filter((value) => value.objectId !== object.id), combined], toolSettings: { ...current.toolSettings, 'select.paint': structuredClone(directParameters) } };
      void execute(props.commandBus.execute(new EditingStateCommand(props.editingManager, next, 'selection.paint', 'Paint mesh-face selection')), props.onStatus, `Paint selected ${combined.ids.length} faces`);
    } catch (error) { props.onStatus(message(error)); }
  }

  function beginCurve(kind: 'polyline' | 'spline' | 'surface-projected') { if (!selectedObjects[0]) { props.onStatus(`${kind} requires a selected source object.`); return; } setCurvePlacement(kind); setCurvePoints([]); props.onStatus(`${kind} placement active — click the selected mesh geometry, then confirm`); }
  async function finishCurve() {
    if (!curvePlacement) return; const object = selectedObjects[0]; const artifact = object ? props.artifactManager.get(object.artifactId) : undefined;
    try {
      if (!object || !artifact) throw new Error('Curve creation requires a selected source object.');
      const name = `Curve ${editing.curves.length + 1}`;
      const association = { objectId: object.id, artifactId: object.artifactId };
      const curve = curvePlacement === 'polyline' ? createPolyline(name, curvePoints, association)
        : curvePlacement === 'spline' ? createSpline(name, curvePoints, 12, association)
        : createSurfaceProjectedCurve(name, curvePoints, artifact, object);
      await props.commandBus.execute(CurveStateCommand.add(props.editingManager, curve)); setCurvePlacement(null); setCurvePoints([]); setSelectedCurveId(curve.id); props.onStatus(`Created ${curve.name} with ${curve.controlPoints.length} model-space points`);
    } catch (error) { props.onStatus(message(error)); }
  }

  async function confirmDirectTool() {
    const id = directToolId; if (!id) return;
    if (SELECTION_COMMANDS.has(id)) { await selectionAction(id.replace('select.', '') as 'grow' | 'shrink' | 'invert', directParameters); return; }
    if (id.startsWith('curve.')) { await executeCurveTool(id); return; }
    const object = selectedObjects[0]; const artifact = object ? props.artifactManager.get(object.artifactId) : undefined;
    try {
      if (['transform.custom-pivot', 'transform.coordinate-mode', 'transform.translation-snap', 'transform.angular-snap'].includes(id)) {
        const settings = structuredClone(editing.transformSettings);
        if (id === 'transform.custom-pivot') settings.pivot = values(directParameters, '', [0, 0, 0]);
        if (id === 'transform.coordinate-mode') settings.coordinateMode = String(directParameters.mode) as 'local' | 'global';
        if (id === 'transform.translation-snap') settings.translationSnapMm = numberValue(directParameters.interval, 0);
        if (id === 'transform.angular-snap') settings.angularSnapDegrees = numberValue(directParameters.interval, 0);
        await props.commandBus.execute(new EditingStateCommand(props.editingManager, { ...editing, transformSettings: settings }, id, `Set ${id}`)); props.onStatus('Transform preferences persisted'); return;
      }
      if (!object || !artifact) throw new Error('Select an unlocked scene object.'); if (object.locked) throw new Error(`Locked object ${object.name} cannot be transformed.`);
      const after = directTransform(id);
      const definition = PRODUCTION_TOOL_DEFINITIONS.find((tool) => tool.id === id); await props.commandBus.execute(new TransformEditCommand(props.sceneManager, props.editingManager, object.id, after, id, definition?.label ?? id, directParameters)); setDirectParameters(definition ? defaultParameters(definition) : {}); props.onStatus(`${id} applied with exact numeric transform`);
    } catch (error) { props.onStatus(message(error)); }
  }

  function directTransform(id: string): SceneObject['transform'] {
    const object = selectedObjects[0]; const artifact = object ? props.artifactManager.get(object.artifactId) : undefined;
    if (!object || !artifact) throw new Error('Select an unlocked scene object.'); if (object.locked) throw new Error(`Locked object ${object.name} cannot be transformed.`);
    const pivot = editing.transformSettings.pivot ?? object.transform.position;
    if (id === 'transform.move') return applyNumericTransform(object, { translation: values(directParameters), rotationDegrees: [0, 0, 0], scale: [1, 1, 1], pivot, coordinateMode: editing.transformSettings.coordinateMode }).after;
    if (id === 'transform.rotate') return applyNumericTransform(object, { translation: [0, 0, 0], rotationDegrees: values(directParameters), scale: [1, 1, 1], pivot, coordinateMode: editing.transformSettings.coordinateMode }).after;
    if (id === 'transform.scale') return applyNumericTransform(object, { translation: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: values(directParameters, 'scale', [1, 1, 1]), pivot, coordinateMode: editing.transformSettings.coordinateMode }).after;
    if (id === 'transform.uniform-scale') return uniformScale(object, numberValue(directParameters.factor, 1), pivot).after;
    if (id === 'transform.numeric') { const input = { translation: values(directParameters, 'translation'), rotationDegrees: values(directParameters, 'rotation'), scale: values(directParameters, 'scale', [1, 1, 1]), pivot, coordinateMode: editing.transformSettings.coordinateMode }; return applyNumericTransform(object, snappedNumericTransform(input, editing.transformSettings.translationSnapMm, editing.transformSettings.angularSnapDegrees)).after; }
    if (id === 'transform.align-objects') { const target = selectedObjects[1]; const targetArtifact = target ? props.artifactManager.get(target.artifactId) : undefined; if (!target || !targetArtifact) throw new Error('Align objects requires exactly two selected objects.'); return alignObjects(object, artifact, target, targetArtifact).after; }
    if (id === 'transform.align-plane') return alignToPlane(object, [0, 0, 1], values(directParameters, 'normal', [0, 0, 1]), pivot, values(directParameters, 'origin')).after;
    if (id === 'transform.align-axis') return alignToAxis(object, values(directParameters, 'local', [0, 0, 1]), values(directParameters, 'global', [0, 0, 1]), pivot).after;
    if (id === 'transform.center-origin') return centerObjectToOrigin(object, artifact).after;
    if (id === 'transform.surface-snap') { const target = selectedObjects[1]; const targetArtifact = target ? props.artifactManager.get(target.artifactId) : undefined; if (!target || !targetArtifact) throw new Error('Surface snapping requires two selected objects.'); return surfaceSnapObject(object, artifact, target, targetArtifact).after; }
    if (id === 'transform.reset') return resetTransform(object).after;
    throw new Error(`${id} is not a direct transform tool.`);
  }

  async function executeCurveTool(id: string) {
    if (['curve.polyline', 'curve.spline', 'curve.surface-projected'].includes(id)) { await finishCurve(); return; }
    if (!selectedCurve) { props.onStatus('Select a curve first.'); return; }
    try {
      let next: SurfaceCurve | null = selectedCurve; let replacement: SurfaceCurve[] | null = null;
      const sourceObject = selectedCurve.objectId ? props.sceneManager.get(selectedCurve.objectId) : undefined; const sourceArtifact = selectedCurve.artifactId ? props.artifactManager.get(selectedCurve.artifactId) : undefined;
      if (id === 'curve.edit-point') next = editControlPoint(selectedCurve, controlPointIndex, curvePointDraft, sourceArtifact, sourceObject);
      else if (id === 'curve.add-point') { next = addControlPoint(selectedCurve, curvePointDraft, Math.min(controlPointIndex + 1, selectedCurve.controlPoints.length)); if (next.kind === 'surface-projected' && sourceArtifact && sourceObject) next = projectCurveToMesh(next, sourceArtifact, sourceObject, sourceObject); }
      else if (id === 'curve.remove-point') next = removeControlPoint(selectedCurve, controlPointIndex);
      else if (id === 'curve.smooth') next = smoothCurve(selectedCurve, 1, numberValue(directParameters.strength, 50) / 100);
      else if (id === 'curve.simplify') next = simplifyCurve(selectedCurve, numberValue(directParameters.tolerance, 0.1));
      else if (id === 'curve.resample') next = resampleCurve(selectedCurve, numberValue(directParameters.spacing, 0.5));
      else if (id === 'curve.offset') next = sourceArtifact ? offsetCurveOnMesh(selectedCurve, numberValue(directParameters.distance, 1), sourceArtifact) : offsetCurve(selectedCurve, numberValue(directParameters.distance, 1));
      else if (id === 'curve.extend') next = extendCurve(selectedCurve, numberValue(directParameters.distance, 1));
      else if (id === 'curve.trim') next = trimCurve(selectedCurve, numberValue(directParameters.start, 0), numberValue(directParameters.end, 1));
      else if (id === 'curve.split') replacement = splitCurve(selectedCurve, Math.max(1, Math.min(selectedCurve.controlPoints.length - 2, controlPointIndex)));
      else if (id === 'curve.join') { const second = editing.curves.find((curve) => curve.id === secondaryCurveId); if (!second) throw new Error('Choose a second curve to join.'); next = joinCurves(selectedCurve, second, numberValue(directParameters.tolerance, 0.1)); replacement = [next]; }
      else if (id === 'curve.reverse') next = reverseCurve(selectedCurve);
      else if (id === 'curve.open-close') next = setCurveClosed(selectedCurve, !selectedCurve.closed);
      else if (id === 'curve.project') { const object = selectedObjects[0]; const artifact = object ? props.artifactManager.get(object.artifactId) : undefined; if (!object || !artifact) throw new Error('Select the target mesh object.'); next = projectCurveToMesh(selectedCurve, artifact, object, sourceObject); }
      else throw new Error(`${id} is not a curve operation.`);
      if (id !== 'curve.project' && sourceArtifact && sourceObject) {
        if (next?.kind === 'surface-projected') next = projectCurveToMesh(next, sourceArtifact, sourceObject, sourceObject);
        if (replacement) replacement = replacement.map((curve) => curve.kind === 'surface-projected' ? projectCurveToMesh(curve, sourceArtifact, sourceObject, sourceObject) : curve);
      }
      if (replacement) {
        const removeIds = new Set([selectedCurve.id, ...(id === 'curve.join' ? [secondaryCurveId] : [])]); const state = { ...editing, curves: [...editing.curves.filter((curve) => !removeIds.has(curve.id)), ...replacement], toolSettings: { ...editing.toolSettings, [id]: structuredClone(directParameters) } }; await props.commandBus.execute(new EditingStateCommand(props.editingManager, state, id, id)); setSelectedCurveId(replacement[0].id);
      } else if (next) { const state = { ...editing, curves: editing.curves.map((curve) => curve.id === next!.id ? structuredClone(next!) : curve), toolSettings: { ...editing.toolSettings, [id]: structuredClone(directParameters) } }; await props.commandBus.execute(new EditingStateCommand(props.editingManager, state, id, id)); }
      setCurvePoints([]); props.onStatus(`${id} completed against model-space curve geometry`);
    } catch (error) { props.onStatus(message(error)); }
  }

  async function previewGeometry() { try { await runtime.preview(context()); props.onStatus('Live geometry preview ready; source artifact remains unchanged'); } catch (error) { props.onStatus(message(error)); } }
  async function confirmGeometry() { try { await runtime.confirm(context()); await runtime.cancel(context()); props.onStatus('Derived geometry version committed; source artifact preserved'); } catch (error) { props.onStatus(message(error)); } }
  async function cancelTool() { try { await runtime.cancel(context()); setDirectToolId(null); setCurvePlacement(null); setCurvePoints([]); setPreview(null); props.renderer?.setScene(props.scene, props.artifacts); props.onStatus('Tool cancelled without geometry mutation'); } catch (error) { props.onStatus(message(error)); } }
  function setParameter(id: string, value: number | string | boolean) { try { if (runtimeState.activeToolId) runtime.setParameter(id, value); else setDirectParameters((current) => ({ ...current, [id]: value })); } catch (error) { props.onStatus(message(error)); } }

  const tools = PRODUCTION_TOOL_DEFINITIONS.filter((tool) => tool.category === category);
  const version = editing.geometryVersions.at(-1);
  return <section className="editing-workspace" aria-label="Universal geometry editing workspace">
    <div className="panel-heading"><div><p className="eyebrow">DERIVED GEOMETRY</p><h2>Universal Editing Core</h2></div><span className="production-badge">COMMAND SAFE</span></div>
    <div className="editing-categories" role="tablist">{(['selection', 'transform', 'curve', 'mesh', 'cut', 'boolean', 'topology'] as const).map((value) => <button key={value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{value}</button>)}</div>
    <div className="tool-grid">{tools.map((definition) => <button key={definition.id} className={(runtimeState.activeToolId ?? directToolId) === definition.id ? 'active' : ''} title={definition.description} onClick={() => void selectTool(definition)}><strong>{definition.label}</strong><span>{definition.shortcut ?? definition.selection}</span></button>)}</div>

    {activeDefinition && <div className="tool-console">
      <div className="section-heading"><h3>{activeDefinition.label}</h3><span>{activeDefinition.workerBacked ? 'worker' : 'interactive'}</span></div><p>{activeDefinition.description}</p>
      {activeDefinition.parameters.map((parameter) => <label key={parameter.id}>{parameter.label}{parameter.type === 'boolean' ? <input type="checkbox" checked={Boolean(activeParameters[parameter.id])} onChange={(event) => setParameter(parameter.id, event.target.checked)}/> : parameter.type === 'select' ? <select value={String(activeParameters[parameter.id] ?? parameter.defaultValue)} onChange={(event) => setParameter(parameter.id, event.target.value)}>{parameter.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type="number" min={parameter.min} max={parameter.max} step={parameter.step} value={Number(activeParameters[parameter.id] ?? parameter.defaultValue)} onChange={(event) => setParameter(parameter.id, Number(event.target.value))}/>}</label>)}
      {['curve.edit-point', 'curve.add-point'].includes(activeDefinition.id) && <div className="curve-coordinate-editor">{(['X', 'Y', 'Z'] as const).map((axis, index) => <label key={axis}>Control {axis}<input type="number" step="0.01" value={curvePointDraft[index]} onChange={(event) => setCurvePointDraft((current) => current.map((value, item) => item === index ? Number(event.target.value) : value) as Vec3)}/></label>)}</div>}
      {curvePlacement && <div className="curve-placement"><strong>{curvePoints.length} points placed</strong><span>Click actual mesh surfaces to add model-space points.</span></div>}
      {runtimeState.progress && <div className="tool-progress"><progress max={runtimeState.progress.total} value={runtimeState.progress.completed}/><span>{runtimeState.progress.message}</span></div>}
      {runtimeState.error && <p className="tool-error">{runtimeState.error}</p>}
      <div className="button-row wrap">{activeDefinition.destructive ? <><button onClick={() => void previewGeometry()}>Preview actual geometry</button><button className="primary" onClick={() => void confirmGeometry()} disabled={runtimeState.phase !== 'ready'}>Confirm derived version</button></> : activeDefinition.category === 'selection' ? SELECTION_COMMANDS.has(activeDefinition.id) ? <button className="primary" onClick={() => void confirmDirectTool()}>Apply selection command</button> : <span>Use the viewer to select actual mesh elements.</span> : <button className="primary" onClick={() => void confirmDirectTool()}>{curvePlacement ? 'Confirm curve' : 'Apply through command'}</button>}<button onClick={() => void cancelTool()}>Cancel</button></div>
    </div>}

    {selectedObjects[0] && <div className="exact-transform-report" aria-label="Exact object transform"><strong>Exact transform</strong><code>Position mm {formatVector(selectedObjects[0].transform.position)}</code><code>Rotation quaternion {formatVector(selectedObjects[0].transform.rotation)}</code><code>Scale {formatVector(selectedObjects[0].transform.scale)}</code><code>Mode {editing.transformSettings.coordinateMode} · Pivot {editing.transformSettings.pivot ? formatVector(editing.transformSettings.pivot) : 'object origin'}</code></div>}

    <div className="editing-selection-summary"><strong>Component selection</strong><span>{componentSelectionSummary(editing.componentSelections, selectionMode)}</span>{editing.componentSelections.map((selection) => <code key={selection.objectId}>{selection.kind}: {selection.ids.slice(0, 12).join(', ')}{selection.ids.length > 12 ? '…' : ''}</code>)}</div>
    <div className="section-heading"><h3>Model-space curves</h3><span>{editing.curves.length}</span></div>
    <label>Active curve<select value={selectedCurve?.id ?? ''} onChange={(event) => setSelectedCurveId(event.target.value)}><option value="">Choose curve</option>{editing.curves.map((curve) => <option key={curve.id} value={curve.id}>{curve.name} · {curve.kind}</option>)}</select></label>
    <label>Second curve<select value={secondaryCurveId} onChange={(event) => setSecondaryCurveId(event.target.value)}><option value="">Choose second curve</option>{editing.curves.filter((curve) => curve.id !== selectedCurve?.id).map((curve) => <option key={curve.id} value={curve.id}>{curve.name}</option>)}</select></label>
    <label>Control-point index<input type="number" min="0" max={Math.max(0, (selectedCurve?.controlPoints.length ?? 1) - 1)} value={controlPointIndex} onChange={(event) => setControlPointIndex(Number(event.target.value))}/></label>
    {selectedCurve && <div className="curve-list"><article><strong>{selectedCurve.name}</strong><span>{selectedCurve.kind} · {selectedCurve.controlPoints.length} controls · {selectedCurve.sampledPoints.length} samples · {selectedCurve.closed ? 'closed' : 'open'}</span><code>{selectedCurve.id}</code><button className="danger" onClick={() => void execute(props.commandBus.execute(CurveStateCommand.remove(props.editingManager, selectedCurve.id)), props.onStatus, `Deleted ${selectedCurve.name}`)}>Delete curve</button></article></div>}

    <div className="section-heading"><h3>Geometry versions</h3><span>{editing.geometryVersions.length}</span></div>
    {version ? <div className="geometry-comparison"><strong>{formatOperation(version.operation)}</strong><span>Vertices {version.before.vertexCount} → {version.after.vertexCount}</span><span>Triangles {version.before.triangleCount} → {version.after.triangleCount}</span><span>Boundaries {version.before.boundaryEdgeCount} → {version.after.boundaryEdgeCount}</span><span>Non-manifold {version.before.nonManifoldEdgeCount} → {version.after.nonManifoldEdgeCount}</span><span>Self-intersections {version.before.selfIntersectionCount} → {version.after.selfIntersectionCount}</span><span>Shells {version.before.shellCount} → {version.after.shellCount}</span><span>Area {version.before.surfaceAreaMm2.toFixed(3)} → {version.after.surfaceAreaMm2.toFixed(3)} mm²</span><span>Volume {formatVolume(version.before.volumeMm3)} → {formatVolume(version.after.volumeMm3)}</span><span>Bounds {formatVector(version.before.boundingDimensionsMm)} → {formatVector(version.after.boundingDimensionsMm)} mm</span><span>Watertight {String(version.before.watertight)} → {String(version.after.watertight)}</span>{version.beforeQuality && version.afterQuality && <><span>Minimum angle {version.beforeQuality.minimumAngleDegrees.toFixed(3)}° → {version.afterQuality.minimumAngleDegrees.toFixed(3)}°</span><span>Worst aspect {version.beforeQuality.worstAspectRatio.toFixed(3)} → {version.afterQuality.worstAspectRatio.toFixed(3)}</span><span>Low-quality triangles {version.beforeQuality.belowQualityThresholdCount} → {version.afterQuality.belowQualityThresholdCount}</span></>}<code>{version.derivedArtifactId}</code></div> : <p>No derived geometry versions yet.</p>}
    <p className="editing-shortcuts">Esc cancel · Enter confirm preview · 1/2/3/4 object/vertex/edge/face · G move · R rotate · S scale · Delete selected faces</p>
  </section>;
});

function geometryExecutor(definition: ToolDefinition, worker: EditingWorkerClient): ToolExecutor<EditingContext, GeometryOperationOutput> {
  return {
    definition,
    validate(context) { validateRequirement(definition, context); const curve = context.editing.curves.find((value) => value.id === context.activeCurveId) ?? context.editing.curves[0]; if (definition.id === 'cut.trim-curve' && !curve?.closed) throw new Error('Trim by closed curve requires a closed model-space curve.'); },
    async preview(context, parameters, signal, progress) {
      const selection = context.editing.componentSelections.find((value) => value.objectId === context.selectedObjects[0]?.id);
      const curve = context.editing.curves.find((value) => value.id === context.activeCurveId) ?? context.editing.curves[0];
      const meshes = operationMeshes(context, definition); let selectionIds = selection?.ids ?? []; let secondarySelectionIds = selection?.ids.slice(1);
      if (definition.id === 'mesh.bridge-loops') [selectionIds, secondarySelectionIds] = bridgeLoopSelections(meshes[0], selectionIds);
      const request: EditingOperationRequest = {
        requestId: crypto.randomUUID(), toolId: definition.id,
        meshes, selectionIds, secondarySelectionIds, parameters,
        ...(curve && context.selectedObjects[0] ? { curvePoints: curvePointsForObject(curve, context, context.selectedObjects[0]), curveClosed: curve.closed } : {}), ...(context.selectedObjects[0] ? { transform: context.selectedObjects[0].transform } : {}),
      };
      return (await worker.execute(request, { signal, progress })).output;
    },
    createCommand(context, output, parameters) {
      const object = context.selectedObjects[0]; if (!object) throw new Error('Select an object before confirming geometry.');
      return new GeometryEditCommand({ scene: context.sceneManager, artifacts: context.artifactManager, editing: context.editingManager }, object.id, definition.id, output, {
        allowBoundaries: operationIntentionallyOpens(definition.id, parameters),
        allowDisconnected: operationIntentionallySeparates(definition.id),
        replaceSource: definition.id !== 'transform.duplicate',
        additionalNames: output.additionalMeshes?.map((_, index) => `${object.name} ${definition.label} part ${index + 2}`),
        consumeObjectIds: definition.id === 'mesh.join' ? context.selectedObjects.slice(1).map((value) => value.id) : undefined,
        toolParameters: parameters,
        sceneObjectPatch: definition.id === 'transform.bake' ? { transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } } : undefined,
        transformAssociatedPoints: definition.id === 'transform.bake',
        preserveComponentIds: TOPOLOGY_STABLE_OPERATIONS.has(definition.id),
      });
    },
    cancel(context) { context.renderer?.setScene(context.scene, context.artifacts); },
  };
}

function validateRequirement(definition: ToolDefinition, context: EditingContext): void {
  const selected = context.selectedObjects; const component = context.editing.componentSelections.find((value) => value.objectId === selected[0]?.id);
  if (definition.selection === 'object' && selected.length < 1) throw new Error(`${definition.label} requires one selected object.`);
  if (definition.selection === 'objects:2' && selected.length !== 2) throw new Error(`${definition.label} requires exactly two selected objects.`);
  if (definition.selection === 'curve' && !context.editing.curves.length) throw new Error(`${definition.label} requires a model-space curve.`);
  if (['vertex', 'edge', 'face', 'faces', 'boundary-loop'].includes(definition.selection) && (!component || !component.ids.length)) throw new Error(`${definition.label} requires a compatible component selection.`);
  if (definition.selection === 'boundary-loop' && component?.kind !== 'edge') throw new Error(`${definition.label} requires boundary-edge selection.`);
  if (definition.selection === 'face' && component?.kind !== 'face' || definition.selection === 'faces' && component?.kind !== 'face') throw new Error(`${definition.label} requires selected faces.`);
  if (selected.some((object) => object.locked)) throw new Error(`Locked object ${selected.find((object) => object.locked)!.name} rejects geometry changes.`);
}

function buildEditingOverlays(editing: EditingProjectState, scene: SceneObject[], artifacts: ArtifactRecord[]): ViewerOverlay[] {
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact])); const objectMap = new Map(scene.map((object) => [object.id, object])); const overlays: ViewerOverlay[] = [];
  for (const selection of editing.componentSelections) {
    const object = objectMap.get(selection.objectId); const artifact = artifactMap.get(selection.artifactId); if (!object || !artifact || selection.kind === 'object') continue; const mesh = indexedMesh(artifact.mesh); const topology = buildTopology(mesh); const points: Vec3[] = [];
    if (selection.kind === 'vertex') for (const id of selection.ids) if (mesh.positions[id]) points.push(transformPoint(mesh.positions[id], object));
    if (selection.kind === 'edge') for (const id of selection.ids) { const edge = topology.edges[id]; if (edge) points.push(transformPoint(mesh.positions[edge[0]], object), transformPoint(mesh.positions[edge[1]], object)); }
    if (selection.kind === 'face') for (const id of selection.ids) { const face = mesh.faces[id]; if (face) points.push(...face.map((vertex) => transformPoint(mesh.positions[vertex], object))); }
    const bounds = boundsOfPoints(points); if (bounds) overlays.push({ id: `editing-selection-${object.id}`, checkId: 'component-selection', primitive: selection.kind === 'vertex' ? 'points' : selection.kind === 'edge' ? 'lines' : 'triangles', positions: points.flat(), color: [1, 0.45, 0.08, 0.82], elementCount: selection.ids.length, bounds, visible: true, label: `${selection.ids.length} ${selection.kind}` });
  }
  for (const curve of editing.curves.filter((value) => value.visible && value.sampledPoints.length > 1)) { const associated = curve.objectId ? objectMap.get(curve.objectId) : undefined; const points = associated ? curve.sampledPoints.map((point) => transformPoint(point, associated)) : curve.sampledPoints; const segments = points.flatMap((point, index) => index ? [...points[index - 1], ...point] : []); if (curve.closed) segments.push(...points.at(-1)!, ...points[0]); const bounds = boundsOfPoints(points); if (bounds) overlays.push({ id: `editing-curve-${curve.id}`, checkId: 'surface-curve', primitive: 'lines', positions: segments, color: [0.15, 0.95, 0.88, 1], elementCount: Math.max(0, points.length - 1 + Number(curve.closed)), bounds, visible: true, label: curve.name }); }
  return overlays;
}

function buildCurvePlacementOverlays(kind: 'polyline' | 'spline' | 'surface-projected' | null, controlPoints: Vec3[], object?: SceneObject): ViewerOverlay[] {
  if (!kind || !controlPoints.length || !object) return [];
  let sampled = controlPoints;
  if (kind === 'spline' && controlPoints.length >= 3) sampled = createSpline('Live spline preview', controlPoints).sampledPoints;
  const worldControls = controlPoints.map((point) => transformPoint(point, object)); const worldSampled = sampled.map((point) => transformPoint(point, object)); const bounds = boundsOfPoints(worldSampled);
  if (!bounds) return [];
  const overlays: ViewerOverlay[] = [{ id: 'editing-curve-placement-anchors', checkId: 'curve-live-preview', primitive: 'points', positions: worldControls.flat(), color: [1, 0.72, 0.12, 1], elementCount: worldControls.length, bounds, visible: true, label: `${kind} control points` }];
  if (worldSampled.length > 1) overlays.push({ id: 'editing-curve-placement-line', checkId: 'curve-live-preview', primitive: 'lines', positions: worldSampled.flatMap((point, index) => index ? [...worldSampled[index - 1], ...point] : []), color: [0.15, 0.95, 0.88, 1], elementCount: worldSampled.length - 1, bounds, visible: true, label: `${kind} live preview` });
  return overlays;
}

function defaultParameters(definition: ToolDefinition): Record<string, number | string | boolean> { return Object.fromEntries(definition.parameters.map((parameter) => [parameter.id, parameter.defaultValue])); }
function values(parameters: Record<string, number | string | boolean>, prefix = '', defaults: Vec3 = [0, 0, 0]): Vec3 { return ['x', 'y', 'z'].map((axis, index) => numberValue(parameters[`${prefix}${prefix ? '-' : ''}${axis}`], defaults[index])) as Vec3; }
function numberValue(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
function rectanglePolygon(first: { x: number; y: number }, second: { x: number; y: number }) { return [{ x: first.x, y: first.y }, { x: second.x, y: first.y }, { x: second.x, y: second.y }, { x: first.x, y: second.y }]; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
async function execute(operation: Promise<void>, status: (value: string) => void, success: string) { try { await operation; status(success); } catch (error) { status(message(error)); } }
function formatVolume(value: number | null): string { return value === null ? 'not closed' : `${value.toFixed(3)} mm³`; }
function componentSelectionSummary(selections: EditingProjectState['componentSelections'], mode: ComponentSelectionMode): string { const count = selections.reduce((sum, selection) => sum + selection.ids.length, 0); const kinds = new Set(selections.map((selection) => selection.kind)); const kind = kinds.size === 1 ? selections[0]?.kind : undefined; return `${count} ${kind ? `${kind}${count === 1 ? '' : 's'}` : count === 1 ? 'element' : 'elements'} selected · ${mode}`; }
function formatOperation(value: string): string { return value.split(/[.-]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' '); }
function formatVector(value: readonly number[]): string { return value.map((item) => Number(item).toFixed(6)).join(', '); }

function operationMeshes(context: EditingContext, definition: ToolDefinition): ArtifactRecord['mesh'][] {
  const primary = context.selectedObjects[0]; if (!primary) throw new Error(`${definition.label} requires source geometry.`);
  return context.selectedObjects.map((object, index) => {
    const artifact = context.artifacts.find((value) => value.id === object.artifactId); if (!artifact) throw new Error(`Artifact ${object.artifactId} is unavailable.`);
    if (definition.selection !== 'objects:2' || index === 0) return structuredClone(artifact.mesh);
    const source = indexedMesh(artifact.mesh); const determinant = object.transform.scale.reduce((product, value) => product * value, 1) / primary.transform.scale.reduce((product, value) => product * value, 1);
    return meshData({ positions: source.positions.map((point) => inverseTransformPoint(transformPoint(point, object), primary)), faces: source.faces.map(([a, b, c]) => determinant < 0 ? [a, c, b] : [a, b, c]) });
  });
}

function curvePointsForObject(curve: SurfaceCurve, context: EditingContext, target: SceneObject): Vec3[] {
  const source = curve.objectId ? context.scene.find((object) => object.id === curve.objectId) : undefined;
  return curve.sampledPoints.map((point) => inverseTransformPoint(source ? transformPoint(point, source) : point, target));
}

function bridgeLoopSelections(meshValue: ArtifactRecord['mesh'] | undefined, selectedEdgeIds: number[]): [number[], number[]] {
  if (!meshValue) throw new Error('Bridge boundary loops requires source geometry.');
  const mesh = indexedMesh(meshValue); const topology = buildTopology(mesh); const byKey = new Map(topology.edges.map((edge, id) => [edgeKey(...edge), id])); const selected = new Set(selectedEdgeIds);
  const seeds = boundaryLoops(mesh, topology).flatMap((loop) => { const ids = loop.flatMap((vertex, index) => { const id = byKey.get(edgeKey(vertex, loop[(index + 1) % loop.length])); return id === undefined ? [] : [id]; }); const seed = ids.find((id) => selected.has(id)); return seed === undefined ? [] : [seed]; });
  if (seeds.length < 2) throw new Error('Bridge boundary loops requires edges from two distinct boundary loops.');
  return [[seeds[0]], [seeds[1]]];
}

function operationIntentionallyOpens(id: string, parameters: Record<string, number | string | boolean>): boolean {
  return ['mesh.delete-faces', 'mesh.detach-region', 'mesh.separate-shell', 'cut.trim-curve'].includes(id) || id.startsWith('cut.') && parameters.cap === false;
}

function operationIntentionallySeparates(id: string): boolean { return ['mesh.detach-region', 'mesh.separate-shell', 'mesh.join', 'cut.split', 'boolean.union', 'boolean.difference'].includes(id); }
