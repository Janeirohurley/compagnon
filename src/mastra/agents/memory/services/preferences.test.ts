import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getWorkingMemory, updateWorkingMemory } = vi.hoisted(() => ({
  getWorkingMemory: vi.fn(),
  updateWorkingMemory: vi.fn(),
}));

vi.mock('../../companion/memory', () => ({
  getCompanionMemory: () => ({ getWorkingMemory, updateWorkingMemory }),
}));

const { getPreference, setPreference } = await import('./preferences');

const WM_EMPTY = '# Préférences\n- documentation-backend: ';

function wmWith(value: string): string {
  return `# Préférences\n- documentation-backend: ${value}\n- pret-de-repondre: prudent`;
}

describe('memory preferences (working memory)', () => {
  beforeEach(() => {
    getWorkingMemory.mockReset();
    updateWorkingMemory.mockReset();
    getWorkingMemory.mockResolvedValue(WM_EMPTY);
  });

  it('returns null when no preference matches', async () => {
    getWorkingMemory.mockResolvedValue('# Préférences\n- pret-de-repondre: prudent');
    expect(await getPreference('documentation-backend')).toBeNull();
  });

  it('returns the active preference value', async () => {
    getWorkingMemory.mockResolvedValue(wmWith('notion'));
    expect(await getPreference('documentation-backend')).toBe('notion');
  });

  it('sets a new preference line into an existing block', async () => {
    getWorkingMemory.mockResolvedValue(WM_EMPTY);
    await setPreference('documentation-backend', 'outline', 'user');
    expect(updateWorkingMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'anonymous',
      }),
    );
    const { workingMemory } = updateWorkingMemory.mock.calls[0][0] as { workingMemory: string };
    expect(workingMemory).toContain('- documentation-backend: outline');
  });

  it('overwrites the previous value for the same subject', async () => {
    getWorkingMemory.mockResolvedValue(wmWith('outline'));
    await setPreference('documentation-backend', 'notion', 'user');
    const { workingMemory } = updateWorkingMemory.mock.calls[0][0] as { workingMemory: string };
    expect(workingMemory).toContain('- documentation-backend: notion');
    expect(workingMemory).not.toContain('- documentation-backend: outline');
    expect(workingMemory).toContain('- pret-de-repondre: prudent');
  });

  it('rejects a secret value', async () => {
    await expect(
      setPreference('documentation-backend', 'sk-abcdefghijklmnopqrstuvwxyz123456'),
    ).rejects.toThrow('secret pattern detected');
    expect(updateWorkingMemory).not.toHaveBeenCalled();
  });
});