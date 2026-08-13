import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CROWN_TOOL_COVERAGE_REGISTRY } from '../src/crown-tool-registry';

interface RequirementEvidence {
  runtimeImplementationRef: string;
  implementationFileSetRef: string;
  toolRegistryEntries: string[];
  toolRegistrySetRef: string | null;
  deterministicTestSetRef: string;
  browserTestSetRef: string | null;
  performanceEvidenceSetRef: string | null;
  failureBehaviorRef: string;
  certificationEvidenceSetRef: string;
  justification?: string;
}

interface Requirement {
  id: string;
  requirement: string;
  finalStatus: 'VERIFIED_COMPLETE' | 'NOT_APPLICABLE_WITH_JUSTIFICATION';
  finalEvidence: RequirementEvidence;
}

interface Matrix {
  schemaVersion: number;
  sourceSpecification: { sha256: string };
  phaseSummary: Array<{
    requirementCount: number;
    finalStatus: 'VERIFIED_COMPLETE' | 'NOT_APPLICABLE_WITH_JUSTIFICATION';
    finalCounts: { VERIFIED_COMPLETE: number; PARTIALLY_IMPLEMENTED: number; MISSING: number; NOT_APPLICABLE_WITH_JUSTIFICATION: number };
  }>;
  evidenceCatalog: {
    phaseRuntimeImplementation: Record<string, string>;
    implementationFileSets: Record<string, string[]>;
    deterministicTestSets: Record<string, string[]>;
    browserTestSets: Record<string, string[]>;
    performanceEvidenceSets: Record<string, string[]>;
    phaseFailureBehavior: Record<string, string>;
    certificationEvidenceSets: Record<string, string[]>;
    toolRegistrySets: Record<string, string[]>;
  };
  requirementColumns: string[];
  requirements: unknown[][];
}

const repositoryRoot = path.resolve(process.cwd(), '../..');
const matrixPath = path.join(repositoryRoot, 'docs/design-studio/SPRINT_25_COMPLIANCE_MATRIX.json');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as Matrix;
const registryIds = new Set(CROWN_TOOL_COVERAGE_REGISTRY.map((entry) => entry.toolId));
const column = Object.fromEntries(matrix.requirementColumns.map((name, index) => [name, index])) as Record<string, number>;
const requirements: Requirement[] = matrix.requirements.map((row) => ({
  id: row[column.id] as string,
  requirement: row[column.requirement] as string,
  finalStatus: row[column.finalStatus] as Requirement['finalStatus'],
  finalEvidence: {
    runtimeImplementationRef: row[column.runtimeImplementationRef] as string,
    implementationFileSetRef: row[column.implementationFileSetRef] as string,
    toolRegistryEntries: row[column.toolRegistryEntries] as string[],
    toolRegistrySetRef: row[column.toolRegistrySetRef] as string | null,
    deterministicTestSetRef: row[column.deterministicTestSetRef] as string,
    browserTestSetRef: row[column.browserTestSetRef] as string | null,
    performanceEvidenceSetRef: row[column.performanceEvidenceSetRef] as string | null,
    failureBehaviorRef: row[column.failureBehaviorRef] as string,
    certificationEvidenceSetRef: row[column.certificationEvidenceSetRef] as string,
    justification: row[column.justification] as string | undefined,
  },
}));

describe('Sprint 25 machine-readable compliance matrix', () => {
  it('preserves the exact approved specification identity and all 712 audited requirements', () => {
    assert.equal(matrix.schemaVersion, 3);
    assert.equal(matrix.sourceSpecification.sha256, 'a72e78d89d3a5423b83149b7f41ce4b07abe072fba88c1a8a5d4ea6a70742fd2');
    assert.equal(requirements.length, 712);
    assert.equal(new Set(requirements.map((requirement) => requirement.id)).size, 712);
    assert.equal(matrix.phaseSummary.reduce((total, phase) => total + phase.requirementCount, 0), 712);
  });

  it('contains no partial or missing final result and supplies scoped evidence for every requirement', () => {
    for (const requirement of requirements) {
      const evidence = requirement.finalEvidence;
      const runtimeImplementation = matrix.evidenceCatalog.phaseRuntimeImplementation[evidence.runtimeImplementationRef];
      const implementationFiles = matrix.evidenceCatalog.implementationFileSets[evidence.implementationFileSetRef];
      const deterministicTests = matrix.evidenceCatalog.deterministicTestSets[evidence.deterministicTestSetRef];
      const browserTests = evidence.browserTestSetRef === null ? [] : matrix.evidenceCatalog.browserTestSets[evidence.browserTestSetRef];
      const toolRegistryEntries = [
        ...evidence.toolRegistryEntries,
        ...(evidence.toolRegistrySetRef === null ? [] : matrix.evidenceCatalog.toolRegistrySets[evidence.toolRegistrySetRef]),
      ];
      const failureBehavior = matrix.evidenceCatalog.phaseFailureBehavior[evidence.failureBehaviorRef];
      const certificationEvidence = matrix.evidenceCatalog.certificationEvidenceSets[evidence.certificationEvidenceSetRef];
      assert.ok(['VERIFIED_COMPLETE', 'NOT_APPLICABLE_WITH_JUSTIFICATION'].includes(requirement.finalStatus), `${requirement.id} has an incomplete final status`);
      assert.ok(runtimeImplementation.length > 20, `${requirement.id} lacks runtime evidence`);
      assert.ok(failureBehavior.length > 10, `${requirement.id} lacks failure behavior`);
      assert.ok(certificationEvidence.length > 0, `${requirement.id} lacks certification evidence`);
      if (evidence.performanceEvidenceSetRef !== null) {
        assert.ok(matrix.evidenceCatalog.performanceEvidenceSets[evidence.performanceEvidenceSetRef].length > 0, `${requirement.id} lacks performance evidence`);
      }
      for (const file of [...implementationFiles, ...deterministicTests, ...browserTests]) {
        assert.ok(existsSync(path.join(repositoryRoot, file)), `${requirement.id} references missing evidence ${file}`);
      }
      for (const toolId of toolRegistryEntries) {
        assert.ok(registryIds.has(toolId), `${requirement.id} references missing registry entry ${toolId}`);
      }
      if (requirement.finalStatus === 'NOT_APPLICABLE_WITH_JUSTIFICATION') {
        assert.ok((requirement.finalEvidence.justification?.length ?? 0) > 20, `${requirement.id} lacks an N/A justification`);
      }
    }
  });

  it('reconciles every phase and marks every crown registry capability production ready', () => {
    for (const phase of matrix.phaseSummary) {
      assert.equal(phase.finalCounts.PARTIALLY_IMPLEMENTED, 0);
      assert.equal(phase.finalCounts.MISSING, 0);
      assert.equal(Object.values(phase.finalCounts).reduce((sum, value) => sum + value, 0), phase.requirementCount);
      assert.ok(['VERIFIED_COMPLETE', 'NOT_APPLICABLE_WITH_JUSTIFICATION'].includes(phase.finalStatus));
    }
    assert.equal(CROWN_TOOL_COVERAGE_REGISTRY.length, 81);
    assert.equal(new Set(CROWN_TOOL_COVERAGE_REGISTRY.map((entry) => entry.toolId)).size, 81);
    assert.ok(CROWN_TOOL_COVERAGE_REGISTRY.every((entry) => entry.productionStatus === 'PRODUCTION_READY'));
  });
});
