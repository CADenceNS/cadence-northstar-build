import type { MeasurementRecord, ProjectHistoryEntry, SavedView, StoredValidationReport } from './core';
import type { CaseScanSet, StoredRegistrationReport } from './registration-types';

export interface CollectionStore<T extends { id: string }> {
  list(): T[];
  get(id: string): T | undefined;
  replace(values: T[]): void;
}

export interface MutableCollectionStore<T extends { id: string }> extends CollectionStore<T> {
  add(value: T): void;
  update(id: string, patch: Partial<Omit<T, 'id'>>): void;
  remove(id: string): void;
}

export class ObservableCollection<T extends { id: string }> implements CollectionStore<T> {
  private values = new Map<string, T>();
  private readonly listeners = new Set<() => void>();

  constructor(initial: T[] = []) { this.replace(initial, false); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  list(): T[] { return [...this.values.values()].map((value) => structuredClone(value)); }
  get(id: string): T | undefined { const value = this.values.get(id); return value ? structuredClone(value) : undefined; }
  add(value: T): void {
    if (this.values.has(value.id)) throw new Error(`Record ${value.id} already exists`);
    this.values.set(value.id, structuredClone(value)); this.changed();
  }
  update(id: string, patch: Partial<Omit<T, 'id'>>): void {
    const current = this.values.get(id); if (!current) throw new Error(`Record ${id} not found`);
    this.values.set(id, { ...current, ...structuredClone(patch) } as T); this.changed();
  }
  remove(id: string): void { if (!this.values.delete(id)) throw new Error(`Record ${id} not found`); this.changed(); }
  replace(values: T[], notify = true): void {
    this.values = new Map(values.map((value) => [value.id, structuredClone(value)]));
    if (notify) this.changed();
  }
  protected changed(): void { this.listeners.forEach((listener) => listener()); }
}

export class MeasurementManager extends ObservableCollection<MeasurementRecord> {}
export class SavedViewManager extends ObservableCollection<SavedView> {}

export class ValidationReportManager extends ObservableCollection<StoredValidationReport> {
  update(): never { throw new Error('Validation reports are immutable'); }
  remove(): never { throw new Error('Validation reports are immutable'); }
}

export class RegistrationReportManager extends ObservableCollection<StoredRegistrationReport> {
  update(): never { throw new Error('Registration reports are immutable'); }
  remove(): never { throw new Error('Registration reports are immutable'); }
}

export class CaseScanSetManager {
  private value: CaseScanSet;
  private readonly listeners = new Set<() => void>();
  constructor(initial: CaseScanSet) { this.value = structuredClone(initial); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get(): CaseScanSet { return structuredClone(this.value); }
  replace(value: CaseScanSet): void { this.value = structuredClone(value); this.listeners.forEach((listener) => listener()); }
}

export class ProjectHistoryManager extends ObservableCollection<ProjectHistoryEntry> {}
