import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { ArtifactManager, SceneManager, type ArtifactRecord, type SceneObject, type Vec3 } from '../src/core';
import { artifactFromMesh } from './golden-geometry';
import { buildTopology, meshData } from '../src/editing-geometry';
import { cube } from './golden-editing';
import {
  ComponentSelectionEngine,
  growSelection,
  growComponentSelection,
  invertSelection,
  paintSelect,
  screenSelect,
  selectBoundaryLoop,
  selectByNormalAngle,
  selectByGeometricConnectivity,
  selectEdgeLoop,
  selectEdgeRing,
  selectionFromSurfaceHit,
  shrinkSelection,
  shrinkComponentSelection,
} from '../src/component-selection';
import { indexedMesh } from '../src/editing-geometry';
import {
  alignObjects,
  alignToAxis,
  alignToPlane,
  applyNumericTransform,
  bakeTransform,
  centerObjectToOrigin,
  mirrorGeometry,
  resetTransform,
  snappedNumericTransform,
  surfaceSnapObject,
  uniformScale,
} from '../src/transform-tools';
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
} from '../src/curve-tools';
import { inverseTransformPoint, transformPoint } from '../src/geometry';

describe('actual indexed component selection', () => {
  const { artifact, object } = fixture(); const mesh = indexedMesh(artifact.mesh);
  for (const mode of ['vertex', 'edge', 'face', 'connected-region', 'shell', 'normal-angle', 'connectivity'] as const) {
    it(`selects real ${mode} elements`, () => {
      const result = selectionFromSurfaceHit(artifact, object, 0, [1, 1, 0], mode, 45);
      expect(result.ids.length).toBeGreaterThan(0); expect(result.artifactId).toBe(artifact.id);
      const limit = result.kind === 'vertex' ? mesh.positions.length : result.kind === 'edge' ? 18 : mesh.faces.length;
      expect(result.ids.every((id) => id >= 0 && id < limit)).toBe(true);
    });
  }
  it('traverses boundary, edge-loop and edge-ring topology', () => {
    const openArtifact = artifactFromMesh('open-cube', meshData({ ...cube(), faces: cube().faces.slice(2) })); const openObject = sceneObject(openArtifact);
    const topology = indexedMesh(openArtifact.mesh); const openTopology = buildTopology(topology); const boundaryEdge = openTopology.boundaryEdges[0]; const boundary = selectBoundaryLoop(topology, boundaryEdge);
    expect(boundary.length).toBeGreaterThan(1); expect(selectEdgeLoop(mesh, 0).length).toBeGreaterThan(1); expect(selectEdgeRing(mesh, 0).length).toBeGreaterThan(1);
    const [a, b] = openTopology.edges[boundaryEdge]; const point = topology.positions[a].map((value, axis) => (value + topology.positions[b][axis]) / 2) as Vec3; const face = openTopology.edgeFaces[boundaryEdge][0];
    expect(selectionFromSurfaceHit(openArtifact, openObject, face, point, 'boundary-loop').ids.length).toBeGreaterThan(1);
  });
  it('paints, lasso-selects and rectangle-selects actual faces', () => {
    expect(paintSelect(artifact, object, [[5, 5, 0]], 8).ids.length).toBeGreaterThan(0);
    const projector = { projectWorld: (point: Vec3) => ({ x: point[0], y: point[1], visible: true }) };
    const polygon = [{ x: -1, y: -1 }, { x: 11, y: -1 }, { x: 11, y: 11 }, { x: -1, y: 11 }];
    expect(screenSelect(artifact, object, polygon, projector, 'lasso').ids.length).toBeGreaterThan(0);
    expect(screenSelect(artifact, object, polygon, projector, 'rectangle').ids.length).toBeGreaterThan(0);
    const translated = { ...object, transform: { ...object.transform, position: [100, 0, 0] as Vec3 } }; const translatedPolygon = polygon.map((point) => ({ x: point.x + 100, y: point.y })); expect(screenSelect(artifact, translated, translatedPolygon, projector, 'rectangle').ids.length).toBeGreaterThan(0);
  });
  it('grows, shrinks, inverts and selects by normal angle/connectivity', () => {
    const grown = growSelection(mesh, [0], 1); expect(grown.length).toBeGreaterThan(1);
    expect(shrinkSelection(mesh, grown, 1).length < grown.length).toBe(true);
    expect(invertSelection(mesh, 'face', [0]).length).toBe(mesh.faces.length - 1);
    expect(selectByNormalAngle(mesh, 0, 1)).toHaveLength(2);
    const grownVertices = growComponentSelection(mesh, 'vertex', [0], 1); expect(grownVertices.length).toBeGreaterThan(1); expect(growComponentSelection(mesh, 'edge', [0], 1).length).toBeGreaterThan(1); expect(shrinkComponentSelection(mesh, 'vertex', grownVertices, 1).length < grownVertices.length).toBe(true);
  });
  it('selects geometric connectivity across coincident but independently indexed vertices', () => { const unwelded = { positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] as Vec3[], faces: [[0, 1, 2], [3, 4, 5]] as Array<[number, number, number]> }; expect(buildTopology(unwelded).shells).toHaveLength(2); expect(selectByGeometricConnectivity(unwelded, 0)).toEqual([0, 1]); });
  it('persists additive component sets through the selection engine', () => {
    const engine = new ComponentSelectionEngine(); const first = selectionFromSurfaceHit(artifact, object, 0, [0, 0, 0], 'face'); const second = { ...first, ids: [1] };
    engine.set(first); engine.set(second, true); expect(engine.get(object.id)?.ids).toEqual([0, 1]); const snapshot = engine.list(); engine.clear(); engine.replace(snapshot); expect(engine.list()).toEqual(snapshot);
  });
  it('returns identical indexed selection results when the complete selection corpus is repeated', () => { const run = () => ({ hits: (['vertex', 'edge', 'face', 'connected-region', 'shell', 'normal-angle', 'connectivity'] as const).map((mode) => selectionFromSurfaceHit(artifact, object, 0, [1, 1, 0], mode, 45).ids), paint: paintSelect(artifact, object, [[5, 5, 0]], 8).ids, grow: growSelection(mesh, [0], 2), shrink: shrinkSelection(mesh, growSelection(mesh, [0], 2), 1), invert: invertSelection(mesh, 'face', [0, 1]) }); expect(run()).toEqual(run()); });
});

