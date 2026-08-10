import type { MeshData, Transform, Vec3 } from './core';
import { booleanMesh } from './boolean-tools';
import { curveBasedCut, planeCut, splitMesh, trimByClosedCurve } from './cutting-tools';
import { boundaryLoops, buildTopology, cloneIndexed, indexedMesh, inspectGeometry, meshData, validateGeometryResult, type IndexedMesh } from './editing-geometry';
import type { GeometryOperationOutput, ToolProgress, TriangleQualityReport } from './editing-types';
import {
  bridgeBoundaryLoops,
  deleteSelectedFaces,
  detachSelectedRegion,
  extrudeFaces,
  fillBoundaryHole,
  flattenRegion,
  insetFaces,
  joinMeshes,
  offsetSurfaceRegion,
  recalculateNormals,
  relaxRegion,
  removeDuplicateFaces,
  removeDuplicateVertices,
  removeIsolatedComponents,
  reverseNormals,
  separateConnectedShell,
  smoothRegion,
  thickenMesh,
  weldVertices,
} from './mesh-edit-tools';
import { adaptiveSubdivision, decimate, isotropicRemesh, localRemesh, smoothTopology, subdivide, triangleQuality } from './topology-tools';
import { add3, dot3, scale3, subtract3 } from './geometry';
import { quaternionFromEuler, rotateVector } from './transform-tools';

export interface EditingOperationRequest {
  requestId: string;
  toolId: string;
  meshes: MeshData[];
  selectionIds: number[];
  secondarySelectionIds?: number[];
  parameters: Record<string, number | string | boolean>;
  curvePoints?: Vec3[];
  transform?: Transform;
}

export interface EditingOperationResponse { requestId: string; output: GeometryOperationOutput; durationMs: number; quality: TriangleQualityReport; }
export interface EditingExecutionHooks { signal?: AbortSignal; progress?: (value: ToolProgress) => void; yieldControl?: () => Promise<void>; }

export async function executeEditingOperation(request: EditingOperationRequest, hooks: EditingExecutionHooks = {}): Promise<EditingOperationResponse> {
  const started = performance.now(); const progress = hooks.progress ?? (() => undefined); const yieldControl = hooks.yieldControl ?? (() => Promise.resolve());
  assertActive(hooks.signal); progress({ phase: 'prepare', completed: 0, total: 4, message: 'Validating indexed geometry' });
  if (!request.meshes.length) throw new Error(`${request.toolId} requires source geometry.`);
  const meshes = request.meshes.map(indexedMesh); await yieldControl(); assertActive(hooks.signal);
  progress({ phase: 'execute', completed: 1, total: 4, message: `Executing ${request.toolId}` });
  const result = dispatch(request, meshes); await yieldControl(); assertActive(hooks.signal);
  progress({ phase: 'inspect', completed: 2, total: 4, message: 'Inspecting topology and self-intersections' });
  const before = inspectGeometry(meshes[0]); const policy = operationPolicy(request.toolId, request.parameters, before);
  const inspection = validateGeometryResult(result.primary, policy); const additionalInspections = result.additional.map((additional) => validateGeometryResult(additional, policy));
  const intentionallyOpens = ['mesh.delete-faces', 'mesh.detach-region', 'mesh.separate-shell', 'cut.trim-curve'].includes(request.toolId) || request.toolId.startsWith('cut.') && !bool(request.parameters, 'cap', false);
  const intentionallySeparates = ['mesh.detach-region', 'mesh.separate-shell', 'mesh.join', 'cut.split', 'boolean.union', 'boolean.difference'].includes(request.toolId);
  const beforeBoundaryComponents = boundaryLoops(meshes[0], buildTopology(meshes[0])).length; const afterBoundaryComponents = boundaryLoops(result.primary, buildTopology(result.primary)).length;
  if (!intentionallyOpens && afterBoundaryComponents > beforeBoundaryComponents) throw new Error(`${request.toolId} introduced ${afterBoundaryComponents - beforeBoundaryComponents} unintended open boundary component${afterBoundaryComponents - beforeBoundaryComponents === 1 ? '' : 's'}.`);
  if (!intentionallySeparates && inspection.shellCount > before.shellCount) throw new Error(`${request.toolId} introduced ${inspection.shellCount - before.shellCount} unintended disconnected components.`);
  await yieldControl(); assertActive(hooks.signal);
  const beforeQuality = triangleQuality(meshes[0]); const quality = triangleQuality(result.primary); const additionalQualities = result.additional.map(triangleQuality);
  const output: GeometryOperationOutput = { mesh: meshData(result.primary), additionalMeshes: result.additional.map(meshData), beforeInspection: before, inspection, additionalInspections, beforeQuality, quality, additionalQualities, bounds: meshData(result.primary).bounds, warnings: result.warnings };
  progress({ phase: 'complete', completed: 4, total: 4, message: 'Geometry result ready for command confirmation' });
  return { requestId: request.requestId, output, durationMs: performance.now() - started, quality };
}

