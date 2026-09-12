import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { disconnectOAuthServer, hasValidOAuthTokens } from '../../../mcp';
import { resetNotionMcpTools } from '../mcp-tools';

/**
 * Builds the Notion OAuth disconnection tool bound to a specific workspace, so
 * a workspace revokes its own Notion authorization without touching others.
 *
 * Revokes the OAuth authorization on demand: clears the persisted tokens (plus
 * client info and code verifier) for that workspace so Notion tools stop
 * loading and the workspace must be authorized again via notion_connect before
 * being used. Client-side revocation; if the user wants the integration removed
 * from their Notion workspace too, they do so in Notion (Settings > Connections).
 */
export function createNotionDisconnectTool(workspaceId: string) {
  return createTool({
    id: 'notion_disconnect',
    description:
      "Disconnect the user's Notion workspace from Compagnon: clears the saved OAuth authorization so Notion tools stop loading. Use when not connected any more is wanted, without deleting any Notion content. Ask the user for explicit confirmation before calling this tool, since it revokes the access.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      disconnected: z.boolean(),
      message: z.string(),
    }),
    execute: async (): Promise<{ disconnected: boolean; message: string }> => {
      if (!(await hasValidOAuthTokens(workspaceId, 'notion'))) {
        return {
          disconnected: false,
          message: 'Notion is not connected for this workspace, nothing to disconnect.',
        };
      }

      const closed = await disconnectOAuthServer(workspaceId, 'notion');
      resetNotionMcpTools(workspaceId);

      return {
        disconnected: closed,
        message: closed
          ? 'Notion disconnected. The Notion tools have been removed; connect again via the notion_connect flow to reuse the workspace.'
          : 'Could not disconnect Notion: the OAuth authorization could not be cleared. Please try again.',
      };
    },
  });
}

/**
 * Inert default export for the Mastra fs-agent build (Studio override path).
 * The real runtime tool is built by `createNotionDisconnectTool` above.
 */
const notionDisconnectToolStub: Record<string, unknown> = {};

export default notionDisconnectToolStub;