describe('precision transforms operate in model coordinates', () => {
  const { artifact, object } = fixture();
  it('moves, rotates and scales with exact numeric reporting', () => { const result = applyNumericTransform(object, { translation: [1, 2, 3], rotationDegrees: [0, 0, 90], scale: [2, 1, 1], pivot: [0, 0, 0], coordinateMode: 'global' }); expect(result.after.position).toEqual([1, 2, 3]); expect(result.after.scale).toEqual([2, 1, 1]); expect(result.rotationDegrees).toEqual([0, 0, 90]); });
  it('supports uniform scale and translation/angular snapping', () => { expect(uniformScale(object, 2, [0, 0, 0]).after.scale).toEqual([2, 2, 2]); const snapped = snappedNumericTransform({ translation: [0.24, 0.26, 0], rotationDegrees: [4, 8, 12], scale: [1, 1, 1], pivot: [0, 0, 0], coordinateMode: 'global' }, 0.5, 5); expect(snapped.translation).toEqual([0, 0.5, 0]); expect(snapped.rotationDegrees).toEqual([5, 10, 10]); });
  it('scales the object origin around a custom pivot in global and local coordinates', () => { const translated = { ...object, transform: { ...object.transform, position: [10, 0, 0] as Vec3 } }; const global = applyNumericTransform(translated, { translation: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [2, 1, 1], pivot: [0, 0, 0], coordinateMode: 'global' }); expect(global.after.position).toEqual([20, 0, 0]); const rotated = { ...translated, transform: { ...translated.transform, rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] as [number, number, number, number] } }; const local = applyNumericTransform(rotated, { translation: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [2, 1, 1], pivot: [0, 0, 0], coordinateMode: 'local' }); expect(local.after.position.map((value) => Number(value.toFixed(9)))).toEqual([10, 0, 0]); });
  it('aligns objects, axes and planes and centers geometry', () => { const target = { ...object, id: 'target', transform: { ...object.transform, position: [20, 0, 0] as Vec3 } }; expect(alignObjects(object, artifact, target, artifact).after.position[0]).toBe(20); expect(alignToAxis(object, [0, 0, 1], [1, 0, 0], [0, 0, 0]).after.rotation).not.toEqual(object.transform.rotation); const plane = alignToPlane(object, [0, 0, 1], [0, 1, 0], [0, 0, 0], [4, 5, 6]); expect(plane.after.rotation).not.toEqual(object.transform.rotation); expect(plane.after.position).toEqual([4, 5, 6]); expect(centerObjectToOrigin(object, artifact).after.position).toEqual([-5, -5, -5]); });
  it('surface-snaps the actual moving mesh surface to the closest target surface', () => { const target = { ...object, id: 'target' }; const moving = { ...object, transform: { ...object.transform, position: [0, 0, 20] as Vec3 } }; const result = surfaceSnapObject(moving, artifact, target, artifact); expect(result.after.position[2]).toBe(10); });
  it('mirrors, bakes, resets, and duplicates actual geometry', () => { const mirrored = mirrorGeometry(artifact, [0, 0, 0], [1, 0, 0]); expect(mirrored.positions[1][0]).toBe(-10); const transformed = { ...object, transform: { position: [1, 2, 3] as Vec3, rotation: [0, 0, 0, 1] as [number, number, number, number], scale: [2, 2, 2] as Vec3 } }; expect(bakeTransform(artifact, transformed).positions[1]).toEqual([21, 2, 3]); expect(resetTransform(transformed).after.position).toEqual([0, 0, 0]); });
  it('round-trips exact points between source-model and project coordinates', () => { const transformed = { ...object, transform: { position: [11, -3, 7] as Vec3, rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] as [number, number, number, number], scale: [2, 3, 4] as Vec3 } }; const local: Vec3 = [2, 4, 6]; const project = transformPoint(local, transformed); const restored = inverseTransformPoint(project, transformed); expect(restored.map((value) => Number(value.toFixed(9)))).toEqual(local); });
  it('returns identical numeric geometry transforms when the transform corpus is repeated', () => { const target = { ...object, id: 'target', transform: { ...object.transform, position: [20, 0, 0] as Vec3 } }; const run = () => [applyNumericTransform(object, { translation: [1, 2, 3], rotationDegrees: [10, 20, 30], scale: [1.2, 0.8, 1.1], pivot: [4, 5, 6], coordinateMode: 'global' }).after, uniformScale(object, 2, [1, 1, 1]).after, alignObjects(object, artifact, target, artifact).after, alignToAxis(object, [0, 0, 1], [1, 0, 0], [0, 0, 0]).after, alignToPlane(object, [0, 0, 1], [0, 1, 0], [0, 0, 0], [1, 2, 3]).after, centerObjectToOrigin(object, artifact).after, surfaceSnapObject({ ...object, transform: { ...object.transform, position: [0, 0, 20] } }, artifact, target, artifact).after, resetTransform(target).after]; expect(run()).toEqual(run()); });
});

