import type { ArtifactRecord, DesignProject, ProjectHistoryEntry, StoredValidationCheck, StoredValidationReport } from './core';
import type { MeshValidationResult } from './mesh-validation';

export async function createValidationReport(project: DesignProject, artifact: ArtifactRecord, result: MeshValidationResult, executedBy: string | null = null): Promise<{ report: StoredValidationReport; historyEntry: ProjectHistoryEntry }> {
  if (result.artifactId !== artifact.id) throw new Error('Validation result does not belong to the selected artifact.');
  const report: StoredValidationReport = {
    reportSchemaVersion: 1,
    id: crypto.randomUUID(),
    projectId: project.id,
    artifactId: artifact.id,
    fileName: artifact.sourceName,
    fileHash: artifact.checksum,
    importFormat: artifact.sourceFormat,
    engineVersion: result.engineVersion,
    executedAt: new Date().toISOString(),
    executedBy,
    meshStatistics: {
      triangleCount: numericCheck(result.checks, 'triangle-count'),
      vertexCount: numericCheck(result.checks, 'vertex-count'),
      surfaceAreaMm2: numericCheck(result.checks, 'surface-area'),
      signedVolumeMm3: numericCheck(result.checks, 'signed-volume'),
      watertight: booleanCheck(result.checks, 'watertight-status'),
      ...objectCheck(result.checks, 'bounding-box-dimensions', 'bounding'),
    },
    checks: structuredClone(result.checks),
    overall: result.overall,
    warningCount: result.warningCount,
    failureCount: result.failureCount,
    resultFingerprint: result.resultFingerprint,
  };
  const payloadHash = await sha256(JSON.stringify(report));
  return {
    report,
    historyEntry: { id: crypto.randomUUID(), type: 'validation-report', artifactId: artifact.id, payloadId: report.id, payloadHash, createdAt: report.executedAt },
  };
}

export function reportToJson(report: StoredValidationReport): string { return `${JSON.stringify(report, null, 2)}\n`; }

export function reportToCsv(report: StoredValidationReport): string {
  const headers = ['report_id', 'project_id', 'artifact_id', 'file_name', 'file_hash', 'import_format', 'engine_version', 'executed_at', 'executed_by', 'overall', 'warning_count', 'failure_count', 'result_fingerprint', 'check_id', 'status', 'measured_value', 'threshold', 'affected_count', 'affected_elements', 'explanation'];
  const rows = report.checks.map((check) => [
    report.id, report.projectId, report.artifactId, report.fileName, report.fileHash, report.importFormat, report.engineVersion, report.executedAt, report.executedBy ?? '', report.overall,
    report.warningCount, report.failureCount, report.resultFingerprint, check.id, check.status, serializeValue(check.measuredValue), serializeValue(check.threshold), check.affectedCount, check.affectedElementIds.join('|'), check.explanation,
  ]);
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function reportToHtml(report: StoredValidationReport): string {
  const statistics = Object.entries(report.meshStatistics).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value ?? 'not run'))}</td></tr>`).join('');
  const checks = report.checks.map((check) => `<tr><td>${escapeHtml(check.id)}</td><td class="${check.status}">${escapeHtml(check.status)}</td><td>${escapeHtml(serializeValue(check.measuredValue))}</td><td>${escapeHtml(serializeValue(check.threshold))}</td><td>${check.affectedCount}</td><td>${escapeHtml(check.explanation)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design Studio Validation Report</title><style>body{font:14px/1.45 system-ui;margin:32px;color:#172033}h1,h2{margin:0 0 14px}.meta{display:grid;grid-template-columns:180px 1fr;gap:6px 16px;margin-bottom:24px}table{border-collapse:collapse;width:100%;margin:12px 0 24px}th,td{border:1px solid #cbd3df;padding:7px;text-align:left;vertical-align:top}.pass{color:#087c43}.warning{color:#8a5b00}.fail{color:#b31d28}.not-run{color:#596273}@media print{body{margin:12mm}}</style></head><body><h1>CADence Design Studio Mesh Validation Report</h1><div class="meta"><strong>Report</strong><span>${escapeHtml(report.id)}</span><strong>Project</strong><span>${escapeHtml(report.projectId)}</span><strong>Artifact</strong><span>${escapeHtml(report.artifactId)}</span><strong>File</strong><span>${escapeHtml(report.fileName)}</span><strong>SHA-256</strong><span>${escapeHtml(report.fileHash)}</span><strong>Format</strong><span>${escapeHtml(report.importFormat.toUpperCase())}</span><strong>Engine</strong><span>${escapeHtml(report.engineVersion)}</span><strong>Executed</strong><span>${escapeHtml(report.executedAt)}</span><strong>Executed by</strong><span>${escapeHtml(report.executedBy ?? 'Identity unavailable')}</span><strong>Overall</strong><span>${escapeHtml(report.overall)}</span></div><h2>Mesh statistics</h2><table>${statistics}</table><h2>Checks</h2><table><thead><tr><th>Check</th><th>Status</th><th>Measured value</th><th>Threshold</th><th>Affected</th><th>Explanation</th></tr></thead><tbody>${checks}</tbody></table><p>This report records geometric inspection results only. It does not assert clinical approval, manufacturing approval, or regulatory compliance.</p></body></html>`;
}

function numericCheck(checks: StoredValidationCheck[], id: string): number | null { const value = checks.find((check) => check.id === id)?.measuredValue; return typeof value === 'number' ? value : null; }
function booleanCheck(checks: StoredValidationCheck[], id: string): boolean | null { const value = checks.find((check) => check.id === id)?.measuredValue; return typeof value === 'boolean' ? value : null; }
function objectCheck(checks: StoredValidationCheck[], id: string, prefix: string): Record<string, number> {
  const value = checks.find((check) => check.id === id)?.measuredValue;
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [`${prefix}${key.toUpperCase()}Mm`, item]));
}
function serializeValue(value: StoredValidationCheck['measuredValue'] | StoredValidationCheck['threshold']): string { return value === null ? 'not run' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function csvCell(value: unknown): string { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
async function sha256(value: string): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join(''); }
