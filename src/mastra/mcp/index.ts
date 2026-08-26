import { createFilesystemMcp } from './filesystem';
import { createSshMcp } from './ssh';

import { createGitMcp } from './git';
import { MCPClient } from '@mastra/mcp';

const MAX_CONNECT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadMcp(
  name: string,
  factory: () => MCPClient,
  target: Record<string, unknown>,
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      const client = factory();
      const tools = await client.listTools();

      Object.assign(target, tools);

      console.log(
        `[Compagnon] MCP "${name}" connected successfully (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS}).`,
      );
      return;
    } catch (error) {
      lastError = error;

      console.warn(
        `[Compagnon] MCP "${name}" attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed:`,
        error instanceof Error ? error.message : error,
      );

      if (attempt < MAX_CONNECT_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.warn(
    `[Compagnon] MCP "${name}" unavailable after ${MAX_CONNECT_ATTEMPTS} attempts:`,
    lastError instanceof Error ? lastError.message : lastError,
  );
}

export async function getCompanionMcpTools() {
  const tools = {};

  await loadMcp('filesystem', createFilesystemMcp, tools);
  await loadMcp('ssh', createSshMcp, tools);
  // Outline MCP is loaded exclusively by the Outline Agent
  // GitHub MCP is loaded exclusively by the GitHub Agent
  await loadMcp('git', createGitMcp, tools);

  if (process.env.PLANE_MCP_ENABLED === 'true') {
  }

  return tools;
}