import { describe, it, expect, beforeAll } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

let resolveSuggestedAgentId: (suggestedAgent?: string) => string;

describe('plan executor routing to Notion', () => {
  beforeAll(async () => {
    const mod = await import('../../../workflows/plan-executor-workflow');
    resolveSuggestedAgentId = mod.resolveSuggestedAgentId;
  });

  it('routes notion-suggested tasks to the notion agent', () => {
    expect(resolveSuggestedAgentId('notion')).toBe('notion');
  });

  it('routes outline documentation tasks to outline', () => {
    expect(resolveSuggestedAgentId('outline')).toBe('outline');
    expect(resolveSuggestedAgentId('documentation')).toBe('outline');
  });

  it('falls back to companion for unknown agents', () => {
    expect(resolveSuggestedAgentId('developer')).toBe('companion');
    expect(resolveSuggestedAgentId(undefined)).toBe('companion');
  });

  it('is case-insensitive', () => {
    expect(resolveSuggestedAgentId('NOTION')).toBe('notion');
  });
});
