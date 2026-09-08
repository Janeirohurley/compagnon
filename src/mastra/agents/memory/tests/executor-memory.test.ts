import { describe, it, expect, beforeAll } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
process.env.RESEARCH_TRACE_DISABLED = 'true';

import type { MemoryTaskResult } from '../../memory';
import type { PlanTask } from '../../planner/domain/types';

type MemoryTaskReport =
  | { ok: true; output: string; acceptance: { criterion: string; met: boolean; evidence: string }[] }
  | { ok: false; error: string };

let resolveSuggestedAgentId: (suggestedAgent?: string) => string;
let inferMemoryOperation: (text: string) => string;
let mapMemoryResultToReport: (
  result: MemoryTaskResult,
  task: PlanTask,
) => MemoryTaskReport;

const task: PlanTask = {
  id: 'mem-1',
  title: 'Mémoriser la configuration documentation-backend',
  description: 'Persister la préférence de backend de documentation.',
  type: 'verification',
  status: 'pending',
  priority: 'medium',
  complexity: 'low',
  dependencies: [],
  resources: ['memory'],
  expectedOutputs: ['Préférence stockée'],
  acceptanceCriteria: ['La préférence est dans la mémoire de travail'],
  suggestedAgent: 'memory',
  risks: [],
};

function makeResult(status: MemoryTaskResult['status']): MemoryTaskResult {
  return {
    taskId: 'mem-1',
    status,
    summary:
      status === 'success'
        ? 'Préférence documentation-backend: outline stockée.'
        : status === 'partial'
          ? 'Préférence partiellement persistée.'
          : status === 'blocked'
            ? 'Outils mémoire indisponibles.'
            : 'Persistance impossible.',
    confidence: status === 'success' ? 1 : status === 'partial' ? 0.6 : 0,
  };
}

describe('plan executor routing to the memory agent', () => {
  beforeAll(async () => {
    const mod = await import('../../../workflows/plan-executor-workflow');
    resolveSuggestedAgentId = mod.resolveSuggestedAgentId;
    inferMemoryOperation = mod.inferMemoryOperation;
    mapMemoryResultToReport = mod.mapMemoryResultToReport;
  });

  it('routes memory-suggested tasks to the memory agent', () => {
    expect(resolveSuggestedAgentId('memory')).toBe('memory');
  });
});

describe('inferMemoryOperation', () => {
  beforeAll(async () => {
    const mod = await import('../../../workflows/plan-executor-workflow');
    inferMemoryOperation = mod.inferMemoryOperation;
  });

  it('maps forget/oubli wording to forget', () => {
    expect(inferMemoryOperation('Oublier la préférence documentation-backend')).toBe('forget');
    expect(inferMemoryOperation('Delete the stored procedure')).toBe('forget');
  });

  it('maps find/recall wording to find', () => {
    expect(inferMemoryOperation('Retrouver les décisions concernant Mastra')).toBe('find');
    expect(inferMemoryOperation('List the stored procedures')).toBe('find');
  });

  it('defaults to store', () => {
    expect(inferMemoryOperation('Mémoriser la configuration documentation-backend')).toBe('store');
    expect(inferMemoryOperation('Remember the chosen consent mode')).toBe('store');
  });
});

describe('mapMemoryResultToReport', () => {
  beforeAll(async () => {
    const mod = await import('../../../workflows/plan-executor-workflow');
    mapMemoryResultToReport = mod.mapMemoryResultToReport;
  });

  it('maps a success result to a completed report with all criteria met', () => {
    const report = mapMemoryResultToReport(makeResult('success'), task);
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.output).toContain('stockée');
      expect(report.acceptance).toHaveLength(1);
      expect(report.acceptance.every((entry) => entry.met)).toBe(true);
      expect(report.acceptance[0].evidence).toContain('Memory success');
    }
  });

  it('maps a partial result to a completed report', () => {
    const report = mapMemoryResultToReport(makeResult('partial'), task);
    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.acceptance[0].evidence).toContain('Memory partial');
    }
  });

  it('maps a failed result to a failed report with the summary as reason', () => {
    const report = mapMemoryResultToReport(makeResult('failed'), task);
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.error).toBe('Persistance impossible.');
    }
  });

  it('maps a blocked result to a failed report', () => {
    const report = mapMemoryResultToReport(makeResult('blocked'), task);
    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.error).toContain('indisponibles');
    }
  });
});