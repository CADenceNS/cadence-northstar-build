import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { validateMeshArtifact } from '../src/mesh-validation';
import { buildValidationOverlays, VALIDATION_OVERLAY_CHECKS } from '../src/validation-overlays';
import type { SceneObject } from '../src/core';
import { goldenGeometryCorpus } from './golden-geometry';

describe('deterministic golden geometry corpus', () => {
  for (const fixture of goldenGeometryCorpus()) {
    it(`detects ${fixture.name} with documented expected check`, () => {
      const result = validateMeshArtifact(fixture.artifact);
      const check = result.checks.find((item) => item.id === fixture.expectedCheck);
      expect(check, fixture.expectedCheck).toBeDefined();
      if (fixture.name === 'valid-watertight') {
        expect(check?.status).toBe('pass');
        expect(result.failureCount).toBe(0);
        expect(result.overall).toBe('pass');
      } else {
        expect(check?.status).not.toBe('pass');
        expect(check?.affectedCount || check?.measuredValue).toBeTruthy();
      }
    });
  }

  it('returns byte-for-byte deterministic check payloads and fingerprints', () => {
    const fixture = goldenGeometryCorpus().find((item) => item.name === 'disconnected-shell')!;
    const first = validateMeshArtifact(fixture.artifact); const second = validateMeshArtifact(fixture.artifact);
    expect(second.checks).toEqual(first.checks);
    expect(second.resultFingerprint).toBe(first.resultFingerprint);
    expect(second.topology).toEqual(first.topology);
  });

  it('builds overlay element counts from detected geometry without mutating the artifact', () => {
    const fixture = goldenGeometryCorpus().find((item) => item.name === 'non-manifold-edge')!;
    const before = structuredClone(fixture.artifact); const result = validateMeshArtifact(fixture.artifact);
    const object: SceneObject = { id: 'scene-1', name: 'fixture', type: 'reference', artifactId: fixture.artifact.id, visible: true, isolated: false, locked: false, selected: true, transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, material: { color: [1, 1, 1, 1], opacity: 1, metallic: 0, roughness: 1 }, metadata: {} };
    const overlays = buildValidationOverlays(result, object);
    for (const overlay of overlays) {
      expect(VALIDATION_OVERLAY_CHECKS).toContain(overlay.checkId);
      expect(overlay.elementCount).toBe(result.checks.find((check) => check.id === overlay.checkId)?.affectedCount);
      expect(overlay.positions.length).toBeGreaterThan(0);
    }
    expect(fixture.artifact).toEqual(before);
  });
});
