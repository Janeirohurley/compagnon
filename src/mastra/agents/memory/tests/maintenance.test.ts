import { describe, it, expect } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
process.env.RESEARCH_TRACE_DISABLED = 'true';

const { normalizeWorkingMemory } = await import('../../../workflows/memory-maintenance-workflow');

describe('normalizeWorkingMemory', () => {
  it('dedupes identical lines within a block', () => {
    const wm = `# Faits
- backend: mastra
- backend: mastra
# Préférences
- documentation-backend: outline`;
    const { normalized, deduped, changed } = normalizeWorkingMemory(wm);
    expect(deduped).toBe(1);
    expect(changed).toBe(true);
    expect(normalized).toBe(`# Faits
- backend: mastra
# Préférences
- documentation-backend: outline
`);
  });

  it('drops secret-pattern lines and counts them', () => {
    const wm = `# Faits
- api key: sk-abcdefghijklmnopqrstuvwxyz123456
- backend: mastra`;
    const { normalized, removedSecrets, changed } = normalizeWorkingMemory(wm);
    expect(removedSecrets).toBe(1);
    expect(changed).toBe(true);
    expect(normalized).toContain('- backend: mastra');
    expect(normalized).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
  });

  it('normalizes heading case/accents to canonical headings', () => {
    const wm = `# faits
- backend: mastra
# PREFERENCES
- documentation-backend: outline`;
    const { normalized } = normalizeWorkingMemory(wm);
    expect(normalized).toContain('# Faits');
    expect(normalized).toContain('# Préférences');
  });

  it('reports no change for a clean, deduped document', () => {
    const wm = `# Faits
- backend: mastra
# Préférences
- documentation-backend: outline
`;
    const { changed, deduped, removedSecrets, normalized } = normalizeWorkingMemory(wm);
    expect(changed).toBe(false);
    expect(deduped).toBe(0);
    expect(removedSecrets).toBe(0);
    expect(normalized).toBe(wm);
  });

  it('collapses consecutive blank lines', () => {
    const { normalized, changed } = normalizeWorkingMemory('# Faits\n\n\n- backend: mastra');
    expect(changed).toBe(true);
    expect(normalized).toBe(`# Faits
- backend: mastra
`);
  });
});