import { createPreparationProjectState, type PreparationProjectState } from './preparation-types';

export class PreparationStateManager {
  private state: PreparationProjectState;
  private readonly listeners = new Set<() => void>();
  constructor(initial: PreparationProjectState = createPreparationProjectState()) { this.state = normalizePreparationState(initial); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get(): PreparationProjectState { return structuredClone(this.state); }
  replace(value: PreparationProjectState): void { this.state = normalizePreparationState(value); this.listeners.forEach((listener) => listener()); }
  update(patch: Partial<Omit<PreparationProjectState, 'schemaVersion' | 'engineVersion'>>): void { this.replace({ ...this.state, ...structuredClone(patch) }); }
}

export function normalizePreparationState(value: Partial<PreparationProjectState> | null | undefined): PreparationProjectState {
  const defaults = createPreparationProjectState();
  if (!value || typeof value !== 'object') return defaults;
  return {
    ...defaults,
    ...structuredClone(value),
    schemaVersion: 1,
    engineVersion: defaults.engineVersion,
    candidates: Array.isArray(value.candidates) ? structuredClone(value.candidates) : [],
    preparations: Array.isArray(value.preparations) ? structuredClone(value.preparations) : [],
    segmentations: Array.isArray(value.segmentations) ? structuredClone(value.segmentations) : [],
    axes: Array.isArray(value.axes) ? structuredClone(value.axes) : [],
    margins: Array.isArray(value.margins) ? structuredClone(value.margins) : [],
    qcResults: Array.isArray(value.qcResults) ? structuredClone(value.qcResults) : [],
    rejectedMarginCandidateIds: Array.isArray(value.rejectedMarginCandidateIds) ? structuredClone(value.rejectedMarginCandidateIds) : [],
    bridgeGroups: Array.isArray(value.bridgeGroups) ? structuredClone(value.bridgeGroups) : [],
    settings: { ...defaults.settings, ...(value.settings ?? {}) },
  };
}
