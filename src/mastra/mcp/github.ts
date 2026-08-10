import { MCPClient } from '@mastra/mcp';

export function createGithubMcp(): MCPClient {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      '[Compagnon] GitHub MCP cannot start: GITHUB_TOKEN is not configured.',
    );
  }

  try {
    const client = new MCPClient({
      id: 'compagnon-github',
      servers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: token,
          },
        },
      },
    });

    console.info(
      '[Compagnon] GitHub MCP configured successfully.',
    );

    return client;
  } catch (error: any) {
    console.error(
      '[Compagnon] GitHub MCP configuration failed.',
      error.message,
    );

    throw new Error(
      '[Compagnon] Unable to configure GitHub MCP. Check the GitHub MCP configuration and credentials.',
      { cause: error.message },
    );
  }
}