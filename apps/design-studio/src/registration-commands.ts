import type { SceneObject, Transform } from './core';
import type { ISceneManager, CommandMetadata, CommandValidation, RuntimeCommand } from './interfaces';
import { rigidToSceneTransform } from './registration-math';
import type { CaseScanSet } from './registration-types';
import { unitScaleToMillimeters } from './scan-validation';
import type { CaseScanSetManager } from './state-managers';

export class RegistrationStateCommand implements RuntimeCommand {
  readonly metadata: CommandMetadata;
  private previousScanSet?: CaseScanSet;
  private previousScene?: SceneObject[];

  constructor(
    private readonly manager: CaseScanSetManager,
    private readonly scene: ISceneManager,
    private readonly next: CaseScanSet,
    label: string,
    type = 'registration.state.update',
  ) {
    this.metadata = { id: crypto.randomUUID(), type, label, createdAt: new Date().toISOString(), tags: ['registration', 'scene', 'transform'] };
  }

  validate(): CommandValidation {
    const current = this.manager.get();
    for (const nextScan of this.next.scans) {
      const currentScan = current.scans.find((scan) => scan.id === nextScan.id); if (!currentScan) continue;
      const changed = currentScan.registrationTransform.matrix.some((value, index) => Math.abs(value - nextScan.registrationTransform.matrix[index]) > 1e-10);
      const object = this.scene.get(nextScan.sceneObjectId);
      if (changed && (currentScan.locked || object?.locked)) return { valid: false, errors: [`Locked scan ${object?.name ?? nextScan.id} cannot be transformed.`] };
    }
    return { valid: true, errors: [] };
  }

  execute(): void {
    this.previousScanSet = this.manager.get(); this.previousScene = this.scene.list();
    this.manager.replace(this.next); this.apply(this.next);
  }

  undo(): void {
    if (!this.previousScanSet || !this.previousScene) return;
    this.manager.replace(this.previousScanSet); this.scene.replace(this.previousScene);
  }

  private apply(scanSet: CaseScanSet): void {
    for (const scan of scanSet.scans) {
      const object = this.scene.get(scan.sceneObjectId); if (!object) continue;
      const scale = unitScaleToMillimeters(scan.confirmedUnits);
      const transform: Transform = rigidToSceneTransform(scan.registrationTransform, [scale, scale, scale]);
      this.scene.update(object.id, { transform, locked: scan.locked });
    }
  }
}
