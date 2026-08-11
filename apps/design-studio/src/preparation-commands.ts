import type { RuntimeCommand, CommandMetadata, CommandValidation } from './interfaces';
import type { PreparationStateManager } from './preparation-state';
import type { PreparationProjectState, MarginVersion } from './preparation-types';
import type { EditingStateManager } from './editing-state';
import type { SurfaceCurve } from './editing-types';

function commandMetadata(type: string, label: string): CommandMetadata {
  return { id: crypto.randomUUID(), type, label, createdAt: new Date().toISOString(), tags: ['preparation', 'margin', 'project-state'] };
}

export class PreparationStateCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata;
  private previous: PreparationProjectState;
  constructor(private readonly manager: PreparationStateManager, private readonly next: PreparationProjectState, type: string, label: string) {
    this.previous = manager.get(); this.metadata = commandMetadata(type, label);
  }
  validate(): CommandValidation { return { valid: true, errors: [] }; }
  execute(): void { this.previous = this.manager.get(); this.manager.replace(this.next); }
  undo(): void { this.manager.replace(this.previous); }
  redo(): void { this.manager.replace(this.next); }
}

export class MarginEditCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata;
  private previousPreparation: PreparationProjectState;
  private previousEditing: ReturnType<EditingStateManager['get']>;
  constructor(
    private readonly preparationManager: PreparationStateManager,
    private readonly editingManager: EditingStateManager,
    private readonly margin: MarginVersion,
    private readonly curve: SurfaceCurve,
    type: string,
    label: string,
    private readonly relatedMargins: MarginVersion[] = [],
    private readonly additionalCurves: SurfaceCurve[] = [],
  ) {
    this.previousPreparation = preparationManager.get(); this.previousEditing = editingManager.get(); this.metadata = commandMetadata(type, label);
  }
  validate(): CommandValidation {
    const state = this.preparationManager.get();
    const preparation = state.preparations.find((value) => value.id === this.margin.preparationId);
    if (!preparation) return { valid: false, errors: [`Preparation ${this.margin.preparationId} not found.`] };
    const active = preparation.activeMarginVersionId ? state.margins.find((value) => value.id === preparation.activeMarginVersionId) : undefined;
    if (active?.locked) return { valid: false, errors: ['Locked margin must be explicitly unlocked before editing.'] };
    if (this.curve.controlPoints.length < 2 || this.curve.controlPoints.some((point) => !point.every(Number.isFinite))) return { valid: false, errors: ['Margin curve requires finite model-space control points.'] };
    return { valid: true, errors: [] };
  }
  execute(): void {
    this.previousPreparation = this.preparationManager.get(); this.previousEditing = this.editingManager.get();
    this.apply();
  }
  undo(): void { this.preparationManager.replace(this.previousPreparation); this.editingManager.replace(this.previousEditing); }
  redo(): void { this.apply(); }
  private apply(): void {
    const preparation = this.preparationManager.get();
    const editing = this.editingManager.get();
    const curveIds = new Set([this.curve.id, ...this.additionalCurves.map((value) => value.id)]);
    this.editingManager.replace({ ...editing, curves: [...editing.curves.filter((value) => !curveIds.has(value.id)), structuredClone(this.curve), ...structuredClone(this.additionalCurves)] });
    const allMargins = [this.margin, ...this.relatedMargins]; const marginIds = new Set(allMargins.map((value) => value.id));
    this.preparationManager.replace({
      ...preparation,
      margins: [...preparation.margins.filter((value) => !marginIds.has(value.id)), ...structuredClone(allMargins)],
      preparations: preparation.preparations.map((value) => value.id === this.margin.preparationId ? {
        ...value,
        marginVersionIds: [...new Set([...value.marginVersionIds, ...allMargins.map((item) => item.id)])],
        activeMarginVersionId: this.margin.id,
        approvedMarginVersionId: ['approved', 'locked'].includes(this.margin.stage) ? this.margin.id : value.approvedMarginVersionId,
        updatedAt: new Date().toISOString(),
      } : value),
    });
  }
}
