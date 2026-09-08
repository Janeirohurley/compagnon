import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { connectOAuthServer, hasValidOAuthTokens } from '../../../mcp';
import { seedNotionMcpTools } from '../mcp-tools';

/**
 * Establishes the OAuth connection to the Notion MCP server on demand.
 *
 * Notion's official MCP uses interactive OAuth (no static token). This tool
 * drives the flow once, persisting the resulting tokens so future boots load
 * the Notion tools automatically. The authorization URL is opened in the
 * user's browser automatically; the flow waits until the user authorizes
 * (or gives up). It is a setup tool, not a data operation.
 */
export const notionConnectTool = createTool({
  id: 'notion_connect',
  description:
    "Connect the user's Notion workspace to Compagnon via OAuth. Triggers the interactive OAuth flow: the authorization URL opens in a new browser tab and the user completes it, then persists the authorization. Use this when Notion is not connected yet (NOTION_NOT_CONNECTED) so that Notion tools become available. Ask the user for explicit confirmation before calling this tool. Once connected, Notion operations can proceed.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    connected: z.boolean(),
    toolCount: z.number(),
    message: z.string(),
  }),
  execute: async (): Promise<{ connected: boolean; toolCount: number; message: string }> => {
    if (await hasValidOAuthTokens('notion')) {
      return {
        connected: true,
        toolCount: -1,
        message: 'Notion is already connected.',
      };
    }

    const tools = await connectOAuthServer('notion');
    const toolCount = Object.keys(tools).length;

    // Seed the agent's dynamic tool cache so the Notion MCP tools become
    // available immediately, without waiting for a server restart.
    seedNotionMcpTools(tools);

    return {
      connected: toolCount > 0,
      toolCount,
      message:
        toolCount > 0
          ? `Notion connected successfully (${toolCount} MCP tools available).`
          : 'Notion authorization completed but no tools were returned. Please check the Notion workspace permissions.',
    };
  },
});

/**
 * Inert default export for the Mastra fs-agent build (Studio override path).
 * The real runtime tool is the named `notionConnectTool` above, registered by
 * the agent directly; this stub only satisfies the bundler's default-import.
 */
const notionConnectToolStub: Record<string, unknown> = {};

export default notionConnectToolStub;
