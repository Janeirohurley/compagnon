import { MCPClient } from '@mastra/mcp';

export function createGitMcp(): MCPClient {
  const repository = process.env.COMPANION_GIT_REPOSITORY;

  if (!repository) {
    throw new Error(
      '[Compagnon] Git MCP cannot start: COMPANION_GIT_REPOSITORY is not configured.',
    );
  }

  try {
    const client = new MCPClient({
      id: 'compagnon-git',
      servers: {
        git: {
          command: 'uvx',
          args: [
            '--with',
            'mcp<2',
            'mcp-server-git',
            '--repository',
            repository,
          ],
        },
      },
    });

    console.info(
      `[Compagnon] Git MCP configured successfully for repository: ${repository}`,
    );

    return client;
  } catch (error: any) {
    console.error(
      '[Compagnon] Failed to initialize Git MCP.',
      error.message,
    );

    throw new Error(
      '[Compagnon] Unable to initialize Git MCP. Check uvx, mcp-server-git, and COMPANION_GIT_REPOSITORY.',
      { cause: error.message },
    );
  }
}