import { createOutlineMcp } from './outline';

const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load ONLY the Outline MCP tools.
 * Used by the Outline Agent exclusively.
 */
export async function getOutlineMcpTools(): Promise<Record<string, unknown>> {
  const tools: Record<string, unknown> = {};

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      const client = createOutlineMcp();
      const mcpTools = await client.listTools();
      Object.assign(tools, mcpTools);

      console.log(
        `[Outline Agent] MCP "outline" connected successfully (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}).`,
      );
      return tools;
    } catch (error) {
      console.warn(
        `[Outline Agent] MCP "outline" attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed:`,
        error instanceof Error ? error.message : error,
      );

      if (attempt < MAX_CONNECT_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.warn(
    `[Outline Agent] MCP "outline" unavailable after ${MAX_CONNECT_ATTEMPTS} attempts.`,
  );
  return tools;
}
