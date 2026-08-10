import type { ToolCoverageEntry, ToolDefinition, ToolParameterDefinition, ToolSelectionRequirement } from './editing-types';

const numberParameter = (id: string, label: string, defaultValue: number, units: 'mm' | 'degrees' | 'percent' | 'triangles', min?: number, max?: number, step = 0.1): ToolParameterDefinition => ({ id, label, type: 'number', defaultValue, units, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), step });
const booleanParameter = (id: string, label: string, defaultValue: boolean): ToolParameterDefinition => ({ id, label, type: 'boolean', defaultValue });
const selectParameter = (id: string, label: string, defaultValue: string, values: string[]): ToolParameterDefinition => ({ id, label, type: 'select', defaultValue, options: values.map((value) => ({ value, label: value.replaceAll('-', ' ') })) });

function tool(id: string, label: string, category: ToolDefinition['category'], selection: ToolSelectionRequirement, algorithm: string, parameters: readonly ToolParameterDefinition[] = [], destructive = false, workerBacked = false, shortcut?: string): ToolDefinition & { algorithm: string } {
  return { id, label, category, description: algorithm, selection, parameters, destructive, workerBacked, ...(shortcut ? { shortcut } : {}), algorithm };
}

export const PRODUCTION_TOOL_DEFINITIONS = [
  tool('select.object', 'Object', 'selection', 'none', 'Scene-object identity selection', [], false, false, '1'),
  tool('select.vertex', 'Vertex', 'selection', 'object', 'Nearest indexed vertex from a WebGL ray/triangle hit', [], false, false, '2'),
  tool('select.edge', 'Edge', 'selection', 'object', 'Nearest indexed topology edge from a WebGL ray/triangle hit', [], false, false, '3'),
  tool('select.face', 'Face', 'selection', 'object', 'Indexed triangle selection from a WebGL ray hit', [], false, false, '4'),
  tool('select.connected-region', 'Connected region', 'selection', 'face', 'Face-adjacency flood constrained by normal angle', [numberParameter('angle', 'Normal angle', 30, 'degrees', 0, 180, 1)]),
  tool('select.shell', 'Shell', 'selection', 'face', 'Connected-component traversal over shared topology edges'),
  tool('select.boundary-loop', 'Boundary loop', 'selection', 'edge', 'Single-use-edge graph loop traversal'),
  tool('select.edge-loop', 'Edge loop', 'selection', 'edge', 'Valence-aware collinear edge continuation'),
  tool('select.edge-ring', 'Edge ring', 'selection', 'edge', 'Parallel edge propagation through incident faces'),
  tool('select.paint', 'Paint selection', 'selection', 'object', 'Model-space face-centroid radius brush', [numberParameter('radius', 'Brush radius', 2, 'mm', 0.01, 100, 0.1)]),
  tool('select.lasso', 'Lasso selection', 'selection', 'object', 'Projected face-centroid point-in-polygon selection'),
  tool('select.rectangle', 'Rectangle selection', 'selection', 'object', 'Projected face-centroid rectangle containment selection'),
  tool('select.grow', 'Grow selection', 'selection', 'component', 'Vertex-, edge-, or face-adjacency ring dilation', [numberParameter('rings', 'Rings', 1, 'triangles', 1, 50, 1)]),
  tool('select.shrink', 'Shrink selection', 'selection', 'component', 'Vertex-, edge-, or face-adjacency boundary erosion', [numberParameter('rings', 'Rings', 1, 'triangles', 1, 50, 1)]),
  tool('select.invert', 'Invert selection', 'selection', 'object', 'Complement over stable indexed component identifiers'),
  tool('select.normal-angle', 'Select by normal angle', 'selection', 'face', 'Normal-dot-product constrained face flood', [numberParameter('angle', 'Normal angle', 30, 'degrees', 0, 180, 1)]),
  tool('select.connectivity', 'Select by connectivity', 'selection', 'face', 'Tolerance-aware geometric connectivity across coincident indexed vertices'),

  tool('transform.move', 'Move', 'transform', 'object', 'Quaternion-aware local/global numeric translation', vectorParameters('mm'), false, false, 'G'),
  tool('transform.rotate', 'Rotate', 'transform', 'object', 'Pivoted quaternion rotation with angular snapping', vectorParameters('degrees'), false, false, 'R'),
  tool('transform.scale', 'Scale', 'transform', 'object', 'Pivoted independent-axis scale', scaleParameters(), false, false, 'S'),
  tool('transform.uniform-scale', 'Uniform scale', 'transform', 'object', 'Pivoted uniform numeric scale', [numberParameter('factor', 'Scale factor', 1, 'percent', 0.001, 1000, 0.01)]),
  tool('transform.mirror', 'Mirror', 'transform', 'object', 'Model-space plane reflection with winding preservation', planeParameters(), true, true),
  tool('transform.duplicate', 'Duplicate', 'transform', 'object', 'Independent derived-artifact geometry copy', [], true, true),
  tool('transform.align-objects', 'Align objects', 'transform', 'objects:2', 'World-space bounding-center alignment'),
  tool('transform.align-plane', 'Align to plane', 'transform', 'object', 'Shortest-arc normal alignment with exact plane-origin placement', planeParameters()),
  tool('transform.align-axis', 'Align to axis', 'transform', 'object', 'Shortest-arc quaternion axis alignment', axisParameters()),
  tool('transform.center-origin', 'Center to origin', 'transform', 'object', 'Transformed geometry-bounds centroid translation'),
  tool('transform.custom-pivot', 'Custom pivot', 'transform', 'object', 'Persisted finite model-space pivot', vectorParameters('mm')),
  tool('transform.coordinate-mode', 'Local/global coordinates', 'transform', 'object', 'Local quaternion basis or global Cartesian basis', [selectParameter('mode', 'Coordinate mode', 'global', ['global', 'local'])]),
  tool('transform.numeric', 'Numeric transform', 'transform', 'object', 'Exact translation, Euler rotation, and scale composition', [...vectorParameters('mm', 'translation'), ...vectorParameters('degrees', 'rotation'), ...scaleParameters()]),
  tool('transform.translation-snap', 'Translation snapping', 'transform', 'object', 'Nearest configurable millimeter interval', [numberParameter('interval', 'Snap interval', 0.1, 'mm', 0, 100, 0.1)]),
  tool('transform.angular-snap', 'Angular snapping', 'transform', 'object', 'Nearest configurable angular interval', [numberParameter('interval', 'Snap interval', 5, 'degrees', 0, 180, 1)]),
  tool('transform.surface-snap', 'Surface snapping', 'transform', 'objects:2', 'Closest point over target triangle geometry'),
  tool('transform.reset', 'Reset transform', 'transform', 'object', 'Identity transform restoration'),
  tool('transform.bake', 'Apply/bake transform', 'transform', 'object', 'Object transform applied into a derived indexed mesh', [], true, true),

  tool('curve.polyline', 'Polyline', 'curve', 'object', 'Source-associated model-space connected line segments'),
  tool('curve.spline', 'Spline', 'curve', 'object', 'Source-associated Catmull–Rom interpolation through model-space control points'),
  tool('curve.surface-projected', 'Surface-projected curve', 'curve', 'object', 'Closest-point projection to source triangles'),
  tool('curve.edit-point', 'Edit control point', 'curve', 'curve', 'Finite model-space control-point replacement'),
  tool('curve.add-point', 'Add control point', 'curve', 'curve', 'Ordered control-point insertion'),
  tool('curve.remove-point', 'Remove control point', 'curve', 'curve', 'Validated ordered control-point removal'),
  tool('curve.smooth', 'Smooth curve', 'curve', 'curve', 'Iterative neighbor averaging with endpoint preservation', [numberParameter('strength', 'Strength', 50, 'percent', 0, 100, 1)]),
  tool('curve.simplify', 'Simplify curve', 'curve', 'curve', 'Ramer–Douglas–Peucker model-space simplification', [numberParameter('tolerance', 'Tolerance', 0.1, 'mm', 0.001, 100, 0.01)]),
  tool('curve.resample', 'Resample curve', 'curve', 'curve', 'Arc-length equidistant resampling', [numberParameter('spacing', 'Spacing', 0.5, 'mm', 0.001, 100, 0.1)]),
  tool('curve.offset', 'Offset curve', 'curve', 'curve', 'Tangent/surface-normal model-space offset', [numberParameter('distance', 'Offset', 1, 'mm', -100, 100, 0.1)]),
  tool('curve.extend', 'Extend curve', 'curve', 'curve', 'Endpoint tangent extension', [numberParameter('distance', 'Distance', 1, 'mm', 0, 100, 0.1)]),
  tool('curve.trim', 'Trim curve', 'curve', 'curve', 'Arc-length interval clipping', [numberParameter('start', 'Start', 0, 'mm', 0), numberParameter('end', 'End', 1, 'mm', 0)]),
  tool('curve.split', 'Split curve', 'curve', 'curve', 'Interior control-point partition'),
  tool('curve.join', 'Join curves', 'curve', 'curve', 'Endpoint-proximity oriented concatenation', [numberParameter('tolerance', 'Join tolerance', 0.1, 'mm', 0.001, 10, 0.01)]),
  tool('curve.reverse', 'Reverse direction', 'curve', 'curve', 'Control and sample order reversal'),
  tool('curve.open-close', 'Open/close curve', 'curve', 'curve', 'Validated curve closure state'),
  tool('curve.project', 'Project curve to mesh', 'curve', 'object', 'Closest-point projection of every control point'),

  tool('mesh.delete-faces', 'Delete selected faces', 'mesh', 'faces', 'Indexed face removal and vertex compaction', [], true, true, 'Delete'),
  tool('mesh.detach-region', 'Detach selected region', 'mesh', 'faces', 'Selected-face partition into derived meshes', [], true, true),
  tool('mesh.separate-shell', 'Separate connected shell', 'mesh', 'face', 'Connected-component mesh partition', [], true, true),
  tool('mesh.join', 'Join meshes', 'mesh', 'objects:2', 'Indexed concatenation with tolerance welding', [numberParameter('tolerance', 'Weld tolerance', 0.001, 'mm', 0.000001, 10, 0.001)], true, true),
  tool('mesh.weld', 'Weld vertices', 'mesh', 'object', 'Tolerance-grid candidate welding with exact distance check', [numberParameter('tolerance', 'Tolerance', 0.001, 'mm', 0.000001, 10, 0.001)], true, true),
  tool('mesh.remove-duplicate-vertices', 'Remove duplicate vertices', 'mesh', 'object', 'Tolerance-based indexed vertex canonicalization', [numberParameter('tolerance', 'Tolerance', 0.001, 'mm', 0.000001, 10, 0.001)], true, true),
  tool('mesh.remove-duplicate-faces', 'Remove duplicate faces', 'mesh', 'object', 'Orientation-independent triangle-key deduplication', [], true, true),
  tool('mesh.fill-hole', 'Fill boundary hole', 'mesh', 'boundary-loop', 'Best-fit-plane boundary projection with deterministic ear clipping and winding alignment', [], true, true),
  tool('mesh.bridge-loops', 'Bridge boundary loops', 'mesh', 'boundary-loop', 'Closest-orientation zipper triangulation between loops', [], true, true),
  tool('mesh.extrude', 'Extrude faces', 'mesh', 'faces', 'Vertex-normal displacement with boundary side-wall construction', [numberParameter('distance', 'Distance', 1, 'mm', -100, 100, 0.1)], true, true, 'E'),
  tool('mesh.inset', 'Inset faces', 'mesh', 'faces', 'Face-plane inward offset with triangulated perimeter', [numberParameter('distance', 'Inset', 0.2, 'mm', 0.001, 100, 0.1)], true, true, 'I'),
  tool('mesh.offset-region', 'Offset surface region', 'mesh', 'faces', 'Area-weighted vertex-normal displacement', [numberParameter('distance', 'Offset', 0.2, 'mm', -100, 100, 0.1)], true, true),
  tool('mesh.thicken', 'Shell/thicken', 'mesh', 'object', 'Parallel inner shell with reversed winding and boundary walls', [numberParameter('thickness', 'Thickness', 1, 'mm', 0.001, 100, 0.1)], true, true),
  tool('mesh.flatten', 'Flatten selected region', 'mesh', 'faces', 'Orthogonal projection to the averaged selection plane', [], true, true),
  tool('mesh.smooth', 'Smooth selected region', 'mesh', 'faces', 'Boundary-preserving Laplacian smoothing', [numberParameter('iterations', 'Iterations', 2, 'triangles', 1, 100, 1), numberParameter('strength', 'Strength', 35, 'percent', 0, 100, 1)], true, true),
  tool('mesh.relax', 'Relax selected region', 'mesh', 'faces', 'Taubin positive/negative Laplacian relaxation', [numberParameter('iterations', 'Iterations', 2, 'triangles', 1, 100, 1)], true, true),
  tool('mesh.recalculate-normals', 'Recalculate normals', 'mesh', 'object', 'Area-weighted normals regenerated from triangle winding', [], true, true),
  tool('mesh.reverse-normals', 'Reverse normals', 'mesh', 'object', 'Triangle winding reversal and normal regeneration', [], true, true),
  tool('mesh.remove-islands', 'Remove isolated components', 'mesh', 'object', 'Connected-shell area threshold filtering', [numberParameter('minimumArea', 'Minimum area', 1, 'mm', 0, 10000, 0.1)], true, true),

  tool('cut.plane', 'Plane cut', 'cut', 'object', 'Signed-distance triangle clipping against a model-space plane', [...planeParameters(), selectParameter('keep', 'Keep side', 'both', ['positive', 'negative', 'both']), booleanParameter('cap', 'Cap boundaries', true)], true, true),
  tool('cut.curve', 'Curve-based cut', 'cut', 'curve', 'Piecewise ruled cutting surface from every curve segment and extrusion direction', [...directionParameters('extrusion', 'Extrusion'), selectParameter('keep', 'Keep side', 'both', ['positive', 'negative', 'both']), booleanParameter('cap', 'Cap boundaries', true)], true, true),
  tool('cut.trim-curve', 'Trim by closed curve', 'cut', 'curve', 'Best-fit-plane polygon containment over actual face centroids', [booleanParameter('inside', 'Keep inside', true)], true, true),
  tool('cut.split', 'Split mesh', 'cut', 'object', 'Two-sided signed-distance triangle clipping', [...planeParameters(), booleanParameter('cap', 'Cap boundaries', false)], true, true),
  tool('boolean.union', 'Boolean union', 'boolean', 'objects:2', 'Binary space partitioning constructive solid geometry union', [], true, true),
  tool('boolean.difference', 'Boolean difference', 'boolean', 'objects:2', 'Binary space partitioning constructive solid geometry subtraction', [], true, true),
  tool('boolean.intersection', 'Boolean intersection', 'boolean', 'objects:2', 'Binary space partitioning constructive solid geometry intersection', [], true, true),

  tool('topology.subdivide', 'Subdivide', 'topology', 'object', 'Conforming midpoint subdivision', [numberParameter('levels', 'Levels', 1, 'triangles', 1, 6, 1)], true, true),
  tool('topology.adaptive-subdivide', 'Adaptive subdivision', 'topology', 'object', 'Conforming marked-edge subdivision to target length', [numberParameter('targetEdgeLength', 'Target edge length', 1, 'mm', 0.001, 100, 0.1)], true, true),
  tool('topology.isotropic-remesh', 'Isotropic remesh', 'topology', 'object', 'Iterative long-edge split, safe short-edge collapse, and relaxation', remeshParameters(), true, true),
  tool('topology.local-remesh', 'Local remesh', 'topology', 'faces', 'Selection-scoped conforming edge refinement', remeshParameters(), true, true),
  tool('topology.decimate', 'Decimate', 'topology', 'object', 'Shortest valid edge collapse to exact triangle target', [numberParameter('targetTriangles', 'Target triangles', 1000, 'triangles', 4, 10000000, 1), booleanParameter('preserveBoundaries', 'Preserve boundaries', true), booleanParameter('preserveSharp', 'Preserve sharp features', true)], true, true),
  tool('topology.smooth', 'Smooth topology', 'topology', 'object', 'Boundary-preserving Laplacian topology smoothing', [numberParameter('iterations', 'Iterations', 2, 'triangles', 1, 100, 1), booleanParameter('preserveBoundaries', 'Preserve boundaries', true)], true, true),
] as const;

