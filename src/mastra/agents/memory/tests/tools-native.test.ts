import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

const { getWorkingMemory, updateWorkingMemory, recall } = vi.hoisted(() => ({
  getWorkingMemory: vi.fn(),
  updateWorkingMemory: vi.fn(),
  recall: vi.fn(),
}));

vi.mock('../../companion/memory', () => ({
  getCompanionMemory: () => ({ getWorkingMemory, updateWorkingMemory, recall }),
}));

const { memoryFindTool } = await import('../tools/memory-find');
const { memoryStoreTool } = await import('../tools/memory-store');
const { memoryForgetTool } = await import('../tools/memory-forget');

const WM_PREFERENCES =
  '# Préférences\n- documentation-backend: notion\n- pret-de-repondre: prudent';

describe('memory_store', () => {
  beforeEach(() => {
    getWorkingMemory.mockReset();
    updateWorkingMemory.mockReset();
    getWorkingMemory.mockResolvedValue(WM_PREFERENCES);
  });

  it('rejects a secret and never writes', async () => {
    const result = await memoryStoreTool.execute({
      label: 'faits',
      content: 'token: sk-abcdefghijklmnopqrstuvwxyz123456',
      resourceId: 'anonymous',
    });
    expect(result.success).toBe(false);
    expect(updateWorkingMemory).not.toHaveBeenCalled();
  });

  it('appends a new line into the labeled block', async () => {
    const result = await memoryStoreTool.execute({
      label: 'faits',
      subject: 'celery',
      content: 'backend mastra',
      resourceId: 'anonymous',
    });
    expect(result.success).toBe(true);
    const { workingMemory } = updateWorkingMemory.mock.calls[0][0] as {
      workingMemory: string;
    };
    expect(workingMemory).toContain('# Faits');
    expect(workingMemory).toContain('- celery: backend mastra');
    expect(workingMemory).toContain('# Préférences');
  });
});

describe('memory_find', () => {
  beforeEach(() => {
    getWorkingMemory.mockReset();
    recall.mockReset();
  });

  it('propagates the context section and its count', async () => {
    getWorkingMemory.mockResolvedValue('# Préférences\n- pret-de-repondre: prudent');
    recall.mockResolvedValue({
      messages: [{ role: 'user', content: 'Contexte historique.' }],
      total: 1,
    });

    const result = await memoryFindTool.execute({
      query: 'préférences du compagnon',
      resourceId: 'anonymous',
    });
    expect(result.context).toContain('## Contexte mémoire');
    expect(result.context).toContain('- pret-de-repondre: prudent');
    expect(result.count).toBeGreaterThan(0);
    expect(result.resourceId).toBe('anonymous');
  });

  it('returns an empty context when nothing matches', async () => {
    getWorkingMemory.mockResolvedValue(null);
    recall.mockResolvedValue({ messages: [], total: 0 });
    const result = await memoryFindTool.execute({ query: 'rien', resourceId: 'anonymous' });
    expect(result.context).toBe('');
    expect(result.count).toBe(0);
  });
});

describe('memory_forget', () => {
  beforeEach(() => {
    getWorkingMemory.mockReset();
    updateWorkingMemory.mockReset();
  });

  it('removes the whole labeled block', async () => {
    getWorkingMemory.mockResolvedValue(WM_PREFERENCES);
    const result = await memoryForgetTool.execute({
      label: 'preferences',
      resourceId: 'anonymous',
    });
    expect(result.success).toBe(true);
    const { workingMemory } = updateWorkingMemory.mock.calls[0][0] as {
      workingMemory: string;
    };
    expect(workingMemory).not.toContain('# Préférences');
    expect(workingMemory).not.toContain('documentation-backend');
  });

  it('removes a single keyed line and keeps the others', async () => {
    getWorkingMemory.mockResolvedValue(WM_PREFERENCES);
    const result = await memoryForgetTool.execute({
      label: 'preferences',
      key: 'documentation-backend',
      resourceId: 'anonymous',
    });
    expect(result.success).toBe(true);
    const { workingMemory } = updateWorkingMemory.mock.calls[0][0] as {
      workingMemory: string;
    };
    expect(workingMemory).not.toContain('documentation-backend');
    expect(workingMemory).toContain('- pret-de-repondre: prudent');
  });
});