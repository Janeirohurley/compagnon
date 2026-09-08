import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { disconnectOAuthServer, hasValidOAuthTokens } from '../../../mcp';
import { resetNotionMcpTools } from '../mcp-tools';

/**
 * Revokes the Notion OAuth authorization on demand.
 *
 * Clears the persisted tokens (plus client info and code verifier) so Notion
 * tools stop loading and the workspace must be authorized again via
 * notion_connect before being used. This is the client-side revocation; if the
 * user wants the integration removed from their Notion workspace too, they do
 * so in Notion (Settings > Connections). Use when the user asks to disconnect,
 * revoke or reset the Notion integration.
 */
export const notionDisconnectTool = createTool({
  id: 'notion_disconnect',
  description:
    "Disconnect the user's Notion workspace from Compagnon: clears the saved OAuth authorization so Notion tools stop loading. Use when not connected any more is wanted, without deleting any Notion content. Ask the user for explicit confirmation before calling this tool, since it revokes the access.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    disconnected: z.boolean(),
    message: z.string(),
  }),
  execute: async (): Promise<{ disconnected: boolean; message: string }> => {
    if (!(await hasValidOAuthTokens('notion'))) {
      return {
        disconnected: false,
        message: 'Notion is not connected, nothing to disconnect.',
      };
    }

    const closed = await disconnectOAuthServer('notion');
    resetNotionMcpTools();

    return {
      disconnected: closed,
      message: closed
        ? 'Notion disconnected. The Notion tools have been removed; connect again via the notion_connect flow to reuse the workspace.'
        : 'Could not disconnect Notion: the OAuth authorization could not be cleared. Please try again.',
    };
  },
});

/**
 * Inert default export for the Mastra fs-agent build (Studio override path).
 * The real runtime tool is the named `notionDisconnectTool` above.
 */
const notionDisconnectToolStub: Record<string, unknown> = {};

export default notionDisconnectToolStub;