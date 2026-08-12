import { createRestorationProjectState, type RestorationProjectState } from './restoration-types';

export class RestorationStateManager {
  private state: RestorationProjectState;
  private readonly listeners = new Set<() => void>();
  constructor(initial: RestorationProjectState = createRestorationProjectState()) { this.state = normalizeRestorationState(initial); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get(): RestorationProjectState { return structuredClone(this.state); }
  replace(value: RestorationProjectState): void { this.state = normalizeRestorationState(value); this.listeners.forEach((listener) => listener()); }
  update(patch: Partial<Omit<RestorationProjectState, 'schemaVersion' | 'engineVersion' | 'morphologyVersion'>>): void { this.replace({ ...this.state, ...structuredClone(patch) }); }
}

export function normalizeRestorationState(value: Partial<RestorationProjectState> | null | undefined): RestorationProjectState {
  const defaults = createRestorationProjectState();
  if (!value || typeof value !== 'object') return defaults;
  return {
    ...defaults,
    ...structuredClone(value),
    schemaVersion: 1,
    engineVersion: defaults.engineVersion,
    morphologyVersion: defaults.morphologyVersion,
    restorations: Array.isArray(value.restorations) ? structuredClone(value.restorations) : [],
    versions: Array.isArray(value.versions) ? structuredClone(value.versions) : [],
    qcResults: Array.isArray(value.qcResults) ? structuredClone(value.qcResults) : [],
    exports: Array.isArray(value.exports) ? structuredClone(value.exports) : [],
    settings: { ...defaults.settings, ...(value.settings ?? {}) },
  };
}
