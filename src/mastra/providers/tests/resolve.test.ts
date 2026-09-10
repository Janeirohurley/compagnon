// Model resolution tests (TASK-011): TEST-001.
// Env set BEFORE import; the resolver reads it synchronously (env fallback)
// until `refreshProviderCache()` hydrates the registry-backed cache.
import { describe, it, expect } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = 'file:/tmp/compagnon-providers-resolve-test.db';
process.env.APP_ENCRYPTION_KEY = 'test-encryption-key';
process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
delete process.env.OPENROUTER_API_KEY;

const {
  __resetProviderCache,
  getDefaultChatRef,
  getDefaultEmbeddingRef,
  refreshProviderCache,
  resolveChatModel,
  resolveEmbeddingModel,
} = await import('../resolve');

describe('resolveChatModel (TEST-001)', () => {
  it('returns a native router string when no url is present', () => {
    expect(resolveChatModel({ providerId: 'openai', modelId: 'gpt-4o' })).toBe('openai/gpt-4o');
  });

  it('returns an OpenAICompatibleConfig object when a url is present', () => {
    const model = resolveChatModel({
      providerId: 'omniroute',
      modelId: 'gpt-4o-mini',
      url: 'https://api.omniroute.ai/v1',
      apiKey: 'test-key',
    });
    expect(model).toMatchObject({
      providerId: 'omniroute',
      modelId: 'gpt-4o-mini',
      url: 'https://api.omniroute.ai/v1',
      apiKey: 'test-key',
    });
  });

  it('hydrates the registry-backed cache from the seed', async () => {
    __resetProviderCache();
    const cache = await refreshProviderCache();
    expect(cache.chat.url).toBe('https://api.omniroute.ai/v1');
    expect(cache.chat.apiKey).toBe('test-key');

    const model = resolveChatModel(getDefaultChatRef());
    expect(model).toEqual({
      providerId: 'omniroute',
      modelId: 'gpt-4o-mini',
      url: 'https://api.omniroute.ai/v1',
      apiKey: 'test-key',
    });
    expect(typeof model).not.toBe('string');
  });

  it('memoizes the sync env shape until a refresh happens', () => {
    __resetProviderCache();
    expect(getDefaultChatRef().modelId).toBe('gpt-4o-mini');
    expect(getDefaultEmbeddingRef().providerId).toBe('omniroute');
  });
});

describe('resolveEmbeddingModel (TEST-001)', () => {
  it('builds a router embedding model with the registry ref', async () => {
    const embedder = resolveEmbeddingModel(getDefaultEmbeddingRef());
    expect(embedder).toBeInstanceOf(Object);
    expect((embedder as unknown as { provider: string }).provider).toBe('omniroute');
  });
});