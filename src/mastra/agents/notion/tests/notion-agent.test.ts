import { describe, it, expect, beforeAll } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

let notionAgent: any;
let notionInstructions: string;
let notionConnectTool: any;

describe('Notion Agent', () => {
  beforeAll(async () => {
    const mod = await import('../index');
    notionAgent = mod.notionAgent;
    notionInstructions = mod.notionInstructions;
    notionConnectTool = mod.notionConnectTool;
  });

  it('is constructed with the notion id and name', () => {
    expect(notionAgent?.id).toBe('notion');
    expect(notionAgent?.name).toBe('Notion Agent');
  });

  it('has system instructions', () => {
    expect(notionInstructions).toBeTruthy();
    expect(notionInstructions).toContain('Notion Agent');
  });

  it('exposes the notion_connect setup tool', async () => {
    expect(notionConnectTool).toBeTruthy();
    const tools = await notionAgent?.listTools();
    expect(Object.keys(tools ?? {})).toContain('notion_connect');
  });

  it('defines the search-before-create and read-before-write rules in instructions', () => {
    expect(notionInstructions).toContain('Search');
    expect(notionInstructions).toContain('Never create multiple identical pages');
    expect(notionInstructions).toContain('Never claim a Notion operation succeeded');
  });
});