function dispatch(request: EditingOperationRequest, meshes: IndexedMesh[]): { primary: IndexedMesh; additional: IndexedMesh[]; warnings: string[] } {
  const source = meshes[0]; const ids = request.selectionIds; const p = request.parameters;
  const one = (primary: IndexedMesh, warnings: string[] = []) => ({ primary, additional: [] as IndexedMesh[], warnings });
  switch (request.toolId) {
    case 'transform.mirror': return one(reflect(source, vector(p, 'origin'), vector(p, 'normal', [0, 0, 1])));
    case 'transform.duplicate': return one(cloneIndexed(source));
    case 'transform.bake': return one(bake(source, requiredTransform(request.transform)));
    case 'mesh.delete-faces': return one(deleteSelectedFaces(source, ids), ['Open boundaries created by face deletion are reported in the after-operation inspection.']);
    case 'mesh.detach-region': { const value = detachSelectedRegion(source, ids); return { ...value, warnings: ['Detached geometry is stored as a separate derived artifact.'] }; }
    case 'mesh.separate-shell': { const value = separateConnectedShell(source, requiredId(ids, 'shell seed face')); return { ...value, warnings: [] }; }
    case 'mesh.join': return one(joinMeshes(meshes, num(p, 'tolerance', 0.001)));
    case 'mesh.weld': return one(weldVertices(source, num(p, 'tolerance', 0.001)));
    case 'mesh.remove-duplicate-vertices': return one(removeDuplicateVertices(source, num(p, 'tolerance', 0.001)));
    case 'mesh.remove-duplicate-faces': return one(removeDuplicateFaces(source));
    case 'mesh.fill-hole': return one(fillBoundaryHole(source, ids[0]));
    case 'mesh.bridge-loops': return one(bridgeBoundaryLoops(source, requiredId(ids, 'first boundary edge'), requiredId(request.secondarySelectionIds ?? ids.slice(1), 'second boundary edge')));
    case 'mesh.extrude': return one(extrudeFaces(source, ids, num(p, 'distance', 1)));
    case 'mesh.inset': return one(insetFaces(source, ids, num(p, 'distance', 0.2)));
    case 'mesh.offset-region': return one(offsetSurfaceRegion(source, ids, num(p, 'distance', 0.2)));
    case 'mesh.thicken': return one(thickenMesh(source, num(p, 'thickness', 1)));
    case 'mesh.flatten': return one(flattenRegion(source, ids));
    case 'mesh.smooth': return one(smoothRegion(source, ids, integer(p, 'iterations', 2), num(p, 'strength', 35) / 100, true));
    case 'mesh.relax': return one(relaxRegion(source, ids, integer(p, 'iterations', 2), true));
    case 'mesh.recalculate-normals': return one(recalculateNormals(source));
    case 'mesh.reverse-normals': return one(reverseNormals(source, ids.length ? ids : undefined));
    case 'mesh.remove-islands': return one(removeIsolatedComponents(source, num(p, 'minimumArea', 1)));
    case 'cut.plane': { const value = planeCut(source, { origin: vector(p, 'origin'), normal: vector(p, 'normal', [0, 0, 1]) }, { keep: keep(p), cap: bool(p, 'cap', true) }); return { primary: value.primary, additional: value.secondary ? [value.secondary] : [], warnings: value.intersectionLoops.length ? [] : ['The cut produced no closed intersection loop.'] }; }
    case 'cut.curve': { const value = curveBasedCut(source, requiredCurve(request.curvePoints), vector(p, 'extrusion', [0, 0, 1]), keep(p), bool(p, 'cap', true)); return { primary: value.primary, additional: value.secondary ? [value.secondary] : [], warnings: [] }; }
    case 'cut.trim-curve': return one(trimByClosedCurve(source, requiredCurve(request.curvePoints), bool(p, 'inside', true)), ['Trim boundaries remain open unless subsequently filled.']);
    case 'cut.split': { const value = splitMesh(source, { origin: vector(p, 'origin'), normal: vector(p, 'normal', [0, 0, 1]) }, bool(p, 'cap', false)); return { primary: value.primary, additional: value.secondary ? [value.secondary] : [], warnings: [] }; }
    case 'boolean.union': return one(booleanMesh(source, requiredMesh(meshes, 1), 'union'));
    case 'boolean.difference': return one(booleanMesh(source, requiredMesh(meshes, 1), 'difference'));
    case 'boolean.intersection': return one(booleanMesh(source, requiredMesh(meshes, 1), 'intersection'));
    case 'topology.subdivide': return one(subdivide(source, integer(p, 'levels', 1)));
    case 'topology.adaptive-subdivide': return one(adaptiveSubdivision(source, num(p, 'targetEdgeLength', 1)));
    case 'topology.isotropic-remesh': return one(isotropicRemesh(source, remeshOptions(p)));
    case 'topology.local-remesh': return one(localRemesh(source, ids, remeshOptions(p)));
    case 'topology.decimate': return one(decimate(source, integer(p, 'targetTriangles', Math.max(4, Math.floor(source.faces.length / 2))), bool(p, 'preserveBoundaries', true), bool(p, 'preserveSharp', true), num(p, 'sharpAngle', 40)));
    case 'topology.smooth': return one(smoothTopology(source, integer(p, 'iterations', 2), bool(p, 'preserveBoundaries', true)));
    default: throw new Error(`Editing operation ${request.toolId} is not a geometry-producing tool.`);
  }
}

