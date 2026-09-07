import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { connectOAuthServer } from '../../../mcp';

/**
 * Establishes the OAuth connection to the Notion MCP server on demand.
 *
 * Notion's official MCP uses interactive OAuth (no static token). This tool
 * drives the flow once, persisting the resulting tokens so future boots load
 * the Notion tools automatically. It is a setup tool, not a data operation.
 */
export const notionConnectTool = createTool({
  id: 'notion_connect',
  description:
    "Connect the user's Notion workspace to Compagnon via OAuth. Prompts the user to authorize Notion (opens/provides an authorization URL). Use this when Notion is not connected yet (NOTION_NOT_CONNECTED) so that Notion tools become available. Once connected, it persists the authorization and Notion operations can proceed.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    connected: z.boolean(),
    toolCount: z.number(),
    message: z.string(),
  }),
  execute: async (): Promise<{ connected: boolean; toolCount: number; message: string }> => {
    const tools = await connectOAuthServer('notion');
    const toolCount = Object.keys(tools).length;

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
