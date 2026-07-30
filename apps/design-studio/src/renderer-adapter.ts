import type { ArtifactRecord, CameraState, ProjectionMode, SceneObject } from './core';
import type { IRenderer } from './interfaces';
import { runtimeMetrics } from './metrics';
import { ViewerRuntime } from './viewer';

export class InstrumentedRenderer implements IRenderer {
  private readonly runtime: ViewerRuntime;

  constructor(canvas: HTMLCanvasElement, camera: CameraState, onCameraChange: (camera: CameraState) => void) {
    this.runtime = new ViewerRuntime(canvas, camera, onCameraChange);
  }

  setScene(objects: SceneObject[], artifacts: ArtifactRecord[]): void {
    runtimeMetrics.measure('renderer.gpu-upload', () => this.runtime.setScene(objects, artifacts), {
      objects: objects.length,
      artifacts: artifacts.length,
      triangles: artifacts.reduce((total, artifact) => total + artifact.mesh.indices.length / 3, 0),
    });
    this.measureFrame();
  }

  setCamera(camera: CameraState): void { this.runtime.setCamera(camera); this.measureFrame(); }
  getCamera(): CameraState { return this.runtime.getCamera(); }
  fitToScreen(): void { this.runtime.fitToScreen(); this.measureFrame(); }
  resetCamera(): void { this.runtime.resetCamera(); this.measureFrame(); }
  setProjection(projection: ProjectionMode): void { this.runtime.setProjection(projection); this.measureFrame(); }
  dispose(): void { this.runtime.dispose(); }

  private measureFrame(): void {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    requestAnimationFrame(() => runtimeMetrics.record({
      name: 'renderer.frame',
      durationMs: performance.now() - start,
      startedAt,
      metadata: { phase: 'next-animation-frame' },
    }));
  }
}
