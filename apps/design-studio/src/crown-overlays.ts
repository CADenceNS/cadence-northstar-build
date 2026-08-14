import type { ArtifactRecord, SceneObject, Vec3 } from './core';
import { indexedMesh } from './editing-geometry';
import { boundsOfPoints, transformPoint } from './geometry';
import type { ViewerOverlay } from './inspection-types';
import type { RestorationRecord, RestorationProjectState, ThicknessSample } from './restoration-types';

const THICKNESS_COLORS: Array<[number, number, number, number]> = [
  [1, 0.05, 0.08, 0.9], [1, 0.45, 0.05, 0.88], [1, 0.85, 0.08, 0.82], [0.1, 0.9, 0.35, 0.78], [0.1, 0.55, 1, 0.75],
];

export function buildCrownOverlays(state: RestorationProjectState, scene: SceneObject[], artifacts: ArtifactRecord[]): ViewerOverlay[] {
  const record = state.restorations.find((value) => value.id === state.activeRestorationId); if (!record?.sceneObjectId || !record.artifactId || !record.topologyMap) return [];
  const object = scene.find((value) => value.id === record.sceneObjectId); const artifact = artifacts.find((value) => value.id === record.artifactId); if (!object || !artifact) return [];
  const mesh = indexedMesh(artifact.mesh); const overlays: ViewerOverlay[] = [];
  if (state.settings.thicknessOverlayVisible && record.thickness) overlays.push(...thicknessOverlays(record, object));
  if (state.settings.contactOverlayVisible) {
    overlays.push(...distanceOverlays('mesial-contact', record.mesialContact?.distanceSamples ?? [], object, [0.15, 0.95, 0.55, 0.9]));
    overlays.push(...distanceOverlays('distal-contact', record.distalContact?.distanceSamples ?? [], object, [0.2, 0.75, 1, 0.9]));
  }
  if (state.settings.occlusionOverlayVisible) overlays.push(...distanceOverlays('static-occlusion', record.occlusion?.distanceSamples ?? [], object, [1, 0.2, 0.65, 0.9]));
  if (state.settings.contourOverlayVisible && record.contour) overlays.push(...vertexOverlays('contour-deviation', [...record.contour.overContouredVertexIds, ...record.contour.underContouredVertexIds], mesh.positions, object, [0.98, 0.45, 0.15, 0.9]));
  if (state.settings.lockOverlayVisible) overlays.push(...vertexOverlays('locked-anatomy', record.lockedAnatomyVertexIds, mesh.positions, object, [0.75, 0.3, 1, 0.9]));
  if (state.settings.maskOverlayVisible) overlays.push(...vertexOverlays('sculpt-mask', record.sculptMaskVertexIds, mesh.positions, object, [0.2, 0.45, 1, 0.9]));
  if (state.settings.optimizerOverlayVisible && record.optimization) {
    const ids = [...new Set([...(record.mesialContact?.distanceSamples ?? []), ...(record.distalContact?.distanceSamples ?? []), ...(record.occlusion?.distanceSamples ?? [])].filter((sample) => Math.abs(sample.distanceMm) <= 0.25).map((sample) => sample.vertexId))];
    overlays.push(...vertexOverlays(`optimizer-${record.optimization.status}`, ids, mesh.positions, object, record.optimization.status === 'constraint-conflict' ? [1, 0.12, 0.12, 0.9] : [0.15, 0.9, 0.55, 0.9]));
  }
  if (state.settings.intaglioVisible) {
    const inner = new Set(record.topologyMap.innerVertexIds); const points = mesh.faces.filter((face) => face.every((vertex) => inner.has(vertex))).flatMap((face) => face.map((vertex) => transformPoint(mesh.positions[vertex], object))); const bounds = boundsOfPoints(points);
    if (bounds) overlays.push({ id: `crown-intaglio-${record.id}`, checkId: 'crown-intaglio', primitive: 'triangles', positions: points.flat(), color: [0.18, 0.85, 1, 0.42], elementCount: points.length / 3, bounds, visible: true, label: 'Actual intaglio surface' });
  }
  return overlays;
}

function thicknessOverlays(record: RestorationRecord, object: SceneObject): ViewerOverlay[] {
  const samples = record.thickness?.samples ?? []; if (!samples.length) return [];
  const ratios = samples.map((sample) => sample.thicknessMm / Math.max(sample.minimumMm, 1e-6)); const minimum = Math.min(...ratios); const maximum = Math.max(...ratios); const range = Math.max(0.1, maximum - minimum);
  return THICKNESS_COLORS.flatMap((color, bucket) => {
    const selected = samples.filter((sample, index) => Math.min(THICKNESS_COLORS.length - 1, Math.floor((ratios[index] - minimum) / range * THICKNESS_COLORS.length)) === bucket); const points = selected.map((sample) => transformPoint(sample.position, object)); const bounds = boundsOfPoints(points); if (!bounds) return [];
    return [{ id: `crown-thickness-${record.id}-${bucket}`, checkId: 'crown-thickness', primitive: 'points' as const, positions: points.flat(), color, elementCount: points.length, bounds, visible: true, label: thicknessLabel(selected) }];
  });
}

function thicknessLabel(samples: ThicknessSample[]): string { const values = samples.map((sample) => sample.thicknessMm); return `Thickness ${Math.min(...values).toFixed(3)}–${Math.max(...values).toFixed(3)} mm`; }

function distanceOverlays(prefix: string, samples: Array<{ vertexId: number; position: Vec3; distanceMm: number; inside: boolean }>, object: SceneObject, color: [number, number, number, number]): ViewerOverlay[] {
  const selected = samples.filter((sample) => sample.inside || sample.distanceMm <= 0.2); const points = selected.map((sample) => transformPoint(sample.position, object)); const bounds = boundsOfPoints(points); if (!bounds) return [];
  const minimum = Math.min(...selected.map((sample) => sample.distanceMm)); return [{ id: `${prefix}-${object.id}`, checkId: prefix, primitive: 'points', positions: points.flat(), color, elementCount: points.length, bounds, visible: true, label: `${prefix.replaceAll('-', ' ')} · min ${minimum.toFixed(3)} mm` }];
}

function vertexOverlays(prefix: string, vertexIds: number[], positions: Vec3[], object: SceneObject, color: [number, number, number, number]): ViewerOverlay[] {
  const points = [...new Set(vertexIds)].flatMap((id) => positions[id] ? [transformPoint(positions[id], object)] : []); const bounds = boundsOfPoints(points); if (!bounds) return [];
  return [{ id: `${prefix}-${object.id}`, checkId: prefix, primitive: 'points', positions: points.flat(), color, elementCount: points.length, bounds, visible: true, label: `${prefix.replaceAll('-', ' ')} · ${points.length} vertices` }];
}