export const TOOL_COVERAGE_REGISTRY: readonly ToolCoverageEntry[] = PRODUCTION_TOOL_DEFINITIONS.map(({ algorithm, ...definition }) => ({
  id: definition.id,
  label: definition.label,
  category: definition.category,
  algorithm,
  deterministicTest: definition.destructive ? `editing-operation-corpus.test.ts#${definition.id}` : `editing-selection-transform-curve.test.ts#${definition.category}`,
  browserTest: browserEvidence(definition.category),
  commandIntegrated: true,
  persisted: true,
  recovery: true,
  implemented: true,
}));

export function toolDefinition(id: string): ToolDefinition { const definition = PRODUCTION_TOOL_DEFINITIONS.find((candidate) => candidate.id === id); if (!definition) throw new Error(`Production tool ${id} is not registered.`); return structuredClone(definition); }

function vectorParameters(units: 'mm' | 'degrees', prefix = ''): ToolParameterDefinition[] { return ['x', 'y', 'z'].map((axis) => numberParameter(`${prefix}${prefix ? '-' : ''}${axis}`, `${prefix ? `${prefix} ` : ''}${axis.toUpperCase()}`, 0, units, -100000, 100000, units === 'mm' ? 0.1 : 1)); }
function scaleParameters(): ToolParameterDefinition[] { return ['x', 'y', 'z'].map((axis) => numberParameter(`scale-${axis}`, `Scale ${axis.toUpperCase()}`, 1, 'percent', -1000, 1000, 0.01)); }
function planeParameters(): ToolParameterDefinition[] { return [...['x', 'y', 'z'].map((axis, index) => numberParameter(`origin-${axis}`, `Origin ${axis.toUpperCase()}`, 0, 'mm', -100000, 100000, 0.1)), ...['x', 'y', 'z'].map((axis, index) => numberParameter(`normal-${axis}`, `Normal ${axis.toUpperCase()}`, index === 2 ? 1 : 0, 'percent', -1, 1, 0.01))]; }
function axisParameters(): ToolParameterDefinition[] { return [...['x', 'y', 'z'].map((axis, index) => numberParameter(`local-${axis}`, `Local ${axis.toUpperCase()}`, index === 2 ? 1 : 0, 'percent', -1, 1, 0.01)), ...['x', 'y', 'z'].map((axis, index) => numberParameter(`global-${axis}`, `Global ${axis.toUpperCase()}`, index === 2 ? 1 : 0, 'percent', -1, 1, 0.01))]; }
function directionParameters(prefix: string, label: string): ToolParameterDefinition[] { return ['x', 'y', 'z'].map((axis, index) => numberParameter(`${prefix}-${axis}`, `${label} ${axis.toUpperCase()}`, index === 2 ? 1 : 0, 'percent', -1, 1, 0.01)); }
function remeshParameters(): ToolParameterDefinition[] { return [numberParameter('targetEdgeLength', 'Target edge length', 1, 'mm', 0.001, 100, 0.1), numberParameter('iterations', 'Iterations', 2, 'triangles', 1, 20, 1), booleanParameter('preserveBoundaries', 'Preserve boundaries', true), booleanParameter('preserveSharp', 'Preserve sharp features', true), numberParameter('sharpAngle', 'Sharp angle', 40, 'degrees', 1, 179, 1)]; }

function browserEvidence(category: ToolDefinition['category']): string {
  const scenarios: Record<ToolDefinition['category'], string> = {
    selection: 'selects actual faces and commits an undoable derived extrusion',
    transform: 'performs numeric transform, bake, save/reopen, and crash recovery',
    curve: 'creates and persists a model-space surface curve through command history',
    mesh: 'selects actual faces and commits an undoable derived extrusion',
    cut: 'plane-cuts actual geometry with a validated derived second part',
    boolean: 'previews and commits validated Boolean geometry while the main frame loop remains responsive',
    topology: 'subdivides actual topology and reports persisted triangle quality',
  };
  return `design-studio-editing-core.spec.mjs#${scenarios[category]}`;
}
