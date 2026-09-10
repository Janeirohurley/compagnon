// Provider Registry tests (TASK-011): TEST-002/003/004/005.
// Env must be set BEFORE dynamic import because the registry captures
// `TURSO_DATABASE_URL` at load time and seeds from OMNIROUTE_* env once.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';

// The registry is a per-process singleton capturing TURSO_DATABASE_URL at load
// time, and the DB file persists across runs with non-idempotent "defaults".
// Wiping the file before the (dynamic) registry import keeps the suite
// idempotent regardless of how the previous run ended.
const DB_FILE = '/tmp/compagnon-providers-test.db';
process.env.NODE_ENV = 'test';
process.env.TURSO_DATABASE_URL = `file:${DB_FILE}`;
for (const suffix of ['', '-wal', '-shm']) {
  const path = `${DB_FILE}${suffix}`;
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
process.env.APP_ENCRYPTION_KEY = 'test-encryption-key';
process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
delete process.env.OPENROUTER_API_KEY;

const {
  getProvider,
  listProviders,
  probeModels,
  removeProvider,
  setDefaultProvider,
  toPublicProvider,
  upsertProvider,
} = await import('../registry');

describe('registry seed (TEST-002)', () => {
  it('seedis the default providers from env, idempotently', async () => {
    const all = await listProviders();
    const omni = all.find((p) => p.id === 'omniroute');
    expect(omni).toBeTruthy();
    expect(omni!.kind).toBe('openai_compatible');
    expect(omni!.capabilities).toEqual(['chat', 'embeddings']);
    expect(omni!.chatModelId).toBe('gpt-4o-mini');
    expect(omni!.isDefaultChat).toBe(true);
    // OPENROUTER_API_KEY absent -> OmniRoute also owns embeddings.
    expect(omni!.isDefaultEmbedding).toBe(true);

    const again = await listProviders();
    expect(again.filter((p) => p.id === all[0]!.id)).toHaveLength(1);
  });

  it('round-trips the apiKey (decrypted equals env value)', async () => {
    const omni = await getProvider('omniroute');
    expect(omni!.apiKey).toBe('test-key');
  });
});

describe('public projection (TEST-004)', () => {
  it('never leaks the apiKey', async () => {
    const omni = (await getProvider('omniroute'))!;
    const pub = toPublicProvider(omni);
    expect('apiKey' in pub).toBe(false);
    expect(JSON.stringify(pub)).not.toContain('test-key');
  });
});

describe('upsert / defaults / delete guard (TEST-005)', () => {
  beforeAll(async () => {
    await upsertProvider({
      id: 'custom-a',
      name: 'Local GPT',
      providerId: 'custom-gpt',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'local',
      capabilities: ['chat'],
      chatModelId: 'llama3',
      models: ['llama3'],
      enabled: true,
    });
  });

  it('creates a custom provider and lists it', async () => {
    const list = await listProviders();
    expect(list.some((p) => p.id === 'custom-a')).toBe(true);
    const custom = (await getProvider('custom-a'))!;
    expect(custom.baseUrl).toBe('http://localhost:11434/v1');
    expect(custom.chatModelId).toBe('llama3');
  });

  it('switches the chat default and refuses to remove the last default', async () => {
    await setDefaultProvider('custom-a', 'chat');
    const updated = (await getProvider('custom-a'))!;
    expect(updated.isDefaultChat).toBe(true);
    const omni = (await getProvider('omniroute'))!;
    expect(omni.isDefaultChat).toBe(false);

    await expect(removeProvider('custom-a')).rejects.toThrow(/last default chat/i);

    // A second chat-capable default lets us remove the original one.
    await upsertProvider({
      id: 'chat-b',
      providerId: 'chat-b',
      baseUrl: 'http://localhost:9999/v1',
      apiKey: 'b',
      capabilities: ['chat'],
      chatModelId: 'm2',
      models: ['m2'],
      enabled: true,
    });
    await setDefaultProvider('chat-b', 'chat');
    await expect(removeProvider('custom-a')).resolves.toBeUndefined();
    expect(await getProvider('custom-a')).toBeNull();
  });
});

describe('probeModels (TEST-003)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses GET {baseUrl}/models into a ProbeResult', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: '' }] }),
      }),
    );
    const result = await probeModels('https://api.example.com/v1', 'secret');
    expect(result.models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const [, init] = vi.mocked(fetch).mock.calls[0] as [RequestInfo | URL, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret' });
  });

  it('propagates a failing HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(probeModels('https://api.example.com/v1')).rejects.toThrow(/HTTP 401/);
  });
});