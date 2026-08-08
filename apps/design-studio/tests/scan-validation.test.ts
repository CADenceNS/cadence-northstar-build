import { describe, it } from 'node:test';
import { expect } from './test-helpers';
import { SceneManager } from '../src/core';
import { createCaseScanSet, inferScanRole, updateScan } from '../src/scan-set';
import { validateOverlapPotential, validateScanForRegistration } from '../src/scan-validation';
import { SCAN_ROLES } from '../src/registration-types';
import { archArtifact } from './golden-registration';

describe('registration preflight and scan-set ownership', () => {
  it('exposes every approved scan role and deterministic filename inference', () => {
    expect(SCAN_ROLES).toHaveLength(19);
    expect(inferScanRole('buccal-left.ply')).toBe('buccal-bite-left'); expect(inferScanRole('full_occlusion.stl')).toBe('full-bite');
    expect(inferScanRole('prep-segment.obj')).toBe('preparation-segment'); expect(inferScanRole('cbct_surface.ply')).toBe('cbct-derived-surface');
    expect(inferScanRole('unclassified.ply')).toBe('unknown');
  });

  it('requires explicit unit confirmation and preserves the original source unit field', () => {
    const artifact = archArtifact('unknown-units', 15, 11); artifact.units = 'unknown'; const scene = new SceneManager(); const object = scene.addFromArtifact(artifact);
    const set = createCaseScanSet('project', scene.list(), [artifact]); const scan = set.scans[0]; const validation = validateScanForRegistration(artifact, object, scan, [artifact]);
    expect(validation.canRegisterAutomatically).toBe(false); expect(validation.issues.find((issue) => issue.id === 'units')?.status).toBe('confirmation-required');
    const confirmed = updateScan(set, scan.id, { confirmedUnits: 'mm', unitsConfirmed: true });
    expect(confirmed.scans[0].originalUnits).toBe('unknown'); expect(confirmed.scans[0].confirmedUnits).toBe('mm');
  });

  it('blocks invalid scale, non-finite transforms and duplicate hashes', () => {
    const artifact = archArtifact('large-scale-mm', 15, 11); artifact.mesh.bounds.max = [500, 500, 500];
    const duplicate = structuredClone(artifact); duplicate.id = crypto.randomUUID(); duplicate.sourceName = 'duplicate'; const scene = new SceneManager(); const object = scene.addFromArtifact(artifact);
    scene.update(object.id, { transform: { ...object.transform, position: [Number.NaN, 0, 0] } }); const invalidObject = scene.get(object.id)!;
    const scan = createCaseScanSet('project', [invalidObject], [artifact]).scans[0]; const validation = validateScanForRegistration(artifact, invalidObject, scan, [artifact, duplicate]);
    expect(validation.issues.find((issue) => issue.id === 'invalid-scale')?.status).toBe('fail');
    expect(validation.issues.find((issue) => issue.id === 'invalid-transform')?.status).toBe('fail');
    expect(validation.issues.find((issue) => issue.id === 'duplicate-scan')?.status).toBe('fail');
  });

  it('rejects a millimeter arch at one-tenth plausible dental scale', () => {
    const artifact = archArtifact('upper-arch', 15, 11);
    artifact.mesh.bounds.min = artifact.mesh.bounds.min.map((value) => value * 0.1) as [number, number, number];
    artifact.mesh.bounds.max = artifact.mesh.bounds.max.map((value) => value * 0.1) as [number, number, number];
    const scene = new SceneManager(); const object = scene.addFromArtifact(artifact);
    const scan = createCaseScanSet('project', scene.list(), [artifact]).scans[0];
    const validation = validateScanForRegistration(artifact, object, scan, [artifact]);
    expect(scan.assignedRole).toBe('upper-arch');
    expect(validation.issues.find((issue) => issue.id === 'invalid-scale')?.status).toBe('fail');
    expect(validation.canRegisterAutomatically).toBe(false);
  });

  it('reports orientation uncertainty without silently changing source coordinates', () => {
    const artifact = archArtifact('raw-orientation', 15, 11); artifact.orientation = 'source'; const before = structuredClone(artifact.mesh);
    const scene = new SceneManager(); const object = scene.addFromArtifact(artifact); const scan = createCaseScanSet('project', scene.list(), [artifact]).scans[0];
    const validation = validateScanForRegistration(artifact, object, scan, [artifact]); expect(validation.issues.find((issue) => issue.id === 'axis-orientation')?.status).toBe('warning'); expect(artifact.mesh).toEqual(before);
  });

  it('rejects an implausible bounding-scale ratio before pairwise analysis', () => {
    const source = archArtifact('small', 15, 11); const target = archArtifact('large', 15, 11); target.mesh.bounds.max = target.mesh.bounds.max.map((value) => value * 100) as [number, number, number];
    expect(validateOverlapPotential(source, target).status).toBe('fail');
  });
});
