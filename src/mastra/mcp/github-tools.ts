import { createGithubMcp } from './github';

const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load ONLY the GitHub MCP tools.
 * Used by the GitHub Agent exclusively.
 */
export async function getGithubMcpTools(): Promise<Record<string, unknown>> {
  const tools: Record<string, unknown> = {};

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      const client = createGithubMcp();
      const mcpTools = await client.listTools();
      Object.assign(tools, mcpTools);

      console.log(
        `[GitHub Agent] MCP "github" connected successfully (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}).`,
      );
      return tools;
    } catch (error) {
      console.warn(
        `[GitHub Agent] MCP "github" attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed:`,
        error instanceof Error ? error.message : error,
      );

      if (attempt < MAX_CONNECT_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.warn(
    `[GitHub Agent] MCP "github" unavailable after ${MAX_CONNECT_ATTEMPTS} attempts.`,
  );
  return tools;
}
