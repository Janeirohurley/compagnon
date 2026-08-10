import { createFilesystemMcp } from './filesystem';
import { createSshMcp } from './ssh';
import { createOutlineMcp } from './outline';
import { createGithubMcp } from './github';
import { createGitMcp } from './git';
import { MCPClient } from '@mastra/mcp';


async function loadMcp(
  name: string,
  factory: () => MCPClient,
  target: Record<string, unknown>,
) {
  try {
    const client = factory();
    const tools = await client.listTools();

    Object.assign(target, tools);

    console.log(
      `[Compagnon] MCP "${name}" connected successfully.`
    );
  } catch (error) {
    console.warn(
      `[Compagnon] MCP "${name}" unavailable:`,
      error instanceof Error ? error.message : error
    );
  }
}

export async function getCompanionMcpTools() {
  const tools = {};

  await loadMcp('filesystem', createFilesystemMcp, tools);
  await loadMcp('ssh', createSshMcp, tools);
  await loadMcp('outline', createOutlineMcp, tools);
  await loadMcp('github', createGithubMcp, tools);
  await loadMcp('git', createGitMcp, tools);

  return tools;
}