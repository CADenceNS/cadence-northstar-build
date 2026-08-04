import { beforeEach, describe, it } from 'node:test';
import { expect } from './test-helpers';
import { createProject, ProjectStore, type MeasurementRecord } from '../src/core';
import { validateMeshArtifact } from '../src/mesh-validation';
import { createValidationReport, reportToCsv, reportToHtml, reportToJson } from '../src/validation-reports';
import { ValidationReportManager } from '../src/state-managers';
import { goldenGeometryCorpus } from './golden-geometry';

describe('validation reports and project persistence', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() }); });

  it('exports JSON, CSV and printable HTML from the exact validation result', async () => {
    const artifact = goldenGeometryCorpus()[0].artifact; const project = createProject('Report test'); project.artifacts = [artifact]; const result = validateMeshArtifact(artifact);
    const { report, historyEntry } = await createValidationReport(project, artifact, result, 'test-user');
    expect(JSON.parse(reportToJson(report))).toEqual(report); expect(reportToCsv(report)).toContain('watertight-status'); expect(reportToCsv(report)).toContain(result.resultFingerprint);
    expect(reportToHtml(report)).toContain('CADence Design Studio Mesh Validation Report'); expect(reportToHtml(report)).toContain('does not assert clinical approval');
    expect(report.resultFingerprint).toBe(result.resultFingerprint); expect(historyEntry.payloadId).toBe(report.id); expect(historyEntry.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('preserves validation reports, measurements and scene state across save and reopen', async () => {
    const artifact = goldenGeometryCorpus()[0].artifact; const project = createProject('Persistence'); project.artifacts = [artifact];
    const result = validateMeshArtifact(artifact); const { report, historyEntry } = await createValidationReport(project, artifact, result);
    project.validationReports = [report]; project.history = [historyEntry]; project.measurements = [measurement()];
    const store = new ProjectStore(); const saved = store.save(project); const opened = store.open(saved.id);
    expect(opened.validationReports).toEqual([report]); expect(opened.measurements).toEqual(project.measurements); expect(opened.history).toEqual([historyEntry]); expect(opened.schemaVersion).toBe(2);
  });

  it('preserves reports and measurements through crash recovery', async () => {
    const artifact = goldenGeometryCorpus()[0].artifact; const project = createProject('Recovery'); const result = validateMeshArtifact(artifact); const { report } = await createValidationReport(project, artifact, result);
    project.validationReports = [report]; project.measurements = [measurement()]; const store = new ProjectStore(); store.autoSave(project);
    expect(store.recover()?.validationReports).toEqual([report]); expect(store.recover()?.measurements).toEqual(project.measurements);
  });

  it('prevents mutation or deletion of immutable stored reports', async () => {
    const artifact = goldenGeometryCorpus()[0].artifact; const project = createProject(); const { report } = await createValidationReport(project, artifact, validateMeshArtifact(artifact)); const manager = new ValidationReportManager([report]);
    expect(() => manager.update()).toThrow(/immutable/); expect(() => manager.remove()).toThrow(/immutable/); expect(manager.get(report.id)).toEqual(report);
  });
});

function measurement(): MeasurementRecord { const now = '2026-08-04T00:00:00.000Z'; return { id: 'measurement-1', kind: 'point-distance', name: 'Distance', anchors: [{ id: 'a', position: [0, 0, 0], objectId: 'object', artifactId: 'artifact' }, { id: 'b', position: [1, 0, 0], objectId: 'object', artifactId: 'artifact' }], objectIds: ['object'], value: 1, values: {}, units: 'mm', precision: 2, visible: true, createdAt: now, updatedAt: now, metadata: {} }; }
class MemoryStorage implements Storage { private values = new Map<string, string>(); get length() { return this.values.size; } clear() { this.values.clear(); } getItem(key: string) { return this.values.get(key) ?? null; } key(index: number) { return [...this.values.keys()][index] ?? null; } removeItem(key: string) { this.values.delete(key); } setItem(key: string, value: string) { this.values.set(key, value); } }
