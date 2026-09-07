import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';

// Real Notion MCP requires OAuth credentials that are not available in CI. Mock
// the MCP registry layer so the agent's integration surface can be tested
// hermetically. Real end-to-end operations (search/read/create against a real
// workspace) remain an integration test that needs a connected workspace.
const connectOAuthServer = vi.fn();
const getMcpToolsForAgent = vi.fn(async () => ({}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, existsSync: vi.fn(actual.existsSync) };
});

vi.mock('../../../mcp', () => ({
  getMcpToolsForAgent,
  connectOAuthServer,
}));

let notionConnectTool: any;
let getNotionConfig: (() => ReturnType<typeof import('../config')['getNotionConfig']>) | undefined;
let requireNotionConfig: (() => void) | undefined;
let notionInstructions: string;
let companionInstructions: string;
let companionAgent: any;
let notionTaskResultSchema: any;
let NotionErrorCode: Record<string, string>;
let existsSync: Mock;

describe('Notion Agent integration with Compagnon', () => {
  beforeAll(async () => {
    ({ notionConnectTool } = await import('../tools/connect'));
    const config = await import('../config');
    getNotionConfig = config.getNotionConfig;
    requireNotionConfig = config.requireNotionConfig;
    ({ notionInstructions } = await import('../notion-instructions'));
    const schemas = await import('../domain/schemas');
    notionTaskResultSchema = schemas.notionTaskResultSchema;
    const enums = await import('../domain/enums');
    NotionErrorCode = enums.NotionErrorCode;
    ({ companionInstructions } = await import('../../../instructions/companion-instructions'));
    ({ companionAgent } = await import('../../companion/agent'));
    const fs = await import('node:fs');
    existsSync = fs.existsSync as Mock;
  });

  beforeEach(() => {
    connectOAuthServer.mockReset();
  });

  it('is discoverable by Compagnon through the subagent registry', async () => {
    const agents = await companionAgent.listAgents();
    expect(agents.notion).toBeDefined();
    expect(agents.notion?.id).toBe('notion');
    expect(agents.notion?.name).toBe('Notion Agent');
  });

  it('mandates Compagnon to delegate Notion operations to the notion subagent', () => {
    expect(companionInstructions).toContain('Notion Agent Delegation');
    expect(companionInstructions).toContain('MANDATORY ROUTING');
    expect(companionInstructions).toContain('ALWAYS delegate to the notion subagent FIRST');
    expect(companionInstructions).toContain('Never auto-sync documents between Outline and Notion');
  });

  it('connects via the Notion MCP layer (not a custom Notion API)', async () => {
    connectOAuthServer.mockResolvedValue({ a: 1, b: 2 });
    const out = await notionConnectTool.execute({});
    expect(connectOAuthServer).toHaveBeenCalledWith('notion');
    expect(out.connected).toBe(true);
    expect(out.toolCount).toBe(2);
  });

  it('reports honestly when authorization returns no tools', async () => {
    connectOAuthServer.mockResolvedValue({});
    const out = await notionConnectTool.execute({});
    expect(out.connected).toBe(false);
    expect(out.toolCount).toBe(0);
    expect(out.message).toContain('no tools were returned');
  });

  it('requires a connected workspace before using Notion tools', () => {
    existsSync.mockReturnValue(false);
    const config = getNotionConfig?.();
    expect(config?.connected).toBe(false);
    expect(config?.oauthTokensPresent).toBe(false);
    expect(config?.degradeMode).toBe(true);
    expect(() => requireNotionConfig?.()).toThrow(/not connected/i);
  });

  it('reports connected when OAuth tokens are persisted', () => {
    existsSync.mockReturnValue(true);
    const config = getNotionConfig?.();
    expect(config?.connected).toBe(true);
    expect(config?.degradeMode).toBe(false);
    expect(() => requireNotionConfig?.()).not.toThrow();
  });

  it('honors the NOTION_OAUTH_REDIRECT_URL override', () => {
    const previous = process.env.NOTION_OAUTH_REDIRECT_URL;
    process.env.NOTION_OAUTH_REDIRECT_URL = 'http://localhost:9999/callback';
    const config = getNotionConfig?.();
    expect(config?.redirectUrl).toBe('http://localhost:9999/callback');
    if (previous === undefined) {
      delete process.env.NOTION_OAUTH_REDIRECT_URL;
    } else {
      process.env.NOTION_OAUTH_REDIRECT_URL = previous;
    }
  });

  it('covers the required error taxonomy', () => {
    expect(NotionErrorCode.NOT_CONNECTED).toBe('NOTION_NOT_CONNECTED');
    expect(NotionErrorCode.PERMISSION_DENIED).toBe('NOTION_PERMISSION_DENIED');
    expect(NotionErrorCode.RESOURCE_NOT_FOUND).toBe('NOTION_RESOURCE_NOT_FOUND');
    expect(NotionErrorCode.RATE_LIMITED).toBe('NOTION_RATE_LIMITED');
    expect(NotionErrorCode.MCP_UNAVAILABLE).toBe('NOTION_MCP_UNAVAILABLE');
    expect(NotionErrorCode.OPERATION_FAILED).toBe('NOTION_OPERATION_FAILED');
  });

  it('forbids bypassing MCP permissions and inventing success', () => {
    expect(notionInstructions).toContain('Never bypass MCP permissions');
    expect(notionInstructions).toContain('Never claim a Notion operation succeeded unless the MCP confirmed it');
  });

  it('enforces search-before-create and read-before-write in the instructions', () => {
    expect(notionInstructions).toContain('Never create multiple identical pages');
    expect(notionInstructions).toContain('Read');
    expect(notionInstructions).toContain('Search');
  });

  it('returns a validated error result to Compagnon', () => {
    const parsed = notionTaskResultSchema.parse({
      status: 'failed',
      operation: 'update',
      summary: 'Could not update the page.',
      errors: [{ code: 'NOTION_RATE_LIMITED', message: 'Too many requests' }],
    });
    expect(parsed.status).toBe('failed');
    expect(parsed.operation).toBe('update');
    expect(parsed.errors?.[0]?.code).toBe('NOTION_RATE_LIMITED');
  });

  it('rejects unknown error codes in results', () => {
    expect(() =>
      notionTaskResultSchema.parse({
        status: 'failed',
        operation: 'update',
        summary: 'x',
        errors: [{ code: 'NOTION_UNKNOWN', message: 'x' }],
      }),
    ).toThrow();
  });

  it('validates a successful search result', () => {
    const parsed = notionTaskResultSchema.parse({
      status: 'success',
      operation: 'search',
      summary: 'Found 1 page.',
      result: { pages: [{ id: 'p-1', title: 'Architecture' }] },
    });
    expect(parsed.status).toBe('success');
    expect(parsed.result).toEqual({ pages: [{ id: 'p-1', title: 'Architecture' }] });
  });
});