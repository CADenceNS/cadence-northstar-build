import type { CommandMetadata, CommandValidation, ISelectionEngine, RuntimeCommand, SelectionSnapshot, SelectionTarget } from './interfaces';

export class SelectionCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata = {
    id: crypto.randomUUID(),
    type: 'selection.change',
    label: 'Change selection',
    createdAt: new Date().toISOString(),
    tags: ['selection'],
  };
  private previous?: SelectionSnapshot;

  constructor(
    private readonly selection: ISelectionEngine,
    private readonly target: SelectionTarget | null,
    private readonly additive = false,
  ) {}

  validate(): CommandValidation { return { valid: true, errors: [] }; }
  execute(): void { this.previous = this.selection.getSnapshot(); this.selection.select(this.target, this.additive); }
  undo(): void { if (this.previous) this.selection.restore(this.previous); }
}
