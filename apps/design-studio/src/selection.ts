import type { ISceneManager, ISelectionEngine, SelectionEvent, SelectionSnapshot, SelectionTarget } from './interfaces';

const DEFAULT_SET = 'Default';

export class SelectionEngine implements ISelectionEngine {
  private snapshot: SelectionSnapshot;
  private readonly listeners = new Set<(event: SelectionEvent) => void>();

  constructor(private readonly scene: ISceneManager, initial?: SelectionSnapshot) {
    this.snapshot = initial ? structuredClone(initial) : { activeSet: DEFAULT_SET, sets: { [DEFAULT_SET]: [] } };
    if (!this.snapshot.sets[this.snapshot.activeSet]) this.snapshot.sets[this.snapshot.activeSet] = [];
    this.syncScene();
  }

  subscribe(listener: (event: SelectionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SelectionSnapshot {
    return structuredClone(this.snapshot);
  }

  select(target: SelectionTarget | null, additive = false): void {
    const previous = this.getSnapshot();
    const current = this.snapshot.sets[this.snapshot.activeSet] ?? [];
    if (!target) this.snapshot.sets[this.snapshot.activeSet] = [];
    else if (!additive) this.snapshot.sets[this.snapshot.activeSet] = [structuredClone(target)];
    else {
      const key = targetKey(target);
      const existing = current.findIndex((candidate) => targetKey(candidate) === key);
      this.snapshot.sets[this.snapshot.activeSet] = existing >= 0
        ? current.filter((_, index) => index !== existing)
        : [...current, structuredClone(target)];
    }
    this.commit(previous, target ? 'selection.changed' : 'selection.cleared');
  }

  createSet(name: string, targets: SelectionTarget[] = []): void {
    const normalized = name.trim();
    if (!normalized) throw new Error('Selection-set name is required');
    if (this.snapshot.sets[normalized]) throw new Error(`Selection set ${normalized} already exists`);
    const previous = this.getSnapshot();
    this.snapshot.sets[normalized] = structuredClone(targets);
    this.snapshot.activeSet = normalized;
    this.commit(previous, 'selection-set.created');
  }

  activateSet(name: string): void {
    if (!this.snapshot.sets[name]) throw new Error(`Selection set ${name} not found`);
    const previous = this.getSnapshot();
    this.snapshot.activeSet = name;
    this.commit(previous, 'selection-set.activated');
  }

  deleteSet(name: string): void {
    if (name === DEFAULT_SET) throw new Error('The default selection set cannot be deleted');
    if (!this.snapshot.sets[name]) return;
    const previous = this.getSnapshot();
    delete this.snapshot.sets[name];
    if (this.snapshot.activeSet === name) this.snapshot.activeSet = DEFAULT_SET;
    this.commit(previous, 'selection-set.deleted');
  }

  clear(): void {
    this.select(null);
  }

  restore(snapshot: SelectionSnapshot): void {
    const previous = this.getSnapshot();
    this.snapshot = structuredClone(snapshot);
    if (!this.snapshot.sets[this.snapshot.activeSet]) this.snapshot.activeSet = Object.keys(this.snapshot.sets)[0] ?? DEFAULT_SET;
    if (!this.snapshot.sets[this.snapshot.activeSet]) this.snapshot.sets[this.snapshot.activeSet] = [];
    this.commit(previous, 'selection.restored');
  }

  private commit(previous: SelectionSnapshot, reason: string): void {
    this.syncScene();
    const event: SelectionEvent = { previous, current: this.getSnapshot(), reason };
    this.listeners.forEach((listener) => listener(event));
  }

  private syncScene(): void {
    const selected = new Set(
      (this.snapshot.sets[this.snapshot.activeSet] ?? [])
        .filter((target): target is Extract<SelectionTarget, { kind: 'object' }> => target.kind === 'object')
        .map((target) => target.objectId),
    );
    for (const object of this.scene.list()) this.scene.update(object.id, { selected: selected.has(object.id) });
  }
}

function targetKey(target: SelectionTarget): string {
  return target.kind === 'object'
    ? `object:${target.objectId}`
    : `${target.component}:${target.objectId}:${target.indices.join(',')}`;
}
