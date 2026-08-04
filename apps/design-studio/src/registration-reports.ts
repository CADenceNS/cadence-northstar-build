import type { ArtifactRecord, DesignProject, ProjectHistoryEntry } from './core';
import type { CaseScanSet, RegistrationOutcome, StoredRegistrationReport } from './registration-types';

export async function createRegistrationReport(project: DesignProject, scanSet: CaseScanSet, artifacts: ArtifactRecord[], actor: string | null = null): Promise<{ report: StoredRegistrationReport; historyEntry: ProjectHistoryEntry }> {
  const artifactMap = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const results = scanSet.relationships.flatMap((relationship) => relationship.results);
  const finalResult: RegistrationOutcome = scanSet.assemblyStatus === 'accepted' ? 'accepted'
    : scanSet.assemblyStatus === 'warning' ? 'accepted-with-warning'
      : scanSet.assemblyStatus === 'review' ? 'manual-review-required'
        : scanSet.assemblyStatus === 'cancelled' ? 'cancelled' : 'failed';
  const reportBase = {
    reportSchemaVersion: 1 as const,
    id: crypto.randomUUID(),
    projectId: project.id,
    caseId: scanSet.caseId,
    engineVersion: results[0]?.engineVersion ?? '1.0.0',
    generatedAt: new Date().toISOString(),
    generatedBy: actor,
    artifactIds: scanSet.scans.map((scan) => scan.artifactId),
    fileHashes: Object.fromEntries(scanSet.scans.map((scan) => [scan.artifactId, artifactMap.get(scan.artifactId)?.checksum ?? scan.fileHash])),
    sourceTargetRoles: scanSet.relationships.map((relationship) => {
      const source = scanSet.scans.find((scan) => scan.id === relationship.sourceScanId)?.assignedRole ?? 'unknown';
      const target = scanSet.scans.find((scan) => scan.id === relationship.targetScanId)?.assignedRole ?? 'unknown'; return { source, target };
    }),
    transformMatrices: Object.fromEntries(scanSet.scans.map((scan) => [scan.id, scan.registrationTransform.matrix])),
    relationshipResults: results,
    assemblyStatus: scanSet.assemblyStatus,
    assemblyConfidence: scanSet.assemblyConfidence,
    biteAgreement: biteAgreement(results),
    coordinateSystem: scanSet.dentalCoordinates,
    userCorrections: scanSet.scans.flatMap((scan) => scan.userAdjustments),
    finalResult,
  };
  const resultFingerprint = await sha256(JSON.stringify(normalizeForHash(reportBase)));
  const report: StoredRegistrationReport = { ...reportBase, resultFingerprint };
  const historyEntry: ProjectHistoryEntry = { id: crypto.randomUUID(), type: 'registration-report', artifactId: report.artifactIds[0] ?? 'case-scan-set', payloadId: report.id, payloadHash: await sha256(JSON.stringify(report)), createdAt: report.generatedAt };
  return { report, historyEntry };
}

export function registrationReportToJson(report: StoredRegistrationReport): string { return `${JSON.stringify(report, null, 2)}\n`; }

export function registrationReportToCsv(report: StoredRegistrationReport): string {
  const rows = [['report_id', 'source_role', 'target_role', 'outcome', 'rms_mm', 'median_mm', 'p95_mm', 'inliers', 'outliers', 'overlap_percent', 'iterations', 'confidence', 'fingerprint']];
  for (const result of report.relationshipResults) rows.push([report.id, result.sourceRole, result.targetRole, result.outcome, result.metrics.rmsResidual, result.metrics.medianResidual, result.metrics.percentile95Residual, result.metrics.inlierCount, result.metrics.outlierCount, result.metrics.estimatedOverlapPercent, result.metrics.iterationCount, result.metrics.confidenceScore, result.deterministicFingerprint].map(String));
  if (!report.relationshipResults.length) rows.push([report.id, '', '', report.finalResult, '', '', '', '', '', '', '', String(report.assemblyConfidence ?? ''), report.resultFingerprint]);
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function registrationReportToHtml(report: StoredRegistrationReport): string {
  const relationships = report.relationshipResults.map((result) => `<tr><td>${escapeHtml(result.sourceRole)}</td><td>${escapeHtml(result.targetRole)}</td><td>${escapeHtml(result.outcome)}</td><td>${format(result.metrics.rmsResidual)}</td><td>${format(result.metrics.medianResidual)}</td><td>${format(result.metrics.percentile95Residual)}</td><td>${format(result.metrics.estimatedOverlapPercent)}%</td><td>${format(result.metrics.confidenceScore)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Design Studio Registration Report</title><style>body{font:14px system-ui;margin:40px;color:#172033}h1{color:#080038}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3df;padding:7px;text-align:left}code{font-size:11px}.notice{margin-top:28px;padding:12px;background:#f5f6fa}</style></head><body><h1>CADence Design Studio Registration Report</h1><p><strong>Project:</strong> ${escapeHtml(report.projectId)}<br><strong>Case:</strong> ${escapeHtml(report.caseId ?? 'Not linked')}<br><strong>Engine:</strong> ${escapeHtml(report.engineVersion)}<br><strong>Generated:</strong> ${escapeHtml(report.generatedAt)}<br><strong>Final result:</strong> ${escapeHtml(report.finalResult)}<br><strong>Assembly confidence:</strong> ${format(report.assemblyConfidence)}</p><h2>Pairwise results</h2><table><thead><tr><th>Source</th><th>Target</th><th>Outcome</th><th>RMS mm</th><th>Median mm</th><th>P95 mm</th><th>Overlap</th><th>Confidence</th></tr></thead><tbody>${relationships || '<tr><td colspan="8">No completed pairwise result</td></tr>'}</tbody></table><h2>Transform matrices</h2>${Object.entries(report.transformMatrices).map(([id, matrix]) => `<p><strong>${escapeHtml(id)}</strong><br><code>${matrix.map((value) => format(value, 8)).join(', ')}</code></p>`).join('')}<p><strong>Result fingerprint:</strong> <code>${escapeHtml(report.resultFingerprint)}</code></p><div class="notice">This engineering report records measured geometric registration results. It does not assert clinical approval, manufacturing approval, or regulatory acceptance.</div></body></html>`;
}

function biteAgreement(results: StoredRegistrationReport['relationshipResults']): number | null { const values = results.map((result) => result.metrics.biteScanAgreement).filter((value): value is number => value !== null); return values.length ? Math.min(...values) : null; }
function normalizeForHash(value: unknown): unknown { if (Array.isArray(value)) return value.map(normalizeForHash); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !['id', 'generatedAt', 'startedAt', 'completedAt', 'timings'].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalizeForHash(item)])); if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 1e8) / 1e8; return value; }
async function sha256(value: string): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join(''); }
function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
function format(value: number | null, precision = 4): string { return value === null || !Number.isFinite(value) ? 'Not available' : value.toFixed(precision); }
