import { createEditingProjectState, type EditingProjectState, type MeshComponentSelection, type SurfaceCurve } from './editing-types';

export class EditingStateManager {
  private state: EditingProjectState;
  private readonly listeners = new Set<() => void>();
  constructor(initial: EditingProjectState = createEditingProjectState()) { this.state = normalize(initial); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get(): EditingProjectState { return structuredClone(this.state); }
  replace(value: EditingProjectState): void { this.state = normalize(value); this.changed(); }
  update(patch: Partial<Omit<EditingProjectState, 'schemaVersion'>>): void { this.state = normalize({ ...this.state, ...structuredClone(patch) }); this.changed(); }
  setSelections(values: MeshComponentSelection[]): void { this.update({ componentSelections: values }); }
  addCurve(curve: SurfaceCurve): void { if (this.state.curves.some((value) => value.id === curve.id)) throw new Error(`Curve ${curve.id} already exists.`); this.update({ curves: [...this.state.curves, structuredClone(curve)] }); }
  updateCurve(id: string, curve: SurfaceCurve): void { if (!this.state.curves.some((value) => value.id === id)) throw new Error(`Curve ${id} not found.`); this.update({ curves: this.state.curves.map((value) => value.id === id ? structuredClone(curve) : value) }); }
  removeCurve(id: string): void { this.update({ curves: this.state.curves.filter((value) => value.id !== id) }); }
  private changed(): void { this.listeners.forEach((listener) => listener()); }
}

function normalize(value: EditingProjectState): EditingProjectState {
  const defaults = createEditingProjectState();
  return {
    ...defaults,
    ...structuredClone(value),
    schemaVersion: 1,
    transformSettings: { ...defaults.transformSettings, ...(value.transformSettings ?? {}) },
    componentSelections: Array.isArray(value.componentSelections) ? structuredClone(value.componentSelections) : [],
    curves: Array.isArray(value.curves) ? structuredClone(value.curves) : [],
    geometryVersions: Array.isArray(value.geometryVersions) ? structuredClone(value.geometryVersions) : [],
    toolSettings: value.toolSettings && typeof value.toolSettings === 'object' ? structuredClone(value.toolSettings) : {},
  };
}
