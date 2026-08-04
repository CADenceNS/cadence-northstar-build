import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { CameraViewCommand, CommandBus, DeleteArtifactCommand, FitObjectsCommand, SceneObjectUpdateCommand } from '../src/commands';
import { ArtifactManager, DEFAULT_CAMERA, SceneManager, type CameraState } from '../src/core';
import type { IRenderer } from '../src/interfaces';
import type { Bounds3 } from '../src/geometry';
import type { MeasurementVisual, ProjectedPoint, SurfaceHit, ViewerOverlay } from '../src/inspection-types';
import { cameraForPreset } from '../src/camera-views';
import { artifactFromMesh, topology } from './golden-geometry';

describe('scene tree and camera command integration', () => {
  it('undoes and redoes a scene property change', async () => {
    const { scene } = runtime(); const bus = new CommandBus(); const object = scene.list()[0];
    await bus.execute(new SceneObjectUpdateCommand(scene, object.id, { name: 'Renamed', type: 'restoration' }, 'Rename and classify'));
    expect(scene.get(object.id)?.name).toBe('Renamed'); await bus.undo(); expect(scene.get(object.id)?.name).toBe('fixture.ply'); await bus.redo(); expect(scene.get(object.id)?.type).toBe('restoration');
  });

  it('rejects delete and transform commands for locked objects', async () => {
    const { scene, artifacts, renderer } = runtime(); const bus = new CommandBus(); const object = scene.list()[0];
    await bus.execute(new SceneObjectUpdateCommand(scene, object.id, { locked: true }, 'Lock object'));
    await expect(bus.execute(new DeleteArtifactCommand({ scene, artifacts, renderer }, object.artifactId))).rejects.toThrow(/Locked object/);
    await expect(bus.execute(new SceneObjectUpdateCommand(scene, object.id, { transform: { ...object.transform, position: [1, 0, 0] } }, 'Transform object', true))).rejects.toThrow(/cannot be transformed/);
    expect(scene.list()).toHaveLength(1); expect(artifacts.list()).toHaveLength(1);
  });

  it('undoes artifact deletion and restores scene state', async () => {
    const { scene, artifacts, renderer } = runtime(); const bus = new CommandBus(); const object = scene.list()[0];
    await bus.execute(new DeleteArtifactCommand({ scene, artifacts, renderer }, object.artifactId)); expect(scene.list()).toHaveLength(0); await bus.undo(); expect(scene.list()).toEqual([object]);
  });

  it('applies every deterministic dental camera preset without touching scene state', async () => {
    const { scene, renderer } = runtime(); const before = scene.list(); const bus = new CommandBus();
    for (const preset of ['anterior', 'posterior', 'buccal', 'lingual', 'occlusal', 'intaglio', 'mesial', 'distal', 'maxillary', 'mandibular'] as const) {
      const camera = cameraForPreset(renderer.getCamera(), preset); await bus.execute(new CameraViewCommand(renderer, camera, preset)); expect(renderer.getCamera().yaw).toBe(camera.yaw); expect(renderer.getCamera().pitch).toBe(camera.pitch);
    }
    expect(scene.list()).toEqual(before);
  });

  it('routes fit selected through reversible camera history', async () => {
    const { scene, renderer } = runtime(); const bus = new CommandBus(); const before = renderer.getCamera();
    await bus.execute(new FitObjectsCommand(renderer, [scene.list()[0].id])); expect(renderer.getCamera().distance).toBe(25); await bus.undo(); expect(renderer.getCamera()).toEqual(before);
  });
});

function runtime() {
  const artifact = artifactFromMesh('fixture', topology([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1, 2]])); const artifacts = new ArtifactManager([artifact]); const scene = new SceneManager(); scene.addFromArtifact(artifact, 'reference'); return { scene, artifacts, renderer: new RendererStub() };
}

class RendererStub implements IRenderer {
  private camera: CameraState = structuredClone(DEFAULT_CAMERA);
  setScene(): void {} setCamera(camera: CameraState): void { this.camera = structuredClone(camera); } getCamera(): CameraState { return structuredClone(this.camera); }
  fitToScreen(): void { this.camera.distance = 25; } fitObjects(): void { this.camera.distance = 25; } resetCamera(): void { this.camera = structuredClone(DEFAULT_CAMERA); }
  setProjection(projection: CameraState['projection']): void { this.camera.projection = projection; } pick(): SurfaceHit | null { return null; }
  projectWorld(): ProjectedPoint { return { x: 0, y: 0, visible: true }; } setMeasurementVisuals(_visuals: MeasurementVisual[]): void {} setValidationOverlays(_overlays: ViewerOverlay[]): void {} focusBounds(_bounds: Bounds3): void {} dispose(): void {}
}
