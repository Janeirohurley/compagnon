import { MCPClient } from '@mastra/mcp';

const OUTLINE_MCP_PATH = '/mcp';

export function createOutlineMcp(): MCPClient {
  const baseUrl = process.env.OUTLINE_BASE_URL;
  const apiKey = process.env.OUTLINE_API_KEY;

  if (!baseUrl) {
    throw new Error(
      '[Compagnon] Outline MCP cannot start: OUTLINE_BASE_URL is not configured.',
    );
  }

  if (!apiKey) {
    throw new Error(
      '[Compagnon] Outline MCP cannot start: OUTLINE_API_KEY is not configured.',
    );
  }

  let mcpUrl: URL;

  try {
    mcpUrl = new URL(OUTLINE_MCP_PATH, baseUrl);
  } catch (error) {
    throw new Error(
      `[Compagnon] Outline MCP cannot start: invalid OUTLINE_BASE_URL.`,
      { cause: error },
    );
  }

  try {
    const client = new MCPClient({
      id: 'compagnon-outline',
      servers: {
        outline: {
          url: mcpUrl,
          requestInit: {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        },
      },
    });

    console.info(
      `[Compagnon] Outline MCP configured successfully: ${mcpUrl.origin}`,
    );

    return client;
  } catch (error: any) {
    console.error(
      '[Compagnon] Failed to initialize Outline MCP.',
      error.message,
    );

    throw new Error(
      '[Compagnon] Unable to initialize Outline MCP. Check the Outline URL and API key configuration.',
      { cause: error.message },
    );
  }
}