describe('model-space curve engine', () => {
  const { artifact, object } = fixture(); const points: Vec3[] = [[0, 0, 12], [5, 2, 12], [10, 0, 12], [15, 2, 12]];
  it('creates polylines, splines and surface-projected curves', () => { expect(createPolyline('Line', points).sampledPoints).toHaveLength(4); expect(createSpline('Spline', points).sampledPoints.length).toBeGreaterThan(points.length); const projected = createSurfaceProjectedCurve('Projected', points.slice(0, 3), artifact, object); expect(projected.controlPoints.every((point) => point[2] <= 10)).toBe(true); });
  it('adds, edits and removes control points', () => { let curve = createPolyline('Line', points); curve = addControlPoint(curve, [7, 1, 12], 2); expect(curve.controlPoints).toHaveLength(5); curve = editControlPoint(curve, 2, [7, 2, 12]); expect(curve.controlPoints[2]).toEqual([7, 2, 12]); curve = removeControlPoint(curve, 2); expect(curve.controlPoints).toHaveLength(4); });
  it('smooths, simplifies, resamples and offsets actual coordinates', () => { const curve = createPolyline('Line', points); expect(smoothCurve(curve, 2).controlPoints).not.toEqual(curve.controlPoints); expect(simplifyCurve(curve, 0.1).controlPoints.length <= curve.controlPoints.length).toBe(true); expect(resampleCurve(curve, 1).sampledPoints.length).toBeGreaterThan(curve.sampledPoints.length); expect(offsetCurve(curve, 1).controlPoints).not.toEqual(curve.controlPoints); const surface = createSurfaceProjectedCurve('Surface', points.slice(0, 3), artifact, object); expect(offsetCurveOnMesh(surface, 1, artifact).controlPoints).not.toEqual(surface.controlPoints); });
  it('extends, trims, splits and joins curves', () => { const curve = createPolyline('Line', points); const extended = extendCurve(curve, 2); expect(extended.controlPoints[0]).not.toEqual(curve.controlPoints[0]); const trimmed = trimCurve(extended, 1, 10); expect(trimmed.controlPoints.length).toBeGreaterThan(1); expect(trimmed.controlPoints.reduce((sum, point, index) => index ? sum + Math.hypot(point[0] - trimmed.controlPoints[index - 1][0], point[1] - trimmed.controlPoints[index - 1][1], point[2] - trimmed.controlPoints[index - 1][2]) : sum, 0)).toBeCloseTo(9, 6); const [first, second] = splitCurve(curve, 2); const joined = joinCurves(first, second, 0.001); expect(joined.controlPoints.length).toBeGreaterThanOrEqual(curve.controlPoints.length - 1); });
  it('reverses, opens/closes and projects an existing curve', () => { const curve = createPolyline('Line', points); expect(reverseCurve(curve).controlPoints[0]).toEqual(points.at(-1)); expect(setCurveClosed(curve, true).closed).toBe(true); expect(setCurveClosed(setCurveClosed(curve, true), false).closed).toBe(false); const closedSpline = setCurveClosed(createSpline('Closed spline', points), true); expect(closedSpline.sampledPoints[0]).toEqual(closedSpline.sampledPoints.at(-1)); expect(projectCurveToMesh(curve, artifact, object).kind).toBe('surface-projected'); });
  it('returns identical model coordinates when the complete curve-operation corpus is repeated', () => { const run = () => { const base = createPolyline('Line', points); const added = addControlPoint(base, [7, 1, 12], 2); const [first, second] = splitCurve(base, 2); return [createSpline('Spline', points).sampledPoints, createSurfaceProjectedCurve('Projected', points.slice(0, 3), artifact, object).controlPoints, editControlPoint(added, 2, [7, 2, 12]).controlPoints, removeControlPoint(added, 2).controlPoints, smoothCurve(base, 2).controlPoints, simplifyCurve(base, 0.1).controlPoints, resampleCurve(base, 1).controlPoints, offsetCurveOnMesh(createSurfaceProjectedCurve('Surface', points.slice(0, 3), artifact, object), 1, artifact).controlPoints, extendCurve(base, 2).controlPoints, trimCurve(extendCurve(base, 2), 1, 10).controlPoints, first.controlPoints, second.controlPoints, joinCurves(first, second, 0.001).controlPoints, reverseCurve(base).controlPoints, setCurveClosed(base, true).sampledPoints, projectCurveToMesh(base, artifact, object).controlPoints]; }; expect(run()).toEqual(run()); });
});

function fixture(): { artifact: ArtifactRecord; object: SceneObject } { const artifact = artifactFromMesh('editing-cube', meshData(cube())); return { artifact, object: sceneObject(artifact) }; }
function sceneObject(artifact: ArtifactRecord): SceneObject { const scene = new SceneManager(); return scene.addFromArtifact(artifact, 'reference'); }
