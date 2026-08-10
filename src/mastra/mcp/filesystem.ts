import { MCPClient } from '@mastra/mcp';

import { getCompanionConfig } from '../config/companion-config';

export function createFilesystemMcp(): MCPClient {
  try {
    const { workspaceRoots } = getCompanionConfig();

    if (!workspaceRoots.length) {
      throw new Error(
        'No workspace roots are configured for the Filesystem MCP.',
      );
    }

    const client = new MCPClient({
      id: 'compagnon-filesystem',
      servers: {
        filesystem: {
          command: 'npx',
          args: [
            '-y',
            '@modelcontextprotocol/server-filesystem',
            ...workspaceRoots,
          ],
        },
      },
    });

    console.info(
      `[Compagnon] Filesystem MCP configured successfully (${workspaceRoots.length} workspace root(s)).`,
    );

    return client;
  } catch (error: any) {
    console.error(
      '[Compagnon] Failed to initialize Filesystem MCP.',
      error.message,
    );

    throw new Error(
      '[Compagnon] Unable to initialize Filesystem MCP. Check the Companion workspace configuration.',
      { cause: error.message },
    );
  }
}