function reflect(source: IndexedMesh, origin: Vec3, normalInput: Vec3): IndexedMesh {
  const length = Math.hypot(...normalInput); if (!length) throw new Error('Mirror plane normal must be non-zero.'); const normal = scale3(normalInput, 1 / length);
  return { positions: source.positions.map((point) => subtract3(point, scale3(normal, 2 * dot3(subtract3(point, origin), normal)))), faces: source.faces.map(([a, b, c]) => [a, c, b]) };
}
function bake(source: IndexedMesh, transform: Transform): IndexedMesh { const reflected = transform.scale[0] * transform.scale[1] * transform.scale[2] < 0; return { positions: source.positions.map((point) => add3(rotateVector([point[0] * transform.scale[0], point[1] * transform.scale[1], point[2] * transform.scale[2]], transform.rotation), transform.position)), faces: source.faces.map(([a, b, c]) => reflected ? [a, c, b] : [a, b, c]) }; }
function operationPolicy(toolId: string, parameters: Record<string, number | string | boolean>, before: ReturnType<typeof inspectGeometry>) { const allowBoundaries = before.boundaryEdgeCount > 0 || toolId === 'mesh.delete-faces' || toolId === 'mesh.detach-region' || toolId === 'mesh.separate-shell' || toolId === 'cut.trim-curve' || (toolId.startsWith('cut.') && !bool(parameters, 'cap', false)); const allowDisconnected = before.shellCount > 1 || ['mesh.join', 'boolean.union', 'boolean.difference', 'mesh.remove-duplicate-faces', 'mesh.remove-duplicate-vertices', 'mesh.weld'].includes(toolId); return { allowBoundaries, allowDisconnected }; }
function remeshOptions(p: Record<string, number | string | boolean>) { return { targetEdgeLengthMm: num(p, 'targetEdgeLength', 1), iterations: integer(p, 'iterations', 2), preserveBoundaries: bool(p, 'preserveBoundaries', true), preserveSharpFeatures: bool(p, 'preserveSharp', true), sharpAngleDegrees: num(p, 'sharpAngle', 40) }; }
function vector(p: Record<string, number | string | boolean>, prefix: string, defaults: Vec3 = [0, 0, 0]): Vec3 { return ['x', 'y', 'z'].map((axis, index) => num(p, `${prefix}-${axis}`, defaults[index])) as Vec3; }
function num(p: Record<string, number | string | boolean>, id: string, fallback: number): number { const value = p[id] ?? fallback; if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${id} must be a finite number.`); return value; }
function integer(p: Record<string, number | string | boolean>, id: string, fallback: number): number { const value = num(p, id, fallback); if (!Number.isInteger(value)) throw new Error(`${id} must be an integer.`); return value; }
function bool(p: Record<string, number | string | boolean>, id: string, fallback: boolean): boolean { const value = p[id] ?? fallback; if (typeof value !== 'boolean') throw new Error(`${id} must be true or false.`); return value; }
function keep(p: Record<string, number | string | boolean>): 'positive' | 'negative' | 'both' { const value = p.keep ?? 'both'; if (!['positive', 'negative', 'both'].includes(String(value))) throw new Error('Cut keep mode is invalid.'); return value as 'positive' | 'negative' | 'both'; }
function requiredId(ids: number[], label: string): number { const id = ids[0]; if (!Number.isInteger(id)) throw new Error(`${label} selection is required.`); return id; }
function requiredMesh(meshes: IndexedMesh[], index: number): IndexedMesh { const mesh = meshes[index]; if (!mesh) throw new Error('This operation requires two selected mesh objects.'); return mesh; }
function requiredCurve(points?: Vec3[]): Vec3[] { if (!points?.length) throw new Error('This operation requires a model-space curve.'); return points; }
function requiredTransform(transform?: Transform): Transform { if (!transform) throw new Error('Bake transform requires the current object transform.'); const values = [...transform.position, ...transform.rotation, ...transform.scale]; if (!values.every(Number.isFinite) || transform.scale.some((value) => Math.abs(value) < 1e-9)) throw new Error('Bake transform requires finite, non-collapsing transform values.'); const quaternionLength = Math.hypot(...transform.rotation); if (Math.abs(quaternionLength - 1) > 1e-6) throw new Error('Bake transform requires a normalized rotation quaternion.'); return transform; }
function assertActive(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('Geometry operation cancelled.', 'AbortError'); }
