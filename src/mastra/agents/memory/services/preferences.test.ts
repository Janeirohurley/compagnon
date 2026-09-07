import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SemanticMemory } from '../domain/types';

const { search, remember, supersedeMemory } = vi.hoisted(() => ({
  search: vi.fn(),
  remember: vi.fn(),
  supersedeMemory: vi.fn(),
}));

vi.mock('./memory-manager', () => ({
  memoryManager: {
    search,
    remember,
    supersedeMemory,
  },
}));

const { getPreference, setPreference } = await import('./preferences');

function activeMemory(value: string, id: string): SemanticMemory {
  return {
    id,
    scope: 'global',
    subject: 'documentation-backend',
    predicate: 'prefers',
    value,
    confidence: 0.95,
    source: { type: 'user' },
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    useCount: 0,
  };
}

describe('memory preferences', () => {
  beforeEach(() => {
    search.mockReset();
    remember.mockReset();
    supersedeMemory.mockReset();
  });

  it('returns null when no preference matches', async () => {
    search.mockResolvedValue([]);
    expect(await getPreference('documentation-backend')).toBeNull();
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'documentation-backend', scope: 'global' }),
    );
  });

  it('returns the active preference value', async () => {
    search.mockResolvedValue([
      { type: 'semantic', id: 'm1', score: 0.95, data: activeMemory('notion', 'm1') },
    ]);
    expect(await getPreference('documentation-backend')).toBe('notion');
  });

  it('sets a new preference when none exists', async () => {
    search.mockResolvedValue([]);
    remember.mockResolvedValue(activeMemory('outline', 'new'));
    await setPreference('documentation-backend', 'outline', 'user');
    expect(remember).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'documentation-backend',
        predicate: 'prefers',
        value: 'outline',
        scope: 'global',
      }),
    );
    expect(supersedeMemory).not.toHaveBeenCalled();
  });

  it('supersedes an existing preference when the value changes', async () => {
    search.mockResolvedValueOnce([
      { type: 'semantic', id: 'm1', score: 0.95, data: activeMemory('outline', 'm1') },
    ]);
    search.mockResolvedValueOnce([
      { type: 'semantic', id: 'm1', score: 0.95, data: activeMemory('outline', 'm1') },
    ]);
    supersedeMemory.mockResolvedValue(activeMemory('notion', 'm2'));

    await setPreference('documentation-backend', 'notion', 'user');

    expect(supersedeMemory).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ subject: 'documentation-backend', value: 'notion' }),
    );
    expect(remember).not.toHaveBeenCalled();
  });
});
