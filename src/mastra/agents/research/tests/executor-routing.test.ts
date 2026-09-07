import { describe, it, expect, beforeAll } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
process.env.RESEARCH_TRACE_DISABLED = 'true';

import type { ResearchResult } from '../domain/types';
import type { PlanTask } from '../../planner/domain/types';

type ResearchTaskReport =
  | { ok: true; output: string; acceptance: { criterion: string; met: boolean; evidence: string }[] }
  | { ok: false; error: string };

let resolveSuggestedAgentId: (suggestedAgent?: string) => string;
let mapResearchResultToReport: (
  result: ResearchResult,
  task: PlanTask,
) => ResearchTaskReport;

const task: PlanTask = {
  id: 'task-1',
  title: 'Vérifier la documentation Notion actuelle',
  description: 'Confirmer la procédure d’intégration et les permissions disponibles.',
  type: 'research',
  status: 'pending',
  priority: 'high',
  complexity: 'medium',
  dependencies: [],
  resources: ['web-search'],
  expectedOutputs: ['Confirmation de la procédure'],
  acceptanceCriteria: ['URL de création confirmée', 'Liste des permissions vérifiée'],
  suggestedAgent: 'research',
  risks: [],
};

function makeResult(status: ResearchResult['status']): ResearchResult {
  return {
    status,
    question: task.title,
    answer:
      status === 'blocked' || status === 'failed'
        ? ''
        : 'La procédure d’intégration Notion est confirmée.',
    executiveSummary: 'Résumé exécutif.',
    findings: [],
    evidence: [],
    sources: [
      {
        id: 'src-1',
        url: 'https://www.notion.so/my-integrations',
        title: 'My integrations',
        category: 'official_documentation',
        accessedAt: '2026-09-07T00:00:00.000Z',
      },
    ],
    contradictions: [],
    uncertainties: [],
    errors:
      status === 'blocked'
        ? ['Research tools are unavailable.']
        : status === 'failed'
          ? ['Recherche impossible.']
          : undefined,
    limits: {
      requestedDepth: 'quick',
      maxIterations: 1,
      maxSearches: 2,
      maxReads: 3,
      maxRuntimeMs: 60000,
      iterationsUsed: 1,
      searchesUsed: 1,
      readsUsed: 0,
      stoppedReason: status === 'blocked' ? 'no_tools' : status === 'failed' ? 'failed' : 'completed',
    },
    researchedAt: '2026-09-07T00:00:00.000Z',
  };
}

describe('plan executor routing to the research agent', () => {
  beforeAll(async () => {
    const mod = await import('../../../workflows/plan-executor-workflow');
    resolveSuggestedAgentId = mod.resolveSuggestedAgentId;
    mapResearchResultToReport = mod.mapResearchResultToReport;
  });

  it('routes research-suggested tasks to the research agent', () => {
    expect(resolveSuggestedAgentId('research')).toBe('research');
  });

  it('falls back to companion when no specialist is suggested', () => {
    expect(resolveSuggestedAgentId(undefined)).toBe('companion');
  });
});

describe('mapResearchResultToReport', () => {
  beforeAll(async () => {
    const mod = await import('../../../workflows/plan-executor-workflow');
    mapResearchResultToReport = mod.mapResearchResultToReport;
  });

  it('maps a success result to a completed report with all criteria met', () => {
    const report = mapResearchResultToReport(makeResult('success'), task);
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.output).toContain('confirmée');
      expect(report.acceptance).toHaveLength(2);
      expect(report.acceptance.every((entry) => entry.met)).toBe(true);
      expect(report.acceptance[0].evidence).toContain('Research success');
    }
  });

  it('maps a partial result to a completed report (caveats stay in output)', () => {
    const report = mapResearchResultToReport(makeResult('partial'), task);
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.acceptance.every((entry) => entry.met)).toBe(true);
      expect(report.acceptance[0].evidence).toContain('Research partial');
    }
  });

  it('maps a blocked result to a failed report with the blocked reason', () => {
    const report = mapResearchResultToReport(makeResult('blocked'), task);
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.error).toContain('tools');
    }
  });

  it('maps a failed result to a failed report with the error', () => {
    const report = mapResearchResultToReport(makeResult('failed'), task);
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.error).toBe('Recherche impossible.');
    }
  });
});