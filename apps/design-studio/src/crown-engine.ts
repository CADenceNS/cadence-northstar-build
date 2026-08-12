import { runCrownAnalyses } from './crown-analysis';
import { buildCrownSolid } from './crown-geometry';
import type { CrownGenerationInput, CrownGenerationProgress, CrownGenerationResult } from './restoration-types';

export function generateCrownProposal(
  input: CrownGenerationInput,
  options: { progress?: (progress: CrownGenerationProgress) => void; cancelled?: () => boolean } = {},
): CrownGenerationResult {
  const started = performance.now();
  const emit = (stage: string, completed: number, total: number, message: string) => options.progress?.({ requestId: input.requestId, stage, completed, total, message });
  emit('validation', 0, 1, 'Validating approved preparation, margin, insertion axis, morphology, and material parameters.');
  const solid = buildCrownSolid(input, { progress: emit, cancelled: options.cancelled });
  if (options.cancelled?.()) throw new Error('Crown generation cancelled.');
  emit('analysis', 0, 7, 'Measuring intaglio, seating, contact, occlusion, contour, and thickness behavior.');
  const analyses = runCrownAnalyses(solid, input);
  emit('analysis', 7, 7, 'Completed deterministic crown analysis.');
  return {
    requestId: input.requestId,
    mesh: solid.mesh,
    topologyMap: solid.topologyMap,
    inspection: solid.inspection,
    ...analyses,
    durationMs: performance.now() - started,
    warnings: solid.warnings,
  };
}
