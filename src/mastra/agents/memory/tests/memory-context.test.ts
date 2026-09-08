import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

const { getWorkingMemory, recall } = vi.hoisted(() => ({
  getWorkingMemory: vi.fn(),
  recall: vi.fn(),
}));

vi.mock('../../companion/memory', () => ({
  getCompanionMemory: () => ({ getWorkingMemory, recall }),
}));

const { resolveMemoryIds, sanitizeForMemory, retrieveContext } = await import(
  '../../companion/memory-context'
);

describe('resolveMemoryIds', () => {
  it('uses resourceId when provided', () => {
    expect(resolveMemoryIds({ resourceId: 'user-1' })).toEqual({ resourceId: 'user-1' });
  });

  it('falls back to userId', () => {
    expect(resolveMemoryIds({ userId: 'user-2' })).toEqual({ resourceId: 'user-2' });
  });

  it('falls back to resourceId over userId', () => {
    expect(resolveMemoryIds({ resourceId: 'res-1', userId: 'user-3' })).toEqual({
      resourceId: 'res-1',
    });
  });

  it('defaults to anonymous', () => {
    expect(resolveMemoryIds({})).toEqual({ resourceId: 'anonymous' });
  });
});

describe('sanitizeForMemory', () => {
  it('accepts normal text', () => {
    expect(sanitizeForMemory('backend de documentation préféré: outline')).toBe(
      'backend de documentation préféré: outline',
    );
  });

  it('rejects OpenAI keys', () => {
    expect(sanitizeForMemory('sk-abcdefghijklmnopqrstuvwxyz123456')).toBeNull();
  });

  it('rejects GitHub personal tokens', () => {
    expect(sanitizeForMemory('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toBeNull();
  });

  it('rejects PEM secrets', () => {
    expect(sanitizeForMemory('-----BEGIN PRIVATE KEY-----\n...')).toBeNull();
  });
});

describe('retrieveContext', () => {
  beforeEach(() => {
    getWorkingMemory.mockReset();
    recall.mockReset();
  });

  it('returns an empty section when there is nothing to remember', async () => {
    getWorkingMemory.mockResolvedValue(null);
    recall.mockResolvedValue({ messages: [], total: 0 });
    const context = await retrieveContext('rien', { resourceId: 'anonymous' });
    expect(context).toBe('');
  });

  it('builds a context section from recall and working memory', async () => {
    getWorkingMemory.mockResolvedValue(
      '# Préférences\n- documentation-backend: outline',
    );
    recall.mockResolvedValue({
      messages: [{ role: 'user', content: 'J’utilise notion.' }],
      total: 1,
    });
    const context = await retrieveContext('outil de documentation', {
      resourceId: 'anonymous',
    });
    expect(context).toContain('## Contexte mémoire');
    expect(context).toContain('- documentation-backend: outline');
    expect(context).toContain('J’utilise notion.');
  });

  it('is resilient to storage failures', async () => {
    getWorkingMemory.mockRejectedValue(new Error('db down'));
    recall.mockRejectedValue(new Error('db down'));
    await expect(retrieveContext('x', { resourceId: 'anonymous' })).resolves.toBe('');
  });
});