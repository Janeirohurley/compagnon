import { describe, it, expect, beforeEach } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

const memoryModule = await import('../memory');

describe('buildCompanionMemory', () => {
  beforeEach(() => {
    delete (memoryModule as any).__singleton;
  });

  it('instantiates a Memory backed by the companion storage/vector ids', () => {
    const memory = memoryModule.buildCompanionMemory();
    const internals = memory as unknown as {
      _hasOwnStorage: boolean;
      _storage: { id: string };
      vector: { id: string };
      embedder: { constructor: { name: string } };
    };

    expect(internals._hasOwnStorage).toBe(true);
    expect(internals._storage.id).toBe('companion-memory-storage');
    expect(internals.vector.id).toBe('companion-memory-vector');
    expect(internals.embedder.constructor.name).toBe('ModelRouterEmbeddingModel');
  });

  it('configures semantic recall, resource-scoped working memory and observational memory', () => {
    const memory = memoryModule.buildCompanionMemory();
    const config = (memory as unknown as {
      threadConfig: {
        semanticRecall: { scope: string; topK: number };
        workingMemory: { enabled: boolean; scope: string; template: string };
        observationalMemory: { temporalMarkers: boolean };
      };
    }).threadConfig;

    expect(config.semanticRecall).toMatchObject({ scope: 'resource', topK: 4 });
    expect(config.workingMemory).toMatchObject({ enabled: true, scope: 'resource' });
    expect(config.workingMemory.template.startsWith('# Faits')).toBe(true);
    expect(config.observationalMemory).toMatchObject({ temporalMarkers: true });
    expect(config.workingMemory.template).toContain('# Préférences');
    expect(config.workingMemory.template).toContain('# Décisions');
    expect(config.workingMemory.template).toContain('# Procédures');
  });
});

describe('getCompanionMemory singleton', () => {
  it('returns the same instance across calls', () => {
    const a = memoryModule.getCompanionMemory();
    const b = memoryModule.getCompanionMemory();
    expect(a).toBe(b);
  });
});