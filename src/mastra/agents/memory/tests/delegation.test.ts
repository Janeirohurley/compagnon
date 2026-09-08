import { describe, it, expect } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

const { buildMemoryDelegationPrompt, parseMemoryTaskResult } = await import('../delegation');
import type { MemoryOperation } from '../delegation';

function task(operation: MemoryOperation, objective = 'Mémoriser X') {
  return {
    taskId: 't1',
    operation,
    objective,
    scope: { task: 'objectif plan' },
    context: { focus: 'memoire' },
    expectedOutput: 'done',
  };
}

describe('buildMemoryDelegationPrompt', () => {
  it('selects memory_find for the find operation', () => {
    const prompt = buildMemoryDelegationPrompt(task('find', 'Retrouver la préférence de docs'));
    expect(prompt).toContain('Operation: memory_find');
    expect(prompt).toContain('Retrouver la préférence de docs');
  });

  it('selects memory_store for the store operation', () => {
    const prompt = buildMemoryDelegationPrompt(task('store', 'Mémoriser la configuration'));
    expect(prompt).toContain('Operation: memory_store');
  });

  it('maps the legacy remember operation onto memory_store', () => {
    const prompt = buildMemoryDelegationPrompt(task('remember', 'Mémoriser la configuration'));
    expect(prompt).toContain('Operation: memory_store');
  });

  it('selects memory_forget for the forget operation', () => {
    const prompt = buildMemoryDelegationPrompt(task('forget', 'Oublier la préférence docs'));
    expect(prompt).toContain('Operation: memory_forget');
  });

  it('never emits a JSON instruction — it answers in STATUS/SUMMARY', () => {
    const prompt = buildMemoryDelegationPrompt(task('store'));
    expect(prompt).not.toContain('"output"');
    expect(prompt).toContain('STATUS: success | partial | failed | blocked');
    expect(prompt).toContain('SUMMARY:');
  });
});

describe('parseMemoryTaskResult', () => {
  it('parses a success STATUS/SUMMARY answer into a structured status', () => {
    const result = parseMemoryTaskResult('STATUS: success\nSUMMARY: Préférence stockée.');
    expect(result.status).toBe('success');
    expect(result.summary).toBe('Préférence stockée.');
    expect(result.confidence).toBe(1);
  });

  it('parses partial with reduced confidence', () => {
    const result = parseMemoryTaskResult('STATUS: partial\nSUMMARY: Partiellement persisté.');
    expect(result.status).toBe('partial');
    expect(result.confidence).toBe(0.6);
  });

  it('parses failed with zero confidence', () => {
    const result = parseMemoryTaskResult('STATUS: failed\nSUMMARY: Persistance impossible.');
    expect(result.status).toBe('failed');
    expect(result.confidence).toBe(0);
  });

  it('does not require JSON — a free-JSON payload without STATUS fails structured', () => {
    const result = parseMemoryTaskResult('{"status":"success","output":"x"}');
    expect(result.status).toBe('failed');
    expect(result.confidence).toBe(0);
  });
});