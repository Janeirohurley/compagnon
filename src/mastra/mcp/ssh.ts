import { MCPClient } from '@mastra/mcp';

export function createSshMcp(): MCPClient {
  const args = ['-y', 'ssh-mcp'];
  const configPath = process.env.COMPANION_SSH_CONFIG;

  if (configPath) {
    args.push(`--config=${configPath}`);
  }

  try {
    const client = new MCPClient({
      id: 'compagnon-ssh',
      servers: {
        ssh: {
          command: 'npx',
          args,
        },
      },
    });

    console.info(
      '[Compagnon] SSH MCP initialized.',
      configPath
        ? `Config: ${configPath}`
        : 'Using default SSH configuration.',
    );

    return client;
  } catch (error: any) {
    console.error('[Compagnon] SSH MCP initialization failed.', error.message);

    throw new Error(
      '[Compagnon] Unable to initialize the SSH MCP server. ' +
        'Verify that ssh-mcp is installed/available and that the SSH configuration is valid.',
      { cause: error.message },
    );
  }
}