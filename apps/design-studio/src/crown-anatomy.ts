import type { MeshData, Vec3 } from './core';
import { sculptCrownSurface, type CrownSculptInput, type CrownSculptMode } from './crown-geometry';
import type { CrownLocks, CrownTopologyMap } from './restoration-types';

export type CrownAnatomyOperation =
  | 'move-cusp' | 'raise-cusp' | 'lower-cusp' | 'widen-cusp' | 'narrow-cusp'
  | 'move-ridge' | 'raise-ridge' | 'lower-ridge'
  | 'deepen-groove' | 'shallow-groove' | 'move-groove'
  | 'deepen-fossa' | 'raise-fossa'
  | 'adjust-marginal-ridge' | 'adjust-contact-zone' | 'adjust-line-angle'
  | 'adjust-facial-contour' | 'adjust-lingual-contour' | 'adjust-cervical-contour'
  | 'adjust-incisal-edge' | 'adjust-occlusal-table'
  | 'add-anatomy' | 'remove-anatomy' | 'smooth' | 'polish';

export const CROWN_ANATOMY_OPERATIONS: readonly CrownAnatomyOperation[] = [
  'move-cusp', 'raise-cusp', 'lower-cusp', 'widen-cusp', 'narrow-cusp',
  'move-ridge', 'raise-ridge', 'lower-ridge', 'deepen-groove', 'shallow-groove', 'move-groove',
  'deepen-fossa', 'raise-fossa', 'adjust-marginal-ridge', 'adjust-contact-zone', 'adjust-line-angle',
  'adjust-facial-contour', 'adjust-lingual-contour', 'adjust-cervical-contour', 'adjust-incisal-edge', 'adjust-occlusal-table',
  'add-anatomy', 'remove-anatomy', 'smooth', 'polish',
];

export interface CrownAnatomyEditInput {
  operation: CrownAnatomyOperation;
  center: Vec3;
  radiusMm: number;
  strengthMm: number;
  direction?: Vec3;
  symmetryAxis?: 'x' | 'y' | 'z' | null;
  lockedVertexIds?: number[];
}

const MODE_BY_OPERATION: Readonly<Record<CrownAnatomyOperation, CrownSculptMode>> = {
  'move-cusp': 'grab', 'raise-cusp': 'add', 'lower-cusp': 'remove', 'widen-cusp': 'inflate', 'narrow-cusp': 'pinch',
  'move-ridge': 'drag', 'raise-ridge': 'add', 'lower-ridge': 'remove',
  'deepen-groove': 'carve', 'shallow-groove': 'fill', 'move-groove': 'drag',
  'deepen-fossa': 'carve', 'raise-fossa': 'fill',
  'adjust-marginal-ridge': 'grab', 'adjust-contact-zone': 'grab', 'adjust-line-angle': 'crease',
  'adjust-facial-contour': 'grab', 'adjust-lingual-contour': 'grab', 'adjust-cervical-contour': 'grab',
  'adjust-incisal-edge': 'grab', 'adjust-occlusal-table': 'flatten',
  'add-anatomy': 'add', 'remove-anatomy': 'remove', smooth: 'smooth', polish: 'polish',
};

/**
 * Applies a named restoration-anatomy operation to actual indexed crown
 * vertices.  The operation delegates to the same validated model-space sculpt
 * kernel used by free-form tools, so command/history callers receive a real
 * derived mesh rather than UI-only state.
 */
export function editCrownAnatomy(
  mesh: MeshData,
  topologyMap: CrownTopologyMap,
  input: CrownAnatomyEditInput,
  locks: CrownLocks,
): MeshData {
  if (!CROWN_ANATOMY_OPERATIONS.includes(input.operation)) throw new Error(`Unsupported crown anatomy operation ${String(input.operation)}.`);
  const sculpt: CrownSculptInput = {
    center: input.center,
    radiusMm: input.radiusMm,
    strengthMm: input.strengthMm,
    mode: MODE_BY_OPERATION[input.operation],
    direction: input.direction,
    surfaceConstraint: ['move-ridge', 'move-groove'].includes(input.operation),
    falloff: ['adjust-line-angle', 'deepen-groove', 'deepen-fossa'].includes(input.operation) ? 'sharp' : 'smooth',
    symmetryAxis: input.symmetryAxis,
    lockedVertexIds: input.lockedVertexIds,
  };
  return sculptCrownSurface(mesh, topologyMap, sculpt, locks);
}
