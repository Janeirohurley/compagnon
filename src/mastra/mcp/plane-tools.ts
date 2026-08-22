import { createPlaneMcp } from './plane';

const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load ONLY the Plane MCP tools.
 * Used by the Plane Agent exclusively.
 */
export async function getPlaneMcpTools(): Promise<Record<string, unknown>> {
  const tools: Record<string, unknown> = {};

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      const client = createPlaneMcp();
      const mcpTools = await client.listTools();
      Object.assign(tools, mcpTools);

      console.log(
        `[Plane Agent] MCP "plane" connected successfully (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}).`,
      );
      return tools;
    } catch (error) {
      console.warn(
        `[Plane Agent] MCP "plane" attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed:`,
        error instanceof Error ? error.message : error,
      );

      if (attempt < MAX_CONNECT_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.warn(
    `[Plane Agent] MCP "plane" unavailable after ${MAX_CONNECT_ATTEMPTS} attempts.`,
  );
  return tools;
}
